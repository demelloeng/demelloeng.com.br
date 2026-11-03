"""Converte um IFC hidrossanitário (AltoQi Builder, IFC2X3 ou IFC4) em GLB leve, uma malha por rede, mais um JSON com a identidade de cada peça.
Somente leitura do IFC. O IFC de origem é dado de cliente: não vai ao site; só o GLB derivado, com nomes neutros.
Redes mantidas: Água fria (com alimentação), Esgoto (com recalque) e Pluvial. Hidrantes e Gás ficam de fora (pertencem a outras páginas de serviço).
Uso: python scripts/ifc_para_glb_hidro.py <entrada.ifc> <saida_sem_extensao>

REGRA DE PESO (instituída por Marcos em 29/10/2026): modelo 3D de página de serviço tem de abrir no celular e ser bonito de perto.
  1. IFC passa antes por scripts/otimizar_ifc.py (sem perda; skill portal-publicar). Aqui só se lê o resultado.
  2. Peças pequenas e complexas são simplificadas por agrupamento de vértices até LIMITE_TRI_PECA triângulos
     (só as que passam disso); tubos não são mexidos.
  3. O GLB final não pode passar de LIMITE_GLB_KB. Passou: o script falha e não grava nada.
As cores são as do IFC original (decisão de Marcos, 29/10/2026); a legenda sai delas.
Regra visual: tubos, conexões e registros têm a espessura ampliada (ENGROSSAR); caixa d'água, bombas e aparelhos ficam no tamanho real.
"""
import sys, json, collections, os
import numpy as np, trimesh
import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as U
sys.stdout.reconfigure(encoding='utf-8')

REDES = {'Água fria': 'agua-fria', 'Alimentação': 'agua-fria', 'Esgoto': 'esgoto', 'Recalque': 'esgoto', 'Pluvial': 'pluvial'}
CLASSES = ['IfcDistributionFlowElement', 'IfcBuildingElementProxy']   # inclui tubos, conexões, aparelhos, reservatórios e bombas (IFC2X3 e IFC4)
TUBOS = ('IfcFlowSegment', 'IfcPipeSegment')
FINOS = TUBOS + ('IfcFlowFitting', 'IfcPipeFitting', 'IfcFlowController', 'IfcValve')

LIMITE_GLB_KB = 2000   # modelo visual e comercial: precisa ser bonito de perto e abrir no celular (Marcos, 29/10/2026)
ENGROSSAR = 3.0        # só visual: tubo de 25 a 110 mm some numa obra grande; a página avisa que a espessura foi ampliada
LIMITE_TRI_PECA = 250  # abaixo disso a peça fica como veio: cotovelo continua curva


def rotulo(el, ps):
    """Nome neutro e legível de cada peça (sem diâmetro, sem fabricante, sem nome de cliente)."""
    c, tipo, classe = el.is_a(), (ps.get('Tipo') or '').lower(), (ps.get('Classe') or '').lower()
    if c in TUBOS:
        return 'Tubo'
    if c in ('IfcFlowFitting', 'IfcPipeFitting'):
        return 'Conexão'
    if c == 'IfcTank':
        return "Caixa d'água" if ('água' in tipo or 'agua' in tipo) else 'Caixa coletora'
    if c == 'IfcPump' or 'bomba' in classe:
        return 'Bomba'
    if c == 'IfcFlowMeter':
        return 'Hidrômetro'
    if c in ('IfcValve', 'IfcFlowController'):
        return 'Registro ou válvula'
    if c in ('IfcSanitaryTerminal', 'IfcFlowTerminal'):
        return 'Aparelho ou ponto de uso'
    if c == 'IfcWasteTerminal':
        return 'Ralo ou caixa'
    if 'piscina' in classe:
        for chave, nome in (('skimmer', 'Skimmer da piscina'), ('dreno', 'Dreno da piscina'), ('retorno', 'Retorno da piscina'), ('filtro', 'Filtro da piscina')):
            if chave in tipo:
                return nome
        return 'Peça da piscina'
    return 'Peça'


def cor_do_ifc(geom):
    """Cor original do IFC (material da peça). Se a peça tiver mais de um material, vale o mais usado."""
    mats = geom.materials
    if not mats:
        return (200, 200, 200)
    ids = list(geom.material_ids)
    mat = mats[max(set(ids), key=ids.count)] if ids else mats[0]
    d = mat.diffuse
    if not d:
        return (200, 200, 200)
    return tuple(int(round(255 * (max(0.0, min(1.0, x)) ** 2.2))) for x in (d.r(), d.g(), d.b()))   # sRGB do IFC -> linear do glTF


def engrossar(v, tubo, k):
    """Amplia a espessura em torno do eixo (tubo) ou o tamanho da peça (conexão, registro)."""
    if k == 1:
        return v
    c = v.mean(0)
    d = v - c
    if not tubo:
        return c + d * k
    eixo = np.linalg.svd(d, full_matrices=False)[2][0]
    ao_longo = (d @ eixo)[:, None] * eixo
    return c + ao_longo + (d - ao_longo) * k


def reduzir(v, f, alvo=LIMITE_TRI_PECA):
    """Agrupamento de vértices: aproxima a forma sem mudar o lugar nem o tamanho da peça."""
    if len(f) <= alvo:
        return v, f
    diag = float(np.linalg.norm(v.max(0) - v.min(0))) or 1.0
    for frac in (0.04, 0.06, 0.09, 0.13, 0.2, 0.3):
        celula = diag * frac
        chave = np.round((v - v.min(0)) / celula).astype(np.int64)
        _, idx, inv = np.unique(chave, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        nv = np.array([v[inv == k].mean(0) for k in range(len(idx))])
        nf = inv[f]
        nf = nf[(nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2])]
        if len(nf) <= alvo:
            break
    return nv, nf


src, out = sys.argv[1], sys.argv[2]
m = ifcopenshell.open(src)
print('schema', m.schema)

# pavimento de cada elemento
pavimentos, pav_idx = [], {}
for rel in m.by_type('IfcRelContainedInSpatialStructure'):
    nm = rel.RelatingStructure.Name or ''
    if nm not in pavimentos:
        pavimentos.append(nm)
    for e in rel.RelatedElements:
        pav_idx[e.id()] = pavimentos.index(nm)


def rede_de(e):
    for v in U.get_psets(e).values():
        if isinstance(v, dict) and v.get('Rede') in REDES:
            return REDES[v['Rede']]
    return None


alvo = {}
for cls in CLASSES:
    for e in m.by_type(cls):
        r = rede_de(e)
        if r:
            alvo[e.id()] = r

cfg = ifcopenshell.geom.settings()
cfg.set('use-world-coords', True)
cfg.set('mesher-angular-deflection', 2.5)  # círculos com poucos lados: o GLB precisa ser leve para o celular
cfg.set('mesher-linear-deflection', 0.02)
it = ifcopenshell.geom.iterator(cfg, m, 4)
acum = collections.defaultdict(lambda: ([], []))
cores = collections.defaultdict(list)
legenda = {}   # nome da peça -> cor do IFC (sRGB, hex), para a legenda da maquete
ident = collections.defaultdict(list)
nface = collections.Counter()
if it.initialize():
    while True:
        s = it.get()
        g = alvo.get(s.id)
        if g:
            el = m.by_id(s.id)
            v = np.array(s.geometry.verts, dtype=np.float64).reshape(-1, 3)
            f = np.array(s.geometry.faces, dtype=np.int64).reshape(-1, 3)
            if len(v) and len(f):
                if el.is_a() not in TUBOS:
                    v, f = reduzir(v, f)
                v = engrossar(v, el.is_a() in TUBOS, ENGROSSAR if el.is_a() in FINOS else 1.0)
                vs, fs = acum[g]
                fs.append(f + sum(len(x) for x in vs))
                vs.append(v)
                nome = rotulo(el, U.get_psets(el).get('Identificação_Elemento', {}))
                cor = cor_do_ifc(s.geometry)
                legenda.setdefault(nome, '#%02x%02x%02x' % tuple(int(round(255 * (c / 255) ** (1 / 2.2))) for c in cor))
                cores[g].append(np.tile(np.array(cor + (255,), dtype=np.uint8), (len(v), 1)))
                ident[g].append([nome, pav_idx.get(el.id(), -1), int(nface[g]), int(len(f)), ''])
                nface[g] += len(f)
        if not it.next():
            break

todos = np.vstack([np.vstack(v) for v, _ in acum.values()])
print('caixa min', todos.min(0).round(2), 'max', todos.max(0).round(2))
cena = trimesh.Scene()
for g, (vs, fs) in acum.items():
    V = np.vstack(vs)
    F = np.vstack(fs)
    V = np.column_stack([V[:, 0], V[:, 2], -V[:, 1]])  # IFC (Z para cima) -> glTF (Y para cima)
    malha = trimesh.Trimesh(vertices=V, faces=F, vertex_colors=np.vstack(cores[g]), process=False)   # sem juntar vértices: cada peça mantém a sua cor
    assert len(malha.faces) == len(F)
    cena.add_geometry(malha, node_name=g, geom_name=g)
    print(g, len(ident[g]), 'peças', len(F), 'triângulos', dict(collections.Counter(e[0] for e in ident[g]).most_common(6)))
tmp = out + '.glb.tmp'
cena.export(tmp, file_type='glb')
kb = round(os.path.getsize(tmp) / 1024)
if kb > LIMITE_GLB_KB:
    os.remove(tmp)
    sys.exit('REPROVADO: GLB com %d KB, limite %d KB. Nada foi gravado.' % (kb, LIMITE_GLB_KB))
os.replace(tmp, out + '.glb')
json.dump({'pavimentos': pavimentos, 'legenda': legenda, 'grupos': ident}, open(out + '.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('GLB', kb, 'KB | JSON', round(os.path.getsize(out + '.json') / 1024), 'KB | pavimentos', pavimentos)

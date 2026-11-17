"""Casca arquitetônica do Colégio Luiz Carlos para a maquete de hidrantes (página de incêndio, V03).

Fonte geométrica: a planta "SAN 1 - Térreo" (escala 1:75) da prancha HID.ESGOTO P01 do projeto hidrossanitário do
colégio. A prancha é dado de cliente e NÃO entra no repositório: este script a lê do caminho dado na linha de comando
e grava só o GLB derivado (paredes do térreo, sem texto, carimbo, cota, louça ou nome de ambiente).

Registro (medido em 17/11/2026; ver docs/CASCA_LUIZ_CARLOS.md):
  * IFC -> GLB de hidrantes: x = X - 41,2613; y = Z + 2,25; z = -Y + 22,8845 (156 peças de geometria IFC, desvio < 0,1 mm);
  * planta 1:75 -> IFC: translação pura, sem giro nem espelho: X = xp + 21,501; Y = yp + 50,324 (xp, yp em metros na
    folha, y para cima). Casamento das peças do IFC que encostam em parede (82 de 119 a menos de 8 cm) e dos terminais
    de água fria sobre as louças desenhadas.
Alturas: a planta não traz pé-direito. As paredes dos blocos sobem do Térreo (0,00) até o nível "Pavimento 1" do mesmo
IFC (5,53 m), que é onde chegam os condutores pluviais (a calha); a cobertura é uma face plana nesse nível. É
representação simplificada, e a página diz isso. Aberturas não são modeladas (janela aparece como parede); muro,
meio-fio e calçada ficam só como contorno no chão.

Uso: python scripts/gerar-casca-luiz-carlos.py "<HID.ESGOTO P01.pdf>" assets/models/hidrantes-luiz-carlos-casca.glb [previa.geojson]
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pymupdf
import shapely
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

PRANCHA_SHA256 = 'd512be32fb821623b512ecd53bf17b4cdf787af855de4adbee4804beb6039fd5'   # a prancha fica fora do repositório
PT_POR_M = 72 / 25.4 / 75 * 1000          # 1:75
JANELA_PT = (110.0, 60.0, 1790.0, 2300.0)  # área da planta "SAN 1 - Térreo" na folha (x0, y0, x1, y1), em pontos
CINZA = (0.31, 0.31, 0.31)                 # traço da arquitetura de base (o esgoto vem em azul e verde)
PLANTA_PARA_IFC = (21.501, 50.324)
IFC_PARA_GLB = (41.2613, -2.25, -22.8845)
TERREO_Z, PAV1_Z = 0.0, 5.53               # IfcBuildingStorey "Térreo" e "Pavimento 1"
R_FECHA = 0.16      # pares de linhas a até 32 cm viram parede
R_FINO = 0.035      # faixas com menos de 7 cm (folha de porta, divisória, traço duplo) saem
R_GROSSO = 0.30     # manchas com mais de 60 cm (escada, árvore, hachura, mobiliário denso) saem
AREA_MIN = 0.06


def linhas_da_planta(pdf):
    pagina = pymupdf.open(pdf)[0]
    x0, y0, x1, y1 = JANELA_PT
    linhas = []
    for d in pagina.get_drawings():
        if tuple(round(c, 2) for c in (d.get('color') or ())) != CINZA:
            continue
        for item in d['items']:
            if item[0] == 'l':
                pares = [((item[1].x, item[1].y), (item[2].x, item[2].y))]
            elif item[0] == 're':
                r = item[1]
                pares = [((r.x0, r.y0), (r.x1, r.y0)), ((r.x1, r.y0), (r.x1, r.y1)), ((r.x1, r.y1), (r.x0, r.y1)), ((r.x0, r.y1), (r.x0, r.y0))]
            else:
                continue
            for (ax, ay), (bx, by) in pares:
                if not (x0 < min(ax, bx) and max(ax, bx) < x1 and y0 < min(ay, by) and max(ay, by) < y1):
                    continue
                if abs(ax - bx) + abs(ay - by) < 1e-6:
                    continue
                linhas.append(LineString([(ax / PT_POR_M, -ay / PT_POR_M), (bx / PT_POR_M, -by / PT_POR_M)]))
    return linhas


def paredes(linhas):
    """Fechamento morfológico em vetor: par de linhas paralelas próximas vira faixa sólida; linha solta some."""
    faixas = unary_union([l.buffer(R_FECHA, cap_style='flat', join_style='mitre') for l in linhas])
    fechado = faixas.buffer(-R_FECHA, join_style='mitre')
    sem_fino = fechado.buffer(-R_FINO, join_style='mitre').buffer(R_FINO, join_style='mitre')
    grosso = fechado.buffer(-R_GROSSO, join_style='mitre').buffer(R_GROSSO + 0.05, join_style='mitre')
    resto = sem_fino.difference(grosso)
    partes = [g.simplify(0.01) for g in getattr(resto, 'geoms', [resto]) if isinstance(g, Polygon) and g.area >= AREA_MIN]
    return MultiPolygon([p for p in partes if isinstance(p, Polygon) and not p.is_empty])


def _partes(g):
    return [p for p in getattr(g, 'geoms', [g]) if isinstance(p, Polygon) and not p.is_empty]


# Em que região da folha está cada bloco construído (leitura da planta, em metros na folha). O contorno EXATO de cada
# bloco sai das paredes desenhadas dentro da janela; a janela só diz onde procurar. Fora dos blocos ficam muro,
# meio-fio, calçada, arquibancada e restos de símbolo (árvore), que não sobem.
BLOCOS = {
    'salas, escada, sanitários, cozinha e salão': (3.0, -20.9, 42.6, -3.0),
    'sanitários e vestiários': (3.0, -36.0, 21.9, -26.3),
    'salas do bloco inferior': (3.0, -49.9, 26.0, -41.0),
}


def lado_maior(p):
    r = list(p.minimum_rotated_rectangle.exterior.coords)
    return max(np.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), np.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]))


def classificar(mp):
    """Paredes dentro de um bloco sobem até o Pavimento 1; as de fora ficam só como contorno no chão (a altura delas
    não está documentada). Pedaço solto pequeno fora dos blocos (resto de árvore, louça) sai."""
    massas = []
    for janela in BLOCOS.values():
        dentro = mp.intersection(shapely.geometry.box(*janela))
        if not dentro.is_empty:
            massas.append(shapely.geometry.box(*dentro.bounds).buffer(0.02, join_style='mitre'))
    massa = unary_union(massas)
    # dentro do bloco, só sobe o que tem pelo menos 1 m no lado maior; pedaço curto (bancada, louça, divisória, batente)
    # fica no chão, como contorno, em vez de virar uma parede de 5 m
    dentro = _partes(mp.intersection(massa))
    paredes_predio = MultiPolygon([p for p in dentro if lado_maior(p) >= 1.0])
    curtos = [p for p in dentro if lado_maior(p) < 1.0 and p.area >= 0.02]
    soltos = curtos + [p for p in _partes(mp.difference(massa)) if p.area >= 0.35 or lado_maior(p) >= 1.2]
    return paredes_predio, MultiPolygon(soltos), MultiPolygon(_partes(massa))


def placa(poligonos, z):
    """Uma face horizontal por polígono, sem espessura (a casca é transparente e de dupla face)."""
    y = z - IFC_PARA_GLB[1]; pos = []
    for p in poligonos.geoms:
        for tri in shapely.constrained_delaunay_triangles(shapely.geometry.polygon.orient(p, 1.0)).geoms:
            for (x, yy) in list(tri.exterior.coords)[:3]:
                gx, gz = para_glb(x, yy); pos.append((gx, y, gz))
    return np.array(pos, dtype=np.float32)


def para_glb(x, y):
    """planta (m, y para cima) -> GLB de hidrantes (x, z)."""
    X = x + PLANTA_PARA_IFC[0]; Y = y + PLANTA_PARA_IFC[1]
    return X - IFC_PARA_GLB[0], -Y - IFC_PARA_GLB[2]


def extrudar(poligonos, z0, z1):
    """Prisma de cada polígono: tampa de cima (triangulada com furos) e faces laterais. Sem base (pousa no piso)."""
    y0 = z0 - IFC_PARA_GLB[1]; y1 = z1 - IFC_PARA_GLB[1]
    pos = []
    for p in poligonos.geoms:
        p = shapely.geometry.polygon.orient(p, 1.0)   # externo anti-horário, furos horários
        for tri in shapely.constrained_delaunay_triangles(p).geoms:
            a, b, c, _ = tri.exterior.coords
            if shapely.geometry.Polygon([a, b, c]).exterior.is_ccw:
                a, b = b, a
            for (x, y) in (a, b, c):   # a planta tem y para cima e o GLB tem z = -y: a ordem horária na planta vira anti-horária vista de cima
                gx, gz = para_glb(x, y); pos.append((gx, y1, gz))
        for anel in [p.exterior, *p.interiors]:
            cs = list(anel.coords)
            for (xa, ya), (xb, yb) in zip(cs[:-1], cs[1:]):
                ax, az = para_glb(xa, ya); bx, bz = para_glb(xb, yb)
                pos += [(ax, y0, az), (bx, y1, bz), (bx, y0, bz), (ax, y0, az), (ax, y1, az), (bx, y1, bz)]
    return np.array(pos, dtype=np.float32)


def gravar_glb(malhas, saida):
    """GLB mínimo: uma malha por nome, só posições (sem índice: cada 3 vértices, um triângulo), sem material."""
    corpo = bytearray(); visoes = []; acess = []; nos = []; mals = []
    for i, (nome, pos) in enumerate(malhas.items()):
        dados = pos.tobytes()
        visoes.append({'buffer': 0, 'byteOffset': len(corpo), 'byteLength': len(dados), 'target': 34962})
        corpo += dados
        while len(corpo) % 4:
            corpo += b'\0'
        acess.append({'bufferView': i, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                      'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        mals.append({'name': nome, 'primitives': [{'attributes': {'POSITION': i}, 'mode': 4}]})
        nos.append({'name': nome, 'mesh': i})
    gltf = {'asset': {'version': '2.0', 'generator': 'demelloeng scripts/gerar-casca-luiz-carlos.py'}, 'scene': 0,
            'scenes': [{'nodes': list(range(len(nos)))}], 'nodes': nos, 'meshes': mals, 'accessors': acess,
            'bufferViews': visoes, 'buffers': [{'byteLength': len(corpo)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(corpo)
    out = bytearray(b'glTF') + (2).to_bytes(4, 'little') + total.to_bytes(4, 'little')
    out += len(js).to_bytes(4, 'little') + b'JSON' + js + len(corpo).to_bytes(4, 'little') + b'BIN\0' + corpo
    Path(saida).write_bytes(out)
    return hashlib.sha256(out).hexdigest()


def main(pdf, saida, previa=None):
    sha = hashlib.sha256(Path(pdf).read_bytes()).hexdigest()
    if sha != PRANCHA_SHA256:
        raise SystemExit(f'prancha diferente da registrada: {sha}')
    linhas = linhas_da_planta(pdf)
    mp = paredes(linhas)
    predio, soltos, massa = classificar(mp)
    print(f'prancha {sha} · linhas {len(linhas)} · paredes {predio.area:.1f} m² · soltos {soltos.area:.1f} m² · massa {massa.area:.0f} m²')
    if previa:
        Path(previa).write_text(json.dumps({k: json.loads(shapely.to_geojson(v)) for k, v in
                                            {'paredes': predio, 'contorno': soltos, 'projecao': massa}.items()}))
    # cobertura simplificada: face plana no nível da calha (5,53 m) sobre a projeção de cada bloco. O nível vem dos
    # condutores pluviais do IFC (0,00 -> 5,53) e das ventilações de esgoto que passam acima dele (5,82 -> 7,53).
    malhas = {'paredes': extrudar(predio, TERREO_Z, PAV1_Z), 'contorno': extrudar(soltos, TERREO_Z, TERREO_Z + 0.06),
              'cobertura': placa(massa, PAV1_Z)}
    for k, v in malhas.items():
        print(f'  {k}: {len(v) // 3} triângulos')
    print(f'{saida}: sha256 {gravar_glb(malhas, saida)} · {Path(saida).stat().st_size} bytes')


if __name__ == '__main__':
    main(*sys.argv[1:4])

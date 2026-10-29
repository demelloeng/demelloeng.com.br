"""Layout "rico" das páginas de serviço: maquete 3D no topo, etapas, sanfona, diagrama, imagens grandes.
O TEXTO vem sempre da copy aprovada (<slug>.copy.json) e dos blocos antigos mantidos; aqui só se diagrama.
Usado por gerar-paginas-servico-v02.py quando a copy tem "layout": "rico".
"""
import re

ICONES = [  # casa nova, ampliar, estudo/arquivo existente, camadas
    '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    '<path d="M3 12l7-5 7 5"/><path d="M5 11v8h10v-8"/><path d="M19 4v6M16 7h6"/>',
    '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
    '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/>',
]

# etapas: rótulo, quem cuida (tudo isto sai do texto: "a DEMELLO cuida da aprovação e entrega o projeto aprovado",
# "alvará e habite-se são emitidos pela prefeitura", "a DEMELLO não executa a obra")
ETAPAS = [('Projeto legal', 'DEMELLO', 'dm'), ('Aprovação', 'DEMELLO cuida', 'dm'), ('Alvará de construção', 'Prefeitura', 'pf'),
          ('Obra', 'Construtora ou empreiteiro de sua confiança', 'fora'), ('Habite-se', 'Prefeitura', 'pf')]

DIAGRAMA_BIM = '''<svg class="rico-bim" viewBox="0 0 440 300" role="img" aria-label="Arquitetura, estrutura e instalações se encontram em um único modelo BIM">
<g class="entrada"><rect x="10" y="20" width="150" height="56" rx="4"/><text x="85" y="54" text-anchor="middle">Arquitetura</text>
<rect x="10" y="122" width="150" height="56" rx="4"/><text x="85" y="156" text-anchor="middle">Estrutura</text>
<rect x="10" y="224" width="150" height="56" rx="4"/><text x="85" y="258" text-anchor="middle">Instalações</text></g>
<g class="fios"><path d="M160 48 C 210 48, 210 150, 262 150"/><path d="M160 150 L 262 150"/><path d="M160 252 C 210 252, 210 150, 262 150"/></g>
<g class="modelo"><rect x="262" y="90" width="168" height="120" rx="4"/><text x="346" y="142" text-anchor="middle" class="t1">Modelo único</text><text x="346" y="168" text-anchor="middle" class="t2">em BIM</text></g>
</svg>'''


def _lista(conteudo, tipo):
    return next((c for c in conteudo if c['tipo'] == tipo), None)


def _paragrafos(bloco):
    return [c['texto'] for c in bloco['conteudo'] if c['tipo'] in ('paragrafo', 'nota')]


def hero(copia, d, maquete_html):
    cta = d['cta']
    intro = ''.join(f'<p>{p}</p>' for p in d['introducao'])
    return f'''<section class="rico-hero-fundo" data-block="service-hero"><div class="rico-hero wrap">
<div class="rico-titulo"><p class="crumb"><a href="../">Serviços</a> / {copia["nome_servico"]}</p><h1>{d["h1"]}</h1></div>
<div class="rico-caixa">{maquete_html}</div>
<div class="rico-texto"><p class="chamada">{d["chamada"]}</p>{intro}<p class="cta-linha"><a class="cta" href="{cta["href"]}">{cta["rotulo"]} →</a></p><p class="micro">{cta["micro"]}</p></div>
</div></section>'''


def para_quem(bloco):
    lead = next(c['texto'] for c in bloco['conteudo'] if c['tipo'] == 'paragrafo')
    itens = _lista(bloco['conteudo'], 'lista')['itens']
    lis = ''.join(f'<li><svg viewBox="0 0 24 24" aria-hidden="true">{ICONES[i % 4]}</svg><span>{t}</span></li>' for i, t in enumerate(itens))
    return f'<section class="rico-sec wrap"><div class="rico-cab"><h2>{bloco["titulo"]}</h2><p>{lead}</p></div><ul class="rico-opcoes">{lis}</ul></section>'


def muda(bloco):
    itens = _lista(bloco['conteudo'], 'beneficios')['itens']
    cols = ''.join(f'<div><h3>{i["titulo"]}</h3><p>{i["texto"]}</p></div>' for i in itens)
    return f'<section class="rico-sec rico-muda wrap"><h2>{bloco["titulo"]}</h2><div class="rico-tres">{cols}</div></section>'


def prefeitura(bloco):
    p = _paragrafos(bloco)             # 5 parágrafos da V05, na ordem
    etapas = ''.join(f'<li class="{cls}"><span class="ponto"></span><b>{nome}</b><em>{quem}</em></li>' for nome, quem, cls in ETAPAS)
    entrega = p[3].split('. ', 1)
    entrega_html = f'<strong>{entrega[0]}.</strong> {entrega[1]}' if len(entrega) == 2 else p[3]
    return f'''<section class="rico-faixa"><div class="wrap">
<h2>{bloco["titulo"]}</h2>
<ol class="rico-etapas" aria-label="Do projeto ao habite-se">{etapas}</ol>
<div class="rico-duas">
<div class="rico-corrido"><p>{p[0]}</p><p>{p[1]}</p></div>
<div class="rico-cartoes">
<div class="rico-cartao"><span class="chips"><i>Área construída</i><i>IPTU</i><i>Matrícula</i></span><p>{p[2]}</p></div>
<div class="rico-cartao destaque"><p>{entrega_html}</p></div>
</div></div>
<p class="rico-gancho">{p[4]}</p>
</div></section>'''


def faz(bloco):
    ps = ''.join(f'<p>{t}</p>' for t in _paragrafos(bloco))
    return f'<section class="rico-sec wrap"><h2>{bloco["titulo"]}</h2><div class="rico-duas rico-faz"><div class="rico-corrido">{ps}</div><div class="rico-fig">{DIAGRAMA_BIM}</div></div></section>'


def perguntas(bloco):
    itens = _lista(bloco['conteudo'], 'perguntas')['itens']
    det = ''.join(f'<details class="rico-pergunta"{" open" if i == 0 else ""}><summary>{x["pergunta"]}</summary><p>{x["resposta"]}</p></details>' for i, x in enumerate(itens))
    return f'<section class="rico-sec wrap"><h2>{bloco["titulo"]}</h2><div class="rico-sanfona">{det}</div></section>'


def prova(bloco):
    ps = _paragrafos(bloco)
    m = re.search(r'registra ([\d\.]+) m²', ps[0])
    numero = f'<div class="rico-numero"><b>{m.group(1)} m²</b><span>de experiência técnica arquitetônica documentada</span></div>' if m else ''
    corpo = ''.join(f'<p>{t}</p>' for t in ps[:-1])   # a ressalva do CNPJ saiu por ordem de Marcos (29/10/2026)
    return f'<section class="rico-sec wrap"><h2>{bloco["titulo"]}</h2><div class="rico-duas rico-prova">{numero}<div class="rico-corrido">{corpo}</div></div></section>'


def djalma(bloco, figuras_html, imprensa=()):
    ps = ''.join(f'<p>{t}</p>' for t in _paragrafos(bloco))
    links = ''
    if imprensa:
        itens = ''.join(
            f'<li><a href="{x["url"]}" target="_blank" rel="noopener noreferrer"><span class="veiculo">{x["veiculo"]}'
            f'{" · " + x["data"] if x["data"] else ""}</span><span class="manchete">{x["titulo"]}</span></a></li>' for x in imprensa)
        links = f'<div class="rico-imprensa"><h3>A obra de ampliação na imprensa</h3><ul>{itens}</ul></div>'
    return (f'<section class="rico-sec wrap"><h2>{bloco["titulo"]}</h2>{figuras_html}'
            f'<div class="rico-corrido rico-estreito">{ps}</div>{links}</section>')

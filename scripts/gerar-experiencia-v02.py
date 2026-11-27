#!/usr/bin/env python3
"""Portfólio V02: fonte integral consolidada -> HTML; --check não escreve."""
import argparse
from decimal import Decimal
import hashlib
import html
import json
from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parent.parent
COPY = ROOT / 'docs/arquivo/experiencia-tecnica-v02-20261106/COPY_EXPERIENCIA_TECNICA_V01_CONSOLIDADA_20261106.md'
COPY_SHA256 = '403e62e0f67784dfa6a964a55601a9823eeed31b0fcbe0471c9f4431155e2e9a'
OUT = ROOT / 'experiencia-tecnica/index.html'
BASE = runpy.run_path(str(ROOT / 'scripts/gerar-construir-ou-ampliar-v02.py'))
TITLE = 'Projetos de engenharia civil e experiência técnica | DEMELLO'
DESCRIPTION = 'Conheça projetos de estruturas, instalações e outras disciplinas do acervo profissional de Marcos de Mello Silva, com registros técnicos e demonstrações BIM.'
URL = 'https://demelloeng.com.br/experiencia-tecnica/'
BLOCKS = ('experience-hero', 'documented-indicators', 'featured-projects', 'additional-projects', 'bim-demonstrations', 'technical-provenance', 'final-cta')


def inline(text):
    value = html.escape(text.strip(), quote=False)
    value = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', value)
    return value.replace('`', '')


def field(text, name):
    found = re.search(r'\*\*' + re.escape(name) + r':\*\*\s*([^\n]+)', text)
    if not found:
        raise ValueError('Campo obrigatório ausente: ' + name)
    return found.group(1).strip()


def href(value):
    if value.startswith('seção '):
        return '#projetos'
    value = value.strip('`')
    return '..' + value if value.startswith('/') else value


def render(text, cards=None):
    """Gramática restrita da fonte aprovada; detalhes fechados por padrão."""
    tokens = [t.strip() for t in re.split(r'\n\s*\n', text) if t.strip() and t.strip() != '---']
    result, card, details, grid = [], False, False, False
    i = 0
    def close_details():
        nonlocal details
        if details:
            result.append('</div></details>'); details = False
    while i < len(tokens):
        t = tokens[i]
        if t.startswith('#### '):
            close_details()
            if card: result.append('</article>')
            if cards and not grid:
                result.append('<div class="portfolio-grid">'); grid = True
            css = 'projeto-principal' if cards == 'main' else 'projeto-complementar' if cards else 'bim-texto'
            result.append(f'<article class="{css}"><h3>{inline(t[5:])}</h3>'); card = True
        elif re.match(r'\*\*H[12]:', t):
            m = re.fullmatch(r'\*\*(H[12]): (.*?)\*\*', t)
            tag = m.group(1).lower(); result.append(f'<{tag}>{inline(m.group(2))}</{tag}>')
        elif t.startswith('|'):
            rows = [line for line in t.splitlines() if not re.match(r'^\|[\s:|\-]+\|$', line)]
            result.append('<div class="table-scroll" role="region" aria-label="Dados documentais" tabindex="0"><table>')
            headings, *entries = [row.strip('|').split('|') for row in rows]
            result.append('<thead><tr>' + ''.join(f'<th scope="col">{inline(c)}</th>' for c in headings) + '</tr></thead><tbody>')
            for heading, *cells in entries:
                result.append('<tr>' + f'<th scope="row">{inline(heading)}</th>' + ''.join(f'<td>{inline(c)}</td>' for c in cells) + '</tr>')
            result.append('</tbody></table></div>')
        elif t.startswith('- '):
            result.append('<ul>' + ''.join('<li>' + inline(x[2:]) + '</li>' for x in t.splitlines()) + '</ul>')
        elif t.startswith('**Rótulo da expansão:**'):
            close_details()
            label = t.split('**', 2)[2].strip().splitlines()[0]
            result.append('<details><summary>' + inline(label) + '</summary><div class="documental">'); details = True
            rest = t.partition('**Conteúdo expandido:**')[2].strip()
            if rest: result.append('<p>' + inline(rest) + '</p>')
        elif t.startswith('**Conteúdo expandido:**'):
            rest = t[len('**Conteúdo expandido:**'):].strip()
            if rest: result.append('<p>' + inline(rest) + '</p>')
        elif re.match(r'\*\*(?:CTA principal|CTA secundário|Link secundário|Link contextual|Link de apoio|Link de acesso|Link):\*\*', t):
            close_details()
            m = re.match(r'\*\*([^*]+):\*\*\s*([^\n]+)', t)
            label = m.group(2)
            dest = re.search(r'\*\*Destino:\*\*\s*([^\n]+)', t)
            if not dest: raise ValueError('Link sem destino: ' + t)
            cls = ' class="acao acao-principal"' if m.group(1) == 'CTA principal' else ''
            result.append(f'<p class="acoes"><a{cls} href="{html.escape(href(dest.group(1)), quote=True)}">{inline(label)}</a></p>')
        elif t.startswith('**Links:**'):
            pass
        elif ' → `' in t and t.startswith('- **'):
            raise ValueError('Lista de links não interpretada')
        elif cards and t.startswith('**Disciplinas:**'):
            label, names = t[2:].split('**', 1)
            chips = [f'<li>{icon(discipline)}{inline(discipline)}</li>' for discipline in names.strip().split(' · ')]
            result.append(f'<div class="portfolio-disciplines"><p><strong>{inline(label)}</strong></p><ul role="list">{"".join(chips)}</ul></div>')
        elif cards == 'additional' and t.startswith(('**Serviço registrado:**', '**Serviços registrados:**')):
            result.append(f'<p class="portfolio-service">{icon(t.split("**", 2)[2].strip())}<span>{inline(t)}</span></p>')
        elif t.startswith('**Sobretítulo:**'):
            result.append('<p class="eyebrow">' + inline(t.split('**', 2)[2]) + '</p>')
        elif t.startswith('**Microcopy:**'):
            result.append('<p class="micro">' + inline(t.split('**', 2)[2]) + '</p>')
        elif t.startswith('**Nota de fonte:**'):
            result.append('<p class="fonte">' + inline(t.split('**', 2)[2]) + '</p>')
        elif t.startswith('**Texto de expectativa:**'):
            result.append('<p class="expectativa">' + inline(t.split('**', 2)[2]) + '</p>')
        else:
            result.append('<p>' + inline(t).replace('\n', '<br>') + '</p>')
        i += 1
    close_details()
    if card: result.append('</article>')
    if grid: result.append('</div>')
    value = '\n'.join(result)
    # Links institucionais em lista: preserva literalmente rótulo e destino da fonte.
    value = re.sub(r'<li><strong>(.*?)</strong> → (/[^<]+)</li>', lambda m: '<li><a href="..' + m.group(2) + '">' + m.group(1) + '</a></li>', value)
    return value


AURORA = '<div class="gvl-aurora" aria-hidden="true"><span></span><span></span><span></span></div>'
ICONS = {
    'arquitetura': 'arquitetura',
    'estrutural': 'estrutural',
    'hidrossanitário': 'hidrossanitario',
    'prevenção contra incêndio': 'incendio',
    'orçamento': 'orcamento',
    'glp': 'gas-glp',
    'gás/glp': 'gas-glp',
    'terraplanagem': 'terraplanagem',
    'controle de fumaça': 'incendio',
    'hidráulica': 'hidrossanitario',
}


def icon(discipline):
    name = discipline.casefold()
    if 'módulos sanitários' in name:
        name = 'hidráulica'
    key = next(key for key in ICONS if key in name)
    return f'<span class="portfolio-icon" data-icon="{ICONS[key]}" aria-hidden="true"></span>'


def bloco_indicadores(source):
    if hashlib.sha256(source.encode()).hexdigest() != COPY_SHA256:
        raise ValueError('Copy consolidada divergente; revisão editorial não autorizada.')
    return source.split('### BLOCO 02 — INDICADORES DOCUMENTADOS\n', 1)[1].split('\n### BLOCO 03', 1)[0]


def indicadores_acervo():
    bloco = bloco_indicadores(COPY.read_text(encoding='utf-8'))
    metragem = re.search(r'^\| Estrutural \| ([\d.,]+ m²) \|$', bloco, flags=re.M).group(1)
    arts = re.search(r'^\*\*(\d+)\*\*\nARTs documentadas$', bloco, flags=re.M).group(1)
    municipios = re.search(r'^\*\*(\d+)\*\*\nMunicípios identificados$', bloco, flags=re.M).group(1)
    return metragem, arts, municipios


def ruler(source):
    intro, disclosure = source.split('**Rótulo da expansão:**', 1)
    label, expanded = disclosure.split('**Conteúdo expandido:**', 1)
    label = label.strip().replace('Ver quantitativos', 'Quantitativos', 1)
    table, _ = expanded.strip().split('\n\n', 1)
    header, _, *rows = table.splitlines()
    discipline_label, quantity_label = [inline(cell) for cell in header.strip('|').split('|')]
    entries = {}
    for row in rows:
        discipline, quantity = [cell.strip() for cell in row.strip('|').split('|')]
        number, unit = quantity.split()
        entries[discipline] = (Decimal(number.replace('.', '').replace(',', '.')), unit, number)

    for name, first, second in (
        ('Terraplanagem — corte e aterro', 'Terraplanagem — corte', 'Terraplanagem — aterro'),
        ('Gás GLP — tubulação e central', 'GLP — tubulação', 'GLP — central'),
    ):
        first_value, unit, _ = entries.pop(first)
        second_value, second_unit, _ = entries.pop(second)
        if unit != second_unit:
            raise ValueError(f'Unidades incompatíveis na régua de {name}.')
        total = first_value + second_value
        integer, fraction = f'{total:,.2f}'.split('.')
        number = integer.replace(',', '.') + ',' + fraction
        entries[name] = (total, unit, number)

    arts_note = ('A contagem inclui ARTs substituídas e não equivale a 60 projetos distintos. '
                 'As fichas identificam os registros utilizados em cada trabalho.')
    intro = intro.replace(arts_note + '\n\n', '', 1)
    ordered = sorted(entries.items(), key=lambda row: row[1][0], reverse=True)
    maximum = ordered[0][1][0]
    content = [render(intro), '<div class="portfolio-ruler gvl-spot">', AURORA,
               f'<h3 id="portfolio-quantities">{inline(label)}</h3>',
               f'<div class="portfolio-ruler-key"><span>{quantity_label}</span><span>{discipline_label}</span></div>',
               f'<ul class="portfolio-scale" role="list" aria-label="{inline(label)}">']
    for discipline, (value, unit, number) in ordered:
        ratio = value / maximum * 100
        content.append(
            f'<li><div class="portfolio-reading">{icon(discipline)}'
            f'<span class="portfolio-value">{number} <small>{unit}</small></span>'
            f'<span class="portfolio-discipline">{inline(discipline)}</span></div>'
            f'<span class="portfolio-track" aria-hidden="true"><span class="portfolio-bar" style="--width:{ratio:.6f}%"></span></span></li>'
        )
    content.extend((
        '</ul>',
        '<button class="gvl-motion" type="button" hidden><span class="gvl-motion-icon" aria-hidden="true"></span><span class="gvl-motion-label">Pausar luz</span></button>',
        '</div>',
    ))
    return '\n'.join(content)

def widget(copy):
    """Uma instância do visualizador publicado; nenhuma biblioteca carregada aqui."""
    mark = (ROOT / 'docs/arquivo/paginas-servico-v02/maquete-hidrantes-markup.html').read_text(encoding='utf-8')
    mark = mark.replace('../../assets/', '../assets/')
    mark = mark.replace('<h2>Sistema de hidrantes</h2>', '<strong class="viewer-title">Sistema de hidrantes</strong>')
    mark = mark.replace('Arraste para girar. Role ou pince para aproximar. Clique em um elemento para ver a ficha dele.', field(copy, 'Instrução de navegação'))
    mark = mark.replace('Bombas, abrigos e outros equipamentos usam complementos ilustrativos genéricos, identificados por peça.', field(copy, 'Legenda técnica'))
    mark = mark.replace('Sistema de hidrantes do Colégio Luiz Carlos: tubulações, abrigos, bombas e reservatórios em maquete BIM', field(copy, 'Texto alternativo da imagem'))
    mark = mark.replace('Colégio Luiz Carlos · Sistema de hidrantes</p>', field(copy, 'Legenda da prévia') + '</p>')
    mark = mark.replace('171 componentes identificados · equipamentos ilustrativos sinalizados por peça.', field(copy, 'Microcopy antes da ativação'))
    mark = mark.replace('Ative JavaScript para explorar o 3D. O projeto e as estimativas continuam disponíveis nesta página.', field(copy, 'Mensagem sem JavaScript'))
    return mark


def visualization_posters(title):
    posters = (
        ('home-maquete-estrutural-640.webp', 640, 337, 'home-maquete-estrutural-1240.webp', 1240,
         'projeto-estrutural', 'Estrutura em concreto e aço', 'Anteprojeto em concreto e mezanino metálico, em 3D.',
         'Maquete com pilares e vigas de concreto e mezanino de perfis metálicos.'),
        ('home-maquete-hidro-640.webp', 640, 337, 'home-maquete-hidro-1240.webp', 1240,
         'projeto-hidrossanitario', 'Instalações de uma residência', 'Hidrossanitário em 3D, peça por peça.',
         'Maquete da residência com tubulações de água e esgoto aparentes.'),
        ('bim-compatibilizacao-v3.webp', 900, 781, 'bim-compatibilizacao-v3@2x.webp', 1820,
         'compatibilizacao-bim', 'Coordenação em BIM', 'Como as disciplinas se encontram antes da obra.',
         'Vista do modelo com estrutura e redes de instalações sobrepostas.'),
    )
    sizes = '(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw'
    result = [
        '<section class="portfolio-visualizations" aria-labelledby="portfolio-visualizations-title">',
        f'<h3 id="portfolio-visualizations-title">{inline(title)}</h3>',
        '<p>Modelos 3D de outras aplicações das disciplinas.</p>',
        '<ul class="portfolio-posters" role="list">',
    ]
    for image, width, height, large, large_width, service, name, caption, alt in posters:
        result.append(
            f'<li><a class="portfolio-poster gvl-spot" href="../servicos/{service}/">'
            '<span class="portfolio-poster-image">'
            f'<img src="../assets/images/{image}" srcset="../assets/images/{image} {width}w, '
            f'../assets/images/{large} {large_width}w" sizes="{sizes}" '
            f'width="{width}" height="{height}" loading="lazy" decoding="async" alt="{alt}">'
            '</span><span class="portfolio-poster-copy">'
            f'<strong>{name}</strong><span>{caption}</span></span></a></li>'
        )
    result.append('</ul></section>')
    return '\n'.join(result)


def bim(text):
    sections = re.split(r'^#### ', text, flags=re.M)
    result = [render(sections[0])]
    for i, section in enumerate(sections[1:]):
        title, body = section.split('\n', 1)
        if i == 2:
            result.append(visualization_posters(title))
            continue
        intro = body.split('**Legenda da prévia:**')[0]
        result.append('<article class="demonstracao"><h3>' + inline(title) + '</h3>' + render(intro))
        if i == 0:
            result.append(widget(body))
            result.append('<p class="legenda">' + inline(field(body, 'Legenda técnica')) + '</p>')
            result.append('<p class="aviso">' + inline(field(body, 'Aviso de abrangência')) + '</p>')
            result.append(render(body[body.index('**Link de apoio:**'):]))
        elif i == 1:
            result.append('<a class="previa-terreno" href="../servicos/projeto-terraplanagem/"><img src="../assets/images/experiencia-terraplanagem-djalma.png" width="1000" height="625" loading="lazy" alt="' + html.escape(field(body, 'Texto alternativo da imagem'), quote=True) + '"></a>')
            result.append('<p class="legenda">' + inline(field(body, 'Legenda da prévia')) + '</p>')
            tail = body[body.index('**Link de acesso:**'):]
            result.append(render(tail))
        result.append('</article>')
    return '\n'.join(result)


def technical_provenance(text, home):
    title, introduction, _, links = render(text).splitlines()
    links = re.sub(r'<li><a href="\.\./empresa/trajetoria-do-fundador\.html">[^<]+</a></li>', '', links)
    links = links.replace('<ul>', '<ul class="portfolio-founder-links" role="list">', 1)
    lead = re.search(r'<p class="experience-lead">[^<]+</p>', home).group()
    neon = re.search(r'<a class="text-link gvl-neon" href="\./empresa/trajetoria-do-fundador\.html".*?</a>', home).group()
    neon = re.sub(r' style="[^"]*"', '', neon).replace('href="./', 'href="../')
    return '\n'.join((
        '<div class="portfolio-founder">',
        '<picture class="portfolio-founder-photo">',
        '<source srcset="../assets/images/fundador-obra-estaca-900.webp" type="image/webp">',
        '<img src="../assets/images/fundador-obra-estaca.jpg" width="2048" height="1536" '
        'loading="lazy" decoding="async" '
        'alt="Marcos de capacete em canteiro de obra, ao lado de perfuratriz de estacas">',
        '</picture>',
        '<div class="portfolio-founder-copy">',
        title, introduction, lead, '<p class="portfolio-founder-crea">CREA-PR 146906/D</p>', neon, links,
        '</div></div>',
    ))


def montar(source):
    if hashlib.sha256(source.encode()).hexdigest() != COPY_SHA256:
        raise ValueError('Copy consolidada divergente; revisão editorial não autorizada.')
    body = source.split('### BLOCO 01 — HERO', 1)[1].split('## B. METADADOS SEO CONSOLIDADOS', 1)[0]
    blocks = re.split(r'^### BLOCO \d{2} — [^\n]+\n', body, flags=re.M)
    if len(blocks) != 7: raise ValueError('Sete blocos obrigatórios.')
    home = (ROOT / 'index.html').read_text(encoding='utf-8')
    sections = []
    for i, text in enumerate(blocks):
        if i == 1:
            content = ruler(text)
            content = re.sub(r' +<br>', '<br>', content)
            content = content.replace('<p><strong>60</strong><br>ARTs documentadas</p>\n<p><strong>23</strong><br>Municípios identificados</p>\n<p><strong>Paraná e São Paulo</strong><br>Estados com serviços documentados</p>', '<div class="indicadores"><p><strong>60</strong><span>ARTs documentadas</span></p><p><strong>23</strong><span>Municípios identificados</span></p><p><strong>Paraná e São Paulo</strong><span>Estados com serviços documentados</span></p></div>')
        elif i == 4:
            content = bim(text)
        elif i == 5:
            content = technical_provenance(text, home)
        else:
            content = render(text, 'main' if i == 2 else 'additional' if i == 3 else None)
        tag = 'h1' if i == 0 else 'h2'
        content = content.replace('<' + tag + '>', f'<{tag} id="titulo-{i+1}">', 1)
        ident = ' id="projetos"' if i == 2 else ''
        extra = ' hero' if i == 0 else ' portfolio-cta' if i == 6 else ' experience-section' if i == 5 else ''
        if i == 0:
            content = AURORA + content
        if i == 6:
            art = re.search(r'<div class="gvl-cta-art"[^>]*>.*?</svg></div>', home, re.S).group()
            content = content.replace('acao acao-principal', 'acao acao-principal gvl-neon', 1) + art
        sections.append(f'<section class="bloco bloco-{i+1}{extra}" data-block="{BLOCKS[i]}"{ident} aria-labelledby="titulo-{i+1}"><div class="wrap">{content}</div></section>')
    old = (ROOT / 'metodologia/index.html').read_text(encoding='utf-8')
    header = re.search(r'<header[\s\S]*?</header>', old).group().replace('href="../metodologia/" aria-current="page"', 'href="../metodologia/"').replace('href="../experiencia-tecnica/"', 'href="../experiencia-tecnica/" aria-current="page"')
    header = header.replace('<img src="../assets/images/logo-branca.png"', '<img fetchpriority="low" src="../assets/images/logo-branca.png"', 1)
    graph = {'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Início','item':'https://demelloeng.com.br/'},{'@type':'ListItem','position':2,'name':'Portfólio','item':URL}]}]}
    meta = f'<title>{TITLE}</title><meta name="description" content="{DESCRIPTION}"><link rel="canonical" href="{URL}">'
    meta += ''.join(f'<meta property="og:{k}" content="{v}">' for k,v in [('title',TITLE),('description',DESCRIPTION),('url',URL),('type','website'),('locale','pt_BR'),('image','https://demelloeng.com.br/assets/images/logo.png')])
    imports = {'imports': {'three':'../assets/vendor/three/build/three.module.js','three/addons/controls/OrbitControls.js':'../assets/vendor/three/examples/jsm/controls/OrbitControls.js','three/addons/loaders/GLTFLoader.js':'../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'}}
    bim_styles = ''.join(
        f'<link rel="stylesheet" href="../assets/css/{sheet}" media="print" onload="this.media=\'all\'">'
        f'<noscript><link rel="stylesheet" href="../assets/css/{sheet}"></noscript>\n'
        for sheet in ('maquete-3d.css?v=6', 'maquete-estrutura-3d.css?v=1', 'hidrantes-luiz-carlos-v02.css?v=1')
    )
    return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#26323e">\n' + f'<!-- Fonte consolidada SHA-256 {COPY_SHA256}; gerado por scripts/gerar-experiencia-v02.py -->\n' + meta + '\n<link rel="preload" as="style" href="../assets/css/home-grafite-vidro-luz.css" fetchpriority="high">\n<link rel="icon" href="../assets/images/favicon.png">\n' + ''.join(f'<link rel="stylesheet" href="../assets/css/{p}">\n' for p in ['servicos-v02.css?v=7','experiencia-v02.css?v=1','home-grafite-vidro-luz.css','portfolio-vitrine.css','rodape-v02.css?v=1']) + bim_styles + '<script type="importmap">' + json.dumps(imports) + '</script><script type="application/ld+json">' + json.dumps(graph,ensure_ascii=False,separators=(',',':')) + '</script></head>\n<body class="servicos-v02 experiencia-v02 servico-rico-pscip-glp gvl"><a class="skip" href="#conteudo">Pular para o conteúdo</a>' + header + '<main id="conteudo">' + '\n'.join(sections) + '</main>' + BASE['RODAPE'] + '\n' + ''.join(f'<script src="../assets/js/{p}" defer></script>\n' for p in ['nav.js','analytics-sink.js','contato-flutuante.js','meta-pixel.js','home-grafite-vidro-luz.js']) + '<script type="module" src="../assets/js/site-analytics.mjs"></script><script type="module" src="../assets/js/experiencia-bim.js"></script><script type="module" src="../assets/js/portfolio-vitrine.mjs"></script></body></html>\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    content = montar(COPY.read_bytes().decode()).encode()
    if args.check:
        if OUT.read_bytes() != content:
            raise SystemExit('DIVERGE: nenhum arquivo escrito.')
        print('OK: fonte consolidada íntegra, geração determinística e HTML LF fiel.')
    else:
        OUT.write_bytes(content)

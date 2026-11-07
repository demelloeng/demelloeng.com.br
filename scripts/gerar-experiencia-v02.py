#!/usr/bin/env python3
"""Portfólio V02: fonte integral consolidada -> HTML; --check não escreve."""
import argparse
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
MENU = BASE['MENU'].replace(' aria-current="page"', '').replace('href="../experiencia-tecnica/"', 'href="../experiencia-tecnica/" aria-current="page"')
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
            for j, row in enumerate(rows):
                tag = 'th' if j == 0 else 'td'
                result.append('<tr>' + ''.join(f'<{tag}' + (' scope="col"' if j == 0 else '') + f'>{inline(c)}</{tag}>' for c in row.strip('|').split('|')) + '</tr>')
            result.append('</table></div>')
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


def bim(text):
    sections = re.split(r'^#### ', text, flags=re.M)
    result = [render(sections[0])]
    for i, section in enumerate(sections[1:]):
        title, body = section.split('\n', 1)
        intro = body.split('**Legenda da prévia:**')[0] if i < 2 else body
        result.append('<article class="demonstracao"><h3>' + inline(title) + '</h3>' + render(intro))
        if i == 0:
            result.append(widget(body))
            result.append('<p class="legenda">' + inline(field(body, 'Legenda técnica')) + '</p>')
            result.append('<p class="aviso">' + inline(field(body, 'Aviso de abrangência')) + '</p>')
            result.append(render(body[body.index('**Link de apoio:**'):]))
        elif i == 1:
            result.append('<a class="previa-terreno" href="../servicos/projeto-terraplenagem/"><img src="../assets/images/experiencia-terraplanagem-djalma.png" width="1000" height="625" loading="lazy" alt="' + html.escape(field(body, 'Texto alternativo da imagem'), quote=True) + '"></a>')
            result.append('<p class="legenda">' + inline(field(body, 'Legenda da prévia')) + '</p>')
            result.append('<p class="aviso">' + inline(field(body, 'Aviso técnico')) + '</p>')
            tail = body[body.index('**Link de acesso:**'):]
            tail = tail.replace('**Microcopy:**', '**Microcopy:**')
            result.append(render(tail))
        result.append('</article>')
    return '\n'.join(result)


def montar(source):
    if hashlib.sha256(source.encode()).hexdigest() != COPY_SHA256:
        raise ValueError('Copy consolidada divergente; revisão editorial não autorizada.')
    body = source.split('### BLOCO 01 — HERO', 1)[1].split('## B. METADADOS SEO CONSOLIDADOS', 1)[0]
    blocks = re.split(r'^### BLOCO \d{2} — [^\n]+\n', body, flags=re.M)
    if len(blocks) != 7: raise ValueError('Sete blocos obrigatórios.')
    sections = []
    for i, text in enumerate(blocks):
        content = bim(text) if i == 4 else render(text, 'main' if i == 2 else 'additional' if i == 3 else None)
        if i == 1:
            content = re.sub(r' +<br>', '<br>', content)
            content = content.replace('<p><strong>60</strong><br>ARTs documentadas</p>\n<p><strong>23</strong><br>Municípios identificados</p>\n<p><strong>Paraná e São Paulo</strong><br>Estados com serviços documentados</p>', '<div class="indicadores"><p><strong>60</strong><span>ARTs documentadas</span></p><p><strong>23</strong><span>Municípios identificados</span></p><p><strong>Paraná e São Paulo</strong><span>Estados com serviços documentados</span></p></div>')
        tag = 'h1' if i == 0 else 'h2'
        content = content.replace('<' + tag + '>', f'<{tag} id="titulo-{i+1}">', 1)
        ident = ' id="projetos"' if i == 2 else ''
        sections.append(f'<section class="bloco bloco-{i+1}" data-block="{BLOCKS[i]}"{ident} aria-labelledby="titulo-{i+1}"><div class="wrap">{content}</div></section>')
    old = (ROOT / 'metodologia/index.html').read_text(encoding='utf-8')
    header = re.search(r'<header[\s\S]*?</header>', old).group().replace('href="../metodologia/" aria-current="page"', 'href="../metodologia/"').replace('href="../experiencia-tecnica/"', 'href="../experiencia-tecnica/" aria-current="page"')
    graph = {'@context':'https://schema.org','@graph':[{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Início','item':'https://demelloeng.com.br/'},{'@type':'ListItem','position':2,'name':'Experiência técnica','item':URL}]}]}
    meta = f'<title>{TITLE}</title><meta name="description" content="{DESCRIPTION}"><link rel="canonical" href="{URL}">'
    meta += ''.join(f'<meta property="og:{k}" content="{v}">' for k,v in [('title',TITLE),('description',DESCRIPTION),('url',URL),('type','website'),('locale','pt_BR'),('image','https://demelloeng.com.br/assets/images/logo.png')])
    imports = {'imports': {'three':'../assets/vendor/three/build/three.module.js','three/addons/controls/OrbitControls.js':'../assets/vendor/three/examples/jsm/controls/OrbitControls.js','three/addons/loaders/GLTFLoader.js':'../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js'}}
    return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#26323e">\n' + f'<!-- Fonte consolidada SHA-256 {COPY_SHA256}; gerado por scripts/gerar-experiencia-v02.py -->\n' + meta + '\n<link rel="icon" href="../assets/images/favicon.png">\n' + ''.join(f'<link rel="stylesheet" href="../assets/css/{p}">\n' for p in ['servicos-v02.css?v=7','rodape-v02.css?v=1','maquete-3d.css?v=6','maquete-estrutura-3d.css?v=1','hidrantes-luiz-carlos-v02.css?v=1','experiencia-v02.css?v=1']) + '<script type="importmap">' + json.dumps(imports) + '</script><script type="application/ld+json">' + json.dumps(graph,ensure_ascii=False,separators=(',',':')) + '</script></head>\n<body class="servicos-v02 experiencia-v02 servico-rico-pscip-glp"><a class="skip" href="#conteudo">Pular para o conteúdo</a>' + header + '<main id="conteudo">' + '\n'.join(sections) + '</main>' + BASE['RODAPE'] + '\n' + ''.join(f'<script src="../assets/js/{p}" defer></script>\n' for p in ['nav.js','analytics-sink.js','contato-flutuante.js','meta-pixel.js']) + '<script type="module" src="../assets/js/site-analytics.mjs"></script><script type="module" src="../assets/js/experiencia-bim.js"></script></body></html>\n'


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

#!/usr/bin/env python3
"""Metodologia institucional V02: Copy V01 aprovada -> HTML LF; --check nunca escreve.

Sem rede ou dependências externas. Menu e rodapé reutilizam somente constantes do
precedente Construir ou ampliar, sem executar sua CLI ou reescrever outra página.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import runpy

REPO = Path(__file__).resolve().parent.parent
COPY = REPO / 'docs/arquivo/metodologia-v02-20261106/COPY_METODOLOGIA_V01_20261106.md'
SAIDA = REPO / 'metodologia/index.html'
COPY_SHA256 = 'e793872202a068d55e2ad17af275749e979ad108b776788c78c743f533fa81e9'
BLOCKS = ('method-hero', 'service-process', 'service-differences', 'bim-method', 'scope-responsibility', 'final-cta')
LINKS = {
    '/orcamento/': 'Começar pelo meu caso',
    '/avaliar-um-problema/': 'Conheça o atendimento para avaliar um problema.',
    '/servicos/orcamento-tecnico/': 'Entenda Orçamento e cronograma.',
    '/servicos/regularizacao/': 'Veja como funciona a Regularização de imóvel.',
    '/servicos/compatibilizacao-bim/': 'Entenda o serviço de Compatibilização BIM.',
    '/empresa/': 'Conheça a empresa.',
    '/empresa/trajetoria-do-fundador.html': 'Veja a trajetória do fundador.',
    'https://wa.me/5541985124056': 'Prefere conversar? Fale pelo WhatsApp.',
}
BASE = runpy.run_path(str(REPO / 'scripts/gerar-construir-ou-ampliar-v02.py'))
MENU = BASE['MENU'].replace(' aria-current="page"', '').replace(
    'href="../metodologia/"', 'href="../metodologia/" aria-current="page"')
RODAPE = BASE['RODAPE']
JSONLD = {'@context': 'https://schema.org', '@graph': [{'@type': 'BreadcrumbList', 'itemListElement': [
    {'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': 'https://demelloeng.com.br/'},
    {'@type': 'ListItem', 'position': 2, 'name': 'Como trabalhamos', 'item': 'https://demelloeng.com.br/metodologia/'},
]}]}


def ler_copy(texto: str) -> tuple[dict[str, str], list[list[tuple[str, str, str]]]]:
    """Lê apenas a gramática explícita do documento aprovado; recusa revisão silenciosa."""
    if hashlib.sha256(texto.encode('utf-8')).hexdigest() != COPY_SHA256:
        raise ValueError('Integridade da Copy V01 divergente: use a fonte aprovada, sem reescritas.')
    pieces = re.split(r'^## BLOCO (\d{2}) — [^\n]+\n', texto, flags=re.M)
    if pieces[1::2] != ['01', '02', '03', '04', '05', '06']:
        raise ValueError('São necessários seis blocos, na ordem aprovada.')
    meta = {}
    for line in pieces[0].strip().splitlines():
        key, sep, value = line.partition(': ')
        if not sep or key not in ('TITULO SEO', 'DESCRICAO SEO') or key in meta or not value:
            raise ValueError('Metadado ausente, repetido ou desconhecido.')
        meta[key] = value
    if set(meta) != {'TITULO SEO', 'DESCRICAO SEO'}:
        raise ValueError('Title e description são obrigatórios.')
    blocks = []
    for body in pieces[2::2]:
        nodes = []
        pending = None
        for token in re.split(r'\n\s*\n', body.strip()):
            if token == '---' or token == '**Fechamento do bloco:**':
                continue
            field = re.fullmatch(r'\*\*([^*]+):\*\*\s*(.*)', token, re.S)
            if field:
                key, value = field.groups()
                if key == 'Destino':
                    href = value.strip('`')
                    if not pending or LINKS.get(href) != pending[1]:
                        raise ValueError('Rótulo ou destino de link fora do contrato.')
                    nodes.append((pending[0], pending[1], href))
                    pending = None
                elif key in ('CTA principal', 'Link', 'Canal secundário'):
                    if pending:
                        raise ValueError('Link sem destino.')
                    pending = ('cta' if key == 'CTA principal' else 'link', value)
                elif key in ('Sobretítulo', 'H1', 'H2', 'Microcopy'):
                    nodes.append(({'Sobretítulo': 'eyebrow', 'H1': 'h1', 'H2': 'h2', 'Microcopy': 'micro'}[key], value, ''))
                else:
                    raise ValueError(f'Campo não reconhecido: {key}')
            elif token.startswith('### '):
                nodes.append(('h3', re.sub(r'^\d+\. ', '', token[4:]), ''))
            elif not token.startswith(('#', '**')):
                nodes.append(('p', token, ''))
            else:
                raise ValueError('Marcação não reconhecida na fonte.')
        if pending or not nodes:
            raise ValueError('Bloco incompleto.')
        blocks.append(nodes)
    moments = [text for kind, text, _ in blocks[1] if kind == 'h3']
    if moments != ['Entendimento da necessidade', 'Definição do escopo e da proposta',
                   'Realização do trabalho técnico', 'Verificação e coordenação', 'Entrega e orientações']:
        raise ValueError('Cinco momentos obrigatórios ausentes ou fora de ordem.')
    return meta, blocks


def render(nodes: list[tuple[str, str, str]]) -> str:
    parts = []
    for kind, value, href in nodes:
        text = html.escape(value, quote=False)
        if kind in ('h1', 'h2', 'h3', 'p'):
            parts.append(f'<{kind}>{text}</{kind}>')
        elif kind in ('eyebrow', 'micro'):
            parts.append(f'<p class="{kind}">{text}</p>')
        elif kind in ('link', 'cta'):
            target = href if href.startswith('https://') else '..' + href
            css = ' class="acao acao-principal"' if kind == 'cta' else ''
            parts.append(f'<p class="acoes"><a{css} href="{html.escape(target, quote=True)}">{text}</a></p>')
        else:
            raise ValueError(f'Tipo de conteúdo desconhecido: {kind}')
    return '\n'.join(parts)


def agrupados(nodes: list[tuple[str, str, str]], momentos: bool = False) -> str:
    """Agrupa títulos e parágrafos sem alterar a ordem da fonte."""
    first = next(i for i, node in enumerate(nodes) if node[0] == 'h3')
    groups = []
    for node in nodes[first:]:
        if node[0] == 'h3':
            groups.append([])
        groups[-1].append(node)
    intro, closing = nodes[:first], []
    if momentos:
        # O fechamento pertence ao percurso, fora do quinto momento.
        closing = groups[-1][-1:]
        groups[-1] = groups[-1][:-1]
        content = '<ol class="momentos" role="list">\n' + '\n'.join(
            '<li class="momento">' + render(group[:1]) + '<div>' + render(group[1:]) + '</div></li>'
            for group in groups) + '\n</ol>'
    else:
        content = '<div class="modalidades">\n' + '\n'.join(
            '<article class="modalidade">' + render(group[:1]) + '<div>' + render(group[1:]) + '</div></article>'
            for group in groups) + '\n</div>'
    return render(intro) + '\n' + content + '\n' + render(closing)


def montar(texto_copy: str) -> str:
    meta, b = ler_copy(texto_copy)
    title, description = (html.escape(meta[k], quote=True) for k in ('TITULO SEO', 'DESCRICAO SEO'))
    h1 = next(i for i, node in enumerate(b[0]) if node[0] == 'h1')
    hero = '<div>' + render(b[0][:h1 + 1]) + '</div><div class="hero-copy">' + render(b[0][h1 + 1:]) + '</div>'
    sections = [hero, agrupados(b[1], momentos=True), agrupados(b[2]), render(b[3]), agrupados(b[4]), render(b[5])]
    classes = ['hero wrap', 'percurso', 'variacoes wrap', 'bim', 'escopo wrap', 'cta-final cta-band']
    main = []
    for i, (block, css, content) in enumerate(zip(BLOCKS, classes, sections)):
        # O título de cada bloco é seu nome acessível, sem texto adicional visível.
        tag = 'h1' if i == 0 else 'h2'
        content = content.replace(f'<{tag}>', f'<{tag} id="bloco-{i + 1}-titulo">', 1)
        if i in (1, 3, 5):
            content = '<div class="wrap">' + content + '</div>'
        main.append(f'<section class="{css}" data-block="{block}" aria-labelledby="bloco-{i + 1}-titulo">\n{content}\n</section>')
    url = 'https://demelloeng.com.br/metodologia/'
    return f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-metodologia-v02.py. Fonte: {COPY.relative_to(REPO).as_posix()} (SHA-256 {COPY_SHA256}). Copy V01 aprovada por Marcos. Não editar HTML à mão. -->
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#26323e">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://demelloeng.com.br/assets/images/logo.png">
<link rel="icon" href="../assets/images/favicon.png">
<link rel="preload" href="../assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/css/servicos-v02.css?v=7">
<link rel="stylesheet" href="../assets/css/rodape-v02.css?v=1">
<link rel="stylesheet" href="../assets/css/metodologia-v02.css?v=1">
<script type="application/ld+json">{json.dumps(JSONLD, ensure_ascii=False, separators=(',', ':'))}</script>
</head>
<body class="servicos-v02 metodologia-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
{chr(10).join(main)}
</main>
{RODAPE}<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../assets/js/site-analytics.mjs"></script>
</body></html>
'''


def verificar_ou_gravar(texto_copy: str, check: bool = False) -> int:
    content = montar(texto_copy).encode('utf-8')
    if check:
        if not SAIDA.is_file() or SAIDA.read_bytes() != content:
            print('DIVERGE: HTML não corresponde à Copy V01 em LF; nenhum arquivo foi escrito.')
            return 1
        print('OK: Copy V01 íntegra; HTML LF fiel, seis blocos e cinco momentos; --check sem escrita.')
        return 0
    SAIDA.write_bytes(content)
    print('Gerado metodologia/index.html a partir da Copy V01 aprovada.')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    raise SystemExit(verificar_ou_gravar(COPY.read_bytes().decode('utf-8'), args.check))

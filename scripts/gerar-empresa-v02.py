#!/usr/bin/env python3
"""Empresa institucional V02: Copy V01 aprovada -> HTML LF; --check nunca escreve.

Sem rede ou dependências externas. Menu e rodapé reutilizam somente constantes do
precedente Construir ou ampliar, sem executar sua CLI ou reescrever outra página.
A única saída é empresa/index.html.
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
COPY = REPO / 'docs/arquivo/empresa-v02-20261107/COPY_EMPRESA_V01_20261107.md'
SAIDA = REPO / 'empresa/index.html'
COPY_SHA256 = '8ed488a55498c3784a99f189a656dd3b02dff3c7997980b01645987fefbd1aed'
BLOCKS = ('company-hero', 'way-of-thinking', 'commitments', 'institutional-identity', 'founder', 'final-cta')
URL = 'https://demelloeng.com.br/empresa/'
# Destinos e rótulos de botão aprovados; qualquer outro par falha fechado.
LINKS = {
    '/servicos/': 'Conhecer nossos serviços',
    '/orcamento/': 'Calcular estimativa',
    '/contato/': 'Falar com a DEMELLO',
    '/empresa/trajetoria-do-fundador.html': 'Conhecer a trajetória do fundador',
}
IDENTITY = ('Razão social', 'Nome institucional', 'CNPJ', 'Registro profissional da empresa', 'Responsável técnico',
            'Formação', 'Registro profissional', 'Sede', 'Área de atendimento')
FIELDS = {'Sobretítulo': 'eyebrow', 'H1': 'h1', 'H2': 'h2', 'Destaque': 'lead', 'Assinatura': 'sig'}
BUTTONS = {'Botão principal': 'primary', 'Botão secundário': 'secondary'}
# Estrutura aprovada de cada bloco: ordem e tipo dos elementos.
SHAPE = (
    ['eyebrow', 'h1', 'p', 'p', 'secondary', 'primary'],
    ['h2', 'lead', 'p', 'p', 'p'],
    ['eyebrow', 'h2', 'h3', 'p', 'h3', 'p', 'h3', 'p', 'p'],
    ['eyebrow', 'h2'] + ['id'] * 9 + ['p'],
    ['eyebrow', 'h2', 'p', 'p', 'secondary'],
    ['h2', 'lead', 'p', 'p', 'p', 'primary', 'secondary', 'sig'],
)
BASE = runpy.run_path(str(REPO / 'scripts/gerar-construir-ou-ampliar-v02.py'))
MENU = BASE['MENU'].replace(' aria-current="page"', '')
RODAPE = BASE['RODAPE']
JSONLD = {'@context': 'https://schema.org', '@graph': [{'@type': 'BreadcrumbList', 'itemListElement': [
    {'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': 'https://demelloeng.com.br/'},
    {'@type': 'ListItem', 'position': 2, 'name': 'Empresa', 'item': URL},
]}]}

# Estilo local: tipografia, cabeçalho e rodapé continuam nas folhas V02 existentes.
STYLE = '''.empresa-v02 main{overflow-wrap:break-word}
.empresa-v02 main p{max-width:48em;line-height:1.5}
.empresa-v02 main p+p{margin-top:16px}
.empresa-v02 main h2{font-size:40px;line-height:1.15;max-width:22em}
.empresa-v02 main h3{font-size:27px;line-height:1.2}
.empresa-v02 main h2+p,.empresa-v02 main .eyebrow+h2{margin-top:24px}
.empresa-v02 main a:not(.acao){text-decoration:underline;text-underline-offset:4px}
.empresa-v02 main a:focus-visible{outline:3px solid var(--ink);outline-offset:5px}
.empresa-v02 .site-header .logo:focus-visible{outline-color:#fff}
.empresa-v02 .hero{padding-block:56px 72px}
.empresa-v02 .hero h1{font-size:60px;line-height:1.07;max-width:11em}
.empresa-v02 .hero .eyebrow{margin-bottom:24px}
.empresa-v02 .hero-copy p:first-child{font-weight:600}
.empresa-v02 main .lead{font-size:28px;line-height:1.3;font-weight:600;color:var(--blue);max-width:22em}
.empresa-v02 .acoes{display:flex;flex-wrap:wrap;gap:16px;margin-top:32px}
.empresa-v02 main .acao{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:14px 28px;border:2px solid var(--blue);background:transparent;color:var(--blue);font-weight:700;line-height:1.2;text-align:center}
.empresa-v02 main .acao:hover{text-decoration:none;background:var(--pale)}
.empresa-v02 main .acao-principal{background:var(--blue);color:#fff}
.empresa-v02 main .acao-principal:hover{background:var(--ink);border-color:var(--ink)}
.empresa-v02 .pensamento{background:var(--pale);padding-block:72px}
.empresa-v02 .pensamento .wrap{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:24px 64px;align-items:start}
.empresa-v02 .pensamento .lead{margin-top:24px}
.empresa-v02 .compromissos-sec{padding-block:72px}
.empresa-v02 .compromissos{margin:40px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px}
.empresa-v02 .compromisso{border-top:2px solid var(--blue);padding-top:24px;min-width:0}
.empresa-v02 .compromisso .num{display:block;margin-bottom:12px;font-size:24px;font-weight:800;color:var(--blue)}
.empresa-v02 .compromisso h3+p{margin-top:16px}
.empresa-v02 .identidade{background:var(--pale);padding-block:72px}
.empresa-v02 .identidade-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:24px 48px}
.empresa-v02 .identidade-topo>div{min-width:0}
.empresa-v02 .selo-marca{flex:none;width:300px;max-width:100%;height:auto}
.empresa-v02 .dados{margin:40px 0 32px;max-width:920px}
.empresa-v02 .dado{display:grid;grid-template-columns:minmax(180px,300px) minmax(0,1fr);gap:8px 32px;padding-block:16px;border-top:1px solid var(--line)}
.empresa-v02 .dado:last-child{border-bottom:1px solid var(--line)}
.empresa-v02 .dado dt{font-size:16px;line-height:1.4;font-weight:600;color:var(--muted)}
.empresa-v02 .dado dd{margin:0;font-size:22px;line-height:1.35;font-weight:600}
.empresa-v02 .fundador{padding-block:72px}
.empresa-v02 .fundador .wrap{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:24px 64px;align-items:start}
.empresa-v02 .fundador .acoes{margin-top:32px}
.empresa-v02 .cta-final{background:var(--blue);color:#fff;padding-block:72px}
.empresa-v02 .cta-final h2{color:#fff}
.empresa-v02 main .cta-final .lead{margin-top:24px;color:#dbe6f1}
.empresa-v02 .cta-final p+p{margin-top:16px}
.empresa-v02 main .cta-final .acao{border-color:#fff;color:#fff}
.empresa-v02 main .cta-final .acao:hover{background:rgba(255,255,255,.14)}
.empresa-v02 main .cta-final .acao-principal{background:#fff;color:var(--blue)}
.empresa-v02 main .cta-final .acao-principal:hover{background:var(--pale);border-color:var(--pale)}
.empresa-v02 main .cta-final a:focus-visible{outline-color:#fff}
.empresa-v02 main .assinatura{margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,.35);font-weight:700}
@media(max-width:1000px){
.empresa-v02 .hero h1{font-size:48px}
.empresa-v02 .pensamento .wrap,.empresa-v02 .fundador .wrap{gap:24px 40px}
.empresa-v02 .compromissos{grid-template-columns:minmax(0,1fr);gap:32px}}
@media(min-width:761px) and (max-width:850px){
.empresa-v02 .hero{grid-template-columns:minmax(0,1fr);gap:24px}
.empresa-v02 .hero-copy{padding-top:0}}
@media(max-width:760px){
.empresa-v02 .hero{padding-block:32px 48px;gap:24px}
.empresa-v02 .hero h1{font-size:40px;max-width:none}
.empresa-v02 main h2{font-size:30px}
.empresa-v02 main h3{font-size:25px}
.empresa-v02 main p{font-size:19px}
.empresa-v02 main .lead{font-size:24px}
.empresa-v02 .pensamento,.empresa-v02 .compromissos-sec,.empresa-v02 .identidade,.empresa-v02 .fundador,.empresa-v02 .cta-final{padding-block:44px 48px}
.empresa-v02 .pensamento .wrap,.empresa-v02 .fundador .wrap{grid-template-columns:minmax(0,1fr)}
.empresa-v02 .compromissos{margin-top:32px}
.empresa-v02 .identidade-topo{flex-direction:column;align-items:flex-start}
.empresa-v02 .selo-marca{width:220px}
.empresa-v02 .dados{margin-top:32px}
.empresa-v02 .dado{grid-template-columns:minmax(0,1fr);gap:4px;padding-block:14px}
.empresa-v02 .dado dd{font-size:20px}
.empresa-v02 .acoes{flex-direction:column;align-items:stretch}
.empresa-v02 main .acao{width:100%;font-size:20px}}'''


def ler_copy(texto: str) -> tuple[dict[str, str], list[list[tuple[str, str, str]]]]:
    """Lê só a gramática explícita do documento aprovado; recusa revisão silenciosa."""
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
        nodes: list[tuple[str, str, str]] = []
        pending = None
        for token in re.split(r'\n\s*\n', body.strip()):
            if token == '---':
                continue
            field = re.fullmatch(r'\*\*([^*]+):\*\*\s*(.*)', token, re.S)
            if field:
                key, value = field.groups()
                if key == 'Destino':
                    href = value.strip('`')
                    if not pending or LINKS.get(href) != pending[1]:
                        raise ValueError('Rótulo ou destino de botão fora do contrato.')
                    nodes.append((pending[0], pending[1], href))
                    pending = None
                elif key in BUTTONS:
                    if pending:
                        raise ValueError('Botão sem destino.')
                    pending = (BUTTONS[key], value)
                elif key in FIELDS:
                    nodes.append((FIELDS[key], value, ''))
                elif key in IDENTITY:
                    nodes.append(('id', value, key))
                else:
                    raise ValueError(f'Campo não reconhecido: {key}')
            elif token.startswith('### '):
                nodes.append(('h3', token[4:], ''))
            elif not token.startswith(('#', '**')):
                nodes.append(('p', token, ''))
            else:
                raise ValueError('Marcação não reconhecida na fonte.')
        if pending or not nodes:
            raise ValueError('Bloco incompleto.')
        blocks.append(nodes)
    if tuple([kind for kind, _, _ in nodes] for nodes in blocks) != SHAPE:
        raise ValueError('Estrutura dos blocos fora da aprovada.')
    if [extra for kind, _, extra in blocks[3] if kind == 'id'] != list(IDENTITY):
        raise ValueError('Campos de identidade ausentes ou fora de ordem.')
    commitments = [text for kind, text, _ in blocks[2] if kind == 'h3']
    if commitments != ['01 — Entender antes de propor', '02 — Projetar com viabilidade',
                       '03 — Assumir responsabilidade pelo que entregamos']:
        raise ValueError('Três compromissos obrigatórios ausentes ou fora de ordem.')
    return meta, blocks


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def botoes(nodes: list[tuple[str, str, str]]) -> str:
    links = []
    for kind, text, href in nodes:
        if kind in ('primary', 'secondary'):
            target = href if href.startswith('https://') else '..' + href
            css = 'acao acao-principal' if kind == 'primary' else 'acao'
            links.append(f'<a class="{css}" href="{html.escape(target, quote=True)}">{esc(text)}</a>')
    return '<div class="acoes">' + ''.join(links) + '</div>' if links else ''


def simples(nodes: list[tuple[str, str, str]]) -> str:
    """Elementos de texto na ordem da fonte; botões e assinatura são tratados à parte."""
    parts = []
    for kind, text, _ in nodes:
        if kind in ('h1', 'h2', 'p'):
            parts.append(f'<{kind}>{esc(text)}</{kind}>')
        elif kind in ('eyebrow', 'lead'):
            parts.append(f'<p class="{kind}">{esc(text)}</p>')
    return '\n'.join(parts)


def compromissos(nodes: list[tuple[str, str, str]]) -> str:
    start = next(i for i, node in enumerate(nodes) if node[0] == 'h3')
    groups: list[list[tuple[str, str, str]]] = []
    for node in nodes[start:]:
        if node[0] == 'h3':
            groups.append([])
        groups[-1].append(node)
    items = []
    for group in groups:
        number, _, title = group[0][1].partition(' — ')
        body = ''.join(f'<p>{esc(text)}</p>' for _, text, _ in group[1:])
        items.append(f'<li class="compromisso"><h3><span class="num" aria-hidden="true">{esc(number)}</span>'
                     f'{esc(title)}</h3>{body}</li>')
    return simples(nodes[:start]) + '\n<ol class="compromissos" role="list">\n' + '\n'.join(items) + '\n</ol>'


def identidade(nodes: list[tuple[str, str, str]]) -> str:
    head = [node for node in nodes if node[0] in ('eyebrow', 'h2')]
    tail = [node for node in nodes if node[0] == 'p']
    rows = '\n'.join(f'<div class="dado"><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>'
                     for kind, value, label in nodes if kind == 'id')
    # Logo oficial colorida (PNG com fundo transparente já publicado), uma única vez no corpo da página.
    selo = ('<img class="selo-marca" src="../assets/images/logo.png" alt="Logo da DEMELLO Engenharia" '
            'width="760" height="196" loading="lazy" decoding="async">')
    return ('<div class="identidade-topo"><div>' + simples(head) + '</div>' + selo + '</div>\n'
            '<dl class="dados">\n' + rows + '\n</dl>\n' + simples(tail))


def montar(texto_copy: str) -> str:
    meta, b = ler_copy(texto_copy)
    title, description = (html.escape(meta[k], quote=True) for k in ('TITULO SEO', 'DESCRICAO SEO'))
    # Hero: sobretítulo e H1 à esquerda; apresentação e botões à direita.
    hero = ('<div>' + simples(b[0][:2]) + '</div><div class="hero-copy">' + simples(b[0][2:4]) + '\n'
            + botoes(b[0]) + '</div>')
    pensamento = ('<div class="wrap"><div>' + simples(b[1][:2]) + '</div><div>' + simples(b[1][2:]) + '</div></div>')
    comprom = '<div class="wrap">' + compromissos(b[2]) + '</div>'
    ident = '<div class="wrap">' + identidade(b[3]) + '</div>'
    fundador = ('<div class="wrap"><div>' + simples(b[4][:2]) + '</div><div>' + simples(b[4][2:4]) + '\n'
                + botoes(b[4]) + '</div></div>')
    assinatura = next(text for kind, text, _ in b[5] if kind == 'sig')
    final = ('<div class="wrap">' + simples(b[5]) + '\n' + botoes(b[5])
             + f'\n<p class="assinatura">{esc(assinatura)}</p></div>')
    classes = ['hero wrap', 'pensamento', 'compromissos-sec', 'identidade', 'fundador', 'cta-final cta-band']
    main = []
    for i, (block, css, content) in enumerate(zip(BLOCKS, classes, [hero, pensamento, comprom, ident, fundador, final])):
        # O título de cada bloco é seu nome acessível, sem texto adicional visível.
        tag = 'h1' if i == 0 else 'h2'
        content = content.replace(f'<{tag}>', f'<{tag} id="bloco-{i + 1}-titulo">', 1)
        main.append(f'<section class="{css}" data-block="{block}" aria-labelledby="bloco-{i + 1}-titulo">\n{content}\n</section>')
    return f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-empresa-v02.py. Fonte: {COPY.relative_to(REPO).as_posix()} (SHA-256 {COPY_SHA256}). Copy V01 aprovada por Marcos, com a correção gramatical autorizada no Bloco 05. Não editar HTML à mão. -->
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#26323e">
<link rel="canonical" href="{URL}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="https://demelloeng.com.br/assets/images/logo.png">
<link rel="icon" href="../assets/images/favicon.png">
<link rel="preload" href="../assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/css/servicos-v02.css?v=7">
<link rel="stylesheet" href="../assets/css/rodape-v02.css?v=1">
<style>{STYLE}</style>
<script type="application/ld+json">{json.dumps(JSONLD, ensure_ascii=False, separators=(',', ':'))}</script>
</head>
<body class="servicos-v02 empresa-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
{chr(10).join(main)}
</main>
{RODAPE}<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/contato-flutuante.js" defer></script>
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
        print('OK: Copy V01 íntegra; HTML LF fiel, seis blocos e três compromissos; --check sem escrita.')
        return 0
    SAIDA.write_bytes(content)
    print('Gerado empresa/index.html a partir da Copy V01 aprovada.')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    raise SystemExit(verificar_ou_gravar(COPY.read_bytes().decode('utf-8'), args.check))

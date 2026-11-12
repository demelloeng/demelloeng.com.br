#!/usr/bin/env python3
"""Privacidade V02, candidata local: fonte versionada -> HTML LF; --check não escreve.

Somente biblioteca padrão, sem rede. A única saída é privacidade/index.html.
Reutiliza constantes V02 do precedente Construir ou ampliar sem executar sua CLI.
A redação candidata ainda depende de revisão conjunta da medição e análise jurídica.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from pathlib import Path
import re
import runpy

REPO = Path(__file__).resolve().parent.parent
COPY = REPO / 'docs/arquivo/privacidade-v02-20261107/COPY_PRIVACIDADE_V05_20261111.md'
SAIDA = REPO / 'privacidade/index.html'
COPY_SHA256 = '7c45fc67565d04a009e3f139f455c3f99917e7afb24e60809280a53d43e659ab'
BASE = runpy.run_path(str(REPO / 'scripts/gerar-construir-ou-ampliar-v02.py'))
MENU = BASE['MENU'].replace(' aria-current="page"', '')
RODAPE = BASE['RODAPE']
JSONLD = ('{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":['
          '{"@type":"ListItem","position":1,"name":"Início","item":"https://demelloeng.com.br/"},'
          '{"@type":"ListItem","position":2,"name":"Privacidade","item":"https://demelloeng.com.br/privacidade/"}]}]}')

# Estilo local: tipografia e componentes globais continuam nas folhas V02 existentes.
STYLE = '''.privacidade-v02 .privacy-hero{padding-block:64px 48px}
.privacidade-v02 .privacy-hero h1{max-width:850px;margin-block:24px;font-size:clamp(42px,5vw,72px);line-height:1.08;font-weight:800;letter-spacing:-.025em;color:var(--blue)}
.privacidade-v02 .privacy-hero p{max-width:64ch;line-height:1.5}
.privacidade-v02 .privacy-hero .privacy-date{margin-top:20px;font-size:16px;color:var(--muted)}
.privacidade-v02 .privacy-index{padding-block:0 48px}
.privacidade-v02 .privacy-index ol{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 32px}
.privacidade-v02 .privacy-index a{display:block;padding-block:12px;min-height:44px;text-decoration:underline;text-underline-offset:4px;font-size:18px}
.privacidade-v02 .privacy-section{padding-block:48px;border-top:1px solid var(--line);scroll-margin-top:24px}
.privacidade-v02 .privacy-section:nth-of-type(even){background:var(--pale)}
.privacidade-v02 .privacy-section .wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:48px}
.privacidade-v02 .privacy-section h2{font-size:30px;line-height:1.18;max-width:17ch}
.privacidade-v02 .privacy-text{min-width:0;max-width:67ch;line-height:1.55}
.privacidade-v02 .privacy-text p+p{margin-top:20px}
.privacidade-v02 .privacy-text a{text-decoration:underline;text-underline-offset:4px;overflow-wrap:anywhere}
@media(max-width:760px){
.privacidade-v02 .privacy-hero{padding-block:40px 32px}
.privacidade-v02 .privacy-index{padding-bottom:32px}
.privacidade-v02 .privacy-index ol{grid-template-columns:minmax(0,1fr)}
.privacidade-v02 .privacy-section{padding-block:32px}
.privacidade-v02 .privacy-section .wrap{grid-template-columns:minmax(0,1fr);gap:24px}
.privacidade-v02 .privacy-section h2{max-width:none;font-size:28px}
}'''


def ler_copy(texto: str) -> tuple[dict[str, str], list[str], list[tuple[str, list[str]]]]:
    """Recusa reescrita silenciosa; toda revisão exige fonte versionada e novo hash."""
    if hashlib.sha256(texto.encode('utf-8')).hexdigest() != COPY_SHA256:
        raise ValueError('Integridade da Copy V05 divergente.')
    parts = re.split(r'\n\s*\n', texto.strip())
    metadata = {}
    for expected, value in zip(('TITULO SEO', 'DESCRICAO SEO'), parts[:2]):
        key, sep, content = value.partition(': ')
        if key != expected or not sep or not content:
            raise ValueError('Metadados incompletos ou fora de ordem.')
        metadata[key] = content
    intro = parts[2:5]
    if len(intro) != 3 or not intro[0].startswith('# '):
        raise ValueError('H1, abertura e data são obrigatórios.')
    sections = []
    for part in parts[5:]:
        if part.startswith('## '):
            sections.append((part[3:], []))
        elif part.startswith('#') or not sections:
            raise ValueError('Hierarquia de títulos inválida.')
        else:
            sections[-1][1].append(part)
    if len(sections) != 6 or any(not title or not paragraphs for title, paragraphs in sections):
        raise ValueError('São necessárias seis seções completas.')
    return metadata, intro, sections


def paragrafo(text: str) -> str:
    value = html.escape(text, quote=False)
    email = 'marcos@demelloeng.com.br'
    value = value.replace(email, f'<a href="mailto:{email}">{email}</a>')
    return '<p>' + value + '</p>'


def montar(texto_copy: str) -> str:
    metadata, intro, sections = ler_copy(texto_copy)
    title, description = (html.escape(metadata[key], quote=True) for key in ('TITULO SEO', 'DESCRICAO SEO'))
    index = '\n'.join(f'<li><a href="#privacidade-{i}">{html.escape(heading)}</a></li>'
                      for i, (heading, _) in enumerate(sections, 1))
    content = '\n'.join(
        f'<section class="privacy-section" id="privacidade-{i}" aria-labelledby="privacidade-{i}-titulo">'
        f'<div class="wrap"><h2 id="privacidade-{i}-titulo">{html.escape(heading)}</h2>'
        f'<div class="privacy-text">{chr(10).join(paragrafo(p) for p in paragraphs)}</div></div></section>'
        for i, (heading, paragraphs) in enumerate(sections, 1))
    url = 'https://demelloeng.com.br/privacidade/'
    return f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-privacidade-v02.py. Fonte: {COPY.relative_to(REPO).as_posix()} (SHA-256 {COPY_SHA256}). Copy V05: adequação documental V04 autorizada em 11/11/2026; sem declaração de validação jurídica. Não editar HTML à mão. -->
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
<style>{STYLE}</style>
<script type="application/ld+json">{JSONLD}</script>
</head>
<body class="servicos-v02 privacidade-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
<div class="privacy-hero wrap"><p class="eyebrow">Privacidade</p><h1>{html.escape(intro[0][2:])}</h1>{paragrafo(intro[1])}<p class="privacy-date">{html.escape(intro[2])}</p></div>
<nav class="privacy-index wrap" aria-label="Nesta página"><ol>{index}</ol></nav>
{content}
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
            print('DIVERGE: HTML não corresponde à fonte candidata em LF; nenhum arquivo foi escrito.')
            return 1
        print('OK: fonte candidata íntegra; HTML fiel em LF; --check sem escrita.')
        return 0
    SAIDA.write_bytes(content)
    print('Gerado privacidade/index.html a partir da fonte candidata local.')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raise SystemExit(verificar_ou_gravar(COPY.read_bytes().decode('utf-8'), args.check))

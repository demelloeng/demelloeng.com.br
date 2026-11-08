#!/usr/bin/env python3
"""Verificar e 404 no visual V02: fontes versionadas -> HTML LF; --check nunca escreve.

Sem rede ou dependências externas. Menu e rodapé reutilizam somente constantes do
precedente Construir ou ampliar, sem executar sua CLI ou reescrever outra página.
Saídas: verificar/index.html e 404.html. A lógica do verificador vem de um arquivo
versionado, inserido byte a byte; este gerador nunca a reescreve.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from pathlib import Path
import re
import runpy

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / 'docs/arquivo/verificar-404-v02-20261107'
COPY_VF = DIR / 'COPY_VERIFICAR_20261107.md'
COPY_404 = DIR / 'COPY_404_20261107.md'
LOGICA = DIR / 'LOGICA_VERIFICAR_20261108.js'
SAIDA_VF = REPO / 'verificar/index.html'
SAIDA_404 = REPO / '404.html'
SHA = {
    COPY_VF: 'e379ff19174bf4f4eb3b561664963510a3e5dd9ffb6a783f7aa16b7179cd413a',
    COPY_404: '7b1ecbecb4432ebf51fdc942ff47cbb50831cc4c0c3e94ef4e26aef363c7c33a',
    LOGICA: '59c95abb5c9185833c84a5b104f6a9e3b2570be7f3073a256ce8c488f3b59089',
}
URL_VF = 'https://demelloeng.com.br/verificar/'
BOTOES_404 = {'/': 'Voltar ao início', '/orcamento/': 'Calcular estimativa'}
BASE = runpy.run_path(str(REPO / 'scripts/gerar-construir-ou-ampliar-v02.py'))
MENU = BASE['MENU'].replace(' aria-current="page"', '')
RODAPE = BASE['RODAPE']
# A 404 é servida em qualquer profundidade de URL: menu e rodapé usam caminhos absolutos.
MENU_404 = MENU.replace('"../', '"/')
RODAPE_404 = RODAPE.replace('"../', '"/')

COMUM = '''.erro-v02 main,.verificar-v02 main{overflow-wrap:break-word}
.erro-v02 main h1,.verificar-v02 main h1{font-size:clamp(36px,4.6vw,60px);line-height:1.08;font-weight:800;letter-spacing:-.02em;color:var(--blue)}
.erro-v02 main .eyebrow,.verificar-v02 main .eyebrow{margin-bottom:24px}
.erro-v02 main a:focus-visible,.verificar-v02 main a:focus-visible{outline:3px solid var(--ink);outline-offset:5px}
.erro-v02 .site-header .logo:focus-visible,.verificar-v02 .site-header .logo:focus-visible{outline-color:#fff}'''
STYLE_VF = COMUM + '''
.verificar-v02 .vf-hero{padding-block:56px 80px}
.verificar-v02 .vf-col{max-width:760px}
.verificar-v02 .vf-col .lead{font-size:20px;line-height:1.5;color:var(--muted)}
.verificar-v02 main .eyebrow{font-size:13px;line-height:18px}
.verificar-v02 .vf-status{border:1px solid var(--line);border-left-width:6px;padding:24px 28px;margin:24px 0;background:#fff}
.verificar-v02 .vf-status.ok{border-left-color:var(--blue)}
.verificar-v02 .vf-status.bad{border-left-color:#b42318}
.verificar-v02 .vf-status h2{margin:0 0 8px;font-size:26px;line-height:1.2;font-weight:700;color:var(--ink)}
.verificar-v02 .vf-status p{font-size:18px;line-height:1.5;color:var(--ink)}
.verificar-v02 .vf-dl{display:grid;grid-template-columns:minmax(120px,200px) minmax(0,1fr);gap:12px 24px;margin:24px 0}
.verificar-v02 .vf-dl dt{font-size:14px;line-height:1.5;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.verificar-v02 .vf-dl dd{margin:0;font-size:19px;line-height:1.4;color:var(--ink);overflow-wrap:anywhere}
.verificar-v02 .vf-code{font-family:ui-monospace,Consolas,"Courier New",monospace}
.verificar-v02 .vf-total{margin:8px 0 0;font-size:clamp(32px,4vw,48px);line-height:1.1;font-weight:800;color:var(--blue)}
.verificar-v02 .vf-svcs{list-style:none;margin:8px 0 0;padding:0;border-top:1px solid var(--line)}
.verificar-v02 .vf-svc{padding:16px 0;border-bottom:1px solid var(--line)}
.verificar-v02 .vf-svc-line{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.verificar-v02 .vf-svc-name{font-size:20px;line-height:1.3;font-weight:700;color:var(--ink);min-width:0;overflow-wrap:anywhere}
.verificar-v02 .vf-svc-price{font-size:22px;line-height:1.2;font-weight:800;color:var(--blue);white-space:nowrap;flex:0 0 auto}
.verificar-v02 .vf-svc-refs{margin:6px 0 0;font-size:16px;line-height:1.5;color:var(--muted)}
.verificar-v02 .dm-fab__link,.verificar-v02 .dm-fab__link:hover,.verificar-v02 .dm-fab__link:visited{color:#fff}
.verificar-v02 .vf-note{border-left:3px solid var(--line);padding-left:24px;margin-top:28px}
.verificar-v02 .vf-note p{margin:0 0 10px;font-size:17px;line-height:1.55;color:var(--muted)}
.verificar-v02 .vf-note strong{color:var(--ink)}
@media(max-width:760px){
.verificar-v02 .vf-hero{padding-block:32px 56px}
.verificar-v02 .vf-status{padding:20px}
.verificar-v02 .vf-status h2{font-size:24px}
.verificar-v02 .vf-dl{grid-template-columns:minmax(0,1fr);gap:4px}
.verificar-v02 .vf-dl dd{margin-bottom:12px}
.verificar-v02 .vf-note{padding-left:16px}}'''
STYLE_404 = COMUM + '''
.erro-v02 .erro{padding-block:56px 112px}
.erro-v02 .erro h1{max-width:12em}
.erro-v02 .erro p:not(.eyebrow){max-width:40em;margin-top:24px;font-size:22px;line-height:1.5}
.erro-v02 .acoes{display:flex;flex-wrap:wrap;gap:16px;margin-top:32px}
.erro-v02 main .acao{display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:14px 28px;border:2px solid var(--blue);background:transparent;color:var(--blue);font-weight:700;line-height:1.2;text-align:center}
.erro-v02 main .acao:hover{text-decoration:none;background:var(--pale)}
.erro-v02 main .acao-principal{background:var(--blue);color:#fff}
.erro-v02 main .acao-principal:hover{background:var(--ink);border-color:var(--ink)}
@media(max-width:760px){
.erro-v02 .erro{padding-block:32px 64px}
.erro-v02 .erro p:not(.eyebrow){font-size:19px}
.erro-v02 .acoes{flex-direction:column;align-items:stretch}
.erro-v02 main .acao{width:100%;font-size:20px}}'''


def ler(path: Path) -> str:
    """Recusa reescrita silenciosa: toda revisão exige novo hash fixado neste gerador."""
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA[path]:
        raise ValueError(f'Integridade divergente: {path.name}. Use a fonte aprovada, sem reescritas.')
    return data.decode('utf-8')


def cabecalho(texto: str, esperado_robots: str) -> tuple[dict[str, str], list[str]]:
    parts = re.split(r'\n\s*\n', texto.strip())
    meta = {}
    for line in parts[0].splitlines():
        key, sep, value = line.partition(': ')
        if not sep or key not in ('TITULO SEO', 'DESCRICAO SEO', 'ROBOTS') or key in meta or not value:
            raise ValueError('Metadado ausente, repetido ou desconhecido.')
        meta[key] = value
    if set(meta) != {'TITULO SEO', 'DESCRICAO SEO', 'ROBOTS'} or meta['ROBOTS'] != esperado_robots:
        raise ValueError('Metadados incompletos ou robots fora do contrato.')
    return meta, parts[1:]


def campos(tokens: list[str], ordem: list[str]) -> list[tuple[str, str]]:
    found = []
    for token in tokens:
        m = re.fullmatch(r'\*\*([^*]+):\*\*\s*(.*)', token, re.S)
        found.append((m.group(1), m.group(2)) if m else ('p', token))
    if [key for key, _ in found] != ordem:
        raise ValueError('Estrutura da fonte fora da aprovada.')
    return found


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def com_negrito(value: str) -> str:
    """Único realce aceito na fonte: **texto** vira <strong>."""
    parts = re.split(r'\*\*(.+?)\*\*', value)
    return ''.join(f'<strong>{esc(p)}</strong>' if i % 2 else esc(p) for i, p in enumerate(parts))


def cabeca(meta: dict[str, str], canonical: str, base: str, estilo: str, extra: str = '') -> str:
    title, description = (html.escape(meta[k], quote=True) for k in ('TITULO SEO', 'DESCRICAO SEO'))
    return f'''<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#26323e">
<meta name="robots" content="{meta['ROBOTS']}">
{canonical}<link rel="icon" href="{base}assets/images/favicon.png">
<link rel="preload" href="{base}assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{base}assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{base}assets/css/servicos-v02.css?v=7">
<link rel="stylesheet" href="{base}assets/css/rodape-v02.css?v=1">
<style>{estilo}</style>
'''


def scripts(base: str) -> str:
    return (f'<script src="{base}assets/js/nav.js" defer></script>\n'
            f'<script src="{base}assets/js/analytics-sink.js" defer></script>\n'
            f'<script src="{base}assets/js/contato-flutuante.js" defer></script>\n'
            f'<script src="{base}assets/js/meta-pixel.js" defer></script>\n'
            f'<script type="module" src="{base}assets/js/site-analytics.mjs"></script>\n')


def montar_verificar(copy: str, logica: str) -> str:
    meta, rest = cabecalho(copy, 'noindex, follow')
    f = dict(campos(rest, ['Sobretítulo', 'H1', 'Estado inicial', 'Nota', 'Nota']))
    notas = [m.group(2) for m in re.finditer(r'(\*\*Nota:\*\*)\s*(.*)', copy)]
    return f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-verificar-404-v02.py. Fontes: {COPY_VF.relative_to(REPO).as_posix()} (SHA-256 {SHA[COPY_VF]}) e {LOGICA.relative_to(REPO).as_posix()} (SHA-256 {SHA[LOGICA]}). Não editar HTML à mão. -->
{cabeca(meta, f'<link rel="canonical" href="{URL_VF}">' + chr(10), '../', STYLE_VF)}</head>
<body class="servicos-v02 verificar-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
<section class="vf-hero">
<div class="wrap"><div class="vf-col">
<p class="eyebrow">{esc(f['Sobretítulo'])}</p>
<h1>{esc(f['H1'])}</h1>
<div id="vf-out" aria-live="polite">
<p class="lead" style="margin-top:20px">{esc(f['Estado inicial'])}</p>
</div>
<div class="vf-note">
<p>{com_negrito(notas[0])}</p>
<p>{com_negrito(notas[1])}</p>
</div>
</div></div>
</section>
</main>
{RODAPE}{scripts('../')}<script>
{logica.rstrip(chr(10))}
</script>
</body></html>
'''


def montar_404(copy: str) -> str:
    meta, rest = cabecalho(copy, 'noindex')
    kinds = ['Sobretítulo', 'H1', 'p', 'Botão principal', 'Destino', 'Botão secundário', 'Destino']
    found = campos(rest, kinds)
    botoes = []
    for (kind, label), (_, href) in zip((found[3], found[5]), (found[4], found[6])):
        href = href.strip('`')
        if BOTOES_404.get(href) != label:
            raise ValueError('Rótulo ou destino de botão fora do contrato.')
        css = 'acao acao-principal' if kind == 'Botão principal' else 'acao'
        botoes.append(f'<a class="{css}" href="{html.escape(href, quote=True)}">{esc(label)}</a>')
    return f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-verificar-404-v02.py. Fonte: {COPY_404.relative_to(REPO).as_posix()} (SHA-256 {SHA[COPY_404]}). Não editar HTML à mão. Sem canonical; caminhos absolutos. -->
{cabeca(meta, '', '/', STYLE_404)}</head>
<body class="servicos-v02 erro-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="/"><img src="/assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU_404}</nav></div></header>
<main id="conteudo">
<section class="erro wrap">
<p class="eyebrow">{esc(found[0][1])}</p>
<h1>{esc(found[1][1])}</h1>
<p>{esc(found[2][1])}</p>
<div class="acoes">{''.join(botoes)}</div>
</section>
</main>
{RODAPE_404}{scripts('/')}</body></html>
'''


def montar_tudo() -> dict[Path, bytes]:
    logica = ler(LOGICA)
    return {SAIDA_VF: montar_verificar(ler(COPY_VF), logica).encode('utf-8'),
            SAIDA_404: montar_404(ler(COPY_404)).encode('utf-8')}


def verificar_ou_gravar(saidas: dict[Path, bytes], check: bool = False) -> int:
    if check:
        errados = [p.name for p, c in saidas.items() if not p.is_file() or p.read_bytes() != c]
        if errados:
            print('DIVERGE: HTML não corresponde às fontes em LF (' + ', '.join(errados) + '); nenhum arquivo foi escrito.')
            return 1
        print('OK: fontes íntegras; verificar/index.html e 404.html fiéis em LF; --check sem escrita.')
        return 0
    for path, content in saidas.items():
        path.write_bytes(content)
    print('Gerados verificar/index.html e 404.html a partir das fontes versionadas.')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    raise SystemExit(verificar_ou_gravar(montar_tudo(), args.check))

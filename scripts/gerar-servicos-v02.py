from pathlib import Path
import json, html, re, posixpath
from urllib.parse import urlsplit
repo = Path(__file__).resolve().parent.parent
dest = repo / 'servicos'
doc = repo / 'docs/arquivo/servicos-v01-20261028'
data = json.loads((doc / 'conteudo.json').read_text(encoding='utf-8'))
icons = json.loads((doc / 'icones.json').read_text(encoding='utf-8'))
icons = {x['id']: x for x in icons}
assert len({x['id'] for x in data['items']}) == len(data['items'])
assert all(x['id'] in icons and x['grupo'] in ('projetos','documentos') for x in data['items'])
esc = lambda value: html.escape(value, quote=True)
hero_heading = esc(data['h1']).replace('? Vá', '?<br>Vá')
routes_heading = esc(data['routesTitle']).replace('. O nome', '.<br>O nome')
def link(text, phrase, url):
    assert phrase in text
    return esc(text).replace(esc(phrase), f'<a href="{esc(url)}">{esc(phrase)}</a>')
def row(item):
    index, icon = data['items'].index(item), icons[item['id']]
    extras = ''.join(f'<a href="{esc(x["url"])}">{esc(x["rotulo"])}</a>' for x in item.get('links', []))
    extra_html = f'<div class="service-actions" aria-label="Incêndio e gás: serviços e estimativas">{extras}</div>' if extras else ''
    return f'''<article class="service" data-service="{icon['id']}">
<div class="service-mark"><span>{index+1:02}</span><img src="assets/icons/{icon['file']}" alt="" width="28" height="28"></div>
<h3><a href="{esc(item['url'])}">{esc(item['title'])}</a></h3>
<div class="service-copy"><p>{esc(item['description'])}</p><p class="service-limit">{esc(item['limit'])}</p></div>
<a class="service-link" href="{esc(item['url'])}">Ver o serviço →<span class="sr-only">: {esc(item['title'])}</span></a>{extra_html}</article>'''
header = (doc / 'header.template.html').read_text(encoding='utf-8').strip()
common = data['common']
intro = link(common['Construir ou ampliar'], 'Construir ou ampliar', 'https://demelloeng.com.br/construir-ou-ampliar/')
b2b = link(common['B2B copy'], 'compatibilização BIM', next(x['url'] for x in data['items'] if x['id'] == 'bim'))
routes = ''.join(f'<article class="route"><h3><a href="{esc(r["url"])}">{esc(r["title"])}</a></h3><p>{esc(r["description"])}</p></article>' for r in data['routes'])
footer = (doc / 'footer.template.html').read_text(encoding='utf-8').strip()
page = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data:; base-uri 'self'">
<title>{esc(data['seoTitle'])}</title><meta name="description" content="{esc(data['seoDescription'])}">
<link rel="canonical" href="https://demelloeng.com.br/servicos/"><meta property="og:title" content="{esc(data['seoTitle'])}"><meta property="og:description" content="{esc(data['seoDescription'])}"><meta property="og:url" content="https://demelloeng.com.br/servicos/"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta name="theme-color" content="#26323e">
<link rel="icon" href="assets/images/favicon.png"><link rel="preload" href="assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="servicos.css"><script src="nav.js" defer></script></head>
<body><a class="skip" href="#conteudo">Pular para o conteúdo</a>
{header}
<main id="conteudo"><section class="hero wrap"><div><p class="eyebrow">{esc(data['eyebrow'])}</p><h1>{hero_heading}</h1></div><div class="hero-copy"><p>{esc(common['Introdução'])}</p><p class="secondary">{intro}</p></div></section>
<section data-block="service-summary" class="catalog wrap" aria-labelledby="grupo-projetos"><div class="group-intro"><h2 id="grupo-projetos">{esc(common['Grupo 1'])}</h2><p>{esc(common['Descrição do grupo 1'])}</p></div>{''.join(row(item) for item in data['items'] if item['grupo'] == 'projetos')}</section>
<aside class="b2b"><div class="wrap"><h2>{esc(data['b2bTitle'])}</h2><p>{b2b}</p></div></aside>
<section class="group-secondary" aria-labelledby="grupo-escopo"><div class="wrap"><h2 id="grupo-escopo">{esc(data['group2'])}</h2><p class="group-description">{esc(common['Descrição grupo 2'])}</p>{''.join(row(item) for item in data['items'] if item['grupo'] == 'documentos')}</div></section>
<section data-block="routes" class="routes wrap" aria-labelledby="situacao"><p class="eyebrow">Por onde começar</p><h2 id="situacao">{routes_heading}</h2>{routes}</section>
<section class="final-cta"><div class="wrap"><h2>{esc(data['quote'])}</h2><a class="cta" href="{esc(data['ctaUrl'])}">{esc(data['ctaLabel'])} →</a><p>{esc(data['ctaMicro'])}</p></div></section></main>
{footer}</body></html>'''
head = (doc / 'head.template.html').read_text(encoding='utf-8').replace('$SEO_TITLE', esc(data['seoTitle'])).replace('$SEO_DESCRIPTION', esc(data['seoDescription']))
page = re.sub(r'<head>.*?</head>', lambda m: '<head>'+head+'</head>', page, flags=re.S)
page = page.replace('<body>', '<body class="servicos-v02">')
page = page.replace('src="assets/images/', 'src="../assets/images/').replace('src="assets/icons/', 'src="../assets/icons/servicos-v02/')
def relative_destination(match):
    url = urlsplit(html.unescape(match[2]))
    if url.netloc != 'demelloeng.com.br': return match[0]
    path = posixpath.relpath(url.path, '/servicos/')
    if url.path.endswith('/') and not path.endswith('/'): path += '/'
    if not path.startswith('.'): path = './'+path
    if path == './': path = '../servicos/'
    if url.query: path += '?'+url.query
    if url.fragment: path += '#'+url.fragment
    return match[1]+'href="'+esc(path)+'"'
page = re.sub(r'(<a\b[^>]*?\s)href="(https://demelloeng\.com\.br[^\"]*)"', relative_destination, page)
scripts = '<script src="../assets/js/nav.js" defer></script>\n<script src="../assets/js/analytics-sink.js" defer></script>\n<script src="../assets/js/meta-pixel.js" defer></script>\n<script type="module" src="../assets/js/site-analytics.mjs"></script>'
page = page.replace('</body>', scripts+'\n</body>')
(dest / 'index.html').write_bytes(page.encode('utf-8'))
print('index.html regenerado a partir de conteudo.json; CSS e recursos preservados.')

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
first_line, second_line = data['h1'].split('? ', 1)
hero_heading = f'{esc(first_line)}?<br><span class="sv3-title-accent">{esc(second_line)}</span>'
routes_heading = esc(data['routesTitle']).replace('. O nome', '.<br>O nome')
def link(text, phrase, url):
    assert phrase in text
    return esc(text).replace(esc(phrase), f'<a href="{esc(url)}">{esc(phrase)}</a>')
def row(item):
    icon = icons[item['id']]
    extras = ''.join(f'<a href="{esc(x["url"])}">{esc(x["rotulo"])}</a>' for x in item.get('links', []))
    extra_html = f'<div class="service-actions" aria-label="Incêndio e gás: serviços e estimativas">{extras}</div>' if extras else ''
    return f'''<article class="service" data-service="{icon['id']}">
<div class="service-mark"><img src="assets/icons/{icon['file']}" alt="" width="28" height="28"></div>
<h3><a href="{esc(item['url'])}">{esc(item['title'])}</a></h3>
<div class="service-copy"><p>{esc(item['description'])}</p><p class="service-limit">{esc(item['limit'])}</p></div>
<a class="service-link" href="{esc(item['url'])}">Ver o serviço →<span class="sr-only">: {esc(item['title'])}</span></a>{extra_html}</article>'''
header = (doc / 'header.template.html').read_text(encoding='utf-8').strip().replace('experiencia-tecnica/">Projetos</a>', 'experiencia-tecnica/">Portfólio</a>')
common = data['common']
intro = link(common['Construir ou ampliar'], 'Construir ou ampliar', 'https://demelloeng.com.br/construir-ou-ampliar/')
b2b = link(common['B2B copy'], 'compatibilização BIM', next(x['url'] for x in data['items'] if x['id'] == 'bim'))
routes = ''.join(f'<article class="route"><h3><a href="{esc(r["url"])}">{esc(r["title"])}</a></h3><p>{esc(r["description"])}</p></article>' for r in data['routes'])
footer = (doc / 'footer.template.html').read_text(encoding='utf-8').strip().replace('experiencia-tecnica/">Projetos</a>', 'experiencia-tecnica/">Portfólio</a>')

# Serviços V03 keeps the approved catalog copy in the existing source.
# Only the title and eyebrow have explicit V03 wording approval.
seo_title = 'Projetos e serviços de engenharia | DEMELLO'
eyebrow = 'Projetos e serviços de engenharia'
aurora = '<div class="gvl-aurora" aria-hidden="true"><span></span><span></span><span></span></div>'

def offer(name, url):
    return {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': name, 'url': url}}

site = 'https://demelloeng.com.br'
offers = []
for item in data['items']:
    offers.append(offer(item['title'], item['url']))
    if item['id'] == 'incendio':
        offers.append(offer('Projeto de gás / GLP', site + '/servicos/projeto-gas-glp/'))
structured_data = {
    '@context': 'https://schema.org',
    '@graph': [
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': site + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Serviços', 'item': site + '/servicos/'},
        ]},
        {'@type': 'OfferCatalog', 'name': 'Serviços', 'itemListElement': offers},
    ],
}

head = '''
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$SEO_TITLE</title>
<meta name="description" content="$SEO_DESCRIPTION">
<meta name="theme-color" content="#26323e">
<link rel="canonical" href="https://demelloeng.com.br/servicos/">
<meta property="og:title" content="$SEO_TITLE">
<meta property="og:description" content="$SEO_DESCRIPTION">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="https://demelloeng.com.br/servicos/">
<meta property="og:image" content="https://demelloeng.com.br/assets/images/logo.png">
<link rel="preload" as="image" href="../assets/images/home-maquete-arquitetura-640.webp" media="(max-width: 760px)" fetchpriority="high">
<link rel="icon" href="../assets/images/favicon.png">
<link rel="preload" href="../assets/fonts/host-grotesk-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/barlow-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/css/servicos-v02.css?v=7">
<script type="application/ld+json">$STRUCTURED_DATA</script>

<link rel="stylesheet" href="../assets/css/rodape-v02.css?v=1">
<link rel="stylesheet" href="../assets/css/catalogo-pscip-glp-v02.css?v=1">
<link rel="stylesheet" href="../assets/css/home-grafite-vidro-luz.css">
<link rel="stylesheet" href="../assets/css/servicos-vitrine.css">
<noscript><style>.sv3-stage .sv3-slide img { display: block !important; }</style></noscript>
'''
head = (head.replace('$SEO_TITLE', esc(seo_title))
        .replace('$SEO_DESCRIPTION', esc(data['seoDescription']))
        .replace('$STRUCTURED_DATA', json.dumps(structured_data, ensure_ascii=False, separators=(',', ':'))))

stage = '''<section class="sv3-stage wrap" aria-label="Maquetes 3D" aria-roledescription="carousel">
  <div class="gvl-aurora" aria-hidden="true"><span></span><span></span><span></span></div>
  <h2>Maquetes 3D</h2>
  <div class="sv3-carousel">
    <div class="sv3-arrows" data-controls hidden>
      <button type="button" data-direction="-1" aria-label="Disciplina anterior">←</button>
      <button type="button" data-direction="1" aria-label="Próxima disciplina">→</button>
    </div>
    <div class="sv3-track" role="group" tabindex="0" aria-label="Cartazes das maquetes">
        <div class="sv3-slide" role="group" aria-roledescription="slide" aria-label="1 de 5"
             data-discipline="arquitetura" data-title="Projeto de arquitetura" data-service-url="/servicos/projeto-arquitetura/" data-active>
          <figure class="sv3-poster">
            <img src="/assets/images/home-maquete-arquitetura-640.webp" srcset="/assets/images/home-maquete-arquitetura-640.webp 640w, /assets/images/home-maquete-arquitetura-1240.webp 1240w"
                 sizes="(max-width: 760px) min(320px, calc(100vw - 64px)), (max-width: 1440px) 43vw, 565px"
                 alt="Casa de exemplo com piscina, deck, fachadas e cobertura vistas em perspectiva." width="1240" height="653" fetchpriority="high" draggable="false">
            <figcaption>Imagem renderizada</figcaption>
            <span class="gvl-beam" aria-hidden="true"></span>
          </figure>
        </div>
        <div class="sv3-slide" role="group" aria-roledescription="slide" aria-label="2 de 5"
             data-discipline="estrutural" data-title="Projeto estrutural" data-service-url="/servicos/projeto-estrutural/">
          <figure class="sv3-poster">
            <img src="/assets/images/home-maquete-estrutural-640.webp" srcset="/assets/images/home-maquete-estrutural-640.webp 640w, /assets/images/home-maquete-estrutural-1240.webp 1240w"
                 sizes="(max-width: 760px) min(320px, calc(100vw - 64px)), (max-width: 1440px) 43vw, 565px"
                 alt="Estrutura de concreto do colégio em perspectiva, com pilares, vigas e lajes aparentes." width="1240" height="653" fetchpriority="low" loading="lazy" decoding="async" draggable="false">
            <figcaption>Imagem renderizada</figcaption>
          </figure>
        </div>
        <div class="sv3-slide" role="group" aria-roledescription="slide" aria-label="3 de 5"
             data-discipline="hidrossanitario" data-title="Projeto hidrossanitário" data-service-url="/servicos/projeto-hidrossanitario/">
          <figure class="sv3-poster">
            <img src="/assets/images/home-maquete-hidro-640.webp" srcset="/assets/images/home-maquete-hidro-640.webp 640w, /assets/images/home-maquete-hidro-1240.webp 1240w"
                 sizes="(max-width: 760px) min(320px, calc(100vw - 64px)), (max-width: 1440px) 43vw, 565px"
                 alt="Redes hidrossanitárias coloridas em perspectiva, dentro da casca arquitetônica translúcida." width="1240" height="653" fetchpriority="low" loading="lazy" decoding="async" draggable="false">
            <figcaption>Imagem renderizada</figcaption>
          </figure>
        </div>
        <div class="sv3-slide" role="group" aria-roledescription="slide" aria-label="4 de 5"
             data-discipline="incendio" data-title="Projeto de incêndio — PPCI" data-service-url="/servicos/projeto-prevencao-incendio/">
          <figure class="sv3-poster">
            <img src="/assets/images/home-maquete-incendio-640.webp" srcset="/assets/images/home-maquete-incendio-640.webp 640w, /assets/images/home-maquete-incendio-1240.webp 1240w"
                 sizes="(max-width: 760px) min(320px, calc(100vw - 64px)), (max-width: 1440px) 43vw, 565px"
                 alt="Rede de hidrantes em vermelho, em perspectiva sobre a representação do colégio." width="1240" height="653" fetchpriority="low" loading="lazy" decoding="async" draggable="false">
            <figcaption>Imagem renderizada</figcaption>
          </figure>
        </div>
        <div class="sv3-slide" role="group" aria-roledescription="slide" aria-label="5 de 5"
             data-discipline="terraplanagem" data-title="Projeto de terraplanagem" data-service-url="/servicos/projeto-terraplenagem/">
          <figure class="sv3-poster">
            <img src="/assets/images/home-maquete-terraplanagem-640.webp" srcset="/assets/images/home-maquete-terraplanagem-640.webp 640w, /assets/images/home-maquete-terraplanagem-1240.webp 1240w"
                 sizes="(max-width: 760px) min(320px, calc(100vw - 64px)), (max-width: 1440px) 43vw, 565px"
                 alt="Terreno do colégio em perspectiva com patamares e taludes que mostram seu desnível." width="1240" height="653" fetchpriority="low" loading="lazy" decoding="async" draggable="false">
            <figcaption>Imagem renderizada</figcaption>
          </figure>
        </div>
    </div>
    <div class="sv3-caption">
      <h3 id="sv3-disciplina">Projeto de arquitetura</h3>
      <div class="sv3-actions">
        <a class="btn-cta" id="sv3-abrir" href="/servicos/projeto-arquitetura/#caixa">Abrir a maquete</a>
        <a id="sv3-servico" href="/servicos/projeto-arquitetura/">Ver o serviço →</a>
      </div>
    </div>
    <div class="sv3-controls" data-controls hidden>
      <div class="sv3-chips" role="group" aria-label="Disciplinas das maquetes"></div>
      <button class="gvl-motion" type="button" hidden><span class="gvl-motion-icon" aria-hidden="true"></span><span class="gvl-motion-label">Pausar luz</span></button>
    </div>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>
</section>'''

calculator_art = '''<div class="gvl-cta-art" aria-hidden="true"><svg viewBox="0 0 440 440" focusable="false"><defs><radialGradient id="gvlHalo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9cc2ec" stop-opacity=".45"/><stop offset=".55" stop-color="#255280" stop-opacity=".25"/><stop offset="1" stop-color="#255280" stop-opacity="0"/></radialGradient><linearGradient id="gvlPapel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".26"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#9cc2ec" stop-opacity=".14"/></linearGradient><linearGradient id="gvlBorda" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".5" stop-color="#9cc2ec" stop-opacity=".45"/><stop offset="1" stop-color="#9cc2ec" stop-opacity=".9"/></linearGradient><linearGradient id="gvlCalc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3672b4"/><stop offset=".45" stop-color="#255280"/><stop offset="1" stop-color="#18304d"/></linearGradient><linearGradient id="gvlVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e151c"/><stop offset="1" stop-color="#1c2a38"/></linearGradient><filter id="gvlBrilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="gvlSombra" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#000" flood-opacity=".55"/></filter></defs><circle cx="220" cy="220" r="210" fill="url(#gvlHalo)"/><g transform="rotate(-6 170 200)" filter="url(#gvlSombra)"><path d="M78 52h158l52 52v262a18 18 0 0 1-18 18H78a18 18 0 0 1-18-18V70a18 18 0 0 1 18-18z" fill="url(#gvlPapel)" stroke="url(#gvlBorda)" stroke-width="2"/><path d="M236 52v34a18 18 0 0 0 18 18h34" fill="#9cc2ec" fill-opacity=".18" stroke="url(#gvlBorda)" stroke-width="2"/><rect x="88" y="84" width="110" height="12" rx="6" fill="#ffffff" fill-opacity=".85"/><rect x="88" y="106" width="70" height="8" rx="4" fill="#9cc2ec" fill-opacity=".7"/><g fill="#ffffff" fill-opacity=".38"><rect x="88" y="144" width="172" height="7" rx="3.5"/><rect x="88" y="162" width="150" height="7" rx="3.5"/><rect x="88" y="180" width="164" height="7" rx="3.5"/></g><g stroke="#9cc2ec" stroke-opacity=".45" stroke-width="1.5"><line x1="88" y1="214" x2="260" y2="214"/><line x1="88" y1="240" x2="260" y2="240"/><line x1="88" y1="266" x2="260" y2="266"/><line x1="88" y1="292" x2="260" y2="292"/><line x1="200" y1="214" x2="200" y2="318"/></g><g fill="#ffffff" fill-opacity=".32"><rect x="94" y="223" width="80" height="7" rx="3.5"/><rect x="94" y="249" width="62" height="7" rx="3.5"/><rect x="94" y="275" width="88" height="7" rx="3.5"/><rect x="94" y="301" width="54" height="7" rx="3.5"/></g><g fill="#9cc2ec" fill-opacity=".75"><rect x="214" y="223" width="38" height="7" rx="3.5"/><rect x="220" y="249" width="32" height="7" rx="3.5"/><rect x="210" y="275" width="42" height="7" rx="3.5"/><rect x="224" y="301" width="28" height="7" rx="3.5"/></g><rect x="88" y="336" width="90" height="10" rx="5" fill="#ffffff" fill-opacity=".6"/><rect x="196" y="332" width="64" height="18" rx="9" fill="#9cc2ec" fill-opacity=".9" filter="url(#gvlBrilho)"/></g><g transform="rotate(9 300 300)" filter="url(#gvlSombra)"><rect x="216" y="168" width="168" height="236" rx="24" fill="url(#gvlCalc)" stroke="#9cc2ec" stroke-opacity=".8" stroke-width="2"/><rect x="218" y="170" width="164" height="70" rx="22" fill="#ffffff" fill-opacity=".1"/><rect x="234" y="188" width="132" height="46" rx="10" fill="url(#gvlVisor)" stroke="#9cc2ec" stroke-opacity=".55" stroke-width="1.5"/><g filter="url(#gvlBrilho)" fill="#9cc2ec"><rect x="290" y="204" width="14" height="16" rx="2"/><rect x="308" y="204" width="14" height="16" rx="2"/><rect x="326" y="204" width="14" height="16" rx="2"/><rect x="344" y="204" width="12" height="16" rx="2"/></g><g fill="#ffffff" fill-opacity=".16" stroke="#ffffff" stroke-opacity=".22"><rect x="234" y="250" width="28" height="26" rx="8"/><rect x="268" y="250" width="28" height="26" rx="8"/><rect x="302" y="250" width="28" height="26" rx="8"/><rect x="234" y="284" width="28" height="26" rx="8"/><rect x="268" y="284" width="28" height="26" rx="8"/><rect x="302" y="284" width="28" height="26" rx="8"/><rect x="234" y="318" width="28" height="26" rx="8"/><rect x="268" y="318" width="28" height="26" rx="8"/><rect x="302" y="318" width="28" height="26" rx="8"/><rect x="234" y="352" width="62" height="26" rx="8"/><rect x="302" y="352" width="28" height="26" rx="8"/></g><g fill="#9cc2ec" fill-opacity=".35" stroke="#9cc2ec" stroke-opacity=".7"><rect x="336" y="250" width="30" height="26" rx="8"/><rect x="336" y="284" width="30" height="26" rx="8"/></g><rect x="336" y="318" width="30" height="60" rx="9" fill="#9cc2ec" filter="url(#gvlBrilho)"/><g stroke="#18304d" stroke-width="3" stroke-linecap="round"><line x1="344" y1="342" x2="358" y2="342"/><line x1="344" y1="350" x2="358" y2="350"/></g><g stroke="#ffffff" stroke-opacity=".75" stroke-width="2.5" stroke-linecap="round"><line x1="345" y1="263" x2="357" y2="263"/><line x1="351" y1="257" x2="351" y2="269"/><line x1="345" y1="297" x2="357" y2="297"/></g></g><g fill="#ffffff" filter="url(#gvlBrilho)"><circle cx="92" cy="400" r="2.5" opacity=".8"/><circle cx="396" cy="120" r="3" opacity=".9"/><circle cx="40" cy="160" r="2" opacity=".6"/></g></svg></div>'''

scripts = '''<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/contato-flutuante.js" defer></script>
<script src="../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../assets/js/site-analytics.mjs"></script>
<script src="../assets/js/home-grafite-vidro-luz.js" defer></script>
<script type="module" src="../assets/js/servicos-vitrine.mjs"></script>'''
page = f'''<!doctype html>
<html lang="pt-BR"><head>{head}</head>
<body class="servicos-v02 gvl"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
{header}
<main id="conteudo"><div class="hero">
<section class="sv3-opening wrap">{aurora}<div class="sv3-heading"><p class="eyebrow">{esc(eyebrow)}</p><h1>{hero_heading}</h1></div><div class="hero-copy"><p>{esc(common['Introdução'])}</p><p class="secondary">{intro}</p></div></section>
{stage}
</div>
<section data-block="service-summary" class="catalog wrap" aria-labelledby="grupo-projetos"><div class="group-intro"><h2 id="grupo-projetos">{esc(common['Grupo 1'])}</h2><p>{esc(common['Descrição do grupo 1'])}</p></div>{''.join(row(item) for item in data['items'] if item['grupo'] == 'projetos')}</section>
<aside class="b2b"><div class="wrap"><h2>{esc(data['b2bTitle'])}</h2><p>{b2b}</p></div></aside>
<section class="group-secondary" aria-labelledby="grupo-escopo"><div class="wrap"><h2 id="grupo-escopo">{esc(data['group2'])}</h2><p class="group-description">{esc(common['Descrição grupo 2'])}</p>{''.join(row(item) for item in data['items'] if item['grupo'] == 'documentos')}</div></section>
<section data-block="routes" class="routes wrap" aria-labelledby="situacao"><p class="eyebrow">Por onde começar</p><h2 id="situacao">{routes_heading}</h2>{routes}</section>
<section class="final-cta cta-band experience-section"><div class="wrap"><h2>{esc(data['quote'])}</h2><a class="cta gvl-neon" href="{esc(data['ctaUrl'])}"><span class="gvl-neon-t">{esc(data['ctaLabel'])} →</span></a><p>{esc(data['ctaMicro'])}</p>
{calculator_art}
</div></section></main>
{footer}{scripts}
</body></html>'''
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
(dest / 'index.html').write_bytes(page.encode('utf-8'))
print('servicos/index.html regenerado a partir da copy e da estrutura V03.')

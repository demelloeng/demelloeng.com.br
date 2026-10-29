#!/usr/bin/env python3
"""Gera as páginas /servicos/<slug>/ no visual da Home V02.

Fluxo (decisão 77 do Doc03): copy central -> gerador HTML -> validação local.

  1. `extrair`  lê o HTML atual da página (visual antigo) e grava o texto, sem
                alterar nenhum caractere, em docs/arquivo/paginas-servico-v02/<slug>.json.
                Só roda uma vez por página; depois o JSON é a fonte de texto.
  2. `gerar`    lê o JSON e regenera servicos/<slug>/index.html no visual V02.

Uso:
  python scripts/gerar-paginas-servico-v02.py extrair projeto-estrutural
  python scripts/gerar-paginas-servico-v02.py gerar   projeto-estrutural
  python scripts/gerar-paginas-servico-v02.py extrair --todas
  python scripts/gerar-paginas-servico-v02.py gerar   --todas

Sem dependências externas. Não toca em nenhum outro arquivo além do JSON e do index.html da página.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / 'docs/arquivo/paginas-servico-v02'
SERVICOS = REPO / 'servicos'
SLUGS = [
    'projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario',
    'projeto-prevencao-incendio', 'projeto-gas-glp', 'projeto-terraplenagem',
    'compatibilizacao-bim', 'regularizacao', 'orcamento-tecnico',
]
S = re.S


# --------------------------------------------------------------------- extrair
def extrair(slug):
    html = (SERVICOS / slug / 'index.html').read_text(encoding='utf-8')
    if 'class="servico-v02"' in html or 'servico-pagina-v02' in html:
        sys.exit(f'{slug}: a página já está no visual V02; extrair precisa do HTML antigo (git show).')

    def um(padrao, texto=html):
        m = re.search(padrao, texto, S)
        assert m, f'{slug}: não achei {padrao}'
        return m.group(1)

    head = um(r'<head>(.*?)</head>')
    jsonld = um(r'(<script type="application/ld\+json">.*?</script>)', head)

    hero = um(r'<section class="white bb" data-block="service-hero">(.*?)</section>')
    cta_href = um(r'<a class="btn-cta" href="([^"]+)"', hero)
    cta_label = um(r'<a class="btn-cta"[^>]*>(.*?)<svg', hero)
    cta_micro = um(r'<p class="cta-micro">(.*?)</p>', hero)
    intro = um(r'<div class="svc-intro">(.*?)</div>', hero)

    corpo = um(r'<section class="sec-sm">(.*?)</section>')
    final = um(r'<section class="white bt sec-sm">(.*?)</section>')

    def blocos(texto):
        saida = []
        partes = texto.split('<div class="svc-block">')[1:]
        for parte in partes:
            titulo = um(r'<h2>(.*?)</h2>', parte)
            itens = []
            pos = 0
            padrao = re.compile(
                r'<div class="note"><p>(?P<note>.*?)</p></div>'
                r'|<div class="benefits">(?P<benefits>.*?)</div>\s*</div>'
                r'|<ol class="how">(?P<how>.*?)</ol>'
                r'|<ul class="svc-list">(?P<ul>.*?)</ul>'
                r'|<p>(?P<p>.*?)</p>', S)
            resto = parte.split('</h2>', 1)[1]
            # a CTA do bloco final não é texto; trata separado
            resto = re.sub(r'<div class="cta-line">.*?</p></div>', '', resto, flags=S)
            for m in padrao.finditer(resto):
                if m.group('note') is not None:
                    itens.append({'tipo': 'nota', 'texto': m.group('note')})
                elif m.group('benefits') is not None:
                    pares = re.findall(r'<h3>(.*?)</h3><p>(.*?)</p>', m.group('benefits'), S)
                    itens.append({'tipo': 'beneficios', 'itens': [{'titulo': a, 'texto': b} for a, b in pares]})
                elif m.group('how') is not None:
                    pares = re.findall(r'<li><h3>(.*?)</h3><p>(.*?)</p></li>', m.group('how'), S)
                    itens.append({'tipo': 'passos', 'itens': [{'titulo': a, 'texto': b} for a, b in pares]})
                elif m.group('ul') is not None:
                    itens.append({'tipo': 'lista', 'itens': re.findall(r'<li>(.*?)</li>', m.group('ul'), S)})
                else:
                    itens.append({'tipo': 'paragrafo', 'texto': m.group('p')})
            saida.append({'titulo': titulo, 'conteudo': itens})
        return saida

    dados = {
        'slug': slug,
        'titulo_pagina': um(r'<title>(.*?)</title>', head),
        'descricao': um(r'<meta name="description" content="([^"]*)"', head),
        'jsonld': jsonld,
        'h1': um(r'<h1 class="h1">(.*?)</h1>', hero),
        'chamada': um(r'<p class="svc-headline">(.*?)</p>', hero),
        'introducao': re.findall(r'<p>(.*?)</p>', intro, S),
        'cta': {'href': cta_href, 'rotulo': cta_label.strip(), 'micro': cta_micro},
        'blocos': blocos(corpo),
        'proximo_passo': blocos(final),
    }
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / f'{slug}.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{slug}: extraído ({len(dados["blocos"])} blocos + próximo passo)')


# ----------------------------------------------------------------------- gerar
def gerar(slug):
    d = json.loads((DOCS / f'{slug}.json').read_text(encoding='utf-8'))
    caminho_copy = DOCS / f'{slug}.copy.json'
    copia = json.loads(caminho_copy.read_text(encoding='utf-8')) if caminho_copy.exists() else None
    nome_servico = copia['nome_servico'] if copia else re.sub(r'\s*\|.*$', '', d['titulo_pagina'])

    # JSON-LD: preserva tudo; só o nome do breadcrumb acompanha o menu ("Serviços").
    jsonld = d['jsonld'].replace('"name":"Outros serviços"', '"name":"Serviços"')

    if copia:
        # copy nova aprovada: vale no lugar do texto antigo nos campos que ela traz;
        # blocos antigos que a ordem cita continuam como estão.
        q = lambda s: s.replace('"', '&quot;')
        jsonld = jsonld.replace(d['descricao'], copia['descricao'])
        d = {**d, 'titulo_pagina': q(copia['titulo_pagina']), 'descricao': q(copia['descricao']), 'h1': copia['h1'],
             'chamada': copia['chamada'], 'introducao': copia['introducao'],
             'cta': {**d['cta'], 'rotulo': copia['cta']['rotulo'], 'micro': copia['cta']['micro']}}

    nav = ''.join(
        f'<a href="../../{href}"' + (' aria-current="page"' if rotulo == 'Serviços' else '') + f'>{rotulo}</a>'
        for rotulo, href in [('Início', ''), ('Serviços', 'servicos/'), ('Projetos', 'experiencia-tecnica/'),
                             ('Como trabalhamos', 'metodologia/'), ('Contato', 'contato/')])

    def figura_html(f):
        w = sorted(f['larguras'])
        h = round(f['altura_1600'] * w[-1] / 1600)
        srcset = ', '.join(f'../../assets/images/{f["base"]}-{x}.jpg {x}w' for x in w)
        return (f'<figure class="figura"><img src="../../assets/images/{f["base"]}-{w[-1]}.jpg" srcset="{srcset}" '
                f'sizes="(min-width:1190px) 860px, 100vw" width="{w[-1]}" height="{h}" alt="{f["alt"]}" loading="lazy">'
                f'<figcaption>{f["legenda"]}</figcaption></figure>')

    def bloco_html(b, interno=False):
        partes = []
        if copia and not interno:
            figs = [figura_html(f) for f in copia.get('figuras', {}).get(b['titulo'], [])]
            if figs:
                partes.append('<div class="figuras">' + ''.join(figs) + '</div>')
        for it in b['conteudo']:
            t = it['tipo']
            if t == 'paragrafo':
                partes.append(f'<p>{it["texto"]}</p>')
            elif t == 'lista':
                partes.append('<ul class="lista">' + ''.join(f'<li>{x}</li>' for x in it['itens']) + '</ul>')
            elif t == 'nota':
                partes.append(f'<p class="nota">{it["texto"]}</p>')
            elif t == 'beneficios':
                partes.append('<div class="beneficios">' + ''.join(
                    f'<div><h3>{x["titulo"]}</h3><p>{x["texto"]}</p></div>' for x in it['itens']) + '</div>')
            elif t == 'perguntas':
                partes.append('<div class="perguntas">' + ''.join(
                    f'<h3>{x["pergunta"]}</h3><p>{x["resposta"]}</p>' for x in it['itens']) + '</div>')
            elif t == 'passos':
                partes.append('<ol class="passos">' + ''.join(
                    f'<li><h3>{x["titulo"]}</h3><p>{x["texto"]}</p></li>' for x in it['itens']) + '</ol>')
        if interno:  # dentro de "Detalhes": sem nova caixa .wrap, títulos um nível abaixo
            return f'<div class="bloco bloco-interno"><h3>{b["titulo"]}</h3><div class="bloco-corpo">{"".join(partes)}</div></div>'
        return f'<section class="bloco wrap"><h2>{b["titulo"]}</h2><div class="bloco-corpo">{"".join(partes)}</div></section>'

    if copia:
        antigos = {b['titulo']: b for b in d['blocos']}

        def achar(chave):
            bloco = copia['blocos_novos'].get(chave) or antigos.get(chave)
            assert bloco, f'{slug}: bloco "{chave}" não existe nem na copy nova nem no texto antigo'
            return bloco

        partes_pagina = []
        detalhes_html = ''
        for item in copia['ordem']:
            if isinstance(item, dict):  # grupo dobrável: texto intacto, só fechado por padrão
                g = item['detalhes']
                internos = '\n'.join(bloco_html(achar(c), interno=True) for c in g['blocos'])
                detalhes_html = (f'<section class="bloco wrap detalhes"><details><summary><span class="det-rotulo">{g["titulo"]}</span>'
                                 f'<span class="det-conteudo">{g["resumo"]}</span></summary>{internos}</details></section>')
                partes_pagina.append(detalhes_html)
            else:
                partes_pagina.append(bloco_html(achar(item)))
        corpo = '\n'.join(partes_pagina)
        prox = {'titulo': copia['proximo_passo']['titulo']}
        prox_texto = ''.join(f'<p>{p}</p>' for p in copia['proximo_passo']['paragrafos'])
    else:
        corpo = '\n'.join(bloco_html(b) for b in d['blocos'])
        prox = d['proximo_passo'][0]
        prox_texto = ''.join(f'<p>{it["texto"]}</p>' for it in prox['conteudo'] if it['tipo'] == 'paragrafo')
    cta = d['cta']

    introducao = ''.join(f'<p>{p}</p>' for p in d['introducao'])
    rico = bool(copia and copia.get('layout') == 'rico')
    if rico:
        import sys as _s
        _s.path.insert(0, str(Path(__file__).resolve().parent))
        import layout_rico as L
        nv, ant = copia['blocos_novos'], {b['titulo']: b for b in d['blocos']} if False else antigos
        t_dj = 'Experiência aplicada — CECM Djalma Marinho'
        figs = ''.join(figura_html(f) for f in copia.get('figuras', {}).get(t_dj, []))
        estrutura_pg = copia.get('perfil') in ('estrutura', 'hidro')
        hidro_pg = copia.get('perfil') == 'hidro'
        maquete_html = (DOCS / ('maquete-hidro-markup.html' if hidro_pg else 'maquete-estrutura-markup.html' if estrutura_pg else 'maquete-markup.html')).read_text(encoding='utf-8')
        meio = L.estrutura(nv['estrutura']) if estrutura_pg else L.prefeitura(nv['prefeitura'])
        prova_html = L.prova(ant['Prova técnica'], 'de experiência técnica ' + ('hidrossanitária' if hidro_pg else 'estrutural') + ' documentada') if estrutura_pg else L.prova(ant['Prova técnica'])
        extra_hero = L.mezanino_link(nv['mezanino']) if estrutura_pg and 'mezanino' in nv else ''
        if estrutura_pg and 'mezanino' in nv:
            maquete_html = maquete_html.replace('<!--SOBRE-->', L.mezanino_painel(nv['mezanino'], d['cta']['href'], copia['cta']['rotulo']))
        principal = '\n'.join([L.hero(copia, d, maquete_html, extra_hero), L.para_quem(nv['para_quem']), L.muda(nv['muda']), meio,
                               L.faz(nv['faz']), L.perguntas(nv['perguntas']), prova_html,
                               L.djalma(nv['experiencia'] if estrutura_pg else ant[t_dj], '', copia.get('imprensa', [])), detalhes_html])
        importmap = '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>'
        base_css = '<link rel="stylesheet" href="../../assets/css/maquete-3d.css?v=6">\n<link rel="stylesheet" href="../../assets/css/servico-rico-v02.css?v=6">\n'
        if estrutura_pg:
            extra_head = (base_css + '<link rel="stylesheet" href="../../assets/css/maquete-estrutura-3d.css?v=3">\n'
                          '<link rel="stylesheet" href="../../assets/css/' + ('servico-hidro-v02.css?v=4' if hidro_pg else 'servico-estrutural-v02.css?v=4') + '">\n' + importmap)
            extra_body = '<script type="module" src="../../assets/js/' + ('maquete-hidro-3d.js?v=10' if hidro_pg else 'maquete-estrutura-3d.js?v=6') + '"></script>'
            classe_body = 'servicos-v02 servico-pagina-v02 servico-rico-v02 ' + ('servico-rico-hidro' if hidro_pg else 'servico-rico-estrutural')
        else:
            extra_head = base_css + importmap
            extra_body = '<script type="module" src="../../assets/js/maquete-3d.js"></script>'
            classe_body = 'servicos-v02 servico-pagina-v02 servico-rico-v02'
    else:
        principal = f'''<section class="hero wrap" data-block="service-hero"><div><p class="crumb"><a href="../">Serviços</a> / {nome_servico}</p><h1>{d['h1']}</h1></div><div class="hero-copy"><p class="chamada">{d['chamada']}</p>{introducao}<p class="cta-linha"><a class="cta" href="{cta['href']}">{cta['rotulo']} →</a></p><p class="micro">{cta['micro']}</p></div></section>
{corpo}'''
        extra_head = extra_body = ''
        classe_body = 'servicos-v02 servico-pagina-v02'

    pagina = f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d['titulo_pagina']}</title>
<meta name="description" content="{d['descricao']}">
<meta name="theme-color" content="#26323e">
<link rel="canonical" href="https://demelloeng.com.br/servicos/{slug}/">
<meta property="og:title" content="{d['titulo_pagina']}">
<meta property="og:description" content="{d['descricao']}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="https://demelloeng.com.br/servicos/{slug}/">
<meta property="og:image" content="https://demelloeng.com.br/assets/images/logo.png">
<link rel="icon" href="../../assets/images/favicon.png">
<link rel="preload" href="../../assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../../assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../assets/css/servicos-v02.css?v=6">
<link rel="stylesheet" href="../../assets/css/servico-pagina-v02.css?v=6">
{extra_head}
{jsonld}
</head>
<body class="{classe_body}"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../../"><img src="../../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{nav}<a class="nav-budget" href="../../orcamento/">Calcular estimativa</a><a class="nav-extra nav-whatsapp" href="https://wa.me/5541985124056" target="_blank" rel="noopener">WhatsApp</a></nav></div></header>
<main id="conteudo">
{principal}
<section class="final-cta"><div class="wrap"><h2>{prox['titulo']}</h2>{prox_texto}<a class="cta" href="{cta['href']}">{cta['rotulo']} →</a><p class="micro">{cta['micro']}</p></div></section>
</main>
<footer class="site-footer rodape"><div class="wrap rodape-grade">
<div class="rodape-marca"><img src="../../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="230" height="67"><p class="tag">projetos possíveis, planos reais</p>
<p class="legal">Marcos de Mello Silva Engenharia LTDA<br>CNPJ 65.613.230/0001-71<br>CREA-PR PJ nº 92585<br>Responsável técnico: CREA-PR 146906/D</p></div>
<nav class="rodape-col" aria-label="Rodapé"><p class="t">Navegação</p><a href="../../">Início</a><a href="../">Serviços</a><a href="../../experiencia-tecnica/">Projetos</a><a href="../../metodologia/">Como trabalhamos</a><a href="../../empresa/">Empresa</a><a href="../../empresa/trajetoria-do-fundador.html">Trajetória do fundador</a><a href="../../contato/">Contato</a><a href="../../privacidade/">Privacidade</a></nav>
<div class="rodape-col"><p class="t">Contato</p><a href="mailto:marcos@demelloeng.com.br">marcos@demelloeng.com.br</a><a href="tel:+5541985124056">(41) 98512-4056</a><a href="tel:+5544998202552">(44) 99820-2552</a><a href="https://wa.me/5541985124056">WhatsApp</a><a href="https://www.instagram.com/demelloeng/" target="_blank" rel="noopener">Instagram</a><a href="https://www.linkedin.com/company/demello-engenharia/" target="_blank" rel="noopener">LinkedIn</a></div>
<div class="rodape-col"><p class="t">Onde estamos</p><span>R. Pedro Ivo, 730, Centro</span><span>Curitiba/PR · CEP 80010-020</span><span>Atendimento em todo o Brasil</span></div>
</div><div class="wrap rodape-barra"><p>© 2026 Marcos de Mello Silva Engenharia LTDA</p></div></footer>
<script src="../../assets/js/nav.js" defer></script>
<script src="../../assets/js/analytics-sink.js" defer></script>
<script src="../../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../../assets/js/site-analytics.mjs"></script>
{extra_body}
</body></html>
'''
    (SERVICOS / slug / 'index.html').write_bytes(pagina.encode('utf-8'))
    print(f'{slug}: servicos/{slug}/index.html regenerado a partir de {slug}.json')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('extrair', 'gerar'):
        sys.exit(__doc__)
    alvo = SLUGS if sys.argv[2] == '--todas' else [sys.argv[2]]
    for s in alvo:
        assert s in SLUGS, f'slug desconhecido: {s}'
        (extrair if sys.argv[1] == 'extrair' else gerar)(s)

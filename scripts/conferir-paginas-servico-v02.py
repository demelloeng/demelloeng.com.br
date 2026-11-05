#!/usr/bin/env python3
"""Confere que as páginas /servicos/<slug>/ geradas não perderam nenhum texto da versão anterior (git HEAD).
Diferenças permitidas: o rótulo do breadcrumb 'Outros serviços' -> 'Serviços' e a seta '→' no fim da CTA (era SVG).
Uso: python scripts/conferir-paginas-servico-v02.py [rev-anterior]   (padrão: HEAD)
"""
import re
import subprocess
import sys
import html as html_lib
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REV = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'


class Texto(HTMLParser):
    def __init__(self):
        super().__init__()
        self.t, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('svg', 'script'):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ('svg', 'script'):
            self.skip -= 1

    def handle_data(self, data):
        data = ' '.join(data.split())
        if data and not self.skip:
            self.t.append(data)


def textos(html):
    main = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S).group(1)
    p = Texto()
    p.feed(main)
    return p.t


def textos_do_bloco(bloco):
    """Todas as strings de texto de um bloco do JSON antigo, sem marcação."""
    saida = []

    def anda(o):
        if isinstance(o, str):
            saida.append(' '.join(re.sub(r'<[^>]+>', '', o).split()))
        elif isinstance(o, list):
            [anda(x) for x in o]
        elif isinstance(o, dict):
            [anda(v) for k, v in o.items() if k != 'tipo']

    anda(bloco)
    return [s for s in saida if s]


perdas = 0
for pagina in sorted((REPO / 'servicos').glob('*/index.html')):
    slug = pagina.parent.name
    caminho_copy = REPO / 'docs/arquivo/paginas-servico-v02' / f'{slug}.copy.json'
    if slug in ('projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao') and (caminho_copy.exists() or slug == 'projeto-gas-glp'):
        import json
        from copy_pscip_glp import gas_copy
        copia = (json.loads(caminho_copy.read_text(encoding='utf-8')) if caminho_copy.exists() else
                 gas_copy(json.loads((caminho_copy.parent / f'{slug}.json').read_text(encoding='utf-8'))))
        bruto = pagina.read_text(encoding='utf-8')
        visivel = html_lib.unescape(' '.join(textos(bruto)))
        def limpar(s):
            return ' '.join(html_lib.unescape(re.sub(r'<[^>]*>', ' ', s)).split())
        fragmentos=[]
        def conferir(obj):
            if isinstance(obj,str): fragmentos.append(limpar(obj))
            elif isinstance(obj,list):
                for x in obj: conferir(x)
            elif isinstance(obj,dict):
                for k,v in obj.items():
                    if k not in ('tipo','resposta'): conferir(v)
        conferir([copia['h1'],copia['chamada'],copia['introducao'],copia['blocos_novos'],copia['proximo_passo'],copia['cta']['micro']])
        faltam=[x for x in fragmentos if x and x not in visivel]
        titulo=re.search(r'<title>(.*?)</title>',bruto,re.S)
        descricao=re.search(r'<meta name="description" content="([^"]*)"',bruto)
        if not titulo or html_lib.unescape(titulo[1]) != copia['titulo_pagina']: faltam.append('Título SEO divergente da fonte')
        if not descricao or html_lib.unescape(descricao[1]) != copia['descricao']: faltam.append('Descrição SEO divergente da fonte')
        for cta in [copia['cta']] + ([copia['cta_secundario']] if 'cta_secundario' in copia else []):
            if not re.search(r'<a\b[^>]*href="'+re.escape(cta['href'])+r'"[^>]*>\s*'+re.escape(cta['rotulo'])+r'(?: →)?</a>',bruto):
                faltam.append('CTA: '+cta['rotulo'])
        for nota in copia.get('notas_editoriais',[]):
            if limpar(nota['texto']) in visivel: faltam.append('Nota editorial indevidamente publicada')
        print(f'{slug}: FONTE CENTRAL COMPLETA | {len(fragmentos)} trechos | ausentes {len(faltam)}')
        for x in faltam: print('   falta:',x[:120])
        perdas+=len(faltam)
        continue
    if caminho_copy.exists():
        # copy nova: o que muda é proposital. Confere que os blocos antigos mantidos estão inteiros na página.
        import json
        copia = json.loads(caminho_copy.read_text(encoding='utf-8'))
        antigo = json.loads((REPO / 'docs/arquivo/paginas-servico-v02' / f'{slug}.json').read_text(encoding='utf-8'))
        usados = set()
        for item in copia['ordem']:
            usados.update(item['detalhes']['blocos'] if isinstance(item, dict) else [item])
        mantidos = [b for b in antigo['blocos'] if b['titulo'] in usados]
        pagina_texto = ' '.join(textos(pagina.read_text(encoding='utf-8')))
        removidos = set(copia.get('removidos', []))
        falta = [s for b in mantidos for s in textos_do_bloco(b) if s not in pagina_texto and s not in removidos]
        print(f'{slug}: COPY NOVA ({copia["fonte_copy"]}) | blocos antigos mantidos {len(mantidos)} | trechos ausentes {len(falta)}')
        for x in falta[:5]:
            print('   falta:', x[:90])
        perdas += len(falta)
        continue
    antigo = subprocess.run(['git', 'show', f'{REV}:servicos/{slug}/index.html'], capture_output=True,
                            text=True, encoding='utf-8', cwd=REPO).stdout
    a = ['Serviços' if x == 'Outros serviços' else x for x in textos(antigo)]
    # a seta da CTA era um SVG decorativo; agora é o caractere "→" (como em /servicos/)
    n = [x[:-2] if x.endswith(' →') else x for x in textos(pagina.read_text(encoding='utf-8'))]
    n = ['Serviços' if x == 'Outros serviços' else x for x in n]
    falta, sobra = Counter(a) - Counter(n), Counter(n) - Counter(a)
    print(f'{slug}: antigo {len(a)} | novo {len(n)} | faltam {sum(falta.values())} | a mais {sum(sobra.values())}')
    for x in list(falta)[:5]:
        print('   falta:', x[:90])
    for x in list(sobra)[:5]:
        print('   a mais:', x[:90])
    perdas += sum(falta.values())
print('SEM PERDA DE TEXTO' if not perdas else f'PERDA DE TEXTO: {perdas}')
sys.exit(1 if perdas else 0)

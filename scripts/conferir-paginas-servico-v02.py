#!/usr/bin/env python3
"""Confere que as páginas /servicos/<slug>/ geradas não perderam nenhum texto da versão anterior (git HEAD).
Diferenças permitidas: o rótulo do breadcrumb 'Outros serviços' -> 'Serviços' e a seta '→' no fim da CTA (era SVG).
Uso: python scripts/conferir-paginas-servico-v02.py [rev-anterior]   (padrão: HEAD)
"""
import re
import subprocess
import sys
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
    falta, sobra = Counter(a) - Counter(n), Counter(n) - Counter(a)
    print(f'{slug}: antigo {len(a)} | novo {len(n)} | faltam {sum(falta.values())} | a mais {sum(sobra.values())}')
    for x in list(falta)[:5]:
        print('   falta:', x[:90])
    for x in list(sobra)[:5]:
        print('   a mais:', x[:90])
    perdas += sum(falta.values())
print('SEM PERDA DE TEXTO' if not perdas else f'PERDA DE TEXTO: {perdas}')
sys.exit(1 if perdas else 0)

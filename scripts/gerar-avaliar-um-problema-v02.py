#!/usr/bin/env python3
"""Copy V02 -> entrada problem. Só biblioteca padrão; --check não escreve.

Reutiliza apenas MENU, RODAPE e o BreadcrumbList do precedente Construir ou ampliar.
Não executa esse gerador nem altera outras páginas. Não é uma página de serviço.
"""
from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
from pathlib import Path
import re
import runpy

REPO = Path(__file__).resolve().parent.parent
COPY = REPO / 'docs/arquivo/avaliar-um-problema-v02-20261106/COPY_AVALIAR_UM_PROBLEMA_V02_20261106.md'
SAIDA = REPO / 'avaliar-um-problema/index.html'
CTA_HREF = '../orcamento/?situacao=problem'
BASE = runpy.run_path(str(REPO / 'scripts/gerar-construir-ou-ampliar-v02.py'))
MENU = BASE['MENU'].replace(' aria-current="page"', '')
RODAPE = BASE['RODAPE']
JSONLD = BASE['JSONLD'].replace('Construir ou ampliar', 'Avaliar um problema').replace('/construir-ou-ampliar/', '/avaliar-um-problema/')

# Conteúdo protegido da main de partida, não inferido nem revalidado pelo gerador.
SEGURANCA = (
    'Esta página e o formulário não fazem diagnóstico, laudo nem vistoria e não confirmam a segurança do imóvel. Não existe diagnóstico remoto.',
    'Se o problema estiver aumentando, aparecendo de repente ou envolver risco de desabamento, não espere a resposta de um formulário: afaste as pessoas da área e, em risco imediato, acione o Corpo de Bombeiros (193) ou a Defesa Civil (199).',
    'Quando o seu relato indica sinais de risco — por exemplo, algo que aumentou, piorou ou aparece de repente —, a experiência não calcula nada e orienta você a procurar a equipe DEMELLO para avaliar o caso. Você ainda pode enviar o caso para avaliação.',
)
SITUACOES_PARAGRAFOS = (3, 2, 3)
RESPOSTAS_PARAGRAFOS = (1, 2, 2, 1, 2, 3, 2)
CAMPOS = (
    'TITULO SEO', 'DESCRICAO SEO', 'IDENTIFICACAO', 'H1', 'HERO 1', 'HERO 2', 'HERO 3', 'CTA', 'MICRO',
    'SEGURANCA TITULO', 'SEGURANCA 1', 'SEGURANCA 2', 'SEGURANCA 3', 'SITUACOES TITULO', 'SITUACOES INTRO',
    *(key for i, count in enumerate(SITUACOES_PARAGRAFOS, 1)
      for key in (f'SITUACAO {i} TITULO', *(f'SITUACAO {i} TEXTO {j}' for j in range(1, count + 1)))),
    'REGULARIZACAO', 'COMO TITULO', 'COMO INTRO',
    *(key for i in range(1, 5) for key in (f'PASSO {i} TITULO', f'PASSO {i} TEXTO')),
    'FOTOS', 'COMO FECHO', 'ATENDIMENTO TITULO', 'ATENDIMENTO INTRO 1', 'ATENDIMENTO INTRO 2',
    *(key for i in range(1, 5) for key in (f'SERVICO {i} TITULO', f'SERVICO {i} TEXTO 1', f'SERVICO {i} TEXTO 2')),
    'ATENDIMENTO DESTAQUE', 'ATENDIMENTO FECHO', 'FAQ TITULO',
    *(key for i, count in enumerate(RESPOSTAS_PARAGRAFOS, 1)
      for key in (f'PERGUNTA {i}', *(f'RESPOSTA {i} TEXTO {j}' for j in range(1, count + 1)))),
    'FINAL TITULO', 'FINAL TEXTO 1', 'FINAL TEXTO 2', 'WHATSAPP',
)
LINK = '[Regularização de imóvel → /servicos/regularizacao/]'


def ler_copy(texto: str) -> dict[str, str]:
    campos = {}
    for linha in texto.splitlines():
        if not linha.strip():
            continue
        key, sep, value = linha.partition(':')
        key, value = key.strip(), value.strip()
        if not sep or key not in CAMPOS or key in campos or not value:
            raise ValueError(f'Campo desconhecido, repetido ou vazio: {key!r}')
        campos[key] = value
    if set(campos) != set(CAMPOS):
        raise ValueError(f'Campos ausentes: {sorted(set(CAMPOS) - set(campos))}')
    for i, protegido in enumerate(SEGURANCA, 1):
        if campos[f'SEGURANCA {i}'] != protegido:
            raise ValueError(f'Parágrafo protegido de segurança {i} alterado')
    if campos['REGULARIZACAO'].count(LINK) != 1:
        raise ValueError('Destino e rótulo de Regularização devem ser preservados')
    if campos['CTA'] != 'Descrever meu caso':
        raise ValueError('CTA da entrada problem alterado')
    return campos


class TextoVisivel(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.partes = []

    def handle_data(self, data):
        self.partes.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in ('p', 'h1', 'h2', 'h3', 'li', 'section', 'summary', 'div', 'title'):
            self.partes.append(' ')


def montar(texto_copy: str) -> str:
    c = ler_copy(texto_copy)
    esc = lambda s: html.escape(s, quote=False)
    texto = lambda key: esc(c[key])
    p = lambda key, classe='': f'<p{f" class={chr(34)}{classe}{chr(34)}" if classe else ""}>{texto(key)}</p>'
    cta = f'<a class="acao acao-principal" href="{CTA_HREF}">{texto("CTA")}</a>'
    regularizacao = esc(c['REGULARIZACAO']).replace(esc(LINK), '<a href="../servicos/regularizacao/">Regularização de imóvel</a>')
    situacoes = '\n'.join(f'<article class="situacao"><h3>{texto(f"SITUACAO {i} TITULO")}</h3>' +
                          ''.join(p(f'SITUACAO {i} TEXTO {j}') for j in range(1, count + 1)) + '</article>'
                          for i, count in enumerate(SITUACOES_PARAGRAFOS, 1))
    passos = '\n'.join(f'<li><h3>{texto(f"PASSO {i} TITULO")}</h3>{p(f"PASSO {i} TEXTO")}' +
                       (p('FOTOS', 'nota-fotos') if i == 2 else '') + '</li>' for i in range(1, 5))
    servicos = '\n'.join(f'<article class="tecnico"><h3>{texto(f"SERVICO {i} TITULO")}</h3>' +
                         p(f'SERVICO {i} TEXTO 1') + p(f'SERVICO {i} TEXTO 2') + '</article>' for i in range(1, 5))
    faq = '\n'.join(f'<details class="pergunta"><summary>{texto(f"PERGUNTA {i}")}</summary><div>' +
                    ''.join(p(f'RESPOSTA {i} TEXTO {j}') for j in range(1, count + 1)) + '</div></details>'
                    for i, count in enumerate(RESPOSTAS_PARAGRAFOS, 1))
    sha = hashlib.sha256(texto_copy.encode('utf-8')).hexdigest()
    title = html.escape(c['TITULO SEO'], quote=True)
    description = html.escape(c['DESCRICAO SEO'], quote=True)
    url = 'https://demelloeng.com.br/avaliar-um-problema/'
    pagina = f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-avaliar-um-problema-v02.py. Fonte: {COPY.relative_to(REPO).as_posix()} (SHA-256 {sha}). Não editar HTML à mão. -->
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
<link rel="stylesheet" href="../assets/css/avaliar-um-problema-v02.css?v=1">
<script type="application/ld+json">{JSONLD}</script>
</head>
<body class="servicos-v02 avaliar-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
<section class="hero wrap" data-block="landing-hero" aria-labelledby="pagina-titulo"><div><p class="eyebrow">{texto('IDENTIFICACAO')}</p><h1 id="pagina-titulo">{texto('H1')}</h1></div><div class="hero-copy">{p('HERO 1')}{p('HERO 2')}{p('HERO 3')}<p class="acoes">{cta}</p>{p('MICRO', 'micro')}</div></section>
<section class="seguranca" data-block="safety" aria-labelledby="seguranca-titulo"><div class="wrap"><div class="aviso" role="note"><h2 id="seguranca-titulo">{texto('SEGURANCA TITULO')}</h2>{''.join(p(f'SEGURANCA {i}') for i in range(1, 4))}</div></div></section>
<section class="situacoes wrap" data-block="situations" aria-labelledby="situacoes-titulo"><h2 id="situacoes-titulo">{texto('SITUACOES TITULO')}</h2>{p('SITUACOES INTRO', 'intro')}<div class="situacoes-grade">{situacoes}</div><p class="regularizacao">{regularizacao}</p></section>
<section class="como" data-block="framing" aria-labelledby="como-titulo"><div class="wrap"><h2 id="como-titulo">{texto('COMO TITULO')}</h2>{p('COMO INTRO', 'intro')}<ol class="passos">{passos}</ol>{p('COMO FECHO', 'fecho')}</div></section>
<section class="atendimento wrap" data-block="technical-care" aria-labelledby="atendimento-titulo"><h2 id="atendimento-titulo">{texto('ATENDIMENTO TITULO')}</h2>{p('ATENDIMENTO INTRO 1', 'intro')}{p('ATENDIMENTO INTRO 2')}<div class="tecnicos-grade">{servicos}</div>{p('ATENDIMENTO DESTAQUE', 'destaque')}{p('ATENDIMENTO FECHO', 'fecho')}</section>
<section class="faq wrap" data-block="faq" id="duvidas" aria-labelledby="faq-titulo"><h2 id="faq-titulo">{texto('FAQ TITULO')}</h2>{faq}</section>
<section class="cta-final cta-band" data-block="final-cta" aria-labelledby="cta-titulo"><div class="wrap"><h2 id="cta-titulo">{texto('FINAL TITULO')}</h2>{p('FINAL TEXTO 1')}{p('FINAL TEXTO 2')}<p class="acoes">{cta}</p>{p('MICRO', 'micro')}<p class="secundaria"><a href="https://wa.me/5541985124056">{texto('WHATSAPP')}</a></p></div></section>
</main>
{RODAPE}<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../assets/js/site-analytics.mjs"></script>
</body></html>
'''
    parser = TextoVisivel()
    parser.feed(pagina)
    visivel = re.sub(r'\s+', ' ', ''.join(parser.partes))
    for key, value in c.items():
        esperado = value.replace(LINK, 'Regularização de imóvel')
        alvo = description if key == 'DESCRICAO SEO' else visivel
        if re.sub(r'\s+', ' ', esperado) not in html.unescape(alvo):
            raise ValueError(f'Conteúdo ausente da página gerada: {key}')
    return pagina


def verificar_ou_gravar(texto_copy: str, check: bool = False) -> int:
    pagina = montar(texto_copy)
    if check:
        if not SAIDA.exists() or SAIDA.read_text(encoding='utf-8') != pagina:
            print('DIVERGE: HTML não corresponde à fonte central; gere novamente.')
            return 1
        print('OK: HTML corresponde à Copy V02; todos os campos presentes; segurança preservada.')
        return 0
    SAIDA.write_text(pagina, encoding='utf-8', newline='\n')
    print('Gerado avaliar-um-problema/index.html a partir da Copy V02.')
    return 0


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--check', action='store_true')
    options = args.parse_args()
    raise SystemExit(verificar_ou_gravar(COPY.read_text(encoding='utf-8'), options.check))

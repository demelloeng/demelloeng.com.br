#!/usr/bin/env python3
"""Gera construir-ou-ampliar/index.html (página Construir ou ampliar V02) a partir da copy aprovada.

Fonte única do texto: docs/arquivo/construir-ou-ampliar-v02-20261104/COPY_CONSTRUIR_OU_AMPLIAR_V01_20261104.md
Saída (a única): construir-ou-ampliar/index.html

Uso:
    python scripts/gerar-construir-ou-ampliar-v02.py            # grava construir-ou-ampliar/index.html
    python scripts/gerar-construir-ou-ampliar-v02.py --check    # não grava; falha se o arquivo difere do que a fonte gera

Regras:
- Só biblioteca padrão. Mesma entrada, mesmo HTML (sem data, sem aleatoriedade, fim de linha LF).
- O texto da página vem só da copy; o HTML nunca é editado à mão. O gerador recusa campo a mais ou a menos e confere que cada
  campo da copy aparece literalmente no HTML.
- Links na copy: `[rótulo → /caminho/]` (dentro do texto) e `Rótulo → /caminho/` (campos de link). Os caminhos viram relativos.
- Cabeçalho, menu, JSON-LD e rodapé V02 são constantes deste gerador (mesmos das demais páginas V02; o teste commercial_site
  compara menu e rodapé entre as páginas V02). Aqui o item atual do menu é "Construir ou ampliar".
"""
from __future__ import annotations

import hashlib
import html
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COPY = REPO / "docs/arquivo/construir-ou-ampliar-v02-20261104/COPY_CONSTRUIR_OU_AMPLIAR_V01_20261104.md"
SAIDA = REPO / "construir-ou-ampliar/index.html"
ORIGEM = "https://demelloeng.com.br"
CTA_HREF = "../orcamento/?situacao=build"

CAMPOS = (
    "TITULO SEO", "DESCRICAO SEO", "IDENTIFICACAO DA PAGINA", "H1", "TEXTO DE ABERTURA 1", "TEXTO DE ABERTURA 2", "ACAO PRINCIPAL", "MICROTEXTO",
    "H2 PONTO DE PARTIDA", "CONSTRUIR H3", "CONSTRUIR TEXTO", "AMPLIAR H3", "AMPLIAR TEXTO 1", "AMPLIAR TEXTO 2", "AMPLIAR TEXTO 3",
    "H2 CONVERSAM", "CONVERSAM TEXTO 1", "CONVERSAM TEXTO 2", "CONVERSAM TEXTO 3", "CONVERSAM TEXTO 4",
    "EYEBROW EXPERIENCIA", "H2 EXPERIENCIA", "EXPERIENCIA TEXTO 1", "EXPERIENCIA TEXTO 2", "EXPERIENCIA TEXTO 3", "EXPERIENCIA LINK", "EXPERIENCIA NOTA",
    "H2 ESTIMATIVA", "PASSO 1", "PASSO 2", "PASSO 3", "PASSO 4", "FECHAMENTO",
    "H2 FAQ", "P1", "R1", "P2", "R2", "P3", "R3", "P4", "R4", "P5", "R5", "P6", "R6",
    "H2 CTA FINAL", "TEXTO CTA FINAL", "ACAO PRINCIPAL FINAL", "MICROTEXTO FINAL", "ACAO SECUNDARIA",
)
CAMPOS_COM_LINK = {"EXPERIENCIA LINK", "ACAO SECUNDARIA"}

# JSON-LD vigente da página (BreadcrumbList), preservado byte a byte.
JSONLD = ('{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,'
          '"name":"Início","item":"https://demelloeng.com.br/"},{"@type":"ListItem","position":2,"name":"Construir ou ampliar",'
          '"item":"https://demelloeng.com.br/construir-ou-ampliar/"}]}]}')

# Menu V02 (mesmo das demais páginas V02); aqui o item atual é o botão "Construir ou ampliar".
MENU = ('<a href="../">Início</a><a href="../servicos/">Serviços</a><a href="../experiencia-tecnica/">Projetos</a>'
        '<a href="../metodologia/">Como trabalhamos</a><a href="../contato/">Contato</a>'
        '<a class="nav-build" href="../construir-ou-ampliar/" aria-current="page">Construir ou ampliar</a>'
        '<a class="nav-budget" href="../orcamento/">Calcular estimativa</a>'
        '<a class="nav-extra nav-whatsapp" href="https://wa.me/5541985124056" target="_blank" rel="noopener">WhatsApp</a>')

# Rodapé V02 compartilhado (idêntico ao das demais páginas V02, com o Facebook entre Instagram e LinkedIn).
RODAPE = '''<footer class="site-footer rodape"><div class="wrap rodape-grade">
<div class="rodape-marca"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="230" height="67"><p class="tag">projetos possíveis, planos reais</p>
<p class="legal">Marcos de Mello Silva Engenharia LTDA<br>CNPJ 65.613.230/0001-71<br>CREA-PR PJ nº 92585<br>Responsável técnico: CREA-PR 146906/D</p></div>
<nav class="rodape-col" aria-label="Rodapé"><p class="t">Navegação</p><a href="../">Início</a><a href="../servicos/">Serviços</a><a href="../experiencia-tecnica/">Projetos</a><a href="../metodologia/">Como trabalhamos</a><a href="../empresa/">Empresa</a><a href="../empresa/trajetoria-do-fundador.html">Trajetória do fundador</a><a href="../contato/">Contato</a><a href="../privacidade/">Privacidade</a></nav>
<div class="rodape-col"><p class="t">Contato</p><a href="mailto:marcos@demelloeng.com.br">marcos@demelloeng.com.br</a><a href="tel:+5541985124056">(41) 98512-4056</a><a href="tel:+5544998202552">(44) 99820-2552</a><a href="https://wa.me/5541985124056">WhatsApp</a><a href="https://www.instagram.com/demelloeng/" target="_blank" rel="noopener">Instagram</a><a href="https://www.facebook.com/demelloeng/" target="_blank" rel="noopener">Facebook</a><a href="https://www.linkedin.com/company/demello-engenharia/" target="_blank" rel="noopener">LinkedIn</a></div>
<div class="rodape-col"><p class="t">Onde estamos</p><span>R. Pedro Ivo, 730, Centro</span><span>Curitiba/PR · CEP 80010-020</span><span>Atendimento em todo o Brasil</span></div>
</div><div class="wrap rodape-barra"><p>© 2026 Marcos de Mello Silva Engenharia LTDA</p><p class="sa-badge-wrap" style="margin:14px 0 0"><a class="sa-badge" href="https://www.simpleanalytics.com?utm_source=demelloeng.com.br&amp;utm_content=badge" referrerpolicy="origin" target="_blank"><img src="/assets/images/simple-analytics-badge.svg" width="126" height="30" alt="Simple Analytics" loading="lazy"></a></p></div></footer>'''

txt = lambda s: html.escape(s, quote=False)   # texto: aspas ficam literais
attr = lambda s: html.escape(s, quote=True)
LINK_INLINE = re.compile(r"\[([^\]→]+?) → (/[^\]\s]*)\]")


def rel(caminho: str) -> str:
    assert caminho.startswith("/"), caminho
    return "../" + caminho.lstrip("/")


def ler_copy(texto: str) -> dict[str, str]:
    """Lê `ROTULO: valor` (uma linha por campo). Recusa campo desconhecido, repetido, vazio ou ausente."""
    campos: dict[str, str] = {}
    for linha in texto.split("\n"):
        if not linha.strip():
            continue
        rotulo, _, valor = linha.partition(":")
        rotulo, valor = rotulo.strip(), valor.strip()
        assert rotulo in CAMPOS, f"campo desconhecido na copy: {rotulo!r}"
        assert rotulo not in campos, f"campo repetido na copy: {rotulo!r}"
        assert valor, f"campo vazio na copy: {rotulo!r}"
        campos[rotulo] = valor
    assert set(campos) == set(CAMPOS), f"campos ausentes: {sorted(set(CAMPOS) - set(campos))}"
    return campos


def com_links(valor: str) -> str:
    """Texto com links `[rótulo → /caminho/]` -> HTML escapado, com <a href> relativo."""
    saida, pos = [], 0
    for m in LINK_INLINE.finditer(valor):
        saida.append(txt(valor[pos:m.start()]))
        saida.append(f'<a href="{attr(rel(m.group(2)))}">{txt(m.group(1))}</a>')
        pos = m.end()
    saida.append(txt(valor[pos:]))
    return "".join(saida)


def so_texto(valor: str, campo: str) -> str:
    """O que o visitante lê desse campo (para a conferência de fidelidade)."""
    if campo in CAMPOS_COM_LINK:
        rotulo, _, _ = valor.partition(" → ")
        return rotulo + " →"
    return LINK_INLINE.sub(lambda m: m.group(1), valor)


def link_campo(valor: str, classe: str) -> str:
    m = re.fullmatch(r"(.+) → (/\S*)", valor)
    assert m, f"campo de link malformado: {valor!r}"
    return f'<a class="{classe}" href="{attr(rel(m.group(2)))}">{txt(m.group(1))} →</a>'


def passo(valor: str) -> str:
    """Primeira frase em destaque; o restante segue como está."""
    titulo, sep, resto = valor.partition(". ")
    assert sep, f"passo sem título: {valor!r}"
    return f"<li><strong>{txt(titulo)}.</strong> {txt(resto)}</li>"


def montar(texto_copy: str) -> str:
    c = ler_copy(texto_copy)
    sha = hashlib.sha256(texto_copy.encode("utf-8")).hexdigest()
    titulo, descricao = attr(c["TITULO SEO"]), attr(c["DESCRICAO SEO"])
    url = f"{ORIGEM}/construir-ou-ampliar/"
    cta = lambda rotulo: f'<a class="acao acao-principal" href="{CTA_HREF}">{txt(rotulo)}</a>'
    faq = "\n".join(
        f'<details class="pergunta"><summary>{txt(c[f"P{i}"])}</summary><p>{com_links(c[f"R{i}"])}</p></details>' for i in range(1, 7)
    )
    passos = "\n".join(passo(c[f"PASSO {i}"]) for i in range(1, 5))
    pagina = f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-construir-ou-ampliar-v02.py. Fonte da copy: {COPY.relative_to(REPO).as_posix()} (SHA-256 {sha}). Não editar à mão: altere a fonte e gere de novo. -->
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{descricao}">
<meta name="theme-color" content="#26323e">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descricao}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{ORIGEM}/assets/images/logo.png">
<link rel="icon" href="../assets/images/favicon.png">
<link rel="preload" href="../assets/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../assets/fonts/source-sans-3-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../assets/css/servicos-v02.css?v=7">
<link rel="stylesheet" href="../assets/css/rodape-v02.css?v=1">
<link rel="stylesheet" href="../assets/css/construir-ou-ampliar-v02.css?v=1">
<script type="application/ld+json">{JSONLD}</script>
</head>
<body class="servicos-v02 construir-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
<section class="hero wrap" data-block="landing-hero"><div><p class="eyebrow">{txt(c["IDENTIFICACAO DA PAGINA"])}</p><h1>{txt(c["H1"])}</h1></div><div class="hero-copy"><p>{txt(c["TEXTO DE ABERTURA 1"])}</p><p>{txt(c["TEXTO DE ABERTURA 2"])}</p>
<p class="acoes">{cta(c["ACAO PRINCIPAL"])}</p><p class="micro">{txt(c["MICROTEXTO"])}</p></div></section>
<section class="ponto wrap" data-block="build-vs-extend" aria-labelledby="ponto-titulo"><h2 id="ponto-titulo">{txt(c["H2 PONTO DE PARTIDA"])}</h2>
<div class="ponto-grade"><div class="ponto-cartao" id="construir"><h3>{txt(c["CONSTRUIR H3"])}</h3><p>{txt(c["CONSTRUIR TEXTO"])}</p></div>
<div class="ponto-cartao" id="ampliar"><h3>{txt(c["AMPLIAR H3"])}</h3><p>{txt(c["AMPLIAR TEXTO 1"])}</p><p>{txt(c["AMPLIAR TEXTO 2"])}</p><p>{com_links(c["AMPLIAR TEXTO 3"])}</p></div></div></section>
<section class="conversam wrap" data-block="projects-talk" aria-labelledby="conversam-titulo"><h2 id="conversam-titulo">{txt(c["H2 CONVERSAM"])}</h2>
<p>{txt(c["CONVERSAM TEXTO 1"])}</p><p class="destaque">{txt(c["CONVERSAM TEXTO 2"])}</p><p>{txt(c["CONVERSAM TEXTO 3"])}</p><p>{com_links(c["CONVERSAM TEXTO 4"])}</p></section>
<section class="experiencia" data-block="applied-experience" aria-labelledby="experiencia-titulo"><div class="wrap"><p class="eyebrow">{txt(c["EYEBROW EXPERIENCIA"])}</p><h2 id="experiencia-titulo">{txt(c["H2 EXPERIENCIA"])}</h2>
<p>{txt(c["EXPERIENCIA TEXTO 1"])}</p><p>{txt(c["EXPERIENCIA TEXTO 2"])}</p><p>{txt(c["EXPERIENCIA TEXTO 3"])}</p>
<p class="mais">{link_campo(c["EXPERIENCIA LINK"], "acao-texto")}</p><p class="nota">{txt(c["EXPERIENCIA NOTA"])}</p></div></section>
<section class="como wrap" data-block="how-it-works" aria-labelledby="como-titulo"><h2 id="como-titulo">{txt(c["H2 ESTIMATIVA"])}</h2>
<ol class="passos">
{passos}
</ol><p class="fechamento">{txt(c["FECHAMENTO"])}</p></section>
<section class="faq wrap" data-block="faq" id="duvidas" aria-labelledby="faq-titulo"><h2 id="faq-titulo">{txt(c["H2 FAQ"])}</h2>
{faq}
</section>
<section class="cta-final" data-block="final-cta" aria-labelledby="cta-titulo"><div class="wrap"><h2 id="cta-titulo">{txt(c["H2 CTA FINAL"])}</h2><p>{txt(c["TEXTO CTA FINAL"])}</p>
<p class="acoes">{cta(c["ACAO PRINCIPAL FINAL"])}</p><p class="micro">{txt(c["MICROTEXTO FINAL"])}</p><p class="secundaria">{link_campo(c["ACAO SECUNDARIA"], "acao-texto")}</p></div></section>
</main>
{RODAPE}<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/contato-flutuante.js" defer></script>
<script src="../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../assets/js/site-analytics.mjs"></script>
</body></html>
'''
    # Fidelidade: cada campo da copy aparece literalmente no HTML (SEO no <head>, o resto no texto da página).
    cabeca = html.unescape(re.search(r"<head>[\s\S]*?</head>", pagina).group(0))
    miolo = html.unescape(re.sub(r"<[^>]+>", "", re.search(r"<main[\s\S]*?</main>", pagina).group(0)))
    miolo = re.sub(r"\s+", " ", miolo)
    for rotulo, valor in c.items():
        esperado = so_texto(valor, rotulo)
        alvo = cabeca if rotulo in ("TITULO SEO", "DESCRICAO SEO") else miolo
        assert re.sub(r"\s+", " ", esperado) in re.sub(r"\s+", " ", alvo), f"valor da copy ausente no HTML: {rotulo}"
    assert pagina.count(f'href="{CTA_HREF}">Calcular minha estimativa</a>') == 2, "os dois CTAs devem abrir a estimativa da rota build"
    assert 'id="construir"' in pagina and 'id="ampliar"' in pagina, "âncoras #construir e #ampliar"
    return pagina


def main() -> int:
    texto = COPY.read_bytes().decode("utf-8").replace("\r\n", "\n")
    pagina = montar(texto)
    if "--check" in sys.argv[1:]:
        atual = SAIDA.read_bytes().decode("utf-8").replace("\r\n", "\n") if SAIDA.exists() else None
        if atual != pagina:
            print(f"DIVERGE: {SAIDA.relative_to(REPO).as_posix()} não corresponde ao que a fonte gera. Rode scripts/gerar-construir-ou-ampliar-v02.py.")
            return 1
        print(f"OK: {SAIDA.relative_to(REPO).as_posix()} corresponde à fonte (SHA-256 da copy {hashlib.sha256(texto.encode('utf-8')).hexdigest()[:12]}…).")
        return 0
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(pagina)
    print(f"Gerado {SAIDA.relative_to(REPO).as_posix()} a partir de {COPY.relative_to(REPO).as_posix()}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

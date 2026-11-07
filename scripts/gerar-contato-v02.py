#!/usr/bin/env python3
"""Gera contato/index.html (página Contato V02) a partir da copy aprovada.

Fonte única do texto: docs/arquivo/contato-v02-20261103/COPY_CONTATO_V03_20261103.md
Saída (a única): contato/index.html

Uso:
    python scripts/gerar-contato-v02.py            # grava contato/index.html
    python scripts/gerar-contato-v02.py --check    # não grava; falha se o arquivo difere do que a fonte gera

Regras:
- Só biblioteca padrão. Mesma entrada, mesmo HTML (sem data, sem aleatoriedade, fim de linha LF).
- O texto da página vem só da copy; o HTML nunca é editado à mão. O gerador confere que cada campo da copy
  aparece literalmente no HTML (escapado) e que a copy não traz campo a mais nem a menos.
- Destinos (wa.me, tel:, mailto:, redes) saem dos valores da própria copy ou da tabela DESTINOS_FIXOS abaixo.
- Cabeçalho, menu e rodapé são os componentes V02 já publicados (Serviços e páginas de projeto), sem redação nova.
"""
from __future__ import annotations

import hashlib
import html
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COPY = REPO / "docs/arquivo/contato-v02-20261103/COPY_CONTATO_V03_20261103.md"
SAIDA = REPO / "contato/index.html"
ORIGEM = "https://demelloeng.com.br"

CAMPOS = (
    "TITULO SEO", "DESCRICAO SEO", "IDENTIFICACAO DA PAGINA", "H1", "TEXTO DE ABERTURA", "ACAO PRINCIPAL", "ACAO SECUNDARIA",
    "H2 CANAIS", "RESPONSAVEL", "CREDENCIAL",
    "GRUPO PRINCIPAL", "TELEFONE PRINCIPAL", "ACAO WHATSAPP", "ACAO LIGAR",
    "GRUPO OUTROS", "ROTULO TELEFONE ADICIONAL", "TELEFONE ADICIONAL", "ROTULO EMAIL", "EMAIL",
    "GRUPO REDES", "REDE INSTAGRAM", "REDE FACEBOOK", "REDE LINKEDIN",
    "H2 ESTIMATIVA", "TEXTO ESTIMATIVA", "ACAO ESTIMATIVA",
    "H2 DOCUMENTOS", "TEXTO DOCUMENTOS", "H2 SEDE", "SEDE", "ATENDIMENTO",
)
# Destinos das redes (confirmados por Marcos; o Facebook, com URL personalizada, na IT039).
REDES = (
    ("REDE INSTAGRAM", "instagram", "https://www.instagram.com/demelloeng/"),
    ("REDE FACEBOOK", "facebook", "https://www.facebook.com/demelloeng/"),
    ("REDE LINKEDIN", "linkedin", "https://www.linkedin.com/company/demello-engenharia/"),
)
WHATSAPP = "https://wa.me/5541985124056"  # mesmo destino do menu e do rodapé; o teste commercial_site só admite este

# JSON-LD vigente da página, preservado byte a byte.
JSONLD = ('{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,'
          '"name":"Início","item":"https://demelloeng.com.br/"},{"@type":"ListItem","position":2,"name":"Contato",'
          '"item":"https://demelloeng.com.br/contato/"}]}]}')

# Ícones: SVGs inline desenhados para esta página (autoria própria; sem arquivo, CDN, biblioteca ou licença de terceiros).
# Traço e preenchimento em currentColor. São decorativos (aria-hidden): o nome acessível do link vem do texto.
_SVG = '<svg class="icone" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">{}</svg>'
_TRACO = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"'
ICONES = {
    "whatsapp": _SVG.format(
        f'<path d="M3.2 20.8l1.5-4.6A8.7 8.7 0 1 1 8 19.5z" {_TRACO}/>'
        '<path d="M9.2 7.9c-.4.4-.7 1-.5 1.8.5 2 3.4 4.9 5.7 5.6.8.2 1.4-.1 1.8-.6l.3-.7-1.9-1-.8.6c-.9-.3-2.4-1.8-2.8-2.7l.6-.8-1-1.9z" fill="currentColor"/>'),
    "telefone": _SVG.format(
        f'<path d="M6.9 3.5l2.6.6 1.1 3.3-1.8 1.4a11 11 0 0 0 5.4 5.4l1.4-1.8 3.3 1.1.6 2.6c.1 1-.7 1.9-1.7 2C10.700 18.500 5.500 13.300 4.900 5.200c.1-1 .9-1.800 2-1.700z" {_TRACO}/>'),
    "instagram": _SVG.format(
        '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/>'),
    "facebook": _SVG.format(
        '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        '<path d="M13.2 20.9v-6.7h2.2l.4-2.6h-2.6V10c0-.8.3-1.3 1.4-1.3h1.3V6.4c-.3 0-1.1-.1-2-.1-2 0-3.3 1.2-3.3 3.4v1.9H8.4v2.6h2.2v6.7z" fill="currentColor"/>'),
    "linkedin": _SVG.format(
        '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        '<circle cx="8.2" cy="8.3" r="1.3" fill="currentColor"/><rect x="7.2" y="10.6" width="2" height="6.4" fill="currentColor"/>'
        '<path d="M11.3 10.6h1.9v.9c.5-.7 1.2-1.1 2.2-1.1 1.9 0 2.6 1.2 2.6 3.1V17h-2v-3.1c0-1-.3-1.6-1.2-1.6s-1.5.7-1.5 1.7V17h-2z" fill="currentColor"/>'),
}

# Menu V02 (mesmo de Serviços e das páginas de projeto); aqui o item atual é "Contato".
MENU = ('<a href="../">Início</a><a href="../servicos/">Serviços</a><a href="../experiencia-tecnica/">Projetos</a>'
        '<a href="../metodologia/">Como trabalhamos</a><a href="../contato/" aria-current="page">Contato</a>'
        '<a class="nav-build" href="../construir-ou-ampliar/">Construir ou ampliar</a>'
        '<a class="nav-budget" href="../orcamento/">Calcular estimativa</a>'
        '<a class="nav-extra nav-whatsapp" href="https://wa.me/5541985124056" target="_blank" rel="noopener">WhatsApp</a>')

# Rodapé V02 compartilhado (idêntico ao de servicos/index.html; o teste commercial_site compara os rodapés).
RODAPE = '''<footer class="site-footer rodape"><div class="wrap rodape-grade">
<div class="rodape-marca"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="230" height="67"><p class="tag">projetos possíveis, planos reais</p>
<p class="legal">Marcos de Mello Silva Engenharia LTDA<br>CNPJ 65.613.230/0001-71<br>CREA-PR PJ nº 92585<br>Responsável técnico: CREA-PR 146906/D</p></div>
<nav class="rodape-col" aria-label="Rodapé"><p class="t">Navegação</p><a href="../">Início</a><a href="../servicos/">Serviços</a><a href="../experiencia-tecnica/">Projetos</a><a href="../metodologia/">Como trabalhamos</a><a href="../empresa/">Empresa</a><a href="../empresa/trajetoria-do-fundador.html">Trajetória do fundador</a><a href="../contato/">Contato</a><a href="../privacidade/">Privacidade</a></nav>
<div class="rodape-col"><p class="t">Contato</p><a href="mailto:marcos@demelloeng.com.br">marcos@demelloeng.com.br</a><a href="tel:+5541985124056">(41) 98512-4056</a><a href="tel:+5544998202552">(44) 99820-2552</a><a href="https://wa.me/5541985124056">WhatsApp</a><a href="https://www.instagram.com/demelloeng/" target="_blank" rel="noopener">Instagram</a><a href="https://www.facebook.com/demelloeng/" target="_blank" rel="noopener">Facebook</a><a href="https://www.linkedin.com/company/demello-engenharia/" target="_blank" rel="noopener">LinkedIn</a></div>
<div class="rodape-col"><p class="t">Onde estamos</p><span>R. Pedro Ivo, 730, Centro</span><span>Curitiba/PR · CEP 80010-020</span><span>Atendimento em todo o Brasil</span></div>
</div><div class="wrap rodape-barra"><p>© 2026 Marcos de Mello Silva Engenharia LTDA</p><p class="sa-badge-wrap" style="margin:14px 0 0"><a class="sa-badge" href="https://www.simpleanalytics.com?utm_source=demelloeng.com.br&amp;utm_content=badge" referrerpolicy="origin" target="_blank"><img src="/assets/images/simple-analytics-badge.svg" width="126" height="30" alt="Simple Analytics" loading="lazy"></a></p></div></footer>'''

esc = lambda s: html.escape(s, quote=True)


def ler_copy(texto: str) -> dict[str, str]:
    """Lê `ROTULO: valor` (uma linha por campo). Recusa campo desconhecido, repetido, vazio ou ausente."""
    campos: dict[str, str] = {}
    for linha in texto.split("\n"):
        if not linha.strip():
            continue
        rotulo, _, valor = linha.partition(":")
        rotulo, valor = rotulo.strip(), valor.strip()
        if rotulo == "RODAPE":
            continue
        assert rotulo in CAMPOS, f"campo desconhecido na copy: {rotulo!r}"
        assert rotulo not in campos, f"campo repetido na copy: {rotulo!r}"
        assert valor, f"campo vazio na copy: {rotulo!r}"
        campos[rotulo] = valor
    assert set(campos) == set(CAMPOS), f"campos ausentes: {sorted(set(CAMPOS) - set(campos))}"
    return campos


def digitos(telefone: str) -> str:
    d = re.sub(r"\D", "", telefone)
    assert re.fullmatch(r"\d{11}", d), f"telefone fora do padrão (DDD + 9 dígitos): {telefone!r}"
    return d


def mailto(valor: str) -> str:
    assert re.fullmatch(r"[^@\s]+@demelloeng\.com\.br", valor), valor
    return f"mailto:{valor}"


def montar(texto_copy: str) -> str:
    c = ler_copy(texto_copy)
    sha = hashlib.sha256(texto_copy.encode("utf-8")).hexdigest()
    titulo, descricao = esc(c["TITULO SEO"]), esc(c["DESCRICAO SEO"])
    url = f"{ORIGEM}/contato/"
    principal = c["TELEFONE PRINCIPAL"]
    wa = f"https://wa.me/55{digitos(principal)}"
    assert wa == WHATSAPP, "o número principal da copy diverge do destino de WhatsApp publicado no menu e no rodapé"
    tel_principal = f"tel:+55{digitos(principal)}"
    adicional = c["TELEFONE ADICIONAL"]
    redes = "\n".join(
        f'<li><a class="rede" href="{href}" target="_blank" rel="noopener">{ICONES[icone]}<span>{esc(c[campo])}</span></a></li>'
        for campo, icone, href in REDES
    )
    pagina = f'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<!-- Gerado por scripts/gerar-contato-v02.py. Fonte da copy: {COPY.relative_to(REPO).as_posix()} (SHA-256 {sha}). Não editar à mão: altere a fonte e gere de novo. -->
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
<link rel="stylesheet" href="../assets/css/contato-v02.css?v=1">
<script type="application/ld+json">{JSONLD}</script>
</head>
<body class="servicos-v02 contato-v02"><a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="site-header"><div class="wrap header-inner"><a class="logo" href="../"><img src="../assets/images/logo-branca.png" alt="DEMELLO Engenharia" width="760" height="220"></a><button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Principal">{MENU}</nav></div></header>
<main id="conteudo">
<section class="hero wrap" data-block="contact-hero"><div><p class="eyebrow">{esc(c["IDENTIFICACAO DA PAGINA"])}</p><h1>{esc(c["H1"])}</h1></div><div class="hero-copy"><p>{esc(c["TEXTO DE ABERTURA"])}</p>
<p class="acoes"><a class="acao acao-principal" href="{WHATSAPP}" target="_blank" rel="noopener">{esc(c["ACAO PRINCIPAL"])}</a><a class="acao acao-secundaria" href="../orcamento/">{esc(c["ACAO SECUNDARIA"])}</a></p></div></section>
<section class="canais wrap" data-block="contact-channels" aria-labelledby="canais-titulo"><div class="canais-resp"><h2 id="canais-titulo">{esc(c["H2 CANAIS"])}</h2><p class="resp-nome">{esc(c["RESPONSAVEL"])}</p><p class="resp-credencial">{esc(c["CREDENCIAL"])}</p></div>
<div class="canais-lista">
<div class="canal-grupo canal-principal"><h3>{esc(c["GRUPO PRINCIPAL"])}</h3><p class="fone-principal">{esc(principal)}</p>
<p class="canal-acoes"><a class="canal-acao canal-acao-wa" href="{wa}" target="_blank" rel="noopener" aria-label="{esc(c["ACAO WHATSAPP"])}: {esc(principal)}">{ICONES["whatsapp"]}<span>{esc(c["ACAO WHATSAPP"])}</span></a><a class="canal-acao canal-acao-tel" href="{tel_principal}" aria-label="{esc(c["ACAO LIGAR"])}: {esc(principal)}">{ICONES["telefone"]}<span>{esc(c["ACAO LIGAR"])}</span></a></p></div>
<div class="canal-grupo"><h3>{esc(c["GRUPO OUTROS"])}</h3>
<dl class="outros"><div class="canal"><dt>{esc(c["ROTULO TELEFONE ADICIONAL"])}</dt><dd><a href="tel:+55{digitos(adicional)}">{esc(adicional)}</a></dd></div>
<div class="canal"><dt>{esc(c["ROTULO EMAIL"])}</dt><dd><a href="{esc(mailto(c["EMAIL"]))}">{esc(c["EMAIL"])}</a></dd></div></dl></div>
<div class="canal-grupo"><h3>{esc(c["GRUPO REDES"])}</h3>
<ul class="redes">
{redes}
</ul></div>
</div></section>
<div class="orientacao" data-block="estimate-and-documents"><div class="wrap orientacao-grade"><section class="orientacao-bloco" data-block="estimate" aria-labelledby="estimativa-titulo"><h2 id="estimativa-titulo">{esc(c["H2 ESTIMATIVA"])}</h2><p>{esc(c["TEXTO ESTIMATIVA"])}</p><p><a class="acao-texto" href="../orcamento/">{esc(c["ACAO ESTIMATIVA"])} →</a></p></section>
<section class="orientacao-bloco" data-block="documents" aria-labelledby="documentos-titulo"><h2 id="documentos-titulo">{esc(c["H2 DOCUMENTOS"])}</h2><p>{esc(c["TEXTO DOCUMENTOS"])}</p></section></div></div>
<section class="sede wrap" data-block="headquarters" aria-labelledby="sede-titulo"><h2 id="sede-titulo">{esc(c["H2 SEDE"])}</h2>
<dl class="sede-lista"><div class="canal"><dt>Sede</dt><dd>{esc(c["SEDE"])}</dd></div><div class="canal"><dt>Atendimento</dt><dd>{esc(c["ATENDIMENTO"])}</dd></div></dl></section>
</main>
{RODAPE}<script src="../assets/js/nav.js" defer></script>
<script src="../assets/js/analytics-sink.js" defer></script>
<script src="../assets/js/contato-flutuante.js" defer></script>
<script src="../assets/js/meta-pixel.js" defer></script>
<script type="module" src="../assets/js/site-analytics.mjs"></script>
</body></html>
'''
    # Fidelidade: cada valor da copy aparece literalmente (escapado) no HTML gerado.
    for rotulo, valor in c.items():
        assert esc(valor) in pagina, f"valor da copy ausente no HTML: {rotulo}"
    # O telefone principal aparece UMA vez como texto visível do <main> (os dois destinos ficam em href e aria-label).
    miolo = re.sub(r"<[^>]+>", " ", re.search(r"<main[\s\S]*?</main>", pagina).group(0))
    assert miolo.count(principal) == 1, "o telefone principal deve aparecer uma única vez no texto visível"
    return pagina


def main() -> int:
    texto = COPY.read_bytes().decode("utf-8").replace("\r\n", "\n")
    pagina = montar(texto)
    if "--check" in sys.argv[1:]:
        atual = SAIDA.read_bytes().decode("utf-8").replace("\r\n", "\n") if SAIDA.exists() else None
        if atual != pagina:
            print(f"DIVERGE: {SAIDA.relative_to(REPO).as_posix()} não corresponde ao que a fonte gera. Rode scripts/gerar-contato-v02.py.")
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

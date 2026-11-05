# DEMELLO Engenharia: site

## Codebase Overview

Site estático da DEMELLO Engenharia (GitHub Pages, `demelloeng.com.br`) com uma calculadora de estimativa em React 19 + Vite em `/orcamento/`. Páginas de serviço, Contato e Construir ou ampliar saem de geradores Python a partir de copy versionada; Home, catálogo e páginas institucionais são HTML escrito à mão. A publicação é por allowlist fechada e um push na `main` publica.

**Stack**: HTML/CSS/JS estático, Python 3 (geradores), three.js 0.160.0 hospedado (maquetes 3D), React 19 + Vite 6 (calculadora), `node --test` (23 arquivos, 370 casos), GitHub Actions.
**Structure**: `servicos/`, `contato/`, `construir-ou-ampliar/` e demais páginas na raiz; `assets/` (css, js, models, vendor); `scripts/` (geradores); `orcamento-src/` (fonte e testes) e `orcamento/` (bundle compilado, não editar); `docs/` (copys, mapa, SEO); `.github/pages/` (allowlist e montagem do artefato).

Para a arquitetura detalhada, o inventário das 21 páginas (11 já no layout V02), os perfis de página, as armadilhas e o guia de navegação, veja [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md). Regras principais: texto de página nunca se edita no HTML (copy, depois gerador); a allowlist é fechada; menu e rodapé V02 vivem em cinco lugares; `scripts/gerar-servicos-v02.py` regera o catálogo com menu e rodapé V02 (conferido por teste), mas não tem `--check`.

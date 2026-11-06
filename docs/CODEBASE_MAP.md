---
last_mapped: 2026-11-04T20:32:29Z
total_files: 207
total_tokens: 568758
commit: 3df7e53
branch: main
---

# Mapa do código: site da DEMELLO Engenharia

> **Documento canônico do site (decisão de Marcos, 30/10/2026).** Fica no repositório, versionado junto com o código. **Toda mudança estrutural no site muda este mapa na mesma entrega:** página nova, serviço renomeado ou agrupado, script novo, teste novo, arquivo na allowlist, mudança de menu, de rodapé ou de publicação. A skill `gerar-pagina-servico` inclui esse passo. Para atualizar, rodar o Cartographer em modo de atualização (ele reaproveita o que não mudou).

> **Atualização de 06/11/2026 (frente Compatibilização BIM V02, issue #15, branch `claude/compatibilizacao-bim-v02` sobre a `main` `cc21ef2`).** `/servicos/compatibilizacao-bim/` passou do layout antigo, à mão, para o layout rico gerado, com o perfil novo `compatibilizacao` (copy `COPY_COMPATIBILIZACAO_BIM_V02_20261106.md`; módulos `copy_compatibilizacao.py` e `layout_compatibilizacao.py`, CSS `servico-compatibilizacao-v02.css`, teste `test_compatibilizacao.py`, passo próprio no `pages.yml`). Nove seções, sem grupo recolhível: os detalhes do escopo ficam visíveis. URL, canonical, `og:url`, o JSON-LD (Service "Compatibilização BIM" e BreadcrumbList; só a descrição acompanha a copy) e o identificador da calculadora (`servico=compatibilizacao`) não mudam. Links contextuais para `/metodologia/` e `/servicos/orcamento-tecnico/`. Inventário: 21 páginas HTML, **13 no V02 e 8 antigas**. O catálogo não mudou (o cartão integrado é etapa própria). Artefato esperado: 144 arquivos. Onde as seções abaixo falarem de 12 páginas V02 ou de Compatibilização BIM como página antiga, vale esta nota. O mapa não foi regerado pelo Cartographer.
>
> **Atualização de 05/11/2026 (frente Orçamento e cronograma V02, issue #15, branch `feat/orcamento-cronograma-v02-revisao-local` sobre a `main` `99083c2`).** `/servicos/orcamento-tecnico/` passou do layout antigo, à mão, para o layout rico gerado, com o perfil novo `orcamento` (copy `COPY_ORCAMENTO_CRONOGRAMA_V02_20261105.md`, que substitui a V01 só na prova técnica, para a metragem aparecer uma vez; módulos `copy_orcamento.py` e `layout_orcamento.py`, CSS `servico-orcamento-v02.css`, teste `test_orcamento.py`). URL, canonical, `og:url` e o identificador da calculadora (`servico=orcamento-tecnico`) não mudam; o Service do JSON-LD passa a se chamar "Orçamento e cronograma" (decisão 75). Inventário: 21 páginas HTML, **12 no V02 e 9 antigas**. Compatibilização BIM segue no layout antigo e o catálogo não mudou (o cartão integrado fica para quando as duas páginas estiverem prontas). Artefato esperado: 143 arquivos. Onde as seções abaixo falarem de 11 páginas V02 ou de Orçamento como página antiga, vale esta nota. O mapa não foi regerado pelo Cartographer.
>
> **Atualização de 05/11/2026 (frente Regularização V02, issue #16, branch `claude/regularizacao-v02` sobre a `main` `dcd385f`).** `/servicos/regularizacao/` passou do layout antigo, à mão, para o layout rico gerado, com o perfil novo `regularizacao` (copy `COPY_REGULARIZACAO_V02_20261105.md`, módulos `copy_regularizacao.py` e `layout_regularizacao.py`, CSS `servico-regularizacao-v02.css`, teste `test_regularizacao.py`). Inventário: 21 páginas HTML, **11 no V02 e 10 antigas**. Onde as seções abaixo falarem de Regularização como página antiga ou de 10 páginas V02, vale esta nota. Verificado nesta data na branch: `npm test` 370 de 370; artefato de 142 arquivos com G2-G5 e smoke local PASS; `unittest` de `test_pscip_glp.py` e de `test_regularizacao.py` (5 casos cada) passam. O mapa não foi regerado pelo Cartographer.
>
> **Atualização de 05/11/2026 (frente PSCIP + GLP V02, PR sobre a `main` `c6541bd`).** Incorpora a `main` após o PR #45 (404 do aço corrigido), as duas páginas novas no layout rico (`projeto-prevencao-incendio` e `projeto-gas-glp`, com a maquete de hidrantes do Colégio Luiz Carlos), o catálogo com 8 cartões e os testes novos. Verificado nesta data na cópia da candidata: `npm test` 370 de 370, `unittest` 5 de 5, artefato de 141 arquivos (G2-G5 e smoke local PASS). Onde as seções abaixo disserem "04/11", vale esta nota quando houver conflito.
>
> **Atualização pelo Cartographer em 2026-11-04T20:32:29Z** (modo atualização sobre a `main` `3df7e53`, merge do PR #44, 04/11/2026). Quatro leituras em paralelo: scripts e publicação; testes; páginas, CSS e JS; docs, modelos e vendor. **Execução:** só a suíte `node --test` foi rodada (364 de 364 passam). Geradores, build e smoke não foram executados. Esta atualização incorpora e substitui as notas dirigidas de 02, 03 e 04/11, e reescreve as seções 2, 8, 9, 11 e 13. Contagens do cabeçalho: 207 arquivos lidos pelo scanner (binários e arquivos grandes fora); o Git rastreia 291.
> Onde um número não foi conferido por comando, o texto diz.

## 1. Visão geral

O repositório guarda **duas coisas** que se publicam juntas:

1. **O site estático** (HTML escrito à mão ou gerado por script), com CSS, JS de página e modelos 3D.
2. **A calculadora de estimativa** (`/orcamento/`), um app React 19 + Vite cujo fonte está em `orcamento-src/` e cujo resultado compilado fica em `orcamento/` (artefato versionado).

A publicação é por **GitHub Pages**: um push na `main` roda o workflow, que monta o artefato **só com os arquivos listados na allowlist**. Não existe etapa de aprovação.

```mermaid
graph TB
    subgraph Texto
        COPY["copy central<br/>docs/arquivo/paginas-servico-v02/copy/*.md"]
        JSONANT["<slug>.json<br/>texto antigo protegido"]
        COPYJSON["<slug>.copy.json<br/>texto novo estruturado"]
    end
    subgraph Geracao
        IMP["importar-copy-servico-v02.py"]
        GER["gerar-paginas-servico-v02.py"]
        LAY["layout_rico.py"]
        CONF["conferir-paginas-servico-v02.py"]
    end
    subgraph Saida
        HTML["servicos/<slug>/index.html"]
        MAQ["maquete 3D<br/>assets/js + assets/models"]
    end
    subgraph Calculadora
        SRC["orcamento-src/src"]
        BUILD["pnpm build"]
        DIST["orcamento/ (bundle versionado)"]
    end
    subgraph Publicacao
        ALLOW[".github/pages/allowlist.txt"]
        WF[".github/workflows/pages.yml"]
        PAGES["GitHub Pages<br/>demelloeng.com.br"]
    end
    COPY --> IMP --> COPYJSON
    JSONANT --> GER
    COPYJSON --> GER
    LAY --> GER
    GER --> HTML
    HTML --> CONF
    MAQ --> HTML
    SRC --> BUILD --> DIST
    HTML --> ALLOW
    DIST --> ALLOW
    ALLOW --> WF --> PAGES
```

**Regra central:** página de serviço nunca se edita à mão. O texto sai da copy; o HTML sai do gerador.

## 2. Estrutura de diretórios

```
site/
├── index.html                  Home V02 (à mão)
├── 404.html                    Página de erro (caminhos absolutos, noindex)
├── CNAME  robots.txt  sitemap.xml  google1483671950bc0cbc.html
├── .mcp.json                   Playwright MCP (npx @playwright/mcp@latest; não testado)
├── .claude/                    settings.json (1 hook), hooks/pos_gerar.py, agents/revisor-copy.md, skills/gerar-pagina-servico
├── .github/
│   ├── workflows/pages.yml     Deploy (push na main; 3 jobs)
│   └── pages/                  allowlist.txt e build_artifact.py
├── assets/
│   ├── css/                    16 folhas (seção 5)
│   ├── js/                     11 arquivos: medição, navegação, 4 maquetes e three-d-stage
│   ├── models/                 10 arquivos, 4.811.345 bytes (seção 4)
│   ├── vendor/three/           three.js 0.160.0 hospedado
│   ├── images/                 41 arquivos (logos, renders do Djalma, armadura, heros, fundador)
│   ├── icons/                  13 SVG (9 em servicos-v02/, 4 situacao-*)
│   ├── fonts/                  9 arquivos (Source Sans 3, Montserrat, Special Elite e licenças)
│   └── videos/                 3 MP4, cerca de 16,3 MB
├── servicos/
│   ├── index.html              Catálogo V02 com 8 cartões (gerado por `gerar-servicos-v02.py` a partir de `docs/arquivo/servicos-v01-20261028/`)
│   └── <9 slugs>/index.html    7 no layout rico (geradas); 2 no layout antigo (à mão)
├── contato/  construir-ou-ampliar/       Geradas por gerador próprio (cada uma com `--check`)
├── avaliar-um-problema/  metodologia/  experiencia-tecnica/  empresa/  privacidade/  verificar/    À mão, layout antigo
├── orcamento/                  Bundle compilado da calculadora (não editar)
├── orcamento-src/              Fonte React/Vite + 23 arquivos de teste
├── scripts/                    12 arquivos em `scripts/`: geradores, conferência, `copy_pscip_glp.py`, `test_pscip_glp.py`, conversor IFC→GLB e 2 scripts de navegador (`pscip-glp*.browser.cjs`)
└── docs/
    ├── *.md                    8 documentos (arquitetura comercial, estimativa, mensuração, CSP proposta, pendências)
    ├── arquivo/                copys, JSON de origem e candidatas arquivadas (home, servicos-v01, paginas-servico-v02, contato-v02, construir-ou-ampliar-v02)
    └── seo/20261028/           vocabulário e confronto de busca
```

### 2.1 As 21 páginas HTML

"Menu e rodapé V02" = menu com o botão `nav-build` e `footer.site-footer.rodape` com `rodape-grade` (inclui Facebook). Em todas as páginas menu e rodapé andam juntos (nenhuma mistura os dois).

| Página | Origem | Layout | Menu e rodapé |
|---|---|---|---|
| `index.html` | à mão | Home V02 (`home-opcao3`) | V02 |
| `servicos/index.html` | gerada (`gerar-servicos-v02.py`) | catálogo V02, 8 cartões | V02 |
| `servicos/projeto-arquitetura/` | gerada | rico | V02 |
| `servicos/projeto-estrutural/` | gerada | rico | V02 |
| `servicos/projeto-hidrossanitario/` | gerada | rico | V02 |
| `servicos/projeto-terraplenagem/` (Infraestrutura) | gerada (perfil `infra`) | rico | V02 |
| `servicos/projeto-prevencao-incendio/` (AVCB, PPCI/PSCIP) | gerada (perfil `pscip-glp`, com `.copy.json`) | rico, com a maquete de hidrantes | V02 |
| `servicos/projeto-gas-glp/` | gerada (perfil `gas-glp`, copy em `copy_pscip_glp.py`) | rico | V02 |
| `contato/` | gerada (`gerar-contato-v02.py`; SHA da copy no `<head>`) | V02 próprio | V02 |
| `construir-ou-ampliar/` | gerada (`gerar-construir-ou-ampliar-v02.py`) | V02 próprio | V02 |
| `servicos/compatibilizacao-bim/` | gerada (perfil `compatibilizacao`, com `.copy.json`) | rico, composição estática, sem maquete | V02 |
| `servicos/regularizacao/` | gerada (perfil `regularizacao`, com `.copy.json`) | rico, composição estática, sem maquete | V02 |
| `servicos/orcamento-tecnico/` (Orçamento e cronograma) | gerada (perfil `orcamento`, com `.copy.json`) | rico, composição estática, sem maquete | V02 |
| `avaliar-um-problema/`, `metodologia/`, `experiencia-tecnica/` | à mão | antigo (`style.css`) | antigo |
| `empresa/index.html`, `empresa/trajetoria-do-fundador.html`, `privacidade/` | à mão | antigo | antigo |
| `verificar/` | à mão | antigo, com `<style>` e `<script>` inline | antigo, sem Instagram nem LinkedIn |
| `404.html` | à mão | antigo, caminhos absolutos | antigo |

**12 páginas V02 e 9 antigas.** O menu antigo traz Início, Construir ou ampliar, Outros serviços, Experiência, Como trabalhamos, Calcular estimativa, Contato e WhatsApp. O V02 traz Início, Serviços, Projetos, Como trabalhamos, Contato, o botão Construir ou ampliar, Calcular estimativa e WhatsApp. O rodapé antigo (`footer-in`, `fcol`) não tem Facebook nem segundo telefone.

## 3. Módulo: pipeline de páginas de serviço

**Propósito:** produzir `servicos/<slug>/index.html` a partir de uma copy central versionada.
**Estado hoje:** sete páginas de serviço no layout rico: `projeto-arquitetura`, `projeto-estrutural`, `projeto-hidrossanitario`, `projeto-terraplenagem` (Infraestrutura, perfil `infra`, na `main` desde 02/11), `projeto-prevencao-incendio` (perfil `pscip-glp`, copy `COPY_PSCIP_GLP_V03_20261105.md`) e `projeto-gas-glp` (perfil `gas-glp`, sem `.copy.json`: a copy sai de `gas_copy()` em `scripts/copy_pscip_glp.py` a partir do `projeto-gas-glp.json`) e `regularizacao` (perfil `regularizacao`, copy `COPY_REGULARIZACAO_V02_20261105.md`, sem maquete: o hero é uma composição SVG estática; ramo próprio no `gerar()`, funções em `scripts/layout_regularizacao.py`). **Duas** seguem no layout antigo, à mão e sem copy nova: `compatibilizacao-bim` e `orcamento-tecnico`. Essas duas **não** saem do gerador: rodar `gerar` sobre elas as converteria para o layout simples V02 (`servicos-v02 servico-pagina-v02`), que nenhuma página usa hoje.

### 3.1 Ciclo

| Passo | Comando / arquivo | Falha típica |
|---|---|---|
| Copy nova | `copy/COPY_<SERVICO>_V<NN>_<AAAAMMDD>.md` (**arquivo novo**, nunca editar o anterior) | rótulo ausente ou fora do padrão |
| Importar | `python scripts/importar-copy-servico-v02.py <slug> <arquivo.md> "<Nome>"` | slug sem entrada nos dicionários; `LINKS` não acha o trecho |
| Gerar | `python scripts/gerar-paginas-servico-v02.py gerar <slug>` | prova técnica sem "N m²"; bloco do meio sem a linha "Orçamento e cronograma" |
| Conferir | `python scripts/conferir-paginas-servico-v02.py` (o hook roda sozinho depois do gerar) | trecho antigo protegido ausente |
| Mostrar | tela larga e 390 px, **antes de qualquer commit** | |
| Commit/push/PR/merge | cada um é uma ordem separada de Marcos | |

### 3.2 Arquivos do módulo

| Arquivo | Papel |
|---|---|
| `scripts/importar-copy-servico-v02.py` | Lê a copy `.md` e grava `<slug>.copy.json`. Só estrutura; não reescreve. Usa `assert` rígido. |
| `scripts/gerar-paginas-servico-v02.py` | Subcomandos `extrair` (lê HTML antigo via `git show`, uma vez) e `gerar`. Sem `.copy.json` gera o layout simples; com ele, o layout rico. |
| `scripts/layout_rico.py` | Funções que montam seções: `hero`, `para_quem`, `muda`, `prefeitura`, `faz`, `perguntas`, `prova`, `djalma`, `estrutura`, `mezanino_*` e, da frente PSCIP + GLP, `etapas_incendio`, `prova_instalacoes`, `hero_instalacoes`, `frente_incendio`, `frente_gas`. |
| `scripts/conferir-paginas-servico-v02.py` | Confere perda de texto. Com `.copy.json` só verifica que os **blocos antigos mantidos** estão inteiros. Para incêndio e GLP há um ramo próprio: confere que cada trecho da fonte central aparece na página, que título, descrição e CTAs batem, e que nenhuma nota editorial vazou. |
| `scripts/gerar-servicos-v02.py` | Regera `servicos/index.html` (8 cartões, com o cartão integrado de incêndio e gás) a partir de `docs/arquivo/servicos-v01-20261028/` (`conteudo.json`, `icones.json` e os templates `head`, `header` e `footer`, que reproduzem menu e rodapé V02). Deixou de estar defasado nesta frente; os `assert == 9` e os índices fixos saíram. Sem CLI e sem `--check`: sobrescreve o HTML ao rodar. |
| `docs/arquivo/paginas-servico-v02/` | `<slug>.json` (texto extraído, 9), `<slug>.copy.json` (6: arquitetura, estrutural, hidrossanitário, terraplanagem, esta com o slug `projeto-terraplenagem`, incêndio e regularização), `copy/*.md` (36 versões) e `maquete-*-markup.html` (5, incluindo `maquete-hidrantes-markup.html`). |

### 3.3 Formato da copy (rótulos)

`TITULO`, `DESCRICAO`, `H1`, `CHAMADA`, `INTRODUCAO 1`, `INTRODUCAO 2`, `PARA QUEM E`, `O QUE MUDA PARA VOCE`, o bloco do meio, `O QUE A DEMELLO FAZ`, `PERGUNTAS`, `PROXIMO PASSO`, `CTA (rotulo)`, `CTA (micro, mantido)`.

O **bloco do meio** depende do perfil:

| Perfil | Rótulo do meio | Extras obrigatórios |
|---|---|---|
| (arquitetura, sem perfil) | `PREFEITURA, APROVACAO E HABITE-SE` | nenhum |
| `estrutura` | `DA FUNDACAO A LAJE` | `EXPERIENCIA APLICADA`, `MEZANINO` |
| `hidro` | `DA CAIXA D'AGUA AO COLETOR` | `EXPERIENCIA APLICADA` |
| `infra` | `DO TERRENO NATURAL AO TERRAPLANADO` | `EXPERIENCIA APLICADA`, `PROVA TECNICA` |

Regras de formato que quebram a importação: item de "O que muda" no padrão `N. Título. Texto.`; `PERGUNTAS` em número par de linhas; `prefeitura()` exige exatamente 5 parágrafos; `estrutura()` exige uma linha com "Orçamento e cronograma" (o gancho) e só monta os cartões Básico/Executivo se houver os dois.

### 3.4 Dicionários fixos por slug no importador (editar o código para página nova)

`LAYOUTS`, `PERFIS`, `REMOVIDOS`, `IMPRENSA`, `FIGURAS`, `LINKS`. O gerador tem a lista `SLUGS` (os 9). **Página nova de serviço = editar esses dicionários.**

**Perfil `infra` (Infraestrutura):** a página **não leva estimativa** (decisão 97). Por isso o importador grava `cta.href = ../../contato/` e `jsonld_nomes` (o nome do serviço no JSON-LD muda de "Projeto de terraplenagem" para o nome novo); o bloco "Detalhes do escopo" traz só `Entregáveis` e `Como o escopo é definido` (saem `Como funciona`, que descreve a estimativa, e `Escopo e limites`, que nega a execução; o texto antigo continua intacto em `projeto-terraplenagem.json`); `layout_rico.prova_volume` mostra a prova técnica em m³ e `layout_rico.DIAGRAMA_INFRA` troca o diagrama (Terreno, Arquitetura, Drenagem). O **slug continua `projeto-terraplenagem`** (a grafia antiga só aparece em endereços; trocar o slug muda a URL e pede redirecionamento, decisão de Marcos).

### 3.5 Versionamento

Cada mudança de texto, mesmo de uma frase, gera `V<NN+1>` novo. Cada serviço tem a sua numeração (hidrossanitário V01 a V18, arquitetura V05 a V11, estrutural V01 a V06, Infraestrutura V01 e V02). Mudança transversal sai em lote, uma versão por serviço. O `.copy.json` guarda `fonte_copy`, então toda página é rastreável até o `.md`.

### 3.6 Contato V02 (gerador próprio, separado do pipeline de serviços)

`contato/index.html` **não se edita à mão**. Ciclo: alterar a copy (arquivo novo `COPY_CONTATO_V<NN>_<AAAAMMDD>.md` em `docs/arquivo/contato-v02-<data>/`, ajustando a constante `COPY` do gerador) → `python scripts/gerar-contato-v02.py` → `python scripts/gerar-contato-v02.py --check` (falha se o HTML diverge da fonte) → mostrar em 1440×900 e 390×844 antes de qualquer commit.

| Arquivo | Papel |
|---|---|
| `docs/arquivo/contato-v02-20261103/COPY_CONTATO_V03_20261103.md` | Copy vigente (IT032 + ajuste dos canais da IT039: telefone principal uma vez com WhatsApp e Ligar, outros contatos, Instagram, Facebook e LinkedIn). Um campo por linha. A `COPY_CONTATO_V02_20261103.md` fica preservada. |
| `scripts/gerar-contato-v02.py` | Só biblioteca padrão; recusa campo a mais ou a menos; confere que cada valor da copy aparece no HTML; grava o SHA-256 da copy num comentário do `<head>`; saída com fim de linha LF, idêntica em duas gerações. Cabeçalho, menu, JSON-LD e rodapé V02 são constantes do gerador, assim como os cinco ícones (SVG inline de autoria própria, sem arquivo, CDN nem licença de terceiros). |
| `assets/css/contato-v02.css` | CSS pequeno, escopo `.contato-v02`; o resto vem de `servicos-v02.css` e `rodape-v02.css`. |

Não usa `gerar-paginas-servico-v02.py` nem `layout_rico.py`. O rodapé é o mesmo das seis páginas lançadas (o teste `commercial_site` compara oito rodapés). Os links de contato da página ficam fora de `.topbar`, `.nav`, `.site-footer` e `.cta-band`, para o evento sair com a posição `contact_page`.

### 3.7 Construir ou ampliar V02 (gerador próprio, no padrão da Contato)

`construir-ou-ampliar/index.html` **não se edita à mão**. Ciclo: copy nova (`COPY_CONSTRUIR_OU_AMPLIAR_V<NN>_<AAAAMMDD>.md`, arquivo novo; ajustar a constante `COPY`) -> `python scripts/gerar-construir-ou-ampliar-v02.py` -> `--check` -> mostrar em 1440x900 e 390x844 antes de qualquer commit.

| Arquivo | Papel |
|---|---|
| `docs/arquivo/construir-ou-ampliar-v02-20261104/COPY_CONSTRUIR_OU_AMPLIAR_V01_20261104.md` | Copy aprovada (uma linha por campo; links na copy: `[rótulo -> /caminho/]`). |
| `scripts/gerar-construir-ou-ampliar-v02.py` | Só biblioteca padrão; recusa campo a mais ou a menos; confere que cada campo da copy aparece no HTML; exige os dois CTAs `../orcamento/?situacao=build` e as âncoras `#construir` e `#ampliar`. Menu (com o botão como item atual), JSON-LD e rodapé são constantes. |
| `assets/css/construir-ou-ampliar-v02.css` | CSS isolado (`.construir-v02`); o resto vem de `servicos-v02.css` e `rodape-v02.css`. FAQ em `<details>`; passos em `<ol>` com contador por CSS (o teste de numerais não admite dígitos soltos). |

O menu e o rodapé V02 vivem em **cinco lugares**: `gerar-paginas-servico-v02.py` (4 páginas de projeto), `gerar-contato-v02.py`, `gerar-construir-ou-ampliar-v02.py`, e à mão na Home e em `servicos/index.html`. Os testes `commercial_site` (menu idêntico e rodapé idêntico nas oito páginas V02, Facebook em ordem) e `hotfix` impedem divergência. Não existe módulo compartilhado de propósito: o conjunto é pequeno e fechado.

### 3.8 Onde ficam os ramos por perfil (para criar um perfil novo)

Os números de linha são da leitura de 04/11; confira antes de editar.

| Arquivo | Onde | O que decide |
|---|---|---|
| `importar-copy-servico-v02.py` | L19, L23, L33-35, L51 | `REMOVIDOS`, `IMPRENSA`, `LAYOUTS`, `PERFIS`, `FIGURAS`, `LINKS` por slug |
| | L65-67 | rótulo do bloco do meio e extras obrigatórios por perfil (`infra` = `EXPERIENCIA APLICADA` + `PROVA TECNICA`) |
| | L117-130, L141-152, L161-166 | `exp`, `prova`, `mez`, `cta.href`, `jsonld_nomes` (só `infra`), `blocos_novos` e "Detalhes do escopo" por perfil |
| `gerar-paginas-servico-v02.py` | L205-207 | `estrutura_pg` (vale para `estrutura`, `hidro` e `infra`), `hidro_pg`, `infra_pg` |
| | L208 | arquivo `maquete-*-markup.html` (ternário encadeado) |
| | L209-211, L216-217 | bloco do meio, prova técnica (rótulo "estrutural"/"hidrossanitária" fixo), diagrama e experiência |
| | L219-228 | CSS e JS com `?v=` fixo no código, classe do `<body>` por perfil |
| `layout_rico.py` | funções | `hero`, `para_quem`, `muda`, `prefeitura`, `faz`, `perguntas`, `prova`, `prova_volume`, `djalma`, `estrutura`, `mezanino_*` |

Falhas silenciosas ou obscuras: slug novo sem entrada em `LAYOUTS` ou `PERFIS` cai em layout `simples`/perfil `casa` **sem erro**; `prefeitura()` exige 5 parágrafos; `estrutura()` faz `next()` sem padrão e quebra se faltar a linha "Orçamento e cronograma"; `prova_volume()` quebra se a copy não trouxer "N m³ de"; `prova()` descarta o **último** parágrafo; o link de `LINKS` vale só na 1ª ocorrência da página. O `gerar` sem argumento só imprime a ajuda (seguro); o `importar` exige 3 argumentos. A docstring do importador fala em `.txt`, mas o código usa `.md`.

### 3.9 O que o hook, o CI e as ferramentas do repositório cobrem

- O hook `.claude/hooks/pos_gerar.py` só dispara com `gerar-paginas-servico-v02.py ... gerar`. Não cobre Contato, Construir ou ampliar, catálogo nem o `importar`.
- `conferir-paginas-servico-v02.py` só olha o `<main>`: não vê menu, rodapé nem `<head>`; com `.copy.json` não confere o texto novo; sem copy compara com `HEAD` (rodar depois de commitar compara a página com ela mesma).
- O `--check` de `gerar-contato-v02.py` e de `gerar-construir-ou-ampliar-v02.py` **não roda no CI nem em hook**: divergência entre HTML e copy dessas duas páginas não reprova o deploy.
- `.claude/agents/revisor-copy.md` lê a Voz e os termos medidos em caminhos de Windows fora do repositório (`C:\Users\mms_e\Documents\DEMELLO_ENGENHARIA\...`) e só trata página de serviço.
- `.claude/skills/gerar-pagina-servico` cita o clone `MA_DEMELLO_PILOTO` e `otimizar_ifc.py` (que não existe aqui), não conhece o perfil `infra` nem os dois geradores novos, e manda rodar o Cartographer no passo 7.
- `ifc_para_glb_hidro.py <ifc> <saida>` só serve para hidro, exige numpy, trimesh e ifcopenshell, não valida `argv` e aborta se o GLB passar de 2.000 KB. A maquete da Infraestrutura não tem conversor neste repositório.

## 4. Módulo: maquete 3D

**Propósito:** visualizador three.js (montagem de baixo para cima, separar camadas, raio-X, ficha por peça, vistas) dentro de uma caixa que abre em tela cheia.

| Página | JS | Modelo | CSS próprio |
|---|---|---|---|
| Arquitetura | `maquete-3d.js` (sem `?v`) | `casa-exemplo.glb` (sem JSON) | nenhum além da base |
| Estrutural | `maquete-estrutura-3d.js?v=6` | `estrutura-concreto` e `estrutura-aco` (`.glb` + `.json`) | `servico-estrutural-v02.css?v=4` |
| Hidrossanitário | `maquete-hidro-3d.js?v=10` | `hidro-casa.glb` + `.json` | `servico-hidro-v02.css?v=4` |
| Incêndio (hidrantes, Colégio Luiz Carlos) | `hidrantes-luiz-carlos-ativar.js?v=1` (ativação sob demanda, com pôster e `noscript`) importa `hidrantes-luiz-carlos-v02.js` e `hidrantes-luiz-carlos-core.mjs` | `hidrantes-luiz-carlos-v02.glb` (1.857.508 bytes, 171 peças identificadas) + `.json` | `hidrantes-luiz-carlos-v02.css`, `servico-pscip-glp-v02.css`; o catálogo usa `catalogo-pscip-glp-v02.css` |
| Infraestrutura | `maquete-terraplanagem-3d.js?v=1` | `terraplanagem-djalma.glb` (683.412 bytes) + `.json` (666 bytes), na allowlist | `servico-infra-v02.css?v=1` |

- **Contrato do JSON de identidade:** `{padrao, pavimentos[], rotulos?, legenda?, grupos:{<camada>:[[nome, iPavimento, primeiraFace, nFaces, detalhe?]]}}`. A ficha acha a peça por **busca binária no índice de face**; por isso a ordem do JSON tem de casar com o GLB.
- **Cor:** estrutural pinta pela cor da camada; hidro usa **cor por vértice** gravada no GLB (cores do IFC original) e injeta brilho via `onBeforeCompile`; arquitetura usa paleta por nome de malha.
- **Conversor IFC→GLB:** `scripts/ifc_para_glb_hidro.py <entrada.ifc> <saida>`. Regra de peso (Marcos, 29/10/2026): peças acima de 250 triângulos são simplificadas por agrupamento de vértices; tubos ficam intactos; GLB final **não passa de 2.000 KB** (senão o script aborta sem gravar); tubos e conexões têm a espessura ampliada 3× só no visual (a página avisa). O IFC é dado de cliente e **não vai ao site**; só o GLB derivado, com nomes neutros.
- **Maquete da terraplanagem (Infraestrutura):** GLB ilustrativo (V5, 02/11/2026) com 8 camadas nomeadas (`TERRENO_NATURAL`, `TERRENO_FINAL`, `VOLUME_CORTE`, `VOLUME_ATERRO`, `MARCA_CORTE`, `MARCA_ATERRO`, `PISOS`, `CONTENCOES`), sem IFC de cliente, sem volumes, relevo exagerado 2 vezes. A animação é por janelas (terreno natural, pisos que caem, linha que desce, corte e aterro que ficam). Os scripts que geram o GLB e o relatório de validação estão **fora do repositório** (`C:\work\cad\djalma\maquete_v1\v5`).
- **three.js hospedado (02/11/2026):** `assets/vendor/three/` guarda three.js 0.160.0 (MIT) sem alteração: `build/three.module.js`, `examples/jsm/controls/OrbitControls.js`, `examples/jsm/loaders/GLTFLoader.js`, `examples/jsm/utils/BufferGeometryUtils.js`, `LICENSE` e `ORIGEM.txt` (pacote npm, shasum e sha256 de cada arquivo). O importmap das quatro páginas de maquete vem de `scripts/gerar-paginas-servico-v02.py` (`../../assets/vendor/three/…`); **nenhuma maquete carrega recurso de CDN**. A `/experiencia-tecnica/` continua com o seu próprio importmap (unpkg), fora desta mudança.
- **Código morto na Experiência técnica:** `experiencia-tecnica` carrega `three-d-stage.js` e um importmap da unpkg (three 0.184.0), mas **nenhum HTML do site contém `<three-d-stage>`**; a página não mostra modelo 3D. O `assets/models/guatupe.obj` (2,1 MB) não é referenciado por nenhuma página e só permanece porque a allowlist e o smoke o exigem. A `privacidade/` ainda diz que a Experiência técnica mostra um modelo 3D.
- **Pesos (conferidos por tamanho de arquivo):** `assets/models/` tem 12 arquivos, 6.716.352 bytes; o maior GLB é `hidrantes-luiz-carlos-v02.glb` (1.857.508 bytes), seguido de `estrutura-concreto.glb` (1.169.872 bytes). `three.module.js` tem 1.326.016 bytes.
- **Carregamento e erro (as quatro maquetes de serviço):** o `#carregando` mostra um texto e some quando pronto. Falha ao importar o three, no `fetch`, no parse ou no JSON troca o texto por uma mensagem. O laço de desenho só renderiza se a caixa estiver visível ou aberta e para com `document.hidden`; `prefers-reduced-motion` é respeitado nas quatro; Esc fecha e o foco volta para a caixa. **Faltam:** `new THREE.WebGLRenderer` está fora do `try` (sem WebGL o texto de carregamento fica parado), e não há `<noscript>` nem imagem de reserva. O GLB e o three começam a baixar assim que o módulo executa; só a animação espera a caixa ficar visível.
- **Defeito de 04/11, corrigido:** os modelos `estrutura-aco.glb` e `.json` não estavam na allowlist e davam 404; o PR #45 os liberou (deploy e smoke verdes em 04/11).
- Os comentários do cabeçalho dos quatro JS ainda dizem que o importmap aponta para o jsDelivr; já não é verdade.

## 5. Módulo: CSS e classes

Ordem de `<link>` nas páginas ricas: `servicos-v02` → `servico-pagina-v02` → `maquete-3d` → `servico-rico-v02` → `maquete-estrutura-3d` → CSS da disciplina. O `<body>` leva `servicos-v02 servico-pagina-v02 servico-rico-v02 servico-rico-<disciplina>`.

- `maquete-3d.css` é **dono das classes da caixa** (`.vaga`, `.caixa`, `.palco`, `.ui-aberta`, `.painel`, `.chip`...) e das variáveis `--fonte`, `--azul`, `--azul-linha`.
- `maquete-estrutura-3d.css` **soma-se** a ele e é reaproveitado pela hidro: o `#caixa` precisa da classe `estrutura`, senão perde tooltip e ficha.
- `servico-hidro-v02.css` tem o hero liso, o título dimensionado e a legenda de cores.
- Não usados pelas maquetes: `style.css` (site antigo), `servicos.css`, `home-*.css`, `v02-proposta.css`.
- Cache por `?v=N` manual. **Subir o `?v` em todas as páginas que usam um CSS/JS compartilhado.**

### 5.1 Quem é dono de quê (16 folhas)

| Arquivo | Dono de | Depende de |
|---|---|---|
| `servicos-v02.css` | base das páginas V02 exceto a Home: tokens, `@font-face`, header e menu (móvel até 1280 px), `.hero`, catálogo, `.final-cta`, fundo do rodapé | nada |
| `rodape-v02.css` | `.site-footer.rodape` e `.rodape-*` | fundo e cor vêm do CSS de cada página |
| `servico-pagina-v02.css` | `.servico-pagina-v02 ...` e **também o rodapé em colunas** (L82-94) | `servicos-v02` |
| `servico-rico-v02.css` | `rico-*`, `.caixa`, `.chamada`, `.final-cta` | `servicos-v02`, `servico-pagina-v02` |
| `maquete-3d.css`, `maquete-estrutura-3d.css` | caixa da maquete e `.caixa.estrutura` (ficha, tooltip) | `servico-rico-v02` |
| `servico-estrutural-v02.css`, `servico-hidro-v02.css`, `servico-infra-v02.css` | acabamento por disciplina | `.servico-rico-<disciplina>` |
| `contato-v02.css`, `construir-ou-ampliar-v02.css` | páginas próprias | `servicos-v02`, `rodape-v02` |
| `home-20261024.css`, `home-opcao3-20261027.css`, `v02-proposta.css` | Home | `v02-proposta` ainda traz o cabeçalho "aceite pendente" |
| `style.css`, `servicos.css` | site antigo (631 linhas em `style.css`) | `servicos.css` com `?v=2` nas antigas e `?v=8` na 404 e na privacidade |

**Duplicações:** (1) as 11 regras do rodapé existem em `rodape-v02.css` e em `servico-pagina-v02.css`; as 4 páginas de projeto carregam só a segunda e as demais V02 só a primeira (a versão nova tem `min-height:0`, `padding:0` e `text-decoration:none` a mais, o que pode dar 1 px de diferença). (2) Fundo e padding do rodapé estão em `servicos-v02.css`, `home-opcao3` e `rodape-v02.css`. (3) `style.css` repete `.site-footer/.footer-in/.fcol` duas vezes; `.footer-grid` de `home-20261024.css` está órfão. (4) A legenda da maquete é literal em `servico-hidro-v02.css` e `servico-infra-v02.css`. (5) O menu móvel quebra em 1280 px (`servicos-v02`) e em 1120 px (`home-opcao3`).

## 6. Módulo: calculadora `/orcamento/` (`orcamento-src`)

**Stack:** React 19.2, Vite 6.4.2, pnpm. Lógica em `.mjs` puro (roda em `node --test`).

| Arquivo | Papel |
|---|---|
| `src/main.jsx` → `GlobalApp.jsx` | Entrada e UI inteira (5 rotas, resumo, resultado, contato, envio). `App.jsx` é protótipo antigo, **não usado**. |
| `src/journey.mjs` | Grafo de perguntas, validação, `advance`, `needsReview`, `safetyHold`, listas de serviços (`services` com 13 itens; `buildServices` menor). |
| `src/payload_v2.mjs` | Converte respostas em `pricing_inputs` e monta o payload `site-intake/payload/2`. |
| `src/pricing/` | `pricing-table.v2.json` (**cópia byte a byte do canônico, não editar**), `engine.mjs` (porte do motor Python), `decimal.mjs` (BigInt). Regra: menor referência aplicável × 0,80 (fator interno, nunca exposto). |
| `src/deeplink.mjs` | `?situacao=<rota>[&servico=<slug>]`, fail-closed, 9 atalhos de disciplina. |
| `src/funnel.mjs` | Intenções pós-resultado e regra R1 de lead qualificado. |
| `src/submit.mjs` | Única chamada de rede de lead (Worker `site-intake`), 1 retentativa, nunca lança. |
| `src/preview*.mjs`, `qr.mjs` | Prévia verificável (Worker `preview`), PNG 1080×1350, QR. |
| `src/tracking.mjs` | Ponte para o adaptador de analytics (`assets/js/analytics.mjs`). |
| `src/architecture*.mjs` | Estimativa de área da Arquitetura (`ARQ_EST_V1`, parâmetros a validar). `municipal/` é histórico, **não é importado**. |
| `scripts/publish-guard.mjs` | Falha se o endpoint de produção estiver vazio, não-https ou com placeholder. |

**Build:** `pnpm build` em `orcamento-src/` regera **toda** a pasta `orcamento/` (`emptyOutDir: true`), com hashes novos a cada vez. O bundle é artefato versionado: mudar `src/` exige rebuildar e commitar o bundle, senão vários testes quebram.

**Fluxo:** HOME (5 rotas) → perguntas → resumo → resultado (calculado ou "avaliação humana") → intenção → contato (**só depois do resultado**) → envio. Fotos nunca são enviadas (só nome, tamanho, tipo).

## 7. Módulo: medição e privacidade

Carregados no fim do `<body>` de toda página: `nav.js`, `analytics-sink.js` (Simple Analytics, respeita DNT e GPC), `meta-pixel.js` (Pixel da Meta; o evento Lead sai pelo Worker, não do navegador), `site-analytics.mjs` (`trackPageView` e `installContactClicks`). Contrato de eventos em `docs/MENSURACAO_FUNIL.md`; sem cookie, sem armazenamento, sem texto livre nos eventos. O CTA de contato (`wa.me`, `tel:`, `mailto:`) vira evento por uma escuta delegada em `contact-clicks.mjs`; a posição vem, nesta ordem, de `[data-contact-placement]`, `.topbar`, `.site-footer`, `.nav` (vira `menu`), `.cta-band`/`.cta-stack`, `/contato/` (vira `contact_page`) e, por fim, `body`. O mapa página→serviço (`PAGE_CONTEXT`, 12 entradas) fica em `contact-clicks.mjs`; não tem `/metodologia/`, `/experiencia-tecnica/`, `/empresa/` nem `/privacidade/`.

## 8. Módulo: testes (`orcamento-src/tests`, `node --test`)

**23 arquivos e 370 casos, todos passam** (execução de 05/11 em `orcamento-src`; os arquivos novos são `pscip_glp.test.mjs` e `pscip_race.test.mjs`). Em `package.json` e `pages.yml` os 23 caminhos estão listados à mão, sem glob; o `pages.yml` roda também `python3 -B -m unittest discover -s scripts -p test_pscip_glp.py` (5 casos); o teste `commercial_site` (L477-485) reprova arquivo de teste fora das duas listas. Os que **leem o HTML e os assets publicados** são os que prendem o site:

| Teste | Prende |
|---|---|
| `commercial_site` (28 casos) | `SERVICE_SLUGS` (9), `COMMERCIAL` (16), `OTHER` (4), `ALL` (20), sitemap exato (19 indexáveis + `/orcamento/`); title 12-78 e description 60-200; canonical; `og:*`; links internos e âncoras; deep links; **numerais** (`NUMERIC_FACTS` global e `PAGE_FACTS` por página, L380-423); proveniência do acervo por página (L357-377); menu V02 idêntico (L241), rodapé idêntico (L228) e Facebook entre Instagram e LinkedIn (L253) nas 8 de `PAGINAS_V02`; `aria-current`; JSON-LD `areaServed` nas 9 de serviço (L520); texto estático em `/orcamento/` (L505); allowlist, bundle e `pages.yml` |
| `site_ux` (9) | slugs (L34) e ordem dos 8 cartões de `/servicos/`; Home V02; páginas V02 de serviço: CTA `a.cta` repetido 2 vezes, 4 `<h2>` e `<h3>` de detalhe; Regularização V02 tem ramo próprio (CTA único `?situacao=regularize` no hero e no fechamento, os 7 `<h2>` e os 4 `<h3>` da copy, seis situações, quatro contextos, cinco etapas, oito perguntas, um só `Service` e os três links internos); páginas **antigas** (orçamento técnico, BIM): CTA `btn-cta` com rótulo próprio e os **7 `<h2>`** exatos; invariantes do intake. `H1_NAMES` está declarada e não é usada |
| `privacy_and_sink` (10) | **title ≤ 60 e description 70-160** (mais estrito que o `commercial_site`; vale o mais apertado); sem recurso externo; sink antes de `site-analytics.mjs`; rodapé com Privacidade e Trajetória; JSON-LD da Home |
| `contact_clicks` (10) | no mínimo 90 links de contato, posições `topbar`, `menu`, `footer`, `cta_band` e `contact_page`; módulo na allowlist |
| `hotfix` (6) | nav com 8 rótulos, em dois conjuntos (antigo e V02); o V02 vale só para Home, Serviços, Contato e Construir ou ampliar; não vê as páginas de serviço |
| `native_services` (20) | Infraestrutura sem estimativa e com CTA para `/contato/` (decisão 97); 193/199 em `avaliar-um-problema` |
| `integration`, `analytics`, `architecture_estimator` | bundle, endpoints, hashes SHA-256 de `pricing-table.v2.json`, `engine.mjs`, `decimal.mjs` e `submit.mjs` (qualquer edição quebra o teste 19 de `architecture_estimator`) |

**Como acrescentar um número visível a uma página:** `NUMERIC_FACTS` (todas as páginas) ou `PAGE_FACTS['caminho/index.html']` (uma página), escrito exatamente como aparece, com a fonte comentada ao lado. `'1'` e `'2'` estão liberados globalmente; qualquer outro número novo (inclusive ano e m²) quebra o teste.

**Páginas de incêndio e GLP nos testes:**
- `commercial_site` foi ajustado nesta frente: as listas incluem as duas páginas, o catálogo conta 8 cartões e as regexes de proveniência valem para o texto novo (incêndio com `171` e `100`).
- `site_ux` trata incêndio e GLP como páginas ricas: exige o CTA específico (`Ver a estimativa do meu projeto de incêndio` e `Ver a estimativa do projeto de gás/GLP`) duas vezes, com `servico=incendio` e `servico=gas-glp`, um único `Service` no JSON-LD com a URL da própria página e os `<h2>` do layout rico. As verificações comuns (H1, canonical, ausência do CTA genérico, números proibidos) passam por todos os nove serviços. Em incêndio exige a qualificação "AVCB ou o documento aplicável no estado (no Paraná, CVCB ou CLCB)".
- `scripts/test_pscip_glp.py` regera incêndio, GLP e catálogo em diretório temporário e exige saída idêntica aos arquivos versionados em `servicos/`, além de duas gerações iguais.
- `contact_clicks` L196-205 usa `/servicos/projeto-gas-glp/` como contexto simulado (`gas_glp`), sem ler o HTML.
- Se uma 9ª página virar V02, mudam `PAGINAS_V02`, `LANCADAS` e `V02_SERVICES` (L269) no `commercial_site`, e o dicionário V02 do `site_ux`.

**Mudou desde 30/10:** `commercial_site` passou de 23 para 28 casos (rodapé único, menu V02, Facebook, texto estático de `/orcamento/`, `areaServed`); `native_services` de 19 para 20; `contact_clicks`, `hotfix`, `site_ux` e `privacy_and_sink` foram ajustados (posição `menu` nas V02, rótulos V02, ignorar o arquivo do Search Console).

## 9. Publicação (`.github/`)

- `pages.yml`: gatilho `push` na `main` ou `workflow_dispatch`; **não há checks em PR**, então um erro só aparece depois do merge. Três jobs: `build` → `deploy` → `smoke-live`. O `build`, em ordem: `node --test` nos 23 arquivos, o `unittest` de `test_pscip_glp.py` e `publish-guard` (G1), `build_artifact.py build`, `validate` (G2 a G5), `smoke-local`, e o envio do relatório de hashes e do artefato. **Não roda** o `conferir`, os `--check` dos geradores nem testes do build.
- `allowlist.txt` (181 linhas): **lista fechada**, caminhos exatos mais 1 padrão (`orcamento/assets/**`), artefato esperado de **142 arquivos** (141 antes da Regularização V02, que acrescentou `servico-regularizacao-v02.css`); a frente PSCIP + GLP acrescentou 9 caminhos públicos de runtime (3 CSS, 3 JS, GLB, JSON e o pôster PNG). "Não está na lista, não entra." O bloco "release parcial" tem 59 caminhos exatos. Nova página ou asset obriga a editar a allowlist, o `sitemap.xml` e o `commercial_site`.
- `build_artifact.py` (359 linhas): copia os bytes **do commit**, não da árvore de trabalho (arquivo não commitado não entra, nem no smoke local). G2: caminho que não existe falha; G3: proíbe `.gitignore`, `orcamento-src/`, `.github/` e três imagens; G4: SHA-256 igual ao do blob; G5: o bundle `index-CsN7vBmE.js` e o CSS `index-B16Vzy82.css` têm nome fixo em `build_artifact.py` (L40-41, L65, L261): renomear o bundle exige editar o script além da allowlist.
- **Lacuna de cobertura:** `SMOKE_POSITIVE` e `SMOKE_POSITIVE_URLS` não listam as quatro páginas de projeto V02 nem os CSS, JS e modelos V02, e `validate` não confere referência HTML→arquivo. Um asset esquecido na allowlist passa por G2-G5 e pelo smoke (foi o caso de `estrutura-aco.*`, seção 4, já corrigido). O rastreador manual (todas as páginas servidas e cada `href`/`src`) continua necessário antes de publicar.
- O tamanho de 34 MB do artefato, citado antes, não foi conferido nesta leitura.

## 10. Convenções

- Português do Brasil em tudo que o cliente lê. Frase curta. Voz vigente: `VOZ_DEMELLO_V07.md` (fora do repositório).
- **Terraplanagem**, nunca "terraplenagem" (o slug e muitos códigos ainda usam a grafia banida: revisão final).
- **ART** é o documento; responsabilidade técnica é o que ele registra.
- Não negar o que a DEMELLO faz ("não executa obra") e não pôr propaganda de serviço no lugar.
- Arquivo que outro agente lê leva **versão nova** no nome; a anterior fica como histórico.
- Fim de linha: o repositório avisa "LF will be replaced by CRLF" em todo commit; é só aviso.

## 11. Armadilhas (as que já custaram caro)

1. **A allowlist é fechada: arquivo novo só sai se estiver na lista, e o smoke não pega o esquecido** (seção 9). Confira com o rastreador de referências antes de publicar. O último caso real (`estrutura-aco.*`) foi corrigido no PR #45.
2. **three.js é hospedado (`assets/vendor/three/`) e precisa manter `build/` e `examples/jsm/`**, porque o `GLTFLoader` importa `../utils/BufferGeometryUtils.js`. Trocar a versão exige trocar os quatro arquivos juntos e atualizar `ORIGEM.txt`. A política de privacidade e a `CSP_PROPOSTA.md` precisam ser relidas à luz de que o jsDelivr saiu (o texto publicado cita só o unpkg).
3. **`.glb` e `.json` sem `?v=`.** Cache velho de um deles com o outro novo quebra a busca binária e a ficha mostra a peça errada, sem erro visível. O `?v=` hoje está nos JS e CSS, não nos modelos.
4. **Edição com `\n` dentro de Python** corrompeu `layout_rico.py` duas vezes. Usar o editor de arquivos ou `chr(92) + 'n'`.
5. **Regerar uma página não pode mexer nas outras.** Conferir o `git diff` das demais.
6. **`conferir` com `.copy.json` não confere o texto novo** e só olha o `<main>` (seção 3.9). Não substitui a revisão (subagente `revisor-copy`).
7. **`otimizar_ifc.py` não existe neste repositório** (está no canônico), mas o conversor e a skill o citam.
8. **Menu e rodapé V02 vivem em cinco lugares:** `gerar-paginas-servico-v02.py`, `gerar-contato-v02.py`, `gerar-construir-ou-ampliar-v02.py`, e à mão na Home e em `servicos/index.html`. As 11 páginas V02 têm o mesmo menu (com `nav-build`) e o mesmo rodapé (com Facebook); os testes comparam os dois. `gerar-servicos-v02.py` agora usa os templates de cabeçalho e rodapé V02 e reproduz o catálogo versionado (conferido por teste), mas segue sem `--check`. As 10 páginas antigas seguem com menu e rodapé antigos; o item atual chama-se "Serviços" nas V02 e "Outros serviços" nas antigas. O JSON-LD da Home lista só Instagram e LinkedIn em `sameAs`, sem Facebook.
9. **Sitemap** tem 20 URLs (17 com `lastmod` 2026-10-06 e 3 com 2026-11-05: catálogo, incêndio e GLP), e nenhum script o atualiza; página nova exige editar sitemap, allowlist e `commercial_site`. O sitemap e os testes ainda usam o slug `projeto-terraplenagem`.
10. **Ordem do `<head>` e dos scripts importa:** o sink antes de `site-analytics.mjs`, Pixel com `defer`.
11. **Servidor local:** a porta 8765 já esteve ocupada por outro processo; usar porta livre.
12. **`.gitignore` mínimo** (só `orcamento-src/node_modules/`).
13. **Dois conjuntos de menu nos testes:** `hotfix` (4 páginas) e `commercial_site` (8 páginas). Mudar o menu exige alterar os dois.
14. **Os testes de incêndio e GLP exigem o texto antigo,** inclusive a ressalva do CNPJ no GLP (seção 8). Trocar o texto dessas páginas obriga a alterar `commercial_site` e `site_ux` na mesma entrega.
15. **Terraplanagem** (grafia certa) convive com "terraplenagem" em slug, sitemap, testes e em texto visível de `experiencia-tecnica` (3 vezes) e `compatibilizacao-bim` (1 vez).
16. **O CI só roda na `main`:** valide num clone sem conversão de fim de linha (o CI é Linux; um teste de rodapé já passou no Windows e reprovou no CI).
17. **`.mcp.json` fixa `@playwright/mcp@latest`** (sem versão) e nunca foi testado.
18. **WebGL indisponível** deixa a maquete parada em "Carregando..." (seção 4).

## 12. Guia de navegação

| Para... | Mexer em |
|---|---|
| Mudar o texto de uma página rica | **copy nova** → importar → gerar → conferir. Nunca o HTML. |
| Criar uma página de serviço nova | `PERFIS`, `LAYOUTS`, `LINKS`, `REMOVIDOS` no importador; `SLUGS` no gerador; markup da maquete; `site_ux`, `commercial_site`, sitemap e allowlist. |
| Renomear ou juntar serviços | `journey.mjs` (`services`, `buildServices`), `payload_v2.mjs`, `client_summary.mjs`, `deeplink.mjs`, `gerar-servicos-v02.py` e `conteudo.json` do catálogo (8 cartões; o integrado de incêndio e gás tem dois acessos à estimativa), `site_ux`, `commercial_site`, `analytics.mjs` (lista fechada de serviços) e os links da home e do catálogo. A tabela de preços é cópia do canônico. |
| Trocar o slug "terraplenagem" | pasta, `SLUGS`, JSON de origem, sitemap, allowlist, `PAGE_CONTEXT` e `analytics.mjs`, deeplink, tabela de preços, links da home/catálogo/experiência, bundle (rebuild) e **redirecionamento** (a URL já está no Google). |
| Adicionar uma maquete | JS e CSS próprios (ou reaproveitar `estrutura`), `.glb` + `.json` com mesmo `?v`, importmap para `assets/vendor/three/` (já no gerador), allowlist. |
| Gerar o GLB de um IFC | `otimizar_ifc.py` (do canônico) → `ifc_para_glb_hidro.py`; teto de 2.000 KB. |
| Mexer na calculadora | `orcamento-src/src` → `pnpm build` → `pnpm publish-guard` → commit do bundle; não editar `pricing-table.v2.json`, `engine.mjs`, `decimal.mjs`, `submit.mjs` sem atualizar hashes e o golden de paridade. |
| Publicar | allowlist (feita para as seis páginas do release parcial) + three.js hospedado (feito) + G1 verde + ordem de Marcos para PR e merge; push na `main` publica sem aprovação. |
| Criar um perfil de maquete novo (exemplo já feito: incêndio, perfil `pscip-glp`) | seção 3.8: `PERFIS`, rótulo do meio, extras e ramos do `gerar()`; novo `maquete-*-markup.html`; JS e CSS próprios em `assets/`; `.glb` e `.json` com o mesmo `?v`; allowlist (caminhos exatos, inclusive o JS auxiliar importado); testes da seção 8 |
| Trocar a ordem ou os rótulos do menu | os 5 lugares da armadilha 8, `commercial_site` (L241) e `hotfix` (L35-51) |

## 13. Estado de reestruturação em curso (04/11/2026)

O site deve ficar com **sete páginas de serviço** (decisão 96): Arquitetura, Estrutural, Hidrossanitário, **Infraestrutura**, **PSCIP + GLP**, **Orçamento, cronograma e compatibilização** e **Regularização**. Os serviços continuam diferentes entre si; o agrupamento é estratégico.

- **Feito e no ar:** Infraestrutura (perfil `infra`, sem estimativa, decisão 97; slug histórico `projeto-terraplenagem` preservado para não quebrar a URL já indexada). Home V02, Serviços V02, Contato V02 e Construir ou ampliar V02, com menu e rodapé únicos nas 8 páginas V02 da `main`.
- **Em PR (05/11):** PSCIP + GLP (issue #12, absorve a #13): `projeto-prevencao-incendio` e `projeto-gas-glp` no layout rico, catálogo com 8 cartões e maquete de hidrantes. Aceite visual de Marcos dado; o merge depende de ordem expressa.
- **Em branch (05/11):** Orçamento e cronograma (issue #15, absorve a #17), perfil `orcamento`, aguardando a ordem de Marcos para PR e merge. **Pendente:** `compatibilizacao-bim`, no layout antigo, e o cartão integrado do catálogo (decisão de Marcos de 05/11: duas páginas e um cartão). **Em branch (05/11):** Regularização (issue #16), perfil `regularizacao`, aguardando auditoria e a ordem de Marcos para PR e merge.
- **Efeitos mapeados em quem prende os 9:** `site_ux` (9 slugs e a ordem dos 8 cartões do catálogo), `commercial_site` (`SERVICE_SLUGS`), `gerar-servicos-v02.py` e o `conteudo.json` do catálogo, `journey.mjs` (11 códigos de preço) e `contact-clicks.mjs` (`PAGE_CONTEXT`). Agrupar ou renomear páginas mexe em todos; trocar um slug muda a URL e pede redirecionamento (o GitHub Pages não faz 301 de servidor).
- A calculadora tem 11 códigos de preço e nenhum para rodovia, pavimentação, redes públicas ou drenagem urbana, e não precisa ter (decisão de 30/10): infraestrutura é projeto de milhões, que ninguém digita por curiosidade.
- Publicar exige a allowlist com os arquivos novos, o G1 verde e ordem expressa de Marcos para cada passo (branch, push, PR, merge); um push na `main` publica.

---

*Se o Cartographer ajudou, considere dar uma estrela: https://github.com/kingbootoshi/cartographer*

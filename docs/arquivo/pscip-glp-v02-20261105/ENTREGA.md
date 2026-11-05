# PSCIP + GLP V02 — entrega local da issue #12

Data: 05/11/2026. Branch `candidata/pscip-glp-v02`. Base remota conferida: `c6541bd132c797ab4eee1cb7002b4236738c8b8e`. Commit final: consultar `git rev-parse HEAD` nesta worktree. Sem push, PR, merge, edição de issue, alteração canônica ou publicação.

## Avaliação

- Incêndio: http://127.0.0.1:8774/servicos/projeto-prevencao-incendio/
- GLP: http://127.0.0.1:8774/servicos/projeto-gas-glp/
- Catálogo: http://127.0.0.1:8774/servicos/
- Galeria: http://127.0.0.1:8774/docs/arquivo/pscip-glp-v02-20261105/avaliacao.html

Servidor limitado a 127.0.0.1. Para reiniciar, na raiz da worktree: `python -B -m http.server 8774 --bind 127.0.0.1`.

## Fontes e precheck

Plugin Management confirmou GitHub disponível; leitura remota efetiva do CURRENT e documentos, da main e issue #12. Superpowers aplicado ao isolamento, testes e revisão independente. Skill abrir-frente aplicada como precheck direcionado à frente autorizada, sem retomar as demais frentes da retomada histórica. Doc01 V03 (856 linhas, leitura em blocos), Doc02 V09 (1718 linhas, 3 blocos), Doc03 V91 (356 linhas, 2 blocos) confirmados no CURRENT remoto. O snapshot local canônico V90 não foi usado como vigente. Identidade canônica por API, sem alterar checkout ou executar publicação canônica. Regras de governança/conduta e mapa do site consultados. A retomada histórica SITE BAPHO de 03/11 foi consultada como contexto anterior; o comando de implementação e o CURRENT prevalecem. Não houve inventário integral das issues de outras frentes nem instalação/sincronização de skills.

Voz: VOZ_DEMELLO_V07.md, fonte local indicada por Marcos, lida. Maquete aceita: candidata local b52e32d. Worktree separada criada com Git após a ferramenta gerenciada não retornar workspace; fontes V01/V02 permanecem limpas.

## Implementado

Duas páginas V02 indexáveis e com canonical/og:url próprios, três saídas HTML geradas, catálogo com oito agrupamentos e nove URLs técnicas mantidas. Cabeçalho e rodapé do catálogo reproduzidos por templates centrais. Dois links contextuais em cada direção, em posições distintas, sem contar menu/rodapé. CTAs mantêm `/orcamento/?situacao=known&servico=incendio` e `/orcamento/?situacao=known&servico=gas-glp`. Seleção validada no contrato de deeplink e abertura real da calculadora no navegador. Nenhuma mudança em src, pricing, payload ou bundle da calculadora.

Copy nova completa conferida, inclusive SEO, blocos, microtexto e CTAs. As duas notas nacionais condicionais permanecem na fonte e no JSON editorial, ligadas às respectivas perguntas, fora do HTML. Não houve nova correção normativa além da copy consolidada fornecida. A pendência de comprovar todas as siglas só bloqueia a futura inclusão dessas notas, não esta candidata.

GLP reutiliza sua fonte vigente. Deltas mínimos: chamada/descrição sobre rede e central, dois links contextuais, CTA específico, referência correta à calculadora, atribuição do acervo a Marcos e retirada de negativas de execução/ressalva de CNPJ conforme V07. Catálogo: o texto de limite da Infraestrutura que só estava no HTML aprovado foi trazido à fonte central, impedindo sua reversão pelo gerador.

## Validação técnica

- Baseline: 364 testes Node, zero falhas.
- Final: 370 testes Node, zero falhas (`node.log`).
- Python: 5 testes, zero falhas (`python.log`). Abrange parser, notas por pergunta, rejeição de rótulos inválidos, perda deliberada de copy/CTA, reprodução de quatro perfis anteriores e segunda geração.
- Conferidor: nenhuma perda de texto (`copy.log`).
- publish-guard: OK.
- Segunda geração: quatro saídas SHA-256 idênticas (`reproducao.json`).
- Sete HTML V02 anteriores intactos, byte a byte; o catálogo recebeu apenas as alterações autorizadas. Quatro perfis anteriores reproduzem os blobs versionados em diretório temporário.
- Navegador: 46 verificações principais, zero exceções nas interações principais (`browser.json`); regressão de fechamento durante abertura e reabertura também passou em Chrome com movimento normal. Requisições externas, inclusive rastreadores, bloqueadas nos testes.
- Capturas: viewport 1440×900 e 390×844, escala CSS; 21 imagens reais, incluindo páginas completas, maquete e fallbacks.
- Gates locais do artefato: PASS. 141 arquivos previstos e presentes, MISSING=0, EXTRA=0, MISMATCHES=0, G3_FORBIDDEN_HITS=0 e G5_RUNTIME=OK; smoke-local PASS. Hashes em `artifact-hashes.json`.
- Navegador sobre o próprio artefato: três páginas HTTP 200, maquete pronta com 172 opções (placeholder + 171 peças), zero dependências locais com erro; relatório interno HTTP 404 (`artifact-browser.json`). O snapshot de implementação usado na montagem é b21e582; a validação dos mesmos bytes públicos será repetida no commit final, que acrescenta somente esta evidência interna.

## Integridade da maquete

GLB 1.857.508 bytes. SHA-256 `350b52603363964386270bba4b1fbdda04f9cd26ab4483559f6b12868021c04a`.
JSON 47.499 bytes. SHA-256 `2e4e019029d304d122a125c6919ea0a9061e30a58890ba4854d03dff8a8feae8`.
171 IDs, camadas, identificação e avisos ilustrativos preservados. Não houve reconversão/modelagem. Fonte IFC somente leitura, hash conferido `1358092a4640a5b9ed787730ae1bde5b86cfe7b09bd0155a0acd64d1845b9e9c`.

Runtime integrado: import relativo adaptado e proteção de transições assíncronas; fonte aceita continua intacta. O teste determinístico da revisão independente falhou antes e passou após a proteção contra abertura obsoleta. Um teste Chrome de Escape imediato já passava antes, por ordem de agendamento; a regressão Node cobre a conclusão adversa independentemente do navegador.

Nenhum Three.js/GLB antes da ativação. Pôster permanece disponível sem JS, sem WebGL ou em falha do download. Os 2.000.000 bytes são o teto do GLB, não da página inteira. As medidas locais estão no JSON; cadência rAF estática não é FPS da GPU nem desempenho de celular físico.

## Revisão de design e UX

Product Design e UI UX Designer aplicados ao fluxo efetivo: (1) página e CTA, (2) referências entre disciplinas, (3) calculadora correta, (4) ativação e identificação no 3D, (5) falhas e navegação móvel. Capturas finais inspecionadas; páginas completas e maquete conferidas. Corrigidos CTA mobile tardio, links de baixo contraste no hero e foco de cabeçalho/rodapé do catálogo. Hidrantes mantêm a identidade visual aceita; GLP usa diagrama conceitual de rede/central e coordenação, sem equipamentos inventados.

Revisão independente de código encontrou uma concorrência de transição no viewer; corrigida e coberta por regressão. Sem outro achado importante. Revisão visual pelo executor não equivale ao aceite de Marcos.

## Pendências

- Aceite visual humano das duas páginas e do catálogo.
- Teste em celular físico e tecnologia assistiva; emulação não os substitui.
- Proveniência das notas nacionais antes de eventual inclusão futura no HTML.
- Cartographer geral não executado; mapa atualizado de forma dirigida, com essa limitação declarada.
- Nenhum bloqueio técnico conhecido após os gates finais. Publicação continua sem autorização.

## Arquivos alterados e finalidade

- `.github/pages/allowlist.txt` — Somente novos recursos de runtime públicos; mantém documentos e IFC fora.
- `.github/workflows/pages.yml` — Inclusão dos testes nos comandos existentes; sem disparar workflow.
- `assets/css/catalogo-pscip-glp-v02.css` — Composição/controles específicos desta frente, sem mudar folhas compartilhadas.
- `assets/css/hidrantes-luiz-carlos-v02.css` — Composição/controles específicos desta frente, sem mudar folhas compartilhadas.
- `assets/css/servico-pscip-glp-v02.css` — Composição/controles específicos desta frente, sem mudar folhas compartilhadas.
- `assets/images/hidrantes-luiz-carlos-v02.png` — Pôster capturado do visualizador aceito.
- `assets/js/hidrantes-luiz-carlos-ativar.js` — Ativação 3D sob demanda ou runtime integrado preservando as interações.
- `assets/js/hidrantes-luiz-carlos-core.mjs` — Ativação 3D sob demanda ou runtime integrado preservando as interações.
- `assets/js/hidrantes-luiz-carlos-v02.js` — Ativação 3D sob demanda ou runtime integrado preservando as interações.
- `assets/models/hidrantes-luiz-carlos-v02.glb` — Cópia byte a byte do ativo aceito; uso público autorizado.
- `assets/models/hidrantes-luiz-carlos-v02.json` — Cópia byte a byte do ativo aceito; uso público autorizado.
- `docs/CODEBASE_MAP.md` — Mapa atualizado dos módulos e comandos afetados.
- `docs/arquivo/paginas-servico-v02/copy/COPY_PSCIP_GLP_V02_20261105.md` — Copy central, derivado estruturado ou markup da maquete.
- `docs/arquivo/paginas-servico-v02/maquete-hidrantes-markup.html` — Copy central, derivado estruturado ou markup da maquete.
- `docs/arquivo/paginas-servico-v02/projeto-gas-glp.json` — Copy central, derivado estruturado ou markup da maquete.
- `docs/arquivo/paginas-servico-v02/projeto-prevencao-incendio.copy.json` — Copy central, derivado estruturado ou markup da maquete.
- `docs/arquivo/pscip-glp-v02-20261105/ENTREGA.md` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/avaliacao.html` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/browser.json` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/calculadora-gas-glp.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/calculadora-incendio.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/catalogo-desktop-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/catalogo-desktop.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/catalogo-mobile-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/catalogo-mobile.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/copy.log` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/fallback-download.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/fallback-sem-js.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/fallback-webgl.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/glp-desktop-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/glp-desktop.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/glp-mobile-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/glp-mobile.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/incendio-desktop-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/incendio-desktop.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/incendio-mobile-completa.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/incendio-mobile.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/maquete-bomba.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/maquete-camadas.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/maquete-desktop.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/maquete-mobile.png` — Captura real de validação local; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/node.log` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/python.log` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/reproducao.json` — Evidência, galeria ou instrução local de avaliação; fora da allowlist.
- `docs/arquivo/servicos-v01-20261028/conteudo.json` — Fonte/template do catálogo vigente e do cartão integrado.
- `docs/arquivo/servicos-v01-20261028/footer.template.html` — Fonte/template do catálogo vigente e do cartão integrado.
- `docs/arquivo/servicos-v01-20261028/head.template.html` — Fonte/template do catálogo vigente e do cartão integrado.
- `docs/arquivo/servicos-v01-20261028/header.template.html` — Fonte/template do catálogo vigente e do cartão integrado.
- `orcamento-src/package.json` — Inclusão dos testes nos comandos existentes; sem disparar workflow.
- `orcamento-src/tests/commercial_site.test.mjs` — Contratos de URLs, conteúdo, catálogo, integridade e regressão; sem lógica comercial.
- `orcamento-src/tests/pscip_glp.test.mjs` — Contratos de URLs, conteúdo, catálogo, integridade e regressão; sem lógica comercial.
- `orcamento-src/tests/pscip_race.test.mjs` — Contratos de URLs, conteúdo, catálogo, integridade e regressão; sem lógica comercial.
- `orcamento-src/tests/site_ux.test.mjs` — Contratos de URLs, conteúdo, catálogo, integridade e regressão; sem lógica comercial.
- `scripts/conferir-paginas-servico-v02.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/copy_pscip_glp.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/gerar-paginas-servico-v02.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/gerar-servicos-v02.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/importar-copy-servico-v02.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/layout_rico.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/pscip-glp-race.browser.cjs` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/pscip-glp.browser.cjs` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `scripts/test_pscip_glp.py` — Contrato de importação, geração, conferência ou teste reproduzível da frente.
- `servicos/index.html` — HTML produzido exclusivamente pelos geradores.
- `servicos/projeto-gas-glp/index.html` — HTML produzido exclusivamente pelos geradores.
- `servicos/projeto-prevencao-incendio/index.html` — HTML produzido exclusivamente pelos geradores.
- `sitemap.xml` — Atualiza apenas lastmod das três páginas alteradas; rotas mantidas.

- `docs/arquivo/pscip-glp-v02-20261105/artifact-hashes.json` — Manifesto local dos 141 arquivos do artefato; fora da allowlist.
- `docs/arquivo/pscip-glp-v02-20261105/artifact-browser.json` — Leitura real das páginas/maquete no artefato e exclusão dos documentos internos.

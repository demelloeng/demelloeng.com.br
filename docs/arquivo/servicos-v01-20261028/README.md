# /servicos/ — candidata V01 — 28/10/2026

**Estado: CANDIDATA — AGUARDANDO ACEITE.** Não publicada.

Fonte visual: Home V02 aprovada, branch `arquivo/home-20261028`, commit `e6a55776a6b58abb8abc91c05a2192b9373329e2`. Fonte editorial: IT049, aplicada literalmente conforme a ordem de execução desta candidata.

## Escopo realizado

- `servicos/index.html`: copy P01–P05, orientação B2B com link para compatibilização BIM, title/og:title e breadcrumb. Os nove serviços continuam nos grupos 7+2 e na ordem original. Descrições, limites e links de cada serviço, assim como o bloco de caminhos por situação, foram preservados integralmente no HTML.
- Header e footer reutilizam a estrutura da Home V02, com caminhos relativos e Serviços marcado como página atual. Fontes Source Sans 3, fundo grafite, azul, branco e cinza seguem os recursos aprovados da home. Catálogo em composição editorial de duas colunas no desktop e uma no mobile, sem cards decorativos ou imagens novas.
- `assets/css/servicos-v02.css`: adaptações locais, todas restritas à classe da página. Folhas aprovadas da home não foram modificadas.

Meta description, canonical e demais metadados foram preservados, exceto title/og:title autorizados. O JSON-LD mantém sua estrutura, endereços e posições, alterando somente o nome do breadcrumb para Serviços. H1 único preservado. Scripts locais de navegação, mensuração Simple Analytics, contrato de eventos e Meta Pixel preservados.

## Verificações

Renderização local com navegador instalado, acessos externos e envios bloqueados:

- Desktop 1440×900, captura integral 1440×4272.
- Mobile 390×844, captura integral 390×6276.
- Sem overflow horizontal, erro JavaScript ou recurso local com erro HTTP. Logos e quatro pesos de fonte conferidos; peso 600 também foi carregado explicitamente no teste, pois o menu mobile fechado não o utiliza inicialmente.
- Nove serviços e sua ordem confirmados, conteúdo editorial e orientação B2B conferidos. Header/footer comparados com a home; não se exigiu geometria idêntica para páginas com conteúdos distintos.
- Menu mobile abriu e fechou. Link B2B alcançou a página de compatibilização BIM. CTA final abriu `/orcamento/?situacao=known`, com a pergunta “Qual serviço precisa?”. Nenhum formulário foi preenchido ou enviado; nenhum contato acionado.
- Capturas finais abertas e revisadas em desktop/mobile, incluindo catálogo, B2B, caminhos, CTA e rodapé. Artefato de captura durante rolagem suave foi corrigido no capturador, sem mudança na página.

Testes locais selecionados: `commercial_site.test.mjs`, `site_ux.test.mjs`, `hotfix.test.mjs`, `privacy_and_sink.test.mjs`, `contact_clicks.test.mjs` (58 testes). Na base: 43 aprovados e 15 falhas históricas. Na candidata: 42 aprovados e 16 falhas. A falha adicional é a asserção de navegação que ainda exige o rótulo legado “Outros serviços”; a IT049 exige “Serviços”. Os testes não foram alterados para ocultar esse conflito. Não se declara a suíte integralmente aprovada. As 15 falhas anteriores permanecem, sem ampliar o escopo para corrigi-las.

Conferência dirigida passou: dez trechos editoriais literais; HTML dos nove serviços e quatro caminhos preservado; scripts preservados; metadados protegidos iguais; JSON-LD alterado somente no breadcrumb; header/footer coerentes com a fonte visual.

## Limites e preservações

Bloqueios de scripts de terceiros por CSP são deliberados, não diagnóstico de falha em produção. Não foram testados envio, cálculo completo, CRM, efeitos externos, aparelhos físicos ou acessibilidade integral. A aprovação humana da candidata está pendente.

Home, suas folhas CSS aprovadas, nove páginas individuais, demais páginas, estimador, integrações, allowlist, sitemap, robots e documentos canônicos não foram alterados. Nenhuma imagem gerada, pesquisa SEO, nova proposta estética, PR, merge, deploy ou acionamento manual de workflow faz parte desta tarefa. Publicação e próxima página permanecem fora do escopo.

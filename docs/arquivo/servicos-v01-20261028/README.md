# /servicos/ — candidata V01 — 28/10/2026

> Atualização posterior: a seção “Adendo — materialização da revisão visual e editorial” ao final registra a candidata atual. O texto original abaixo permanece como histórico da primeira V01.

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


## Adendo — materialização da revisão visual e editorial

Atualização solicitada em 28/10/2026, nesta mesma branch candidata. A revisão posterior no Figma e a copy aplicada substituem a apresentação e os textos da primeira V01 descrita acima. Inclui a correção expressa de nome para **Orçamento e cronograma**, os nove ícones vetoriais, catálogo editorial e responsividade. Estado da implementação: CANDIDATA VERSIONADA — CONFERÊNCIA HUMANA PENDENTE. Não publicada.

### Fontes e manutenção

- Referência visual: Figma `TbT1hFcsJLKhgovd8eYBqT`, frames `2:15` e `2:115`. Exportações finais em `referencias-figma/`; são evidências, fora do diretório público de recursos.
- `conteudo.json` centraliza os textos; `icones.json` associa os nove ícones. `scripts/gerar-servicos-v02.py` regenera exclusivamente `servicos/index.html`, sem instalação de dependências. `head.template.html` preserva o restante dos metadados e o JSON-LD do catálogo anterior.
- HTML sem interface rasterizada; CSS específico com seletores restritos a `.servicos-v02`, em `assets/css/servicos-v02.css`. Folhas da Home inalteradas. SVGs aprovados em `assets/icons/servicos-v02/`.
- [Lista SEO e suas ressalvas](../../seo/20261028/PALAVRAS_CHAVE.md), com fonte recebida preservada integralmente. Não é uma nova pesquisa nem uma matriz aprovada por URL.

### Verificações desta atualização

- Integridade da copy, nove SVGs, limites, destinos, recursos locais e geração idempotente: PASS.
- Scripts originais `nav.js`, `analytics-sink.js`, `meta-pixel.js` e `site-analytics.mjs` mantidos com ordem e referências originais. Seus conteúdos e os módulos de eventos/contatos não foram alterados. Canonical e JSON-LD preservados.
- Capturas diretamente do HTML desta branch em `validacao/desktop.png` e `validacao/mobile.png`; viewports 1440×900 e 390×844. Fontes, logotipo, ícones, menu abre/fecha e ausência de overflow horizontal conferidos. Sem erro JavaScript local observado. Terceiros e envios bloqueados somente pelo servidor de conferência local; essa restrição não foi incorporada à página versionada.
- Pequenas diferenças de espaçamento/quebra entre Figma e fluxo responsivo do navegador permanecem documentadas; não se declara equivalência pixel a pixel. Aceite humano da implementação é separado da revisão técnica.
- Suíte pertinente: 71 testes, 57 passam; os mesmos 14 testes falhavam antes e depois desta atualização. Nenhuma nova falha. A guarda do catálogo foi atualizada para conferir a estrutura semântica, copy e ícones atuais, preservando a verificação dos destinos e limites. Falhas históricas enumeradas em `validacao/tecnica.json`; não são apresentadas como resolvidas.
- Nove páginas individuais, Home V02, scripts e integrações, sitemap, robots, allowlist e workflow não alterados. Nenhuma integração final, PR, merge ou publicação executada.

Plugin Management manteve as capacidades existentes; Superpowers foi aplicado ao escopo, reprodução e revisão antes do commit; Product Design/UI UX à conferência da implementação e do menu. Figma forneceu a referência exportada: conector bloqueado pelo limite Starter, sem nova edição nesta etapa. Creative Production não gerou novos recursos nem teve previews atualizados nesta incorporação.

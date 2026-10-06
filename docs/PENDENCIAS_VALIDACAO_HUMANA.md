# Pendências de validação humana (conteúdo não validado por ferramenta)

| Item | Onde está | Estado |
|---|---|---|
| Telefones de emergência **193** (Corpo de Bombeiros) e **199** (Defesa Civil) na orientação de segurança | `avaliar-um-problema/index.html` (bloco "Orientação de segurança" e FAQ) | **PENDENTE DE VALIDAÇÃO HUMANA.** Não vieram do repositório; não foram pesquisados nem confirmados por esta equipe de desenvolvimento. **Não alterados automaticamente.** Não declarar validado até que Marcos confirme. |
| Copy nova da home, landings, FAQ, benefícios e blocos "O que muda para você" / "Como funciona" | páginas estáticas | Passada na voz do `VOZ_DEMELLO_V01`; aprovação editorial é de Marcos. |
| Texto "Arquitetura (4.981 m²)" vs matriz editorial de 05/09 (5.179 m²) | `experiencia-tecnica/`, `servicos/projeto-arquitetura/` | Divergência pré-existente, não alterada. |
| Parâmetros do estimador de área (m² por item, circulação, fatores de padrão, faixa ±8 %, fatores do terreno 0,66–0,69, teto de 600 m², limites de plausibilidade) | `src/architecture_config.mjs` (versão `ARQ_EST_V1`) | **PENDENTE DE VALIDAÇÃO HUMANA.** Heurísticas comerciais de orientação, não regra técnica nem urbanística. Calibrar com casos reais da DEMELLO antes de uso amplo. |
| Texto educativo da devolutiva de Arquitetura (tom e exemplos) | `src/architecture_return.mjs` | Redação sugerida na diretriz comercial; aprovação editorial de Marcos. |
| Chaves `architecture_*` no Worker/CRM | payload V2 `answers` | **Contrato canônico localizado e validado (Marcos).** Sem pendência documental; a resposta do endpoint é conferida na verificação pós-publicação. |
| Simple Analytics: conta, domínio e eventos no plano gratuito | `assets/js/analytics-sink.js` | Ver `docs/MENSURACAO_FUNIL.md`. **Não verificável sem a conta.** |
| Hero 3D e imagem BIM | `assets/images/hero-3d-translucido-v2.*` (v2 = print do visualizador de armadura 3D do Eberick, tratado), `bim-compatibilizacao-v1.*` | Derivados do mockup do Codex (720 px de largura, sem arquivo-fonte). Conferir a nitidez em telas de alta densidade; se não passar, pedir o original. |
| Biblioteca 3D carregada de `unpkg.com` | `experiencia-tecnica/` | Terceiro declarado na política. Autohospedar elimina esse terceiro e simplifica uma futura CSP (não feito nesta entrega). |


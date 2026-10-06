# Pendências de validação humana (conteúdo não validado por ferramenta)

| Item | Onde está | Estado |
|---|---|---|
| Telefones de emergência **193** (Corpo de Bombeiros) e **199** (Defesa Civil) na orientação de segurança | `avaliar-um-problema/index.html` (bloco "Orientação de segurança" e FAQ) | **PENDENTE DE VALIDAÇÃO HUMANA.** Não vieram do repositório; não foram pesquisados nem confirmados por esta equipe de desenvolvimento. **Não alterados automaticamente.** Não declarar validado até que Marcos confirme. |
| Copy nova da home, landings, FAQ, benefícios e blocos "O que muda para você" / "Como funciona" | páginas estáticas | Passada na voz do `VOZ_DEMELLO_V01`; aprovação editorial é de Marcos. |
| Texto "Arquitetura (4.981 m²)" vs matriz editorial de 05/09 (5.179 m²) | `experiencia-tecnica/`, `servicos/projeto-arquitetura/` | Divergência pré-existente, não alterada. |
| Parâmetros do estimador de área (m² por item, circulação, fatores de padrão, faixa ±8 %, fatores do terreno 0,66–0,69, teto de 600 m², limites de plausibilidade) | `src/architecture_config.mjs` (versão `ARQ_EST_V1`) | **PENDENTE DE VALIDAÇÃO HUMANA.** Heurísticas comerciais de orientação, não regra técnica nem urbanística. Calibrar com casos reais da DEMELLO antes de uso amplo. |
| Texto educativo da devolutiva de Arquitetura (tom e exemplos) | `src/architecture_return.mjs` | Redação sugerida na diretriz comercial; aprovação editorial de Marcos. |
| Chaves `architecture_*` no Worker/CRM | payload V2 `answers` | **Contrato canônico localizado e validado (Marcos).** Sem pendência documental; a resposta do endpoint é conferida na verificação pós-publicação. |
| **Política de privacidade** (`privacidade/index.html`) | página nova (visual V2) | **NÃO REVISADA POR ADVOGADO** (decisão de Marcos: sem recursos para revisão agora). Redigida só com o que o site de fato faz, e conferida contra o código por `privacy_and_sink.test.mjs`. Não declarar validada. Uma leitura por outra ferramenta de IA ajuda, mas não substitui revisão profissional. |
| Base legal da política (LGPD, art. 7º, V — procedimentos preliminares a pedido do titular) | `privacidade/index.html` | Proposta de redação **a validar**. |
| Prazo de retenção dos casos | `privacidade/index.html` | Escrito sem número ("pelo tempo necessário para responder, propor e, se houver contratação, cumprir o contrato e as obrigações legais"). **Marcos deve definir um prazo** se quiser torná-lo explícito. |
| Compromisso "os dados não são vendidos nem usados para publicidade de terceiros" | `privacidade/index.html` | Afirmação de Marcos como controlador; **confirmar**. |
| Razão social e CNPJ na política e no JSON-LD | `privacidade/index.html`, `index.html` | "Marcos de Mello Silva Engenharia LTDA", CNPJ 65.613.230/0001-71 (iguais ao rodapé). **Confirmar** se é a razão social completa. |
| Canal de contato para titulares | `privacidade/index.html` | `marcos@demelloeng.com.br` (já público no rodapé). Marcos pode trocar. |
| Simple Analytics: conta, domínio e eventos no plano gratuito | `assets/js/analytics-sink.js` | Ver `docs/MENSURACAO_FUNIL.md`. **Não verificável sem a conta.** |
| Hero 3D e imagem BIM | `assets/images/hero-3d-translucido-v1.*`, `bim-compatibilizacao-v1.*` | Derivados do mockup do Codex (720 px de largura, sem arquivo-fonte). Conferir a nitidez em telas de alta densidade; se não passar, pedir o original. |
| Biblioteca 3D carregada de `unpkg.com` | `experiencia-tecnica/` | Terceiro declarado na política. Autohospedar elimina esse terceiro e simplifica uma futura CSP (não feito nesta entrega). |


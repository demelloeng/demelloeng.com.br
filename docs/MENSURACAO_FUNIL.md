# Contrato de mensuração do funil — DEMELLO Engenharia

Estado: **implementado no site, sem nenhum fornecedor conectado.** Nenhum evento sai do navegador para qualquer serviço externo.
Este documento não é publicado (fora da allowlist de `.github/pages/allowlist.txt`).

## 1. Como funciona

```
 página estática ──┐                                     ┌─► CustomEvent "demello:analytics" (window)  ← destino neutro padrão
 /orcamento/ (SPA) ┴─► assets/js/analytics.mjs ──────────┤
   (via src/tracking.mjs)   valida + remove o que não    └─► window.DemelloAnalytics.subscribe(fn)    ← ponto de conexão
                            está no contrato + deduplica
```

- **`assets/js/analytics.mjs`** — contrato fechado de eventos e parâmetros, deduplicação, destinos ("sinks"). Sem rede, sem cookie, sem storage.
- **`assets/js/site-analytics.mjs`** — carregado por todas as páginas estáticas; dispara só `page_view`.
- **`orcamento-src/src/tracking.mjs`** — ponte da jornada. Monta os parâmetros **apenas** de chaves de rota/nó e de códigos de serviço derivados pelo motor; nunca lê texto digitado, contato ou fotos.
- **`orcamento-src/src/funnel.mjs`** — escolhas pós-resultado, validação da dúvida sobre o escopo e a regra de lead qualificado (R1, vigente).
- Respeita `navigator.doNotTrack === '1'` e `navigator.globalPrivacyControl === true`: nesses casos nada é emitido.

## 2. Eventos

| Evento | Emissor | Quando dispara | Parâmetros |
|---|---|---|---|
| `page_view` | site | Ao carregar cada página (estática ou `/orcamento/`). Uma vez por caminho por carga. | `page`, `origin`, `origin_page` |
| `estimate_started` | site | Quando a jornada exibe o primeiro nó de uma rota (por clique ou deep link). **Uma vez por carga.** | `route`, `entry`, `step` |
| `situation_selected` | site | Mesmo momento; uma vez por (rota, disciplina). Rota trocada depois gera novo evento. | `route`, `entry`, `service`*, `step` |
| `estimate_completed` | site | Ao exibir o resultado **com estimativa calculada** (X3A + motor `CALCULATED`). Novo evento só se as respostas mudarem. | `route`, `service`, `service_count`, `result_status`, `step` |
| `framing_delivered` *(extra)* | site | Ao exibir resultado **sem valor** (avaliação humana ou sinal de risco). | idem |
| `proposal_requested` | site | **Depois** do envio aceito pelo CRM (HTTP 202) com a escolha "Quero receber uma proposta". | `route`, `service`, `service_count`, `request_intent`, `step` |
| `scope_question_requested` | site | Idem, escolha "Tenho uma dúvida sobre o escopo". | idem |
| `evaluation_requested` *(extra)* | site | Idem, caso enviado apenas para avaliação. | idem |
| `qualified_lead` | site (R1) ou crm | Envio aceito **e** regra objetiva R1 satisfeita (§4). | `route`, `service`, `service_count`, `rule` |
| `architecture_area_known` | site | Resultado exibido com Arquitetura e área informada pelo cliente. | `area_source`, `area_band`, `estimation_version` |
| `architecture_area_unknown` | site | Resultado exibido com Arquitetura e área desconhecida. | `area_source`, `estimation_version` |
| `architecture_estimator_started` | site | Estimador acionado (área desconhecida). | `lot_area_band`, `program_size_band`, `estimation_version` |
| `architecture_estimated_by_program` / `_by_lot` / `_by_program_and_lot` | site | Origem da área de referência. | `area_source`, `area_band`, `lot_area_band`/`program_size_band`, `estimation_version` |
| `architecture_estimator_human_review` | site | Dados insuficientes: conferência humana. | `area_source`, `lot_area_band`, `program_size_band`, `estimation_version` |
| `architecture_estimate_presented` | site | Devolutiva da Arquitetura exibida (com área de referência). | `area_source`, `area_band`, `estimation_version` |
| `proposal_sent` | **crm** | **Previsto, não emitido pelo site.** O site não conhece esse resultado. | `route`, `service` |
| `contract_won` | **crm** | **Previsto, não emitido pelo site.** | `route`, `service` |

\* `service` em `situation_selected` só aparece quando o deep link traz uma disciplina válida.

`createTracker({ emitter: 'site' })` **recusa** `proposal_sent` e `contract_won` (`reason: 'not_allowed_emitter'`). Quem emitir esses eventos no futuro (CRM/back-office/Measurement Protocol) deve usar o emissor `crm`.

## 3. Parâmetros (origem, página, rota, disciplina, etapa)

Todo parâmetro tem **validador fechado** (enum ou padrão estrito). Valor fora do contrato é **descartado**, nunca "limpo".

| Parâmetro | Valores | Origem do dado | Onde aparece |
|---|---|---|---|
| `page` | caminho normalizado (`/`, `/servicos/projeto-estrutural/`, …), sem query nem fragmento | `location.pathname` | `page_view` |
| `origin` | `direct` · `internal` · `external` | `document.referrer` (domínio externo **não** é enviado) | `page_view` |
| `origin_page` | caminho interno de onde o visitante veio | `document.referrer` do mesmo domínio | `page_view` (quando `origin=internal`) |
| `route` | `build` · `regularize` · `problem` · `known` · `support` | `answers.route` | eventos da jornada |
| `entry` | `deeplink` · `manual` · `redirect` | como a rota foi aberta | `estimate_started`, `situation_selected` |
| `service` (Arquitetura, Orçamento técnico e Terraplenagem são serviços nativos: `arquitetura`, `orcamento`, `terraplenagem`) | `estrutural` · `hidrossanitario` · `incendio` · `gas_glp` · `arquitetura` · `regularizacao` · `orcamento` · `terraplenagem` · `compatibilizacao` · `consultoria_tecnica` · `mentoria_tecnica` · `multiple` · `none` | códigos do motor (`derivePricingInputs`) ou da tabela de deep links | jornada |
| `service_count` | inteiro 0–11 | idem | jornada |
| `step` | id de nó da jornada (`CA1`, `S1`, `X3A`, `X4`, …) | `id` do nó atual | jornada |
| `result_status` | `calculated` · `needs_review` · `safety_hold` | `resultKind()` | `estimate_completed`, `framing_delivered` |
| `request_intent` | `proposal` · `scope_question` · `evaluation_only` | escolha pós-resultado | pedidos |
| `rule` | `R1` | versão da regra de qualificação | `qualified_lead` |
| `area_source` | `USER_DECLARED` · `NEEDS_PROGRAM_ESTIMATE` · `PROGRAM_AND_LOT_ESTIMATE` · `LOT_ONLY_ESTIMATE` · `HUMAN_REVIEW_REQUIRED` | enum do estimador | eventos `architecture_*` |
| `area_band` | `na` · `lt_60` · `60_100` · `100_150` · `150_250` · `250_400` · `gt_400` | faixa da área de referência (nunca o valor exato) | idem |
| `lot_area_band` | `na` · `lt_200` · `200_360` · `360_600` · `600_1000` · `gt_1000` | faixa do terreno | idem |
| `program_size_band` | `na` · `lt_80` · `80_140` · `140_220` · `gt_220` | faixa da área do programa | idem |
| `estimation_version` | `ARQ_EST_V1` | versão dos parâmetros do estimador | idem |

**Nunca entram:** nome, e-mail, telefone, endereço, cidade/UF, texto livre (relato, dúvida sobre o escopo, outro serviço), nome de arquivo ou foto, área derivada pelo município, regra/versão da base municipal, artigos ou textos normativos, áreas/valores digitados, valor da estimativa, código de verificação da prévia, IDs de submissão, query string, referrer externo.

## 4. Regra de lead qualificado — R1 *(regra comercial vigente, aprovada)*

`qualified_lead` só é emitido quando **todas** as condições são verdadeiras (`evaluateQualifiedLead`, `src/funnel.mjs`):

1. o CRM aceitou o envio (HTTP 202 `accepted`);
2. a escolha foi **"Quero receber uma proposta"** (`request_intent = proposal`);
3. a estimativa foi **calculada e mostrada antes do contato** (`resultKind = calculated`);
4. o caso **não** tem sinal de risco (`safety_hold = false`);
5. o contato é válido (nome + WhatsApp ou e-mail, validação já existente do nó `X4`).

Dúvida sobre escopo, avaliação humana e retenção de segurança **nunca** qualificam por esta regra. Os critérios estão aprovados e não devem ser alterados sem nova decisão comercial (qualquer mudança exige novo valor em `rule`). O evento só é emitido após o HTTP 202, com a disciplina preservada (`service`).

## 5. Não duplicar

- Chave de deduplicação = `nome | parâmetros ordenados` (ou `dedupeKey` explícita), mantida em memória **por carga de página**.
- `React.StrictMode` (efeitos em dobro), re-renderizações e Voltar/Avançar **não** geram evento repetido.
- `estimate_completed`/`framing_delivered`: chave = impressão digital local (FNV-1a) das respostas, **sem** contato e fotos; só muda se alguma resposta mudar. O hash nunca é enviado.
- Pedidos (`*_requested`, `qualified_lead`): chave = `submission_id` idempotente devolvido pelo Worker. "Tentar enviar novamente" não duplica.
- Cobertura: `orcamento-src/tests/analytics.test.mjs`.

## 6. Dados enviados ao CRM (separado da mensuração)

O envio existente ao CRM (`submit.mjs`, Worker de captura) **não mudou**. A escolha pós-resultado entra em `answers` do payload V2 (a dúvida escrita vai em `answers.scope_question`, só no envio confirmado; a proveniência da área da Arquitetura, em `answers.architecture_area`):

| Estado de negócio | `answers.request_intent` | `answers.estimate_state` | `answers.lead_stage` |
|---|---|---|---|
| Estimativa concluída (sem pedido; **não** é enviada ao CRM) | — | — | — |
| Proposta solicitada | `proposal` | `completed` | `proposta_solicitada` |
| Dúvida sobre o escopo | `scope_question` | `completed` | `duvida_sobre_escopo` |
| Caso enviado apenas para avaliação | `evaluation_only` | `not_available` | `caso_para_avaliacao` |

Contrato Worker/CRM: localizado e validado (Marcos); ver `docs/CLASSIFICACAO_WORKER_CRM.md` (os arquivos de esquema não estão neste pacote).

## 7. Como conectar uma ferramenta depois (não feito nesta entrega)

Nada abaixo existe hoje. Exemplos de **onde** ligar — sempre via `subscribe`, sem editar `analytics.mjs`:

```js
// GA4 (gtag.js carregado pela página, com consentimento) — exemplo, NÃO implementado
window.DemelloAnalytics.subscribe((e) => gtag('event', e.name, e.params), { replay: true });

// GTM — exemplo, NÃO implementado
window.DemelloAnalytics.subscribe((e) => window.dataLayer.push({ event: e.name, ...e.params }), { replay: true });

// Meta Pixel (conversões) — exemplo, NÃO implementado; mapear só proposal_requested / qualified_lead
window.DemelloAnalytics.subscribe((e) => { if (e.name === 'proposal_requested') fbq('trackCustom', 'ProposalRequested'); });
```

Passos para conectar de verdade (decisões humanas): (1) escolher a ferramenta e criar a conta/ID; (2) definir a política de consentimento (LGPD) e só carregar a tag após o aceite; (3) incluir o carregador **em um arquivo novo** da allowlist (ex.: `assets/js/analytics-sink.mjs`) e importá-lo depois de `site-analytics.mjs` nas páginas; (4) no `/orcamento/`, o bundle é reconstruído (`pnpm build`) e `build_artifact.py` precisa dos novos nomes (o teste `commercial_site.test.mjs` acusa divergência); (5) ligar `proposal_sent` e `contract_won` a partir do CRM/back-office, não do navegador.

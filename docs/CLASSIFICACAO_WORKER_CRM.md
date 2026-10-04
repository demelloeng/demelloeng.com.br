# Confronto do payload com o contrato Worker/CRM

**Status do contrato (atualizado na publicação da V3): o contrato canônico do Worker/CRM foi LOCALIZADO e VALIDADO** (informação de Marcos, 2026-10-04). A versão anterior deste documento registrava o contrato como não localizado: essa observação estava desatualizada e foi corrigida aqui (contrato localizado e validado).

O que continua verdadeiro e é dito com precisão: os **arquivos de esquema** (`payload.v2.schema.json`, `transport.v1.json`, `validate_payload_v2`) **não fazem parte deste pacote** e esta equipe de desenvolvimento não os reabriu campo a campo; a conferência técnica feita por nós foi contra os documentos de desenho (handoff de pricing e captura-first, em `DEMELLO_ENGENHARIA`). Por isso as linhas abaixo trazem como status "contrato validado (Marcos)" e, na coluna Base, o que foi conferido localmente.

Método da conferência local: payload V2 emitido por `packageForCRMv2` × documentos de desenho. Sem alteração de endpoint.

## Fontes de contrato

| Fonte | Situação |
|---|---|
| Contrato canônico Worker/CRM (`schemas/crm/site-intake/*`, `validate_payload_v2`) | **Localizado e validado** (Marcos). Arquivos de esquema fora deste pacote. |
| `02_COMERCIAL/PROPOSTAS_E_PRECIFICACAO/MA_DEMELLO_HANDOFF_PRICING_V1_PAYLOAD_V2_V01_20260902.md` | Documento de desenho, conferido localmente |
| `07_ADMINISTRATIVO/ARQUIVOS_OPERACIONAIS_2026-09/MA_DEMELLO_PROP_CAPTURE_FIRST_V1_20260902.md` | Desenho do endpoint de captura, conferido localmente |

O que os documentos de desenho afirmam: o `pricing_preview` é **recomputado** no Worker a partir de `pricing_inputs` e precisa bater; campos derivados extras do browser são **ignorados** (não rejeitados); guardas 400/413/422 existem para JSON inválido, `schema`/`source`/`prototype`/`sent_to_crm` e `validate_payload_v2 != []`; Q por serviço: ARQUITETURA→Q_NOVA, ORCAMENTO→Q_ESCOPO, TERRAPLENAGEM→Q_TERRENO.

## Classificação

Legenda: **compatível** · **incompatível** · **contrato validado (Marcos)**. A aceitação em produção é conferida na verificação pós-publicação (endpoint respondendo), sem enviar caso de teste.

| Item do payload | Onde vai | Classificação | Base |
|---|---|---|---|
| `request_intent`, `estimate_state`, `lead_stage` | `answers.*` | **contrato validado (Marcos)** | Esquema `payload.v2` ausente. O desenho diz que campos extras do browser são ignorados (não rejeitados), mas só o esquema/validador confirmam o conteúdo de `answers`. |
| `scope_question` (texto, ≤ 280) | `answers.scope_question` | **contrato validado (Marcos)** | Idem. É texto livre do usuário: só segue no envio confirmado. |
| Arquitetura (`ARQUITETURA`, Q_NOVA) | `pricing_inputs.services`, `area_new`/`area_total` | **compatível** (desenho) (paridade Python) | Mapeamento Q_NOVA no documento de handoff; o motor JS é o mesmo da tabela V2. |
| Orçamento técnico (`ORCAMENTO`, Q_ESCOPO) | `pricing_inputs.services`, `area_escopo` | **compatível** (desenho) · não verificável offline | Handoff: ORCAMENTO→Q_ESCOPO; T24 "sem Q_ESCOPO → não calcular". |
| Terraplenagem (`TERRAPLENAGEM`, Q_TERRENO) | `pricing_inputs.services`, `area_terreno` | **compatível** (desenho) · não verificável offline | Handoff: TERRAPLENAGEM→Q_TERRENO; T23. |
| Reforma sem ampliação | `answers.CA1 = "Reformar sem aumentar a área"`, `answers.CA_REFORMA`, `pricing_inputs.area_existing` | **contrato validado (Marcos)** | O valor novo de `CA1` não consta de nenhum esquema acessível. `pricing_inputs` usa apenas campos já existentes. |
| Estimativa de área da Arquitetura | `answers.architecture_area_source`, `architecture_area_min`, `architecture_area_max`, `architecture_area_reference`, `architecture_estimation_inputs`, `architecture_estimation_version` | **contrato validado (Marcos)** | Campos novos, estruturados (sem texto livre). Sem esquema acessível para confrontar; mantida falha segura: o envio ao CRM e a retentativa não mudaram, e **não se declara homologação**. |
| Área de referência da Arquitetura | `pricing_inputs.area_new` (só quando a Arquitetura é o único serviço que lê a área do projeto) | **contrato validado (Marcos)** | O Worker recomputa o preço a partir do mesmo `area_new`; a origem fica em `architecture_area_source`. |
| Demais campos (`schema`, `source`, `prototype`, `sent_to_crm`, `route`, `summary`, `contact`, `attachments`, `pricing_preview`, `result`) | topo do payload | **compatível** (inalterados) | Código de `payload_v2.mjs` e `submit.mjs` preservado; testes de paridade Python↔JS (91) passam. |

Nenhum item foi classificado como **incompatível** (nada há contra o que provar incompatibilidade). **Nada foi alterado no endpoint nem inventado como contrato.**

## Verificação após a publicação
Conferir que o site publicado responde e que o endpoint do CRM responde, **sem enviar caso de teste** (nenhum POST): requisição não mutante (OPTIONS/GET). Resultado registrado no relatório de publicação.

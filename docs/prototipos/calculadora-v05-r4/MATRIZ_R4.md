# Matriz R4 — calculadora V05 com maquete (candidata local)

Fonte da ordem: `HANDOFF_OPUS_R4_V03.md` (Codex/2026-11-13/.../outputs) + decisões de Marcos em 14/11/2026 (caixas).
Local, sem push/PR/merge/deploy/publicação. Commits só nas branches `exp/` abaixo.

## Bases

| Repositório | Worktree | Branch | Base |
|---|---|---|---|
| site demelloeng.com.br | `MA_DEMELLO_PILOTO/r4-site` | `exp/maquete-3d-v05-r4` | origin/main `598e8f007b61e007e1795fdd06552f5259916f1e` |
| engenharia | `MA_DEMELLO_PILOTO/r4-eng` | `exp/r4-fator-cupons` | origin/main `ea26c6ed4c2a5d11dd81c80815ee4ecd877db6d6` |
| R3 (origem, só leitura) | `MA_DEMELLO_PILOTO/exp-maquete-3d-v05` | `exp/maquete-3d-v05` | `0b760f562afc42f4c081bd4c437ce01311d93b1d` |

## Decisões de Marcos (14/11/2026)

| Item | Decisão |
|---|---|
| R01 | Worktree nova da main; cópia seletiva de lista fechada da R3; dependências pelo lockfile (pnpm `--frozen-lockfile`: o orcamento-src usa pnpm-lock.yaml; "npm ci" da caixa = mesma intenção); build real + servidor 127.0.0.1 + capturas DevTools locais; ZIP `calculadora-v05-r4.zip` com hash; ZIPs R2/R3 intocados. |
| R02.1 | Branch local isolada no repo de engenharia, sem Doc03/CURRENT.json. |
| R02.2 | Fator = política comercial interna, vem da configuração (separado da metodologia, decisão 146). O que foi emitido até agora não tem validade: critério "0,80 reproduzível" dispensado por Marcos. Mecanismo existente (`table_version` + `pricing_rule`, tabela congelada) é mantido; não editar v2 no lugar. |
| R02.3 | QR leva só o identificador da emissão; registro no servidor guarda data/hora, fator, revisão de configuração, valor-base, cupom e total; visível só na área privada. Sem chave nova. |
| R02.4 | Pelo canônico: fator é derivável das referências públicas, não é segredo; não aparece como número na interface comercial. |
| Estética | Passeio em etapas: R06+R11 no layout do Passeio (modelo no palco, escolhas em faixa inferior, Ver por dentro/Voltar ao exterior). Restante do Passeio + Ateliê na R5. Amplia o R06 além de "na composição atual" (mudança de escopo por decisão de Marcos). |

## Matriz ID → estado

| ID | Estado | Arquivos / evidência |
|---|---|---|
| R01 | em andamento | Lista fechada R3: index.html (importmap), LivePlan.jsx, Maquete5.jsx, journey.mjs, maquete5_{building,input,scene,transicao}.mjs, preview.mjs, styles.css. Testes R3 portados: tests/maquete5_{building,b4,transicao}.test.mjs (espelho do protótipo removido: não existe na R4). 13 complementos three@0.160.0 em assets/vendor/three/examples/jsm + allowlist + ORIGEM.txt. Fora: .env.demo, app-demo, demo_*, testes antigos da R3. Suíte: 535/535. |
| R02 | feito (local) | Regime novo `(DEMELLO_V2, STRUCT_COMPOSITE_REFS_R2_FC)`: metodologia R2 (decisão 146) + fator da configuração comercial; R2 (0,80) vira histórico, sem corte registrado. **eng** `ac20838` (motor Python, validador com `factor_revision_errors`, schemas, semente `pricing-config.seed.json` rev. 1 = 0,60; pytest 1327 ok) e `f2d4420` (Worker: D1 `pricing_config` só de inserção, leitura da revisão ativa a cada emissão com falha fechada 503, canonical grava fator + revisão, expectativa exige revisão → 409 `FACTOR_REVISION_MISMATCH`, `GET /api/previews/v1/pricing-config`; npm 129 ok). **site** `4d3d06f` (motor idêntico ao do Worker, `pricing/active_config.mjs`, instantâneo rev. 1 + consulta na abertura; 541 ok). Sentinela conferido nos três motores: sobrado 320/160, 4 serviços = R$ 12.509,76 (6.268,80 + 3.921,60 + 1.121,28 + 1.198,08); terraplanagem 500 m² = R$ 120,00; consultoria 2 h = R$ 258,12. Contratos de metodologia antigos fixam 0,80 só nos testes (`tests/_fator_pin.py`, `tests/support/fator_080.mjs`, D1 falso). O fator aparece na resposta da rota de configuração (não é segredo, R02.4) e nunca na tela. |
| R03 | feito (local) | `maquete5_building.mjs`: `floorsDeclared` (informados) separado de `floors` (representados, até 8); projeção informada prevalece, sem ela média = área total / pavimentos INFORMADOS (14.400/12 = 1.200 m²); `areaProjSource` informada/media/null; `describe` diz "N pavimentos informados, 8 representados"; peça com dimensão não positiva ou não finita é omitida em `generate` (0,01/1: 17→0; 1/2: 2→0; 5/2: 2→0; 10/8: 8→0). `maquete5_input.mjs`: origem pela jornada ativa (`routeNodes`): CA5/CA6 só na rota Construir, programa de Arquitetura só com ARQ_PROG ativo e válido; CA5 desconhecido e "Ainda não sei" não são declaração; área de referência do motor (rota Já sei) não vira área física. Varredura 60–1.000 m² idêntica à anterior (45 sem escada, 44 varandas); sobrado 320/160 idêntico byte a byte (varanda 1,50 m, 16 degraus, patamar). Teste novo `tests/r03_escala.test.mjs`; suíte 552/552. Pendência: a maquete antiga (fallback e chip compacto do celular, `live_plan.mjs` `floorsOf`) ainda lê CA5 sem checar "desconhecido" nem a rota ativa. |
| R04 | pendente | |
| R05 | pendente | |
| R06 | pendente | |
| R07 | pendente | |
| R08 | pendente | Trocar o portão DEMO_ARQ (MODE==='demo') pela opção pública real. |
| R09 | pendente (condicional) | |
| R10 | pendente (condicional) | |
| R11 | pendente (condicional) | |
| R12–R14 | adiados (handoff) | |
| R15 | pendente | Acrescenta cupom e valor-base ao canonical de registros novos (os antigos mantêm a integridade). |
| R16 | pendente | |

## Ordem de ativação (registro; nada disto foi executado)

1. Aplicar `integrations/cloudflare/preview-worker/schema.sql` no D1 (cria `pricing_config` e semeia a revisão 1 = 0,60) **antes** do deploy do Worker R4. Sem a linha, o Worker recusa toda emissão (503 `CONFIG_UNAVAILABLE`, falha fechada).
2. Worker da prévia e site sobem juntos: o site publicado envia `STRUCT_COMPOSITE_REFS_R2` e recebe 409 `REGIME_MISMATCH` assim que o Worker R4 entrar.
3. Depois da ativação, registrar o corte de `STRUCT_COMPOSITE_REFS_R2` em `regime_cutover.json` (`scripts/register_regime_cutover.py`). Enquanto não for registrado, leads R2 continuam aceitos.

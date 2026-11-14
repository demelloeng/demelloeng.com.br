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
| R02 | pendente | |
| R03 | pendente | |
| R04 | pendente | |
| R05 | pendente | |
| R06 | pendente | |
| R07 | pendente | |
| R08 | pendente | Trocar o portão DEMO_ARQ (MODE==='demo') pela opção pública real. |
| R09 | pendente (condicional) | |
| R10 | pendente (condicional) | |
| R11 | pendente (condicional) | |
| R12–R14 | adiados (handoff) | |
| R15 | pendente | |
| R16 | pendente | |

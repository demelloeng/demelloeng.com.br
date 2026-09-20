# src/pricing — motor de previsão DEMELLO V2 no browser

Espelho **client-side** e determinístico do motor canônico
`scripts/site_intake_pricing.py` (checkout `mentes-afiadas-demello-engineering`).
Reproduz a TABELA DEMELLO V2, o regime **corrente** `STRUCT_COMPOSITE_REFS_R1`
(`table_version = DEMELLO_V2`), `factor_demello = 0,80` (interno, nunca exposto), o MIN entre
**totais de referências de escopo equivalente**, o arredondamento (só no total monetário final,
`ROUND_HALF_UP`) e o texto ao cliente.

Este motor só **EMITE** o regime corrente. Os regimes históricos (`DEMELLO_V1` legado e
`STRUCT_INCL_FOUNDATIONS_V2`) são apenas **reproduzidos** pelo motor Python no `validate_payload_v2`,
pelo par `(table_version, pricing_rule)` gravado no próprio preview.

## Arquivos

- `pricing-table.v2.json` — **cópia byte-a-byte** de
  `schemas/crm/site-intake/pricing-table.v2.json` do checkout canônico. Não editar à mão. Para atualizar:
  copiar o arquivo canônico de novo e rodar `npm test` (a paridade com o golden do Python trava os números).
- `decimal.mjs` — aritmética decimal exata em BigInt.
- `engine.mjs` — porte fiel de `site_intake_pricing.py` (regime corrente): `extractPricingInputs`,
  `priceService`, `buildCustomerPricingText`, `buildPricingPreview`. ESTRUTURAL usa **Q_SUPERESTRUTURA**
  (área estrutural total) e **Q_FUNDACAO** (área de projeção/footprint) distintos; a AltoQi é referência de
  superestrutura e entra como referência composta (+ fundação SECID/PR).

## Paridade

`tests/python_parity.test.mjs` compara o motor com `tests/fixtures/python_parity_v2.json`, o **golden gerado
pelo Python** (`python scripts/pricing_shadow_compare.py --golden <arquivo>`, no checkout canônico):
entradas -> `pricing_preview`, objeto inteiro (71 casos: matriz tipologia x sistema x quantidades,
fundação isolada, serviços não estruturais, consultoria/mentoria e casos fail-closed).
`tests/structural_foundations.test.mjs` e `tests/foundation_area.test.mjs` fixam a regra estrutural e a
coleta de Q_FUNDACAO (nenhuma inferência silenciosa).

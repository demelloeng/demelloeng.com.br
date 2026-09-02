# src/pricing — motor de previsão DEMELLO V1 no browser

Espelho **client-side** e determinístico do motor canônico
`scripts/site_intake_pricing.py` (checkout `mentes-afiadas-demello-engineering`).
Não é uma nova política de preço: reproduz a mesma TABELA DEMELLO V1, a mesma
matriz Q, `factor_demello = 0,80`, a menor referência aplicável, o arredondamento
(só no total monetário final, `ROUND_HALF_UP`) e o texto ao cliente.

## Arquivos

- `pricing-table.v1.json` — **cópia byte-a-byte** de
  `schemas/crm/site-intake/pricing-table.v1.json` do checkout canônico.
  Proveniência (HEAD `e02eafe` + delta FOUNDATION_ONLY):
  não editar à mão. Para atualizar: copiar o arquivo canônico de novo e rodar
  `npm test` (a paridade JS↔Python trava os números).
- `decimal.mjs` — aritmética decimal exata em BigInt (add/mul/abs/cmp,
  `quantize` 2 casas ROUND_HALF_UP, `toStr` preservando o expoente como
  `str(Decimal)` do Python, `_money`, `_brl`).
- `engine.mjs` — porte fiel de `site_intake_pricing.py`:
  `extractPricingInputs`, `resolveQ`, `resolveServiceContext`,
  `secidAndAltoqiUnits`, `priceService`, `buildCustomerPricingText`,
  `buildPricingPreview`.

## Paridade

`tests/pricing.test.mjs` prova a igualdade com os casos canônicos já verificados
no Python (BUILD 320 comercial → 9958.40 ; REGULARIZAÇÃO 80/110 → 849.84 ;
AMPLIAÇÃO 200+90 → Q_NOVA 90 / Q_TOTAL 290 ; FUNDAÇÕES isoladas → SECID fundação
× 0,80 ; Drenagem → HIDROSSANITARIO sem duplicidade ; Apartamento/Condomínio →
PREDIO). A validação cruzada offline (payload do frontend →
`validate_payload_v2` → `build_pricing_preview` Python) roda no checkout canônico.

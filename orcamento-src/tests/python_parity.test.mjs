import './support/fator_080.mjs';  // R4: metodologia a 0,80; fator vem da configuração
import { pricePreview } from '../src/pricing/active_config.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';
// Paridade Python <-> site JS (regime corrente DEMELLO_V2 + STRUCT_COMPOSITE_REFS_R2_FC_MIN).
//
// tests/fixtures/python_parity_v2.json é o GOLDEN gerado pelo motor canônico Python
// (mentes-afiadas-demello-engineering: `python scripts/pricing_shadow_compare.py --golden <arquivo>`):
// entradas -> pricing_preview, objeto inteiro. O motor do browser precisa reproduzi-lo EXATAMENTE
// (status, totais, referências, componentes, package, contexto e texto ao cliente).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(await readFile(path.join(dir, 'fixtures', 'python_parity_v2.json'), 'utf8'));
const floorCases = JSON.parse(await readFile(path.join(dir, 'fixtures', 'python_parity_piso.json'), 'utf8'));

for (const fx of floorCases) {
  test(`paridade do piso com Python na configuração de emissão 1 / 0,60: ${fx.name}`, () => {
    assert.deepEqual(buildPricingPreview(fx.inputs, { revision: 1, factor_demello: '0.60' }), fx.preview);
  });
}

test('o golden do Python cobre a matriz completa (68+ casos) no regime corrente', () => {
  assert.ok(golden.length >= 70, `golden com ${golden.length} casos`);
  for (const g of golden) {
    assert.equal(g.preview.table_version, 'DEMELLO_V2', g.name);
    assert.equal(g.preview.pricing_rule, 'STRUCT_COMPOSITE_REFS_R2_FC_MIN', g.name);
  }
});

for (const g of golden) {
  test(`paridade Python <-> site JS: ${g.name}`, () => {
    assert.deepEqual(pricePreview(g.inputs), g.preview);
  });
}

test('o motor do site nunca emite regime histórico', () => {
  for (const g of golden) {
    const pv = pricePreview(g.inputs);
    assert.notEqual(pv.pricing_rule, 'STRUCT_INCL_FOUNDATIONS_V2');
    assert.notEqual(pv.table_version, 'DEMELLO_V1');
  }
});

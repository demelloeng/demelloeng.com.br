import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingSpec, generate, PIL } from '../src/maquete5_building.mjs';

const services = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'];
const house = { floors: 2, typology: 'CASA', standard: 'Alto', services };
const areas = Array.from({ length: 189 }, (_, i) => 60 + i * 5);
const model = (input) => generate(buildingSpec(input));
const steps = (g) => g.parts.filter(p => p.name === 'Escada').length;
const valid = (p) => p.s.every(v => Number.isFinite(v) && v > 0) && p.p.every(Number.isFinite);

function inspect(areaTotal, chosen = services) {
  const input = { ...house, areaTotal, services: chosen };
  const g = model(input);
  // Mesma malha e escada; sem padrão Alto, o gerador nunca aplica B4.
  const baseline = model({ ...input, standard: undefined });
  return { g, lost: Boolean(baseline.dims.hole && !g.dims.hole) || steps(g) < steps(baseline),
    invalid: g.parts.filter(p => !valid(p)) };
}

test('B4: 189 áreas, aberturas e degraus preservados, todas as peças válidas e projeção desenhada', t => {
  const lost = [], invalid = [], balconies = [];
  for (const a of areas) {
    const { g, lost: loss, invalid: bad } = inspect(a);
    if (loss) lost.push(a);
    if (bad.length) invalid.push(a);
    if (g.dims.recess) balconies.push(a);
    const slab = g.parts.find(p => p.name === 'Piso térreo');
    assert.ok(Math.abs(slab.s[0] * slab.s[2] - a / 2) < a / 2 * 0.01, String(a));
  }
  t.diagnostic(JSON.stringify({ inputs: areas.length, lost: lost.length, invalid: invalid.length, balconies: balconies.length }));
  assert.deepEqual({ lost, invalid }, { lost: [], invalid: [] });
});

test('B4: casos críticos, serviços independentes, projeção explícita e repetibilidade', () => {
  for (const areaTotal of [170, 180, 190, 200, 270, 280, 320, 340, 350, 370]) {
    const full = inspect(areaTotal).g;
    for (const chosen of [[], ['ARQUITETURA'], ['ESTRUTURAL'], services, [...services, 'INCENDIO', 'GAS_GLP', 'TERRAPLENAGEM']]) {
      const { g, lost, invalid } = inspect(areaTotal, chosen);
      assert.equal(lost, false, String(areaTotal));
      assert.equal(invalid.length, 0);
      assert.equal(g.dims.recess, full.dims.recess);
      assert.deepEqual(g, model({ ...house, areaTotal, areaProj: areaTotal / 2, services: chosen }));
    }
  }
  const g = model({ ...house, areaTotal: 320, areaProj: 160 });
  assert.equal(g.dims.recess, 1.5);
  assert.equal(steps(g), 16);
  assert.ok(g.dims.hole && g.parts.some(p => p.name === 'Patamar'));
});

test('B4: só casa declarada de dois pavimentos no padrão alto', () => {
  for (const change of [{ floors: 1 }, { floors: 3 }, { floors: 8 }, { floors: undefined },
    { typology: 'PREDIO' }, { typology: undefined }, { standard: 'Médio' }, { standard: undefined }]) {
    assert.equal(model({ ...house, areaProj: 160, ...change }).dims.recess, 0, JSON.stringify(change));
  }
});

test('B4: limites do último vão para escada e divisória', () => {
  const spec = buildingSpec({ ...house, areaProj: 160 });
  for (const [d, threshold] of [[10, 2.7 + 0.5 + 1.5], [7.2, 1.5 + 0.15 + 0.9 / 0.38]]) {
    for (const delta of [-0.000001, 0.000001]) {
      const g = generate({ ...spec, d, w: PIL + 3 * (threshold + delta) });
      assert.equal(g.dims.recess, delta > 0 ? 1.5 : 0);
      assert.ok(g.parts.every(valid));
    }
  }
});

// R4: o espelho do protótipo (docs/prototipos/calculadora-v05-r3/src) não entra no site; a calculadora tem um único gerador.


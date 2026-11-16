// R09 (HANDOFF_OPUS_R4_V03, condicional): Terraplanagem em "Construir ou ampliar", reaproveitando Q_TERR, Q_TERRENO,
// a área do terreno declarada e a camada de terreno. Interface "Terraplanagem", id interno TERRAPLENAGEM. Sem área
// do terreno: sem valor automático. S1 preservado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes, routeNodes, updateAnswer, DISPLAY_LABELS } from '../src/journey.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { livePlanModel } from '../src/live_plan.mjs';
import { maquete5Input } from '../src/maquete5_input.mjs';
import { buildingSpec } from '../src/maquete5_building.mjs';

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const build = (extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '200' }, property: 'Casa/sobrado',
  location: LOC, CA5: { value: '2' }, CA6: 'Médio', ...extra });
const svc = (pv, code) => pv.services.find((s) => s.service === code);

test('R09: opção pública em CA7 e S1, com o rótulo "Terraplanagem" e o id interno TERRAPLENAGEM', () => {
  for (const id of ['CA7', 'S1']) assert.ok(nodes[id].options.some((o) => o.value === 'Terraplenagem'), id);
  assert.equal(DISPLAY_LABELS.Terraplenagem, 'Terraplanagem');
  assert.ok(routeNodes(build({ services: ['Terraplenagem'] })).includes('Q_TERR'), 'reusa a pergunta da área do terreno');
});

test('R09: isolada em Construir, lote 500 m² = R$ 120,00 (fator 0,60); sem área, avaliação humana', () => {
  const pv = packageForCRMv2(build({ services: ['Terraplenagem'], area_terreno: { value: '500' } })).pricing_preview;
  assert.equal(svc(pv, 'TERRAPLENAGEM').demello.total, '120.00');
  assert.equal(pv.total_demello, '120.00');
  const sem = packageForCRMv2(build({ services: ['Terraplenagem'] })).pricing_preview;
  assert.equal(svc(sem, 'TERRAPLENAGEM').status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(sem.total_demello, null);
});

test('R09: junto com Arquitetura, cada serviço usa a sua área (terreno não vira área construída)', () => {
  const a = build({ services: ['Arquitetura', 'Terraplenagem'], area_terreno: { value: '500' } });
  const pv = packageForCRMv2(a).pricing_preview;
  assert.equal(svc(pv, 'TERRAPLENAGEM').demello.total, '120.00');
  assert.equal(pv.pricing_inputs?.area_terreno ?? packageForCRMv2(a).pricing_inputs.area_terreno, '500');
  assert.equal(packageForCRMv2(a).pricing_inputs.area_new, '200');
  const s = buildingSpec(maquete5Input(a));
  assert.equal(s.areaTotal, 200, 'edificação continua com a área declarada');
  assert.equal(s.areaTerreno, 500);
  assert.ok(s.terrain, 'camada de terreno ligada');
  assert.equal(livePlanModel(a).area.kind, 'building');
});

test('R09: desmarcar remove a área do terreno; casa, edifício e comercial chegam ao terreno com edificação', () => {
  const a = build({ services: ['Terraplenagem'], area_terreno: { value: '500' } });
  assert.equal(updateAnswer(a, 'CA7', ['Estrutural']).area_terreno, undefined);
  for (const property of ['Casa/sobrado', 'Residencial multifamiliar', 'Comercial']) {
    const s = buildingSpec(maquete5Input(build({ property, services: ['Terraplenagem'], area_terreno: { value: '800' } })));
    assert.ok(s.terrain && s.hasBuilding, property);
  }
});

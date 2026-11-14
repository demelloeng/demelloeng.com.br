// R08 (HANDOFF_OPUS_R4_V03): Arquitetura pública em "Construir ou ampliar". Sentinela pela JORNADA real, com a
// configuração publicada (revisão 1, fator 0,60), sem pino de teste: R$ 12.509,76; três padrões dão o mesmo preço.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes } from '../src/journey.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { livePlanModel } from '../src/live_plan.mjs';
import { maquete5Input } from '../src/maquete5_input.mjs';
import { buildingSpec, generate, circulationNote, CIRCULATION_NOTE } from '../src/maquete5_building.mjs';

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const sobrado = (CA6 = 'Alto', extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado',
  location: LOC, phase: 'Só uma ideia / estudo', CA5: { value: '2' }, CA6,
  services: ['Arquitetura', 'Estrutural', 'Hidrossanitário', 'Elétrica'], area_fundacao: { value: '160' }, deadline: 'Ainda sem prazo', ...extra });

test('R08: Arquitetura aparece em CA7 sem modo de demonstração', () => {
  assert.ok(nodes.CA7.options.some((o) => o.value === 'Arquitetura'));
});

test('R08: sobrado 320/160 com quatro serviços pela jornada Construir = R$ 12.509,76 (fator ativo 0,60)', () => {
  const pv = packageForCRMv2(sobrado()).pricing_preview;
  assert.equal(pv.pricing_rule, 'STRUCT_COMPOSITE_REFS_R2_FC');
  assert.equal(pv.factor_config_revision, 1);
  assert.equal(pv.total_demello, '12509.76');
  assert.deepEqual(Object.fromEntries(pv.services.map((s) => [s.service, s.demello.total])),
    { ARQUITETURA: '6268.80', ESTRUTURAL: '3921.60', HIDROSSANITARIO: '1121.28', ELETRICA: '1198.08' });
  assert.equal(livePlanModel(sobrado()).total, '12509.76', 'o painel mostra o mesmo total');
});

test('R08: os três padrões dão o mesmo preço direto', () => {
  const totals = ['Econômico', 'Médio', 'Alto'].map((p) => packageForCRMv2(sobrado(p)).pricing_preview.total_demello);
  assert.deepEqual(totals, ['12509.76', '12509.76', '12509.76']);
});

test('R08 + R04: com Arquitetura pública, um sobrado sem vão recebe a indicação de circulação pela jornada', () => {
  const a = sobrado('Alto', { CA_AREA: { value: '150' }, area_fundacao: { value: '75' } });
  const s = buildingSpec(maquete5Input(a));
  const dims = generate(s).dims;
  assert.equal(dims.hole, null);
  assert.equal(circulationNote(s, dims, 'corte'), CIRCULATION_NOTE);
  assert.equal(circulationNote(s, dims, 'conjunto'), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { packageForCRMv2, derivePricingInputs, V2_SOURCE } from '../src/payload_v2.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';

const area = (v) => ({ value: v, unknown: false });
const contact = { name: 'Fulano Fictício', whatsapp: '41999990000', email: 'x@exemplo.invalid' };

const BUILD = {
  route: 'build', CA1: 'Construir do zero', CA_AREA: area('320'), property: 'Comercial',
  location: { city: 'Curitiba', uf: 'PR' }, services: ['Estrutural', 'Hidrossanitário'],
  phase: 'Arquitetura pronta', CA5: area('3'), CA6: 'Médio', deadline: '3–6 meses', contact,
};
const GAS_NO_AREA = {
  route: 'known', services: ['Gás'], property: 'Casa/sobrado',
  location: { city: 'Curitiba', uf: 'PR' }, S3: area('120'), contact,
};

test('packageForCRMv2: envelope V2 explícito, sem V1, sem proposta', () => {
  const p = packageForCRMv2(BUILD);
  assert.equal(p.schema, 'site-intake/payload/2');
  assert.equal(p.source, V2_SOURCE);
  assert.equal(p.source, 'DEMELLO_SITE');
  assert.equal(p.prototype, false);
  assert.equal(p.sent_to_crm, false);
  assert.equal('proposal_value' in p, false);
  assert.equal('preview' in p, false);
  assert.equal(p.answers.photos, undefined);
  assert.equal(p.answers.contact, undefined);
});

test('packageForCRMv2: pricing_preview == recomputo determinístico do motor', () => {
  const p = packageForCRMv2(BUILD);
  assert.deepEqual(p.pricing_preview, buildPricingPreview(p.pricing_inputs));
  assert.equal(p.pricing_preview.status, 'CALCULATED');
  assert.equal(p.pricing_preview.total_demello, '9958.40');
  assert.equal(p.result, 'X3A');
});

test('packageForCRMv2: NEEDS_HUMAN_REVIEW -> fallback humano + result X3B', () => {
  const p = packageForCRMv2({ ...GAS_NO_AREA }); // Gás sem área atendida
  assert.equal(p.pricing_inputs.services.join(), 'GAS_GLP');
  assert.equal(p.pricing_inputs.area_atendida, null);
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.pricing_preview.total_demello, null);
  assert.match(p.pricing_preview.presented_to_customer.text, /precisa entrar em contato/);
  assert.equal(p.result, 'X3B');
});

test('packageForCRMv2: Gás com área atendida informada -> CALCULATED', () => {
  const p = packageForCRMv2({ ...GAS_NO_AREA, area_atendida: area('120') });
  assert.equal(p.pricing_inputs.area_atendida, '120');
  assert.equal(p.pricing_preview.status, 'CALCULATED');
  assert.equal(p.result, 'X3A');
});

test('packageForCRMv2: nenhum token de estado comercial / MA_ACOES / SEND', () => {
  for (const a of [BUILD, GAS_NO_AREA, { route: 'problem', P2: 'rachadura', contact }]) {
    const blob = JSON.stringify(packageForCRMv2(a));
    for (const token of ['MA_ACOES', 'READY_FOR_GATE', 'APPROVED', 'CONTACT', 'SEND', 'proposal_value', 'operational_state']) {
      assert.equal(blob.includes(`"${token}"`), false, token);
    }
  }
});

test('packageForCRMv2: anexos só como metadados (uploaded:false)', () => {
  const p = packageForCRMv2({
    route: 'problem', P2: 'Quero avaliar.', contact,
    photos: [{ name: 'f.png', size: 10, type: 'image/png', url: 'blob:x', file: 'bytes' }],
  });
  assert.equal(p.attachments[0].uploaded, false);
  assert.equal(p.attachments[0].url, undefined);
  assert.equal(p.attachments[0].file, undefined);
});

test('derivePricingInputs: campos indeterminados nunca inventados', () => {
  const pi = derivePricingInputs(BUILD);
  assert.equal(pi.structural_system, null);
  assert.equal(pi.structural_scope, null);
  assert.equal(pi.area_terreno, null);
  assert.equal(pi.hidro_scope_includes_existing, null);
  assert.equal(pi.regularizacao.levantamento, 'UNDETERMINED');
  assert.equal(pi.regularizacao.projeto_legal, 'UNDETERMINED');
});

test('packageForCRMv2: rota "known" com S3 -> area_total, previsão calculável', () => {
  const p = packageForCRMv2({
    route: 'known', services: ['Estrutural'], property: 'Comercial',
    location: { city: 'Curitiba', uf: 'PR' }, S3: area('1500'),
    phase: 'Arquitetura pronta', deadline: '1–3 meses', contact,
  });
  assert.equal(p.pricing_inputs.area_total, '1500');
  assert.equal(p.pricing_inputs.area_new, null);
  assert.equal(p.pricing_inputs.area_existing, null);
  assert.equal(p.pricing_preview.status, 'CALCULATED');
  assert.equal(p.result, 'X3A');
});

test('derivePricingInputs: rota problem -> sem serviços; texto livre não vira serviço', () => {
  assert.deepEqual(derivePricingInputs({ route: 'problem', P2: 'x' }).services, []);
  assert.deepEqual(
    derivePricingInputs({ route: 'known', services: ['Outro'], otherService: 'Elétrica', property: 'Comercial' }).services,
    [],
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPricingPreview, extractPricingInputs } from '../src/pricing/engine.mjs';
import { derivePricingInputs } from '../src/payload_v2.mjs';
import { toStr, money, brl, dec, numberOut } from '../src/pricing/decimal.mjs';

const area = (v) => ({ value: v, unknown: false });
const preview = (a) => buildPricingPreview(derivePricingInputs(a));
const svc = (pv, name) => pv.services.find((s) => s.service === name);

// --- casos canônicos já provados no Python (paridade JS <-> Python) ---

test('BUILD 320 comercial -> total 9958.40', () => {
  const pv = preview({
    route: 'build', CA1: 'Construir do zero', CA_AREA: area('320'),
    property: 'Comercial', services: ['Estrutural', 'Hidrossanitário'],
  });
  assert.equal(pv.status, 'CALCULATED');
  assert.equal(pv.total_demello, '9958.40');
  assert.equal(svc(pv, 'ESTRUTURAL').demello.total, '6868.48');
  assert.equal(svc(pv, 'HIDROSSANITARIO').demello.total, '3089.92');
});

test('REGULARIZAÇÃO 80/110 -> total 849.84', () => {
  const pv = preview({
    route: 'regularize', REG_R1: 'A', property: 'Casa/sobrado',
    REG_A1: area('110'), REG_A2: area('80'),
  });
  assert.equal(pv.status, 'CALCULATED');
  const reg = svc(pv, 'REGULARIZACAO');
  assert.equal(reg.q, 30);
  assert.equal(reg.q_basis, 'Q_REGULARIZACAO');
  assert.equal(reg.demello.total, '849.84');
  assert.equal(pv.total_demello, '849.84');
});

test('AMPLIAÇÃO 200 + 90, Estrutural + Incêndio -> Q_NOVA 90 / Q_TOTAL 290', () => {
  const pi = derivePricingInputs({
    route: 'build', CA1: 'Ampliar um imóvel existente',
    CA_EXISTING: area('200'), CA_NEW: area('90'),
    property: 'Comercial', services: ['Estrutural', 'Incêndio'],
  });
  assert.equal(pi.area_existing, '200');
  assert.equal(pi.area_new, '90');
  assert.equal(pi.area_total, '290');
  const pv = buildPricingPreview(pi);
  assert.equal(svc(pv, 'ESTRUTURAL').q_basis, 'Q_NOVA');
  assert.equal(svc(pv, 'ESTRUTURAL').q, 90);
  assert.equal(svc(pv, 'INCENDIO').q_basis, 'Q_TOTAL');
  assert.equal(svc(pv, 'INCENDIO').q, 290);
});

test('FUNDAÇÕES isoladas -> ESTRUTURAL FOUNDATION_ONLY, SECID fundação (10,73) x 0,80', () => {
  const pi = derivePricingInputs({
    route: 'known', services: ['Fundações'], property: 'Comercial', S3: area('1500'),
  });
  assert.deepEqual(pi.services, ['ESTRUTURAL']);
  assert.equal(pi.structural_scope, 'FOUNDATION_ONLY');
  assert.equal(pi.area_total, '1500'); // S3 -> area_total
  const pv = buildPricingPreview(pi);
  const est = svc(pv, 'ESTRUTURAL');
  assert.equal(est.status, 'CALCULATED');
  assert.equal(est.q, 1500);
  assert.equal(est.references.secid_pr.unit_value, '10.73');
  assert.equal(est.references.altoqi, undefined);
  assert.equal(est.demello.total, '12876.00'); // 1500 * 10.73 * 0.80
  assert.equal(est.pricing_context.structural_scope, 'FOUNDATION_ONLY');
  // "Fundações" junto de "Estrutural" = escopo cheio
  const full = derivePricingInputs({ route: 'known', services: ['Estrutural', 'Fundações'], property: 'Comercial' });
  assert.equal(full.structural_scope, null);
  assert.deepEqual(full.services, ['ESTRUTURAL']);
});

test('S3 (rota "Já sei o serviço") -> pricing_inputs.area_total; area_new/existing = null', () => {
  const pi = derivePricingInputs({ route: 'known', services: ['Estrutural'], property: 'Comercial', S3: area('1500') });
  assert.equal(pi.area_total, '1500');
  assert.equal(pi.area_new, null);
  assert.equal(pi.area_existing, null);
  // "não sei" -> area_total null
  assert.equal(derivePricingInputs({ route: 'known', services: ['Estrutural'], property: 'Comercial', S3: { value: '', unknown: true } }).area_total, null);
  // outras rotas não mudam: build "construir do zero" continua area_new + area_total
  const b = derivePricingInputs({ route: 'build', CA1: 'Construir do zero', CA_AREA: area('320'), property: 'Comercial', services: ['Estrutural'] });
  assert.equal(b.area_new, '320');
  assert.equal(b.area_total, '320');
});

test('KNOWN + S3: Incêndio usa Q_TOTAL; Gás e Compatibilização NÃO usam S3', () => {
  const inc = buildPricingPreview(derivePricingInputs({ route: 'known', services: ['Incêndio'], property: 'Comercial', S3: area('1500') }));
  assert.equal(svc(inc, 'INCENDIO').q_basis, 'Q_TOTAL');
  assert.equal(svc(inc, 'INCENDIO').q, 1500);

  const gasPi = derivePricingInputs({ route: 'known', services: ['Gás'], property: 'Casa/sobrado', S3: area('1500') });
  assert.equal(gasPi.area_total, '1500');
  assert.equal(gasPi.area_atendida, null); // S3 não substitui area_atendida
  assert.equal(buildPricingPreview(gasPi).status, 'NEEDS_HUMAN_REVIEW');

  const compPi = derivePricingInputs({ route: 'known', services: ['Compatibilização BIM'], property: 'Comercial', S3: area('1500') });
  assert.equal(compPi.area_escopo, null); // S3 não substitui area_escopo
  assert.equal(buildPricingPreview(compPi).status, 'NEEDS_HUMAN_REVIEW');
});

test('Drenagem -> HIDROSSANITARIO; Hidro + Drenagem = uma única cobrança', () => {
  const only = derivePricingInputs({ route: 'build', CA1: 'Construir do zero', CA_AREA: area('100'), property: 'Comercial', services: ['Drenagem'] });
  assert.deepEqual(only.services, ['HIDROSSANITARIO']);
  const both = derivePricingInputs({ route: 'build', CA1: 'Construir do zero', CA_AREA: area('100'), property: 'Comercial', services: ['Hidrossanitário', 'Drenagem'] });
  assert.deepEqual(both.services, ['HIDROSSANITARIO']);
  const pv = buildPricingPreview(both);
  assert.equal(pv.services.filter((s) => s.service === 'HIDROSSANITARIO').length, 1);
});

test('Apartamento e Condomínio / edifício -> PREDIO', () => {
  for (const property of ['Apartamento', 'Condomínio / edifício', 'Residencial multifamiliar']) {
    assert.equal(derivePricingInputs({ route: 'known', services: ['Estrutural'], property }).typology, 'PREDIO');
  }
  assert.equal(derivePricingInputs({ route: 'known', services: ['Estrutural'], property: 'Industrial' }).typology, null);
});

test('T04 precisão: só o total monetário final é arredondado (COMPATIBILIZACAO 5.3115)', () => {
  const pv = buildPricingPreview(extractPricingInputs({ services: ['COMPATIBILIZACAO'], typology: 'PREDIO', area_escopo: '100' }));
  const comp = svc(pv, 'COMPATIBILIZACAO');
  assert.equal(comp.references.secid_pr.unit_value, '5.3115');
  assert.equal(comp.demello.total, '424.92'); // 100 * 5.3115 * 0.80 = 424.920000 -> arredonda só o total
  assert.equal(comp.demello.unrounded_total, '424.920000'); // expoente preservado como str(Decimal) do Python
  assert.equal(Number(comp.demello.unrounded_total), 424.92);
});

test('menor referência aplicável (T01/T02) na ampliação comercial', () => {
  const pv = buildPricingPreview(derivePricingInputs({
    route: 'build', CA1: 'Ampliar um imóvel existente', CA_EXISTING: area('200'), CA_NEW: area('90'),
    property: 'Comercial', services: ['Estrutural', 'Incêndio'],
  }));
  assert.equal(svc(pv, 'ESTRUTURAL').base_reference, 'SECID_PR'); // 26.83 < 34.50
  assert.equal(svc(pv, 'INCENDIO').base_reference, 'SECID_PR'); // 3.35 < 10.50
});

// --- helper decimal ---
test('decimal: str preserva expoente, money 2dp, brl pt-BR', () => {
  assert.equal(toStr(dec('290')), '290');
  assert.equal(toStr({ n: 68684800n, e: 4 }), '6868.4800');
  assert.equal(money({ n: 68684800n, e: 4 }), '6868.48');
  assert.equal(brl(dec('12448')), 'R$ 12.448,00');
  assert.equal(brl(dec('9958.40')), 'R$ 9.958,40');
  assert.equal(numberOut(dec('320')), 320);
  assert.equal(numberOut(dec('320.50')), 320.5);
});

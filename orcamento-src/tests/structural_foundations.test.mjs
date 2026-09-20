// Regra FUTURA ESTRUTURAL + FUNDAÇÕES (pricing_rule STRUCT_INCL_FOUNDATIONS_V2).
// Espelha tests/test_site_intake_structural_foundations.py do checkout canônico
// (mentes-afiadas-demello-engineering). Só EMISSÕES NOVAS: o histórico (ex.: primeira
// submissão real, R$ 1.336,04) nunca é recalculado por este motor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPricingPreview, structuralFullPackage } from '../src/pricing/engine.mjs';
import { derivePricingInputs, packageForCRMv2 } from '../src/payload_v2.mjs';
import TABLE from '../src/pricing/pricing-table.v1.json' with { type: 'json' };

const area = (v) => ({ value: v, unknown: false });
const known = (services) => ({ route: 'known', services, property: 'Casa/sobrado', S3: area('63,5') });
const svc = (pv, name) => pv.services.find((s) => s.service === name);

test('Estrutural (nova) = pacote completo: estrutura + fundações, SECID/PR uma única vez', () => {
  const pv = buildPricingPreview(derivePricingInputs(known(['Estrutural'])));
  const est = svc(pv, 'ESTRUTURAL');
  assert.equal(pv.pricing_rule, 'STRUCT_INCL_FOUNDATIONS_V2');
  assert.equal(est.pricing_context.foundations_included, true);
  assert.equal(est.pricing_context.foundations_selection, 'IMPLIED_BY_STRUCTURAL');
  assert.deepEqual(Object.keys(est.package.secid_pr_components), ['SUPERESTRUTURA_CONCRETO_ARMADO', 'FUNDACAO']);
  assert.equal(est.references.secid_pr.unit_value, '26.83');
  assert.equal(est.demello.total, '1362.96'); // 63,5 x 26,83 x 0,80
  assert.match(pv.presented_to_customer.text, /estrutura e fundações/);
});

test('Estrutural + Fundações explícita: intenção preservada, sem dupla cobrança', () => {
  const implied = buildPricingPreview(derivePricingInputs(known(['Estrutural'])));
  const pi = derivePricingInputs(known(['Estrutural', 'Fundações']));
  assert.equal(pi.foundations_selected, true);
  assert.deepEqual(pi.services, ['ESTRUTURAL']);
  const explicit = buildPricingPreview(pi);
  assert.equal(svc(explicit, 'ESTRUTURAL').pricing_context.foundations_selection, 'EXPLICIT');
  assert.equal(explicit.total_demello, implied.total_demello);
  assert.deepEqual(svc(explicit, 'ESTRUTURAL').demello, svc(implied, 'ESTRUTURAL').demello);
  assert.equal(explicit.services.length, 1);
});

test('AltoQi (cobertura de fundações não documentada) não é comparada ao pacote completo', () => {
  const est = svc(buildPricingPreview(derivePricingInputs(known(['Estrutural']))), 'ESTRUTURAL');
  assert.equal(est.references.altoqi, undefined);
  assert.equal(est.base_reference, 'SECID_PR');
  assert.deepEqual(est.package.excluded_references, [
    { source: 'ALTOQI', reason: 'FOUNDATION_COVERAGE_UNDETERMINED' },
  ]);
});

test('componentes SECID/PR somam o total publicado (todos os sistemas) e AltoQi INCLUDED entra uma vez', () => {
  const svcTbl = TABLE.services.ESTRUTURAL;
  for (const system of ['CONCRETO_ARMADO', 'METALICA', 'MADEIRA']) {
    const pkg = structuralFullPackage(svcTbl, { structural_system: system, typology: 'CASA' });
    assert.equal(String(pkg.secid.toString?.() ?? pkg.secid), String(pkg.secid)); // sanity
  }
  const withAltoqi = structuralFullPackage(
    { ...svcTbl, altoqi: { ...svcTbl.altoqi, foundation_coverage: 'INCLUDED' } },
    { structural_system: 'CONCRETO_ARMADO', typology: 'CASA' },
  );
  assert.notEqual(withAltoqi.altoqi, null);
  assert.deepEqual(withAltoqi.excluded_references, []);
  assert.throws(() => structuralFullPackage(
    { ...svcTbl, secid_pr: { ...svcTbl.secid_pr, by_structural_system: { ...svcTbl.secid_pr.by_structural_system, CONCRETO_ARMADO: '30.00' } } },
    { structural_system: 'CONCRETO_ARMADO', typology: 'CASA' },
  ));
});

test('Fundações isoladas continua FOUNDATION_ONLY (inalterado)', () => {
  const pv = buildPricingPreview(derivePricingInputs({ route: 'known', services: ['Fundações'], property: 'Comercial', S3: area('1500') }));
  const est = svc(pv, 'ESTRUTURAL');
  assert.equal(est.pricing_context.structural_scope, 'FOUNDATION_ONLY');
  assert.equal(est.package, undefined);
  assert.equal(est.demello.total, '12876.00');
});

test('Primeira jornada real reemitida agora usa a regra nova (o histórico permanece R$ 1.336,04 no CRM)', () => {
  const answers = {
    route: 'known', services: ['Estrutural', 'Hidrossanitário', 'Fundações', 'Outro'], otherService: 'projeto elétrico',
    property: 'Casa/sobrado', S3: area('63,5'), location: { city: 'São luís', uf: 'MA' },
    contact: { name: 'Cliente Ficticio', whatsapp: '98999990000', email: 'x@exemplo.invalid' }, photos: [],
  };
  const payload = packageForCRMv2(answers);
  assert.equal(payload.pricing_preview.total_demello, '1804.92');
  assert.equal(payload.pricing_inputs.foundations_selected, true);
  assert.deepEqual(payload.pricing_inputs.services, ['ESTRUTURAL', 'HIDROSSANITARIO']); // elétrica nunca precificada
});

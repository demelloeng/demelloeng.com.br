// Regime CORRENTE ESTRUTURAL (DEMELLO_V2 + STRUCT_COMPOSITE_REFS_R2, revisão R2 da tabela de 08/11/2026).
// Espelha tests/test_site_intake_pricing_v2.py do checkout canônico (mentes-afiadas-demello-engineering).
// Este motor só EMITE o regime corrente: histórico (legado e STRUCT_INCL_FOUNDATIONS_V2, ex.: primeira
// submissão real, R$ 1.336,04) nunca é recalculado aqui — é reproduzido pelo motor canônico pelo par gravado.
import test from 'node:test';
import './support/catalogo.mjs';
import assert from 'node:assert/strict';
import { buildPricingPreview } from '../src/pricing/engine.mjs';
import { derivePricingInputs, packageForCRMv2 } from '../src/payload_v2.mjs';
import TABLE from '../src/pricing/pricing-table.v2.json' with { type: 'json' };

const area = (v) => ({ value: v, unknown: false });
const svc = (pv, name) => pv.services.find((s) => s.service === name);
const excluded = (est) => Object.fromEntries(est.package.excluded_references.map((e) => [e.source, e.reason]));
const inputs = (over) => ({ services: ['ESTRUTURAL'], area_total: '63,5', area_fundacao: '63,5', ...over });
const est = (over) => svc(buildPricingPreview(inputs(over)), 'ESTRUTURAL');

test('regime corrente: DEMELLO_V2 + STRUCT_COMPOSITE_REFS_R2 (nunca o regime histórico)', () => {
  const pv = buildPricingPreview(inputs({ typology: 'CASA' }));
  assert.equal(pv.table_version, 'DEMELLO_V2');
  assert.equal(pv.pricing_rule, 'STRUCT_COMPOSITE_REFS_R2');
  assert.notEqual(pv.pricing_rule, 'STRUCT_COMPOSITE_REFS_R1');
  assert.notEqual(pv.pricing_rule, 'STRUCT_INCL_FOUNDATIONS_V2');
  assert.equal(TABLE.table_version, 'DEMELLO_V2');
  assert.equal(TABLE.factor_demello, '0.80');
});

test('matriz tipologia x sistema (63,5 m2 térreo): SECID, AltoQi composta e FUNDEPAR', () => {
  const cases = [
    // R2 (Opção A): a FUNDEPAR participa de qualquer tipologia; a AltoQi composta só em concreto armado; madeira só SECID.
    ['CASA', 'CONCRETO_ARMADO', '1275.08', 'FUNDEPAR_001_2025', ['secid_pr', 'altoqi_composta', 'fundepar_001_2025']],
    ['CASA', 'METALICA', '1171.45', 'FUNDEPAR_001_2025', ['secid_pr', 'fundepar_001_2025']],
    ['CASA', 'MADEIRA', '1432.05', 'SECID_PR', ['secid_pr']],
    ['PREDIO', 'CONCRETO_ARMADO', '1275.08', 'FUNDEPAR_001_2025', ['secid_pr', 'altoqi_composta', 'fundepar_001_2025']],
    ['PREDIO', 'METALICA', '1171.45', 'FUNDEPAR_001_2025', ['secid_pr', 'fundepar_001_2025']],
    ['PREDIO', 'MADEIRA', '1432.05', 'SECID_PR', ['secid_pr']],
    ['COMERCIAL', 'CONCRETO_ARMADO', '1275.08', 'FUNDEPAR_001_2025', ['secid_pr', 'altoqi_composta', 'fundepar_001_2025']],
    ['EDUCACIONAL', 'CONCRETO_ARMADO', '1275.08', 'FUNDEPAR_001_2025', ['secid_pr', 'fundepar_001_2025']],
    ['EDUCACIONAL', 'METALICA', '1171.45', 'FUNDEPAR_001_2025', ['secid_pr', 'fundepar_001_2025']],
  ];
  for (const [typology, system, total, winner, refs] of cases) {
    const e = est({ typology, structural_system: system });
    assert.equal(e.demello.total, total, `${typology}/${system}`);
    assert.equal(e.base_reference, winner, `${typology}/${system}`);
    assert.deepEqual(Object.keys(e.references).sort(), [...refs].sort(), `${typology}/${system}`);
  }
});

test('AltoQi: referência de SUPERESTRUTURA; composta = superestrutura AltoQi + fundação SECID/PR; metálica/madeira fora', () => {
  const e = est({ typology: 'PREDIO', structural_system: 'CONCRETO_ARMADO', area_total: '200', area_fundacao: '80' });
  const c = e.references.altoqi_composta.components;
  assert.deepEqual([c.superestrutura.source, c.superestrutura.unit_value, c.superestrutura.q], ['ALTOQI', '14.40', 200]);
  assert.deepEqual([c.fundacao.source, c.fundacao.unit_value, c.fundacao.q], ['SECID_PR', '11.87', 80]);
  assert.equal(e.references.altoqi_composta.total, '3829.60'); // 14,40 x 200 + 11,87 x 80
  assert.equal(e.references.altoqi, undefined); // a chave "altoqi" nunca carrega o total composto
  assert.equal(e.base_reference, 'ALTOQI_COMPOSTA');
  assert.equal(e.demello.total, '3063.68'); // R2: menor total = AltoQi composta 3.829,60
  for (const system of ['METALICA', 'MADEIRA']) {
    const m = est({ typology: 'PREDIO', structural_system: system });
    assert.equal(excluded(m).ALTOQI_COMPOSTA, 'SYSTEM_SCOPE_UNDOCUMENTED', system);
  }
});

test('FUNDEPAR R2: itens 6.1 a 6.3 não distinguem categoria de edificação e participam de qualquer tipologia (Opção A)', () => {
  for (const typology of ['CASA', 'PREDIO', 'COMERCIAL', 'EDUCACIONAL']) {
    const e = est({ typology });
    assert.equal(excluded(e).FUNDEPAR_001_2025, undefined, typology);
    assert.equal(e.references.fundepar_001_2025.total, '1593.85', typology); // (15,75 + 9,35) x 63,5
    assert.ok(e.package.references_compared.includes('FUNDEPAR_001_2025'), typology);
  }
  assert.equal('applicable_typologies' in TABLE.services.ESTRUTURAL.components.SUPERESTRUTURA.FUNDEPAR_001_2025, false);
  assert.equal('not_confirmed_typologies' in TABLE.services.ESTRUTURAL.components.FUNDACAO.FUNDEPAR_001_2025, false);
  // madeira do FUNDEPAR não integra a V2 consolidada
  assert.equal(excluded(est({ typology: 'EDUCACIONAL', structural_system: 'MADEIRA' })).FUNDEPAR_001_2025, 'SYSTEM_NOT_INCORPORATED');
});

test('Q_SUPERESTRUTURA = Q_FUNDACAO (térreo) x Q_SUPERESTRUTURA > Q_FUNDACAO (multi-pavimento) usam quantidades distintas', () => {
  const same = est({ typology: 'PREDIO', area_total: '100', area_fundacao: '100' });
  assert.equal(same.demello.total, '2008.00'); // FUNDEPAR (15,75 + 9,35) x 100 x 0,80
  const multi = est({ typology: 'PREDIO', area_total: '200', area_fundacao: '80' });
  assert.equal(multi.q, 200);
  assert.equal(multi.q_fundacao, 80);
  assert.equal(multi.references.secid_pr.total, '4509.60'); // 17,80 x 200 + 11,87 x 80
  assert.equal(multi.demello.total, '3063.68'); // AltoQi composta 14,40 x 200 + 11,87 x 80 = 3.829,60 x 0,80
  assert.notEqual(multi.demello.total, '4016.00'); // um único Q (200) para as duas parcelas daria outro valor (FUNDEPAR 25,10 x 200 x 0,80)
  assert.equal(est({ typology: 'EDUCACIONAL', structural_system: 'METALICA', area_total: '250', area_fundacao: '100' }).demello.total, '3130.00');
});

test('sem Q_FUNDACAO / valor inconsistente: NEEDS_HUMAN_REVIEW, nunca preço aproximado', () => {
  for (const over of [{ area_fundacao: null }, { area_fundacao: '0' }, { area_fundacao: '-3' }, { area_fundacao: 'abc' }]) {
    const pv = buildPricingPreview(inputs({ typology: 'CASA', ...over }));
    assert.equal(pv.status, 'NEEDS_HUMAN_REVIEW', JSON.stringify(over));
    assert.equal(pv.total_demello, null);
    assert.match(svc(pv, 'ESTRUTURAL').reason, /Q_FUNDACAO/);
  }
  const bigger = svc(buildPricingPreview(inputs({ typology: 'CASA', area_total: '100', area_fundacao: '120' })), 'ESTRUTURAL');
  assert.equal(bigger.status, 'NEEDS_HUMAN_REVIEW');
  assert.match(bigger.reason, /maior que Q_SUPERESTRUTURA/);
});

test('Estrutural + Fundações explícita: intenção preservada, fundação uma única vez', () => {
  const answers = (services) => ({ route: 'known', services, property: 'Casa/sobrado', S3: area('63,5'), area_fundacao: area('63,5') });
  const implied = buildPricingPreview(derivePricingInputs(answers(['Estrutural'])));
  const pi = derivePricingInputs(answers(['Estrutural', 'Fundações']));
  assert.equal(pi.foundations_selected, true);
  assert.deepEqual(pi.services, ['ESTRUTURAL']);
  const explicit = buildPricingPreview(pi);
  assert.equal(svc(explicit, 'ESTRUTURAL').pricing_context.foundations_selection, 'EXPLICIT');
  assert.equal(svc(implied, 'ESTRUTURAL').pricing_context.foundations_selection, 'IMPLIED_BY_STRUCTURAL');
  assert.equal(explicit.total_demello, implied.total_demello);
  assert.deepEqual(svc(explicit, 'ESTRUTURAL').demello, svc(implied, 'ESTRUTURAL').demello);
  assert.equal(explicit.services.length, 1);
  for (const ref of Object.values(svc(explicit, 'ESTRUTURAL').references)) {
    assert.deepEqual(Object.keys(ref.components), ['superestrutura', 'fundacao']); // uma fundação por referência
  }
});

test('Fundações isoladas = FOUNDATION_ONLY sobre Q_FUNDACAO', () => {
  const pv = buildPricingPreview(derivePricingInputs({
    route: 'known', services: ['Fundações'], property: 'Comercial', S3: area('1500'), area_fundacao: area('1500'),
  }));
  const e = svc(pv, 'ESTRUTURAL');
  assert.equal(e.pricing_context.structural_scope, 'FOUNDATION_ONLY');
  assert.equal(e.q_basis, 'Q_FUNDACAO');
  assert.equal(e.demello.total, '11220.00'); // FUNDEPAR 1500 x 9,35 x 0,80 (menor que SECID 11,87)
  assert.equal(svc(buildPricingPreview({ services: ['ESTRUTURAL'], structural_scope: 'FOUNDATION_ONLY', typology: 'EDUCACIONAL', area_fundacao: '80' }), 'ESTRUTURAL').demello.total, '598.40');
});

test('Primeira jornada real reemitida agora: sem Q_FUNDACAO falha fechado; com a projeção informada usa o regime corrente', () => {
  const answers = {
    route: 'known', services: ['Estrutural', 'Hidrossanitário', 'Fundações', 'Outro'], otherService: 'projeto elétrico',
    property: 'Casa/sobrado', S3: area('63,5'), location: { city: 'São Luís', uf: 'MA', ibge_id: '2111300' },
    contact: { name: 'Cliente Ficticio', whatsapp: '98999990000', email: 'x@exemplo.invalid' }, photos: [],
  };
  const semProjecao = packageForCRMv2(answers);
  assert.equal(semProjecao.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(semProjecao.result, 'X3B');
  const payload = packageForCRMv2({ ...answers, area_fundacao: area('63,5') });
  assert.equal(payload.pricing_preview.total_demello, '1571.75'); // estrutural 1275,08 + hidro 296,67 (R2)
  assert.equal(payload.pricing_inputs.foundations_selected, true);
  assert.deepEqual(payload.pricing_inputs.services, ['ESTRUTURAL', 'HIDROSSANITARIO']); // elétrica nunca precificada
});

test('preços fechados: consultoria R$ 172,08/h, mentoria R$ 218,12/h e demais serviços inalterados', () => {
  assert.equal(buildPricingPreview({ services: ['CONSULTORIA_TECNICA'], hours: '1' }).total_demello, '172.08');
  assert.equal(buildPricingPreview({ services: ['CONSULTORIA_TECNICA'], hours: '3' }).total_demello, '516.24');
  assert.equal(buildPricingPreview({ services: ['MENTORIA_TECNICA'], hours: '1' }).total_demello, '218.12');
  assert.equal(buildPricingPreview({ services: ['MENTORIA_TECNICA'], hours: '2' }).total_demello, '436.24');
  assert.equal(buildPricingPreview({ services: ['CONSULTORIA_TECNICA'] }).status, 'NEEDS_HUMAN_REVIEW'); // Q_HORAS ausente
  assert.equal(buildPricingPreview({ services: ['HIDROSSANITARIO'], typology: 'CASA', area_new: '100' }).total_demello, '467.20');
  assert.equal(buildPricingPreview({ services: ['HIDROSSANITARIO'], typology: 'EDUCACIONAL', area_new: '100' }).total_demello, '467.20');
});

// Q_FUNDACAO no fluxo real: a MENOR mudança de UX (uma pergunta condicional) e nenhuma inferência silenciosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes, routeNodes, updateAnswer, advance, valid, summary, missingData, terreoDeclared, needsFoundationArea } from '../src/journey.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { referenceEntries, REFERENCE_LABEL } from '../src/references.mjs';
import { buildClientSummary } from '../src/client_summary.mjs';

const area = (v) => ({ value: v, unknown: false });
const contact = { name: 'Fulano Fictício', whatsapp: '41999990000', email: 'x@exemplo.invalid' };
const build = (over = {}) => ({
  route: 'build', CA1: 'Construir do zero', CA_AREA: area('200'), property: 'Comercial', location: { city: 'Curitiba', uf: 'PR' },
  phase: 'Arquitetura pronta', CA5: area('3'), CA6: 'Médio', services: ['Estrutural'], deadline: '3–6 meses', contact, ...over,
});

test('Q_FUND é uma pergunta de área com chave area_fundacao, só para Estrutural/Fundações', () => {
  assert.equal(nodes.Q_FUND.type, 'area');
  assert.equal(nodes.Q_FUND.key, 'area_fundacao');
  assert.match(nodes.Q_FUND.title, /projeção da edificação/);
  assert.ok(routeNodes(build()).includes('Q_FUND'));
  assert.ok(routeNodes(build({ services: ['Fundações'] })).includes('Q_FUND'));
  assert.ok(!routeNodes(build({ services: ['Hidrossanitário'] })).includes('Q_FUND'));
  assert.ok(routeNodes({ route: 'known', services: ['Estrutural'] }).includes('Q_FUND'));
  assert.ok(!routeNodes({ route: 'known', services: ['Gás'] }).includes('Q_FUND'));
});

test('a pergunta vem logo após a seleção de serviços e antes das demais áreas condicionais', () => {
  const a = build({ services: ['Estrutural', 'Gás'] });
  assert.deepEqual(routeNodes(a).slice(-4), ['CA7', 'Q_FUND', 'Q_GAS', 'CA8']);
  assert.equal(advance('CA7', a).id, 'Q_FUND');
  assert.equal(advance('Q_FUND', { ...a, area_fundacao: area('70') }).id, 'Q_GAS');
  assert.equal(valid('Q_FUND', a), false); // sem resposta, a jornada não avança
  assert.equal(valid('Q_FUND', { ...a, area_fundacao: { value: '', unknown: true } }), true); // "Não sei" é resposta válida (fail-closed adiante)
});

test('térreo DECLARADO (construir do zero, 1 pavimento) dispensa a pergunta; casa/sobrado ou "não sei" nunca provam térreo', () => {
  assert.equal(terreoDeclared(build({ CA5: area('1') })), true);
  assert.ok(!routeNodes(build({ CA5: area('1') })).includes('Q_FUND'));
  assert.equal(terreoDeclared(build({ CA5: area('2') })), false);
  assert.equal(terreoDeclared(build({ CA5: { value: '', unknown: true } })), false);
  assert.equal(terreoDeclared(build({ CA5: undefined, property: 'Casa/sobrado' })), false);
  assert.ok(routeNodes(build({ CA5: undefined, property: 'Casa/sobrado' })).includes('Q_FUND'));
  assert.equal(terreoDeclared(build({ CA1: 'Ampliar um imóvel existente', CA5: area('1') })), false); // só "construir do zero"
  assert.equal(terreoDeclared({ route: 'known', services: ['Estrutural'], CA5: area('1') }), false);
});

test('Q_FUNDACAO: informada -> pricing_inputs; térreo declarado = área informada; ausente -> null (nunca estimada)', () => {
  const informed = packageForCRMv2(build({ area_fundacao: area('70') }));
  assert.equal(informed.pricing_inputs.area_fundacao, '70');
  assert.equal(informed.pricing_preview.status, 'CALCULATED');
  const terreo = packageForCRMv2(build({ CA5: area('1') }));
  assert.equal(terreo.pricing_inputs.area_fundacao, '200');
  const missing = packageForCRMv2(build());
  assert.equal(missing.pricing_inputs.area_fundacao, null); // 3 pavimentos e área total 200 NÃO viram 200/3
  assert.equal(missing.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(missing.pricing_preview.total_demello, null);
  assert.equal(missing.result, 'X3B');
  const unknown = packageForCRMv2(build({ area_fundacao: { value: '', unknown: true } }));
  assert.equal(unknown.pricing_inputs.area_fundacao, null);
  assert.equal(unknown.result, 'X3B');
  assert.ok(missingData(build({ area_fundacao: { value: '', unknown: true } })).includes('Área de projeção (fundações)'));
});

test('a resposta de projeção some ao desmarcar o serviço e é refeita quando construir/ampliar ou pavimentos mudam', () => {
  const a = build({ area_fundacao: area('70') });
  assert.equal(updateAnswer(a, 'CA7', ['Hidrossanitário']).area_fundacao, undefined);
  assert.notEqual(updateAnswer(a, 'CA7', ['Estrutural', 'Gás']).area_fundacao, undefined);
  assert.equal(updateAnswer(a, 'CA5', area('1')).area_fundacao, undefined);
  assert.equal(updateAnswer(a, 'CA1', 'Ampliar um imóvel existente').area_fundacao, undefined);
  assert.ok(needsFoundationArea(build({ services: ['Não sei quais preciso'], suggestionConfirmed: true, confirmedSuggestions: ['Estrutural'] })));
  assert.ok(!needsFoundationArea(build({ services: ['Não sei quais preciso'] })));
});

test('o resumo mostra a área de projeção informada; a referência composta nunca aparece como preço AltoQi', () => {
  const rows = summary(build({ area_fundacao: area('70') }));
  assert.ok(rows.some((r) => r.label === 'Área de projeção (fundações)' && r.value === '70 m²'));
  const payload = packageForCRMv2(build({ property: 'Residencial multifamiliar', area_fundacao: area('70') }));
  const est = payload.pricing_preview.services.find((s) => s.service === 'ESTRUTURAL');
  assert.equal(est.base_reference, 'ALTOQI_COMPOSTA');
  const human = buildClientSummary(payload);
  assert.match(human, /Referência de mercado — Estrutural: R\$/);
  assert.doesNotMatch(human, /AltoQi/);
  assert.doesNotMatch(human, /composta|composição|superestrutura|fator|MIN\(|pricing_rule|STRUCT_/i);
});

test('rótulos públicos: chaves internas e públicas -> rótulo comercial, sem composição', () => {
  assert.equal(REFERENCE_LABEL.altoqi_composta, 'Referência de mercado');
  assert.equal(REFERENCE_LABEL.mercado, 'Referência de mercado');
  assert.equal(REFERENCE_LABEL.altoqi, 'AltoQi');
  const entries = referenceEntries({ mercado: { total: '10.00' }, secid_pr: { total: '20.00' }, fundepar: { total: '5.00' }, desconhecida: { total: '1' } });
  assert.deepEqual(entries.map((e) => e.label), ['SECID/PR', 'FUNDEPAR', 'Referência de mercado']);
  assert.deepEqual(referenceEntries(undefined), []);
});

// Serviços horários (Q_HORAS): Consultoria Técnica / Mentoria Técnica ponta a ponta na jornada.
//   jornada -> pricing_inputs (hours é UM escalar) -> pricing_preview (motor) -> payload V2.
// Regras fechadas: horas nunca inferidas/divididas/replicadas; "não sei" => NEEDS_HUMAN_REVIEW;
// Consultoria + Mentoria => NEEDS_HUMAN_REVIEW (fail-closed, sem total); S2/S3 (área/empreendimento) não se aplicam
// a serviço só-horário. Preços fechados: R$ 172,08/h (Consultoria) e R$ 218,12/h (Mentoria).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes, routes, starts, updateAnswer, advance, summary, missingData, valid, hourlyServices } from '../src/journey.mjs';
import { packageForCRMv2, derivePricingInputs } from '../src/payload_v2.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';

const area = (v) => ({ value: v, unknown: false });
const contact = { name: 'Fulano Fictício', whatsapp: '41999990000', email: 'x@exemplo.invalid' };
const LOC = { city: 'Curitiba', uf: 'PR' };

// Caminha a jornada nó a nó a partir da rota, respondendo com `values[id]` (default seguro por tipo).
function walk(route, values) {
  let a = { route };
  let r = advance('HOME', a, 'preview');
  a = r.answers;
  const path = [];
  for (let i = 0; i < 40; i++) {
    const id = r.id;
    path.push(id);
    if (id === 'X1') return { a: { ...a, contact }, path };
    assert.ok(Object.hasOwn(values, id), `resposta ausente para o nó ${id} (caminho: ${path.join(' > ')})`);
    a = updateAnswer(a, id, values[id]);
    assert.ok(valid(id, a), `resposta inválida em ${id}`);
    r = advance(id, a, 'preview');
    a = r.answers;
  }
  throw new Error('caminho não terminou');
}

const svc = (payload, code) => payload.pricing_preview.services.find((s) => s.service === code);

test('HOME: a quinta entrada aparece e as quatro originais permanecem, em ordem', () => {
  const opts = nodes.HOME.options.map((o) => [o.value, o.label]);
  assert.deepEqual(opts, [
    ['build', 'Construir ou ampliar'],
    ['regularize', 'Regularizar meu imóvel'],
    ['problem', 'Avaliar um problema'],
    ['known', 'Já sei o serviço'],
    ['support', 'Preciso de orientação ou apoio técnico'],
  ]);
  assert.equal(starts.support, 'SUP1');
  assert.equal(routes.support, 'Preciso de orientação ou apoio técnico');
});

test('descoberta: 3 saídas em linguagem do cliente, sem árvore extensa', () => {
  assert.deepEqual(nodes.SUP1.options.map((o) => o.value), ['consultoria', 'mentoria', 'nao_sei']);
  assert.deepEqual(nodes.SUP1.options.map((o) => o.label), [
    'Preciso resolver, revisar ou decidir uma questão técnica',
    'Quero aprender, desenvolver uma ferramenta/processo ou ter acompanhamento técnico',
    'Ainda não sei qual se encaixa',
  ]);
});

test('"Já sei o serviço": Consultoria Técnica e Mentoria Técnica são escolhas explícitas', () => {
  assert.ok(nodes.S1.options.some((o) => o.value === 'Consultoria Técnica'));
  assert.ok(nodes.S1.options.some((o) => o.value === 'Mentoria Técnica'));
});

for (const [kind, code, hours, total] of [
  ['consultoria', 'CONSULTORIA_TECNICA', '5', '860.39'],
  ['mentoria', 'MENTORIA_TECNICA', '10', '2181.20'],
]) {
  test(`descoberta > ${kind}, sabe horas (${hours}h): CALCULATED ${total}; não passa por S2/S3/S5`, () => {
    const { a, path } = walk('support', { SUP1: kind, HRS_Q: 'sim', HRS_V: { value: hours }, S4: LOC, S6: 'Até 30 dias' });
    assert.deepEqual(path, ['SUP1', 'HRS_Q', 'HRS_V', 'S4', 'S6', 'X1']);
    const p = packageForCRMv2(a);
    assert.deepEqual(p.pricing_inputs.services, [code]);
    assert.equal(p.pricing_inputs.hours, hours);
    assert.equal(p.pricing_preview.status, 'CALCULATED');
    assert.equal(p.pricing_preview.total_demello, total);
    assert.equal(p.result, 'X3A');
    assert.equal(p.route, 'known', 'a entrada de apoio emite uma das 4 rotas do contrato');
    assert.equal(p.pricing_inputs.area_total, null);
    assert.equal(p.pricing_inputs.typology, null);
    assert.deepEqual(p.pricing_preview, buildPricingPreview(p.pricing_inputs));
    assert.ok(summary(a).some((r) => r.label === 'Horas de apoio' && r.value === `${hours} h`));
  });

  test(`descoberta > ${kind}, não sabe as horas: hours=null, NEEDS_HUMAN_REVIEW, sem previsão automática`, () => {
    const { a, path } = walk('support', { SUP1: kind, HRS_Q: 'nao', HRS_CTX: 'Preciso revisar a solução adotada.', S4: LOC, S6: 'Até 30 dias' });
    assert.deepEqual(path, ['SUP1', 'HRS_Q', 'HRS_CTX', 'S4', 'S6', 'X1']);
    const p = packageForCRMv2(a);
    assert.equal(p.pricing_inputs.hours, null);
    assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
    assert.equal(p.pricing_preview.total_demello, null);
    assert.equal(p.result, 'X3B');
    assert.match(svc(p, code).reason, /Q_HORAS/);
    assert.equal(a.support_context, 'Preciso revisar a solução adotada.');
    assert.equal(advance('X1', a, 'preview').id, 'X3B', 'a UI não promete previsão');
    assert.ok(missingData(a).includes('Quantidade aproximada de horas de apoio'));
  });

  test(`"já sei" > só ${kind}: escolha direta, sem S2/S3/S5, com horas`, () => {
    const svcLabel = kind === 'consultoria' ? 'Consultoria Técnica' : 'Mentoria Técnica';
    const { a, path } = walk('known', { S1: [svcLabel], HRS_Q: 'sim', HRS_V: { value: hours }, S4: LOC, S6: 'Até 30 dias' });
    assert.deepEqual(path, ['S1', 'HRS_Q', 'HRS_V', 'S4', 'S6', 'X1']);
    for (const skipped of ['S2', 'S3', 'S5']) assert.ok(!path.includes(skipped), skipped);
    const p = packageForCRMv2(a);
    assert.deepEqual(p.pricing_inputs.services, [code]);
    assert.equal(p.pricing_preview.total_demello, total);
    assert.equal(p.route, 'known');
  });
}

test('descoberta > "Ainda não sei qual se encaixa": contexto livre, NENHUM serviço inferido, NEEDS_HUMAN_REVIEW', () => {
  const { a, path } = walk('support', { SUP1: 'nao_sei', HRS_CTX: 'Preciso de uma segunda opinião, mas não sei explicar.', S4: LOC, S6: 'Ainda sem prazo' });
  assert.deepEqual(path, ['SUP1', 'HRS_CTX', 'S4', 'S6', 'X1']);
  assert.deepEqual(hourlyServices(a), []);
  const p = packageForCRMv2(a);
  assert.deepEqual(p.pricing_inputs.services, []);
  assert.equal(p.pricing_inputs.hours, null);
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.pricing_preview.total_demello, null);
  assert.equal(p.result, 'X3B');
  assert.equal(p.route, 'problem', 'sem serviço definido: o contrato não ganha rota nova');
  assert.equal(advance('X1', a, 'preview').id, 'X3B');
  assert.ok(missingData(a).includes('Definição do tipo de apoio'));
});

test('horas inválidas (0, texto, negativo) não avançam: nunca viram previsão', () => {
  for (const bad of ['0', 'abc', '-1', '', '1.234,5']) {
    const a = updateAnswer({ route: 'support', support_kind: 'consultoria', hours_known: 'sim' }, 'HRS_V', { value: bad });
    assert.equal(valid('HRS_V', a), false, bad);
    assert.equal(derivePricingInputs(a).hours, null, bad);
  }
});

test('Consultoria + Mentoria: NEEDS_HUMAN_REVIEW, sem total, nenhuma pergunta de horas, hours nunca replicado', () => {
  const { a, path } = walk('known', { S1: ['Consultoria Técnica', 'Mentoria Técnica'], HRS_CTX: 'Preciso das duas frentes.', S4: LOC, S6: 'Até 30 dias' });
  assert.deepEqual(path, ['S1', 'HRS_CTX', 'S4', 'S6', 'X1']);
  assert.ok(!path.includes('HRS_Q') && !path.includes('HRS_V'));
  const p = packageForCRMv2(a);
  assert.deepEqual(p.pricing_inputs.services, ['CONSULTORIA_TECNICA', 'MENTORIA_TECNICA']);
  assert.equal(p.pricing_inputs.hours, null);
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.pricing_preview.total_demello, null);
  assert.equal(p.result, 'X3B');
  assert.ok(missingData(a).includes('Dimensionamento do atendimento pela equipe DEMELLO'));
  // mesmo que hours_known/hours ficassem no estado, o payload nunca replica um escalar em dois serviços
  const forced = derivePricingInputs({ ...a, hours_known: 'sim', hours: { value: '5' } });
  assert.equal(forced.hours, null);
});

test('motor: 2 serviços horários NUNCA usam o mesmo hours (fail-closed, mesmo com hours válido)', () => {
  const base = { services: ['CONSULTORIA_TECNICA', 'MENTORIA_TECNICA'], hours: '5' };
  const pv = buildPricingPreview(base);
  assert.equal(pv.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(pv.total_demello, null);
  for (const s of pv.services) {
    assert.equal(s.status, 'NEEDS_HUMAN_REVIEW');
    assert.equal(s.q, null);
    assert.equal(s.demello, undefined);
    assert.match(s.reason, /insuficientemente discriminada/);
  }
});

test('Consultoria + Estrutural: cada serviço usa a sua base; horas só na Consultoria', () => {
  const { a, path } = walk('known', {
    S1: ['Estrutural', 'Consultoria Técnica'], Q_FUND: area('80'), HRS_Q: 'sim', HRS_V: { value: '5' },
    S2: 'Comercial', S3: area('200'), S4: LOC, S5: 'Arquitetura pronta', S6: 'Até 30 dias',
  });
  assert.deepEqual(path, ['S1', 'Q_FUND', 'HRS_Q', 'HRS_V', 'S2', 'S3', 'S4', 'S5', 'S6', 'X1']);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_inputs.hours, '5');
  const c = svc(p, 'CONSULTORIA_TECNICA');
  const e = svc(p, 'ESTRUTURAL');
  assert.equal(c.q_basis, 'Q_HORAS');
  assert.equal(c.status, 'CALCULATED');
  assert.equal(c.demello.total, '860.39');
  assert.equal(e.q_basis, 'Q_SUPERESTRUTURA');
  assert.equal(e.status, 'CALCULATED');
  assert.equal(e.q_inputs.hours, undefined, 'a base de horas não vaza para o estrutural');
});

test('Consultoria + Estrutural sem Q_FUNDACAO: o estrutural vai a review sem corromper a Consultoria', () => {
  const p = packageForCRMv2({
    route: 'known', services: ['Estrutural', 'Consultoria Técnica'], hours_known: 'sim', hours: { value: '5' },
    property: 'Comercial', S3: area('200'), location: LOC, contact,
  });
  assert.equal(svc(p, 'ESTRUTURAL').status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(svc(p, 'CONSULTORIA_TECNICA').status, 'CALCULATED');
  assert.equal(svc(p, 'CONSULTORIA_TECNICA').demello.total, '860.39');
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.pricing_preview.total_demello, null);
  assert.equal(p.result, 'X3B');
});

test('mudar os serviços limpa as horas; trocar Consultoria por Mentoria mantém o valor; "não sei" descarta as horas', () => {
  let a = { route: 'known', services: ['Consultoria Técnica'], hours_known: 'sim', hours: { value: '5' } };
  a = updateAnswer(a, 'S1', ['Consultoria Técnica', 'Mentoria Técnica']);
  assert.equal(a.hours_known, undefined);
  assert.equal(a.hours, undefined);
  let b = { route: 'support', support_kind: 'consultoria', hours_known: 'sim', hours: { value: '5' } };
  b = updateAnswer(b, 'SUP1', 'mentoria');
  assert.equal(b.hours?.value, '5');
  b = updateAnswer(b, 'HRS_Q', 'nao');
  assert.equal(b.hours, undefined);
  b = updateAnswer({ route: 'support', support_kind: 'mentoria', hours_known: 'sim', hours: { value: '5' } }, 'SUP1', 'nao_sei');
  assert.equal(b.hours, undefined);
  assert.equal(b.hours_known, undefined);
});

test('regressão: "já sei" sem serviço horário mantém S2/S3/S4/S5/S6 e nenhuma pergunta de horas', () => {
  const { a, path } = walk('known', { S1: ['Gás'], Q_GAS: area('90'), S2: 'Casa/sobrado', S3: area('120'), S4: LOC, S5: 'Arquitetura pronta', S6: 'Até 30 dias' });
  assert.deepEqual(path, ['S1', 'Q_GAS', 'S2', 'S3', 'S4', 'S5', 'S6', 'X1']);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_inputs.hours, null);
  assert.deepEqual(p.pricing_inputs.services, ['GAS_GLP']);
  assert.equal(p.pricing_preview.status, 'CALCULATED');
});

test('regressão: Estrutural + Fundações + Hidro continua como antes (sem hours)', () => {
  const p = packageForCRMv2({
    route: 'build', CA1: 'Construir do zero', CA_AREA: area('320'), property: 'Comercial', location: LOC,
    services: ['Estrutural', 'Hidrossanitário'], phase: 'Arquitetura pronta', CA5: area('1'), CA6: 'Médio', deadline: '3–6 meses', contact,
  });
  assert.equal(p.pricing_inputs.hours, null);
  assert.equal(p.pricing_preview.total_demello, '9958.40');
});

test('superfície pública: a jornada nova não expõe regime, fator, MIN nem composição interna', () => {
  const text = JSON.stringify([nodes.SUP1, nodes.HRS_Q, nodes.HRS_V, nodes.HRS_CTX]);
  for (const forbidden of ['pricing_rule', 'STRUCT_', '0,80', 'fator', 'MIN(', 'ALTOQI']) assert.ok(!text.includes(forbidden), forbidden);
  const p = packageForCRMv2({ route: 'support', support_kind: 'consultoria', hours_known: 'sim', hours: { value: '5' }, location: LOC, contact });
  const shown = p.pricing_preview.presented_to_customer.text;
  for (const forbidden of ['pricing_rule', 'STRUCT_', 'fator', 'MIN(', 'composta']) assert.ok(!shown.includes(forbidden), forbidden);
});

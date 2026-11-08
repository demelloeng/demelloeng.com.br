// P01 — confiabilidade da calculadora. Cada teste prende um defeito que a suíte anterior não via.
import test from 'node:test';
import './support/catalogo.mjs';
import assert from 'node:assert/strict';
import { nodes, titleOf, safetyHold, summary, advance, DISPLAY_LABELS, valid, updateAnswer } from '../src/journey.mjs';
import { resultKind, resultStepFor, advanceJourney, allowedIntents } from '../src/funnel.mjs';
import { packageForCRMv2, derivePricingInputs } from '../src/payload_v2.mjs';
import { friendlyServiceName } from '../src/client_summary.mjs';
import { initialState, serviceFromSearch, deeplinkInfo } from '../src/deeplink.mjs';
import { snapshot, readSnapshot, navKey, backMode, staleOffset, NAV_KEY } from '../src/nav_history.mjs';

const loc = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const base = { route: 'build', CA1: 'Construir do zero', property: 'Casa/sobrado', location: loc, phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: ['Estrutural'], deadline: 'Ainda sem prazo' };

test('178: área desconhecida NÃO abre a tela de "primeira conta" (X3A só com valor calculado)', () => {
  const unknown = { ...base, CA_AREA: { unknown: true } };
  assert.equal(packageForCRMv2(unknown).pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(resultKind(unknown), 'review');
  assert.equal(resultStepFor(unknown), 'X3B');
  assert.equal(advanceJourney('X1', unknown, 'preview').id, 'X3B');
  assert.deepEqual(allowedIntents(unknown), ['evaluation_only']);
  assert.equal(titleOf('X3B', unknown), 'Já conseguimos organizar seu caso.');
});

test('178: caso calculado continua em X3A, com proposta e dúvida; o motor não mudou', () => {
  const calc = { ...base, CA_AREA: { value: '120' } };
  const pv = packageForCRMv2(calc).pricing_preview;
  assert.equal(pv.status, 'CALCULATED');
  assert.equal(pv.total_demello, '2575.68');
  assert.equal(advanceJourney('X1', calc, 'preview').id, 'X3A');
  assert.deepEqual(allowedIntents(calc), ['proposal', 'scope_question']);
});

test('178: advanceJourney só muda a saída do resumo; as demais transições são as da jornada', () => {
  const calc = { ...base, CA_AREA: { value: '120' } };
  for (const id of ['X3A', 'X3B', 'X4']) assert.deepEqual(advanceJourney(id, calc, 'preview'), advance(id, calc, 'preview'));
});

test('178: o contato sem valor não promete análise e a tela sem valor não diz "primeira conta"', () => {
  assert.equal(nodes.X4.title, 'Para onde enviamos seu caso?');
  assert.ok(!/análise/i.test(titleOf('X4', { request_intent: 'evaluation_only' })));
  // O título da tela X3A é o único que promete conta: só é alcançável com CALCULATED (testes acima).
  assert.equal(nodes.X3A.title, 'Já dá para fazer uma primeira conta.');
});

test('173/100: o rótulo exibido muda, o valor gravado e os identificadores técnicos não', () => {
  const s1 = nodes.S1.options;
  const orc = s1.find((o) => o.value === 'Orçamento técnico');
  const terr = s1.find((o) => o.value === 'Terraplenagem');
  assert.equal(orc.label, 'Orçamento e cronograma');
  assert.equal(terr.label, 'Terraplanagem');
  assert.deepEqual(Object.keys(DISPLAY_LABELS).sort(), ['Elétrica', 'Orçamento técnico', 'Terraplenagem']);
  const a = { route: 'known', services: ['Orçamento técnico', 'Terraplenagem'], S3: { value: '300' }, area_orcamento: { value: '300' }, area_terreno: { value: '500' }, property: 'Comercial', location: loc };
  const pi = derivePricingInputs(a);
  assert.deepEqual(pi.services, ['ORCAMENTO', 'TERRAPLENAGEM']);
  assert.match(summary(a).find((r) => r.id === 'S1').value, /Orçamento e cronograma · Terraplanagem/);
  assert.equal(friendlyServiceName({ service: 'ORCAMENTO' }), 'Orçamento e cronograma');
  assert.equal(friendlyServiceName({ service: 'TERRAPLENAGEM' }), 'Terraplanagem');
  assert.deepEqual(packageForCRMv2(a).answers.services, ['Orçamento técnico', 'Terraplenagem']);
});

test('173/100: deep links — servico=orcamento-tecnico preservado; as duas grafias de terraplanagem abrem o mesmo serviço', () => {
  for (const slug of ['terraplanagem', 'terraplenagem']) {
    assert.equal(serviceFromSearch(`?situacao=known&servico=${slug}`), slug);
    assert.deepEqual(initialState(`?situacao=known&servico=${slug}`).answers.services, ['Terraplenagem']);
    assert.equal(deeplinkInfo(`?situacao=known&servico=${slug}`).analyticsService, 'terraplenagem', 'o código de medição não muda');
  }
  assert.deepEqual(initialState('?situacao=known&servico=orcamento-tecnico').answers.services, ['Orçamento técnico']);
  assert.equal(serviceFromSearch('?situacao=known&servico=Terraplanagem'), null, 'continua exato, sem tolerância a variações');
});

test('valores: texto fora do formato de área nunca vira quantidade do motor ("1.000" não é 1 m²)', () => {
  for (const bad of ['1.000', '0,001', '1e3', '12,345', ' ', 'abc', '-5']) {
    const a = { ...base, CA_AREA: { value: bad } };
    assert.equal(valid('CA_AREA', a), false, bad);
    assert.equal(derivePricingInputs(a).area_new, null, `payload: ${bad}`);
    assert.equal(packageForCRMv2(a).pricing_preview.status, 'NEEDS_HUMAN_REVIEW', bad);
  }
  assert.equal(derivePricingInputs({ ...base, CA_AREA: { value: '120,5' } }).area_new, '120,5');
});

test('triagem: sinais críticos óbvios seguram o caso para avaliação humana, sem diagnóstico', () => {
  for (const t of ['A parede está estalando', 'sinto cheiro de gás perto do medidor', 'a laje está balançando', 'tem vazamento de gás', 'saiu faísca da tomada', 'levei choque elétrico no chuveiro', 'o muro está inclinando']) {
    assert.equal(safetyHold({ route: 'problem', P2: t }), true, t);
  }
  for (const t of ['Quero tirar uma parede', 'Apareceu uma rachadura depois da reforma', 'Preciso avaliar o imóvel antes de comprar']) {
    assert.equal(safetyHold({ route: 'problem', P2: t }), false, t);
  }
  assert.equal(safetyHold({ route: 'build', P2: 'estalando' }), false, 'só a rota Avaliar um problema usa a triagem');
});

test('histórico do navegador: o snapshot não carrega respostas, contato nem texto livre', () => {
  const s = snapshot({ id: 'CA2', history: ['HOME', 'CA1'], depth: 2, prevId: 'CA1', session: 'abc' });
  assert.deepEqual(Object.keys(s).sort(), [NAV_KEY, 'depth', 'history', 'id', 'prevId', 'session'].sort());
  assert.equal(JSON.stringify(s).includes('Fulano'), false);
});

test('histórico do navegador: só aceita snapshot bem formado, com ids que existem na jornada', () => {
  const ok = snapshot({ id: 'CA2', history: ['HOME', 'CA1'], depth: 2, prevId: 'CA1', session: 'abc' });
  assert.deepEqual(readSnapshot(ok, nodes).history, ['HOME', 'CA1']);
  for (const bad of [null, undefined, 'x', {}, { ...ok, id: 'NAO_EXISTE' }, { ...ok, history: ['HOME', 7] }, { ...ok, depth: -1 }, { ...ok, depth: 1.5 }, { ...ok, session: 3 }, { ...ok, [NAV_KEY]: false }, { ...ok, history: 'HOME' }]) {
    assert.equal(readSnapshot(bad, nodes), null, JSON.stringify(bad));
  }
  assert.equal(readSnapshot({ ...ok, prevId: '__proto__' }, nodes).prevId, null);
});

test('histórico do navegador: digitar não cria entrada; trocar de pergunta cria; Voltar do app usa o navegador só quando alinhado', () => {
  assert.equal(navKey('CA_AREA', ['HOME', 'CA1']), navKey('CA_AREA', ['HOME', 'CA1']));
  assert.notEqual(navKey('CA2', ['HOME', 'CA1', 'CA_AREA']), navKey('CA_AREA', ['HOME', 'CA1']));
  const last = { depth: 2, prevId: 'CA_AREA' };
  assert.equal(backMode({ last, history: ['HOME', 'CA1', 'CA_AREA'] }), 'browser');
  assert.equal(backMode({ last, history: ['HOME', 'CA1'] }), 'app', 'lápis/edição: a pergunta anterior da jornada não é a entrada anterior do navegador');
  assert.equal(backMode({ last: { depth: 0, prevId: null }, history: ['HOME'] }), 'app', 'entrada por deep link: voltar vai para HOME, nunca sai da página');
  assert.equal(backMode({ last: null, history: ['HOME'] }), 'app');
});

test('histórico do navegador: entrada de outra carga da página é deixada para trás, a atual não', () => {
  const old = { depth: 3, session: 'velha' };
  assert.equal(staleOffset(old, 'nova'), -4);
  assert.equal(staleOffset({ depth: 3, session: 'nova' }, 'nova'), 0);
  assert.equal(staleOffset(null, 'nova'), 0);
});

test('histórico do navegador: respostas válidas sobrevivem à navegação (o estado delas não é do histórico)', () => {
  let a = updateAnswer({ route: 'build' }, 'CA1', 'Construir do zero');
  a = updateAnswer(a, 'CA_AREA', { value: '120' });
  const r1 = advance('CA_AREA', a, 'missing');
  assert.equal(r1.id, 'CA2');
  assert.deepEqual(r1.answers.CA_AREA, { value: '120' });
});

// ---------------------------------------------------------------- autoridade única do resultado (3.1)
import { resultFor, needsReview } from '../src/journey.mjs';
import { REASON_ABOVE_AUTOMATIC_LIMIT, buildPricingPreview } from '../src/pricing/engine.mjs';
import TABLE from '../src/pricing/pricing-table.v2.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('autoridade única: navegação, payload, funil e medição concordam em todos os casos exercitados', () => {
  const casos = [
    { ...base, CA_AREA: { value: '120' } },                      // calculado
    { ...base, CA_AREA: { unknown: true } },                     // sem área
    { ...base, CA_AREA: { value: '120' }, CA5: { value: '3' } }, // estrutural sem projeção
    { ...base, CA_AREA: { value: '20000' } },                    // acima do limite
  ];
  for (const a of casos) {
    const viaPayload = packageForCRMv2(a).result;
    assert.equal(viaPayload, resultFor(a, 'preview'), 'payload.result = journey.resultFor');
    assert.equal(advanceJourney('X1', a, 'preview').id, viaPayload, 'navegação');
    assert.equal(resultStepFor(a), viaPayload, 'funil');
    assert.equal(resultKind(a) === 'calculated', viaPayload === 'X3A');
    if (viaPayload === 'X3A') {
      assert.equal(packageForCRMv2(a).pricing_preview.status, 'CALCULATED', 'X3A exige valor calculado');
      assert.equal(needsReview(a), false);
    }
  }
});

test('autoridade única: a jornada sozinha nunca promete valor (sem motor registrado, X3B)', () => {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import {resultFor} from './src/journey.mjs'; console.log(resultFor({route:'build'},'preview'))"], { cwd: SRC_ROOT }).toString().trim();
  assert.equal(out, 'X3B');
});

test('autoridade única: sem dependência circular e com uma única função de resultado', async () => {
  const j = await readFile(new URL('../src/journey.mjs', import.meta.url), 'utf8');
  assert.ok(!/from '\.\/payload_v2\.mjs'/.test(j), 'journey.mjs não importa payload_v2.mjs');
  assert.ok(!/from '\.\/funnel\.mjs'/.test(j));
  assert.equal([...j.matchAll(/function resultFor/g)].length, 1);
});

// ---------------------------------------------------------------- quantidades extremas (3.3)
const LIM = TABLE.automatic_estimate_limits;
const pi = (over) => ({
  typology: 'CASA', structural_system: null, structural_scope: null, area_existing: null, area_new: null, area_total: null,
  area_atendida: null, area_terreno: null, area_escopo: null, area_fundacao: null, hours: null, foundations_selected: false,
  regularizacao: { area_matricula: null, area_iptu: null, levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' },
  hidro_scope_includes_existing: null, ...over,
});

test('limites: configuração única na tabela (10.000 m² de edificação, 100.000 m² de terreno, 200 h), sem número duplicado no código', async () => {
  for (const b of ['Q_NOVA', 'Q_TOTAL', 'Q_SUPERESTRUTURA', 'Q_FUNDACAO', 'Q_ATENDIDA', 'Q_ESCOPO']) assert.equal(LIM[b], '10000', b);
  assert.equal(LIM.Q_TERRENO, '100000');
  assert.equal(LIM.Q_HORAS, '200');
  for (const f of ['../src/pricing/engine.mjs', '../src/payload_v2.mjs', '../src/journey.mjs']) {
    const code = (await readFile(new URL(f, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/\b10[.,]?000\b|\b100[.,]?000\b/.test(code), `${f}: nenhum limite escrito no código`);
  }
});

test('limites: no limite calcula; um centésimo acima vai para avaliação humana, sem total', () => {
  const casos = [
    ['HIDROSSANITARIO', { area_new: '10000' }, { area_new: '10000.01' }],
    ['GAS_GLP', { area_atendida: '10000' }, { area_atendida: '10000.01' }],
    ['ELETRICA', { area_new: '10000' }, { area_new: '10000.01' }],
    ['TERRAPLENAGEM', { area_terreno: '100000', typology: null }, { area_terreno: '100000.01', typology: null }],
    ['CONSULTORIA_TECNICA', { hours: '200', typology: null }, { hours: '200.01', typology: null }],
  ];
  for (const [svc, ok, over] of casos) {
    const a = buildPricingPreview(pi({ services: [svc], ...ok }));
    assert.equal(a.services[0].status, 'CALCULATED', `${svc} no limite`);
    const b = buildPricingPreview(pi({ services: [svc], ...over }));
    assert.equal(b.status, 'NEEDS_HUMAN_REVIEW', `${svc} acima`);
    assert.equal(b.services[0].reason, REASON_ABOVE_AUTOMATIC_LIMIT);
    assert.equal(b.total_demello, null);
  }
});

test('limites: cada base tem o seu limite (50.000 m² de terreno calcula; 50.000 m² de edificação não)', () => {
  assert.equal(buildPricingPreview(pi({ services: ['TERRAPLENAGEM'], area_terreno: '50000', typology: null })).status, 'CALCULATED');
  assert.equal(buildPricingPreview(pi({ services: ['HIDROSSANITARIO'], area_new: '50000' })).status, 'NEEDS_HUMAN_REVIEW');
});

test('limites: estrutural — superestrutura acima do limite vai para revisão', () => {
  const sup = buildPricingPreview(pi({ services: ['ESTRUTURAL'], area_total: '10000.01', area_fundacao: '5000' }));
  assert.equal(sup.services[0].reason, REASON_ABOVE_AUTOMATIC_LIMIT);
});

test('limites: só o serviço afetado deixa o automático; o conjunto não mostra total; preços abaixo do limite iguais aos de antes', () => {
  const pv = buildPricingPreview(pi({ services: ['HIDROSSANITARIO', 'GAS_GLP'], area_new: '100', area_atendida: '10000.01' }));
  assert.equal(pv.services.find((s) => s.service === 'HIDROSSANITARIO').status, 'CALCULATED');
  assert.equal(pv.services.find((s) => s.service === 'GAS_GLP').status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(pv.total_demello, null);
  assert.equal(buildPricingPreview(pi({ services: ['CONSULTORIA_TECNICA'], hours: '5', typology: null })).total_demello, '860.39');
});

test('limites: acima do limite o visitante conclui o contato (informação preservada, só avaliação humana)', () => {
  const a = { ...base, CA_AREA: { value: '20000' } };
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.answers.CA_AREA.value, '20000', 'o valor informado é preservado');
  assert.equal(p.result, 'X3B');
  assert.deepEqual(allowedIntents(a), ['evaluation_only']);
  assert.equal(advance('X3B', a, 'preview').id, 'X4');
});

test('limites: entradas inválidas nunca viram quantidade', () => {
  for (const bad of ['-1', '0', '0,00', 'Infinity', 'NaN', '1e5', '1e400', '0x10', ' ', '99999999999999999999']) {
    const a = { ...base, CA_AREA: { value: bad } };
    if (!valid('CA_AREA', a)) assert.notEqual(packageForCRMv2(a).pricing_preview.status, 'CALCULATED', `payload: "${bad}" nunca vira preço`);
  }
  for (const good of ['0,01', '1', '120,5', '10000', '10000,01']) assert.equal(valid('CA_AREA', { ...base, CA_AREA: { value: good } }), true, good);
});

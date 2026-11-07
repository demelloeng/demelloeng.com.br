// P03 — Projeto Elétrico (baixa tensão predial) selecionável na calculadora.
// ESCOPO: só a calculadora. A referência AltoQi original de elétrica não está em nenhuma fonte consumida pelo motor:
// sem ela, a tabela NÃO ganha entrada de preço e o percurso termina em avaliação humana. Nada de valor inventado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { nodes, routeNodes, summary, advance, valid, updateAnswer, missingData, services as SERVICE_OPTIONS } from '../src/journey.mjs';
import { derivePricingInputs, packageForCRMv2 } from '../src/payload_v2.mjs';
import { advanceJourney, allowedIntents, resultKind } from '../src/funnel.mjs';
import { buildClientSummary, friendlyServiceName } from '../src/client_summary.mjs';
import { serviceParams, createTracking } from '../src/tracking.mjs';
import { PARAMS } from '../../assets/js/analytics.mjs';
import { initialState, SERVICE_DEEPLINKS } from '../src/deeplink.mjs';
import TABLE from '../src/pricing/pricing-table.v2.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFile(path.join(HERE, '..', f), 'utf8');
const loc = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const known = (svcs, extra = {}) => ({ route: 'known', services: svcs, property: 'Casa/sobrado', S3: { value: '120' }, location: loc, phase: 'Arquitetura pronta', deadline: 'Ainda sem prazo', ...extra });
const build = (svcs, extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, property: 'Casa/sobrado', location: loc, phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: svcs, deadline: 'Ainda sem prazo', ...extra });

test('opção: "Projeto Elétrico" aparece em "Já sei o serviço" e em "Construir ou ampliar", sem tocar nas demais', () => {
  for (const id of ['S1', 'CA7']) {
    const o = nodes[id].options.find((x) => x.value === 'Elétrica');
    assert.ok(o, `${id}: opção Elétrica`);
    assert.equal(o.label, 'Projeto Elétrico');
  }
  assert.ok(SERVICE_OPTIONS.includes('Elétrica'));
  const labels = nodes.S1.options.map((o) => o.label);
  assert.deepEqual(labels.slice(0, 5), ['Estrutural', 'Fundações', 'Hidrossanitário', 'Drenagem', 'Incêndio'], 'ordem anterior preservada');
  assert.ok(labels.includes('Estrutural') && labels.includes('Compatibilização BIM') && labels.includes('Consultoria Técnica'));
});

test('seleção isolada: segue o fluxo normal de projeto por área, aparece no resumo e não inventa preço', () => {
  const a = known(['Elétrica']);
  assert.equal(valid('S1', a), true);
  assert.deepEqual(routeNodes(a), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  const sum = summary(a);
  assert.equal(sum.find((r) => r.id === 'S1').value, 'Projeto Elétrico');
  const p = packageForCRMv2(a);
  assert.deepEqual(p.pricing_inputs.services, ['ELETRICA']);
  assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(p.pricing_preview.total_demello, null, 'nenhum valor automático');
  assert.equal(p.pricing_preview.services[0].reason, 'serviço fora da TABELA DEMELLO V2');
  assert.equal(p.result, 'X3B');
  assert.equal(p.pricing_inputs.area_total, '120', 'a área do projeto segue a mesma base do hidrossanitário');
  assert.ok(missingData(a).includes('Valor do Projeto Elétrico, definido pela equipe DEMELLO'));
});

test('"Construir ou ampliar": Projeto Elétrico selecionável, isolado ou junto de outras disciplinas', () => {
  for (const svcs of [['Elétrica'], ['Estrutural', 'Elétrica'], ['Hidrossanitário', 'Elétrica', 'Incêndio']]) {
    const a = build(svcs);
    assert.equal(valid('CA7', a), true, svcs.join());
    assert.equal(derivePricingInputs(a).services.includes('ELETRICA'), true);
    assert.match(summary(a).find((r) => r.id === 'CA7').value, /Projeto Elétrico/);
  }
  const sugerido = build(['Não sei quais preciso'], { suggestionConfirmed: true, confirmedSuggestions: ['Estrutural', 'Elétrica'] });
  assert.deepEqual(derivePricingInputs(sugerido).services, ['ESTRUTURAL', 'ELETRICA'], 'sugestão confirmada pelo visitante também reconhece a elétrica');
});

test('combinada: os demais serviços seguem calculados como antes; o conjunto vai para avaliação, sem total', () => {
  const sozinho = packageForCRMv2(known(['Hidrossanitário'])).pricing_preview;
  const junto = packageForCRMv2(known(['Hidrossanitário', 'Elétrica'])).pricing_preview;
  assert.equal(sozinho.status, 'CALCULATED');
  const hidro = junto.services.find((s) => s.service === 'HIDROSSANITARIO');
  assert.equal(hidro.status, 'CALCULATED');
  assert.equal(hidro.demello.total, sozinho.services[0].demello.total, 'o preço do hidrossanitário não muda por causa da elétrica');
  assert.equal(junto.services.find((s) => s.service === 'ELETRICA').status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(junto.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(junto.total_demello, null);
});

test('resultado: a elétrica cai em enquadramento (X3B), só com "enviar meu caso para avaliação", sem promessa de valor', () => {
  for (const a of [known(['Elétrica']), build(['Estrutural', 'Elétrica'])]) {
    assert.equal(resultKind(a), 'review');
    assert.deepEqual(allowedIntents(a), ['evaluation_only']);
    assert.equal(advanceJourney('X1', a, 'preview').id, 'X3B');
  }
  const texto = buildClientSummary(packageForCRMv2(known(['Elétrica'])));
  assert.match(texto, /Projeto Elétrico/);
  assert.match(texto, /Avaliação humana necessária/);
  assert.equal(friendlyServiceName({ service: 'ELETRICA' }), 'Projeto Elétrico');
});

test('metodologia preservada: fator 0,80, tabela V2 e fórmulas intocados; elétrica não entra na tabela sem fonte', async () => {
  assert.equal(TABLE.factor_demello, '0.80');
  assert.equal(TABLE.table_version, 'DEMELLO_V2');
  const sha = createHash('sha256').update((await read('src/pricing/pricing-table.v2.json')).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(sha, '9a94f6afac58a79ae3cdeb66d7aea61611b7772fb61b324360c594f71b866dc1', 'tabela byte a byte igual à do canônico');
  const eng = createHash('sha256').update((await read('src/pricing/engine.mjs')).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(eng, '12d243d2f9e0d6b519f120895b8ff1dd7cd60a8a513f1b7c331474a83abbb0a7', 'motor intocado');
  // Se um dia a tabela ganhar ELETRICA, ela só pode citar fonte documentada (ALTOQI); nunca valor solto.
  if (TABLE.services.ELETRICA) assert.ok(TABLE.services.ELETRICA.references?.ALTOQI, 'ELETRICA exige a referência AltoQi documentada');
  assert.ok(!('SERVICES_NOT_OFFERED' in {}) && !/SERVICES_NOT_OFFERED/.test(await read('src/payload_v2.mjs')), 'a trava histórica foi removida');
});

test('texto livre em "Outro" continua sem virar serviço (a elétrica entra só pela opção própria)', () => {
  assert.deepEqual(derivePricingInputs({ route: 'known', services: ['Outro'], otherService: 'Elétrica', property: 'Comercial' }).services, []);
});

test('escopo fechado: sem deep link próprio, sem texto de média/alta tensão e sem ressalva de competência ou acervo na calculadora', async () => {
  assert.ok(!Object.keys(SERVICE_DEEPLINKS).some((k) => /el[eé]tric/.test(k)), 'nenhum atalho novo');
  assert.deepEqual(initialState('?situacao=known&servico=eletrica').answers.services, undefined, 'eletrica continua sendo valor inválido de servico=');
  for (const f of ['src/journey.mjs', 'src/GlobalApp.jsx', 'src/pickers.jsx', 'src/client_summary.mjs', 'src/payload_v2.mjs']) {
    const src = (await read(f)).replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/m[eé]dia tens[aã]o|alta tens[aã]o/i.test(src), `${f}: sem média/alta tensão`);
    assert.ok(!/atribui[cç][õo]es|n[aã]o (possui|temos|tem) (habilita|atribui|acervo)|sem acervo|acervo t[eé]cnico anterior/i.test(src), `${f}: sem ressalva de competência ou acervo`);
  }
  for (const id of Object.keys(nodes)) for (const o of nodes[id].options ?? []) assert.ok(!/tens[aã]o/i.test(o.label), `${id}: ${o.label}`);
});

test('mensuração: a elétrica é um código controlado (eletrica) aceito pelo contrato fechado, sem texto livre', () => {
  assert.deepEqual(serviceParams(known(['Elétrica'])), { service: 'eletrica', service_count: 1 });
  assert.deepEqual(serviceParams(known(['Elétrica', 'Estrutural'])), { service: 'multiple', service_count: 2 });
  assert.equal(PARAMS.service('eletrica'), true);
  assert.equal(PARAMS.service('Elétrica'), false, 'rótulo livre continua barrado');
  assert.equal(PARAMS.service_count(12), true, 'as doze disciplinas juntas cabem');
  assert.equal(PARAMS.service_count(13), false);
  const seen = [];
  const t = createTracking({ track: (name, params, opts) => { seen.push({ name, params, opts }); return { name, params }; }, pageView: () => {} });
  t.result(known(['Elétrica']), 'X3B');
  assert.equal(seen[0].name, 'framing_delivered');
  assert.deepEqual(seen[0].params, { route: 'known', service: 'eletrica', service_count: 1, result_status: 'needs_review', step: 'X3B' });
});

test('edição: desmarcar a elétrica não deixa resíduo e a jornada continua válida', () => {
  let a = known(['Elétrica', 'Estrutural'], { area_fundacao: { value: '80' } });
  a = updateAnswer(a, 'S1', ['Estrutural']);
  assert.deepEqual(derivePricingInputs(a).services, ['ESTRUTURAL']);
  assert.equal(advance('S1', known(['Elétrica']), 'preview').id, 'X1', 'com as demais respostas válidas, a jornada vai direto ao resumo');
  assert.equal(advance('S1', { route: 'known', services: ['Elétrica'] }, 'preview').id, 'S2', 'sem as demais respostas, segue pelas perguntas de projeto por área');
});

test('páginas institucionais: nenhuma menciona a elétrica por causa desta frente (catálogo e páginas de serviço seguem como estavam)', async () => {
  const root = path.join(HERE, '..', '..');
  for (const f of ['servicos/index.html', 'index.html', 'servicos/projeto-hidrossanitario/index.html', 'servicos/projeto-estrutural/index.html']) {
    const html = await readFile(path.join(root, f), 'utf8');
    assert.ok(!/projeto el[eé]trico/i.test(html), `${f}: nenhum projeto elétrico em página institucional`);
  }
});

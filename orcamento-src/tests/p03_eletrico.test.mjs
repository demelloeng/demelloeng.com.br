// P03 — Projeto Elétrico (baixa tensão predial) na calculadora. Revisão R2 da Tabela DEMELLO V2 (08/11/2026, Opção A).
//
// Preço = 0,80 x a MENOR referência documentada: SECID/PR 094/2026 (14,83), AltoQi casa residencial (8,60, publicada em
// "Quanto cobrar por projeto elétrico?") e FUNDEPAR 001/2025 item 8.1 por categoria (administrativa 10,38, educacional 9,20,
// esportiva 6,24). A categoria de origem é registrada e não exclui a referência. O fator é aplicado uma vez, depois da vencedora.
// Os casos já emitidos no R1 (Ricardo 436,88; Carina 1.513,60) continuam reproduzidos pelo Python canônico. ESCOPO: só a calculadora.
import test from 'node:test';
import assert from 'node:assert/strict';
import './support/catalogo.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { nodes, routeNodes, summary, advance, valid, updateAnswer, services as SERVICE_OPTIONS } from '../src/journey.mjs';
import { derivePricingInputs, packageForCRMv2 } from '../src/payload_v2.mjs';
import { advanceJourney, allowedIntents, resultKind } from '../src/funnel.mjs';
import { buildClientSummary, friendlyServiceName } from '../src/client_summary.mjs';
import { serviceParams, createTracking } from '../src/tracking.mjs';
import { PARAMS } from '../../assets/js/analytics.mjs';
import { initialState, SERVICE_DEEPLINKS } from '../src/deeplink.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';
import TABLE from '../src/pricing/pricing-table.v2.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFile(path.join(HERE, '..', f), 'utf8');
const loc = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const known = (svcs, extra = {}) => ({ route: 'known', services: svcs, property: 'Casa/sobrado', S3: { value: '120' }, location: loc, phase: 'Arquitetura pronta', deadline: 'Ainda sem prazo', ...extra });
const build = (svcs, extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, property: 'Casa/sobrado', location: loc, phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: svcs, deadline: 'Ainda sem prazo', ...extra });
const casa = (area, svcs = ['Elétrica'], extra = {}) => known(svcs, { S3: { value: area }, ...extra });

test('opção: "Projeto Elétrico" aparece em "Já sei o serviço" e em "Construir ou ampliar", sem tocar nas demais', () => {
  for (const id of ['S1', 'CA7']) {
    const o = nodes[id].options.find((x) => x.value === 'Elétrica');
    assert.ok(o, `${id}: opção Elétrica`);
    assert.equal(o.label, 'Projeto Elétrico');
  }
  assert.ok(SERVICE_OPTIONS.includes('Elétrica'));
  const labels = nodes.S1.options.map((o) => o.label);
  assert.deepEqual(labels.slice(0, 5), ['Estrutural', 'Fundações', 'Hidrossanitário', 'Drenagem', 'Incêndio'], 'ordem anterior preservada');
});

test('PREÇO R2: 63,5 m² = R$ 316,99 e 220 m² = R$ 1.098,24 (menor referência FUNDEPAR 6,24 x 0,80)', () => {
  for (const [area, total] of [['63,5', '316.99'], ['220', '1098.24']]) {
    const p = packageForCRMv2(casa(area));
    assert.equal(p.pricing_preview.status, 'CALCULATED', area);
    assert.equal(p.pricing_preview.total_demello, total, area);
    assert.deepEqual(p.pricing_inputs.services, ['ELETRICA']);
    assert.equal(p.result, 'X3A');
    assert.equal(resultKind(casa(area)), 'calculated');
    assert.equal(advanceJourney('X1', casa(area), 'preview').id, 'X3A');
    assert.deepEqual(allowedIntents(casa(area)), ['proposal', 'scope_question']);
  }
});

test('PREÇO R2: o fator 0,80 é aplicado UMA vez, sobre a menor referência (6,24), sem pré-arredondar 4,992', () => {
  const pv = packageForCRMv2(casa('100')).pricing_preview;
  const s = pv.services[0];
  assert.equal(s.references.altoqi.unit_value, '8.60');
  assert.equal(s.references.altoqi.total, '860.00');
  assert.equal(s.references.fundepar_001_2025_esportiva.unit_value, '6.24');
  assert.equal(s.references.fundepar_001_2025_esportiva.source_typology, 'ESPORTIVA');
  assert.equal(s.demello.total, '499.20');
  assert.notEqual(s.demello.total, '399.36', 'o fator nunca é aplicado duas vezes');
  assert.equal(s.base_reference, 'FUNDEPAR_001_2025_ESPORTIVA');
  assert.equal(pv.pricing_rule, 'STRUCT_COMPOSITE_REFS_R2');
  assert.equal(TABLE.factor_demello, '0.80');
  assert.equal(TABLE.table_version, 'DEMELLO_V2');
});

test('PROVENIÊNCIA R2: cada referência elétrica traz fonte, item e categoria de origem; nenhuma fonte inventada', () => {
  const ref = TABLE.services.ELETRICA.references;
  assert.deepEqual(Object.keys(ref), ['SECID_PR', 'ALTOQI', 'FUNDEPAR_001_2025_ADMINISTRATIVA', 'FUNDEPAR_001_2025_EDUCACIONAL', 'FUNDEPAR_001_2025_ESPORTIVA']);
  assert.equal(ref.SECID_PR.unit_value, '14.83');
  assert.equal(ref.SECID_PR.item, '12.1.1');
  assert.deepEqual(ref.ALTOQI.by_typology, { CASA: '8.60' }, 'AltoQi só casa (PREDIO 6,30 e COMERCIAL 15,10 fora da matriz aprovada)');
  const fundepar = { ADMINISTRATIVA: ['10.38', '8.1.a'], EDUCACIONAL: ['9.20', '8.1.b'], ESPORTIVA: ['6.24', '8.1.d'] };
  for (const [cat, [value, item]] of Object.entries(fundepar)) {
    const r = ref[`FUNDEPAR_001_2025_${cat}`];
    assert.deepEqual([r.source, r.source_typology, r.unit_value, r.item], ['FUNDEPAR_001_2025', cat, value, item]);
    assert.equal('applicable_typologies' in r, false, 'a categoria de origem não exclui a referência (Opção A)');
  }
  assert.ok(!('DEMELLO_ELETRICA_DOCUMENTADA' in TABLE.sources), 'a fonte derivada foi substituída pela publicação AltoQi');
  assert.match(TABLE.sources.SECID_PR, /094\/2026/);
  const texto = buildClientSummary(packageForCRMv2(casa('63,5')));
  assert.match(texto, /Projeto Elétrico/);
  assert.match(texto, /R\$\s*316,99/);
});

test('TIPOLOGIAS R2: SECID e FUNDEPAR valem para qualquer tipologia (a AltoQi elétrica só para casa)', () => {
  for (const property of ['Residencial multifamiliar', 'Comercial', 'Industrial', 'Outro']) {
    const p = packageForCRMv2(casa('100', ['Elétrica'], { property }));
    assert.equal(p.pricing_preview.status, 'CALCULATED', property);
    assert.equal(p.pricing_preview.total_demello, '499.20', property);
    assert.equal('altoqi' in p.pricing_preview.services[0].references, false, property);
    assert.equal(p.result, 'X3A');
    assert.deepEqual(allowedIntents(casa('100', ['Elétrica'], { property })), ['proposal', 'scope_question']);
  }
  assert.equal(packageForCRMv2(casa('100')).pricing_preview.services[0].references.altoqi.total, '860.00', 'casa mantém a AltoQi');
});

test('COMBINADA: soma sem cobrança dupla; serviço sem cálculo impede o total completo', () => {
  const hidro = packageForCRMv2(casa('100', ['Hidrossanitário'])).pricing_preview;
  const junto = packageForCRMv2(casa('100', ['Hidrossanitário', 'Elétrica'])).pricing_preview;
  assert.equal(hidro.total_demello, '467.20', 'R2: 5,84 x 100 x 0,80 (FUNDEPAR esportiva); o R1, 696,00, segue reproduzido pelo Python');
  assert.equal(junto.status, 'CALCULATED');
  assert.equal(junto.total_demello, '966.40');   // 467,20 + 499,20
  assert.equal(junto.services.find((s) => s.service === 'HIDROSSANITARIO').demello.total, hidro.total_demello);
  const estrutural = packageForCRMv2(build(['Estrutural', 'Elétrica'], { CA5: { value: '3' } })).pricing_preview; // 3 pavimentos sem área de projeção: estrutural em avaliação
  assert.equal(estrutural.services.find((s) => s.service === 'ELETRICA').status, 'CALCULATED');
  assert.equal(estrutural.services.find((s) => s.service === 'ESTRUTURAL').status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(estrutural.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(estrutural.total_demello, null, 'total do conjunto não é apresentado como completo');
});

test('"Construir ou ampliar": selecionável isolado e combinado; sugestão confirmada também reconhece a elétrica', () => {
  for (const svcs of [['Elétrica'], ['Estrutural', 'Elétrica'], ['Hidrossanitário', 'Elétrica', 'Incêndio']]) {
    const a = build(svcs);
    assert.equal(valid('CA7', a), true, svcs.join());
    assert.ok(derivePricingInputs(a).services.includes('ELETRICA'));
    assert.match(summary(a).find((r) => r.id === 'CA7').value, /Projeto Elétrico/);
  }
  const p = packageForCRMv2(build(['Elétrica']));
  assert.equal(p.pricing_preview.total_demello, '599.04', '120 m² x 6,24 x 0,80');
  const sugerido = build(['Não sei quais preciso'], { suggestionConfirmed: true, confirmedSuggestions: ['Estrutural', 'Elétrica'] });
  assert.deepEqual(derivePricingInputs(sugerido).services, ['ESTRUTURAL', 'ELETRICA']);
});

test('seleção isolada: fluxo de projeto por área, resumo com o nome público e payload com o código ELETRICA', () => {
  const a = casa('120');
  assert.equal(valid('S1', a), true);
  assert.deepEqual(routeNodes(a), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.equal(summary(a).find((r) => r.id === 'S1').value, 'Projeto Elétrico');
  assert.equal(friendlyServiceName({ service: 'ELETRICA' }), 'Projeto Elétrico');
  assert.equal(advance('S1', { route: 'known', services: ['Elétrica'] }, 'preview').id, 'S2');
});

test('PARIDADE com o Python: o motor JS dá o mesmo resultado dos vetores calculados pelo espelho do canônico', () => {
  const base = { typology: 'CASA', area_new: '63.5', area_total: '63.5', area_existing: null, structural_system: null, structural_scope: null, foundations_selected: false, area_atendida: null, area_terreno: null, area_escopo: null, area_fundacao: null, hours: null, regularizacao: { area_matricula: null, area_iptu: null, levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' }, hidro_scope_includes_existing: null };
  const vetores = [
    [{ services: ['ELETRICA'], area_new: '63.5' }, 'CALCULATED', '316.99'],
    [{ services: ['ELETRICA'], area_new: '220', area_total: '220' }, 'CALCULATED', '1098.24'],
    [{ services: ['ELETRICA'], typology: 'PREDIO' }, 'CALCULATED', '316.99'],
    [{ services: ['ELETRICA'], area_new: '10000', area_total: '10000' }, 'CALCULATED', '49920.00'],
    [{ services: ['ELETRICA'], area_new: '10000.01', area_total: '10000.01' }, 'NEEDS_HUMAN_REVIEW', null],
  ];
  for (const [over, status, total] of vetores) {
    const pv = buildPricingPreview({ ...base, ...over });
    assert.equal(pv.status, status, JSON.stringify(over));
    assert.equal(pv.total_demello, total, JSON.stringify(over));
  }
});

test('metodologia preservada: tabela byte a byte igual à do canônico, fórmulas e motor só ganharam a proteção por limite', async () => {
  const sha = createHash('sha256').update((await read('src/pricing/pricing-table.v2.json')).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(sha, '8fd32ba07134ca8f6490020eb831bdcd53df9cdd6e6ad802a5ccf2aa1d671c9d');   // revisão R2 (a r1 congelada, 3bfb1919..., fica no repositório canônico)
  assert.deepEqual(Object.keys(TABLE.services).sort(), ['ARQUITETURA', 'COMPATIBILIZACAO', 'CONSULTORIA_TECNICA', 'ELETRICA', 'ESTRUTURAL', 'GAS_GLP', 'HIDROSSANITARIO', 'INCENDIO', 'MENTORIA_TECNICA', 'ORCAMENTO', 'REGULARIZACAO', 'TERRAPLENAGEM']);
  // preços das outras disciplinas, iguais aos de antes
  assert.equal(buildPricingPreview({ services: ['HIDROSSANITARIO'], typology: 'CASA', area_new: '100', area_total: '100', area_existing: null, structural_system: null, structural_scope: null, foundations_selected: false, area_atendida: null, area_terreno: null, area_escopo: null, area_fundacao: null, hours: null, regularizacao: { area_matricula: null, area_iptu: null, levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' }, hidro_scope_includes_existing: null }).total_demello, '467.20');
  assert.ok(!/SERVICES_NOT_OFFERED/.test(await read('src/payload_v2.mjs')), 'a trava histórica foi removida');
});

test('texto livre em "Outro" continua sem virar serviço (a elétrica entra só pela opção própria)', () => {
  assert.deepEqual(derivePricingInputs({ route: 'known', services: ['Outro'], otherService: 'Elétrica', property: 'Comercial' }).services, []);
});

test('escopo fechado: sem deep link próprio, sem média/alta tensão e sem ressalva de competência ou acervo; nenhuma página institucional', async () => {
  assert.ok(!Object.keys(SERVICE_DEEPLINKS).some((k) => /el[eé]tric/.test(k)), 'nenhum atalho novo');
  assert.equal(initialState('?situacao=known&servico=eletrica').answers.services, undefined);
  for (const f of ['src/journey.mjs', 'src/GlobalApp.jsx', 'src/pickers.jsx', 'src/client_summary.mjs', 'src/payload_v2.mjs']) {
    const src = (await read(f)).replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/m[eé]dia tens[aã]o|alta tens[aã]o/i.test(src), `${f}: sem média/alta tensão`);
    assert.ok(!/atribui[cç][õo]es|n[aã]o (possui|temos|tem) (habilita|atribui|acervo)|sem acervo|acervo t[eé]cnico anterior/i.test(src), `${f}: sem ressalva de competência ou acervo`);
  }
  const root = path.join(HERE, '..', '..');
  for (const f of ['servicos/index.html', 'index.html', 'servicos/projeto-hidrossanitario/index.html', 'servicos/projeto-estrutural/index.html']) {
    assert.ok(!/projeto el[eé]trico/i.test(await readFile(path.join(root, f), 'utf8')), `${f}: nenhuma página institucional trata de elétrica`);
  }
});

test('mensuração: código controlado eletrica no contrato fechado; as doze disciplinas juntas cabem', () => {
  assert.deepEqual(serviceParams(casa('120')), { service: 'eletrica', service_count: 1 });
  assert.deepEqual(serviceParams(casa('120', ['Elétrica', 'Estrutural'])), { service: 'multiple', service_count: 2 });
  assert.equal(PARAMS.service('eletrica'), true);
  assert.equal(PARAMS.service('Elétrica'), false);
  assert.equal(PARAMS.service_count(12), true);
  assert.equal(PARAMS.service_count(13), false);
  const seen = [];
  const t = createTracking({ track: (name, params) => { seen.push({ name, params }); return { name, params }; }, pageView: () => {} });
  t.result(casa('63,5'), 'X3A');
  assert.equal(seen[0].name, 'estimate_completed');
  assert.deepEqual(seen[0].params, { route: 'known', service: 'eletrica', service_count: 1, result_status: 'calculated', step: 'X3A' });
});

test('edição: desmarcar a elétrica não deixa resíduo', () => {
  let a = known(['Elétrica', 'Estrutural'], { area_fundacao: { value: '80' } });
  a = updateAnswer(a, 'S1', ['Estrutural']);
  assert.deepEqual(derivePricingInputs(a).services, ['ESTRUTURAL']);
});

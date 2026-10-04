// Arquitetura como fluxo principal de valor: estimativa comercial de área (programa / terreno / ambos), hierarquia da origem,
// isolamento da área inferida, devolutiva educativa, ausência de afirmação legal, mensuração estruturada e preservação do pipeline.
// Nada aqui consulta município, legislação ou rede: o estimador é determinístico.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ARCH_CONFIG, ARCH_ESTIMATOR_VERSION } from '../src/architecture_config.mjs';
import { estimateArea, programBand, lotBand, programError, programValid, combineBands, SOURCE, areaBand, lotAreaBand, programSizeBand, roundStep, programSummaryText } from '../src/architecture_estimator.mjs';
import { architectureEstimate, architectureFields, architectureAnalytics, referenceAreaForPricing, inferredAreaCanFeedPricing, needsArchitectureTerrain, needsArchitectureProgram } from '../src/architecture.mjs';
import { architectureReturn, architecturePrice, allReturnTexts } from '../src/architecture_return.mjs';
import { packageForCRMv2, derivePricingInputs } from '../src/payload_v2.mjs';
import { routeNodes, advance, summary, valid, updateAnswer, nodes, missingData, services as SERVICE_OPTIONS } from '../src/journey.mjs';
import { initialState } from '../src/deeplink.mjs';
import { resultKind, allowedIntents } from '../src/funnel.mjs';
import { createTracking } from '../src/tracking.mjs';
import { createTracker, EVENTS, PARAMS } from '../../assets/js/analytics.mjs';
import { submitToCRM } from '../src/submit.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const LOC = { city: 'Curitiba', uf: 'PR' };
const unk = { value: '', unknown: true };
const known = (svc, extra = {}) => ({ route: 'known', services: svc, S2: 'Casa/sobrado', S3: { value: '200' }, location: LOC, S5: 'Só uma ideia / estudo', S6: 'Ainda sem prazo', ...extra });
const semArea = (svc, extra = {}) => known(svc, { S3: unk, ...extra });
const P = (o = {}) => ({ quartos: '2', suites: '0', banheiros: '1', garagem: '1', pavimentos: '1', padrao: 'confortavel', sala: true, cozinha: true, lavanderia: false, escritorio: false, varanda: false, ...o });
const P_EXEMPLO = P({ quartos: '3', suites: '1', banheiros: '2', garagem: '2', lavanderia: true });
const P_GRANDE = P({ quartos: '4', suites: '2', banheiros: '2', garagem: '3', pavimentos: '2', padrao: 'amplo', lavanderia: true, escritorio: true, varanda: true });
const arqSvc = (p, code = 'ARQUITETURA') => p.pricing_preview.services.find((s) => s.service === code);
const textOf = (o) => JSON.stringify(o);

// ---------------------------------------------------------------------------------------------------------------------
test('1. área CONHECIDA: usada diretamente (USER_DECLARED), nada é estimado e a devolutiva extra não aparece', () => {
  const a = known(['Arquitetura']);
  const est = architectureEstimate(a);
  assert.deepEqual([est.source, est.min, est.max, est.reference], [SOURCE.USER_DECLARED, 200, 200, 200]);
  assert.equal(architectureReturn(a), null);
  assert.equal(needsArchitectureTerrain(a), false);
  assert.equal(needsArchitectureProgram(a), false);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_preview.status, 'CALCULATED');
  assert.equal(p.pricing_preview.total_demello, '5665.60'); // 200 × 35,41 × 0,80
  assert.deepEqual([p.pricing_inputs.area_total, p.pricing_inputs.area_new], ['200', null]);
  assert.equal(p.answers.architecture_area_source, 'USER_DECLARED');
  assert.deepEqual([p.answers.architecture_area_min, p.answers.architecture_area_max, p.answers.architecture_area_reference], [200, 200, 200]);
  assert.equal(p.answers.architecture_estimation_inputs.area_declarada_m2, 200);
  assert.equal(p.answers.architecture_estimation_version, ARCH_ESTIMATOR_VERSION);
});

test('2. sem área, estimada pelo PROGRAMA: faixa 105–125 m², referência 115 m², preço pela referência', () => {
  assert.deepEqual(programBand(P_EXEMPLO), { min: 105, max: 125, reference: 115 });
  const a = semArea(['Arquitetura'], { arq_programa: P_EXEMPLO });
  const est = architectureEstimate(a);
  assert.deepEqual([est.source, est.min, est.max, est.reference], [SOURCE.NEEDS_PROGRAM_ESTIMATE, 105, 125, 115]);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_preview.status, 'CALCULATED');
  assert.equal(arqSvc(p).q, 115);
  assert.equal(p.pricing_preview.total_demello, '3257.72'); // 115 × 35,41 × 0,80
  assert.equal(p.pricing_inputs.area_new, '115');
  assert.equal(p.pricing_inputs.area_total, null, 'a estimada nunca é gravada como área total informada');
  assert.deepEqual(p.answers.S3, unk, 'o que o cliente respondeu continua "não sei"');
  assert.equal(p.answers.architecture_area_source, 'NEEDS_PROGRAM_ESTIMATE');
  assert.equal(p.answers.architecture_estimation_inputs.programa.suites, 1);
});

test('3. sem área, estimada SÓ pelo TERRENO: 350 m² -> faixa 230–240 m², referência 235 m²', () => {
  assert.deepEqual(lotBand('350'), { min: 230, max: 240, reference: 235, terreno: 350 });
  const a = semArea(['Arquitetura'], { area_terreno: { value: '350' } });
  const est = architectureEstimate(a);
  assert.deepEqual([est.source, est.min, est.max, est.reference], [SOURCE.LOT_ONLY_ESTIMATE, 230, 240, 235]);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_preview.total_demello, '6657.08'); // 235 × 35,41 × 0,80
  assert.equal(p.answers.architecture_estimation_inputs.terreno_m2, 350);
  assert.equal(p.answers.architecture_estimation_inputs.programa, null);
  const ret = architectureReturn(a);
  assert.deepEqual(ret.rows, [['Terreno informado', '350 m²'], ['Área construída estimada', '230 m² a 240 m²'], ['Referência usada no orçamento', '235 m²'], ['Estimativa inicial de Arquitetura', 'R$ 6.657,08']]);
});

test('4. PROGRAMA + TERRENO coerentes: interseção das faixas, origem PROGRAM_AND_LOT_ESTIMATE', () => {
  const a = semArea(['Arquitetura'], { arq_programa: P(), area_terreno: { value: '100' } }); // programa 60–75, terreno 65–70
  const est = architectureEstimate(a);
  assert.deepEqual([est.source, est.coherence, est.min, est.max, est.reference, est.intense], [SOURCE.PROGRAM_AND_LOT_ESTIMATE, 'COERENTE', 65, 70, 70, false]);
  assert.deepEqual(combineBands({ min: 100, max: 120, reference: 110 }, { min: 110, max: 130, reference: 120 }), { min: 110, max: 120, reference: 115, coherence: 'COERENTE', intense: false });
  assert.equal(packageForCRMv2(a).answers.architecture_area_source, 'PROGRAM_AND_LOT_ESTIMATE');
  // programa menor do que o terreno comporta: usa a faixa do programa
  const menor = architectureEstimate(semArea(['Arquitetura'], { arq_programa: P(), area_terreno: { value: '500' } }));
  assert.deepEqual([menor.coherence, menor.min, menor.max, menor.reference], ['PROGRAMA_MENOR_QUE_O_TERRENO', 60, 75, 70]);
});

test('5. programa grande para o terreno: NÃO rejeita, NÃO conclui juridicamente; usa a faixa do programa e avisa', () => {
  const a = semArea(['Arquitetura'], { arq_programa: P_GRANDE, area_terreno: { value: '200' } });
  const est = architectureEstimate(a);
  assert.deepEqual([est.source, est.coherence, est.intense, est.min, est.max, est.reference], [SOURCE.PROGRAM_AND_LOT_ESTIMATE, 'PROGRAMA_MAIOR_QUE_O_TERRENO', true, 190, 225, 190]);
  const p = packageForCRMv2(a);
  assert.equal(p.pricing_preview.status, 'CALCULATED', 'segue para a estimativa');
  assert.equal(p.answers.architecture_estimation_inputs.programa_acima_do_terreno, true);
  const ret = architectureReturn(a);
  assert.match(ret.paragraphs[0], /pode exigir um aproveitamento mais intenso do terreno/);
  assert.match(ret.paragraphs[0], /utilizaremos aproximadamente 190 m²\. A viabilidade será conferida na análise técnica\./);
  assert.doesNotMatch(allReturnTexts(ret).join(' '), /não é possível|inviável|reprovad|não pode/i);
});

test('6. sem área, sem terreno e sem programa: não inventa, não precifica, conferência humana', () => {
  for (const extra of [{}, { area_terreno: unk }, { arq_programa: { unknown: true } }, { area_terreno: unk, arq_programa: { unknown: true } }]) {
    const a = semArea(['Arquitetura'], extra);
    const est = architectureEstimate(a);
    assert.equal(est.source, SOURCE.HUMAN_REVIEW_REQUIRED);
    assert.deepEqual([est.min, est.max, est.reference], [null, null, null]);
    const p = packageForCRMv2(a);
    assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
    assert.equal(p.pricing_preview.total_demello, null);
    assert.deepEqual([p.pricing_inputs.area_new, p.pricing_inputs.area_total], [null, null]);
    assert.equal(p.answers.architecture_area_source, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(resultKind(a), 'review');
    assert.deepEqual(allowedIntents(a), ['evaluation_only']);
    const ret = architectureReturn(a);
    assert.equal(ret.price, null);
    assert.match(ret.next, /envie o caso para avaliação/);
    assert.ok(missingData(a).some((m) => /Área do projeto de Arquitetura/.test(m)));
  }
});

test('7/8. ISOLAMENTO: a área inferida alimenta só a Arquitetura; com Estrutural/Hidro/Incêndio ela não entra em pricing_inputs', () => {
  for (const outro of ['Estrutural', 'Fundações', 'Hidrossanitário', 'Drenagem', 'Incêndio']) {
    const a = semArea(['Arquitetura', outro], { area_terreno: { value: '350' } });
    assert.equal(inferredAreaCanFeedPricing(a), false, outro);
    assert.equal(referenceAreaForPricing(a), null, outro);
    const inp = derivePricingInputs(a);
    assert.deepEqual([inp.area_new, inp.area_total, inp.area_existing], [null, null, null], `${outro}: nenhuma área inferida em pricing_inputs`);
    const p = packageForCRMv2(a);
    assert.equal(p.pricing_preview.status, 'NEEDS_HUMAN_REVIEW', `${outro}: o outro serviço continua sem área`);
    assert.equal(p.answers.architecture_estimation_inputs.referencia_alimenta_precificacao, false);
    // a devolutiva ainda entrega o preço inicial SÓ da Arquitetura
    const ret = architectureReturn(a);
    assert.equal(ret.price, 'R$ 6.657,08');
    assert.equal(architecturePrice(a, 235), 'R$ 6.657,08');
  }
  // serviços que NÃO leem a área do projeto convivem com a Arquitetura estimada
  for (const outro of ['Gás', 'Compatibilização BIM', 'Orçamento técnico', 'Terraplenagem', 'Consultoria Técnica']) {
    assert.equal(inferredAreaCanFeedPricing(semArea(['Arquitetura', outro])), true, outro);
  }
  const mix = semArea(['Arquitetura', 'Orçamento técnico'], { area_terreno: { value: '350' }, area_orcamento: { value: '300' } });
  const pm = packageForCRMv2(mix);
  assert.equal(pm.pricing_preview.status, 'CALCULATED');
  assert.equal(arqSvc(pm).q, 235);
  assert.equal(arqSvc(pm, 'ORCAMENTO').q, 300, 'o orçamento técnico usa a SUA área, não a inferida');
  // área INFORMADA pelo cliente continua valendo para todos (comportamento anterior)
  const comum = packageForCRMv2(known(['Arquitetura', 'Estrutural']));
  assert.equal(comum.pricing_inputs.area_total, '200');
});

test('9. limites mínimos e máximos do terreno, do programa e da área plausível', () => {
  const L = ARCH_CONFIG.lot;
  assert.notEqual(lotBand(String(L.terrenoMin)), null);
  assert.equal(lotBand(String(L.terrenoMin - 1)), null);
  assert.deepEqual(lotBand('40'), { min: 25, max: 30, reference: 30, terreno: 40 });
  assert.notEqual(lotBand(String(L.terrenoMax)), null);
  assert.equal(lotBand(String(L.terrenoMax + 1)), null);
  assert.equal(lotBand('1000').max, L.tetoAreaConstruida, 'teto conservador');
  assert.equal(lotBand('5000').reference, L.tetoAreaConstruida);
  assert.equal(estimateArea({ lot: '39' }).source, SOURCE.HUMAN_REVIEW_REQUIRED);
  assert.equal(estimateArea({ lot: '5001' }).source, SOURCE.HUMAN_REVIEW_REQUIRED);
  assert.equal(estimateArea({ lot: '40' }).source, SOURCE.LOT_ONLY_ESTIMATE);
  // programa vazio/mínimo demais => absurdo
  assert.equal(programError(P({ quartos: '0', suites: '0', banheiros: '0', garagem: '0', sala: false, cozinha: false })), 'absurdo');
  assert.equal(estimateArea({ program: P({ quartos: '0', suites: '0', banheiros: '0', garagem: '0', sala: false, cozinha: false }) }).source, SOURCE.HUMAN_REVIEW_REQUIRED);
  // máximo permitido pelos limites continua plausível
  const max = P({ quartos: '10', suites: '10', banheiros: '10', garagem: '6', pavimentos: '4', padrao: 'amplo', lavanderia: true, escritorio: true, varanda: true });
  assert.equal(programError(max), null);
  assert.ok(programBand(max).max <= ARCH_CONFIG.areaPlausivel.max);
  for (const [k, v] of [['quartos', '11'], ['suites', '11'], ['banheiros', '11'], ['garagem', '7'], ['pavimentos', '5'], ['pavimentos', '0']]) assert.equal(programError(P({ [k]: v })), k, `${k}=${v}`);
});

test('10. entradas inválidas, negativas, vazias, absurdas ou hostis caem em estado seguro (sem exceção, sem área inventada)', () => {
  for (const ruim of [undefined, null, '', ' ', '-5', '0', 'abc', '1e3', '350,555', '1.000,50', '12.5.3', '∞', 'NaN', '__proto__', '<script>', '9'.repeat(40), {}, [], { value: 'x' }, { unknown: true }]) {
    assert.doesNotThrow(() => lotBand(ruim));
    assert.equal(lotBand(ruim), null, String(JSON.stringify(ruim)));
    assert.equal(estimateArea({ lot: ruim }).source, SOURCE.HUMAN_REVIEW_REQUIRED);
  }
  for (const ruim of [undefined, null, 0, 'x', [], {}, { unknown: true }, P({ padrao: 'luxo' }), P({ padrao: '__proto__' }), P({ quartos: '-1' }), P({ quartos: '2.5' }), P({ quartos: 'dois' }), P({ pavimentos: '' }), P({ suites: null }), P({ garagem: undefined }), P({ sala: 'sim' }), { constructor: 1 }]) {
    assert.doesNotThrow(() => programBand(ruim));
    if (ruim && typeof ruim === 'object' && ruim.sala === 'sim') { assert.equal(programError(ruim), null); continue; } // texto no lugar de booleano vale como "não marcado"
    assert.notEqual(programError(ruim), null, JSON.stringify(ruim));
    assert.equal(programBand(ruim), null);
  }
  assert.equal(estimateArea({ declared: '-10', lot: '-3', program: P({ padrao: 'luxo' }) }).source, SOURCE.HUMAN_REVIEW_REQUIRED);
  assert.equal(estimateArea().source, SOURCE.HUMAN_REVIEW_REQUIRED);
  // programa com booleano trocado por texto não infla a área
  assert.deepEqual(programBand(P({ sala: 'sim' })), programBand(P({ sala: false })));
});

test('11. arredondamento e formação das faixas: múltiplos de 5, min ≤ referência ≤ max, determinístico (varredura)', () => {
  assert.equal(roundStep(232.4), 230);
  assert.equal(roundStep(232.5), 235);
  for (let t = 40; t <= 5000; t += 37) {
    const b = lotBand(String(t));
    assert.ok(b.min % 5 === 0 && b.max % 5 === 0 && b.reference % 5 === 0, `terreno ${t}`);
    assert.ok(b.min <= b.reference && b.reference <= b.max, `terreno ${t}`);
    assert.ok(b.max <= ARCH_CONFIG.lot.tetoAreaConstruida);
    assert.deepEqual(lotBand(String(t)), b, 'determinístico');
  }
  for (const q of [0, 1, 2, 3, 5]) for (const s of [0, 1, 2]) for (const b of [1, 2, 3]) for (const pav of [1, 2, 3]) for (const pad of ['compacto', 'confortavel', 'amplo']) {
    const p = P({ quartos: String(q), suites: String(s), banheiros: String(b), pavimentos: String(pav), padrao: pad });
    const band = programBand(p);
    if (!band) continue;
    assert.ok(band.min % 5 === 0 && band.max % 5 === 0 && band.reference % 5 === 0);
    assert.ok(band.min <= band.reference && band.reference <= band.max);
  }
  // mais ambientes nunca diminuem a área
  assert.ok(programBand(P({ quartos: '3' })).reference >= programBand(P({ quartos: '2' })).reference);
  assert.ok(programBand(P({ padrao: 'amplo' })).reference >= programBand(P({ padrao: 'compacto' })).reference);
});

test('12. origem e versão da estimativa registradas; campos explícitos do payload (sem texto livre)', () => {
  assert.equal(ARCH_ESTIMATOR_VERSION, 'ARQ_EST_V1');
  assert.deepEqual(Object.values(SOURCE), ['USER_DECLARED', 'NEEDS_PROGRAM_ESTIMATE', 'PROGRAM_AND_LOT_ESTIMATE', 'LOT_ONLY_ESTIMATE', 'HUMAN_REVIEW_REQUIRED']);
  const f = architectureFields(semArea(['Arquitetura'], { arq_programa: P_EXEMPLO, area_terreno: { value: '350' }, otherService: 'texto livre qualquer', P2: 'relato' }));
  assert.deepEqual(Object.keys(f).sort(), ['architecture_area_max', 'architecture_area_min', 'architecture_area_reference', 'architecture_area_source', 'architecture_estimation_inputs', 'architecture_estimation_version']);
  assert.equal(f.architecture_estimation_version, 'ARQ_EST_V1');
  assert.doesNotMatch(JSON.stringify(f), /texto livre|relato|Curitiba/);
  assert.equal(architectureFields({ route: 'build', services: ['Estrutural'] }), null, 'sem Arquitetura, nenhum campo novo');
  // não aparece no payload de quem não escolheu Arquitetura
  const p = packageForCRMv2(known(['Estrutural']));
  assert.ok(!Object.keys(p.answers).some((k) => k.startsWith('architecture_')));
});

test('13. preço calculado pela área de referência, pelo mesmo motor e pela Tabela V2 (nenhuma fórmula nova)', () => {
  for (const [lot, ref] of [['350', 235], ['100', 70], ['40', 30], ['1000', 600]]) {
    const a = semArea(['Arquitetura'], { area_terreno: { value: lot } });
    const p = packageForCRMv2(a);
    assert.equal(arqSvc(p).q, ref);
    const esperado = (ref * 35.41 * 0.8).toFixed(2);
    assert.equal(p.pricing_preview.total_demello, esperado, `terreno ${lot}`);
    assert.equal(architecturePrice(a, ref), `R$ ${Number(esperado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }
  assert.equal(architecturePrice(semArea(['Arquitetura']), null), null);
});

test('14/15. devolutiva educativa completa e SEM afirmação legal (todas as origens)', () => {
  const FORBIDDEN = [
    /você pode construir \d/i, /pode construir (até )?\d+\s*m/i, /a área permitida (é|será|de)/i, /área máxima permitida/i, /este é o potencial construtivo/i, /o potencial construtivo (legal )?(é|será)/i,
    /a prefeitura (autoriza|permite|aprova)/i, /consultamos (o|a) (código|legislação|prefeitura|plano diretor)/i, /esta metragem (está )?(aprovada|autorizada|permitida)/i, /direito adquirido/i, /garantimos|aprovação garantida/i,
  ];
  const cenarios = [
    semArea(['Arquitetura'], { arq_programa: P_EXEMPLO }),
    semArea(['Arquitetura'], { area_terreno: { value: '350' } }),
    semArea(['Arquitetura'], { arq_programa: P(), area_terreno: { value: '100' } }),
    semArea(['Arquitetura'], { arq_programa: P(), area_terreno: { value: '500' } }),
    semArea(['Arquitetura'], { arq_programa: P_GRANDE, area_terreno: { value: '200' } }),
    semArea(['Arquitetura']),
  ];
  const sources = new Set();
  for (const a of cenarios) {
    const ret = architectureReturn(a);
    sources.add(ret.source);
    const txt = allReturnTexts(ret).join('\n');
    for (const re of FORBIDDEN) assert.doesNotMatch(txt, re);
    // estrutura obrigatória
    assert.equal(ret.title, 'Seu ponto de partida');
    assert.match(ret.disclaimer, /referência inicial para o orçamento/);
    assert.match(ret.disclaimer, /não é a área permitida nem o potencial construtivo/);
    assert.match(ret.disclaimer, /Na etapa técnica, a DEMELLO analisa o terreno e a legislação aplicável/);
    assert.match(ret.next, /^Próximo passo:/);
    if (ret.source !== SOURCE.HUMAN_REVIEW_REQUIRED) {
      const labels = ret.rows.map((r) => r[0]);
      assert.ok(labels.includes('Área construída estimada') && labels.includes('Referência usada no orçamento') && labels.includes('Estimativa inicial de Arquitetura'));
      assert.ok(ret.why && ret.why.title && ret.why.text, 'explicação educativa');
      assert.match(txt, /estimativa inicial|faixa aproximada|aproximadamente/);
    }
    if (ret.source === SOURCE.LOT_ONLY_ESTIMATE) {
      assert.equal(ret.why.title, 'Por que a construção não ocupa todo o terreno?');
      assert.match(ret.why.text, /recuos, permeabilidade, taxa de ocupação, circulação e regras de zoneamento/);
      assert.match(ret.paragraphs[0], /Algumas coisinhas complicadas — como recuos, permeabilidade, taxa de ocupação e zoneamento — normalmente reduzem a área aproveitável/);
    }
    if (ret.source === SOURCE.NEEDS_PROGRAM_ESTIMATE) assert.match(ret.paragraphs[0], /Pelo programa informado, sua casa provavelmente ficará entre .* e .*\. Para calcular esta estimativa inicial, consideraremos .*\./);
  }
  assert.equal(sources.size, 4, 'as quatro modalidades cobertas (+ conferência humana)'.length ? 4 : 0);
  // o código-fonte das mensagens também não carrega afirmações legais
  return readFile(path.join(appRoot, 'src/architecture_return.mjs'), 'utf8').then((src) => {
    const strings = [...src.matchAll(/`([^`]*)`|'([^'\n]{25,})'/g)].map((m) => m[1] ?? m[2]).join('\n');
    for (const re of FORBIDDEN) assert.doesNotMatch(strings, re);
  });
});

test('16. mensuração: eventos architecture_* só com enums/faixas, sem texto livre, valores exatos ou dados pessoais; deduplicados', () => {
  const NOMES = ['architecture_area_known', 'architecture_area_unknown', 'architecture_estimator_started', 'architecture_estimated_by_program', 'architecture_estimated_by_lot', 'architecture_estimated_by_program_and_lot', 'architecture_estimator_human_review', 'architecture_estimate_presented'];
  for (const n of NOMES) assert.ok(EVENTS[n], n);
  const PERMITIDOS = new Set(['area_source', 'area_band', 'lot_area_band', 'program_size_band', 'estimation_version']);
  for (const n of NOMES) for (const p of EVENTS[n].params) assert.ok(PERMITIDOS.has(p), `${n}.${p}`);
  const run = (a) => {
    const t = createTracker({ emitter: 'site' }); const seen = []; t.subscribe((e) => seen.push(e));
    const tracking = createTracking({ track: t.track, pageView: () => {} });
    const rico = { ...a, otherService: 'Rua Secreta 123', P2: 'relato sigiloso' };
    tracking.result({ ...rico, scope_question: 'minha dúvida íntima', contact: { name: 'Maria da Silva', whatsapp: '41999990000', email: 'm@x.com' }, photos: [{ name: 'foto.png' }] }, 'X3A');
    tracking.result({ ...rico }, 'X3A'); // re-render (contato, fotos e dúvida não mudam a identidade): sem duplicar
    return seen.filter((e) => e.name.startsWith('architecture_'));
  };
  const casos = {
    conhecida: [known(['Arquitetura']), ['architecture_area_known']],
    programa: [semArea(['Arquitetura'], { arq_programa: P_EXEMPLO }), ['architecture_area_unknown', 'architecture_estimator_started', 'architecture_estimated_by_program', 'architecture_estimate_presented']],
    terreno: [semArea(['Arquitetura'], { area_terreno: { value: '350' } }), ['architecture_area_unknown', 'architecture_estimator_started', 'architecture_estimated_by_lot', 'architecture_estimate_presented']],
    ambos: [semArea(['Arquitetura'], { arq_programa: P(), area_terreno: { value: '100' } }), ['architecture_area_unknown', 'architecture_estimator_started', 'architecture_estimated_by_program_and_lot', 'architecture_estimate_presented']],
    humana: [semArea(['Arquitetura']), ['architecture_area_unknown', 'architecture_estimator_started', 'architecture_estimator_human_review']],
  };
  for (const [nome, [a, esperados]] of Object.entries(casos)) {
    const ev = run(a);
    assert.deepEqual(ev.map((e) => e.name), esperados, nome);
    const blob = JSON.stringify(ev);
    for (const segredo of ['Rua Secreta', 'relato sigiloso', 'dúvida íntima', 'Maria', '41999990000', 'm@x.com', 'foto.png', 'Curitiba', '"350"', ':350', ':235', ':115', ':200']) assert.equal(blob.includes(segredo), false, `${nome}: ${segredo}`);
    for (const e of ev) for (const [k, v] of Object.entries(e.params)) assert.equal(PARAMS[k](v), true, `${e.name}.${k}=${v}`);
  }
  const ev = run(casos.terreno[0]);
  assert.deepEqual(ev.find((e) => e.name === 'architecture_estimated_by_lot').params, { area_band: '150_250', area_source: 'LOT_ONLY_ESTIMATE', estimation_version: 'ARQ_EST_V1', lot_area_band: '200_360' });
  assert.deepEqual(architectureAnalytics(known(['Estrutural'])), null);
  assert.deepEqual([areaBand(null), areaBand(59), areaBand(60), areaBand(400), lotAreaBand(199), lotAreaBand(1000), programSizeBand(79), programSizeBand(220)], ['na', 'lt_60', '60_100', 'gt_400', 'lt_200', 'gt_1000', 'lt_80', 'gt_220']);
});

test('17. compatibilidade com os deep links existentes (Arquitetura abre selecionada; demais intactos)', () => {
  assert.deepEqual(initialState('?situacao=known&servico=arquitetura'), { id: 'S1', answers: { route: 'known', services: ['Arquitetura'] }, history: ['HOME'] });
  assert.deepEqual(initialState('?situacao=known&servico=estrutural').answers.services, ['Estrutural']);
  assert.equal(initialState('?situacao=known&servico=arquitetura&servico=arquitetura').answers.services, undefined, 'duplicado continua fail-closed');
  assert.ok(SERVICE_OPTIONS.includes('Arquitetura'));
});

test('18. SEQUÊNCIA DO PIPELINE preservada: tudo que não é Arquitetura sem área é idêntico ao baseline V2 aprovado', async () => {
  const fx = JSON.parse(await readFile(path.join(appRoot, 'tests/fixtures/pipeline_baseline_v2.json'), 'utf8'));
  assert.ok(fx.cases.length >= 25);
  for (const c of fx.cases) {
    assert.deepEqual(routeNodes(c.answers), c.route_nodes, `${c.name}: nós da rota`);
    assert.deepEqual(summary(c.answers), c.summary, `${c.name}: resumo`);
    assert.equal(advance('X1', c.answers, 'preview').id, c.advance_x1, `${c.name}: X1 -> resultado`);
    if (c.pricing_inputs) {
      const p = packageForCRMv2(c.answers);
      assert.deepEqual(p.pricing_inputs, c.pricing_inputs, `${c.name}: pricing_inputs`);
      assert.equal(p.pricing_preview.status, c.pricing_status, `${c.name}: status`);
      assert.equal(p.pricing_preview.total_demello, c.total, `${c.name}: total`);
      assert.ok(!Object.keys(p.answers).some((k) => k.startsWith('architecture_')), `${c.name}: sem campos de Arquitetura`);
    }
  }
  // a ordem global das etapas continua a mesma
  assert.equal(advance('X1', known(['Estrutural']), 'preview').id, 'X3A');
  assert.equal(advance('X3A', known(['Estrutural']), 'preview').id, 'X4');
  assert.equal(advance('X4', known(['Estrutural']), 'preview').id, 'CRM');
  // Arquitetura COM área: mesma rota de antes; SEM área: só a ramificação entre S3 e S4
  assert.deepEqual(routeNodes(known(['Arquitetura'])), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.deepEqual(routeNodes(semArea(['Arquitetura'])), ['S1', 'S2', 'S3', 'Q_TERR_ARQ', 'ARQ_PROG', 'S4', 'S5', 'S6']);
});

test('ramificação: navegação S3 -> terreno -> programa -> S4, validação do nó de programa e limpeza das respostas', () => {
  const base = semArea(['Arquitetura'], { location: undefined });
  assert.equal(advance('S3', base, 'preview').id, 'Q_TERR_ARQ');
  assert.equal(advance('Q_TERR_ARQ', { ...base, area_terreno: { value: '350' } }, 'preview').id, 'ARQ_PROG');
  assert.equal(advance('Q_TERR_ARQ', { ...base, area_terreno: unk }, 'preview').id, 'ARQ_PROG', '"não sei" o terreno também avança');
  assert.equal(advance('ARQ_PROG', { ...base, area_terreno: unk, arq_programa: P_EXEMPLO }, 'preview').id, 'S4');
  assert.equal(advance('ARQ_PROG', { ...base, area_terreno: unk, arq_programa: { unknown: true } }, 'preview').id, 'S4');
  // com Terraplenagem o terreno já foi perguntado: pula direto para o programa
  assert.equal(advance('S3', semArea(['Arquitetura', 'Terraplenagem'], { location: undefined, area_terreno: { value: '500' } }), 'preview').id, 'ARQ_PROG');
  // validação
  assert.equal(valid('ARQ_PROG', { arq_programa: P_EXEMPLO }), true);
  assert.equal(valid('ARQ_PROG', { arq_programa: { unknown: true } }), true);
  assert.equal(valid('ARQ_PROG', { arq_programa: P({ padrao: undefined }) }), false);
  assert.equal(valid('ARQ_PROG', {}), false);
  assert.equal(nodes.ARQ_PROG.type, 'program');
  // resumo: programa legível e área estimada em linha derivada (não editável)
  const a = semArea(['Arquitetura'], { arq_programa: P_EXEMPLO, area_terreno: { value: '350' } });
  const rows = summary(a);
  assert.ok(rows.some((r) => r.label === 'Programa de necessidades' && /3 quartos, 1 suíte, 2 banheiros, sala, cozinha, lavanderia, 2 vagas de garagem, 1 pavimento, padrão confortável/.test(r.value)));
  const derived = rows.find((r) => /estimada, não informada por você/.test(r.label));
  assert.ok(derived && derived.id === null && /115 m² \(faixa de 105 a 125 m²\)/.test(derived.value));
  assert.equal(programSummaryText({ unknown: true }), 'Ainda não sei os ambientes');
  // informar a área depois descarta o programa; tirar a Arquitetura também
  assert.equal(updateAnswer(a, 'S3', { value: '180' }).arq_programa, undefined);
  assert.equal(updateAnswer(a, 'S1', ['Estrutural']).arq_programa, undefined);
  assert.deepEqual(updateAnswer(a, 'S3', unk).arq_programa, P_EXEMPLO, 'continua "não sei": preserva o programa');
});

test('19. regressão: serviços existentes inalterados (preços, tabela, motor, envio por hash) e 20. CRM não homologado = falha segura', async () => {
  const sha = async (f) => createHash('sha256').update((await readFile(path.join(appRoot, f), 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(await sha('src/pricing/pricing-table.v2.json'), '9a94f6afac58a79ae3cdeb66d7aea61611b7772fb61b324360c594f71b866dc1', 'Tabela V2 intocada');
  assert.equal(await sha('src/pricing/engine.mjs'), '12d243d2f9e0d6b519f120895b8ff1dd7cd60a8a513f1b7c331474a83abbb0a7', 'motor intocado');
  assert.equal(await sha('src/pricing/decimal.mjs'), 'de8ff4f5bdba6d159d24d0ef44daa1febef6d01e29be9b86132d054dd87c1a48');
  assert.equal(await sha('src/submit.mjs'), '4ba7605a4961b19ca29b7c38102b35fb6a79d3784f000afa30f955d36d462d15', 'envio ao CRM intocado');
  // CRM não homologado: o payload novo segue no mesmo envelope; recusa do Worker (422) e queda de rede não lançam e não repetem indevidamente
  const payload = packageForCRMv2({ ...semArea(['Arquitetura'], { arq_programa: P_EXEMPLO }), contact: { name: 'Fulana', whatsapp: '41999990000', email: '' } });
  assert.equal(payload.schema, 'site-intake/payload/2');
  assert.equal(payload.sent_to_crm, false);
  const calls = [];
  const fakeFetch = (status) => async (url, opts) => { calls.push(JSON.parse(opts.body)); return { status, json: async () => ({ error: 'invalid-payload' }) }; };
  calls.length = 0;
  const r422 = await submitToCRM(payload, '', { endpoint: 'https://exemplo.invalid/api', fetchImpl: fakeFetch(422) });
  assert.deepEqual([r422.ok, r422.status, calls.length], [false, 422, 1], '422 é final, sem retentativa');
  assert.equal(calls[0].payload.answers.architecture_area_source, 'NEEDS_PROGRAM_ESTIMATE', 'enviado verbatim; o Worker decide');
  const r500 = await submitToCRM(payload, '', { endpoint: 'https://exemplo.invalid/api', fetchImpl: fakeFetch(500) });
  assert.equal(r500.ok, false);
  assert.equal((await submitToCRM(payload, '', { endpoint: '', fetchImpl: null })).error, 'no-endpoint');
  const net = await submitToCRM(payload, '', { endpoint: 'https://exemplo.invalid/api', fetchImpl: async () => { throw new Error('rede'); } });
  assert.equal(net.ok, false);
  // a documentação reflete o status real: contrato localizado e validado (Marcos); nada de 'contrato não encontrado'
  const w = await readFile(path.join(siteRoot, 'docs/CLASSIFICACAO_WORKER_CRM.md'), 'utf8');
  assert.match(w, /LOCALIZADO e VALIDADO/);
  assert.doesNotMatch(w, /contrato não encontrado|Contrato canônico não encontrado/i);
  const pend = await readFile(path.join(siteRoot, 'docs/PENDENCIAS_VALIDACAO_HUMANA.md'), 'utf8');
  assert.doesNotMatch(pend, /não encontrado|não homologado/i);
});

test('base municipal fora do fluxo ativo: nenhum arquivo ativo a importa e a estimativa não menciona município/legislação como fonte', async () => {
  for (const f of ['src/GlobalApp.jsx', 'src/journey.mjs', 'src/payload_v2.mjs', 'src/architecture.mjs', 'src/architecture_estimator.mjs', 'src/architecture_return.mjs', 'src/architecture_config.mjs', 'src/tracking.mjs', 'src/funnel.mjs']) {
    const src = await readFile(path.join(appRoot, f), 'utf8');
    assert.doesNotMatch(src, /municipal\/|municipalEngine|derivedProjectArea|BASE_INDISPONIVEL/, `${f} ainda depende da base municipal`);
  }
  const ret = await readFile(path.join(appRoot, 'src/architecture_return.mjs'), 'utf8');
  assert.doesNotMatch(ret.replace(/\/\/[^\n]*/g, ''), /Curitiba|RMC|código de obras|plano diretor/i);
  const cfg = await readFile(path.join(appRoot, 'src/architecture_config.mjs'), 'utf8');
  assert.match(cfg, /NÃO regra urbanística/);
  assert.match(cfg, /precisam de validação humana/);
  // parâmetros só em um lugar: o estimador não tem fatores numéricos próprios
  const est = (await readFile(path.join(appRoot, 'src/architecture_estimator.mjs'), 'utf8')).replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(est, /0\.6[0-9]|1\.15|0\.92|1\.08|\b35\.41\b/, 'sem números mágicos no estimador');
});

// PRÉVIA DEMELLO VERIFICÁVEL V1 - frente (emissão + peça PNG + página de verificação).
// node --test, sem dependências (builtins node: apenas).
//
// Contrato consolidado: o Worker devolve SOMENTE PUBLIC_PREVIEW_V1 (sanitizado).
// A frente consome exclusivamente essa projeção — nunca o canonical interno,
// o fingerprint nem o fator da metodologia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { issuePreview, pickCaseSummary, caseSummaryFromRows, verifyUrl, expectationFromPreview, OUTDATED_MESSAGE } from '../src/preview.mjs';
import { buildPreviewLayout, renderPreviewPng, planLayout } from '../src/preview_png.mjs';
import { encodeQr } from '../src/qr.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- PUBLIC_PREVIEW_V1 de fixture (o que o Worker devolveria p/ 150/0) --------
const FIXTURE_INPUTS = { services: ['REGULARIZACAO'], typology: 'CASA',
  regularizacao: { area_iptu: '150', area_matricula: '0', levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' } };
const FIXTURE_PREVIEW = buildPricingPreview(FIXTURE_INPUTS);

// projeta os serviços do motor para a forma pública {service,status,references{total},total_demello}
function publicServices(preview) {
  return preview.services.filter((s) => s.status === 'CALCULATED').map((s) => {
    const references = {};
    if (s.references && s.references.secid_pr) references.secid_pr = { total: s.references.secid_pr.total };
    if (s.references && s.references.altoqi) references.altoqi = { total: s.references.altoqi.total };
    return { service: s.service, status: 'CALCULATED', references, total_demello: s.demello.total };
  });
}

const FIXTURE_DISCLAIMERS = [
  'Esta é uma previsão inicial calculada automaticamente a partir das informações fornecidas pelo usuário e das referências indicadas. Não constitui proposta comercial, contrato, diagnóstico técnico, orçamento de obra ou definição final de escopo.',
  'As informações do caso foram fornecidas pelo usuário e não representam, por si só, conferência documental ou diagnóstico técnico pela DEMELLO Engenharia.',
];

function fixtureRecord(overrides = {}) {
  const preview = {
    schema_version: 'PREVIEW_RECORD_V1',
    case_summary: {
      necessidade: 'Regularizar meu imóvel',
      situacao: 'A área do IPTU e da matrícula não bate',
      finalidade: 'Quero deixar o imóvel regular',
      localizacao: 'Curitiba / PR',
      tipo_imovel: 'Casa / sobrado',
      documentos: 'Matrícula + IPTU',
      motivo_diferenca: 'Ampliação/construção',
      servicos: ['Regularização'],
      area_iptu: '150 m²', area_matricula: '0 m²', diferenca: '150 m²',
    },
    methodology: { table_version: 'DEMELLO_V1' },
    pricing: {
      status: 'CALCULATED',
      currency: 'BRL',
      total_demello: FIXTURE_PREVIEW.total_demello,
      services: publicServices(FIXTURE_PREVIEW),
      ...(overrides.pricing || {}),
    },
    disclaimers: FIXTURE_DISCLAIMERS,
    ...(overrides.preview || {}),
  };
  return {
    schema: overrides.schema || 'PUBLIC_PREVIEW_V1',
    verification_code: overrides.verification_code || 'k3m7q9r2t5w8x4z6',
    issued_at: overrides.issued_at || '2026-09-06T12:34:56Z',
    status: 'ISSUED',
    integrity: { status: 'VERIFIED' },
    preview,
  };
}

// --- issuePreview ------------------------------------------------------------
test('issuePreview sem endpoint -> {ok:false, no-endpoint}, nunca lança', async () => {
  const r = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: '', fetchImpl: null });
  assert.deepEqual(r, { ok: false, status: 0, error: 'no-endpoint' });
});

test('issuePreview: 201 PUBLIC_PREVIEW_V1 -> {ok, record}; envia só pricing_inputs + case_summary allowlisted', async () => {
  let sent = null;
  const fetchImpl = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return { status: 201, json: async () => fixtureRecord() };
  };
  const r = await issuePreview(FIXTURE_INPUTS,
    { necessidade: 'x', nome: 'Fulano', email: 'a@b.com', contact: { name: 'x' } },
    { endpoint: 'https://w/api', fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.record.schema, 'PUBLIC_PREVIEW_V1');
  assert.equal(r.record.verification_code, 'k3m7q9r2t5w8x4z6');
  assert.deepEqual(Object.keys(sent).sort(), ['case_summary', 'expectation', 'pricing_inputs']);
  // expectativa = o que o navegador apresentou (regime, total e valor por serviço); o Worker é a autoridade
  assert.deepEqual(sent.expectation, {
    table_version: 'DEMELLO_V2', pricing_rule: 'STRUCT_COMPOSITE_REFS_R2', total_demello: FIXTURE_PREVIEW.total_demello,
    services: [{ service: 'REGULARIZACAO', total_demello: FIXTURE_PREVIEW.services[0].demello.total }],
  });
  assert.equal(sent.case_summary.necessidade, 'x');
  for (const k of ['nome', 'email', 'contact']) assert.equal(sent.case_summary[k], undefined);
});

test('expectationFromPreview: só pacote calculado; uma entrada por serviço calculado, em ordem; valores como texto decimal', () => {
  const pv = buildPricingPreview({ services: ['ESTRUTURAL', 'ELETRICA'], typology: 'CASA', structural_system: 'CONCRETO_ARMADO',
    area_new: '250', area_total: '250', area_fundacao: '150' });
  assert.deepEqual(expectationFromPreview(pv), {
    table_version: 'DEMELLO_V2', pricing_rule: 'STRUCT_COMPOSITE_REFS_R2', total_demello: '5520.00',
    services: [{ service: 'ESTRUTURAL', total_demello: '4272.00' }, { service: 'ELETRICA', total_demello: '1248.00' }],
  });
  assert.equal(expectationFromPreview(buildPricingPreview({ services: ['ESTRUTURAL'] })), null);
  assert.equal(expectationFromPreview(null), null);
});

test('issuePreview usa a prévia APRESENTADA quando informada (não recalcula no lugar do que o cliente viu)', async () => {
  let sent = null;
  const fetchImpl = async (url, opts) => { sent = JSON.parse(opts.body); return { status: 201, json: async () => fixtureRecord() }; };
  const presented = { ...FIXTURE_PREVIEW, total_demello: '1.00' };
  await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl, presented });
  assert.equal(sent.expectation.total_demello, '1.00');
});

test('issuePreview: 409 PRICING_VERSION_MISMATCH -> {ok:false, outdated:true}, sem retentativa e sem lançar', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { status: 409, json: async () => ({ error: 'PRICING_VERSION_MISMATCH', reason: 'TOTAL_MISMATCH' }) }; };
  const r = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl });
  assert.deepEqual([r.ok, r.status, r.error, r.outdated], [false, 409, 'PRICING_VERSION_MISMATCH', true]);
  assert.equal(calls, 1, '409 é final: não retenta');
  assert.equal(OUTDATED_MESSAGE, 'A calculadora foi atualizada. Recarregue a página e confira sua estimativa antes de gerar a prévia.');
  // outro 409 (sem o erro de versão) não é tratado como "página desatualizada"
  const other = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl: async () => ({ status: 409, json: async () => ({ error: 'INTEGRITY_MISMATCH' }) }) });
  assert.equal(other.outdated, false);
});

test('issuePreview: resposta sem schema PUBLIC_PREVIEW_V1 -> {ok:false}', async () => {
  const fetchImpl = async () => ({ status: 201, json: async () => ({ verification_code: 'x', canonical: {}, fingerprint: 'y' }) });
  const r = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl });
  assert.equal(r.ok, false);
});

test('issuePreview: 500 -> {ok:false}; 1 retentativa', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { status: 500, json: async () => ({ error: 'boom' }) }; };
  const r = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(calls, 2);
});

test('issuePreview: erro de rede -> {ok:false}, sem lançar', async () => {
  const fetchImpl = async () => { throw new Error('network'); };
  const r = await issuePreview(FIXTURE_INPUTS, {}, { endpoint: 'https://w/api', fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
});

test('pickCaseSummary / caseSummaryFromRows filtram PII e mapeiam a fixture', () => {
  assert.deepEqual(pickCaseSummary({ necessidade: ' x ', nome: 'F', servicos: ['A', ''] }),
    { necessidade: 'x', servicos: ['A'] });
  const rows = [
    { id: 'HOME', label: 'Necessidade', value: 'Regularizar meu imóvel' },
    { id: 'REG_R1', label: 'Situação', value: 'A área do IPTU e da matrícula não bate' },
    { id: 'REG_C1', label: 'Finalidade', value: 'Quero deixar o imóvel regular' },
    { id: 'REG_C2', label: 'Localização', value: 'Curitiba / PR' },
    { id: 'REG_C3', label: 'Que tipo de imóvel é?', value: 'Casa / sobrado' },
    { id: 'REG_C4', label: 'Documentos disponíveis', value: 'Matrícula · IPTU' },
    { id: 'REG_A1', label: 'Área no IPTU', value: '150 m²' },
    { id: 'REG_A2', label: 'Área na matrícula', value: '0 m²' },
    { id: 'REG_A3', label: 'Motivo da diferença', value: 'Ampliação/construção' },
    { id: null, label: 'Diferença entre as áreas', value: '150 m²' },
  ];
  const cs = caseSummaryFromRows(rows, ['Regularização']);
  assert.equal(cs.necessidade, 'Regularizar meu imóvel');
  assert.equal(cs.situacao, 'A área do IPTU e da matrícula não bate');
  assert.equal(cs.finalidade, 'Quero deixar o imóvel regular');
  assert.equal(cs.localizacao, 'Curitiba / PR');
  assert.equal(cs.tipo_imovel, 'Casa / sobrado');
  assert.equal(cs.documentos, 'Matrícula · IPTU');
  assert.equal(cs.motivo_diferenca, 'Ampliação/construção');
  assert.deepEqual(cs.servicos, ['Regularização']);
  assert.equal(cs.area_iptu, undefined);
  assert.equal(cs.diferenca, undefined);
});

// --- peça PNG --------------------------------------------------------------
test('buildPreviewLayout rejeita registro não confirmado', () => {
  assert.throws(() => buildPreviewLayout(null));
  assert.throws(() => buildPreviewLayout({ preview: {} }));
  assert.throws(() => buildPreviewLayout({ schema: 'PUBLIC_PREVIEW_V1', verification_code: 'x', preview: { schema_version: 'X' } }));
  // formato antigo (canonical/fingerprint) não é mais aceito
  assert.throws(() => buildPreviewLayout({ verification_code: 'x', fingerprint: 'f', canonical: { schema_version: 'PREVIEW_RECORD_V1' } }));
});

test('buildPreviewLayout: valores vêm SÓ do registro; sem PII; sem regra interna; ressalvas presentes', () => {
  const L = buildPreviewLayout(fixtureRecord());
  assert.equal(L.forecast_value, 'R$ 4.699,20');            // = preview.pricing.total_demello
  assert.equal(L.verification_code, 'k3m7q9r2t5w8x4z6');
  assert.equal(L.verify_url, 'https://demelloeng.com.br/verificar/?codigo=k3m7q9r2t5w8x4z6');
  assert.deepEqual(L.services, [{
    name: 'Regularização',                                   // nome legível, não o código
    price: 'R$ 4.699,20',                                    // preço DEMELLO do serviço, vindo do registro
    references: [{ label: 'SECID/PR', total: 'R$ 5.874,00' }],   // referências DAQUELE serviço
  }]);
  assert.equal(L.references, undefined, 'sem lista solta de referências desassociadas do serviço');
  assert.ok(L.criterion.includes('conforme metodologia DEMELLO'), 'critério sem fator/fórmula');
  assert.ok(!/0[.,]80|80%|fator DEMELLO/i.test(L.criterion), 'critério não expõe a regra interna');
  assert.ok(L.disclaimers[0].includes('Não constitui proposta comercial, contrato'));
  assert.ok(L.disclaimers[1].includes('fornecidas pelo usuário'));
  const blob = JSON.stringify(L);
  for (const pii of ['@', 'whatsapp', 'telefone', '"nome"', '"email"', '"contact"']) {
    assert.ok(!blob.toLowerCase().includes(pii.toLowerCase()), `layout não pode conter ${pii}`);
  }
  for (const internal of ['factor_demello', 'fingerprint', 'methodology.rule', '"canonical"']) {
    assert.ok(!blob.includes(internal), `layout não pode conter ${internal}`);
  }
  // a peça usa o valor do registro mesmo que o motor vivo divergisse
  const tampered = fixtureRecord({ pricing: { total_demello: '1.00' } });
  assert.equal(buildPreviewLayout(tampered).forecast_value, 'R$ 1,00');
});

test('QR da peça = URL de verificação com o código', () => {
  const rec = fixtureRecord();
  const L = buildPreviewLayout(rec);
  const expected = encodeQr(verifyUrl(rec.verification_code));
  assert.equal(L.qr.length, expected.length);
  assert.deepEqual(L.qr, expected);
  assert.equal(verifyUrl('abc'), 'https://demelloeng.com.br/verificar/?codigo=abc');
});

test('renderPreviewPng: desenha o valor do registro, sem regra interna, e devolve Blob PNG', async () => {
  const drawn = [];
  const fakeCtx = {
    fillStyle: '', strokeStyle: '', font: '', textBaseline: '', lineWidth: 1,
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    arc() {}, ellipse() {}, drawImage() {}, measureText: (t) => ({ width: String(t).length * 8 }),
    fillText(t) { drawn.push(String(t)); },
  };
  const fakeCanvas = {
    width: 0, height: 0,
    getContext: () => fakeCtx,
    toBlob: (cb) => cb({ __png: true, type: 'image/png' }),
  };
  const blob = await renderPreviewPng(fixtureRecord(), {
    canvasFactory: () => fakeCanvas,
    loadImage: async () => { throw new Error('no image in test'); },
  });
  assert.equal(blob.type, 'image/png');
  assert.equal(fakeCanvas.width, 1080);
  assert.ok(fakeCanvas.height >= 1350, 'altura mínima 1350; cresce quando o conteúdo exige');
  const text = drawn.join('\n');
  assert.equal(drawn.filter((t) => t === 'R$ 4.699,20').length, 2, 'valor do registro: total e preço do serviço');
  assert.ok(text.includes('k3m7q9r2t5w8x4z6'));                  // código
  assert.ok(text.includes('PRÉVIA INICIAL DEMELLO'));
  assert.ok(text.includes('ESTIMATIVA INICIAL DEMELLO'));
  assert.ok(text.includes('SERVIÇOS') && text.includes('Regularização'));
  assert.ok(text.includes('SECID/PR R$ 5.874,00'));              // referência do serviço, na linha do serviço
  assert.ok(text.includes('SEU CASO'));
  assert.ok(text.includes('conforme metodologia DEMELLO'));
  assert.ok(!/0[.,]80|80%|fator DEMELLO/i.test(text), 'PNG não expõe fator/regra interna');
  for (const cell of ['ÁREA IPTU', 'ÁREA MATRÍCULA', 'DIFERENÇA', '150 m²', '0 m²']) {
    assert.ok(text.includes(cell), `célula/medida "${cell}" presente`);
  }
  assert.ok(text.includes('Código:'));
  assert.ok(text.includes('demelloeng.com.br/verificar'));
  assert.ok(/Emitida em 06\/09\/2026 12:34 UTC/.test(text));      // issued_at formatado do registro
  assert.ok(/Não constitui proposta comercial/.test(text));
  assert.ok(!/@|whatsapp/i.test(text));                          // sem PII / e-mail
});

test('renderPreviewPng falha se o registro não é confirmado (sem PNG)', async () => {
  await assert.rejects(() => renderPreviewPng({ preview: {} }, { canvasFactory: () => ({}) }));
});

// --- página /verificar/ ---------------------------------------------------
test('/verificar/index.html: estática, consome PUBLIC_PREVIEW_V1, sem hash-no-browser nem fingerprint nem fator', async () => {
  const html = await readFile(path.join(siteRoot, 'verificar', 'index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/demelloeng\.com\.br\/verificar\/">/);
  assert.match(html, /assets\/css\/servicos-v02\.css/);
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("codigo"\)/);
  assert.match(html, /noindex/);
  // integridade vem do servidor
  assert.match(html, /PUBLIC_PREVIEW_V1/);
  assert.match(html, /integrity/);
  assert.match(html, /res\.status === 409/);
  assert.match(html, /Tabela DEMELLO " \+ m\[1\]/); // versão da tabela GRAVADA no registro (V1 histórico ou V2 corrente)
  assert.doesNotMatch(html, /Tabela DEMELLO V1<\/dd>/); // não fixa mais a versão
  assert.doesNotMatch(html, /altoqi_composta|composta/); // a composição nunca chega à página pública
  assert.match(html, /mercado: "AltoQi \+ SECID\/PR"/);
  // estados
  assert.match(html, /Prévia DEMELLO verificada/);
  assert.match(html, /Código não encontrado/);
  assert.match(html, /Serviço temporariamente indisponível/);
  assert.match(html, /Integridade não confere/);
  // NÃO faz hash no browser, NÃO mostra fingerprint, NÃO mostra fator/fórmula
  assert.doesNotMatch(html, /crypto\.subtle\.digest/);
  assert.doesNotMatch(html, /function canonicalize/);
  assert.doesNotMatch(html, /fingerprint/);
  assert.doesNotMatch(html, /factor_demello|fator 0[.,]80|× fator/i);
  // a página é explícita sobre o que "verificada" NÃO significa
  assert.match(html, /Não significa proposta aceita, contrato, escopo confirmado, conferência documental nem preço atual garantido/);
});

test('GlobalApp: emissão só no ramo X3A/CALCULATED; PNG só do registro confirmado; sem "fator 0,80" público', async () => {
  const src = await readFile(path.join(siteRoot, 'orcamento-src', 'src', 'GlobalApp.jsx'), 'utf8');
  assert.match(src, /import \{issuePreview,caseSummaryFromRows,OUTDATED_MESSAGE\} from '\.\/preview\.mjs'/);
  assert.match(src, /import \{renderPreviewPng\} from '\.\/preview_png\.mjs'/);
  assert.equal((src.match(/issuePreview\(/g) || []).length, 1);
  assert.equal((src.match(/renderPreviewPng\(r\.record\)/g) || []).length, 1);
  assert.equal((src.match(/Gerar prévia DEMELLO/g) || []).length, 1);
  assert.match(src, /const r=await issuePreview\(payload\.pricing_inputs,cs,\{presented:pv\}\);\s*\n\s*if\(!r\.ok\)\{setPState\(r\.outdated\?'outdated':'error'\);return;\}/,
    'sem PNG quando o Worker falha; versão desatualizada pede recarregar');
  assert.match(src, /pState==='outdated'&&[\s\S]*OUTDATED_MESSAGE[\s\S]*window\.location\.reload\(\)/, 'mensagem e ação de recarregar');
  // a regra interna não é publicada no texto da página
  assert.doesNotMatch(src, /fator\s*0[.,]80/i);
  assert.doesNotMatch(src, /menor referência pública aplicável[^.]*fator/i);
  const calcIdx = src.indexOf("if(isPreview&&pv.status==='CALCULATED'){");
  const fallbackIdx = src.indexOf('return <div className={`result-card ${held?', calcIdx);
  assert.ok(calcIdx > 0 && fallbackIdx > calcIdx);
  const calcReturn = src.slice(calcIdx, fallbackIdx);
  const fallbackReturn = src.slice(fallbackIdx);
  assert.ok(calcReturn.includes('onClick={gerarPrevia}') && calcReturn.includes('Gerar prévia DEMELLO'));
  assert.ok(!fallbackReturn.includes('gerarPrevia') && !fallbackReturn.includes('Gerar prévia'),
    'X3B não oferece emissão com valor');
});

// --- capacidade da peça: 2, 7 e 12 serviços (altura dinâmica, sem corte nem sobreposição) -------------------------------
const ALL_SERVICES = ['ESTRUTURAL', 'ELETRICA', 'HIDROSSANITARIO', 'INCENDIO', 'GAS_GLP', 'ARQUITETURA', 'COMPATIBILIZACAO', 'ORCAMENTO',
  'REGULARIZACAO', 'TERRAPLENAGEM', 'CONSULTORIA_TECNICA', 'MENTORIA_TECNICA'];
const NAMES = { ESTRUTURAL: 'Estrutural', ELETRICA: 'Projeto Elétrico', HIDROSSANITARIO: 'Hidrossanitário', INCENDIO: 'Incêndio', GAS_GLP: 'Gás',
  ARQUITETURA: 'Arquitetura', COMPATIBILIZACAO: 'Compatibilização BIM', ORCAMENTO: 'Orçamento e cronograma', REGULARIZACAO: 'Regularização',
  TERRAPLENAGEM: 'Terraplanagem', CONSULTORIA_TECNICA: 'Consultoria técnica', MENTORIA_TECNICA: 'Mentoria técnica' };

function recordWith(n) {
  const codes = ALL_SERVICES.slice(0, n);
  const services = codes.map((code, i) => ({
    service: code, status: 'CALCULATED',
    references: { secid_pr: { total: `${1000 + i}.00` }, altoqi: { total: `${900 + i}.00` }, fundepar: { total: `${800 + i}.00` }, mercado: { total: `${950 + i}.00` } },
    total_demello: `${(640 + i).toFixed(2)}`,
  }));
  const total = services.reduce((acc, s) => acc + Math.round(Number(s.total_demello) * 100), 0) / 100;
  return fixtureRecord({ pricing: { total_demello: total.toFixed(2), services } });
}
const fakeMeasure = { measureText: (t) => ({ width: String(t).length * 8.5 }), font: '' };

for (const n of [1, 2, 7, 12]) {
  test(`peça com ${n} serviço(s): altura dinâmica, módulos em ordem sem sobreposição, nada omitido`, async () => {
    const rec = recordWith(n);
    const L = buildPreviewLayout(rec);
    assert.equal(L.services.length, n, 'nenhum serviço calculado é omitido');
    assert.deepEqual(L.services.map((s) => s.name), ALL_SERVICES.slice(0, n).map((c) => NAMES[c]));
    const plan = planLayout({ ...fakeMeasure }, L);
    // ordem vertical estrita: total < serviços < critério < caso < ressalvas < verificação < fim
    const marks = [146 + 130, plan.servicesTop, plan.servicesBottom, plan.criterionY, plan.caseTop, plan.caseBottom, plan.disclaimerTop,
      plan.disclaimerBottom, plan.verifyTop, plan.verifyBottom, plan.height];
    for (let i = 1; i < marks.length; i += 1) assert.ok(marks[i] > marks[i - 1] || (i === 1 && marks[i] >= marks[i - 1]), `módulo ${i}: ${marks.join(' < ')}`);
    assert.ok(plan.height >= 1350 && plan.verifyBottom <= plan.height - 40);
    const rowsHeight = plan.rows.reduce((acc, r) => acc + r.height, 0);
    assert.equal(plan.servicesBottom - plan.servicesTop - 40, rowsHeight, 'a soma das linhas fecha a altura do bloco');
    // o desenho usa o plano: cada nome, cada preço e cada linha de referência aparecem
    const drawn = [];
    const ctx = { ...fakeMeasure, fillStyle: '', strokeStyle: '', textBaseline: '', lineWidth: 1, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {},
      lineTo() {}, stroke() {}, arc() {}, ellipse() {}, drawImage() {}, fillText(t) { drawn.push(String(t)); } };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb) => cb({ type: 'image/png' }) };
    await renderPreviewPng(rec, { canvasFactory: () => canvas, loadImage: async () => { throw new Error('sem imagem'); } });
    assert.equal(canvas.height, plan.height);
    for (const name of L.services.map((x) => x.name)) assert.ok(drawn.includes(name), `nome ${name}`);
    for (const svc of L.services) assert.ok(drawn.includes(svc.price), `preço de ${svc.name}`);
    assert.ok(drawn.includes(L.forecast_value));
    assert.ok(drawn.some((t) => t.includes('SECID/PR R$ 1000,00') || t.includes('SECID/PR R$ 1.000,00')), 'referências por serviço');
    if (n >= 7) assert.ok(plan.height > 1350, `${n} serviços exigem altura maior que 1350 (${plan.height})`);
  });
}

test('a soma dos preços por serviço da peça fecha com o total do registro', () => {
  for (const n of [2, 7, 12]) {
    const L = buildPreviewLayout(recordWith(n));
    const cents = (t) => Math.round(Number(t.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    const sum = L.services.reduce((acc, s) => acc + cents(s.price), 0);
    assert.equal(sum, cents(L.forecast_value), `${n} serviços`);
  }
});

test('peça sem preço por serviço no registro (legado): linhas sem valor, total e referências preservados', () => {
  const rec = recordWith(2);
  for (const sv of rec.preview.pricing.services) delete sv.total_demello;
  const L = buildPreviewLayout(rec);
  assert.deepEqual(L.services.map((x) => x.price), [null, null]);
  assert.ok(L.forecast_value.startsWith('R$'));
  assert.ok(L.services[0].references.length > 0);
});

test('caso-base R2: Estrutural R$ 4.272,00 + Elétrico R$ 1.248,00 = R$ 5.520,00, cada referência na linha do seu serviço', () => {
  const pv = buildPricingPreview({ services: ['ESTRUTURAL', 'ELETRICA'], typology: 'CASA', structural_system: 'CONCRETO_ARMADO',
    area_new: '250', area_total: '250', area_fundacao: '150' });
  const pub = pv.services.map((s) => ({
    service: s.service, status: 'CALCULATED', total_demello: s.demello.total,
    references: Object.fromEntries(Object.entries(s.references).map(([k, v]) => [({ altoqi_composta: 'mercado', fundepar_001_2025_esportiva: 'fundepar', fundepar_001_2025_administrativa: 'x', fundepar_001_2025_educacional: 'x' }[k] || k), { total: v.total }]).filter(([k]) => k !== 'x')),
  }));
  const L = buildPreviewLayout(fixtureRecord({ pricing: { total_demello: pv.total_demello, services: pub } }));
  assert.equal(L.forecast_value, 'R$ 5.520,00');
  assert.deepEqual(L.services.map((x) => [x.name, x.price]), [['Estrutural', 'R$ 4.272,00'], ['Projeto Elétrico', 'R$ 1.248,00']]);
  // o total do pacote não aparece associado à referência de um único serviço
  for (const svc of L.services) assert.ok(!svc.references.some((r) => r.total === L.forecast_value));
});

test('bloco SEU CASO: sem o campo Serviços (repetido e cortável) e cada campo cabe na sua altura, sem passar da linha divisória', () => {
  for (const n of [2, 12]) {
    const L = buildPreviewLayout(recordWith(n));
    assert.ok(!L.case_rows.some((r) => r.key === 'servicos'));
    const plan = planLayout({ ...fakeMeasure }, L);
    for (const it of plan.caseNarrative) assert.ok(it.height >= 31 + it.lines.length * 22 + 14);
    const total = 48 + plan.caseNarrative.reduce((a, r) => a + r.height, 0) + plan.caseContext.reduce((a, r) => a + r.height, 0) + plan.metricHeight;
    assert.equal(plan.caseBottom - plan.caseTop, total);
  }
});

test('bloco SEU CASO: a área de projeção é métrica, como as outras áreas (mesma faixa e mesmo tamanho)', () => {
  const rec = recordWith(2);
  rec.preview.case_summary = { necessidade: 'Projetar', localizacao: 'Curitiba / PR', area_nova: '250 m²', area_total: '250 m²', area_projecao: '150 m²' };
  const L = buildPreviewLayout(rec);
  const plan = planLayout({ ...fakeMeasure }, L);
  assert.deepEqual(plan.caseMetrics.map((r) => r.key), ['area_nova', 'area_total', 'area_projecao']);
  assert.ok(!plan.caseContext.some((line) => line.pair.some((it) => it.row.key === 'area_projecao')), 'não sobra como campo de texto');
});

test('bloco SEU CASO: campo de contexto sozinho na linha desenha a divisória na largura toda', async () => {
  const rec = recordWith(2);
  rec.preview.case_summary = { necessidade: 'Projetar', localizacao: 'Curitiba / PR', area_nova: '250 m²' };   // 1 campo de contexto (ímpar)
  const lines = [];
  const ctx = { ...fakeMeasure, fillStyle: '', strokeStyle: '', textBaseline: '', lineWidth: 1, fillRect() {}, strokeRect() {}, beginPath() {},
    moveTo(x, y) { this._p = [x, y]; }, lineTo(x, y) { lines.push({ from: this._p, to: [x, y] }); }, stroke() {}, arc() {}, ellipse() {}, drawImage() {}, fillText() {} };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb) => cb({ type: 'image/png' }) };
  await renderPreviewPng(rec, { canvasFactory: () => canvas, loadImage: async () => { throw new Error('sem imagem'); } });
  const plan = planLayout({ ...fakeMeasure }, buildPreviewLayout(rec));
  assert.equal(plan.caseContext[0].pair.length, 1);
  const y = plan.caseTop + 48 + plan.caseNarrative.reduce((a, r) => a + r.height, 0) + plan.caseContext[0].height;
  assert.ok(lines.some((l) => l.from[1] === y && l.to[1] === y && l.from[0] === 48 && l.to[0] === 1032), 'divisória de ponta a ponta');
});

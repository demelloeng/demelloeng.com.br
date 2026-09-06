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

import { issuePreview, pickCaseSummary, caseSummaryFromRows, verifyUrl } from '../src/preview.mjs';
import { buildPreviewLayout, renderPreviewPng } from '../src/preview_png.mjs';
import { encodeQr } from '../src/qr.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- PUBLIC_PREVIEW_V1 de fixture (o que o Worker devolveria p/ 150/0) --------
const FIXTURE_INPUTS = { services: ['REGULARIZACAO'], typology: 'CASA',
  regularizacao: { area_iptu: '150', area_matricula: '0', levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' } };
const FIXTURE_PREVIEW = buildPricingPreview(FIXTURE_INPUTS);

// projeta os serviços do motor para a forma pública {service,status,references{total}}
function publicServices(preview) {
  return preview.services.filter((s) => s.status === 'CALCULATED').map((s) => {
    const references = {};
    if (s.references && s.references.secid_pr) references.secid_pr = { total: s.references.secid_pr.total };
    if (s.references && s.references.altoqi) references.altoqi = { total: s.references.altoqi.total };
    return { service: s.service, status: 'CALCULATED', references };
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
  assert.deepEqual(Object.keys(sent).sort(), ['case_summary', 'pricing_inputs']);
  assert.equal(sent.case_summary.necessidade, 'x');
  for (const k of ['nome', 'email', 'contact']) assert.equal(sent.case_summary[k], undefined);
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
  assert.equal(L.forecast_value, 'R$ 4.249,20');            // = preview.pricing.total_demello
  assert.equal(L.verification_code, 'k3m7q9r2t5w8x4z6');
  assert.equal(L.verify_url, 'https://demelloeng.com.br/verificar/?codigo=k3m7q9r2t5w8x4z6');
  assert.ok(L.references.some((r) => r === 'SECID/PR — Regularização: R$ 5.311,50'),
    'referência com nome de serviço legível (não o código)');
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
  assert.equal(fakeCanvas.height, 1350);
  const text = drawn.join('\n');
  assert.ok(text.includes('R$ 4.249,20'));                       // valor do registro
  assert.ok(text.includes('k3m7q9r2t5w8x4z6'));                  // código
  assert.ok(text.includes('PRÉVIA INICIAL DEMELLO'));
  assert.ok(text.includes('PREVISÃO DEMELLO'));
  assert.ok(text.includes('SEU CASO'));
  assert.ok(text.includes('SECID/PR — Regularização: R$ 5.311,50'));
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
  assert.match(html, /assets\/css\/style\.css/);
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("codigo"\)/);
  assert.match(html, /noindex/);
  // integridade vem do servidor
  assert.match(html, /PUBLIC_PREVIEW_V1/);
  assert.match(html, /integrity/);
  assert.match(html, /res\.status === 409/);
  assert.match(html, /Tabela DEMELLO V1/);
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
  assert.match(src, /import \{issuePreview,caseSummaryFromRows\} from '\.\/preview\.mjs'/);
  assert.match(src, /import \{renderPreviewPng\} from '\.\/preview_png\.mjs'/);
  assert.equal((src.match(/issuePreview\(/g) || []).length, 1);
  assert.equal((src.match(/renderPreviewPng\(r\.record\)/g) || []).length, 1);
  assert.equal((src.match(/Gerar prévia DEMELLO/g) || []).length, 1);
  assert.match(src, /const r=await issuePreview\(payload\.pricing_inputs,cs\);\s*\n\s*if\(!r\.ok\)\{setPState\('error'\);return;\}/,
    'sem PNG quando o Worker falha');
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

// R15 (HANDOFF_OPUS_R4_V03, camada 4 — site): cupom de portador sobre a estimativa do fator ativo.
// Configuração publicada (revisão 1, fator 0,60), sem pino de teste. Sentinelas do handoff sobre R$ 12.509,76:
// 10% -> R$ 11.258,78; R$ 500 -> R$ 12.009,76; 100% -> R$ 0,00.
// Contrato: o Worker confere o cupom; a tela mostra a oferta antes e o REGISTRO depois; PNG, /verificar, resumo e
// pedido usam o registro emitido; código inválido nunca bloqueia a estimativa-base; registro sem cupom não muda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { issuePreview, fetchCoupon, newEmissionKey } from '../src/preview.mjs';
import { buildPreviewLayout, renderPreviewPng } from '../src/preview_png.mjs';
import { buildClientSummary } from '../src/client_summary.mjs';
import { safeOffer, publicFromOffer, commercialLines, leadCommercialOffer, attachCommercialOffer, benefitLabel } from '../src/commercial.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const sobrado = () => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado',
  location: LOC, phase: 'Só uma ideia / estudo', CA5: { value: '2' }, CA6: 'Alto',
  services: ['Arquitetura', 'Estrutural', 'Hidrossanitário', 'Elétrica'], area_fundacao: { value: '160' }, deadline: 'Ainda sem prazo' });
const PAYLOAD = packageForCRMv2(sobrado());
const PV = PAYLOAD.pricing_preview;
const cupom = (kind, value, code = 'DM-TESTE', revision = 1) => ({ schema: 'COUPON_V1', code, kind, value, revision });
const P10 = cupom('PERCENT', '10'), F500 = cupom('FIXED', '500'), P100 = cupom('PERCENT', '100');

// Registro público como o Worker devolve (projeção achatada; revisão do cupom fica interna).
function record(coupon = null, over = {}) {
  const offer = coupon ? safeOffer(PV, coupon) : null;
  return {
    schema: 'PUBLIC_PREVIEW_V1', verification_code: 'k3m7q9r2t5w8x4z6', issued_at: '2026-11-14T12:00:00Z', status: 'ISSUED',
    integrity: { status: 'VERIFIED' },
    preview: {
      schema_version: 'PREVIEW_RECORD_V1', case_summary: { necessidade: 'Construir uma casa' },
      methodology: { table_version: 'DEMELLO_V2' },
      pricing: { status: 'CALCULATED', currency: 'BRL', total_demello: PV.total_demello,
        services: PV.services.map((s) => ({ service: s.service, status: s.status, references: {}, total_demello: s.demello.total })) },
      ...(offer ? { commercial: publicFromOffer(offer) } : {}),
      disclaimers: ['Previsão inicial.'],
      ...over,
    },
  };
}

test('R15 sentinelas: base R$ 12.509,76 (fator 0,60) com 10%, R$ 500 e 100%', () => {
  assert.equal(PV.total_demello, '12509.76');
  assert.deepEqual(safeOffer(PV, P10), { base_total: '12509.76', coupon: { code: 'DM-TESTE', kind: 'PERCENT', value: '10', revision: 1 }, discount: '1250.98', final_total: '11258.78' });
  assert.equal(safeOffer(PV, F500).final_total, '12009.76');
  assert.equal(safeOffer(PV, P100).final_total, '0.00');
  assert.equal(safeOffer(PV, cupom('FIXED', '20000')).final_total, '0.00', 'desconto fixo limitado ao saldo');
  assert.deepEqual(commercialLines(publicFromOffer(safeOffer(PV, P10))),
    { base: 'R$ 12.509,76', code: 'DM-TESTE', benefit: '10%', discount: 'R$ 1.250,98', final: 'R$ 11.258,78' });
  assert.equal(benefitLabel('PERCENT', '12.5'), '12,5%');
  assert.equal(benefitLabel('FIXED', '500'), 'R$ 500,00');
});

test('R15: cupom malformado ou estimativa em avaliação humana nunca lança nem gera oferta', () => {
  assert.equal(safeOffer(PV, cupom('PERCENT', '150')), null);
  assert.equal(safeOffer(PV, cupom('PERCENT', '0')), null);
  assert.equal(safeOffer(PV, cupom('BOGUS', '10')), null);
  assert.equal(safeOffer({ status: 'NEEDS_HUMAN_REVIEW', total_demello: null }, P10), null);
  assert.equal(safeOffer(PV, null), null);
});

test('R15 fetchCoupon: rota GET coupons/{CODIGO normalizado}; 200/404/indisponível/rede/código malformado', async () => {
  const urls = [];
  const ok = await fetchCoupon(' dm-teste ', { endpoint: 'https://w/api/previews/v1', fetchImpl: async (u) => { urls.push(u); return { status: 200, json: async () => P10 }; } });
  assert.deepEqual(urls, ['https://w/api/previews/v1/coupons/DM-TESTE']);
  assert.deepEqual(ok, { ok: true, coupon: P10 });
  assert.deepEqual(await fetchCoupon('DM-X1', { endpoint: 'https://w/', fetchImpl: async () => ({ status: 404, json: async () => ({ error: 'COUPON_INVALID' }) }) }), { ok: false, error: 'not-found' });
  assert.deepEqual(await fetchCoupon('DM-X1', { endpoint: 'https://w/', fetchImpl: async () => ({ status: 503, json: async () => ({}) }) }), { ok: false, error: 'unavailable' });
  assert.deepEqual(await fetchCoupon('DM-X1', { endpoint: 'https://w/', fetchImpl: async () => { throw new TypeError('rede'); } }), { ok: false, error: 'network' });
  let called = false;
  assert.deepEqual(await fetchCoupon('a!', { endpoint: 'https://w/', fetchImpl: async () => { called = true; } }), { ok: false, error: 'invalid-code' });
  assert.equal(called, false, 'código malformado não consulta o Worker');
  assert.deepEqual(await fetchCoupon('DM-X1', { endpoint: '', fetchImpl: null }), { ok: false, error: 'no-endpoint' });
});

test('R15 issuePreview com cupom: código, expectativa {code, revision} + final_total e chave de emissão', async () => {
  let sent = null;
  const r = await issuePreview(PAYLOAD.pricing_inputs, {}, { endpoint: 'https://w/api', presented: PV, couponCode: 'DM-TESTE', coupon: P10,
    fetchImpl: async (u, o) => { sent = JSON.parse(o.body); return { status: 201, json: async () => record(P10) }; } });
  assert.equal(r.ok, true);
  assert.equal(sent.coupon_code, 'DM-TESTE');
  assert.deepEqual(sent.expectation.coupon, { code: 'DM-TESTE', revision: 1 });
  assert.equal(sent.expectation.final_total, '11258.78');
  assert.equal(sent.expectation.total_demello, '12509.76', 'a expectativa-base continua sendo o valor sem desconto');
  assert.match(sent.emission_key, /^[a-z0-9-]{16,64}$/);
  // sem cupom: nenhum campo de cupom
  let plain = null;
  await issuePreview(PAYLOAD.pricing_inputs, {}, { endpoint: 'https://w/api', presented: PV,
    fetchImpl: async (u, o) => { plain = JSON.parse(o.body); return { status: 201, json: async () => record() }; } });
  assert.equal(plain.coupon_code, undefined);
  assert.equal(plain.expectation.coupon, undefined);
  assert.equal(plain.expectation.final_total, undefined);
});

test('R15 idempotência: a retentativa técnica interna repete a MESMA chave; chave informada é respeitada; chaves novas diferem', async () => {
  const keys = [];
  let n = 0;
  const r = await issuePreview(PAYLOAD.pricing_inputs, {}, { endpoint: 'https://w/api', presented: PV, emissionKey: 'clique-0001-abcdefgh',
    fetchImpl: async (u, o) => { keys.push(JSON.parse(o.body).emission_key); n += 1; return n === 1 ? { status: 502, json: async () => ({}) } : { status: 201, json: async () => record() }; } });
  assert.equal(r.ok, true);
  assert.deepEqual(keys, ['clique-0001-abcdefgh', 'clique-0001-abcdefgh']);
  assert.equal(r.emissionKey, 'clique-0001-abcdefgh');
  const a = newEmissionKey(), b = newEmissionKey();
  assert.match(a, /^[a-z0-9]{32}$/);
  assert.notEqual(a, b);
});

test('R15 conflitos do cupom: inválido, revisão e total final — sem retentativa, sem lançar, sem confundir com o fator', async () => {
  for (const [reason, flag] of [['COUPON_INVALID', 'couponInvalid'], ['COUPON_REVISION_MISMATCH', 'couponChanged'], ['FINAL_TOTAL_MISMATCH', 'couponChanged'], ['FACTOR_REVISION_MISMATCH', 'factorChanged']]) {
    let calls = 0;
    const r = await issuePreview(PAYLOAD.pricing_inputs, {}, { endpoint: 'https://w/api', presented: PV, couponCode: 'DM-TESTE', coupon: P10,
      fetchImpl: async () => { calls += 1; return { status: 409, json: async () => ({ error: 'PRICING_VERSION_MISMATCH', reason }) }; } });
    assert.equal(calls, 1, `${reason}: 409 é final`);
    assert.equal(r.ok, false);
    assert.equal(r[flag], true, `${reason} -> ${flag}`);
    for (const other of ['couponInvalid', 'couponChanged', 'factorChanged'].filter((k) => k !== flag)) assert.equal(r[other], false, `${reason}: ${other}`);
  }
});

test('R15 PNG: oferta do REGISTRO no bloco do total; registro sem cupom produz o mesmo layout de antes', async () => {
  const base = buildPreviewLayout(record());
  for (const k of ['commercial', 'commercial_lines']) assert.equal(k in base, false, 'sem chave nova no registro sem cupom');
  assert.equal(base.forecast_label, 'ESTIMATIVA INICIAL DEMELLO');
  assert.equal(base.forecast_value, 'R$ 12.509,76');
  const withC = buildPreviewLayout(record(P10));
  assert.equal(withC.forecast_label, 'ESTIMATIVA INICIAL DEMELLO COM CUPOM');
  assert.equal(withC.forecast_value, 'R$ 11.258,78');
  assert.deepEqual(withC.commercial_lines, ['Valor-base R$ 12.509,76', 'Cupom DM-TESTE', '10%: − R$ 1.250,98']);
  const { commercial, commercial_lines, forecast_label, forecast_value, ...restC } = withC;
  const { forecast_label: fl, forecast_value: fv, ...restB } = base;
  assert.deepEqual(restC, restB, 'só o bloco do total muda');
  // em avaliação humana o bloco comercial não aparece, mesmo que o registro traga um
  const review = buildPreviewLayout(record(P10, { pricing: { status: 'NEEDS_HUMAN_REVIEW', total_demello: null, services: [] } }));
  assert.equal('commercial_lines' in review, false);

  const drawn = [];
  const ctx = { fillStyle: '', strokeStyle: '', font: '', textBaseline: '', lineWidth: 1,
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, ellipse() {}, drawImage() {},
    measureText: (t) => ({ width: String(t).length * 10 }), fillText(t, x) { drawn.push([String(t), x]); } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb) => cb({ type: 'image/png' }) };
  await renderPreviewPng(record(P10), { canvasFactory: () => canvas, loadImage: async () => { throw new Error('sem imagem'); } });
  const texts = drawn.map(([t]) => t);
  for (const t of ['R$ 11.258,78', 'Valor-base R$ 12.509,76', 'Cupom DM-TESTE', '10%: − R$ 1.250,98']) assert.ok(texts.includes(t), t);
  // as linhas do cupom ficam à direita do valor (sem sobreposição)
  const valueX = drawn.find(([t]) => t === 'R$ 11.258,78')[1];
  const valueRight = valueX + 'R$ 11.258,78'.length * 10;
  for (const [t, x] of drawn.filter(([t]) => withC.commercial_lines.includes(t))) assert.ok(x > valueRight, `${t} à direita do total`);
});

test('R15 /verificar: registro com cupom mostra total final, valor-base, cupom e desconto; sem cupom, igual a antes', async () => {
  const html = await readFile(path.join(siteRoot, 'verificar', 'index.html'), 'utf8');
  const logic = html.match(/<script>\n(\(function[\s\S]*?\n\}\)\(\);)\n<\/script>/)[1];
  const VF_CODE = 'k3m7q4r2t5w6x4z6';   // a página só aceita base32 (a-z, 2-7)
  async function show(rec) {
    rec.verification_code = VF_CODE;
    const out = { innerHTML: '' };
    vm.runInNewContext(logic, { document: { getElementById: () => out }, location: { search: `?codigo=${VF_CODE}` }, URLSearchParams, encodeURIComponent,
      fetch: async () => ({ status: 200, ok: true, json: async () => rec }) });
    await new Promise((r) => setTimeout(r, 20));
    return out.innerHTML;
  }
  const withC = await show(record(F500));
  assert.match(withC, /Previsão DEMELLO com cupom/);
  assert.match(withC, /class="vf-total">R\$\s12\.009,76</);
  assert.match(withC, /<dt>Valor-base<\/dt><dd>R\$\s12\.509,76<\/dd>/);
  assert.match(withC, /<dt>Cupom<\/dt><dd>DM-TESTE \(R\$\s500,00\)<\/dd>/);
  assert.match(withC, /<dt>Desconto<\/dt><dd>− R\$\s500,00<\/dd>/);
  const plain = await show(record());
  assert.doesNotMatch(plain, /cupom|Valor-base|Desconto/i);
  assert.match(plain, /Previsão DEMELLO<\/p><p class="vf-total">R\$\s12\.509,76<\/p>/);
  const evil = await show(record(cupom('PERCENT', '10', 'DM-<B>'), {}));
  assert.doesNotMatch(evil, /<B>/, 'código escapado');
});

test('R15 pedido: a oferta só segue amarrada ao registro emitido e ao pricing_preview do próprio pedido', () => {
  const emitted = { record: record(P10), coupon: P10 };
  const lead = attachCommercialOffer(PAYLOAD, emitted);
  assert.deepEqual(lead.commercial_offer, safeOffer(PV, P10), 'forma interna, com revisão, reproduzível pelo intake');
  assert.equal(lead.preview_verification_code, 'k3m7q9r2t5w8x4z6');
  assert.equal(PAYLOAD.commercial_offer, undefined, 'não muta o payload original');
  // sem prévia emitida, sem cupom no registro, cupom trocado ou caso alterado: o pedido volta intacto
  assert.equal(attachCommercialOffer(PAYLOAD, null), PAYLOAD);
  assert.equal(attachCommercialOffer(PAYLOAD, { record: record(), coupon: P10 }), PAYLOAD);
  assert.equal(attachCommercialOffer(PAYLOAD, { record: record(P10), coupon: F500 }), PAYLOAD);
  const changed = packageForCRMv2({ ...sobrado(), CA_AREA: { value: '200' } });
  assert.equal(attachCommercialOffer(changed, emitted), changed);
  assert.equal(leadCommercialOffer(PV, { record: record(P10), coupon: cupom('PERCENT', '10', 'DM-TESTE', 2) }).coupon.revision, 2,
    'a revisão vem do cupom consultado; o Worker já a conferiu na emissão');
});

test('R15 resumo do caso: bloco do cupom só com a oferta do pedido; sem ela, o resumo é o mesmo', () => {
  const plain = buildClientSummary(PAYLOAD);
  assert.doesNotMatch(plain, /cupom|Valor-base/i);
  const withC = buildClientSummary(attachCommercialOffer(PAYLOAD, { record: record(P10), coupon: P10 }));
  assert.match(withC, /ESTIMATIVA INICIAL DEMELLO\nR\$\s12\.509,76\nValor-base: R\$\s12\.509,76\nCupom DM-TESTE \(10%\): − R\$\s1\.250,98\nTotal com cupom \(prévia k3m7q9r2t5w8x4z6\): R\$\s11\.258,78\n/);
  assert.equal(withC.replace(/Valor-base:.*\nCupom .*\nTotal com cupom.*\n/, ''), plain);
});

test('R15 tela: campo de cupom só no ramo calculado; falha do cupom nunca esconde a estimativa nem a prévia sem cupom', async () => {
  const src = await readFile(path.join(siteRoot, 'orcamento-src', 'src', 'GlobalApp.jsx'), 'utf8');
  const calcIdx = src.indexOf("if(isPreview&&pv.status==='CALCULATED'){");
  const fallbackIdx = src.indexOf('return <div className={`result-card ${held?', calcIdx);
  assert.ok(src.slice(calcIdx, fallbackIdx).includes('<CouponBox '));
  assert.ok(!src.slice(fallbackIdx).includes('CouponBox'), 'X3B não oferece cupom');
  assert.equal((src.match(/<CouponBox /g) || []).length, 1);
  assert.match(src, /COUPON_FEEDBACK=\{invalid:COUPON_INVALID_MESSAGE,/);
  assert.match(src, /Remover cupom/);
  // o botão de gerar prévia não depende do estado do cupom
  assert.match(src, /disabled=\{pState==='issuing'\} onClick=\{gerarPrevia\}/);
  // cupom inválido na emissão: limpa o cupom e volta ao estado inicial (prévia-base disponível), sem reemitir
  assert.match(src, /if\(!r\.ok&&r\.couponInvalid\)\{setCupom\(c=>\(\{\.\.\.c,data:null,state:'invalid'\}\)\);setPState\('idle'\);return;\}/);
  // pedido e resumo levam a oferta do registro emitido
  assert.match(src, /const leadPayload=\(\)=>attachCommercialOffer\(packageForCRMv2\(answers\),emitted\.current\);/);
  assert.match(src, /const snapshot=leadPayload\(\);/);
  assert.match(src, /setPRecord\(r\.record\);onEmitted\(\{record:r\.record,coupon\}\);/);
});

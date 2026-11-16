// issuePreview - emite uma PRÉVIA DEMELLO VERIFICÁVEL V1.
//
// POST { pricing_inputs, case_summary } -> Worker ma-demello-preview. O Worker
// RECALCULA o pricing (o preço do browser não é autoridade), monta o
// PREVIEW_RECORD_V1 interno, persiste em D1, confere a integridade no servidor
// e devolve SOMENTE a projeção pública PUBLIC_PREVIEW_V1. O browser nunca recebe
// o canonical interno nem o fingerprint. Só então o PNG é gerado
// (renderPreviewPng recebe SOMENTE este PUBLIC_PREVIEW_V1).
//
// Estrutura espelha submit.mjs: uma retentativa em 5xx/rede, nunca lança para a
// UI, retorna { ok, status, record?, error? }.

import { pricePreview } from './pricing/active_config.mjs';
import { applyCoupon, normalizeCouponCode } from './pricing/coupon.mjs';

const ENV_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PREVIEW_ENDPOINT) || '';
const TIMEOUT_MS = 10000;

// case_summary: SOMENTE estes campos textuais saem do browser. Nada de PII.
const CASE_SUMMARY_KEYS = [
  'necessidade', 'situacao', 'finalidade', 'localizacao',
  'tipo_imovel', 'documentos', 'motivo_diferenca', 'servicos',
];

export function pickCaseSummary(source = {}) {
  const out = {};
  for (const k of CASE_SUMMARY_KEYS) {
    const v = source[k];
    if (k === 'servicos') {
      const arr = (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean);
      if (arr.length) out.servicos = arr;
    } else if (typeof v === 'string' && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

// Converte as linhas de journey.summary() nos 8 campos textuais do case_summary.
// Quantidades (área IPTU/matrícula/diferença/nova/…) NÃO são enviadas: o Worker
// as deriva dos pricing_inputs normalizados.
const _norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const _LABEL_MAP = [
  [/^necessidade/, 'necessidade'],
  [/situacao|^situacao|o que precisa avaliar/, 'situacao'],
  [/finalidade|objetivo/, 'finalidade'],
  [/localiza/, 'localizacao'],
  [/documento/, 'documentos'],
  [/motivo da diferenca|^motivo/, 'motivo_diferenca'],
];
export function caseSummaryFromRows(rows = [], serviceNames = []) {
  const out = {};
  for (const row of rows) {
    if (!row || row.value === undefined || row.value === null || row.value === '') continue;
    const l = _norm(row.label || '');
    if (!out.tipo_imovel &&
        (l === 'imovel' || l === 'empreendimento' || l.includes('tipo de imovel') || l.includes('tipo de empreendimento'))) {
      out.tipo_imovel = String(row.value);
      continue;
    }
    for (const [re, key] of _LABEL_MAP) {
      if (!out[key] && re.test(l)) { out[key] = String(row.value); break; }
    }
  }
  const servicos = [...new Set((serviceNames || []).map((s) => String(s).trim()).filter(Boolean))];
  if (servicos.length) out.servicos = servicos;
  return out;
}

async function postOnce(endpoint, body, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let payload = null;
    try { payload = await res.json(); } catch { payload = null; }
    return { status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

// Expectativa do navegador (R2): o que foi APRESENTADO ao cliente — regime, total e valor DEMELLO por serviço. Não é
// autoridade de preço: o Worker recalcula e só emite com concordância integral (senão 409 PRICING_VERSION_MISMATCH).
export function expectationFromPreview(pv) {
  if (!pv || pv.status !== 'CALCULATED' || typeof pv.total_demello !== 'string') return null;
  return {
    table_version: pv.table_version,
    pricing_rule: pv.pricing_rule,
    // R4: revisão da configuração com que o valor apresentado foi calculado (o Worker confere).
    ...(Number.isInteger(pv.factor_config_revision) ? { factor_config_revision: pv.factor_config_revision } : {}),
    total_demello: pv.total_demello,
    services: pv.services.filter((s) => s.status === 'CALCULATED').map((s) => ({ service: s.service, total_demello: s.demello.total })),
  };
}

export const OUTDATED_ERROR = 'PRICING_VERSION_MISMATCH';
export const OUTDATED_MESSAGE = 'A calculadora foi atualizada. Recarregue a página e confira sua estimativa antes de gerar a prévia.';
export const FACTOR_CHANGED_REASON = 'FACTOR_REVISION_MISMATCH';
export const FACTOR_CHANGED_MESSAGE = 'A estimativa foi atualizada. Confira o novo valor acima antes de gerar a prévia.';
export const COUPON_CHANGED_REASON = 'COUPON_REVISION_MISMATCH';
export const COUPON_CHANGED_MESSAGE = 'O cupom foi alterado. Verifique se ainda é válido antes de gerar a prévia.';
export const COUPON_INVALID_REASON = 'COUPON_INVALID';
export const COUPON_INVALID_MESSAGE = 'Cupom inválido ou expirado. Remova-o ou use outro código.';
export const FINAL_TOTAL_REASON = 'FINAL_TOTAL_MISMATCH';
export const PREVIEW_ENDPOINT = ENV_ENDPOINT;

// R15: chave de emissão (Worker: ^[a-z0-9-]{16,64}$). Uma por emissão nova; a mesma nas retentativas técnicas.
export function newEmissionKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  let key = '';
  for (let i = 0; i < 32; i++) key += chars[bytes[i] % chars.length];
  return key;
}

// R15: consulta cupom pelo código. Retorna { ok, coupon?, error? }.
export async function fetchCoupon(code, opts = {}) {
  const endpoint = opts.endpoint || ENV_ENDPOINT;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!endpoint || !fetchImpl) return { ok: false, error: 'no-endpoint' };
  let normalized;
  try { normalized = normalizeCouponCode(code); } catch { return { ok: false, error: 'invalid-code' }; }
  const url = `${endpoint.replace(/\/?$/, '/')}coupons/${encodeURIComponent(normalized)}`;
  try {
    const res = await fetchImpl(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.status === 200) {
      const data = await res.json();
      if (data.schema === 'COUPON_V1') return { ok: true, coupon: data };
    }
    if (res.status === 404) return { ok: false, error: 'not-found' };
    return { ok: false, error: 'unavailable' };
  } catch { return { ok: false, error: 'network' }; }
}

// opts: { endpoint, fetchImpl, presented, couponCode, coupon, emissionKey }.
// coupon: dados do cupom validado (schema COUPON_V1) para calcular a expectativa comercial.
// emissionKey: chave única por clique; gere com newEmissionKey() e reutilize nas retentativas.
export async function issuePreview(pricingInputs, caseSummary = {}, opts = {}) {
  const endpoint = opts.endpoint || ENV_ENDPOINT;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!endpoint || !fetchImpl) return { ok: false, status: 0, error: 'no-endpoint' };

  const body = { pricing_inputs: pricingInputs, case_summary: pickCaseSummary(caseSummary) };
  let presented = opts.presented;
  if (!presented) { try { presented = pricePreview(pricingInputs); } catch { presented = null; } }
  const expectation = expectationFromPreview(presented);
  if (expectation) body.expectation = expectation;

  // R15: cupom (código e expectativa comercial). O Worker revalida; se divergir, 409 COUPON_*.
  if (opts.couponCode && opts.coupon && expectation) {
    body.coupon_code = opts.couponCode;
    let offer = null;
    try { offer = applyCoupon(presented, opts.coupon); } catch { offer = null; }
    if (offer) {
      expectation.coupon = { code: offer.coupon.code, revision: offer.coupon.revision };
      expectation.final_total = offer.final_total;
    }
  }

  // R15: chave de emissão idempotente. O mesmo clique gera uma chave; retentativas reutilizam.
  const emissionKey = opts.emissionKey || newEmissionKey();
  body.emission_key = emissionKey;

  let attempt = { status: 0, payload: null, error: 'unsent' };
  for (let i = 0; i < 2; i += 1) {
    try {
      attempt = await postOnce(endpoint, body, fetchImpl);
    } catch (err) {
      attempt = { status: 0, payload: null, error: (err && err.name) || String(err) };
    }
    if (attempt.status >= 200 && attempt.status < 500) break; // 2xx/4xx finais
  }

  const p = attempt.payload || {};
  if (attempt.status === 201 && p.schema === 'PUBLIC_PREVIEW_V1' && p.verification_code && p.preview) {
    return { ok: true, status: 201, record: p, emissionKey };
  }
  const outdated = attempt.status === 409 && p.error === OUTDATED_ERROR;
  // R4: a configuração comercial mudou depois do cálculo. Nada é reemitido sozinho: o chamador busca a nova
  // configuração, a tela recalcula e o visitante confere o novo valor antes de gerar a prévia de novo.
  const factorChanged = outdated && p.reason === FACTOR_CHANGED_REASON;
  // R15: cupom inválido ou revisão mudou. Nunca reemite automaticamente: o visitante remove ou troca o código.
  const couponChanged = outdated && (p.reason === COUPON_CHANGED_REASON || p.reason === FINAL_TOTAL_REASON);
  const couponInvalid = outdated && p.reason === COUPON_INVALID_REASON;
  return { ok: false, status: attempt.status || 0, error: p.error || attempt.error || 'issue-failed', outdated, factorChanged, couponChanged, couponInvalid, emissionKey };
}

// A demonstração local (vite --mode demo) aponta a verificação para o próprio computador; o padrão é o site.
export const VERIFY_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VERIFY_BASE) || 'https://demelloeng.com.br/verificar/';
export const verifyUrl = (code) => `${VERIFY_BASE}?codigo=${encodeURIComponent(code)}`;
// R05: endereço exibido (texto da página e do PNG) derivado do MESMO destino do QR, nunca um host fixo divergente.
export const VERIFY_DISPLAY = VERIFY_BASE.replace(/^https?:\/\//, '').replace(/\/+$/, '');

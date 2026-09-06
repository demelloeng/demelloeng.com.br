// issuePreview - emite uma PRÉVIA DEMELLO VERIFICÁVEL V1.
//
// POST { pricing_inputs, case_summary } -> Worker ma-demello-preview. O Worker
// RECALCULA o pricing (o preço do browser não é autoridade), monta o
// PREVIEW_RECORD_V1, persiste em D1 e devolve o registro confirmado. Só então o
// PNG é gerado (renderPreviewPng recebe SOMENTE este registro).
//
// Estrutura espelha submit.mjs: uma retentativa em 5xx/rede, nunca lança para a
// UI, retorna { ok, status, record?, error? }.

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

// opts é só para teste: { endpoint, fetchImpl }.
export async function issuePreview(pricingInputs, caseSummary = {}, opts = {}) {
  const endpoint = opts.endpoint || ENV_ENDPOINT;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!endpoint || !fetchImpl) return { ok: false, status: 0, error: 'no-endpoint' };

  const body = { pricing_inputs: pricingInputs, case_summary: pickCaseSummary(caseSummary) };

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
  if (attempt.status === 201 && p.verification_code && p.fingerprint && p.canonical) {
    return { ok: true, status: 201, record: p };
  }
  return { ok: false, status: attempt.status || 0, error: p.error || attempt.error || 'issue-failed' };
}

export const VERIFY_BASE = 'https://demelloeng.com.br/verificar/';
export const verifyUrl = (code) => `${VERIFY_BASE}?codigo=${encodeURIComponent(code)}`;

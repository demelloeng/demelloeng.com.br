// submitToCRM - the ONLY network call in the experience.
//
// Sends the CAPTURE-FIRST transport envelope to the Cloudflare Worker endpoint:
//   { "payload": <PAYLOAD V2 VERBATIM>, "transport": { "hp": "<honeypot>", "meta"?: { fbp, fbc, url } | { optout: true } } }
//
// The PAYLOAD V2 (packageForCRMv2 output) is passed through untouched. The
// honeypot lives ONLY in transport.hp - never in answers / pricing_inputs /
// the payload / its hash. One automatic retry on a network error or 5xx.
// Never throws to the UI: callers get { ok, status, submission_id?, state?, error? }.
//
// Endpoint contract + Python mirror:
//   engineering repo -> schemas/crm/site-intake/transport.v1.json
//                       scripts/site_intake_http_ingest.py

const ENV_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_INTAKE_ENDPOINT) || '';
const TIMEOUT_MS = 8000;

// Dados do anúncio para a API de Conversões da Meta (o Worker os usa no servidor; nunca entram no payload nem no hash).
// Só o que a Meta precisa para ligar o pedido ao clique: cookies _fbp/_fbc (ou fbclid da URL) e a página.
// Nada de nome, contato ou resposta. Com Do Not Track / Global Privacy Control, só avisa "optout".
export function collectMeta(env = (typeof window !== 'undefined' ? window : null)) {
  try {
    if (!env) return {};
    const nav = env.navigator || {};
    if (nav.doNotTrack === '1' || env.doNotTrack === '1' || nav.globalPrivacyControl === true) return { optout: true };
    const doc = env.document;
    const loc = env.location;
    const cookie = (n) => {
      const m = ((doc && doc.cookie) || '').match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    };
    const out = {};
    const fbp = cookie('_fbp');
    let fbc = cookie('_fbc');
    if (!fbc && loc && loc.search) {
      const click = /[?&]fbclid=([A-Za-z0-9_-]{1,300})/.exec(loc.search);
      if (click) fbc = `fb.1.${Date.now()}.${click[1]}`;
    }
    if (fbp) out.fbp = fbp;
    if (fbc) out.fbc = fbc;
    if (loc && loc.origin && loc.pathname) out.url = loc.origin + loc.pathname;
    return out;
  } catch {
    return {};
  }
}

async function postOnce(endpoint, envelope, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// opts is test-only: { endpoint, fetchImpl }. Production uses VITE_INTAKE_ENDPOINT
// and the global fetch.
export async function submitToCRM(payloadV2, hp = '', opts = {}) {
  const endpoint = opts.endpoint || ENV_ENDPOINT;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!endpoint || !fetchImpl) return { ok: false, status: 0, error: 'no-endpoint' };

  const meta = opts.meta !== undefined ? opts.meta : collectMeta();
  const transport = { hp: hp || '' };
  if (meta && Object.keys(meta).length) transport.meta = meta;
  const envelope = { payload: payloadV2, transport };

  let attempt = { status: 0, body: null, error: 'unsent' };
  for (let i = 0; i < 2; i += 1) {
    try {
      attempt = await postOnce(endpoint, envelope, fetchImpl);
    } catch (err) {
      attempt = { status: 0, body: null, error: (err && err.name) || String(err) };
    }
    // 2xx and 4xx are final; only a network failure (0) or 5xx is retried once.
    if (attempt.status >= 200 && attempt.status < 500) break;
  }

  const body = attempt.body || {};
  if (attempt.status === 202 && body.accepted) {
    return {
      ok: true,
      status: 202,
      submission_id: body.submission_id,
      state: body.state,
    };
  }
  return {
    ok: false,
    status: attempt.status || 0,
    error: body.error || attempt.error || 'send-failed',
  };
}

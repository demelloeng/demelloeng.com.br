// submitToCRM - the ONLY network call in the experience.
//
// Sends the CAPTURE-FIRST transport envelope to the Cloudflare Worker endpoint:
//   { "payload": <PAYLOAD V2 VERBATIM>, "transport": { "hp": "<honeypot>" } }
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

  const envelope = { payload: payloadV2, transport: { hp: hp || '' } };

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

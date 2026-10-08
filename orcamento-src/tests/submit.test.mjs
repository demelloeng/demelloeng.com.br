import assert from 'node:assert/strict';
import test from 'node:test';
import { submitToCRM, collectMeta } from '../src/submit.mjs';

const ENDPOINT = 'https://example.invalid/api/site-intake';
const PAYLOAD = { schema: 'site-intake/payload/2', source: 'DEMELLO_SITE', prototype: false, sent_to_crm: false, route: 'build' };

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

function recordingFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return handler(calls.length, calls[calls.length - 1]);
  };
  impl.calls = calls;
  return impl;
}

test('202 accepted -> { ok, submission_id, state }', async () => {
  const fetchImpl = recordingFetch(() =>
    jsonResponse(202, { accepted: true, submission_id: 'SITE-SUB-abcdef012345', state: 'PENDING_PERSIST' }));
  const r = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.submission_id, 'SITE-SUB-abcdef012345');
  assert.equal(r.state, 'PENDING_PERSIST');
  assert.equal(fetchImpl.calls.length, 1);
});

test('envelope carries payload verbatim + honeypot in transport.hp only', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(202, { accepted: true, submission_id: 'x', state: 'PENDING_PERSIST' }));
  await submitToCRM(PAYLOAD, 'i-am-a-bot', { endpoint: ENDPOINT, fetchImpl });
  const sent = fetchImpl.calls[0].body;
  assert.deepEqual(sent.payload, PAYLOAD);
  assert.equal(sent.transport.hp, 'i-am-a-bot');
  assert.equal('hp' in sent.payload, false);
});

test('500 then 202 -> one retry, ok', async () => {
  const fetchImpl = recordingFetch((n) =>
    n === 1 ? jsonResponse(500, { error: 'INTERNAL' })
            : jsonResponse(202, { accepted: true, submission_id: 'SITE-SUB-retry0000000', state: 'PENDING_PERSIST' }));
  const r = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(fetchImpl.calls.length, 2);
});

test('network error -> graceful { ok: false }, never throws', async () => {
  const fetchImpl = async () => { throw new Error('network down'); };
  const r = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
});

test('422 -> { ok: false, error } and no retry', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(422, { accepted: false, error: 'INVALID_TRANSPORT' }));
  const r = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'INVALID_TRANSPORT');
  assert.equal(fetchImpl.calls.length, 1);
});

test('same payload -> same submission_id (endpoint is idempotent)', async () => {
  const fetchImpl = recordingFetch(() =>
    jsonResponse(202, { accepted: true, submission_id: 'SITE-SUB-deadbeef1234', state: 'PENDING_PERSIST' }));
  const a = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  const b = await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl });
  assert.equal(a.submission_id, b.submission_id);
});

test('no endpoint configured -> { ok: false, error: no-endpoint }', async () => {
  const r = await submitToCRM(PAYLOAD, '', { endpoint: '', fetchImpl: async () => jsonResponse(202, {}) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'no-endpoint');
});

test('meta de anúncio: vai só em transport.meta, nunca no payload; sem meta, o envelope não ganha chave', async () => {
  const fetchImpl = recordingFetch(() => jsonResponse(202, { accepted: true, submission_id: 'x', state: 'PENDING_PERSIST' }));
  const meta = { fbp: 'fb.1.1791445316963.1234567890', url: 'https://demelloeng.com.br/orcamento/' };
  await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl, meta });
  assert.deepEqual(fetchImpl.calls[0].body.transport.meta, meta);
  assert.deepEqual(fetchImpl.calls[0].body.payload, PAYLOAD);
  const f2 = recordingFetch(() => jsonResponse(202, { accepted: true, submission_id: 'x', state: 'PENDING_PERSIST' }));
  await submitToCRM(PAYLOAD, '', { endpoint: ENDPOINT, fetchImpl: f2, meta: {} });
  assert.equal('meta' in f2.calls[0].body.transport, false);
});

test('collectMeta: lê _fbp/_fbc, monta fbc do fbclid, respeita DNT/GPC e não lê mais nada', () => {
  const base = { navigator: {}, document: { cookie: 'a=1; _fbp=fb.1.1791445316963.1234567890; b=2' }, location: { origin: 'https://demelloeng.com.br', pathname: '/orcamento/', search: '?fbclid=IwAR0abc' } };
  const m = collectMeta(base);
  assert.equal(m.fbp, 'fb.1.1791445316963.1234567890');
  assert.match(m.fbc, /^fb\.1\.\d{13}\.IwAR0abc$/);
  assert.equal(m.url, 'https://demelloeng.com.br/orcamento/');
  assert.deepEqual(Object.keys(m).sort(), ['fbc', 'fbp', 'url']);
  assert.deepEqual(collectMeta({ ...base, navigator: { doNotTrack: '1' } }), { optout: true });
  assert.deepEqual(collectMeta({ ...base, navigator: { globalPrivacyControl: true } }), { optout: true });
  assert.deepEqual(collectMeta(null), {});
  assert.deepEqual(collectMeta({ navigator: {}, document: { cookie: '' }, location: { origin: 'https://demelloeng.com.br', pathname: '/x/', search: '' } }), { url: 'https://demelloeng.com.br/x/' });
});

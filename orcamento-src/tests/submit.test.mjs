import assert from 'node:assert/strict';
import test from 'node:test';
import { submitToCRM } from '../src/submit.mjs';

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

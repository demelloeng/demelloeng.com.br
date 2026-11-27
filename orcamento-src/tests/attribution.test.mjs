import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { forwardAcquisition, readAcquisition, withAcquisition } from '../../assets/js/acquisition.mjs';
import { createTracker, originOf, subscribe } from '../../assets/js/analytics.mjs';
import { submitToCRM } from '../src/submit.mjs';
import { createTracking } from '../src/tracking.mjs';

for (const viaService of [false, true]) {
  test(`ChatGPT retains URL and submits a normalized source (${viaService ? 'service' : 'direct'})`, async () => {
    const link = { href: 'https://demelloeng.com.br/orcamento/?situacao=known#inicio' };
    if (viaService) forwardAcquisition({
      URL: 'https://demelloeng.com.br/servicos/projeto-estrutural/?utm_source=chatgpt.com',
      querySelectorAll: () => [link],
    });
    else link.href = 'https://demelloeng.com.br/orcamento/?situacao=known&utm_source=chatgpt.com#inicio';

    const target = new URL(link.href);
    assert.equal(target.searchParams.get('utm_source'), 'chatgpt.com');
    assert.equal(target.searchParams.get('situacao'), 'known');
    assert.equal(target.hash, '#inicio');
    const acquisition = readAcquisition(target.search);
    assert.equal(acquisition.source, 'chatgpt.com');
    let sent;
    const response = await submitToCRM(withAcquisition({ schema: 'site-intake/payload/2' }, acquisition), '', {
      endpoint: 'https://crm.invalid/capture',
      fetchImpl: async (url, opts) => {
        assert.equal(url, 'https://crm.invalid/capture');
        sent = JSON.parse(opts.body);
        return new Response(JSON.stringify({ accepted: true, submission_id: 'SITE-SUB-123456abcdef' }), { status: 202 });
      },
    });
    assert.equal(response.ok, true);
    assert.deepEqual(sent.payload.acquisition, { source: 'chatgpt' });
  });
}

test('source aliases are exact and limited to the source field', () => {
  const sources = {
    'perplexity': 'perplexity', 'perplexity.ai': 'perplexity', 'copilot.microsoft.com': 'copilot',
    'gemini.google.com': 'gemini', 'claude.ai': 'claude', 'linkedin': 'linkedin',
  };
  for (const [source, expected] of Object.entries(sources)) {
    const acquisition = readAcquisition(`?utm_source=${source}&utm_medium=chatgpt.com`);
    assert.deepEqual(acquisition, { source });
    assert.deepEqual(withAcquisition({}, acquisition), { acquisition: { source: expected } });
  }
  for (const value of ['ChatGPT.com', 'chatgpt.com.evil.invalid', 'chatgpt+com', 'chatgpt%2Bcom', '', 'constructor.invalid']) {
    assert.equal(readAcquisition(`?utm_source=${value}`), undefined);
  }
  assert.deepEqual(readAcquisition('?utm_source=&utm_medium=social'), { medium: 'social' });
  const payload = { schema: 'site-intake/payload/2' };
  assert.equal(withAcquisition(payload, readAcquisition('')), payload);
});

test('external AI referrers contribute only a closed provider code', () => {
  const home = 'https://demelloeng.com.br';
  for (const domain of ['chatgpt.com', 'chat.openai.com']) {
    assert.deepEqual(originOf(`https://${domain}/c/private?token=x`, home), { origin: 'external', ai_source: 'chatgpt' });
  }
  assert.deepEqual(originOf('https://chatgpt.com.evil.invalid/path', home), { origin: 'external' });
  assert.deepEqual(originOf(`${home}/servicos/?private=1`, home), { origin: 'internal', origin_page: '/servicos/' });
  assert.deepEqual(originOf('', home), { origin: 'direct' });
});

test('X4, failed sends and preview clicks carry only the closed funnel contract', () => {
  const tracker = createTracker();
  const tracking = createTracking({ track: tracker.track });
  const events = [];
  tracker.subscribe(event => events.push(event));
  const answers = { route: 'known', request_intent: 'scope_question', scope_question: 'private', contact: { name: 'private' } };
  tracking.contactReached(answers);
  tracking.contactReached(answers);
  tracking.submissionFailed(answers, { ok: false, status: 0, error: 'private' }, 1);
  tracking.submissionFailed(answers, { ok: false, status: 503, error: 'private' }, 2);
  tracking.submissionFailed(answers, { ok: true, status: 202 }, 3);
  tracking.previewDownload(answers);
  tracking.previewDownload(answers);
  assert.deepEqual(events.map(event => event.name), [
    'estimate_contact_reached', 'estimate_submission_failed', 'estimate_submission_failed',
    'estimate_preview_download_clicked', 'estimate_preview_download_clicked',
  ]);
  assert.deepEqual(events.slice(1, 3).map(event => event.params.failure_kind), ['network', 'server']);
  assert.ok(events.every(event => !JSON.stringify(event).includes('private')));
});

test('Meta keeps Contact and identifies each channel by event name', async () => {
  const source = await readFile(new URL('../../assets/js/meta-pixel.js', import.meta.url), 'utf8');
  let listener;
  const calls = [];
  vm.runInNewContext(source, { window: {
    fbq: (...args) => calls.push(args), addEventListener: (_, fn) => { listener = fn; },
  }, document: {} });
  for (const channel of ['whatsapp', 'phone', 'email']) {
    listener({ detail: { name: `${channel}_contact_started`, params: { route: 'known', channel: 'spoof', contact: 'private' } } });
  }
  assert.equal(JSON.stringify(calls.slice(2)), JSON.stringify(['whatsapp', 'phone', 'email'].map(channel =>
    ['track', 'Contact', { route: 'known', channel }])));
});

test('legacy bridge redirects to the fixed canonical service with query and fragment', async () => {
  const html = await readFile(new URL('../../servicos/projeto-terraplenagem/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>(.*?)<\/script>/s)[1];
  const target = [];
  const current = 'https://demelloeng.com.br/servicos/projeto-terraplenagem/?utm_source=chatgpt.com&next=https%3A%2F%2Fother.invalid%2F#caixa';
  vm.runInNewContext(script, { location: { ...new URL(current), search: new URL(current).search,
    hash: '#caixa', replace: value => target.push(new URL(value, current).href) } });
  assert.deepEqual(target, [current.replace('terraplenagem', 'terraplanagem')]);
  assert.match(html, /<noscript><meta http-equiv="refresh"/);
});

test('static estimate CTA measures activation and ignores sibling routes and non-primary activation', async () => {
  const listeners = new Map();
  const href = 'https://demelloeng.com.br/servicos/?utm_source=chatgpt.com';
  Object.defineProperties(globalThis, {
    location: { configurable: true, value: new URL(href) },
    document: { configurable: true, value: {
      URL: href, baseURI: href, referrer: '', querySelectorAll: () => [],
      addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    } },
  });
  const events = [];
  const stop = subscribe(event => events.push(event));
  try {
    await import('../../assets/js/site-analytics.mjs');
    const click = (type, button, dest) => listeners.get(type).forEach(listener => listener({
      type, button, target: { closest: () => ({ href: dest, getAttribute: () => dest }) },
    }));
    click('click', 0, '/orcamento/?situacao=known');
    click('auxclick', 1, '/orcamento/');
    click('auxclick', 2, '/orcamento/');
    click('click', 0, '/orcamento/assets/');
    click('click', 0, 'https://external.invalid/orcamento/');
    assert.deepEqual(events.filter(event => event.name === 'estimate_link_clicked').map(event => event.params), [
      { page: '/servicos/' }, { page: '/servicos/' },
    ]);
  } finally {
    stop();
    delete globalThis.location;
    delete globalThis.document;
  }
});

test('Simple Analytics relays only safe funnel parameters and respects DNT/GPC', async () => {
  const source = await readFile(new URL('../../assets/js/analytics-sink.js', import.meta.url), 'utf8');
  for (const nav of [{}, { doNotTrack: '1' }, { globalPrivacyControl: true }]) {
    const loaded = [];
    const listeners = new Map();
    const win = { navigator: nav, addEventListener: (name, fn) => listeners.set(name, fn) };
    vm.runInNewContext(source, { window: win, document: {
      createElement: () => ({}), head: { appendChild: element => loaded.push(element) },
    } });
    const event = { detail: { name: 'estimate_submission_failed', params: { step: 'X4', failure_kind: 'server', email: 'private' } } };
    listeners.get('demello:analytics')?.(event);
    if (Object.keys(nav).length) {
      assert.equal(loaded.length, 0);
      assert.equal(win.sa_event, undefined);
    } else {
      assert.equal(loaded.length, 1);
      assert.equal(JSON.stringify(win.sa_event.q), JSON.stringify([['estimate_submission_failed', { step: 'X4', failure_kind: 'server' }]]));
    }
  }
});

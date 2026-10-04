// Camada de mensuração do funil: adaptador neutro, contrato fechado, privacidade, deduplicação e emissores.
// Nenhum fornecedor externo: os testes usam "sinks" em memória.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTracker, EVENTS, PARAMS, SCHEMA, normalizePath, originOf, trackPageView, subscribe as subscribeSite } from '../../assets/js/analytics.mjs';
import { createTracking, serviceParams, fingerprint } from '../src/tracking.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const LOC = { city: 'Curitiba', uf: 'PR' };

// Dados que NUNCA podem aparecer em um evento.
const PII = ['maria.silva@example.com', '41999990000', '(41) 98512-4056', 'Maria da Silva', 'Rua das Flores, 123', 'IMG_2031.jpg', 'foto-rachadura.png',
  'A rachadura aumentou de repente e está cedendo', '123.456.789-09', 'https://example.com/?email=a@b.com'];
const fresh = () => {
  const tracker = createTracker({ emitter: 'site' });
  const seen = [];
  tracker.subscribe((e) => seen.push(e));
  return { tracker, seen };
};

test('contrato: os nove eventos mínimos existem; pós-venda é previsto, mas não emitido pelo site', () => {
  for (const name of ['page_view', 'estimate_started', 'situation_selected', 'estimate_completed', 'proposal_requested', 'scope_question_requested', 'qualified_lead', 'proposal_sent', 'contract_won']) {
    assert.ok(Object.hasOwn(EVENTS, name), name);
  }
  assert.deepEqual(EVENTS.proposal_sent.emitters, ['crm']);
  assert.deepEqual(EVENTS.contract_won.emitters, ['crm']);
  assert.equal(EVENTS.proposal_sent.planned, true);
  assert.equal(EVENTS.contract_won.planned, true);
  assert.ok(Object.isFrozen(EVENTS));
  // todo parâmetro declarado em algum evento tem validador fechado
  for (const def of Object.values(EVENTS)) for (const p of def.params) assert.equal(typeof PARAMS[p], 'function', p);
});

test('emissor: o navegador NÃO consegue emitir proposal_sent nem contract_won (o site não conhece esses resultados)', () => {
  const { tracker, seen } = fresh();
  for (const name of ['proposal_sent', 'contract_won']) {
    assert.deepEqual(tracker.track(name, { route: 'build', service: 'estrutural' }), { ok: false, reason: 'not_allowed_emitter' });
  }
  assert.equal(seen.length, 0);
  // o back-office/CRM, com emissor 'crm', pode (contrato previsto)
  const crm = createTracker({ emitter: 'crm' });
  assert.equal(crm.track('proposal_sent', { route: 'build', service: 'estrutural' }).ok, true);
  assert.equal(crm.track('contract_won', { route: 'build', service: 'estrutural' }).ok, true);
});

test('evento desconhecido, nome malicioso ou tipo errado: descartado sem lançar erro', () => {
  const { tracker, seen } = fresh();
  for (const name of ['pageview', 'PAGE_VIEW', '__proto__', 'constructor', 'toString', '', null, undefined, 42, {}, ['page_view']]) {
    assert.equal(tracker.track(name, {}).ok, false, String(name));
  }
  assert.equal(seen.length, 0);
});

test('privacidade: parâmetros fora do contrato são descartados', () => {
  const { tracker, seen } = fresh();
  const r = tracker.track('situation_selected', {
    route: 'build', entry: 'manual', step: 'CA1',
    email: PII[0], phone: PII[1], name: PII[3], address: PII[4], photo: PII[5], story: PII[7], url: PII[9], contact: { name: PII[3] },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(seen[0].params).sort(), ['entry', 'route', 'step']);
  assert.deepEqual(r.dropped.sort(), ['address', 'contact', 'email', 'name', 'phone', 'photo', 'story', 'url']);
});

test('privacidade: dado pessoal dentro de parâmetro PERMITIDO também é barrado (validadores fechados)', () => {
  const { tracker, seen } = fresh();
  const allowed = Object.entries(EVENTS).flatMap(([name, def]) => def.params.map((p) => [name, p]));
  assert.ok(allowed.length > 20);
  for (const [name, param] of allowed) {
    const t = createTracker({ emitter: EVENTS[name].emitters[0] });
    const out = [];
    t.subscribe((e) => out.push(e));
    for (const value of PII) t.track(name, { [param]: value });
    for (const e of out) assert.equal(Object.hasOwn(e.params, param), false, `${name}.${param} aceitou texto livre`);
    assert.equal(JSON.stringify(out).includes('@'), false);
  }
  // inteiros fora de faixa / tipos errados
  for (const bad of [-1, 12, 1.5, '3', null, NaN, Infinity]) assert.equal(PARAMS.service_count(bad), false, String(bad));
  assert.equal(seen.length, 0);
});

test('privacidade: o evento entregue ao destino não contém nenhum dado pessoal (varredura exaustiva por evento)', () => {
  const out = [];
  for (const [name, def] of Object.entries(EVENTS)) {
    const t = createTracker({ emitter: def.emitters[0] });
    t.subscribe((e) => out.push(e));
    const params = Object.fromEntries(def.params.map((p) => [p, PII.join(' | ')]));
    t.track(name, params);
  }
  const blob = JSON.stringify(out);
  for (const secret of PII) assert.equal(blob.includes(secret), false, secret);
});

test('deduplicação: o mesmo evento não dispara duas vezes (re-render, StrictMode, Voltar/Avançar)', () => {
  const { tracker, seen } = fresh();
  assert.equal(tracker.track('estimate_started', { route: 'build', entry: 'manual' }).ok, true);
  for (let i = 0; i < 5; i += 1) assert.deepEqual(tracker.track('estimate_started', { route: 'build', entry: 'manual' }), { ok: false, reason: 'duplicate', dropped: [] });
  assert.equal(seen.length, 1);
  // ordem das chaves não cria "outro" evento
  tracker.track('situation_selected', { route: 'known', entry: 'manual' });
  assert.equal(tracker.track('situation_selected', { entry: 'manual', route: 'known' }).reason, 'duplicate');
  // parâmetros diferentes = evento diferente
  assert.equal(tracker.track('situation_selected', { route: 'build', entry: 'manual' }).ok, true);
  // dedupeKey explícita
  assert.equal(tracker.track('estimate_completed', { route: 'build' }, { dedupeKey: 'a' }).ok, true);
  assert.equal(tracker.track('estimate_completed', { route: 'build' }, { dedupeKey: 'a' }).reason, 'duplicate');
  assert.equal(tracker.track('estimate_completed', { route: 'build' }, { dedupeKey: 'b' }).ok, true);
});

test('destinos: erro em um destino não derruba os outros; replay entrega o que já ocorreu; desligar para tudo', () => {
  const t = createTracker({ emitter: 'site' });
  const a = [];
  t.subscribe(() => { throw new Error('boom'); });
  t.subscribe((e) => a.push(e.name));
  t.track('page_view', { page: '/' });
  assert.deepEqual(a, ['page_view']);
  const late = [];
  t.subscribe((e) => late.push(e.name), { replay: true });
  assert.deepEqual(late, ['page_view']);
  t.setEnabled(false);
  assert.equal(t.track('page_view', { page: '/servicos/' }).reason, 'disabled');
  assert.equal(a.length, 1);
  assert.equal(t.subscribe('não é função')(), undefined);
});

test('o evento tem formato estável e imutável', () => {
  const { tracker, seen } = fresh();
  tracker.track('page_view', { page: '/servicos/', origin: 'direct' });
  assert.deepEqual(seen[0], { schema: SCHEMA, name: 'page_view', emitter: 'site', params: { origin: 'direct', page: '/servicos/' } });
  assert.ok(Object.isFrozen(seen[0]) && Object.isFrozen(seen[0].params));
});

test('page_view: caminho normalizado, sem query nem fragmento; origem sem revelar domínio externo', () => {
  assert.equal(normalizePath('/index.html'), '/');
  assert.equal(normalizePath('/servicos/projeto-estrutural/index.html?email=a@b.com#x'), '/servicos/projeto-estrutural/');
  assert.equal(normalizePath('/orcamento'), '/orcamento/');
  assert.equal(normalizePath('/empresa/trajetoria-do-fundador.html'), '/empresa/trajetoria-do-fundador.html');
  assert.equal(normalizePath('/Maria Silva/'), null, 'fora do padrão => não envia');
  assert.equal(normalizePath('/a/b/c/d/e/'), null);
  assert.equal(normalizePath(undefined), null);
  assert.deepEqual(originOf('', 'https://demelloeng.com.br'), { origin: 'direct' });
  assert.deepEqual(originOf('https://www.google.com/search?q=maria+silva', 'https://demelloeng.com.br'), { origin: 'external' });
  assert.deepEqual(originOf('https://demelloeng.com.br/construir-ou-ampliar/?x=1#y', 'https://demelloeng.com.br'), { origin: 'internal', origin_page: '/construir-ou-ampliar/' });
  assert.deepEqual(originOf('lixo', 'https://demelloeng.com.br'), { origin: 'direct' });

  const got = [];
  subscribeSite((e) => got.push(e));
  const win = { location: { pathname: '/construir-ou-ampliar/index.html', origin: 'https://demelloeng.com.br', search: '?nome=Maria' } };
  const doc = { referrer: 'https://demelloeng.com.br/?utm=1' };
  assert.equal(trackPageView(win, doc).ok, true);
  assert.equal(trackPageView(win, doc).reason, 'duplicate', 'mesma página, mesma carga => um page_view');
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].params, { origin: 'internal', origin_page: '/', page: '/construir-ou-ampliar/' });
  assert.equal(JSON.stringify(got).includes('Maria'), false);
});

// ---------------------------------------------------------------------------------------------------------------------
// Ponte da jornada (src/tracking.mjs)
// ---------------------------------------------------------------------------------------------------------------------
const calculable = () => ({
  route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, property: 'Casa/sobrado', location: LOC,
  phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: ['Estrutural'], deadline: 'Ainda sem prazo',
});
const withPII = (a) => ({
  ...a,
  contact: { name: 'Maria da Silva', whatsapp: '41999990000', email: 'maria.silva@example.com' },
  photos: [{ name: 'foto-rachadura.png', size: 1234, type: 'image/png', url: 'blob:https://demelloeng.com.br/abc' }],
  otherService: 'Rua das Flores, 123',
});
function bridge() {
  const t = createTracker({ emitter: 'site' });
  const seen = [];
  t.subscribe((e) => seen.push(e));
  return { seen, tracking: createTracking({ track: t.track, pageView: () => t.track('page_view', { page: '/orcamento/', origin: 'direct' }) }) };
}

test('jornada: estimate_started e situation_selected disparam uma vez, mesmo com efeito executado em duplicidade', () => {
  const { seen, tracking } = bridge();
  for (let i = 0; i < 3; i += 1) tracking.situation({ route: 'build', entry: 'deeplink', step: 'CA1' });
  assert.deepEqual(seen.map((e) => e.name), ['estimate_started', 'situation_selected']);
  assert.deepEqual(seen[1].params, { entry: 'deeplink', route: 'build', step: 'CA1' });
  // outra situação escolhida depois: nova situation_selected; estimate_started continua sendo único
  tracking.situation({ route: 'known', entry: 'manual', step: 'S1' });
  assert.deepEqual(seen.map((e) => e.name), ['estimate_started', 'situation_selected', 'situation_selected']);
  // deep link por disciplina leva a disciplina (valor controlado)
  tracking.situation({ route: 'known', entry: 'deeplink', service: 'estrutural', step: 'S1' });
  assert.equal(seen.at(-1).params.service, 'estrutural');
});

test('jornada: estimate_completed só com estimativa calculada, uma vez por resultado; sem dado pessoal, foto ou texto', () => {
  const { seen, tracking } = bridge();
  const a = withPII(calculable());
  tracking.result(a, 'X3A');
  tracking.result(a, 'X3A');
  tracking.result({ ...a }, 'X3A');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, 'estimate_completed');
  assert.deepEqual(seen[0].params, { result_status: 'calculated', route: 'build', service: 'estrutural', service_count: 1, step: 'X3A' });
  // mudar uma resposta gera um novo resultado (nova estimativa), mas a mesma tela re-renderizada não
  tracking.result({ ...a, CA_AREA: { value: '150' } }, 'X3A');
  assert.equal(seen.length, 2);
  // contato e fotos não alteram a identidade do resultado
  tracking.result({ ...a, contact: { name: 'Outra Pessoa', whatsapp: '', email: 'x@y.invalid' }, photos: [] }, 'X3A');
  assert.equal(seen.length, 2);
  const blob = JSON.stringify(seen);
  for (const secret of ['Maria', 'maria.silva', '41999990000', 'foto-rachadura', 'Rua das Flores', 'blob:']) assert.equal(blob.includes(secret), false, secret);
});

test('jornada: caso sem estimativa vira framing_delivered; sinal de risco vira safety_hold, nunca estimate_completed', () => {
  const { seen, tracking } = bridge();
  const base = { route: 'problem', P1: 'Apareceu algo no imóvel e quero entender o que é', property: 'Casa/sobrado', location: LOC, P5: 'Entender o que está acontecendo' };
  tracking.result({ ...base, P2: 'Apareceu uma rachadura depois da reforma.' }, 'X3A');
  tracking.result({ ...base, P2: 'A rachadura aumentou de repente e a parede está cedendo' }, 'X3B');
  assert.deepEqual(seen.map((e) => [e.name, e.params.result_status]), [['framing_delivered', 'needs_review'], ['framing_delivered', 'safety_hold']]);
  assert.equal(seen.some((e) => e.name === 'estimate_completed'), false);
  const blob = JSON.stringify(seen);
  assert.equal(blob.includes('rachadura'), false, 'o relato não vai ao analytics');
  assert.equal(blob.includes('Curitiba'), false);
});

test('jornada: pedidos só existem após o envio aceito; um por envio; qualificado só com a regra R1', () => {
  const { seen, tracking } = bridge();
  const proposal = { ...calculable(), request_intent: 'proposal' };
  const ok = { ok: true, status: 202, submission_id: 'sub_1' };

  assert.deepEqual(tracking.submissionAccepted({ answers: proposal, sendResult: { ok: false, status: 500 }, contactValid: true }), [], 'falha de envio não gera evento');
  assert.deepEqual(tracking.submissionAccepted({ answers: proposal, sendResult: null, contactValid: true }), []);
  assert.equal(seen.length, 0);

  tracking.submissionAccepted({ answers: proposal, sendResult: ok, contactValid: true });
  assert.deepEqual(seen.map((e) => e.name), ['proposal_requested', 'qualified_lead']);
  assert.deepEqual(seen[0].params, { request_intent: 'proposal', route: 'build', service: 'estrutural', service_count: 1, step: 'X4' });
  assert.deepEqual(seen[1].params, { route: 'build', rule: 'R1', service: 'estrutural', service_count: 1 });
  // nova tentativa com o MESMO id idempotente do Worker não duplica
  tracking.submissionAccepted({ answers: proposal, sendResult: ok, contactValid: true });
  assert.equal(seen.length, 2);

  // dúvida sobre escopo: pedido, mas não qualificado
  const before = seen.length;
  tracking.submissionAccepted({ answers: { ...calculable(), request_intent: 'scope_question' }, sendResult: { ok: true, status: 202, submission_id: 'sub_2' }, contactValid: true });
  assert.deepEqual(seen.slice(before).map((e) => e.name), ['scope_question_requested']);

  // caso só para avaliação
  const b2 = seen.length;
  tracking.submissionAccepted({
    answers: { route: 'problem', P1: 'x', P2: 'Apareceu uma rachadura', property: 'Casa/sobrado', location: LOC, P5: 'y', request_intent: 'evaluation_only' },
    sendResult: { ok: true, status: 202, submission_id: 'sub_3' }, contactValid: true,
  });
  assert.deepEqual(seen.slice(b2).map((e) => e.name), ['evaluation_requested']);

  // sem intenção => nada; contato inválido => pedido sim, qualificado não
  const b3 = seen.length;
  tracking.submissionAccepted({ answers: calculable(), sendResult: { ok: true, status: 202, submission_id: 'sub_4' }, contactValid: true });
  assert.equal(seen.length, b3);
  tracking.submissionAccepted({ answers: proposal, sendResult: { ok: true, status: 202, submission_id: 'sub_5' }, contactValid: false });
  assert.deepEqual(seen.slice(b3).map((e) => e.name), ['proposal_requested']);
});

test('jornada: nenhum evento emitido contém dado pessoal, mesmo com respostas e contato cheios de PII', () => {
  const { seen, tracking } = bridge();
  const a = { ...withPII(calculable()), request_intent: 'proposal', P2: PII[7] };
  tracking.pageView();
  tracking.situation({ route: a.route, entry: 'manual', step: 'CA1' });
  tracking.result(a, 'X3A');
  tracking.submissionAccepted({ answers: a, sendResult: { ok: true, status: 202, submission_id: 'sub_9' }, contactValid: true });
  assert.ok(seen.length >= 5);
  const blob = JSON.stringify(seen);
  for (const secret of [...PII, 'Maria', 'Silva', 'Curitiba', '120', 'blob:']) assert.equal(blob.includes(secret), false, secret);
  for (const e of seen) for (const [k, v] of Object.entries(e.params)) assert.equal(typeof PARAMS[k], 'function', `${e.name}.${k}`);
});

test('serviceParams: 0 -> none, 1 -> código, 2+ -> multiple (só códigos controlados)', () => {
  assert.deepEqual(serviceParams({ route: 'problem' }), { service: 'none', service_count: 0 });
  assert.deepEqual(serviceParams(calculable()), { service: 'estrutural', service_count: 1 });
  assert.deepEqual(serviceParams({ ...calculable(), services: ['Estrutural', 'Gás', 'Incêndio'] }), { service: 'multiple', service_count: 3 });
  assert.deepEqual(serviceParams({ ...calculable(), services: ['Hidrossanitário', 'Drenagem'] }), { service: 'hidrossanitario', service_count: 1 }, 'drenagem entra em hidrossanitário');
  assert.equal(fingerprint({ b: 1, a: 2 }), fingerprint({ a: 2, b: 1 }), 'impressão digital independe da ordem das chaves');
});

// ---------------------------------------------------------------------------------------------------------------------
// Garantias estáticas
// ---------------------------------------------------------------------------------------------------------------------
test('sem fornecedor externo nem identificador de conta no adaptador, na ponte, nas páginas e no bundle', async () => {
  // Código nosso (sem minificação): nomes de ferramentas. Bundle e páginas: domínios, globais e IDs de conta
  // (evita falso positivo com identificadores minificados como ga( ou createSvgTag).
  const VENDOR = /gtag|dataLayer|googletagmanager|google-analytics|\bG-[A-Z0-9]{6,}|\bGTM-[A-Z0-9]+|\bUA-\d{4,}|fbq\(|connect\.facebook\.net|fbevents|clarity\.ms|hotjar|mixpanel|segment\.com|plausible|matomo|posthog|amplitude/i;
  const VENDOR_STRICT = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|connect\.facebook\.net|clarity\.ms|hotjar\.com|mixpanel\.com|segment\.(?:com|io)|plausible\.io|posthog\.com|window\.(?:gtag|dataLayer|fbq|_hsq|ga)\b|\bGTM-[A-Z0-9]{5,}\b|\bG-[A-Z0-9]{8,}\b|\bUA-\d{4,}-\d+\b|\bAW-\d{6,}\b/;
  const files = [
    path.join(siteRoot, 'assets/js/analytics.mjs'),
    path.join(siteRoot, 'assets/js/site-analytics.mjs'),
    path.join(appRoot, 'src/tracking.mjs'),
    path.join(appRoot, 'src/funnel.mjs'),
    path.join(appRoot, 'src/GlobalApp.jsx'),
  ];
  const bundle = (await readdir(path.join(siteRoot, 'orcamento/assets'))).filter((n) => /^index-.*\.js$/.test(n));
  assert.equal(bundle.length, 1, 'um único bundle');
  files.push(path.join(siteRoot, 'orcamento/assets', bundle[0]));
  for (const f of files) {
    const minified = /index-.*\.js$/.test(f);
    const raw = await readFile(f, 'utf8');
    const text = minified ? raw : raw.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(text, minified ? VENDOR_STRICT : VENDOR, path.basename(f));
  }
  // nenhuma página carrega script de terceiros de mensuração
  const html = await readFile(path.join(siteRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(html, VENDOR_STRICT);
  assert.match(html, /<script type="module" src="\.\/assets\/js\/site-analytics\.mjs"><\/script>/);
});

test('o adaptador não usa cookie, storage, fetch, beacon nem rede', async () => {
  const text = (await readFile(path.join(siteRoot, 'assets/js/analytics.mjs'), 'utf8')).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(text, /document\.cookie|localStorage|sessionStorage|indexedDB|\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|new Image\(/);
});

test('a interface só usa a ponte controlada (nenhuma chamada direta ao adaptador com dados da jornada)', async () => {
  const app = await readFile(path.join(appRoot, 'src/GlobalApp.jsx'), 'utf8');
  assert.doesNotMatch(app, /analytics\.mjs/, 'a UI não importa o adaptador diretamente');
  assert.doesNotMatch(app, /\btrack\(/, 'nenhuma chamada track(...) com parâmetros montados na UI');
  const calls = [...app.matchAll(/tracking\.(\w+)\(/g)].map((m) => m[1]).sort();
  assert.deepEqual(calls, ['pageView', 'result', 'situation', 'submissionAccepted']);
});

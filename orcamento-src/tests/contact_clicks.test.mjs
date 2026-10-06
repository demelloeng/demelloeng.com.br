// Cliques em contato direto (WhatsApp, telefone, e-mail): todo link é coberto, o evento entra no mesmo barramento do funil,
// não leva dado pessoal e não se confunde com lead qualificado nem com pedido de proposta.
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTracker, EVENTS, PARAMS } from '../../assets/js/analytics.mjs';
import { buildEvent, channelOf, handleClick, installContactClicks, placementOf, CHANNELS } from '../../assets/js/contact-clicks.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const read = (p) => readFile(path.join(siteRoot, p), 'utf8');
const exists = (p) => access(path.join(siteRoot, p)).then(() => true, () => false);

const CONTACT_EVENTS = ['whatsapp_contact_started', 'phone_contact_started', 'email_contact_started'];

// ---- mini-DOM: só o suficiente para `closest` (classe, [atributo], a[href]) ------------------------------------------------
const VOID = new Set(['meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'path', 'circle', 'rect', 'use', 'track', 'area', 'base', 'col', 'embed', 'param', 'wbr']);
function parseHtml(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const root = { tag: '#root', attrs: {}, parent: null, children: [] };
  let cur = root;
  const links = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const [, close, tagRaw, rawAttrs, selfClose] = m;
    const tag = tagRaw.toLowerCase();
    if (close) {
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g)) attrs[a[1].toLowerCase()] = a[2] ?? '';
    const node = { tag, attrs, parent: cur, children: [], closest: null };
    node.closest = (sel) => closest(node, sel);
    cur.children.push(node);
    if (tag === 'a' && attrs.href !== undefined) links.push(node);
    if (!VOID.has(tag) && !selfClose) cur = node;
  }
  return { root, links };
}
function matches(node, simple) {
  simple = simple.trim();
  let m;
  if ((m = simple.match(/^\.([\w-]+)$/))) return (node.attrs.class || '').split(/\s+/).includes(m[1]);
  if ((m = simple.match(/^\[([\w-]+)\]$/))) return Object.hasOwn(node.attrs, m[1]);
  if ((m = simple.match(/^([a-z]+)\[([\w-]+)\]$/))) return node.tag === m[1] && Object.hasOwn(node.attrs, m[2]);
  throw new Error(`seletor não suportado no mini-DOM: ${simple}`);
}
function closest(node, selector) {
  const alts = selector.split(',');
  for (let n = node; n && n.tag !== '#root'; n = n.parent) if (alts.some((s) => matches(n, s))) return n;
  return null;
}
// `getAttribute` para os nós do mini-DOM (usado por buildEvent/placementOf)
const wrap = (n) => Object.assign(n, { getAttribute: (k) => (Object.hasOwn(n.attrs, k) ? n.attrs[k] : null) });
function nodesOf(html) {
  const { root, links } = parseHtml(html);
  const all = [];
  (function walk(n) { wrap(n); all.push(n); n.children.forEach(walk); })(root);
  return links;
}

async function staticPages() {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(path.join(siteRoot, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) {
        if (['orcamento-src', 'node_modules', 'docs', 'orcamento', '.github', '.git', 'assets'].includes(e.name)) continue;
        await walk(rel);
      } else if (e.name.endsWith('.html') && !e.name.startsWith('_')) out.push(rel.replace(/^\.\//, ''));
    }
  }
  await walk('.');
  return out;
}
const pathnameOf = (file) => (file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`);

test('contrato: três eventos de contato direto, só do navegador, parâmetros fechados, fase "contato_direto"', () => {
  for (const name of CONTACT_EVENTS) {
    assert.ok(Object.hasOwn(EVENTS, name), name);
    assert.deepEqual(EVENTS[name].emitters, ['site']);
    assert.deepEqual(EVENTS[name].params, ['page', 'placement', 'route', 'service']);
    assert.equal(EVENTS[name].stage, 'contato_direto');
    assert.ok(!EVENTS[name].planned);
  }
  assert.deepEqual(CHANNELS.map((c) => c.event), CONTACT_EVENTS);
  // não se confunde com lead qualificado nem com pedido de proposta
  for (const other of ['qualified_lead', 'proposal_requested', 'scope_question_requested', 'evaluation_requested']) assert.ok(!CONTACT_EVENTS.includes(other));
  assert.ok(EVENTS.qualified_lead.params.includes('rule') && !EVENTS.qualified_lead.params.includes('placement'), 'qualified_lead segue só pela regra R1; não depende de posição de botão');
});

test('privacidade: "placement" é lista fechada; número, e-mail, texto ou endereço não passam', () => {
  for (const ok of ['topbar', 'menu', 'cta_band', 'contact_page', 'footer', 'body']) assert.equal(PARAMS.placement(ok), true, ok);
  for (const bad of ['5541985124056', '+55 41 98512-4056', 'marcos@demelloeng.com.br', 'https://wa.me/5541985124056', 'Olá, quero um orçamento', 'TOPBAR', '', null, 7, {}]) {
    assert.equal(PARAMS.placement(bad), false, String(bad));
  }
  const t = createTracker({ emitter: 'site' });
  const r = t.track('whatsapp_contact_started', { placement: 'topbar', page: '/', phone: '5541985124056', email: 'a@b.co', text: 'Oi', href: 'https://wa.me/5541985124056', route: 'ninguem' });
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.event.params }, { page: '/', placement: 'topbar' }, 'só o que está no contrato; valor fora da lista (route) é descartado');
  assert.ok(r.dropped.includes('phone') && r.dropped.includes('email') && r.dropped.includes('text') && r.dropped.includes('href') && r.dropped.includes('route'));
});

test('canais: wa.me, tel: e mailto: são contato direto; redes sociais e links internos não são', () => {
  assert.equal(channelOf('https://wa.me/5541985124056'), 'whatsapp_contact_started');
  assert.equal(channelOf('tel:+5541985124056'), 'phone_contact_started');
  assert.equal(channelOf('mailto:marcos@demelloeng.com.br'), 'email_contact_started');
  for (const no of ['https://www.instagram.com/demelloeng/', 'https://www.linkedin.com/company/demello-engenharia/', './orcamento/', '../contato/', '#duvidas', '', null, undefined, 'https://example.com/wa.me/1']) {
    assert.equal(channelOf(no), null, String(no));
  }
});

test('cobertura: TODO link de WhatsApp, telefone e e-mail de TODA página estática vira evento válido, com posição conhecida', async () => {
  let total = 0;
  const porCanal = { whatsapp_contact_started: 0, phone_contact_started: 0, email_contact_started: 0 };
  const porPosicao = {};
  for (const file of await staticPages()) {
    const win = { location: { pathname: pathnameOf(file) } };
    const links = nodesOf(await read(file));
    const tracker = createTracker({ emitter: 'site' });
    for (const a of links) {
      const href = a.attrs.href;
      const channel = channelOf(href);
      if (!channel) continue;
      total += 1; porCanal[channel] += 1;
      const built = buildEvent(a, win);
      assert.ok(built, `${file}: ${href}`);
      assert.equal(built.event, channel);
      const r = tracker.track(built.event, built.params, { dedupeKey: `${total}` });
      assert.equal(r.ok, true, `${file}: evento aceito pelo contrato`);
      assert.deepEqual(r.dropped, [], `${file}: nenhum parâmetro descartado (todos dentro do contrato)`);
      porPosicao[built.params.placement] = (porPosicao[built.params.placement] ?? 0) + 1;
    }
  }
  assert.ok(total >= 90, `esperado muitos links de contato; achei ${total}`);
  for (const [c, n] of Object.entries(porCanal)) assert.ok(n > 0, c);
  for (const pos of ['topbar', 'menu', 'footer', 'cta_band', 'contact_page']) assert.ok(porPosicao[pos] > 0, `posição ${pos} existe no site`);
  assert.deepEqual(Object.keys(porPosicao).filter((p) => !PARAMS.placement(p)), []);
});

test('posição e contexto: cada clique carrega página, posição e (quando a página define) rota e serviço', async () => {
  const win = (p) => ({ location: { pathname: p } });
  const find = async (file, pred) => nodesOf(await read(file)).filter((a) => channelOf(a.attrs.href) && pred(a));
  // serviço
  const [wa] = await find('servicos/projeto-estrutural/index.html', (a) => a.closest('.topbar'));
  assert.deepEqual(buildEvent(wa, win('/servicos/projeto-estrutural/')), { event: 'whatsapp_contact_started', params: { placement: 'topbar', route: 'known', service: 'estrutural', page: '/servicos/projeto-estrutural/' } });
  const [reg] = await find('servicos/regularizacao/index.html', (a) => a.closest('.topbar'));
  assert.deepEqual(buildEvent(reg, win('/servicos/regularizacao/')).params, { placement: 'topbar', route: 'regularize', service: 'regularizacao', page: '/servicos/regularizacao/' });
  // intenção
  const [bld] = await find('construir-ou-ampliar/index.html', (a) => a.closest('.topbar'));
  assert.deepEqual(buildEvent(bld, win('/construir-ou-ampliar/')).params, { placement: 'topbar', route: 'build', page: '/construir-ou-ampliar/' });
  // faixa de chamada final, menu do celular, rodapé, página de contato
  const cta = await find('metodologia/index.html', (a) => a.closest('.cta-band'));
  assert.ok(cta.some((a) => channelOf(a.attrs.href) === 'whatsapp_contact_started' && buildEvent(a, win('/metodologia/')).params.placement === 'cta_band'));
  const menu = await find('index.html', (a) => a.closest('.nav') && !a.closest('.topbar'));
  assert.ok(menu.length >= 1 && menu.every((a) => buildEvent(a, win('/')).params.placement === 'menu'));
  const foot = await find('index.html', (a) => a.closest('.site-footer'));
  assert.ok(foot.some((a) => channelOf(a.attrs.href) === 'phone_contact_started') && foot.some((a) => channelOf(a.attrs.href) === 'email_contact_started'));
  assert.ok(foot.every((a) => buildEvent(a, win('/')).params.placement === 'footer'));
  const contato = await find('contato/index.html', (a) => !a.closest('.topbar') && !a.closest('.nav') && !a.closest('.site-footer'));
  assert.ok(contato.length >= 4 && contato.every((a) => buildEvent(a, win('/contato/')).params.placement === 'contact_page'));
  // atributo explícito ganha do contêiner
  assert.equal(placementOf({ closest: (s) => (s === '[data-contact-placement]' ? { getAttribute: () => 'body' } : null) }, '/'), 'body');
});

test('privacidade: o evento entregue não contém número, e-mail, link, nome nem texto (varredura de TODOS os links do site)', async () => {
  const sensitive = /5541985124056|5544998202552|98512|99820|@|wa\.me|mailto|tel:|https?:|marcos|demelloeng\.com\.br/i;
  for (const file of await staticPages()) {
    const win = { location: { pathname: pathnameOf(file) } };
    for (const a of nodesOf(await read(file))) {
      const built = buildEvent(a, win);
      if (!built) continue;
      const blob = JSON.stringify(built);
      assert.doesNotMatch(blob.replace(/"page":"[^"]*"/, ''), sensitive, `${file}: ${blob}`);
      assert.deepEqual(Object.keys(built.params).filter((k) => !EVENTS[built.event].params.includes(k)), [], `${file}: só parâmetros do contrato`);
    }
  }
});

test('barramento: o clique usa o mesmo adaptador (assinantes recebem o evento), uma vez por posição, sem lead qualificado', () => {
  const tracker = createTracker({ emitter: 'site' });
  const seen = [];
  tracker.subscribe((e) => seen.push(e));
  const link = wrap({ tag: 'a', attrs: { href: 'https://wa.me/5541985124056' }, parent: null, children: [], closest: null });
  const topbar = wrap({ tag: 'div', attrs: { class: 'topbar' }, parent: null, children: [], closest: null });
  link.parent = topbar; link.closest = (s) => closest(link, s); topbar.closest = (s) => closest(topbar, s);
  const win = { location: { pathname: '/servicos/projeto-gas-glp/' } };
  const ev = { target: link };
  const r1 = handleClick(ev, win, tracker.track);
  const r2 = handleClick(ev, win, tracker.track);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false); assert.equal(r2.reason, 'duplicate', 'mesmo botão na mesma visita conta uma vez');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].schema, 'demello-analytics/1');
  assert.equal(seen[0].name, 'whatsapp_contact_started');
  assert.deepEqual({ ...seen[0].params }, { page: '/servicos/projeto-gas-glp/', placement: 'topbar', route: 'known', service: 'gas_glp' });
  assert.ok(!seen.some((e) => e.name === 'qualified_lead' || e.name === 'proposal_requested'));
  // clique fora de link de contato: nada
  assert.equal(handleClick({ target: wrap({ tag: 'div', attrs: {}, parent: null, children: [], closest: () => null }) }, win, tracker.track), null);
});

test('robustez: erro na medição nunca atrapalha o clique; nenhum preventDefault; auxclick só com o botão do meio', () => {
  const link = wrap({ tag: 'a', attrs: { href: 'tel:+5541985124056' }, parent: null, children: [], closest: null });
  link.closest = (s) => closest(link, s);
  let prevented = false;
  const ev = { target: link, preventDefault: () => { prevented = true; } };
  assert.doesNotThrow(() => handleClick(ev, { location: { pathname: '/' } }, () => { throw new Error('falha'); }));
  assert.equal(handleClick(ev, { location: { pathname: '/' } }, () => { throw new Error('falha'); }), null);
  assert.equal(prevented, false);
  // install
  const listeners = [];
  const doc = { addEventListener: (t, fn, cap) => listeners.push([t, fn, cap]) };
  assert.equal(installContactClicks({ location: { pathname: '/' } }, doc), true);
  assert.deepEqual(listeners.map(([t, , c]) => [t, c]), [['click', true], ['auxclick', true]], 'captura em click e auxclick');
  assert.equal(installContactClicks(null, null), false);
});

test('o módulo não usa cookie, armazenamento, rede nem nome de fornecedor; é carregado pelas páginas estáticas e está na allowlist', async () => {
  const src = await read('assets/js/contact-clicks.mjs');
  assert.doesNotMatch(src, /document\.cookie|localStorage|sessionStorage|indexedDB|fetch\(|sendBeacon|XMLHttpRequest|simpleanalytics|gtag|dataLayer|fbq/i);
  assert.doesNotMatch(src, /\.href\b[^;]*\bparams|getAttribute\('href'\)[^;]*params/, 'o href não entra no evento');
  assert.match(await read('assets/js/site-analytics.mjs'), /import \{ installContactClicks \} from '\.\/contact-clicks\.mjs';[\s\S]*installContactClicks\(\);/);
  const allow = (await read('.github/pages/allowlist.txt')).split(/\r?\n/).map((l) => l.split('#')[0].trim()).filter(Boolean);
  assert.ok(allow.includes('assets/js/contact-clicks.mjs'));
  assert.ok(await exists('assets/js/contact-clicks.mjs'));
  const build = await read('.github/pages/build_artifact.py');
  assert.match(build, /"assets\/js\/contact-clicks\.mjs"/);
});

test('documentação e política: a medição de contato direto está descrita; hierarquia de conversões registrada', async () => {
  const doc = await read('docs/MENSURACAO_FUNIL.md');
  for (const name of CONTACT_EVENTS) assert.ok(doc.includes(name), name);
  assert.match(doc, /não é lead qualificado|não se confunde com lead qualificado/i);
  assert.match(doc, /conversão intermediária|conversões intermediárias/i);
  const policy = (await read('privacidade/index.html')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(policy, /cliques nos botões de WhatsApp, telefone e e-mail/);
  assert.match(policy, /nunca o seu número, o seu e-mail ou o que você escrever/);
});

// Visual V2 + base legal + destino de mensuração: a política descreve só o que o site de fato carrega;
// o destino (Simple Analytics) respeita DNT/GPC e não recebe dado pessoal; nenhuma fonte externa; 404, sitemap e rodapé coerentes.
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const read = (p) => readFile(path.join(siteRoot, p), 'utf8');
const exists = (p) => access(path.join(siteRoot, p)).then(() => true, () => false);
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

async function staticPages() {
  const out = [];
  async function walk(dir) {
    for (const e of await readdir(path.join(siteRoot, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) {
        if (['orcamento-src', 'node_modules', 'docs', 'orcamento', '.github', '.git', 'assets'].includes(e.name)) continue;
        await walk(rel);
      } else if (e.name.endsWith('.html') && !e.name.startsWith('_')) out.push(rel);
    }
  }
  await walk('.');
  return out.map((p) => p.replace(/^\.\//, ''));
}

test('fontes: nenhuma página carrega Google Fonts; Montserrat é autohospedada e declarada no CSS', async () => {
  for (const p of await staticPages()) {
    const h = await read(p);
    assert.doesNotMatch(h, /fonts\.googleapis|fonts\.gstatic/, `${p}: sem Google Fonts`);
  }
  const css = await read('assets/css/style.css');
  assert.match(css, /@font-face\{font-family:"Montserrat";src:url\("\.\.\/fonts\/montserrat-var-latin\.woff2"\)/, '@font-face da Montserrat');
  assert.match(css, /font-weight:400 800/, 'faixa de peso da fonte variável');
  assert.doesNotMatch(css, /Archivo|JetBrains|Source Sans/, 'sem as fontes anteriores');
  assert.ok(await exists('assets/fonts/montserrat-var-latin.woff2'));
  assert.ok(await exists('assets/fonts/Montserrat-OFL.txt'), 'licença da Montserrat acompanha a fonte');
  assert.ok(await exists('assets/fonts/special-elite-latin.woff2'));
  assert.ok(await exists('assets/fonts/SpecialElite-LICENSE.txt'), 'licença da Special Elite acompanha a fonte');
  const spa = await readFile(path.join(appRoot, 'src/styles.css'), 'utf8');
  assert.doesNotMatch(spa, /Archivo|Source Sans/, 'estimador sem as fontes anteriores');
  assert.match(spa, /montserrat-var-latin\.woff2/, 'estimador usa a mesma Montserrat do site');
});

test('destino de mensuração: Simple Analytics só liga sem DNT/GPC; page_view não é reenviado; só metadados primitivos', async () => {
  const src = await read('assets/js/analytics-sink.js');
  function run(navigatorProps) {
    const listeners = {};
    const appended = [];
    const doc = { head: { appendChild: (n) => appended.push(n) }, createElement: () => ({}) };
    const win = { navigator: navigatorProps, addEventListener: (t, fn) => { listeners[t] = fn; }, document: doc };
    win.window = win;
    const ctx = vm.createContext({ window: win, document: doc, navigator: navigatorProps });
    vm.runInContext(src, ctx);
    return { win, listeners, appended };
  }
  let r = run({ doNotTrack: '1' });
  assert.equal(r.appended.length, 0, 'DNT: o script do Simple Analytics não é carregado');
  assert.equal(typeof r.win.sa_event, 'undefined', 'DNT: sa_event não é definido');
  r = run({ globalPrivacyControl: true });
  assert.equal(r.appended.length, 0, 'GPC: o script não é carregado');
  r = run({});
  assert.equal(r.appended.length, 1);
  assert.equal(r.appended[0].src, 'https://scripts.simpleanalyticscdn.com/latest.js');
  assert.equal(r.appended[0].async, true);
  const sent = [];
  r.win.sa_event = (n, m) => sent.push([n, m]);
  r.listeners['demello:analytics']({ detail: { name: 'page_view', params: { page: '/' } } });
  assert.equal(sent.length, 0, 'page_view fica por conta do próprio Simple Analytics');
  r.listeners['demello:analytics']({ detail: { name: 'estimate_started', params: { route: 'build', entry: 'manual', step: 'S1', obj: { a: 1 }, fn() {} } } });
  assert.equal(JSON.stringify(sent), JSON.stringify([['estimate_started', { route: 'build', entry: 'manual', step: 'S1' }]]), 'só metadados primitivos do contrato');
  r.listeners['demello:analytics']({ detail: { name: 'Proposal Requested!', params: {} } });
  assert.equal(sent[1][0], 'proposal_requested_', 'nome sanitizado para [a-z0-9_]');
  assert.doesNotMatch(src, /document\.cookie|localStorage|sessionStorage|indexedDB/, 'o destino não guarda nada no navegador');
});

test('destino de mensuração: toda página estática e o /orcamento/ carregam o destino ANTES do módulo de eventos', async () => {
  for (const p of await staticPages()) {
    if (p === '404.html') continue;
    const h = await read(p);
    const i = h.indexOf('analytics-sink.js');
    const j = h.search(/<script type="module" src="[^"]*site-analytics\.mjs">/);
    assert.ok(i > 0 && j > 0 && i < j, `${p}: analytics-sink.js antes de site-analytics.mjs`);
    assert.match(h, /<script src="[^"]*analytics-sink\.js" defer><\/script>/, `${p}: carregado com defer`);
  }
  const spa = await read('orcamento/index.html');
  const i = spa.indexOf('analytics-sink.js');
  const j = spa.indexOf('type="module"');
  assert.ok(i > 0 && j > 0 && i < j, '/orcamento/: destino antes do bundle');
});

test('política × código: o que o site carrega está declarado; nada que o site não faz', async () => {
  const html = await read('privacidade/index.html');
  const txt = strip(html);
  assert.match(txt, /Marcos de Mello Silva Engenharia LTDA/);
  assert.match(txt, /65\.613\.230\/0001-71/);
  assert.match(txt, /marcos@demelloeng\.com\.br/, 'canal de contato para titulares');
  const sink = await read('assets/js/analytics-sink.js');
  assert.match(sink, /simpleanalyticscdn\.com/);
  assert.match(txt, /Simple Analytics/);
  const stage = await read('assets/js/three-d-stage.js');
  assert.match(stage, /unpkg\.com/);
  assert.match(txt, /unpkg\.com/);
  const bundle = (await readdir(path.join(siteRoot, 'orcamento/assets'))).find((f) => f.endsWith('.js'));
  const js = await read(`orcamento/assets/${bundle}`);
  assert.match(js, /workers\.dev/);
  assert.match(txt, /Cloudflare/);
  assert.match(txt, /GitHub Pages/);
  assert.match(txt, /WhatsApp/);
  assert.match(txt, /não usa cookies/);
  assert.match(txt, /não guarda nada no seu navegador/);
  for (const p of ['assets/js/analytics-sink.js', 'assets/js/analytics.mjs', 'assets/js/site-analytics.mjs', 'assets/js/nav.js']) {
    assert.doesNotMatch(await read(p), /document\.cookie|localStorage|sessionStorage|indexedDB/, `${p}: sem armazenamento no navegador`);
  }
  assert.doesNotMatch(txt, /Google Analytics|GA4|Google Fonts|Meta Pixel|Hotjar/i, 'não cita ferramentas que o site não usa');
  assert.match(txt, /fotos[^.]*não são enviadas/i);
  assert.match(txt, /Lei 13\.709\/2018/);
  assert.match(txt, /art\. 7º, V/);
  assert.match(txt, /ANPD/);
  assert.match(txt, /Última atualização: \d{1,2} de [a-zç]+ de 20\d\d/);
  const app = await readFile(path.join(appRoot, 'src/GlobalApp.jsx'), 'utf8');
  assert.match(app, /As fotos não são enviadas/);
  assert.match(txt, /concluir e confirmar/);
});

test('política: nenhuma página carrega recurso de host externo (script, estilo, imagem, vídeo, iframe) além do declarado', async () => {
  const hosts = new Set();
  for (const p of await staticPages()) {
    const h = await read(p);
    for (const m of h.matchAll(/<(script|link|img|video|source|iframe)\b[^>]*?\b(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/g)) {
      if (/rel="(?:canonical|alternate|icon)"/.test(m[0])) continue;
      const host = new URL(m[2]).hostname;
      if (host !== 'demelloeng.com.br') hosts.add(host);
    }
  }
  assert.deepEqual([...hosts].sort(), [], `recursos externos nas páginas: ${[...hosts].join(', ')}`);
});

test('rodapé: todas as páginas estáticas apontam para /privacidade/; sitemap lista a política e todas têm lastmod', async () => {
  for (const p of await staticPages()) {
    if (p === '404.html') continue;
    const h = await read(p);
    assert.match(h, /<a href="(?:\.\/|(?:\.\.\/)+)privacidade\/">Privacidade<\/a>/, `${p}: link no rodapé`);
  }
  const sm = await read('sitemap.xml');
  assert.match(sm, /<loc>https:\/\/demelloeng\.com\.br\/privacidade\/<\/loc>/);
  const n = (sm.match(/<url>/g) || []).length;
  assert.equal((sm.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, n, 'lastmod em todas as URLs');
  for (const m of sm.matchAll(/<loc>https:\/\/demelloeng\.com\.br(\/[^<]*)<\/loc>/g)) {
    const rel = m[1].endsWith('/') ? `${m[1].slice(1)}index.html` : m[1].slice(1);
    assert.ok(await exists(rel), `sitemap aponta para arquivo existente: ${m[1]}`);
  }
});

test('404: página própria, noindex, caminhos absolutos, sem canonical', async () => {
  const h = await read('404.html');
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(h, /rel="canonical"/);
  assert.doesNotMatch(h, /(?:href|src)="\.\.?\//, 'caminhos absolutos');
  assert.match(h, /<h1[^>]*>Essa página não existe\.<\/h1>/);
});

test('SEO: título até 60 e descrição até 160 caracteres; JSON-LD válido e sem dado inventado', async () => {
  for (const p of await staticPages()) {
    if (p === '404.html' || p.startsWith('verificar')) continue;
    const h = await read(p);
    const t = h.match(/<title>(.*?)<\/title>/s)[1];
    const d = h.match(/name="description" content="(.*?)"/)[1];
    assert.ok(t.length <= 60, `${p}: título ${t.length} caracteres`);
    assert.ok(d.length <= 160 && d.length >= 70, `${p}: descrição ${d.length} caracteres`);
  }
  const home = await read('index.html');
  const blocks = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, 1);
  const org = blocks[0]['@graph'].find((n) => n['@type'] === 'ProfessionalService');
  assert.equal(org.legalName, 'Marcos de Mello Silva Engenharia LTDA');
  assert.equal(org.taxID, '65.613.230/0001-71');
  assert.equal(org.address.addressLocality, 'Curitiba');
  assert.ok(!('aggregateRating' in org) && !('review' in org) && !('priceRange' in org), 'sem avaliações nem faixa de preço inventadas');
  for (const slug of ['projeto-estrutural', 'projeto-arquitetura', 'regularizacao']) {
    const h = await read(`servicos/${slug}/index.html`);
    const g = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
    assert.ok(g.some((n) => n['@type'] === 'Service') && g.some((n) => n['@type'] === 'BreadcrumbList'), `${slug}: Service + Breadcrumb`);
  }
});

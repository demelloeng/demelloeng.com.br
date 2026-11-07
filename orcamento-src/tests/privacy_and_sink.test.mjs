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
      } else if (e.name.endsWith('.html') && !e.name.startsWith('_') && !/^google[0-9a-f]+\.html$/.test(e.name)) out.push(rel); // arquivo de verificação do Search Console não é página
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
  assert.equal(sent.length, 1, 'evento fora do contrato é descartado, não renomeado');
  r.listeners['demello:analytics']({ detail: { name: 'proposal_requested', params: { route: 'build', request_intent: 'proposal', email: 'pessoa@example.test' } } });
  assert.equal(JSON.stringify(sent[1]), JSON.stringify(['proposal_requested', { route: 'build', request_intent: 'proposal' }]), 'evento vigente aceito sem dado de contato');
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
  // Conferir os import maps executados, não exemplos antigos em comentários.
  let maps = 0;
  for (const p of await staticPages()) {
    for (const match of (await read(p)).matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)) {
      const imports = JSON.parse(match[1]).imports;
      if (!imports.three) continue;
      maps += 1;
      for (const target of Object.values(imports)) {
        assert.doesNotMatch(target, /^(?:https?:)?\/\//, `${p}: biblioteca 3D local`);
        assert.match(target, /assets\/vendor\/three\//);
        await access(path.resolve(siteRoot, path.dirname(p), target));
      }
    }
  }
  assert.ok(maps > 0, 'import maps da biblioteca 3D encontrados');
  assert.doesNotMatch(txt, /unpkg\.com/i, 'não declara CDN removida');
  const bundle = (await readdir(path.join(siteRoot, 'orcamento/assets'))).find((f) => f.endsWith('.js'));
  const js = await read(`orcamento/assets/${bundle}`);
  assert.match(js, /workers\.dev/);
  assert.match(txt, /Cloudflare/);
  assert.match(txt, /GitHub Pages/);
  assert.match(txt, /WhatsApp/);
  assert.match(txt, /cookies de publicidade/, 'informa a possibilidade de cookies do Pixel');
  assert.match(txt, /IP, dados do navegador e identificadores técnicos/);
  for (const p of ['assets/js/analytics-sink.js', 'assets/js/analytics.mjs', 'assets/js/site-analytics.mjs', 'assets/js/nav.js']) {
    assert.doesNotMatch(await read(p), /document\.cookie|localStorage|sessionStorage|indexedDB/, `${p}: sem armazenamento no navegador`);
  }
  assert.doesNotMatch(txt, /Google Analytics|GA4|Google Fonts|Hotjar/i, 'não cita ferramentas que o site não usa');
  assert.match(txt, /Pixel da Meta/);
  assert.doesNotMatch(txt, /legítimo interesse|art\. 7º, IX\)/i, 'não presume fundamento da publicidade');
  assert.match(txt, /Do Not Track ou Global Privacy Control/);
  assert.match(txt, /ao abrir a página[^.]*não carrega as ferramentas de medição/);
  assert.match(txt, /identificadores de anúncio/);
  assert.match(txt, /nome, tamanho e tipo/, 'distingue metadados dos arquivos');
  assert.match(txt, /arquivos de imagem não fazem parte desse envio/);
  for (const right of ['acesso', 'correção', 'anonimização', 'bloqueio', 'eliminação', 'portabilidade', 'compartilhamentos', 'consentimento']) {
    assert.ok(txt.includes(right), `direito informado: ${right}`);
  }
  assert.match(txt, /ANPD/);
  assert.match(txt, /Última atualização: \d{1,2} de [a-zç]+ de 20\d\d/);
  const app = await readFile(path.join(appRoot, 'src/GlobalApp.jsx'), 'utf8');
  assert.match(app, /As fotos não são enviadas/);
  assert.match(txt, /Antes do contato final, gerar a prévia verificável já envia dados à Cloudflare/);
  assert.match(txt, /prévia fica guardada em um banco de dados/);
  assert.match(txt, /Quem tem o código pode consultar seu conteúdo público/);
  assert.match(txt, /Ao confirmar o envio final/);
  assert.match(txt, /em espera de processamento pela DEMELLO/);
  assert.doesNotMatch(txt, /cadastro concluído no CRM|dados ficam apenas no navegador/i);
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

test('rodapé: todas as páginas estáticas apontam para /privacidade/ e para a trajetória do fundador; sitemap lista a política e todas têm lastmod', async () => {
  for (const p of await staticPages()) {
    if (p === '404.html') continue;
    const h = await read(p);
    assert.match(h, /<a href="(?:\.\/|(?:\.\.\/)+)privacidade\/">Privacidade<\/a>/, `${p}: link no rodapé`);
    assert.match(h, /<a href="(?:\.\/|(?:\.\.\/)+)empresa\/trajetoria-do-fundador\.html">Trajetória do fundador<\/a>/, `${p}: trajetória no rodapé`);
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

test('Trajetória do fundador: alcançável do rodapé de qualquer página e da página Experiência; a página existe e está no sitemap', async () => {
  const exp = await read('experiencia-tecnica/index.html');
  assert.match(exp, /<a[^>]*href="\.\.\/empresa\/trajetoria-do-fundador\.html">Veja a trajetória do fundador\.<\/a>/);
  assert.ok(await exists('empresa/trajetoria-do-fundador.html'));
  assert.match(await read('sitemap.xml'), /\/empresa\/trajetoria-do-fundador\.html/);
  assert.match(await read('empresa/index.html'), /<a class="acao" href="\.\.\/empresa\/trajetoria-do-fundador\.html">Conhecer a trajetória do fundador<\/a>/);
});

test('Pixel da Meta: respeita DNT/GPC, não envia dado pessoal e está em todas as páginas', async () => {
  const px = await read('assets/js/meta-pixel.js');
  assert.match(px, /PIXEL_ID = '\d{10,20}'/);
  assert.match(px, /doNotTrack === '1'[\s\S]*globalPrivacyControl === true[\s\S]*return;/, 'sai antes de tudo com DNT/GPC');
  assert.doesNotMatch(px, /document\.cookie|localStorage|sessionStorage|\.value|fbq\('init', PIXEL_ID, \{/, 'sem leitura de campos, sem armazenamento próprio, sem correspondência avançada');
  for (const name of ['qualified_lead', 'whatsapp_contact_started']) assert.match(px, new RegExp(name));
  const map = px.split('var MAP = {')[1].split('};')[0];
  for (const name of ['proposal_requested', 'scope_question_requested', 'evaluation_requested']) assert.doesNotMatch(map, new RegExp(name), 'Lead sai do Worker (CAPI), não do navegador: sem duplicidade');
  for (const p of await staticPages()) assert.match(await read(p), /assets\/js\/meta-pixel\.js" defer/, `${p}: carrega o Pixel`);
  assert.match(await read('.github/pages/allowlist.txt'), /assets\/js\/meta-pixel\.js/);
});

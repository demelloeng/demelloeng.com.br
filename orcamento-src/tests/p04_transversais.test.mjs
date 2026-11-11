// P04 — WhatsApp flutuante + badge do Simple Analytics, como componentes transversais do site V02.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { PARAMS } from '../../assets/js/analytics.mjs';
import { buildEvent, installContactClicks, channelOf } from '../../assets/js/contact-clicks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const read = (f) => readFile(path.join(ROOT, f), 'utf8');

// Páginas publicadas (as que a allowlist leva ao site) que têm rodapé e script de mensuração.
const PAGES = [
  'index.html', '404.html', 'verificar/index.html', 'privacidade/index.html', 'contato/index.html', 'construir-ou-ampliar/index.html',
  'avaliar-um-problema/index.html', 'empresa/index.html', 'empresa/trajetoria-do-fundador.html', 'experiencia-tecnica/index.html',
  'metodologia/index.html', 'servicos/index.html',
  ...['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem', 'projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao', 'orcamento-tecnico', 'compatibilizacao-bim'].map((s) => `servicos/${s}/index.html`),
];

const BADGE_HREF = 'https://www.simpleanalytics.com?utm_source=demelloeng.com.br&amp;utm_content=badge';

test('botão: um script "defer" em TODAS as páginas estáticas e na calculadora, logo depois do carregador analítico', async () => {
  for (const p of [...PAGES, 'orcamento-src/index.html', 'orcamento/index.html']) {
    const h = await read(p);
    const tags = [...h.matchAll(/<script src="[^"]*assets\/js\/contato-flutuante\.js" defer><\/script>/g)];
    assert.equal(tags.length, 1, `${p}: exatamente um script do botão`);
    const sink = h.indexOf('assets/js/analytics-sink.js');
    assert.ok(sink > 0 && h.indexOf('contato-flutuante.js') > sink, `${p}: depois do analytics-sink.js (não substitui nem duplica o carregador)`);
    assert.equal([...h.matchAll(/analytics-sink\.js/g)].length, 1, `${p}: o carregador analítico continua único`);
  }
});

test('badge: o link oficial do Simple Analytics, uma vez por página, dentro do rodapé; imagem é cópia local', async () => {
  for (const p of PAGES) {
    const h = await read(p);
    assert.equal([...h.matchAll(/class="sa-badge"/g)].length, 1, `${p}: uma badge`);
    assert.ok(h.includes(`<a class="sa-badge" href="${BADGE_HREF}" referrerpolicy="origin" target="_blank">`), `${p}: link como o gerador oficial entrega`);
    const footer = h.slice(h.search(/<footer\b/), h.indexOf('</footer>'));
    assert.ok(footer.includes('class="sa-badge"'), `${p}: badge dentro do <footer>`);
    assert.ok(footer.includes('<img src="/assets/images/simple-analytics-badge.svg" width="126" height="30" alt="Simple Analytics" loading="lazy">'), `${p}: imagem local com texto alternativo`);
    assert.ok(!/simpleanalyticsbadges\.com/.test(h), `${p}: nenhuma requisição a host externo para a imagem`);
  }
  const svg = await read('assets/images/simple-analytics-badge.svg');
  assert.match(svg, /^<\?xml/);
  assert.ok(svg.length > 5000, 'cópia integral da imagem oficial, sem recorte');
});

test('badge: na calculadora também, uma vez, sem mexer no carregador analítico', async () => {
  const app = await read('orcamento-src/src/GlobalApp.jsx');
  assert.equal([...app.matchAll(/className="sa-badge"/g)].length, 1);
  assert.ok(app.includes('href="https://www.simpleanalytics.com?utm_source=demelloeng.com.br&utm_content=badge"'));
  assert.ok(app.includes('src="/assets/images/simple-analytics-badge.svg"'));
  const html = await read('orcamento/index.html');
  assert.equal([...html.matchAll(/analytics-sink\.js/g)].length, 1);
});

test('geradores: o rodapé e o script nascem nas fontes compartilhadas (nenhuma página só editada à mão)', async () => {
  const construir = await read('scripts/gerar-construir-ou-ampliar-v02.py');
  const contato = await read('scripts/gerar-contato-v02.py');
  const servicos = await read('scripts/gerar-paginas-servico-v02.py');
  for (const [nome, src] of [['construir', construir], ['contato', contato], ['servicos', servicos]]) {
    assert.ok(src.includes('class="sa-badge"') && src.includes('simple-analytics-badge.svg'), `${nome}: badge no rodapé gerado`);
  }
  for (const g of ['avaliar-um-problema', 'construir-ou-ampliar', 'contato', 'empresa', 'experiencia', 'metodologia', 'privacidade', 'servicos', 'verificar-404']) {
    assert.ok((await read(`scripts/gerar-${g}-v02.py`)).includes('contato-flutuante.js'), `gerar-${g}: script do botão`);
  }
  assert.ok((await read('scripts/gerar-paginas-servico-v02.py')).includes('contato-flutuante.js'));
});

test('publicação: botão e imagem da badge entram na allowlist e no smoke; nada mais', async () => {
  const allow = await read('.github/pages/allowlist.txt');
  assert.match(allow, /^assets\/js\/contato-flutuante\.js$/m);
  assert.match(allow, /^assets\/images\/simple-analytics-badge\.svg$/m);
  const art = await read('.github/pages/build_artifact.py');
  assert.ok(art.includes('"/assets/js/contato-flutuante.js"'));
});

// ---------------------------------------------------------------- mensuração
test('mensuração: o clique no botão é um evento de WhatsApp com posição "floating", um por clique', () => {
  assert.equal(PARAMS.placement('floating'), true);
  for (const bad of ['Floating', 'flutuante', 'fab', '']) assert.equal(PARAMS.placement(bad), false, bad);
  const link = {
    getAttribute: (n) => ({ href: 'https://wa.me/5541985124056?text=Ol%C3%A1', 'data-contact-placement': 'floating' }[n] ?? null),
    closest: (sel) => (sel === 'a[href]' ? link : sel === '[data-contact-placement]' ? link : null),
  };
  const ev = buildEvent({ closest: (sel) => (sel === 'a[href]' ? link : null) }, { location: { pathname: '/servicos/projeto-estrutural/' } });
  assert.equal(ev.event, 'whatsapp_contact_started');
  assert.equal(ev.params.placement, 'floating');
  assert.equal(ev.params.service, 'estrutural');
  assert.equal(channelOf('https://wa.me/5541985124056?text=x'), 'whatsapp_contact_started');
  assert.ok(!JSON.stringify(ev.params).includes('5541985124056'), 'o número nunca vai ao evento');
  assert.ok(!JSON.stringify(ev.params).includes('Ol'), 'a mensagem nunca vai ao evento');
});

test('mensuração: o ouvinte de contatos é único por documento (a calculadora e as páginas compartilham o módulo)', () => {
  const added = [];
  const doc = { addEventListener: (t, f, c) => added.push(t) };
  const win = { location: { pathname: '/orcamento/' } };
  assert.equal(installContactClicks(win, doc), true);
  assert.equal(installContactClicks(win, doc), false, 'segunda instalação não duplica');
  assert.deepEqual(added.sort(), ['auxclick', 'click']);
});

test('mensuração: a calculadora liga o ouvinte uma vez no ponto de entrada', async () => {
  const main = await read('orcamento-src/src/main.jsx');
  assert.equal([...main.matchAll(/installContactClicks\(\)/g)].length, 1);
  assert.match(main, /from "\.\.\/\.\.\/assets\/js\/contact-clicks\.mjs"/);
  for (const p of ['orcamento-src/index.html', 'orcamento/index.html']) assert.ok(!/site-analytics\.mjs/.test(await read(p)), `${p}: sem o módulo que também reenviaria page_view`);
});

// ---------------------------------------------------------------- conteúdo e comportamento do botão
test('botão: link institucional, nome acessível, sem simular atendimento e sem guardar nada no navegador', async () => {
  const src = await read('assets/js/contato-flutuante.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /NUMBER = '554498202552'/);
  assert.ok((await read('contato/index.html')).includes('https://wa.me/5541985124056'), 'o contato pessoal permanece preservado');
  assert.match(code, /aria-label', 'WhatsApp DEMELLO/);
  assert.match(code, /data-contact-placement', 'floating'/);
  assert.match(code, /target = '_blank'/);
  assert.match(code, /rel = 'noopener noreferrer'/);
  assert.match(code, /prefers-reduced-motion:reduce/);
  assert.match(code, /@media print/);
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(code), 'sem armazenamento (política: sem cookie, sem armazenamento)');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|new Image/.test(code), 'o botão não faz requisição nenhuma');
  assert.ok(!/online agora|respondemos em|responde em|atendente|digitando|disponível agora|minutos/i.test(code), 'sem atendimento simulado nem prazo de resposta');
});

function rodarBotao({ estreita, path = '/servicos/', foco = null } = {}) {
  const timers = [];
  const els = [];
  const mk = (tag) => {
    const e = {
      tagName: tag.toUpperCase(), className: '', style: {}, children: [], attrs: {}, listeners: {}, isContentEditable: false,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); } },
      insertBefore(c, ref) { const i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; },
      querySelector() { return null; },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { (this.listeners[t] ??= []).push(f); },
      getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
      contains() { return false; },
    };
    els.push(e); return e;
  };
  const docListeners = {};
  const body = mk('body'); body.className = '';
  const header = mk('header'); const footer = mk('footer'); const voltar = mk('a');
  header.children.push(voltar); header.querySelector = (sel) => (sel === '.site-link' ? voltar : null);
  const document = {
    head: mk('head'), body, createElement: mk,
    addEventListener: (t, f) => { (docListeners[t] ??= []).push(f); },
    querySelectorAll: () => [],
    querySelector: (sel) => (sel === '.case-panel' ? header : sel === '.site-footer' ? footer : null),
  };
  const window = {
    matchMedia: (q) => ({ matches: q.includes('520') || q.includes('900') ? !!estreita : false, addEventListener() {} }),
    innerHeight: 800, addEventListener() {}, MutationObserver: undefined,
  };
  window.window = window;
  const ctx = vm.createContext({
    window, document, location: { pathname: path }, encodeURIComponent, getComputedStyle: () => ({ bottom: '100px' }),
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {}, parseFloat, requestAnimationFrame: (f) => f(),
  });
  return { ctx, run: (code) => vm.runInContext(code, ctx), els, docListeners, timers, body, document, header, footer, voltar };
}

test('botão (execução): nasce uma vez por página, com texto no desktop que se recolhe sozinho', async () => {
  const code = await read('assets/js/contato-flutuante.js');
  const t = rodarBotao({ estreita: false });
  t.run(code);
  t.run(code); // segunda carga não duplica
  const fabs = t.els.filter((e) => e.className.startsWith('dm-fab') && !e.className.includes('__'));
  assert.equal(fabs.length, 1, 'um único botão');
  const link = t.els.find((e) => e.className === 'dm-fab__link');
  assert.equal(link.href, 'https://wa.me/554498202552?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20DEMELLO%20Engenharia.');
  assert.equal(link.attrs['data-contact-placement'], 'floating');
  assert.ok(!fabs[0].className.includes('recolhido'), 'no desktop começa com o texto');
  const recolher = t.timers.find((x) => x.ms === 6000);
  assert.ok(recolher, 'recolhe em 6 s');
  recolher.f();
  assert.ok(fabs[0].className.includes('dm-fab--recolhido'));
  assert.ok(!fabs[0].className.includes('dm-fab--calc'), 'fora da calculadora não reserva a faixa da barra fixa');
});

test('botão (execução): na calculadora ele não flutua — acopla ao painel fixo no celular e ao rodapé no computador', async () => {
  const code = await read('assets/js/contato-flutuante.js');
  const m = rodarBotao({ estreita: true, path: '/orcamento/' });
  m.run(code);
  const wrapM = m.els.find((e) => e.className.startsWith('dm-fab') && !e.className.includes('__'));
  assert.ok(wrapM.className.includes('dm-fab--recolhido'), 'sem texto em tela estreita');
  assert.ok(wrapM.className.includes('dm-fab--calc'));
  assert.ok(wrapM.classList.contains('dm-fab--docked'));
  assert.ok(m.header.children.includes(wrapM), 'no celular, dentro do painel "Seu projeto" (fixo no topo)');
  assert.equal(m.footer.children.length, 0, 'não vai ao rodapé no celular');
  assert.ok(m.body.classList.contains('dm-fab-no-painel'));
  assert.ok(!m.timers.some((x) => x.ms === 6000), 'sem temporizador de recolhimento');
  const d = rodarBotao({ estreita: false, path: '/orcamento/' });
  d.run(code);
  const wrapD = d.els.find((e) => e.className.startsWith('dm-fab') && !e.className.includes('__'));
  assert.ok(d.footer.children.includes(wrapD), 'no computador, dentro do rodapé fixo');
  assert.equal(d.header.children.includes(wrapD), false);
  const css = d.els.find((e) => e.id === 'dm-fab-css').textContent;
  assert.match(css, /\.dm-fab--docked\{position:static/);
  assert.ok(!/dm-fab--evitar|body\.dm-fab-on|visibility:hidden/.test(css), 'sem esquiva, sem faixa reservada e sem esconder o botão');
  assert.ok(!/opacity:\s*0?\.[0-9]+[^;}]*dm-fab/.test(css), 'sem opacidade reduzida');
});

test('botão (código): sem algoritmo de esquiva e sem leitura de conteúdo da página', async () => {
  const code = await read('assets/js/contato-flutuante.js');
  assert.ok(!/CONTROLES|topoDoConflito|getBoundingClientRect|dm-fab--evitar/.test(code), 'o botão não calcula sobreposição: ele fica numa barra fixa');
});

test('botão (execução): some enquanto o teclado do celular está em campo de texto e volta ao sair', async () => {
  const code = await read('assets/js/contato-flutuante.js');
  const t = rodarBotao({ estreita: true });
  t.run(code);
  const wrap = t.els.find((e) => e.className.startsWith('dm-fab') && !e.className.includes('__'));
  const alvo = (tag, type) => ({ tagName: tag, getAttribute: (k) => (k === 'type' ? type : null), isContentEditable: false });
  for (const f of t.docListeners.focusin) f({ target: alvo('INPUT', 'tel') });
  assert.ok(wrap.classList.contains('dm-fab--teclado'));
  for (const f of t.docListeners.focusout) f({ target: alvo('INPUT', 'tel') });
  assert.ok(!wrap.classList.contains('dm-fab--teclado'));
  for (const f of t.docListeners.focusin) f({ target: alvo('INPUT', 'checkbox') });
  assert.ok(!wrap.classList.contains('dm-fab--teclado'), 'caixa de seleção não abre teclado');
  for (const f of t.docListeners.focusin) f({ target: alvo('TEXTAREA', null) });
  assert.ok(wrap.classList.contains('dm-fab--teclado'));
});

test('páginas: o botão não muda o visual das páginas V02 (nenhum CSS de página foi alterado)', async () => {
  const css = (await readdir(path.join(ROOT, 'assets', 'css'))).filter((f) => f.endsWith('.css'));
  for (const f of css) assert.ok(!/dm-fab|sa-badge/.test(await read(`assets/css/${f}`)), `${f}: sem regra do botão ou da badge`);
});

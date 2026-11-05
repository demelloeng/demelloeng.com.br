import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Hidrantes: abertura pendente não desfaz fechamento já concluído', async () => {
  const source = readFileSync(new URL('../../assets/js/hidrantes-luiz-carlos-v02.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function abrir(');
  const end = source.indexOf("caixa.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start, 'funções reais de transição encontradas');
  const pending = [], classes = new Set(), attrs = {};
  const rect = {top: 10, left: 10, width: 400, height: 300};
  let focused = '';
  const elements = Object.fromEntries(['rotulo', 'explorar', 'ui', 'fechar'].map(id => [id, {
    hidden: false, focus() { focused = id; },
  }]));
  const box = {
    style: {}, classList: {add: x => classes.add(x), remove: x => classes.delete(x)},
    parentElement: {getBoundingClientRect: () => rect}, getBoundingClientRect: () => rect,
    getAnimations: () => [], setAttribute: (key, value) => { attrs[key] = value; },
    removeAttribute(key) { if (key === 'style') this.style = {}; else delete attrs[key]; },
    focus() { focused = 'caixa'; },
  };
  const context = {
    caixa: box, aberta: false, pronto: true, origemEl: null, transicao: 0, fechando: false,
    document: {body: {classList: {add() {}, remove() {}}}, contains: () => true},
    $: id => elements[id],
    // Ordena explicitamente as conclusões; não depende do relógio nem do navegador.
    animar: () => new Promise(resolve => pending.push(resolve)),
    cheia: {top: '0px', left: '0px', width: '100vw', height: '100dvh'},
    ajustar() {}, controles: {}, girar: true, posicionar() {}, p: 1, tween: null,
    tocar() {}, selecionar() {}, pendente: null, tip: {}, ficha: {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + ';this.open=abrir;this.close=fechar;', context);
  const opening = context.open();
  const closing = context.close();
  assert.equal(pending.length, 2);
  pending[1](); await closing;
  pending[0](); await opening;
  assert.deepEqual(box.style, {}, 'abertura obsoleta não deve restaurar dimensões de tela cheia');
  assert.equal(classes.has('aberta'), false);
  assert.equal(attrs.role, 'button');
  assert.equal(attrs['aria-modal'], undefined);
  assert.equal(elements.ui.hidden, true);
  assert.equal(context.controles.enabled, false);
  assert.equal(focused, 'caixa');
});

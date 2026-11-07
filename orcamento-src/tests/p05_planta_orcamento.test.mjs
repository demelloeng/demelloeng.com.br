// P05 — "Planta que se desenha" + "Orçamento em movimento": o painel só mostra o que o motor devolveu.
import test from 'node:test';
import './support/catalogo.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { livePlanModel, footprintFor, ILLUSTRATIVE_NOTICE, LAYER_OF } from '../src/live_plan.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';

const loc = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const base = { route: 'build', CA1: 'Construir do zero', property: 'Casa/sobrado', location: loc, phase: 'Arquitetura pronta', CA5: { value: '2' }, CA6: 'Médio', deadline: 'Ainda sem prazo' };

test('P05: sem serviço e sem área não há o que desenhar', () => {
  assert.equal(livePlanModel({ route: 'build' }), null);
  assert.equal(livePlanModel(undefined), null);
});

test('P05: sem preço — serviço escolhido, área ainda não informada (nada de valor inventado)', () => {
  const m = livePlanModel({ ...base, services: ['Elétrica'] });
  assert.equal(m.mode, 'without_price');
  assert.equal(m.total, null);
  assert.equal(m.area, null);
  assert.deepEqual(m.rows.map((r) => [r.key, r.state, r.total]), [['ELETRICA', 'pending', null]]);
  assert.deepEqual(m.layers, ['eletrica']);
  assert.equal(m.notice, ILLUSTRATIVE_NOTICE);
});

test('P05: com preço — os valores do painel são EXATAMENTE os do payload (elétrica 63,5 m² = R$ 436,88)', () => {
  const a = { ...base, services: ['Elétrica', 'Hidrossanitário'], CA_AREA: { value: '63.5' } };
  const m = livePlanModel(a);
  const pv = packageForCRMv2(a).pricing_preview;
  assert.equal(m.mode, 'with_price');
  assert.equal(m.total, pv.total_demello);
  assert.equal(m.total, '878.84');
  assert.equal(m.rows.find((r) => r.key === 'ELETRICA').total, '436.88');
  for (const r of m.rows) assert.equal(r.total, pv.services.find((s) => s.service === r.key).demello.total);
  assert.equal(m.area.value, '63.5');
  assert.equal(m.floors, 2);
  assert.deepEqual(m.layers.sort(), ['eletrica', 'hidrossanitario']);
});

test('P05: total parcial nunca é somado — um serviço sem dado mantém o conjunto sem valor', () => {
  const m = livePlanModel({ ...base, services: ['Elétrica', 'Gás'], CA_AREA: { value: '100' } });
  assert.ok(m.rows.some((r) => r.state === 'pending'));
  assert.equal(m.total, null);
  assert.notEqual(m.mode, 'with_price');
});

test('P05: acima do limite — sem valor automático, estado próprio, informação preservada', () => {
  const m = livePlanModel({ ...base, services: ['Elétrica'], CA_AREA: { value: '20000' } });
  assert.equal(m.mode, 'over_limit');
  assert.equal(m.total, null);
  assert.equal(m.rows[0].state, 'over_limit');
  assert.equal(m.area.value, '20000');
});

test('P05: o desenho é ilustrativo — pegada determinística, crescente e limitada; inválido não desenha', () => {
  assert.equal(footprintFor('abc'), null);
  assert.equal(footprintFor('0'), null);
  assert.equal(footprintFor('-5'), null);
  const [a, b, c] = ['10', '120', '10000'].map((v) => footprintFor(v).w);
  assert.ok(a < b && b < c);
  assert.deepEqual(footprintFor('10000'), footprintFor('99999999'));
  assert.equal(footprintFor('120').h, Math.round(footprintFor('120').w / 1.5));
});

test('P05: pavimentos desenhados têm teto; o resto vira texto (sem desenho enganoso)', () => {
  const m = livePlanModel({ ...base, services: ['Elétrica'], CA5: { value: '15' }, CA_AREA: { value: '100' } });
  assert.equal(m.floors, 15);
  assert.equal(m.floorsDrawn, 8);
  assert.equal(m.floorsExtra, 7);
  assert.equal(livePlanModel({ ...base, services: ['Elétrica'], CA5: { value: 'x' } }).floors, null);
});

test('P05: terreno — área do terreno vira planta de terreno, com a camada de terraplanagem e o valor do motor', () => {
  const a = { route: 'known', services: ['Terraplenagem'], area_terreno: { value: '800' }, location: loc, deadline: 'Ainda sem prazo' };
  const m = livePlanModel(a);
  assert.equal(m.area.kind, 'terrain');
  assert.equal(m.area.value, '800');
  assert.deepEqual(m.layers, ['terreno']);
  const pv = packageForCRMv2(a).pricing_preview;
  assert.equal(m.rows[0].state, pv.services[0].status === 'CALCULATED' ? 'priced' : 'pending');
  assert.equal(m.total, pv.status === 'CALCULATED' ? pv.total_demello : null);
});

test('P05: toda camada mapeia para um serviço real do motor, e o painel está ligado à calculadora real', async () => {
  const table = JSON.parse(await readFile(new URL('../src/pricing/pricing-table.v2.json', import.meta.url), 'utf8'));
  for (const k of Object.keys(LAYER_OF)) assert.ok(table.services[k], `serviço ${k} existe na tabela`);
  const app = await readFile(new URL('../src/GlobalApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /<LivePlan answers=\{answers\} expanded=\{expanded\}\/>/);
  const comp = await readFile(new URL('../src/LivePlan.jsx', import.meta.url), 'utf8');
  assert.match(comp, /prefers-reduced-motion/);
  assert.match(comp, /role="img"/);
  assert.match(comp, /aria-live="polite"/);
});

test('P01/P05: a mensagem neutra de porte acima do limite vale para o resultado X3B (não só para X3A)', async () => {
  const app = await readFile(new URL('../src/GlobalApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /:aboveLimit\(pv\)\?<>/);
  assert.ok(!/isPreview&&aboveLimit/.test(app), 'o ramo do limite não depende de isPreview');
  assert.match(app, /Esse porte pede avaliação da equipe\./);
});

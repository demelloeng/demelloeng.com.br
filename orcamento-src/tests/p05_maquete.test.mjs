// P05 (V04) — maquete 3D e isométrica da calculadora: modelo puro, contrato da cena e texto da marca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sceneSpec, describeScene, isoShapes, isoViewBox, VIEWS, MAX_FLOORS, LAYER_COLOR } from '../src/maquete_model.mjs';
import { livePlanModel, LAYER_LABEL, ILLUSTRATIVE_NOTICE, ILLUSTRATIVE_LABEL } from '../src/live_plan.mjs';

const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');
const model = (over = {}) => ({ area: { kind: 'building', value: '63.5', footprint: { w: 150, h: 100 } }, floorsDrawn: 2, layers: ['estrutura', 'hidrossanitario', 'eletrica'], ...over });

test('maquete: o spec é determinístico e só depende dos dados informados', () => {
  assert.deepEqual(sceneSpec(model()), sceneSpec(model()));
  const a = sceneSpec(model({ area: { kind: 'building', footprint: { w: 110 } } }));
  const b = sceneSpec(model({ area: { kind: 'building', footprint: { w: 260 } } }));
  assert.ok(a.w < b.w, 'a escala acompanha a área');
  assert.equal(sceneSpec(model()).floors, 2);
});

test('maquete: pavimentos informados valem; sem informação é um volume genérico; teto de pavimentos', () => {
  assert.equal(sceneSpec(model({ floorsDrawn: 5 })).floors, 5);
  assert.equal(sceneSpec(model({ floorsDrawn: 40 })).floors, MAX_FLOORS);
  const g = sceneSpec(model({ floorsDrawn: null }));
  assert.equal(g.floorsKnown, false);
  assert.match(describeScene(g, LAYER_LABEL), /volume genérico/);
  assert.match(describeScene(sceneSpec(model()), LAYER_LABEL), /2 pavimentos, com Estrutura, Hidrossanitário, Elétrica/);
});

test('maquete: terreno vira camada própria; as demais camadas só entram se escolhidas', () => {
  const t = sceneSpec(model({ area: { kind: 'terrain', footprint: { w: 200 } }, layers: ['terreno'] }));
  assert.equal(t.terrain, true);
  assert.deepEqual(t.layers, []);
  assert.deepEqual(sceneSpec(model({ layers: [] })).layers, []);
  for (const l of Object.keys(LAYER_COLOR)) assert.match(LAYER_COLOR[l], /^#[0-9a-f]{6}$/);
});

test('maquete: o desenho isométrico (fallback e primeira pintura) tem geometria finita em todas as vistas', () => {
  for (const v of VIEWS.map((x) => x.id)) {
    const spec = sceneSpec(model());
    const shapes = isoShapes(spec, v);
    assert.ok(shapes.length > 6, v);
    const vb = isoViewBox(spec, v);
    for (const n of Object.values(vb)) assert.ok(Number.isFinite(n), `${v}: ${JSON.stringify(vb)}`);
    assert.ok(vb.w > 0 && vb.h > 0);
    assert.ok(!shapes.some((s) => /NaN|Infinity/.test(JSON.stringify(s))));
  }
  const kinds = new Set(isoShapes(sceneSpec(model()), 'camadas').map((s) => s.kind));
  for (const k of ['slab-top', 'estrutura', 'hidrossanitario', 'eletrica']) assert.ok(kinds.has(k), k);
  const nenhum = new Set(isoShapes(sceneSpec(model({ layers: [] })), 'conjunto').map((s) => s.kind));
  assert.ok(!nenhum.has('estrutura') && !nenhum.has('hidrossanitario'), 'sem disciplina escolhida, sem camada');
});

test('maquete: o modelo da cena nunca traz preço nem quantidade técnica inventada', () => {
  const spec = sceneSpec(model());
  assert.ok(!/R\$|total|preco|price/i.test(JSON.stringify(spec)));
});

test('maquete 3D: o Three entra só por import() do arquivo já hospedado, nunca no pacote de entrada', async () => {
  const src = await read('src/maquete3d.mjs');
  assert.match(src, /\/assets\/vendor\/three\/build\/three\.module\.js/);
  assert.ok(!/^\s*import\s+[^;]*from\s+['"]three/m.test(src), 'sem import estático do three');
  const allow = await readFile(new URL('../../.github/pages/allowlist.txt', import.meta.url), 'utf8');
  assert.match(allow, /^assets\/vendor\/three\/build\/three\.module\.js$/m, 'o arquivo hospedado está na allowlist');
  const pkg = JSON.parse(await read('package.json'));
  assert.ok(!('three' in (pkg.dependencies ?? {})), 'nenhuma dependência nova');
  const live = await read('src/LivePlan.jsx');
  assert.match(live, /import\('\.\/maquete3d\.mjs'\)/, 'a cena é um módulo carregado sob demanda');
});

test('maquete 3D: desempenho e limpeza — laço sob demanda, pausa fora da tela, pixel ratio limitado, recursos liberados', async () => {
  const src = await read('src/maquete3d.mjs');
  assert.match(src, /moving \|\| state\.dragging/, 'só continua desenhando enquanto algo se move');
  assert.match(src, /setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, mobile \? 1\.5 : 2\)\)/);
  assert.match(src, /powerPreference: 'low-power'/);
  assert.match(src, /document\.hidden/);
  assert.match(src, /setVisible/);
  assert.match(src, /renderer\.dispose\(\)/);
  assert.match(src, /cancelAnimationFrame/);
  assert.ok(!/setInterval/.test(src), 'sem laço permanente');
  const live = await read('src/LivePlan.jsx');
  assert.match(live, /IntersectionObserver/);
  assert.match(live, /sc\.destroy\(\)|scene\.current\?\.destroy\(\)/);
  assert.match(live, /want3d/);
});

test('maquete 3D: acessibilidade — texto equivalente, foco, teclado, movimento reduzido e alternativa sem WebGL', async () => {
  const live = await read('src/LivePlan.jsx');
  assert.match(live, /role="img" aria-label=\{label\}/);
  assert.match(live, /aria-pressed=\{view===v\.id\}/);
  assert.match(live, /prefers-reduced-motion: reduce/);
  assert.match(live, /webglAvailable\(\)/);
  assert.match(live, /data-3d=/);
  assert.match(live, /class Guard/);
  const src = await read('src/maquete3d.mjs');
  assert.match(src, /ArrowLeft/);
  assert.match(src, /ArrowRight/);
  assert.match(src, /reduced/);
  const css = await read('src/styles.css');
  assert.match(css, /touch-action:pan-y/, 'a página continua rolando na vertical sobre a maquete');
  assert.match(css, /\.mq-host:focus-visible/);
  assert.match(css, /\.mq-tab:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.mq-svg/);
});

test('maquete: o motor de preço não é tocado pela cena (a cena não importa motor nem tabela)', async () => {
  for (const f of ['src/maquete3d.mjs', 'src/maquete_model.mjs']) {
    const s = await read(f);
    assert.ok(!/pricing|decimal|total_demello|brlStr/.test(s.replace(/\/\/.*$/gm, '')), `${f}: sem cálculo comercial`);
  }
});

test('Voz DEMELLO V07: o aviso da maquete é afirmativo e curto; a frase reprovada não volta', async () => {
  assert.equal(ILLUSTRATIVE_LABEL, 'Visualização ilustrativa');
  assert.equal(ILLUSTRATIVE_NOTICE, 'A maquete acompanha suas escolhas de área, pavimentos e disciplinas.');
  for (const f of ['src/live_plan.mjs', 'src/LivePlan.jsx', 'src/GlobalApp.jsx', 'src/maquete_model.mjs']) {
    const s = await read(f);
    assert.ok(!/Desenho ilustrativo|não o seu projeto|projeto de verdade|Não é seu projeto|Não representa/.test(s), `${f}: texto reprovado`);
  }
  assert.ok(!/terrapl[e]nagem/i.test(ILLUSTRATIVE_NOTICE + JSON.stringify(LAYER_LABEL)), 'grafia: terraplanagem');
  assert.equal(LAYER_LABEL.terreno, 'Terraplanagem');
});

test('Voz DEMELLO V07: o exemplo de telefone mostrado ao visitante não é um número que o validador recusa', async () => {
  const { PHONE_MESSAGE, parsePhone } = await import('../src/phone.mjs');
  const exemplo = PHONE_MESSAGE.curto.match(/\(41\) [0-9X-]+/)?.[0];
  assert.ok(exemplo, 'o exemplo existe');
  assert.ok(/X/.test(exemplo), 'o exemplo é um molde, não um número que possa ser recusado como artificial');
  assert.equal(parsePhone('(41) 98765-4321').ok, false, 'o número que a mensagem antiga mostrava é recusado');
});

test('maquete: o painel conserva os dados reais — com preço e sem preço o modelo da jornada alimenta a cena', () => {
  const m = livePlanModel({ route: 'build', CA1: 'Construir do zero', property: 'Casa/sobrado', location: { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' }, phase: 'Arquitetura pronta', CA5: { value: '3' }, CA6: 'Médio', services: ['Elétrica'], CA_AREA: { value: '63,5' } });
  const spec = sceneSpec(m);
  assert.equal(spec.floors, 3);
  assert.deepEqual(spec.layers, ['eletrica']);
  assert.equal(m.rows[0].total, '316.99');   // R2: 63,5 x 6,24 x 0,80
});

test('refino V04: valor monetário indivisível no painel e botão do WhatsApp com área de toque de 44 px', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /\.lp-chip strong\{[^}]*white-space:nowrap/, 'estimativa do painel compacto não quebra');
  assert.match(css, /\.lp-total strong\{[^}]*white-space:nowrap/, 'total do painel expandido não quebra');
  assert.match(css, /\.lp-row strong\{white-space:nowrap\}/, 'valores das linhas não quebram');
  const fab = await readFile(new URL('../../assets/js/contato-flutuante.js', import.meta.url), 'utf8');
  assert.match(fab, /\.case-panel \.dm-fab--docked\{[^}]*width:44px;height:44px/, 'área de toque de 44 x 44');
  assert.match(fab, /inset:6px/, 'círculo visível menor que a área de toque');
  const lp = await read('src/LivePlan.jsx');
  assert.match(lp, /className="lp-tag">\{m\.label\}/, 'legenda com identificação discreta');
});

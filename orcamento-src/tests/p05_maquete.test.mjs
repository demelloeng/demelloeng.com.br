// P05 (V04) — maquete 3D e isométrica da calculadora: modelo puro, contrato da cena e texto da marca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sceneSpec, describeScene, isoShapes, isoViewBox, VIEWS, MAX_FLOORS, LAYER_COLOR, VIEW_CAM, FIT_MARGIN, CONTROLS_BAND, fitDistance, projectCorner, modelHeight, cutTargetZ } from '../src/maquete_model.mjs';
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

// --- enquadramento (C): a edificação inteira cabe no quadro, acima da faixa dos botões, em toda vista e proporção ------------
const EPS = 1e-9;
function cornersOf(spec, view) {
  const H = modelHeight(spec, view);
  const dz = VIEW_CAM[view].cut ? spec.d / 4 : spec.d / 2;
  const out = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push([sx * spec.w / 2, sy * H / 2, sz * dz]);
  return out;
}

test('enquadramento: todos os cantos ficam dentro da margem horizontal e da área livre acima dos botões (4 vistas x proporções x 1..8 pavimentos)', () => {
  const limitX = FIT_MARGIN + 1e-6;
  const limitY = FIT_MARGIN * (1 - CONTROLS_BAND) + 1e-6;
  let checked = 0;
  for (const view of Object.keys(VIEW_CAM)) {
    for (const aspect of [0.7, 1.0, 1.35, 1.6, 2.1]) {
      for (const floors of [1, 2, 3, 5, 8]) {
        for (const w of [14, 22, 30]) {
          const spec = { w, d: Math.round(w * 0.66 * 10) / 10, floors };
          const dist = fitDistance(spec, view, { aspect, fovDeg: 30 });
          assert.ok(Number.isFinite(dist) && dist > 0, `${view} ${aspect}`);
          for (const c of cornersOf(spec, view)) {
            const [x, y] = projectCorner(spec, view, dist, c, { aspect, fovDeg: 30 });
            assert.ok(Math.abs(x) <= limitX, `${view} aspect ${aspect} ${floors}p w${w}: x=${x.toFixed(3)}`);
            assert.ok(Math.abs(y) <= limitY, `${view} aspect ${aspect} ${floors}p w${w}: y=${y.toFixed(3)}`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, 4 * 5 * 5 * 3 * 8);
});

test('enquadramento: com botões que quebram de linha (faixa maior), o desenho continua inteiro e acima deles', () => {
  for (const band of [0.12, 0.2, 0.35, 0.5]) {
    for (const view of Object.keys(VIEW_CAM)) {
      const spec = { w: 22, d: 14.5, floors: 3 };
      const dist = fitDistance(spec, view, { aspect: 1.1, fovDeg: 30, band });
      for (const c of cornersOf(spec, view)) {
        const [x, y] = projectCorner(spec, view, dist, c, { aspect: 1.1, fovDeg: 30 });
        assert.ok(Math.abs(x) <= FIT_MARGIN + 1e-6 && Math.abs(y) <= FIT_MARGIN * (1 - band) + 1e-6, `${view} faixa ${band}`);
      }
    }
  }
  // quanto maior a faixa reservada, mais longe a câmera (o desenho encolhe em vez de passar por baixo dos botões)
  const spec = { w: 22, d: 14.5, floors: 3 };
  assert.ok(fitDistance(spec, 'conjunto', { band: 0.5 }) > fitDistance(spec, 'conjunto', { band: 0.12 }));
});

test('enquadramento: a faixa dos botões é medida no navegador e o CSS estreito mantém as quatro vistas em uma linha', async () => {
  const src = await readFile(new URL('../src/maquete3d.mjs', import.meta.url), 'utf8');
  assert.match(src, /querySelector\('\.mq-tabs'\)/);
  assert.match(src, /band: state\.band/);
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:380px\)\{\.mq-tabs\{[^}]*\}\.mq-tab\{padding:8px 6px;font-size:11\.5px\}\}/);
});

test('enquadramento: a distância é a MÍNIMA que cabe (o modelo ocupa de fato a área, não fica minúsculo)', () => {
  for (const view of Object.keys(VIEW_CAM)) {
    for (const aspect of [1.0, 1.6, 2.1]) {
      const spec = { w: 22, d: 14.5, floors: 3 };
      const dist = fitDistance(spec, view, { aspect, fovDeg: 30 });
      const extents = cornersOf(spec, view).map((c) => projectCorner(spec, view, dist, c, { aspect, fovDeg: 30 }));
      const fillX = Math.max(...extents.map(([x]) => Math.abs(x))) / FIT_MARGIN;
      const fillY = Math.max(...extents.map(([, y]) => Math.abs(y))) / (FIT_MARGIN * (1 - CONTROLS_BAND));
      assert.ok(Math.max(fillX, fillY) > 0.995, `${view} ${aspect}: folga desnecessária (${Math.max(fillX, fillY).toFixed(3)})`);
    }
  }
});

test('enquadramento: a vista Planta mostra a edificação inteira (regressão do corte nas quatro bordas)', () => {
  // antes: distância = max(w, d*aspect*0.7)*0.78*0.92 deixava a planta maior que o quadro
  const spec = { w: 22, d: 14.5, floors: 2 };
  const old = Math.max(spec.w, spec.d * 1.6 * 0.7) * 0.78 * 0.92;
  const fitted = fitDistance(spec, 'planta', { aspect: 1.6, fovDeg: 30 });
  const half = (dist) => Math.max(...cornersOf(spec, 'planta').map((c) => Math.abs(projectCorner(spec, 'planta', dist, c, { aspect: 1.6, fovDeg: 30 })[0])));
  assert.ok(half(old) > 1, 'a heurística antiga projetava fora do quadro');
  assert.ok(half(fitted) <= FIT_MARGIN + 1e-6, 'o enquadramento novo cabe');
});

test('enquadramento: com o corte, o alvo da câmera vai para o centro da metade que sobra; sem corte fica no centro', () => {
  const spec = { w: 22, d: 14.5, floors: 2 };
  assert.equal(cutTargetZ(spec, 'corte'), -14.5 / 4);
  for (const v of ['conjunto', 'camadas', 'planta']) assert.equal(cutTargetZ(spec, v), 0);
});

test('maquete 3D: câmera usa fitDistance, alvo no centro do modelo, faixa dos controles reservada e nada de heurística por esfera', async () => {
  const src = await readFile(new URL('../src/maquete3d.mjs', import.meta.url), 'utf8');
  assert.match(src, /fitDistance\(spec, view,/);
  assert.match(src, /camera\.setViewOffset\(/);
  assert.match(src, /camera\.lookAt\(0, ty, tz\)/);
  assert.doesNotMatch(src, /Math\.hypot\(spec\.w, spec\.d, H\)/, 'a heurística por raio de esfera saiu');
  assert.doesNotMatch(src, /const VIEW_CAM = \{/, 'as vistas moram no modelo puro (testável)');
});

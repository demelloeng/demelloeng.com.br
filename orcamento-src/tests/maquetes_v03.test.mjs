// Maquetes V03 das páginas de serviço (estrutural, hidrossanitária e incêndio): integridade dos modelos, dados derivados,
// paridade do enquadramento com a calculadora R4 e regras de publicação (allowlist, ?v, importmap local).
// Nada aqui abre navegador; a validação visual e de desempenho é feita à parte, com roteiro próprio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fitBox, scaleBar } from '../../assets/js/maquetes/enquadrar.mjs';
import * as R4 from '../src/maquete5_building.mjs';
import { caixasDosElementos, uniao, niveisPorTopo, alturasHorizontais, nomePavimento, aplicarRotulos, bordasReais, juntarCasca, verticesQueCruzam, isolarFundo, focoDeVolta, giroFechado, APRESENTACAO_MS, semMaqueteAtalhos } from '../../assets/js/maquetes/dados.mjs';
import { blocoTerreno, curvasDeNivel, linhaDe, fatorLinha, corTerreno, secao, TERRA } from '../../assets/js/maquetes/terreno.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => readFile(path.join(RAIZ, p));
const texto = async (p) => (await ler(p)).toString('utf8');

// SHA-256 dos modelos publicados: a maquete V03 NÃO pode trocar geometria nem metadados (decisão 103).
const MODELOS = {
  'assets/models/estrutura-concreto.glb': 'd9191b7a0c56c4d362c5a6429cb071d3782af4523b9bcee698a5cedeac10ae50',
  'assets/models/estrutura-concreto.json': 'fe7fae758fe8d65490b15093e9412c51298ec4ed6c7a65921056e98f0032e522',
  'assets/models/estrutura-aco.glb': '916276a6e56f5a5ace30ec10a82ca5886c4c9bc0b37993465d914c897785245c',
  'assets/models/estrutura-aco.json': '04f098ce48f5eac78b5308105d5d5e66cee57005da3a5f55de20daba7cb2a344',
  'assets/models/hidro-casa.glb': 'c850b21c007c7c1e27443d5bac55a304be46175329e620393e51a1ab7a715a3d',
  'assets/models/hidro-casa.json': '9296b457ee83778009c06685a1347866333ed790f132d09982a176606f14a8dc',
  'assets/models/casa-exemplo.glb': 'b6f3dba49ab33e64d3235bb6be10a7023f3495001da8a14e9c02321c0ac030d0',
  'assets/models/hidrantes-luiz-carlos-v02.glb': '350b52603363964386270bba4b1fbdda04f9cd26ab4483559f6b12868021c04a',
  'assets/models/hidrantes-luiz-carlos-v02.json': '2e4e019029d304d122a125c6919ea0a9061e30a58890ba4854d03dff8a8feae8',
  // terraplanagem: o GLB V5 publicado em 02/11/2026 continua o mesmo; o JSON V03 (identidade para a ficha) é novo
  'assets/models/terraplanagem-djalma.glb': 'b1ac311f016b23f5c316dc253e2f24053f260724c06fa670ad704b87990c66a9',
  'assets/models/terraplanagem-djalma-v03.json': 'd37665244b4243d1806eb6e4c4a90bd6a2802c867c5d2f1a925769714103f493',
};

// Páginas com maquete V03: página, capa e módulo de configuração em assets/js/maquetes/.
const PAGINAS_V03 = [
  { pagina: 'servicos/projeto-estrutural/index.html', capa: 'maquete-estrutura-capa.webp', config: 'estrutural' },
  { pagina: 'servicos/projeto-hidrossanitario/index.html', capa: 'maquete-hidro-capa.webp', config: 'hidro' },
  { pagina: 'servicos/projeto-prevencao-incendio/index.html', capa: 'maquete-incendio-capa.webp', config: 'incendio' },
  { pagina: 'servicos/projeto-terraplenagem/index.html', capa: 'maquete-terraplanagem-capa.webp', config: 'terraplanagem' },
];

// Leitor mínimo de GLB (só o necessário: POSITION e índices de cada nó).
async function glb(p) {
  const b = await ler(p);
  const n = b.readUInt32LE(12); const j = JSON.parse(b.subarray(20, 20 + n).toString('utf8')); const bin = 20 + n + 8;
  const ac = (i) => {
    const a = j.accessors[i]; const bv = j.bufferViews[a.bufferView]; const off = bin + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
    const nc = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    return new T(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + a.count * nc * T.BYTES_PER_ELEMENT));
  };
  const malhas = {};
  for (const no of j.nodes) {
    const pr = j.meshes[no.mesh].primitives[0];
    malhas[no.name] = { pos: ac(pr.attributes.POSITION), idx: pr.indices !== undefined ? ac(pr.indices) : null, cor: pr.attributes.COLOR_0 !== undefined, trs: ['translation', 'rotation', 'scale', 'matrix'].some((k) => k in no) };
  }
  return { malhas, tamanho: b.length };
}

test('modelos: SHA-256 inalterados e GLB até 2.000 KB', async () => {
  for (const [p, h] of Object.entries(MODELOS)) {
    const b = await ler(p);
    assert.equal(createHash('sha256').update(b).digest('hex'), h, p);
    if (p.endsWith('.glb')) assert.ok(b.length <= 2000 * 1024, p);
  }
});

test('modelos: JSON casa com o GLB (faces contíguas, mesma contagem, sem transformação de nó)', async () => {
  for (const nome of ['estrutura-concreto', 'estrutura-aco', 'hidro-casa']) {
    const { malhas } = await glb(`assets/models/${nome}.glb`);
    const meta = JSON.parse(await texto(`assets/models/${nome}.json`));
    for (const [g, els] of Object.entries(meta.grupos)) {
      const m = malhas[g]; assert.ok(m, `${nome}/${g}`); assert.equal(m.trs, false);
      const tris = m.idx ? m.idx.length / 3 : m.pos.length / 9;
      let f = 0; for (const el of els) { assert.equal(el[2], f, `${nome}/${g}/${el[0]}`); f += el[3]; }
      assert.equal(f, tris, `${nome}/${g}`);
    }
  }
});

test('enquadramento: paridade exata com a calculadora R4 (fitBox e scaleBar)', () => {
  for (const az of [0, 28, 38, 135, 300]) for (const el of [4, 21, 60, 89.6]) for (const fovDeg of [7, 30]) for (const aspect of [0.6, 1.6, 2.2]) {
    const box = { w: 55.4, h: 12.9, d: 62.3 }; const o = { az, el, fovDeg, aspect, band: 0.25, margin: 0.9 };
    assert.equal(fitBox(box, o), R4.fitBox(box, o));
  }
  for (const mpp of [0.004, 0.02, 0.1, 0.6]) assert.deepEqual(scaleBar(mpp), R4.scaleBar(mpp));
});

test('estrutural: níveis pelo topo das lajes (Térreo 0,00; Pavimento superior 3,50; Cobertura 7,00) e foco nos blocos', async () => {
  const { malhas } = await glb('assets/models/estrutura-concreto.glb');
  const meta = JSON.parse(await texto('assets/models/estrutura-concreto.json'));
  const lj = meta.grupos.lajes; const cx = caixasDosElementos(malhas.lajes.pos, malhas.lajes.idx, lj);
  const niv = niveisPorTopo(cx, lj).map((n) => [nomePavimento(meta.pavimentos[n.pav]).nome, Math.round(n.y * 100) / 100]);
  assert.deepEqual(niv, [['Térreo', 0], ['Pavimento superior', 3.5], ['Cobertura', 7]]);
  // foco: pavimentos acima do térreo (os blocos), sem o muro
  const todos = []; const els = [];
  for (const g of Object.keys(meta.grupos)) { const m = malhas[g]; todos.push(...caixasDosElementos(m.pos, m.idx, meta.grupos[g])); els.push(...meta.grupos[g]); }
  const foco = uniao(todos, els, [2, 3]); const lote = uniao(todos, els);
  assert.ok(foco.max[0] - foco.min[0] < 0.6 * (lote.max[0] - lote.min[0]));
  assert.ok(foco.max[2] - foco.min[2] < 0.6 * (lote.max[2] - lote.min[2]));
});

test('hidrossanitária: níveis tirados dos pisos da casca (térreo no 0,00 do IFC, com o encaixe do protótipo)', async () => {
  const { malhas } = await glb('assets/models/casa-exemplo.glb');
  const piso = alturasHorizontais(malhas.piso.pos, malhas.piso.idx).map((g) => g.y);
  assert.equal(piso.length, 2);
  const DY = -3.552;   // posição vertical da casca no sistema dos tubos (hidro.mjs)
  assert.ok(Math.abs(piso[0] + DY) < 0.2, `térreo em ${piso[0] + DY}`);
});

test('pavimento: a ressalva do modelo não se perde', () => {
  assert.deepEqual(nomePavimento('Nível 2 (≈ +3,00 — aproximado, não executivo)'), { nome: 'Nível 2', ressalva: 'aproximado, não executivo' });
  assert.deepEqual(nomePavimento('PAV SUPERIOR'), { nome: 'Pavimento superior', ressalva: '' });
  assert.deepEqual(nomePavimento('PERGOLADO_PISCINA'), { nome: 'Piscina', ressalva: '' });   // o mesmo nome da página publicada
});

test('aço: rótulos do modelo valem (vigas -> Treliças; lajes -> Piso)', async () => {
  const meta = JSON.parse(await texto('assets/models/estrutura-aco.json'));
  const c = aplicarRotulos([{ id: 'vigas', nome: 'Vigas', um: 'Viga' }, { id: 'lajes', nome: 'Lajes', um: 'Laje' }, { id: 'pilares', nome: 'Pilares', um: 'Pilar' }], meta.rotulos);
  assert.deepEqual(c.map((k) => k.nome), ['Treliças', 'Piso', 'Pilares']);
});

test('contorno: a diagonal de uma face plana não é aresta; as dobras de 90 graus são', () => {
  // quadrado em 2 triângulos (z=0) + uma aba vertical em x=1
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0]);
  const m = bordasReais(pos, null, 20);
  // a aresta "oposta ao vértice s" liga os outros dois vértices do triângulo
  assert.equal(m[0 * 3 + 1] + m[1 * 3 + 2], 0); // diagonal (0,0)-(1,1), nos dois triângulos: coplanar, não é aresta
  assert.equal(m[0 * 3 + 2], 1);              // borda livre (0,0)-(1,0)
  assert.equal(m[0 * 3 + 0] + m[2 * 3 + 1], 2); // dobra x=1 entre a face e a aba: aresta nos dois lados
});

test('casca: juntar as 10 malhas preserva os 3.500 triângulos e a opacidade de cada peça', async () => {
  const { malhas } = await glb('assets/models/casa-exemplo.glb');
  const lista = Object.entries(malhas).map(([nome, m]) => ({ nome, pos: m.pos, idx: m.idx }));
  const op = { cobertura: 0.025, paredes: 0.1, piso: 0.045, piscina: 0.3, muros: 0.04, deck: 0.05, pilares: 0.08, portas: 0.06, janelas: 0.06, gradil: 0.04 };
  const j = juntarCasca(lista, { opacidades: op });
  assert.equal(j.pos.length / 9, 3500);
  assert.equal(Object.values(j.triangulos).reduce((a, b) => a + b, 0), 3500);
  let i = 0;
  for (const m of lista) { const n = (m.idx ? m.idx.length : m.pos.length / 3); assert.ok(Math.abs(j.cor[i * 4 + 3] - op[m.nome]) < 1e-6, m.nome); i += n; }
  assert.ok(j.linhas.pos.length > 0);
});

test('páginas: maquetes V03 com ?v de cada arquivo = início do SHA-256 do próprio arquivo', async () => {
  for (const { pagina: p, config } of PAGINAS_V03) {
    const html = await texto(p);
    const refs = [...html.matchAll(/data-(glb|meta)(-aco|-casca)?="\.\.\/\.\.\/(assets\/models\/[^"?]+)\?v=([0-9a-f]{7})"/g)];
    assert.ok(refs.length >= 2, p);
    // cada URL leva o hash do PRÓPRIO arquivo: se só o JSON mudar, a URL dele muda e o cache não serve o JSON velho
    for (const r of refs) {
      const h = MODELOS[r[3]] ?? createHash('sha256').update(await ler(r[3])).digest('hex');
      assert.equal(r[4], h.slice(0, 7), `${p}: ${r[3]}`);
    }
    assert.match(html, new RegExp(String.raw`assets/js/maquetes/${config}\.mjs\?v=\d+`));
    for (const m of html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)) assert.doesNotMatch(m[1], /https?:/);
  }
});

test('publicação: tudo o que as maquetes V03 carregam está na allowlist', async () => {
  const allow = new Set((await texto('.github/pages/allowlist.txt')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
  const precisa = ['assets/js/maquetes/motor.mjs', 'assets/js/maquetes/enquadrar.mjs', 'assets/js/maquetes/dados.mjs', ...PAGINAS_V03.map((c) => `assets/js/maquetes/${c.config}.mjs`), 'assets/css/maquete-v03.css',
    'assets/models/casa-exemplo.glb', 'assets/models/hidrantes-luiz-carlos-casca.glb', 'assets/css/maquete-incendio-v03.css',
    'assets/js/maquetes/terreno.mjs', 'assets/css/maquete-terraplanagem-v03.css', ...Object.keys(MODELOS)];
  for (const p of precisa) assert.ok(allow.has(p), p);
  // o motor carrega o Three só depois, por import() dinâmico, e só do próprio site
  const motor = await texto('assets/js/maquetes/motor.mjs');
  assert.doesNotMatch(motor, /^import .* from ['"]three/m);
  assert.match(motor, /await import\('three'\)/);
  assert.doesNotMatch(motor, /https?:\/\//);
  for (const f of ['motor', 'dados', 'enquadrar', 'terreno', ...PAGINAS_V03.map((c) => c.config)]) {   // nenhum import do código da calculadora (não é publicado)
    assert.doesNotMatch(await texto(`assets/js/maquetes/${f}.mjs`), /import[^;\n]*orcamento-src/);
  }
});

test('hidrossanitária: a legenda não traz a entrada genérica "Tubo" (a cor do tubo é a de cada rede, do IFC)', async () => {
  const cfg = await texto('assets/js/maquetes/hidro.mjs');
  assert.match(cfg, /semLegenda:\s*\['Tubo'\]/);
});

test('corte: a tampa só leva as peças que o plano atravessa, inteiras', () => {
  const faixas = [{ zmin: 0, zmax: 1, f0: 0, n: 2 }, { zmin: 2, zmax: 3, f0: 2, n: 1 }, { zmin: 0.5, zmax: 2.5, f0: 3, n: 1 }];
  const saida = new Uint32Array(12);
  assert.equal(verticesQueCruzam(faixas, 0.75, saida), 9);
  assert.deepEqual([...saida.subarray(0, 9)], [0, 1, 2, 3, 4, 5, 9, 10, 11]);
  assert.equal(verticesQueCruzam(faixas, 2.75, saida), 3);
  assert.deepEqual([...saida.subarray(0, 3)], [6, 7, 8]);
  assert.equal(verticesQueCruzam(faixas, 9, saida), 0);
});

test('corte no modelo real: a tampa do concreto fica bem abaixo do modelo inteiro', async () => {
  const { malhas } = await glb('assets/models/estrutura-concreto.glb');
  const meta = JSON.parse(await texto('assets/models/estrutura-concreto.json'));
  let total = 0; let tampa = 0;
  for (const [nome, m] of Object.entries(malhas)) {
    const els = meta.grupos[nome] || []; const cx = caixasDosElementos(m.pos, m.idx, els);
    const faixas = cx.map((c, i) => ({ zmin: c.min[2], zmax: c.max[2], f0: els[i][2], n: els[i][3] }));
    const zs = cx.map((c) => (c.min[2] + c.max[2]) / 2).sort((a, b) => a - b); const z = zs[zs.length >> 1];
    total += els.reduce((s, e) => s + e[3], 0) * 3; tampa += verticesQueCruzam(faixas, z, new Uint32Array(m.pos.length));
  }
  assert.ok(tampa > 0 && tampa < total * 0.5, `${tampa} de ${total}`);
});

test('estrutural: a camada de fundações não afirma o tipo (decisão de 16/11/2026)', async () => {
  const cfg = await texto('assets/js/maquetes/estrutural.mjs');
  assert.match(cfg, /id: 'fundacoes', nome: 'Fundações', um: 'Fundação'/);
  assert.doesNotMatch(cfg, /Sapata/);
});

test('capa: imagem da própria maquete, leve, versionada pelo hash e publicada', async () => {
  const allow = new Set((await texto('.github/pages/allowlist.txt')).split(/\r?\n/).map((l) => l.trim()));
  for (const { pagina: pg, capa: img } of PAGINAS_V03) {
    const b = await ler(`assets/images/${img}`);
    assert.ok(b.length <= 80 * 1024, `${img}: ${b.length} bytes`);
    assert.equal(b.subarray(8, 12).toString('latin1'), 'WEBP');
    assert.ok(allow.has(`assets/images/${img}`), `${img} na allowlist`);
    const html = await texto(pg);
    const m = html.match(new RegExp(String.raw`<img class="capa" src="\.\./\.\./assets/images/${img}\?v=([0-9a-f]{7})" alt="" width="\d+" height="\d+"`));
    assert.ok(m, `${pg}: capa dentro da caixa`);
    assert.doesNotMatch(html.match(/<img class="capa"[^>]*>/)[0], /fetchpriority="low"/, `${pg}: capa na área inicial sem prioridade baixa`);
    assert.equal(m[1], createHash('sha256').update(b).digest('hex').slice(0, 7));
  }
});

// ---- acessibilidade da tela cheia (auditoria Modern Web Guidance de 16/11/2026: A01, A02, A03, A05) ----
// O DOM de teste não existe aqui; as regras recebem objetos com a mesma forma dos elementos.
const no = (tagName, filhos = [], extra = {}) => {
  const n = { tagName, children: filhos, parentElement: null, inert: false, hidden: false, isConnected: true, ...extra };
  for (const f of filhos) f.parentElement = n;
  n.closest = (sel) => { for (let x = n; x; x = x.parentElement) if (sel === '[hidden]' ? x.hidden : sel === '[data-sem-webgl]' ? x.semWebgl : false) return x; return null; };
  return n;
};

test('A02: maquete aberta deixa inerte só o que está fora dela, e desfaz exatamente isso', () => {
  const caixa = no('DIV'); const cartao = no('P'); const legenda = no('P');
  const coluna = no('DIV', [cartao, caixa, legenda]); const aside = no('ASIDE');
  const main = no('MAIN', [coluna, aside]); const header = no('HEADER'); const footer = no('FOOTER', [], { inert: true }); const script = no('SCRIPT');
  const body = no('BODY', [header, main, footer, script]); no('HTML', [body]);
  const desfazer = isolarFundo(caixa);
  assert.deepEqual([cartao, legenda, aside, header].map((n) => n.inert), [true, true, true, true]);
  assert.deepEqual([caixa, coluna, main, body, script].map((n) => n.inert), [false, false, false, false, false]);
  desfazer();
  assert.deepEqual([cartao, legenda, aside, header, caixa].map((n) => n.inert), [false, false, false, false, false]);
  assert.equal(footer.inert, true, 'o que já estava inerte continua inerte');
});

test('A01: ao fechar, o foco volta a quem abriu; se ele sumiu ou está escondido, volta à caixa', () => {
  const caixa = no('DIV'); const cartao = no('BUTTON');
  assert.equal(focoDeVolta(cartao, caixa), cartao);
  assert.equal(focoDeVolta(null, caixa), caixa);
  assert.equal(focoDeVolta(no('BUTTON', [], { isConnected: false }), caixa), caixa);
  const escondido = no('BUTTON'); no('P', [escondido], { hidden: true });
  assert.equal(focoDeVolta(escondido, caixa), caixa);
});

test('A03: a caixa fechada só gira na apresentação inicial (movimento todo abaixo de 5 s), nunca com movimento reduzido nem depois de parada', () => {
  assert.ok(APRESENTACAO_MS + 600 <= 5000, 'janela do giro + desaceleração da câmera (~0,5 s medidos) cabem em 5 s');
  assert.equal(giroFechado(0, { reduz: false, girar: true }), true);
  assert.equal(giroFechado(APRESENTACAO_MS - 1, { reduz: false, girar: true }), true);
  assert.equal(giroFechado(APRESENTACAO_MS, { reduz: false, girar: true }), false);
  assert.equal(giroFechado(1000, { reduz: true, girar: true }), false);
  assert.equal(giroFechado(1000, { reduz: false, girar: false }), false);
  assert.equal(giroFechado(null, { reduz: false, girar: true }), false, 'antes da montagem, parada');
});

test('A05: sem WebGL, o cartão dá lugar ao texto do mezanino (fechado) e nenhum atalho fica na página', () => {
  let trocadoPor = null; const classes = new Set();
  const lugar = no('P', [], { semWebgl: true, replaceWith: (x) => { trocadoPor = x; } });
  const cartao = no('BUTTON'); cartao.parentElement = lugar; cartao.closest = (sel) => (sel === '[data-sem-webgl]' ? lugar : null);
  const outro = no('BUTTON');
  const painel = { hidden: true, open: true, classList: { add: (c) => classes.add(c) } };
  semMaqueteAtalhos([cartao, outro], painel);
  assert.equal(trocadoPor, painel); assert.equal(painel.hidden, false); assert.equal(painel.open, false); assert.ok(classes.has('sobre-pagina'));
  assert.equal(outro.hidden, true);
  const so = no('BUTTON'); semMaqueteAtalhos([so], null); assert.equal(so.hidden, true, 'sem painel de texto, o atalho só some');
});

test('motor: usa as regras de acessibilidade nos pontos certos', async () => {
  const motor = await texto('assets/js/maquetes/motor.mjs');
  assert.match(motor, /desfazerIsolamento = isolarFundo\(caixa\)/);
  assert.match(motor, /desfazerIsolamento\(\); desfazerIsolamento = null;[\s\S]{0,120}focoDeVolta\(origemEl, caixa\)\.focus\(\)/);
  assert.match(motor, /if \(!aberta\) controles\.autoRotate = giroFechado\(/);
  assert.doesNotMatch(motor, /controles\.autoRotate = !reduz; ajustar\(\)/, 'fechar não religa o giro');
  assert.match(motor, /semMaqueteAtalhos\(atalhos, \$\('sobre'\)\)/);
  const css = await texto('assets/css/maquete-v03.css');
  assert.match(css, /\.sobre\.sobre-pagina\{display:block/);
});

// ---- incêndio V03: casca do Colégio Luiz Carlos (planta 1:75 do projeto hidrossanitário, registrada no IFC) ----
const TERREO = 2.25;   // Térreo do IFC no sistema do GLB de hidrantes (o 0 do GLB é o tubo mais fundo)

// distância, em planta (x, z), de um ponto ao conjunto de triângulos do topo das paredes
function distanciaPlanta(tris, x, z) {
  let d = Infinity;
  const seg = (ax, az, bx, bz) => { const vx = bx - ax; const vz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(ax + t * vx - x, az + t * vz - z); };
  for (const [a, b, c] of tris) {
    const s1 = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]); const s2 = (c[0] - b[0]) * (z - b[1]) - (c[1] - b[1]) * (x - b[0]); const s3 = (a[0] - c[0]) * (z - c[1]) - (a[1] - c[1]) * (x - c[0]);
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return 0;
    d = Math.min(d, seg(...a, ...b), seg(...b, ...c), seg(...c, ...a));
  }
  return d;
}

test('incêndio: casca nas cotas do IFC (Térreo 0,00 e calha 5,53) e com os abrigos de hidrante encostados nas paredes', async () => {
  const { malhas, tamanho } = await glb('assets/models/hidrantes-luiz-carlos-casca.glb');
  assert.ok(tamanho <= 400 * 1024, `${tamanho} bytes`);
  assert.deepEqual(Object.keys(malhas).sort(), ['cobertura', 'contorno', 'paredes']);
  for (const m of Object.values(malhas)) assert.equal(m.trs, false, 'sem transformação de nó: a casca já está no sistema do GLB de hidrantes');
  const ys = (m) => { let lo = Infinity; let hi = -Infinity; for (let i = 1; i < m.pos.length; i += 3) { lo = Math.min(lo, m.pos[i]); hi = Math.max(hi, m.pos[i]); } return [lo, hi]; };
  const [p0, p1] = ys(malhas.paredes); assert.ok(Math.abs(p0 - TERREO) < 1e-3 && Math.abs(p1 - (TERREO + 5.53)) < 1e-3, `${p0} ${p1}`);
  const [c0, c1] = ys(malhas.cobertura); assert.ok(Math.abs(c0 - (TERREO + 5.53)) < 1e-3 && Math.abs(c1 - c0) < 1e-6);
  const [k0, k1] = ys(malhas.contorno); assert.ok(Math.abs(k0 - TERREO) < 1e-3 && k1 - k0 < 0.1, 'muro, meio-fio e calçada ficam no chão: altura não documentada');
  // registro: os abrigos que caem no térreo desenhado encostam nas paredes lidas da planta
  const P = malhas.paredes.pos; const topo = [];
  for (let i = 0; i < P.length; i += 9) if ([1, 4, 7].every((k) => Math.abs(P[i + k] - p1) < 1e-4)) topo.push([[P[i], P[i + 2]], [P[i + 3], P[i + 5]], [P[i + 6], P[i + 8]]]);
  const meta = JSON.parse(await texto('assets/models/hidrantes-luiz-carlos-v02.json'));
  const abrigo = Object.fromEntries(meta.grupos.hidrantes.map((e) => [e[5], e[6]]));
  for (const [id, lim] of [['H050', 0.1], ['H051', 0.1], ['H049', 0.5]]) {
    const d = distanciaPlanta(topo, abrigo[id][0], abrigo[id][2]);
    assert.ok(d <= lim, `${id}: ${d.toFixed(3)} m da parede`);
  }
});

test('incêndio: configuração com as cotas do IFC, os textos da V02 e os 171 componentes na lista', async () => {
  const cfg = await texto('assets/js/maquetes/incendio.mjs');
  assert.match(cfg, /const TERREO = 2\.25;/);
  assert.match(cfg, /nivelChao: TERREO/);
  for (const [nome, cota] of [['Térreo', '0.0'], ['Pavimento 1', '5.53'], ['Cobertura', '8.83']]) assert.ok(cfg.includes(`nome: '${nome}', y: TERREO + ${cota} }`), nome);
  assert.match(cfg, /sub: '171 componentes · materiais e equipamentos refinados'/);
  assert.match(cfg, /dica: 'Colégio Luiz Carlos · Selecione uma peça para ver sua identificação\.'/);
  assert.match(cfg, /componentes: \(\) => true/);
  const meta = JSON.parse(await texto('assets/models/hidrantes-luiz-carlos-v02.json'));
  assert.equal(Object.values(meta.grupos).reduce((n, g) => n + g.length, 0), 171);
  const html = await texto('servicos/projeto-prevencao-incendio/index.html');
  assert.match(html, /<summary>Materiais e representação<\/summary>/);
  assert.match(html, /Bombas, abrigos e outros equipamentos usam complementos ilustrativos genéricos, identificados por peça\./);
  assert.match(html, /<div class="ficha" id="ficha" role="status" aria-live="polite" hidden><\/div>/);
  assert.doesNotMatch(html, /hidrantes-luiz-carlos-ativar\.js/, 'a V02 sai da página (os arquivos ficam no site para reversão)');
});

test('motor: recursos da maquete de incêndio só pela configuração (inclusive as correções de oclusão e de foco da ficha)', async () => {
  const motor = await texto('assets/js/maquetes/motor.mjs');
  assert.match(motor, /-\(cfg\.nivelChao \|\| 0\)/);
  assert.match(motor, /if \(cfg\.guias && G\[cfg\.guias\.camada\] && meta\.eixos_tubos\) montarGuia/);
  assert.match(motor, /if \(!sel \|\| !cfg\.componentes\) return;/);
  assert.match(motor, /if \(cfg\.fichaCompleta\)/);
  assert.match(motor, /const podeAO = aberta && composer && p >= 1 && !raioX && !\(cfg\.fichaCompleta && escolhido\);/);
  assert.match(motor, /const naFicha = cfg\.fichaCompleta && ficha\.contains/);
  for (const f of ['estrutural', 'hidro']) {
    const c = await texto(`assets/js/maquetes/${f}.mjs`);
    assert.doesNotMatch(c, /guias:|componentes:|marcadores:|fichaCompleta|nivelChao/, `${f}: comportamento inalterado`);
  }
});

// ---- terraplanagem V03 (17/11/2026): GLB V5 intacto; transformação, curvas e seção saem das duas superfícies dele ----
const TERRA_GLB = 'assets/models/terraplanagem-djalma.glb';
// cota de uma superfície da grade de 2 m num ponto (x, z), por interpolação no quadrado da grade
function cotaNaGrade(pos) {
  const k = (x, z) => `${Math.round(x * 100)},${Math.round(z * 100)}`; const h = new Map(); let x0 = Infinity; let z0 = Infinity;
  for (let i = 0; i < pos.length; i += 3) { h.set(k(pos[i], pos[i + 2]), pos[i + 1]); x0 = Math.min(x0, pos[i]); z0 = Math.min(z0, pos[i + 2]); }
  return (x, z) => {
    const i = Math.floor((x - x0) / 2 + 1e-6); const j = Math.floor((z - z0) / 2 + 1e-6); const fx = (x - x0) / 2 - i; const fz = (z - z0) / 2 - j;
    const v = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, c]) => h.get(k(x0 + 2 * (i + a), z0 + 2 * (j + c))));
    if (v.some((y) => y === undefined)) return null;
    return v[0] * (1 - fx) * (1 - fz) + v[1] * (1 - fx) * fz + v[2] * fx * (1 - fz) + v[3] * fx * fz;
  };
}

test('terraplanagem: as duas superfícies do GLB têm a mesma planta e só a cota muda (de -2,50 a +2,85 m)', async () => {
  const { malhas } = await glb(TERRA_GLB); const n = malhas.TERRENO_NATURAL; const f = malhas.TERRENO_FINAL;
  assert.deepEqual([...n.idx], [...f.idx]);
  let xz = 0; let dmin = 0; let dmax = 0;
  for (let i = 0; i < n.pos.length; i += 3) {
    xz = Math.max(xz, Math.abs(n.pos[i] - f.pos[i]), Math.abs(n.pos[i + 2] - f.pos[i + 2]));
    const d = f.pos[i + 1] - n.pos[i + 1]; dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
  }
  assert.equal(xz, 0);
  assert.deepEqual([dmin.toFixed(2), dmax.toFixed(2)], ['-2.50', '2.85']);
});

test('terraplanagem: os prismas de corte e aterro ficam entre as duas superfícies (a transformação os revela sem invadir o terreno)', async () => {
  const { malhas } = await glb(TERRA_GLB);
  const nat = cotaNaGrade(malhas.TERRENO_NATURAL.pos); const fin = cotaNaGrade(malhas.TERRENO_FINAL.pos);
  for (const nome of ['VOLUME_CORTE', 'VOLUME_ATERRO']) {
    const P = malhas[nome].pos; let sobre = 0;
    for (let i = 0; i < P.length; i += 3) {
      const a = nat(P[i], P[i + 2]); const b = fin(P[i], P[i + 2]);
      if (a !== null && (Math.abs(P[i + 1] - a) < 0.15 || Math.abs(P[i + 1] - b) < 0.15)) sobre += 1;
    }
    assert.ok(sobre / (P.length / 3) >= 0.95, `${nome}: ${(100 * sobre / (P.length / 3)).toFixed(1)}% dos vértices numa das superfícies`);
  }
});

test('terraplanagem: o bloco do terreno é fechado, com as faces para fora (a tampa da seção depende disso)', async () => {
  const { malhas } = await glb(TERRA_GLB); const n = malhas.TERRENO_NATURAL;
  let ymin = Infinity; for (let i = 1; i < n.pos.length; i += 3) ymin = Math.min(ymin, n.pos[i]);
  const b = blocoTerreno(n.pos, n.idx, ymin - 1);
  assert.equal(b.facesTopo, 9046); assert.equal(b.faces, 2 * 9046 + 2 * b.paredes);
  const k = (i) => `${b.pos[i * 3].toFixed(3)},${b.pos[i * 3 + 1].toFixed(3)},${b.pos[i * 3 + 2].toFixed(3)}`;
  const arestas = new Map();
  for (let t = 0; t < b.idx.length; t += 3) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) { const c = `${k(b.idx[t + u])}>${k(b.idx[t + v])}`; arestas.set(c, (arestas.get(c) || 0) + 1); }
  for (const [c, q] of arestas) {
    assert.equal(q, 1, `aresta repetida no mesmo sentido: ${c}`);
    const [a, d] = c.split('>'); assert.equal(arestas.get(`${d}>${a}`), 1, `aresta sem par: ${c}`);
  }
  assert.ok([...b.tipo].every((t, v) => (t <= 1) === (b.origem[v] >= 0)), 'só o topo e o alto das paredes acompanham o terreno');
});

test('terraplanagem: as curvas de nível do terreno natural ficam nas cotas inteiras', async () => {
  const { malhas } = await glb(TERRA_GLB); const n = malhas.TERRENO_NATURAL;
  const c = curvasDeNivel(n.pos, n.idx, 1, 0.06);
  assert.ok(c.length / 6 > 1000, `${c.length / 6} trechos`);
  for (let i = 1; i < c.length; i += 3) assert.ok(Math.abs(c[i] - 0.06 - Math.round(c[i] - 0.06)) < 1e-4);
});

test('terraplanagem: a linha passa por todo o terreno; a cor da terra só muda onde a cota muda', () => {
  assert.equal(fatorLinha(-80, linhaDe(0, -88.91, 75.09, 8), 8), 0, 'no início, nada mudou');
  assert.equal(fatorLinha(75.09, linhaDe(1, -88.91, 75.09, 8), 8), 1, 'no fim, até a borda da frente chegou à cota final');
  assert.deepEqual(corTerreno(0, 1), TERRA, 'sem diferença de cota, a cor é a da terra (decisão de 02/11/2026)');
  assert.deepEqual(corTerreno(-2, 0), TERRA, 'antes de a linha passar, a cor é a da terra');
  const c = corTerreno(-2, 1); const a = corTerreno(2, 1);
  assert.ok(c[0] > TERRA[0] && c[2] < TERRA[2], 'corte puxa para o laranja');
  assert.ok(a[1] > TERRA[1] && a[0] < TERRA[0], 'aterro puxa para o verde');
});

test('terraplanagem: seção com corte onde o natural fica acima e aterro onde o atual fica acima', () => {
  const pos = new Float32Array([0, 0, 0, 2, 0, 0, 0, 0, 2, 2, 0, 2]); const idx = new Uint32Array([0, 2, 1, 1, 2, 3]);
  const nat = new Float32Array([1, 1, 1, 1]);
  assert.equal(secao(pos, idx, nat, nat, 1).tris.length, 0, 'sem terraplanagem, nada entre os perfis');
  assert.ok([...secao(pos, idx, nat, new Float32Array([0, 0, 0, 0]), 1).sinal].every((s) => s === -1), 'só corte');
  assert.ok([...secao(pos, idx, nat, new Float32Array([2, 2, 2, 2]), 1).sinal].every((s) => s === 1), 'só aterro');
  assert.deepEqual(new Set(secao(pos, idx, nat, new Float32Array([0, 2, 0, 2]), 1).sinal), new Set([-1, 1]), 'corta de um lado e aterra do outro');
});

test('terraplanagem: página, configuração e ficha (texto da V5, nenhum volume, motor só pela configuração)', async () => {
  const cfg = await texto('assets/js/maquetes/terraplanagem.mjs');
  assert.match(cfg, /exagero: 2,/);
  assert.match(cfg, /montagemMs: 4200,/, 'caixa fechada: a montagem cabe em 5 s');
  assert.match(cfg, /sub: 'Terraplanagem de um colégio, em 3D · ilustrativo · relevo exagerado 2 vezes'/);
  for (const id of ['VOLUME_CORTE', 'VOLUME_ATERRO']) assert.match(cfg, new RegExp(`id: '${id}'[^\\n]*semTampa: true`));
  const meta = JSON.parse(await texto('assets/models/terraplanagem-djalma-v03.json'));
  const { malhas } = await glb(TERRA_GLB);
  for (const [g, els] of Object.entries(meta.grupos)) { assert.equal(els.length, 1, g); assert.equal(els[0][2], 0); assert.equal(els[0][3], malhas[g].idx.length / 3, g); }
  const markup = await texto('docs/arquivo/paginas-servico-v02/maquete-terraplanagem-v03-markup.html');
  for (const t of [markup, JSON.stringify(meta)]) { assert.doesNotMatch(t, /\d\s*m³|\d\s*m3\b/, 'a maquete não mostra volume'); assert.doesNotMatch(t, /terraplenagem/i); }
  const html = await texto('servicos/projeto-terraplenagem/index.html');
  assert.ok(html.includes(markup.trim().split('\n')[1].trim()), 'a página vem do markup V03, pelo gerador');
  assert.doesNotMatch(html, /maquete-terraplanagem-3d\.js/, 'a V5 sai da página');
  for (const f of ['assets/js/maquete-terraplanagem-3d.js', 'assets/models/terraplanagem-djalma.json', 'docs/arquivo/paginas-servico-v02/maquete-terraplanagem-markup.html']) await ler(f);   // ficam para reversão
  const motor = await texto('assets/js/maquetes/motor.mjs');
  for (const g of ['antesDeMontar', 'aposMontar', 'aplicar']) assert.match(motor, new RegExp(`cfg\\.extensao\\?\\.${g}\\?\\.`));
  for (const f of ['estrutural', 'hidro', 'incendio']) {
    assert.doesNotMatch(await texto(`assets/js/maquetes/${f}.mjs`), /extensao|exagero|montagem(Aberta)?Ms|semTampa|semRealce|textoPorDentro|vistas:|tampa:|brilhoVertice/, `${f}: comportamento inalterado`);
  }
});

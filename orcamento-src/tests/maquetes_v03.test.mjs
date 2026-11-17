// Maquetes V03 das páginas de serviço (estrutural e hidrossanitária): integridade dos modelos, dados derivados,
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
};

// Páginas com maquete V03: página, capa e módulo de configuração em assets/js/maquetes/.
const PAGINAS_V03 = [
  { pagina: 'servicos/projeto-estrutural/index.html', capa: 'maquete-estrutura-capa.webp', config: 'estrutural' },
  { pagina: 'servicos/projeto-hidrossanitario/index.html', capa: 'maquete-hidro-capa.webp', config: 'hidro' },
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
    'assets/models/casa-exemplo.glb', ...Object.keys(MODELOS)];
  for (const p of precisa) assert.ok(allow.has(p), p);
  // o motor carrega o Three só depois, por import() dinâmico, e só do próprio site
  const motor = await texto('assets/js/maquetes/motor.mjs');
  assert.doesNotMatch(motor, /^import .* from ['"]three/m);
  assert.match(motor, /await import\('three'\)/);
  assert.doesNotMatch(motor, /https?:\/\//);
  for (const f of ['motor', 'dados', 'enquadrar', ...PAGINAS_V03.map((c) => c.config)]) {   // nenhum import do código da calculadora (não é publicado)
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

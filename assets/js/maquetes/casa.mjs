// Funções puras da maquete de arquitetura (sem three.js; testadas em orcamento-src/tests/maquetes_v03.test.mjs).
// Tudo sai da geometria de casa-exemplo.glb, que não muda: as peças de cada camada, a separação dos vidros das
// janelas e os degraus do solo sob o lote. Nenhum nome de ambiente, pavimento ou material vem daqui.

const vert = (idx, t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);

// Peças de uma malha: trechos contíguos de faces que pertencem à mesma peça conexa (vértices na mesma posição).
// O motor acha a peça clicada pelo índice da face, então cada peça precisa ser um trecho contíguo.
export function pecas(pos, idx) {
  const nTri = idx ? idx.length / 3 : pos.length / 9;
  const pai = Int32Array.from({ length: nTri }, (_, t) => t);
  const raiz = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
  const dono = new Map();
  for (let t = 0; t < nTri; t += 1) {
    for (let k = 0; k < 3; k += 1) {
      const v = vert(idx, t, k) * 3;
      const chave = `${Math.round(pos[v] * 1000)},${Math.round(pos[v + 1] * 1000)},${Math.round(pos[v + 2] * 1000)}`;
      const d = dono.get(chave);
      if (d === undefined) dono.set(chave, t); else { const a = raiz(d); const b = raiz(t); if (a !== b) pai[a] = b; }
    }
  }
  const out = [];
  for (let t = 0; t < nTri; t += 1) {
    const r = raiz(t); let p = out[out.length - 1];
    if (!p || p.r !== r) { p = { r, ini: t, n: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; out.push(p); }
    p.n += 1;
    for (let k = 0; k < 3; k += 1) {
      const v = vert(idx, t, k) * 3;
      for (let e = 0; e < 3; e += 1) { p.min[e] = Math.min(p.min[e], pos[v + e]); p.max[e] = Math.max(p.max[e], pos[v + e]); }
    }
  }
  return out.map(({ ini, n, min, max }) => ({ ini, n, min, max }));
}

const cruzam = (a, b, folga = 0.01) => [0, 1, 2].every((e) => a.min[e] <= b.max[e] + folga && b.min[e] <= a.max[e] + folga);
// Junta peças vizinhas na ordem das faces cujas caixas se cruzam ou ficam a menos de `folga` m (nas portas do modelo,
// as guarnições dos dois lados da parede e a folha: as guarnições ficam a uma espessura de parede uma da outra).
export function juntarVizinhas(lista, folga = 0.01) {
  const out = [];
  for (const p of lista) {
    const u = out[out.length - 1];
    if (u && u.ini + u.n === p.ini && cruzam(u, p, folga)) {
      u.n += p.n; for (let e = 0; e < 3; e += 1) { u.min[e] = Math.min(u.min[e], p.min[e]); u.max[e] = Math.max(u.max[e], p.max[e]); }
    } else out.push({ ini: p.ini, n: p.n, min: [...p.min], max: [...p.max] });
  }
  return out;
}

// Separa as peças planas (espessura abaixo de `espessura`, em metros) das demais: nas janelas do modelo, o painel
// de espessura zero é o vidro e a peça com volume é o caixilho. Devolve duas listas de faces (posições sem índice),
// cada uma na ordem original, com as peças de cada lado.
export function separarPlanas(pos, idx, lista, espessura = 0.02) {
  const lados = { solidas: [], planas: [] };
  for (const p of lista) {
    const fina = Math.min(p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]) < espessura;
    lados[fina ? 'planas' : 'solidas'].push(p);
  }
  const montar = (sel) => {
    const n = sel.reduce((a, p) => a + p.n, 0); const out = new Float32Array(n * 9); const novas = []; let f = 0;
    for (const p of sel) {
      novas.push({ ini: f, n: p.n, min: p.min, max: p.max });
      for (let t = p.ini; t < p.ini + p.n; t += 1, f += 1) for (let k = 0; k < 3; k += 1) out.set(pos.subarray(vert(idx, t, k) * 3, vert(idx, t, k) * 3 + 3), (f * 3 + k) * 3);
    }
    return { pos: out, pecas: novas };
  };
  return { solidas: montar(lados.solidas), planas: montar(lados.planas) };
}

const m2 = (v) => v.toFixed(2).replace('.', ',');
// Medida de uma esquadria no modelo: largura (o maior lado em planta) × altura, da caixa da própria peça.
export function medida(p) {
  const larg = Math.max(p.max[0] - p.min[0], p.max[2] - p.min[2]); const alt = p.max[1] - p.min[1];
  return `${m2(larg)} × ${m2(alt)} m`;
}

// Degraus do solo sob o lote, tirados da base dos muros (o modelo não tem terreno): para cada faixa de `faixa` m ao
// longo de z, a cota mais baixa dos muros; faixas vizinhas com a mesma cota (até `tol`) viram um degrau só.
// É o comportamento da maquete publicada (maquete-3d.js), agora testado.
export function degrausDoSolo(pos, { faixa = 1.5, tol = 0.15, margem = 3 } = {}) {
  const perfil = new Map(); let xmin = Infinity; let xmax = -Infinity; let zmin = Infinity; let zmax = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]; const y = pos[i + 1]; const z = pos[i + 2]; const k = Math.floor(z / faixa);
    perfil.set(k, Math.min(perfil.get(k) ?? Infinity, y));
    xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
  }
  if (!perfil.size) return null;
  const chaves = [...perfil.keys()].sort((a, b) => a - b); const degraus = [];
  let y = perfil.get(chaves[0]);
  for (let k = chaves[0]; k <= chaves[chaves.length - 1]; k += 1) {
    const v = perfil.get(k) ?? y; const d = degraus[degraus.length - 1];
    if (d && Math.abs(v - d.y) < tol) { d.z1 = (k + 1) * faixa; d.n += 1; d.soma += v; d.y = d.soma / d.n; } else degraus.push({ z0: k * faixa, z1: (k + 1) * faixa, y: v, n: 1, soma: v });
    y = v;
  }
  degraus[0].z0 = zmin - margem; degraus[degraus.length - 1].z1 = zmax + margem;
  return { degraus: degraus.map(({ z0, z1, y: yy }) => ({ z0, z1, y: yy })), x0: xmin - margem, x1: xmax + margem };
}

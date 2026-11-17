// Funções puras da maquete de terraplanagem (sem three.js; testadas em Node em orcamento-src/tests/maquetes_v03.test.mjs).
// O GLB terraplanagem-djalma.glb (V5) traz o terreno natural e o terraplanado como duas malhas com os MESMOS vértices
// em planta (mesmo x e z, na mesma ordem) e os mesmos índices: só a cota muda. Tudo aqui sai dessas duas malhas;
// nenhuma cota, volume ou característica construtiva é acrescentada.

const lim = (t) => Math.max(0, Math.min(1, t));
const suave = (t) => { const u = lim(t); return u * u * (3 - 2 * u); };

// Bloco fechado de terreno, como numa maquete de mesa: o topo é a superfície do GLB (triângulos virados para cima),
// as paredes descem de cada aresta da borda até a base e o fundo repete o topo, virado para baixo. Fechado, o bloco
// deixa a tampa do corte (stencil) do motor desenhar a seção do solo.
// Devolve as posições e índices do bloco, de onde veio cada vértice (origem: vértice do topo; -1 = na base),
// o tipo (0 topo, 1 parede no alto, 2 parede na base, 3 fundo) e as contagens de faces.
export function blocoTerreno(pos, idx, base) {
  const n = pos.length / 3; const nt = idx.length / 3;
  const P = Array.from(pos); const origem = Array.from({ length: n }, (_, i) => i); const tipo = new Array(n).fill(0);
  const I = []; const tris = [];
  for (let t = 0; t < nt; t += 1) {
    const a = idx[t * 3]; let b = idx[t * 3 + 1]; let c = idx[t * 3 + 2];
    const ny = (pos[b * 3 + 2] - pos[a * 3 + 2]) * (pos[c * 3] - pos[a * 3]) - (pos[b * 3] - pos[a * 3]) * (pos[c * 3 + 2] - pos[a * 3 + 2]);
    if (ny < 0) [b, c] = [c, b];   // todos para cima: o bloco precisa de faces com o mesmo sentido
    tris.push([a, b, c]); I.push(a, b, c);
  }
  // fundo: os mesmos triângulos na cota da base, virados para baixo
  for (let i = 0; i < n; i += 1) { P.push(pos[i * 3], base, pos[i * 3 + 2]); origem.push(-1); tipo.push(3); }
  for (const [a, b, c] of tris) I.push(n + a, n + c, n + b);
  // paredes: arestas usadas por um só triângulo do topo
  const uso = new Map(); const chave = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) uso.set(chave(u, v), (uso.get(chave(u, v)) || 0) + 1);
  let paredes = 0;
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) {
    if (uso.get(chave(u, v)) !== 1) continue;
    // u -> v no sentido do triângulo virado para cima: o lado de fora fica à direita; (A, B', B) e (A, A', B') olham para fora
    const k = P.length / 3;
    P.push(pos[u * 3], pos[u * 3 + 1], pos[u * 3 + 2], pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], pos[v * 3], base, pos[v * 3 + 2], pos[u * 3], base, pos[u * 3 + 2]);
    origem.push(u, v, -1, -1); tipo.push(1, 1, 2, 2);
    I.push(k, k + 2, k + 1, k, k + 3, k + 2); paredes += 1;
  }
  return { pos: new Float32Array(P), idx: new Uint32Array(I), origem: new Int32Array(origem), tipo: new Uint8Array(tipo), facesTopo: nt, faces: I.length / 3, paredes };
}

// Curvas de nível de uma superfície triangulada, a cada `passo` metros de cota; `acima` levanta a linha (evita que ela
// pisque sobre a própria superfície). Devolve pares de pontos (x, y, z) para LineSegments.
export function curvasDeNivel(pos, idx, passo = 1, acima = 0) {
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const ys = v.map((p) => p[1]); const lo = Math.ceil(Math.min(...ys) / passo); const hi = Math.floor(Math.max(...ys) / passo);
    for (let k = lo; k <= hi; k += 1) {
      const L = k * passo; const pts = [];
      for (const [p, q] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]]) {
        const a = p[1] - L; const b = q[1] - L;
        if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) { const s = a / (a - b); pts.push([p[0] + s * (q[0] - p[0]), L + acima, p[2] + s * (q[2] - p[2])]); }
      }
      if (pts.length === 2) out.push(...pts[0], ...pts[1]);
    }
  }
  return new Float32Array(out);
}

// Avanço da linha que desce sobre o terreno (0 a 1) -> posição z da linha. Em 0 nada mudou; em 1 tudo passou.
export const linhaDe = (s, zmin, zmax, faixa) => zmin + s * (zmax - zmin + faixa);
// Quanto um ponto em z já se transformou, com a linha em zl: atrás da linha (z menor) o terreno chega à cota final
// numa faixa de `faixa` metros, para a terra descer e subir à vista, sem salto.
export const fatorLinha = (z, zl, faixa) => suave((zl - z) / faixa);

// Cores: escritas em sRGB (as da V5 e da legenda) e passadas a linear, que é como o three.js lê a cor por vértice.
// Sem a conversão a terra sai bege-clara e o laranja do corte quase some (visto na primeira captura de 17/11/2026).
export const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (rgb) => rgb.map(linear);
// Cor do terreno: a terra natural fica com a mesma cor (decisão de Marcos de 02/11/2026); onde a cota baixa (corte)
// a cor vai para o laranja, e onde sobe (aterro), para o verde, mais forte onde a diferença é maior. Sem número.
export const TERRA = lin([0.59, 0.5, 0.38]);
export const CORTE = lin([0.91, 0.49, 0.13]);
export const ATERRO = lin([0.18, 0.63, 0.35]);
// Escreve em `out` a partir de `k` (para não criar um vetor por vértice a cada quadro) e devolve `out`.
export function corTerreno(dz, t, out = [0, 0, 0], k = 0) {
  const m = Math.abs(dz);
  const a = m < 0.05 || t <= 0 ? 0 : t * (0.62 + 0.38 * lim(m / 1.5));
  const alvo = dz < 0 ? CORTE : ATERRO;
  for (let i = 0; i < 3; i += 1) out[k + i] = TERRA[i] + (alvo[i] - TERRA[i]) * a;
  return out;
}

// Seção do terreno num plano z = zl: em cada triângulo do topo, o trecho do terreno natural e o do terreno atual
// (mesmos x, porque a planta é a mesma) e, entre os dois, o que foi cortado (natural acima) ou aterrado (atual acima).
// `nat` e `atual`: cota de cada vértice do topo. Devolve as linhas (x, y, x, y) e os triângulos com o sinal
// (-1 corte, +1 aterro), em coordenadas do modelo.
export function secao(pos, idx, nat, atual, zl) {
  const linhaN = []; const linhaA = []; const tris = []; const sinal = [];
  const quad = (x1, n1, c1, x2, n2, c2) => {
    const d1 = c1 - n1; const d2 = c2 - n2;
    if (Math.abs(d1) < 0.02 && Math.abs(d2) < 0.02) return;
    if (d1 * d2 >= 0) {
      const s = d1 + d2 < 0 ? -1 : 1;
      tris.push(x1, n1, x2, n2, x2, c2, x1, n1, x2, c2, x1, c1); sinal.push(s, s);
    } else {
      const t = d1 / (d1 - d2); const xm = x1 + t * (x2 - x1); const ym = n1 + t * (n2 - n1);
      tris.push(x1, n1, xm, ym, x1, c1, xm, ym, x2, n2, x2, c2); sinal.push(d1 < 0 ? -1 : 1, d2 < 0 ? -1 : 1);
    }
  };
  for (let t = 0; t < idx.length; t += 3) {
    const pts = [];
    for (const [u, v] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      const zu = pos[u * 3 + 2]; const zv = pos[v * 3 + 2];
      if ((zu < zl && zv >= zl) || (zu >= zl && zv < zl)) {
        const s = (zl - zu) / (zv - zu);
        pts.push([pos[u * 3] + s * (pos[v * 3] - pos[u * 3]), nat[u] + s * (nat[v] - nat[u]), atual[u] + s * (atual[v] - atual[u])]);
      }
    }
    if (pts.length !== 2) continue;
    const [[x1, n1, c1], [x2, n2, c2]] = pts[0][0] <= pts[1][0] ? pts : [pts[1], pts[0]];
    linhaN.push(x1, n1, x2, n2); linhaA.push(x1, c1, x2, c2); quad(x1, n1, c1, x2, n2, c2);
  }
  return { linhaN: new Float32Array(linhaN), linhaA: new Float32Array(linhaA), tris: new Float32Array(tris), sinal: new Int8Array(sinal) };
}

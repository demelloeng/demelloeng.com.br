// Leitura dos dados das maquetes das páginas de serviço. Funções PURAS (sem DOM e sem Three), testadas em Node
// (orcamento-src/tests/maquetes_v03.test.mjs). Nada aqui altera o modelo: só mede o que o GLB e o JSON já trazem.
//
// Convenções: pos = Float32Array com x,y,z por vértice; idx = índices (ou null, quando cada 3 vértices formam um triângulo);
// elementos = lista do JSON da maquete, [nome, iPavimento, primeiraFace, nFaces, detalhe?, ...].

const vert = (pos, idx, t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);

// Caixa {min,max} de cada elemento, pelas suas faces.
export function caixasDosElementos(pos, idx, elementos) {
  return elementos.map((el) => {
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (let t = el[2]; t < el[2] + el[3]; t += 1) {
      for (let k = 0; k < 3; k += 1) {
        const v = vert(pos, idx, t, k) * 3;
        for (let e = 0; e < 3; e += 1) { const x = pos[v + e]; if (x < min[e]) min[e] = x; if (x > max[e]) max[e] = x; }
      }
    }
    return { min, max };
  });
}

// União das caixas dos elementos cujo pavimento está em `pavs` (índices). null se nenhum.
export function uniao(caixas, elementos, pavs = null) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity]; let n = 0;
  caixas.forEach((c, i) => {
    if (pavs && !pavs.includes(elementos[i][1])) return;
    n += 1;
    for (let e = 0; e < 3; e += 1) { min[e] = Math.min(min[e], c.min[e]); max[e] = Math.max(max[e], c.max[e]); }
  });
  return n ? { min, max } : null;
}

// Nível de cada pavimento = topo das peças da camada indicada (ex.: lajes). Devolve [{pav, y}] em ordem de altura.
export function niveisPorTopo(caixas, elementos) {
  const topo = new Map();
  caixas.forEach((c, i) => { const p = elementos[i][1]; topo.set(p, Math.max(topo.get(p) ?? -Infinity, c.max[1])); });
  return [...topo.entries()].map(([pav, y]) => ({ pav, y })).sort((a, b) => a.y - b.y);
}

// Alturas de faces horizontais de uma malha, agrupadas (tolerância em metros). Devolve [{y, n}] em ordem de altura;
// y = a maior altura do grupo (a face de cima do piso).
export function alturasHorizontais(pos, idx, tolerancia = 0.3) {
  const nTri = idx ? idx.length / 3 : pos.length / 9; const ys = [];
  for (let t = 0; t < nTri; t += 1) {
    const a = vert(pos, idx, t, 0) * 3; const b = vert(pos, idx, t, 1) * 3; const c = vert(pos, idx, t, 2) * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nn = Math.hypot(nx, ny, nz);
    if (nn > 1e-9 && Math.abs(ny) > 0.99 * nn) ys.push((pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3);
  }
  ys.sort((p, q) => p - q);
  const grupos = [];
  for (const y of ys) {
    const g = grupos[grupos.length - 1];
    if (g && y - g.y <= tolerancia) { g.y = y; g.n += 1; } else grupos.push({ y, n: 1 });
  }
  return grupos;
}

// Nome curto do pavimento para rótulo e ficha. A ressalva entre parênteses do modelo NÃO se perde:
// "Nível 2 (≈ +3,00 — aproximado, não executivo)" -> { nome: 'Nível 2', ressalva: 'aproximado, não executivo' }.
const NOMES = { 'TÉRREO': 'Térreo', 'PAV SUPERIOR': 'Pavimento superior', COBERTURA: 'Cobertura', MURO: 'Muro',
  PERGOLADO_PISCINA: 'Piscina', TERREO: 'Térreo', LAJE_SUPERIOR: 'Laje superior' };
export function nomePavimento(bruto = '') {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(bruto);
  const base = (m ? m[1] : bruto).trim();
  const nome = NOMES[base] ?? base;
  if (!m) return { nome, ressalva: '' };
  const palavras = m[2].split('—').map((s) => s.trim()).filter((s) => /[a-zà-ú]/i.test(s) && !/^[≈±+\-\d,.\s]+$/.test(s));
  return { nome, ressalva: palavras.join(' · ') };
}

// Rótulos do modelo (meta.rotulos) sobre as camadas da configuração: ex. no aço, vigas -> "Treliças".
export function aplicarRotulos(camadas, rotulos = {}) {
  return camadas.map((k) => ({ ...k, ...(rotulos[k.id] || {}) }));
}

// Arestas REAIS de cada triângulo: borda livre ou dobra acima do ângulo-limite. A diagonal entre dois triângulos
// coplanares (a que divide a face de uma caixa) NÃO é aresta. Devolve Uint8Array(nTri*3): para o triângulo t,
// [t*3+0] = aresta oposta ao vértice 0 (v1-v2), [t*3+1] = oposta ao 1 (v2-v0), [t*3+2] = oposta ao 2 (v0-v1).
export function bordasReais(pos, idx, limiteGraus = 20) {
  const nTri = idx ? idx.length / 3 : pos.length / 9;
  const ids = new Map(); let proximo = 0;
  const idDe = (v) => {
    const k = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
    let i = ids.get(k); if (i === undefined) { i = proximo; proximo += 1; ids.set(k, i); } return i;
  };
  const vid = new Uint32Array(nTri * 3);
  for (let t = 0; t < nTri; t += 1) for (let k = 0; k < 3; k += 1) vid[t * 3 + k] = idDe(vert(pos, idx, t, k));
  const nor = new Float64Array(nTri * 3);
  for (let t = 0; t < nTri; t += 1) {
    const a = vert(pos, idx, t, 0) * 3; const b = vert(pos, idx, t, 1) * 3; const c = vert(pos, idx, t, 2) * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nn = Math.hypot(nx, ny, nz) || 1;
    nx /= nn; ny /= nn; nz /= nn; nor[t * 3] = nx; nor[t * 3 + 1] = ny; nor[t * 3 + 2] = nz;
  }
  const N = proximo + 1; const arestas = new Map();
  for (let t = 0; t < nTri; t += 1) {
    for (let s = 0; s < 3; s += 1) {
      const p = vid[t * 3 + ((s + 1) % 3)]; const q = vid[t * 3 + ((s + 2) % 3)];
      if (p === q) continue;
      const chave = p < q ? p * N + q : q * N + p;
      const lista = arestas.get(chave); if (lista) lista.push(t * 3 + s); else arestas.set(chave, [t * 3 + s]);
    }
  }
  const cosLim = Math.cos((limiteGraus * Math.PI) / 180);
  const mask = new Uint8Array(nTri * 3);
  for (const lista of arestas.values()) {
    if (lista.length === 1) { mask[lista[0]] = 1; continue; }
    for (let i = 0; i < lista.length; i += 1) {
      const ti = Math.floor(lista[i] / 3);
      for (let j = 0; j < lista.length; j += 1) {
        if (i === j) continue; const tj = Math.floor(lista[j] / 3);
        const c = nor[ti * 3] * nor[tj * 3] + nor[ti * 3 + 1] * nor[tj * 3 + 1] + nor[ti * 3 + 2] * nor[tj * 3 + 2];
        if (c < cosLim) { mask[lista[i]] = 1; break; }
      }
    }
  }
  return mask;
}

// Junta as malhas da casca (arquitetura transparente) numa malha só, com cor e opacidade POR VÉRTICE, e numa só
// lista de linhas (arestas reais, sem repetir). As faces e os triângulos não mudam: só são copiados em sequência.
// malhas = [{nome, pos, idx}], cada uma com a opacidade de `opacidades[nome]` (ou `padrao`); opacidade 0 = fora.
export function juntarCasca(malhas, { opacidades = {}, padrao = 0.1, cor = [0.81, 0.886, 0.965], cores = {}, fatorAresta = 3.5, corAresta = [0.75, 0.863, 0.969] } = {}) {
  const fp = []; const fc = []; const lp = []; const lc = []; const vistas = new Set(); const conta = {};
  for (const m of malhas) {
    const op = opacidades[m.nome] ?? padrao;
    if (!op) continue;
    const c = cores[m.nome] ?? cor; const nTri = m.idx ? m.idx.length / 3 : m.pos.length / 9;
    conta[m.nome] = nTri;
    for (let t = 0; t < nTri; t += 1) for (let k = 0; k < 3; k += 1) {
      const v = vert(m.pos, m.idx, t, k) * 3; fp.push(m.pos[v], m.pos[v + 1], m.pos[v + 2]); fc.push(c[0], c[1], c[2], op);
    }
    const mask = bordasReais(m.pos, m.idx, 30); const opA = Math.min(0.55, op * fatorAresta);
    for (let t = 0; t < nTri; t += 1) for (let s = 0; s < 3; s += 1) {
      if (!mask[t * 3 + s]) continue;
      const a = vert(m.pos, m.idx, t, (s + 1) % 3) * 3; const b = vert(m.pos, m.idx, t, (s + 2) % 3) * 3;
      const ka = `${Math.round(m.pos[a] * 1e4)},${Math.round(m.pos[a + 1] * 1e4)},${Math.round(m.pos[a + 2] * 1e4)}`;
      const kb = `${Math.round(m.pos[b] * 1e4)},${Math.round(m.pos[b + 1] * 1e4)},${Math.round(m.pos[b + 2] * 1e4)}`;
      const chave = `${m.nome}|${ka < kb ? ka + '|' + kb : kb + '|' + ka}`;
      if (vistas.has(chave)) continue; vistas.add(chave);
      lp.push(m.pos[a], m.pos[a + 1], m.pos[a + 2], m.pos[b], m.pos[b + 1], m.pos[b + 2]);
      lc.push(...corAresta, opA, ...corAresta, opA);
    }
  }
  return { pos: new Float32Array(fp), cor: new Float32Array(fc), linhas: { pos: new Float32Array(lp), cor: new Float32Array(lc) }, triangulos: conta };
}

// Tampa do corte: só as peças que o plano atravessa entram nas duas passadas de stencil.
// faixas = [{ zmin, zmax, f0, n }] (faixa em z, no mundo, e as faces de cada elemento, numa malha SEM índice);
// escreve em `saida` (Uint32Array) os vértices dessas faces, em sequência, e devolve quantos escreveu.
// Elemento inteiro entra ou sai: a peça continua fechada, e a contagem do stencil (entra/sai) segue certa.
export function verticesQueCruzam(faixas, z, saida) {
  let n = 0;
  for (const f of faixas) {
    if (f.zmin > z || f.zmax < z) continue;
    for (let v = f.f0 * 3, fim = (f.f0 + f.n) * 3; v < fim; v += 1) saida[n++] = v;
  }
  return n;
}

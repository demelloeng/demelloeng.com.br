// Maquete V05 R2 — transição entre dois estados da maquete (quando a pessoa marca ou desmarca um serviço, ou muda uma resposta).
// PURO: sem DOM e sem Three. A cena (maquete5_scene.mjs) usa este módulo; os testes (tests/transicao.test.mjs) o exercitam.
// Decide só três coisas, peça a peça:
//   - a peça já estava lá? (então não cresce de novo; se só mudou de material, a cor passa da antiga para a nova)
//   - a peça saiu? (então encolhe, em vez de sumir de uma vez)
//   - entrou disciplina nova? (então a cena deixa a edificação translúcida enquanto ela monta)

// Identidade da peça: nome, camada, pavimento e forma, mais um contador para as repetidas.
// Peça marcada 'keep' pelo gerador é a mesma com ou sem o serviço (só o material e a camada mudam): a camada sai da chave.
export function keyParts(parts) {
  const seen = new Map();
  for (const p of parts) {
    const base = `${p.name}|${p.keep ? 'keep' : p.layer}|${p.floor}|${p.shape}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    p.key = `${base}|${n}`;
  }
  return parts;
}

// prev: peças do estado anterior (null na primeira montagem). parts: peças novas, do gerador.
// tintOf(p): cor por peça que a cena usa (número). Altera cada peça de `parts` (key, settled, tintHex, fromHex).
// Devolve { leaving, reveal, recolor }:
//   leaving: cópias das peças que saíram, marcadas leaving/settled, para a cena encolher;
//   reveal: true se entrou uma camada que não existia (exceto 'volume'), fora da primeira montagem e sem movimento reduzido;
//   recolor: true se alguma peça que ficou mudou de cor.
export function transition(prev, parts, tintOf, { reduced = false } = {}) {
  keyParts(parts);
  const live = prev ? prev.filter((p) => !p.leaving) : null;
  const before = live ? new Map(live.map((p) => [p.key, p])) : null;
  const prevLayers = new Set((live ?? []).map((p) => p.layer));
  for (const p of parts) {
    const old = before?.get(p.key);
    p.settled = !!old;
    p.tintHex = tintOf(p);
    p.fromHex = old && old.tintHex !== p.tintHex ? old.tintHex : null;
  }
  const now = new Set(parts.map((p) => p.key));
  const leaving = before ? [...before.values()].filter((o) => !now.has(o.key)).map((o) => ({ ...o, leaving: true, settled: true, fromHex: null })) : [];
  const reveal = !!live && !reduced && parts.some((p) => p.layer !== 'volume' && !prevLayers.has(p.layer));
  return { leaving, reveal, recolor: parts.some((p) => p.fromHex != null) };
}

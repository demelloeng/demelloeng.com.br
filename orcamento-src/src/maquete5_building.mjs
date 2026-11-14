// Maquete V05 R2 (EXPERIMENTO, cópia refinada) — gerador PURO da edificação (sem DOM, sem Three).
// Entrada: o que a pessoa informou (área, pavimentos, tipologia, serviços). Saída: lista de peças em METROS.
// Regras de honestidade:
//   - a projeção desenhada tem a área informada e os pavimentos são os informados (escala real);
//   - a PROPORÇÃO do retângulo, a malha de pilares, as paredes e os traçados de instalação são ILUSTRATIVOS:
//     saem de regras fixas de desenho, não de dimensionamento. Nenhuma contagem de peça é exposta como número.

export const FH = 3;            // piso a piso (m), valor de desenho
export const SLAB = 0.14;
export const BEAM_H = 0.45;
export const BEAM_W = 0.16;
export const PIL = 0.25;
export const WALL = 0.15;
export const BASE_Y = 0.15;     // soleira: topo do piso térreo acima do terreno
export const MAX_FLOORS = 8;
export const RATIO = 1.5;       // largura : profundidade (ilustrativo)
const SPAN = 4.5;               // vão de desenho entre eixos (ilustrativo)
const MAX_BAYS = 8;

export const LAYERS = ['volume', 'arquitetura', 'estrutura', 'hidrossanitario', 'eletrica', 'incendio', 'gas'];
export const LAYER_LABEL = {
  volume: 'Edificação', arquitetura: 'Arquitetura', estrutura: 'Estrutura', hidrossanitario: 'Hidrossanitário',
  eletrica: 'Elétrica', incendio: 'Incêndio', gas: 'Gás', terreno: 'Terraplanagem',
};
export const SERVICE_LAYER = {
  ARQUITETURA: 'arquitetura', ESTRUTURAL: 'estrutura', HIDROSSANITARIO: 'hidrossanitario', ELETRICA: 'eletrica',
  INCENDIO: 'incendio', GAS_GLP: 'gas', TERRAPLENAGEM: 'terreno',
};
// Padrão que liga o estilo moderno: 'Alto' (pergunta CA6, rota Construir ou ampliar) e 'amplo' (programa de Arquitetura).
export const HIGH_STANDARD = ['Alto', 'amplo'];
export const LOW_STANDARD = ['Econômico', 'compacto'];
export const MID_STANDARD = ['Médio', 'confortavel'];
export const ILLUSTRATIVE_NOTE = 'Representação ilustrativa. O dimensionamento é feito no projeto.';

const r2 = (v) => Math.round(v * 100) / 100;
const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

// Entrada normalizada. `input` = { areaProj, areaTotal, areaTerreno, floors, typology, services[] } (tudo opcional).
// R03: `floorsDeclared` = pavimentos INFORMADOS (dado da pessoa); `floors` = pavimentos REPRESENTADOS (até MAX_FLOORS).
// Projeção: a informada prevalece; sem ela, média ilustrativa = área total / pavimentos INFORMADOS (nunca os desenhados).
export function buildingSpec(input = {}) {
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const floorsIn = Number.isInteger(input.floors) && input.floors > 0 ? input.floors : null;
  const floors = Math.min(MAX_FLOORS, floorsIn ?? 2);
  const areaTotal = num(input.areaTotal);
  const projIn = num(input.areaProj);
  const areaProj = projIn ?? (areaTotal ? areaTotal / (floorsIn ?? floors) : null);
  const layers = [...new Set((input.services ?? []).map((s) => SERVICE_LAYER[s]).filter(Boolean))];
  const terrain = layers.includes('terreno');
  const hasBuilding = areaProj !== null || layers.some((l) => l !== 'terreno') || !terrain;
  const A = areaProj ?? 96;                              // sem área: volume genérico (a escala gráfica não aparece)
  const w = r2(Math.sqrt(A * RATIO));
  const d = r2(A / w);
  return {
    w, d, floors,
    floorsDeclared: floorsIn,
    floorsKnown: floorsIn !== null,
    floorsExtra: floorsIn !== null && floorsIn > MAX_FLOORS ? floorsIn - MAX_FLOORS : 0,
    hasArea: areaProj !== null,
    areaProj, areaTotal, areaTerreno: num(input.areaTerreno),
    areaProjSource: projIn !== null ? 'informada' : areaProj !== null ? 'media' : null,
    typology: input.typology ?? null,
    standard: input.standard ?? null,
    // faixa de desenho (só casa): 'eco', 'medio', 'alto' ou null quando a pessoa não declarou o padrão
    tier: (input.typology ?? 'CASA') !== 'CASA' ? null : HIGH_STANDARD.includes(input.standard) ? 'alto' : MID_STANDARD.includes(input.standard) ? 'medio' : LOW_STANDARD.includes(input.standard) ? 'eco' : null,
    modern: (input.typology ?? 'CASA') === 'CASA' && HIGH_STANDARD.includes(input.standard),
    layers: layers.filter((l) => l !== 'terreno'),
    terrain, hasBuilding,
    pitched: (input.typology ?? 'CASA') === 'CASA' && floors <= 3 && !HIGH_STANDARD.includes(input.standard),
  };
}

// Gera as peças. Cada peça: { shape, mat, layer, floor, order, anim, name, p:[x,y,z] (centro), s:[sx,sy,sz], axis? }.
export function generate(spec) {
  const parts = [];
  const { w, d, floors } = spec;
  const lay = new Set(spec.layers);
  const nx = Math.max(1, Math.min(MAX_BAYS, Math.round(w / SPAN)));
  const nz = Math.max(1, Math.min(MAX_BAYS, Math.round(d / SPAN)));
  const xs = lin(-w / 2 + PIL / 2, w / 2 - PIL / 2, nx);
  const zs = lin(-d / 2 + PIL / 2, d / 2 - PIL / 2, nz);
  const top = BASE_Y + floors * FH;                         // topo da laje de cobertura
  // R03: medidas fixas de desenho (pilar, parede, esquadria, porta) não cabem em áreas muito pequenas; a peça que
  // resultaria com dimensão não positiva ou não finita é OMITIDA (nunca desenhada torta, nunca redimensionada).
  const fits = (o) => o.s.every((v) => Number.isFinite(v) && v > 0) && o.p.every(Number.isFinite);
  const add = (o) => { if (fits(o)) parts.push(o); return o; };
  const box = (mat, layer, floor, order, name, p, s, anim = 'grow') => add({ shape: 'box', mat, layer, floor, order, anim, name, p, s });
  const live = (o) => { o.keep = true; return o; };     // R2: a peça é a mesma com ou sem o serviço; só o material muda
  const cyl = (mat, layer, floor, order, name, p, r, len, axis = 'y', anim = 'grow') => add({ shape: 'cyl', mat, layer, floor, order, anim, name, p, s: [r, len, r], axis });
  const dims = { w, d, top, height: top, nx, nz, xs, zs };
  if (!spec.hasBuilding) return { parts, dims: { ...dims, height: 0.5 }, stages: [] };

  // ---- R2 (B4): sobrado de padrão Alto, com três vãos ou mais: o térreo recua no lado da piscina (direita) e vira varanda
  // coberta pelo pavimento de cima. A projeção (lajes) continua com a área informada; só a parede do térreo entra.
  const RECUO = 1.5;

  // ---- vão da escada (só com mais de um pavimento e se couber) ----
  const stairW = 2.7;
  const stairL = 8 * 0.28 + 1.15;
  const bay = xs[nx] - xs[nx - 1];
  const deepEnough = zs[1] - zs[0] >= stairL + 0.4;
  // A escada cabe no vão original quando há profundidade e largura livres.
  const keepsStair = !deepEnough || bay < stairW + 0.5 || bay >= stairW + 0.5 + RECUO;
  // Mesmo cálculo da divisória do térreo: a porta deixa um trecho positivo à direita.
  const partitionEnd = xs[nx] - RECUO - WALL;
  const doorStart = xs[nx - 1] + (partitionEnd - xs[nx - 1]) * 0.62;
  const recess = spec.typology === 'CASA' && spec.modern && spec.floorsKnown && floors === 2
    && nx >= 3 && bay >= 2 * RECUO && keepsStair && partitionEnd - doorStart - 0.9 > 0 ? RECUO : 0;
  let hole = null;
  if (floors > 1 && xs[nx] - xs[nx - 1] >= stairW + 0.5 + recess && zs[1] - zs[0] >= stairL + 0.4) {
    const hx1 = xs[nx] - 0.35 - recess;   // R2 (B4): com varanda, a escada fica dentro da parte fechada
    const hz0 = zs[0] + 0.35;
    hole = { x0: hx1 - stairW, x1: hx1, z0: hz0, z1: hz0 + stairL };
  }

  // ordem de montagem: fundação 0 · por pavimento f: pilares 10+3f, vigas 11+3f, laje 12+3f · vedações 40+f · cobertura 50 · instalações 55+
  const oPil = (f) => 10 + 3 * f;
  const oVig = (f) => 11 + 3 * f;
  const oLaje = (f) => 9 + 3 * f;          // a laje do piso f fecha o pavimento f-1 (f=0: contrapiso, antes dos pilares)
  const oWall = (f) => 40 + f;
  const O_ROOF = 50;
  const O_INST = { hidrossanitario: 55, eletrica: 57, incendio: 59, gas: 61 };

  // ---- lajes (sempre: são o volume) ----
  for (let f = 0; f <= floors; f += 1) {
    const y = BASE_Y + f * FH - SLAB / 2;
    const name = f === 0 ? 'Piso térreo' : f === floors ? 'Laje de cobertura' : 'Laje';
    if (hole && f > 0 && f < floors) {
      const o = oLaje(f);
      box('laje', 'volume', f, o, name, [(-w / 2 + hole.x0) / 2, y, 0], [hole.x0 + w / 2, SLAB, d], 'drop');
      box('laje', 'volume', f, o, name, [(hole.x1 + w / 2) / 2, y, 0], [w / 2 - hole.x1, SLAB, d], 'drop');
      box('laje', 'volume', f, o, name, [(hole.x0 + hole.x1) / 2, y, (-d / 2 + hole.z0) / 2], [hole.x1 - hole.x0, SLAB, hole.z0 + d / 2], 'drop');
      box('laje', 'volume', f, o, name, [(hole.x0 + hole.x1) / 2, y, (hole.z1 + d / 2) / 2], [hole.x1 - hole.x0, SLAB, d / 2 - hole.z1], 'drop');
    } else box('laje', 'volume', f, oLaje(f), name, [0, y, 0], [w, SLAB, d], 'drop');
  }

  // ---- estrutura ----
  if (lay.has('estrutura')) {
    for (const x of xs) for (const z of zs) {
      box('fundacao', 'estrutura', -1, 0, 'Sapata', [x, -1.0, z], [1.1, 0.4, 1.1], 'drop');
      box('concreto', 'estrutura', -1, 1, 'Arranque do pilar', [x, (-0.8 + BASE_Y - SLAB) / 2, z], [PIL, BASE_Y - SLAB + 0.8, PIL]);
    }
    for (const z of zs) box('fundacao', 'estrutura', -1, 2, 'Viga baldrame', [0, -0.2, z], [w - PIL, 0.4, 0.2], 'drop');
    for (const x of xs) box('fundacao', 'estrutura', -1, 2, 'Viga baldrame', [x, -0.2, 0], [0.2, 0.4, d - PIL], 'drop');
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      const hP = FH - SLAB;
      xs.forEach((x, i) => zs.forEach((z, j) => box('concreto', 'estrutura', f, oPil(f) + (i + j) * 0.03, 'Pilar', [x, y0 + hP / 2, z], [PIL, hP, PIL])));
      const yB = y0 + FH - SLAB - (BEAM_H - SLAB) / 2;
      for (const z of zs) box('concreto', 'estrutura', f, oVig(f), 'Viga', [0, yB, z], [w - PIL, BEAM_H - SLAB, BEAM_W], 'drop');
      for (const x of xs) box('concreto', 'estrutura', f, oVig(f) + 0.3, 'Viga', [x, yB, 0], [BEAM_W, BEAM_H - SLAB, d - PIL], 'drop');
    }
  }

  // ---- vedações externas com aberturas (volume) ----
  const hW = FH - SLAB;                                           // pé-direito de desenho
  const arq = lay.has('arquitetura');
  const facade = (f, fixed, a0, a1, alongX, withOpening, door, big = false) => {
    const y0 = BASE_Y + f * FH;
    const len = a1 - a0;
    const mid = (a0 + a1) / 2;
    const at = (a, y, sa, sy, mat = 'parede', name = 'Parede', th = WALL, layer = 'volume', order = oWall(f)) => (alongX
      ? box(mat, layer, f, order, name, [a, y, fixed], [sa, sy, th])
      : box(mat, layer, f, order, name, [fixed, y, a], [th, sy, sa]));
    if (!withOpening || len < 1.6) { at(mid, y0 + hW / 2, len, hW); return; }
    const curtain = big === 'curtain';
    const wide = big === 'wide';                                   // padrão médio: janela mais larga, peitoril normal
    const eco = spec.tier === 'eco';                               // padrão econômico: janela menor
    const ow = door ? (spec.modern ? 1.2 : 0.95) : curtain ? len - 0.5 : wide ? Math.min(2.8, len * 0.65) : big ? Math.min(3.8, len * 0.8) : eco ? Math.min(1.2, len * 0.4) : Math.min(2.0, len * 0.5);
    const sill = door ? 0 : curtain ? 0.06 : wide ? 0.9 : big ? 0.25 : eco ? 1.1 : 1.0;
    const head = door ? (spec.modern ? 2.6 : 2.15) : curtain ? hW - 0.06 : wide ? 2.15 : big ? 2.45 : 2.15;
    const side = (len - ow) / 2;
    at(a0 + side / 2, y0 + hW / 2, side, hW);
    at(a1 - side / 2, y0 + hW / 2, side, hW);
    if (sill > 0) at(mid, y0 + sill / 2, ow, sill);
    at(mid, y0 + (head + hW) / 2, ow, hW - head);
    if (door) live(at(mid, y0 + head / 2, ow, head, arq ? 'porta' : 'neutro', 'Porta', 0.05, arq ? 'arquitetura' : 'volume', oWall(f) + 0.5));
    else at(mid, y0 + (sill + head) / 2, ow, head - sill, 'vidro', curtain ? 'Pele de vidro' : 'Janela', 0.04, 'volume', oWall(f) + 0.5);
    if (curtain) for (const k of [-1, 1]) at(mid + (k * ow) / 6, y0 + (sill + head) / 2, 0.06, head - sill, 'esquadria', 'Esquadria', 0.09, 'volume', oWall(f) + 0.6);
  };
  const doorBay = Math.floor(nx / 2);
  const glazedBay = doorBay + 1 < nx ? doorBay + 1 : -1;                  // vão com pele de vidro, ao lado da porta (só no estilo moderno)
  for (let f = 0; f < floors; f += 1) {
    for (let i = 0; i < nx; i += 1) {
      const isDoor = i === doorBay;
      const open = !spec.modern || !isDoor || f === 0;          // moderno: acima da porta o pano é cego (recebe o revestimento)
      const style = !spec.modern ? (spec.tier === 'medio' ? 'wide' : false) : (i === glazedBay && f < 2 ? 'curtain' : true);
      const a1 = f === 0 && recess && i === nx - 1 ? xs[nx] - recess : xs[i + 1];   // R2 (B4): último vão do térreo termina na varanda
      facade(f, d / 2 - WALL / 2, xs[i], a1, true, open, f === 0 && isDoor, style);
      facade(f, -d / 2 + WALL / 2, xs[i], a1, true, true, false, spec.modern);
    }
    for (let j = 0; j < nz; j += 1) {
      facade(f, -w / 2 + WALL / 2, zs[j], zs[j + 1], false, j % 2 === 0, false);
      facade(f, w / 2 - WALL / 2 - (f === 0 ? recess : 0), zs[j], zs[j + 1], false, j % 2 === 1 || nz === 1, false);
    }
  }

  // ---- arquitetura: divisórias internas, portas e escada (só quando o serviço foi escolhido) ----
  if (lay.has('arquitetura')) {
    const zc = nz >= 2 ? zs[Math.round(nz / 2)] : r2(d * 0.12);
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      for (let i = 0; i < nx; i += 1) {
        const a0 = xs[i]; const a1 = f === 0 && recess && i === nx - 1 ? xs[nx] - recess - WALL : xs[i + 1];   // R2 (B4): divisória não atravessa a varanda
        if (hole && i === nx - 1 && zc < hole.z1 + 0.2) continue;
        const g0 = a0 + (a1 - a0) * 0.62;
        box('parede', 'arquitetura', f, oWall(f) + 0.2, 'Divisória', [(a0 + g0) / 2, y0 + hW / 2, zc], [g0 - a0, hW, 0.1]);
        box('parede', 'arquitetura', f, oWall(f) + 0.2, 'Divisória', [(g0 + 0.9 + a1) / 2, y0 + hW / 2, zc], [a1 - g0 - 0.9, hW, 0.1]);
        box('parede', 'arquitetura', f, oWall(f) + 0.2, 'Divisória', [g0 + 0.45, y0 + (2.15 + hW) / 2, zc], [0.9, hW - 2.15, 0.1]);
      }
      for (let i = 1; i < nx; i += 1) {
        if (hole && i === nx - 1) continue;
        const zb = -d / 2 + WALL;
        box('parede', 'arquitetura', f, oWall(f) + 0.3, 'Divisória', [xs[i], y0 + hW / 2, (zb + zc) / 2], [0.1, hW, zc - zb]);
      }
    }
    if (hole) {
      const rise = FH / 16;
      for (let f = 0; f < floors - 1; f += 1) {
        const y0 = BASE_Y + f * FH;
        for (let i = 0; i < 8; i += 1) {
          box('escada', 'arquitetura', f, oWall(f) + 0.6 + i * 0.02, 'Escada', [hole.x0 + 0.65, y0 + (i + 1) * rise - 0.09, hole.z0 + (i + 0.5) * 0.28], [1.2, 0.18, 0.28], 'drop');
          box('escada', 'arquitetura', f, oWall(f) + 0.8 + i * 0.02, 'Escada', [hole.x1 - 0.65, y0 + (9 + i) * rise - 0.09, hole.z0 + 8 * 0.28 - (i + 0.5) * 0.28], [1.2, 0.18, 0.28], 'drop');
        }
        box('escada', 'arquitetura', f, oWall(f) + 0.78, 'Patamar', [(hole.x0 + hole.x1) / 2, y0 + 8.5 * rise - 0.09, hole.z0 + 8 * 0.28 + 0.55], [hole.x1 - hole.x0 - 0.1, 0.18, 1.1], 'drop');
      }
    }
  }

  // ---- cobertura (volume) ----
  let roofH = 0;
  if (spec.pitched) {
    const ov = spec.tier === 'eco' ? 0.35 : 0.6;                   // econômico: beiral curto e telhado mais baixo
    roofH = r2(Math.min(3.5, (d / 2 + ov) * (spec.tier === 'eco' ? 0.28 : 0.36)));
    add({ shape: 'gable', mat: 'telhado', layer: 'volume', floor: floors, order: O_ROOF, anim: 'drop', name: 'Telhado', p: [0, top, 0], s: [w + 2 * ov, roofH, d + 2 * ov] });
  } else if (spec.modern && floors === 1) {
    roofH = 0.28;                                                   // térrea moderna: laje plana em balanço
    box('concreto', 'volume', floors, O_ROOF, 'Laje em balanço', [0, top + roofH / 2, 0.45], [w + 1.2, roofH, d + 1.9], 'drop');   // R2: 1,4 m na frente, 0,6 m nas laterais, 0,5 m nos fundos
  } else {
    roofH = spec.modern ? 0.6 : 1.1;
    const y = top + roofH / 2;
    box('parede', 'volume', floors, O_ROOF, 'Platibanda', [0, y, d / 2 - WALL / 2], [w, roofH, WALL]);
    box('parede', 'volume', floors, O_ROOF, 'Platibanda', [0, y, -d / 2 + WALL / 2], [w, roofH, WALL]);
    box('parede', 'volume', floors, O_ROOF, 'Platibanda', [-w / 2 + WALL / 2, y, 0], [WALL, roofH, d - 2 * WALL]);
    box('parede', 'volume', floors, O_ROOF, 'Platibanda', [w / 2 - WALL / 2, y, 0], [WALL, roofH, d - 2 * WALL]);
  }

  // ---- padrão médio: varanda coberta na entrada (no sobrado, a cobertura vira sacada) ----
  if (spec.tier === 'medio') {
    const zf = d / 2; const dp = 1.8;
    const a0 = xs[doorBay] - 0.2; const a1 = xs[doorBay + 1] + 0.2;
    const mid = (a0 + a1) / 2; const span = a1 - a0;
    const yC = BASE_Y + FH;
    const wood = arq ? 'madeira' : 'neutro';
    const lArq = arq ? 'arquitetura' : 'volume';
    box('piso', 'volume', -1, O_ROOF + 0.2, 'Piso da varanda', [mid, 0.075, zf + dp / 2], [span, 0.15, dp], 'drop');
    box('laje', 'volume', 0, O_ROOF - 0.5, 'Cobertura da varanda', [mid, yC - 0.08, zf + dp / 2], [span, 0.16, dp], 'drop');
    for (const x of [a0 + 0.1, a1 - 0.1]) live(box(wood, lArq, 0, O_ROOF - 0.55, 'Pilar da varanda', [x, (0.15 + yC - 0.16) / 2, zf + dp - 0.1], [0.16, yC - 0.16 - 0.15, 0.16]));
    if (floors >= 2) {
      box('parede', 'volume', 1, O_ROOF - 0.2, 'Guarda-corpo', [mid, yC + 0.5, zf + dp - 0.05], [span, 1.0, 0.1]);
      for (const x of [a0 + 0.05, a1 - 0.05]) box('parede', 'volume', 1, O_ROOF - 0.2, 'Guarda-corpo', [x, yC + 0.5, zf + (dp - 0.1) / 2], [0.1, 1.0, dp - 0.1]);
    }
  }

  // ---- estilo moderno (casa de padrão alto): revestimento, pórtico de entrada e piscina ----
  // As cores só aparecem quando o serviço correspondente foi escolhido; sem ele a peça fica neutra.
  let pool = null;
  if (spec.modern) {
    const F2 = Math.min(floors, 2);
    const hAll = F2 * FH - SLAB;
    const zf = d / 2;
    const wood = arq ? 'madeira' : 'neutro';
    const lArq = arq ? 'arquitetura' : 'volume';
    {
      // revestimento na coluna da porta, do piso ao topo do segundo pavimento
      const a0 = xs[doorBay] + PIL / 2; const a1 = xs[doorBay + 1] - PIL / 2;
      const mid = (a0 + a1) / 2; const dw = 1.2; const dh = 2.6;
      const stone = arq ? 'pedra' : 'neutro';
      const cw = Math.min(a1 - a0, dw + 1.8);                       // R2: faixa de 0,9 m de cada lado da porta (antes, o vão inteiro)
      const side = (cw - dw) / 2;
      live(box(stone, lArq, 0, oWall(0) + 0.7, 'Revestimento', [mid - cw / 2 + side / 2, BASE_Y + hAll / 2, zf + 0.04], [side, hAll, 0.08]));
      live(box(stone, lArq, 0, oWall(0) + 0.7, 'Revestimento', [mid + cw / 2 - side / 2, BASE_Y + hAll / 2, zf + 0.04], [side, hAll, 0.08]));
      live(box(stone, lArq, 0, oWall(0) + 0.7, 'Revestimento', [mid, BASE_Y + (dh + hAll) / 2, zf + 0.04], [dw, hAll - dh, 0.08]));
      box('piso', 'volume', -1, O_ROOF + 0.2, 'Caminho de entrada', [mid, 0.02, zf + 2.3], [1.8, 0.04, 2.8], 'drop');
    }
    if (floors >= 2) {
      // moldura branca envolvendo a porta e a pele de vidro, rente ao topo da platibanda
      const last = glazedBay >= 0 ? glazedBay : doorBay;
      const px0 = xs[doorBay] - 0.2; const px1 = xs[last + 1] + 0.2;
      const hp = BASE_Y + F2 * FH + (floors === 2 ? 0.6 : 0);
      const dp = 0.9; const tp = 0.32;
      box('parede', 'volume', 0, O_ROOF - 0.6, 'Pórtico', [px0 + tp / 2, hp / 2, zf + dp / 2], [tp, hp, dp]);
      box('parede', 'volume', 0, O_ROOF - 0.6, 'Pórtico', [px1 - tp / 2, hp / 2, zf + dp / 2], [tp, hp, dp]);
      box('parede', 'volume', 0, O_ROOF - 0.4, 'Pórtico', [(px0 + px1) / 2, hp - tp / 2, zf + dp / 2], [px1 - px0 - 2 * tp, tp, dp], 'drop');
      live(box(wood, lArq, 0, O_ROOF - 0.3, 'Forro do pórtico', [(px0 + px1) / 2, hp - tp - 0.03, zf + dp / 2], [px1 - px0 - 2 * tp, 0.06, dp - 0.06], 'drop'));
      // garagem coberta à esquerda da porta, com terraço e pergolado em cima
      if (doorBay >= 1) {
        const gx0 = -w / 2; const gx1 = px0;
        const span = gx1 - gx0; const gm = (gx0 + gx1) / 2; const cd = 2.6;
        const yT = BASE_Y + FH;                                     // piso do terraço
        box('laje', 'volume', 0, O_ROOF - 0.5, 'Marquise da garagem', [gm, yT - 0.1, zf + cd / 2], [span, 0.2, cd], 'drop');
        box('parede', 'volume', 0, O_ROOF - 0.55, 'Parede da garagem', [gx0 + 0.12, (yT - 0.2) / 2, zf + cd / 2], [0.24, yT - 0.2, cd]);
        box('vidro', 'volume', 1, O_ROOF - 0.2, 'Guarda-corpo', [gm, yT + 0.5, zf + cd - 0.04], [span - 0.1, 1.0, 0.04]);
        const yP = BASE_Y + 2 * FH - 0.09;                           // R2: eixo das ripas
        const nR = Math.max(3, Math.round(span / 0.55));
        live(box(wood, lArq, 1, O_ROOF - 0.15, 'Pergolado', [gx0 + 0.09, yT + (FH - 0.34) / 2, zf + cd - 0.09], [0.18, FH - 0.34, 0.18]));
        live(box(wood, lArq, 1, O_ROOF - 0.12, 'Pergolado', [gm, yP - 0.17, zf + cd - 0.09], [span, 0.16, 0.14], 'drop'));
        for (let i = 0; i < nR; i += 1) live(box(wood, lArq, 1, O_ROOF - 0.1 + i * 0.02, 'Pergolado', [gx0 + (span * (i + 0.5)) / nR, yP, zf + cd / 2], [0.09, 0.16, cd], 'drop'));
        box('piso', 'volume', -1, O_ROOF + 0.2, 'Piso da garagem', [gm, 0.02, zf + (cd + 1.6) / 2], [span - 0.3, 0.04, cd + 1.6], 'drop');
      }
    }
    const pl = r2(Math.min(7, Math.max(3.5, d * 0.55)));          // comprimento (ao longo da profundidade)
    const pb = 3.4;                                                // largura
    pool = { x: w / 2 + 2.0 + pb / 2, z: -d / 2 + pl / 2 + 0.4, w: pb, d: pl };
    if (lay.has('hidrossanitario')) {
      const o = O_INST.hidrossanitario + 1.5;
      // R2 (B2): deck elevado em moldura; a água fica abaixo da borda e o fundo escuro dá a profundidade (o chão é opaco em y = 0)
      const hd = 0.4; const bd = 0.8;
      box('deck', 'hidrossanitario', -1, o, 'Deck da piscina', [pool.x, hd / 2, pool.z - pl / 2 - bd / 2], [pb + 2 * bd, hd, bd], 'drop');
      box('deck', 'hidrossanitario', -1, o, 'Deck da piscina', [pool.x, hd / 2, pool.z + pl / 2 + bd / 2], [pb + 2 * bd, hd, bd], 'drop');
      box('deck', 'hidrossanitario', -1, o, 'Deck da piscina', [pool.x - pb / 2 - bd / 2, hd / 2, pool.z], [bd, hd, pl], 'drop');
      box('deck', 'hidrossanitario', -1, o, 'Deck da piscina', [pool.x + pb / 2 + bd / 2, hd / 2, pool.z], [bd, hd, pl], 'drop');
      box('fundo', 'hidrossanitario', -1, o + 0.2, 'Fundo da piscina', [pool.x, 0.03, pool.z], [pb, 0.06, pl], 'drop');
      box('agua', 'hidrossanitario', -1, o + 0.3, 'Piscina', [pool.x, hd - 0.12, pool.z], [pb, 0.04, pl], 'drop');
      cyl('reservatorio', 'hidrossanitario', -1, o + 0.5, 'Filtro da piscina', [w / 2 + 0.7, 0.45, pool.z - pl / 2 - 0.1], 0.26, 0.7, 'y', 'pop');
      cyl('af', 'hidrossanitario', -1, o + 0.6, 'Tubulação da piscina', [(w / 2 + 0.7 + pool.x - pb / 2) / 2, 0.16, pool.z - pl / 2 - 0.1], 0.05, pool.x - pb / 2 - (w / 2 + 0.7) + 0.6, 'x');
    } else {
      add({ shape: 'box', mat: 'fantasma', layer: 'volume', floor: -1, order: O_ROOF, anim: 'drop', name: 'Piscina', p: [pool.x, 0.06, pool.z], s: [pb, 0.08, pl] });
    }
  }

  // ---- R2 (B3): vegetação ilustrativa ao redor da casa, sem medida. Só casa; nunca edifício nem terraplanagem. ----
  // Posições fixas de desenho: lado esquerdo e fundos, e arbustos na frente à direita; longe da garagem, do caminho,
  // da varanda, da piscina e do balanço da laje da térrea.
  const flora = (spec.typology ?? 'CASA') === 'CASA' && !spec.terrain;
  if (flora) {
    const veg = (name, x, z, dm, h) => add({ shape: 'arvore', mat: 'arvore', layer: 'volume', floor: -1, order: O_ROOF + 0.6, anim: 'pop', name, p: [x, h / 2, z], s: [dm, h, dm] });
    veg('Árvore', -w / 2 - 2.0, -d / 2 + 0.9, 2.4, 4.4);
    veg('Árvore', -w / 2 + 1.4, -d / 2 - 2.0, 2.8, 5.0);
    veg('Árvore', Math.min(w / 2 - 1.5, 2.5), -d / 2 - 2.1, 2.2, 3.8);
    veg('Arbusto', w / 2 + 1.1, d / 2 + 1.0, 1.2, 1.0);
    veg('Arbusto', w / 2 + 2.3, d / 2 + 0.6, 0.9, 0.8);
  }

  // núcleo hidráulico (posição de desenho): canto de fundo, à esquerda
  const wx = xs[0] + 0.7;
  const wz = zs[0] + 0.55;
  const bayX = xs[1] - xs[0];

  // ---- hidrossanitário ----
  if (lay.has('hidrossanitario')) {
    const o = O_INST.hidrossanitario;
    const L = 'hidrossanitario';
    const run = Math.max(1.2, Math.min(3.2, bayX - 1.4));
    if (spec.modern && floors === 1) cyl('reservatorio', L, floors, o, 'Reservatório', [wx + 0.9, top + 0.28 + 0.22, wz + 0.9], 0.6, 0.44);
    else if (spec.modern) cyl('reservatorio', L, floors, o, 'Reservatório', [wx + 0.9, top + 0.22, wz + 0.9], 0.75, 0.44);
    else if (spec.pitched) {
      // telhado de duas águas: o reservatório fica sob a cumeeira, dentro do telhado (aparece no raio-X e no corte)
      const hR = Math.max(0.4, Math.min(1.3, roofH - 0.5));
      cyl('reservatorio', L, floors, o, 'Reservatório', [wx + 0.9, top + hR / 2, 0], 0.7, hR);
    } else cyl('reservatorio', L, floors, o, 'Reservatório', [wx + 0.9, top + 0.75, wz + 0.9], 0.8, 1.3);
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      cyl('af', L, f, o + 0.2, 'Coluna de água fria', [wx, y0 + FH / 2, wz], 0.055, FH);
      cyl('af', L, f, o + 0.4, 'Ramal de água fria', [wx + run / 2, y0 + 2.55, wz], 0.045, run, 'x');
      cyl('af', L, f, o + 0.5, 'Ponto de água', [wx + run * 0.5, y0 + 1.85, wz], 0.045, 1.4);
      cyl('af', L, f, o + 0.5, 'Ponto de água', [wx + run, y0 + 1.55, wz], 0.045, 2.0);
      cyl('es', L, f, o + 0.6, 'Tubo de queda (esgoto)', [wx + 0.35, y0 + FH / 2, wz + 0.35], 0.085, FH);
      cyl('es', L, f, o + 0.8, 'Ramal de esgoto', [wx + 0.35 + run / 2, y0 - SLAB - 0.22, wz + 0.35], 0.07, run, 'x');
      cyl('es', L, f, o + 0.9, 'Ponto de esgoto', [wx + 0.35 + run * 0.5, y0 - 0.14, wz + 0.35], 0.06, 0.44);
      cyl('es', L, f, o + 0.9, 'Ponto de esgoto', [wx + 0.35 + run, y0 - 0.14, wz + 0.35], 0.06, 0.44);
    }
    cyl('es', L, floors, o + 1, 'Ventilação', [wx + 0.35, top + 0.5, wz + 0.35], 0.05, 1.0);
    const zOut = d / 2 + 1.6;
    cyl('es', L, -1, o + 1.2, 'Subcoletor', [wx + 0.35, -0.55, (wz + 0.35 + zOut) / 2], 0.09, zOut - wz - 0.35, 'z');
    cyl('es', L, -1, o + 1.1, 'Tubo de queda (esgoto)', [wx + 0.35, (BASE_Y - 0.55) / 2, wz + 0.35], 0.085, BASE_Y + 0.55);
    box('fundacao', L, -1, o + 1.3, 'Caixa de inspeção', [wx + 0.35, -0.45, zOut], [0.7, 0.7, 0.7]);
  }

  // ---- elétrica ----
  if (lay.has('eletrica')) {
    const o = O_INST.eletrica;
    const L = 'eletrica';
    const qx = xs[doorBay] + 0.5;
    const qz = d / 2 - WALL - 0.08;
    const cx = xs.slice(0, -1).map((x, i) => (x + xs[i + 1]) / 2);
    const cz = zs.slice(0, -1).map((z, j) => (z + zs[j + 1]) / 2);
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      const yc = y0 + FH - SLAB - 0.06;
      box('eletrica', L, f, o, 'Quadro de distribuição', [qx, y0 + 1.5, qz], [0.42, 0.6, 0.12]);
      cyl('eletrica', L, f, o + 0.1, 'Prumada elétrica', [qx, y0 + FH / 2, qz], 0.035, FH);
      cyl('eletrica', L, f, o + 0.3, 'Eletroduto', [qx, yc, (qz + cz[0]) / 2], 0.028, qz - cz[0], 'z');
      for (const z of cz) if (cx.length > 1) cyl('eletrica', L, f, o + 0.5, 'Eletroduto', [(cx[0] + cx[cx.length - 1]) / 2, yc, z], 0.028, cx[cx.length - 1] - cx[0], 'x');
      const xq = cx.reduce((a, b) => (Math.abs(b - qx) < Math.abs(a - qx) ? b : a));
      cyl('eletrica', L, f, o + 0.4, 'Eletroduto', [(qx + xq) / 2, yc, cz[0]], 0.028, Math.abs(qx - xq) || 0.01, 'x');
      for (const z of cz) for (const x of cx) cyl('luz', L, f, o + 0.7, 'Ponto de luz', [x, yc, z], 0.16, 0.07, 'y', 'pop');
    }
  }

  // ---- incêndio ----
  if (lay.has('incendio')) {
    const o = O_INST.incendio;
    const L = 'incendio';
    const hx = hole ? hole.x0 - 0.4 : xs[nx] - 0.6;
    const hz = zs[0] + 0.3;
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      cyl('incendio', L, f, o, 'Coluna de incêndio', [hx, y0 + FH / 2, hz], 0.075, FH);
      box('incendio', L, f, o + 0.3, 'Abrigo de hidrante', [hx - 0.55, y0 + 1.25, hz - 0.02], [0.65, 0.9, 0.22]);
      cyl('incendio', L, f, o + 0.5, 'Extintor', [xs[doorBay] + 1.9, y0 + 0.45, d / 2 - WALL - 0.2], 0.1, 0.5, 'y', 'pop');
      cyl('incendio', L, f, o + 0.5, 'Extintor', [xs[0] + 0.5, y0 + 0.45, zs[nz] - 0.6], 0.1, 0.5, 'y', 'pop');
    }
  }

  // ---- gás ----
  if (lay.has('gas')) {
    const o = O_INST.gas;
    const L = 'gas';
    const gx = w / 2 + 0.12;
    const gz = zs[nz] - Math.min(2.2, d * 0.3);
    box('fundacao', L, -1, o, 'Abrigo da central de GLP', [w / 2 + 0.75, 0.05, gz], [1.2, 0.1, 1.1], 'drop');
    cyl('gas', L, -1, o + 0.1, 'Central de GLP', [w / 2 + 0.55, 0.55, gz - 0.22], 0.19, 0.9, 'y', 'pop');
    cyl('gas', L, -1, o + 0.1, 'Central de GLP', [w / 2 + 0.95, 0.55, gz + 0.22], 0.19, 0.9, 'y', 'pop');
    for (let f = 0; f < floors; f += 1) {
      const y0 = BASE_Y + f * FH;
      cyl('gas', L, f, o + 0.3, 'Prumada de gás', [gx, y0 + FH / 2, gz], 0.04, FH);
      cyl('gas', L, f, o + 0.5, 'Ramal de gás', [gx - 0.75, y0 + 0.55, gz], 0.035, 1.5, 'x');
      cyl('gas', L, f, o + 0.6, 'Ponto de gás', [gx - 1.5, y0 + 0.55, gz], 0.08, 0.12, 'x', 'pop');
    }
  }

  const stages = [
    { id: 'fundacao', label: 'Fundação', at: 0 },
    { id: 'estrutura', label: 'Estrutura e lajes', at: 9 },
    { id: 'vedacoes', label: 'Vedações', at: 40 },
    { id: 'cobertura', label: 'Cobertura', at: O_ROOF },
    { id: 'instalacoes', label: 'Instalações', at: 55 },
  ].filter((s) => parts.some((p) => p.order >= s.at && p.order < s.at + (s.id === 'estrutura' ? 31 : s.id === 'instalacoes' ? 10 : 9.99)));
  return { parts, dims: { ...dims, height: top + roofH, roofH, hole, pool, flora, recess, front: spec.modern ? 3.0 : spec.tier === 'medio' ? 2.0 : 0 }, stages };
}

// ---- câmera: menor distância para a caixa (w,h,d) centrada no alvo caber no quadro. Mesmo método do fitDistance vigente. ----
const rad = (a) => (a * Math.PI) / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const n = Math.hypot(...v); return n < 1e-9 ? [1, 0, 0] : v.map((x) => x / n); };
export function cameraBasis(az, el) {
  const a = rad(az); const e = rad(el);
  const f = [-Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)];
  const r = unit(cross(f, Math.abs(Math.sin(e)) > 0.999 ? [0, 0, -1] : [0, 1, 0]));
  return { f, r, u: cross(r, f) };
}
export function fitBox(box, { az, el, fovDeg = 30, aspect = 1.6, band = 0.2, margin = 0.9 }) {
  const { f, r, u } = cameraBasis(az, el);
  const tanV = Math.tan(rad(fovDeg) / 2);
  const tanH = tanV * aspect;
  const mV = margin * (1 - band);
  let dist = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = [(sx * box.w) / 2, (sy * box.h) / 2, (sz * box.d) / 2];
    const zf = dot(c, f);
    dist = Math.max(dist, Math.abs(dot(c, r)) / (margin * tanH) - zf, Math.abs(dot(c, u)) / (mV * tanV) - zf);
  }
  return dist;
}

// Texto equivalente (leitor de tela): só o que a pessoa informou e o que está desenhado.
export function describe(spec) {
  if (!spec.hasBuilding) return 'Maquete ilustrativa do terreno.';
  // R03: acima do limite de desenho, o texto diz quantos foram informados e quantos estão representados.
  const pav = !spec.floorsKnown ? 'volume genérico'
    : spec.floorsExtra ? `${spec.floorsDeclared} pavimentos informados, ${spec.floors} representados`
      : `${spec.floors} ${spec.floors === 1 ? 'pavimento' : 'pavimentos'}`;
  const names = [...spec.layers, ...(spec.terrain ? ['terreno'] : [])].map((l) => LAYER_LABEL[l]);
  return `Maquete ilustrativa: ${pav}${names.length ? `, com ${names.join(', ')}` : ''}.`;
}

// Escala gráfica: comprimento "redondo" (m) que ocupa perto de `targetPx` na tela, dado metros por pixel.
export function scaleBar(metersPerPx, targetPx = 80) {
  const raw = metersPerPx * targetPx;
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const m = steps.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
  return { meters: m, px: m / metersPerPx };
}

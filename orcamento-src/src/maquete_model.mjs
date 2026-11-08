// Maquete da calculadora — modelo PURO da cena (sem DOM, sem Three).
// Entrada: o modelo de livePlanModel (dados reais do motor). Saída: a especificação geométrica ILUSTRATIVA.
// A forma é paramétrica e genérica: só a escala acompanha a ordem de grandeza da área informada; a quantidade de pavimentos
// é a informada (limitada a 8). Pilares, tubos e pontos elétricos são esquemáticos: não representam quantidade nem dimensionamento.

export const FLOOR_H = 3;           // altura de um pavimento na cena (unidades da cena, sem escala real)
export const MAX_FLOORS = 8;

// Câmera de cada vista: azimute e elevação em graus; k = abertura vertical dos pavimentos; cut = plano de corte.
export const VIEW_CAM = {
  conjunto: { az: 38, el: 27, k: 1, cut: false },
  camadas: { az: 38, el: 22, k: 1.9, cut: false },
  corte: { az: 16, el: 34, k: 1.5, cut: true },   // quase frontal e mais alto: a face cortada e o interior ficam à vista
  planta: { az: 0, el: 86, k: 1, cut: false },
};

// Enquadramento: a edificação INTEIRA cabe no quadro, em qualquer vista, proporção e número de pavimentos.
//   FIT_MARGIN     fração da largura/altura úteis que o desenho pode ocupar (o resto é respiro);
//   CONTROLS_BAND  faixa inferior do quadro reservada aos botões de vista sobrepostos (o desenho não passa por baixo deles).
export const FIT_MARGIN = 0.9;
export const CONTROLS_BAND = 0.2;

const rad = (a) => (a * Math.PI) / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const n = Math.hypot(...v); return n < 1e-9 ? [1, 0, 0] : v.map((x) => x / n); };

// Base da câmera de uma vista: direção do olhar f (da câmera ao centro do modelo), direita r e cima u.
export function cameraBasis(az, el) {
  const a = rad(az);
  const e = rad(el);
  const f = [-Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)];
  const r = unit(cross(f, [0, 1, 0]));
  return { f, r, u: cross(r, f) };
}

// Centro vertical do modelo na vista (altura total = pavimentos x FLOOR_H x k).
export const modelHeight = (spec, view) => spec.floors * FLOOR_H * VIEW_CAM[view].k;

// Vista com corte: o plano remove a metade da frente; o que sobra (a metade de trás) é o que precisa caber e ficar centrado.
// O alvo da câmera acompanha: z = -d/4 (cut = 1) em vez do centro da caixa inteira.
export const cutTargetZ = (spec, view) => (VIEW_CAM[view].cut ? -spec.d / 4 : 0);

// Menor distância câmera-centro para os 8 cantos da caixa do modelo caberem no quadro (perspectiva real). Puro e testável.
export function fitDistance(spec, view, { aspect = 1.6, fovDeg = 30, band = CONTROLS_BAND } = {}) {
  const cfg = VIEW_CAM[view];
  const { f, r, u } = cameraBasis(cfg.az, cfg.el);
  const H = modelHeight(spec, view);
  const tanV = Math.tan(rad(fovDeg) / 2);
  const tanH = tanV * aspect;
  const mH = FIT_MARGIN;
  const mV = FIT_MARGIN * (1 - band);     // `band`: fração do quadro ocupada pelos botões (medida no navegador; padrão = CONTROLS_BAND)
  let dist = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = [sx * spec.w / 2, sy * H / 2, sz * (cfg.cut ? spec.d / 4 : spec.d / 2)];
    const x = Math.abs(dot(c, r));
    const y = Math.abs(dot(c, u));
    const zf = dot(c, f);                 // >0: o canto está mais longe da câmera que o centro
    dist = Math.max(dist, x / (mH * tanH) - zf, y / (mV * tanV) - zf);
  }
  return dist;
}

// Projeta um canto no quadro (NDC, -1..1) para a câmera à distância `dist` do centro. Usado só nos testes de enquadramento.
export function projectCorner(spec, view, dist, c, { aspect = 1.6, fovDeg = 30 } = {}) {   // c relativo ao alvo da vista
  const { f, r, u } = cameraBasis(VIEW_CAM[view].az, VIEW_CAM[view].el);
  const tanV = Math.tan(rad(fovDeg) / 2);
  const depth = dist + dot(c, f);
  return [dot(c, r) / (depth * tanV * aspect), dot(c, u) / (depth * tanV)];
}

// Vistas da maquete: o rótulo é o que a pessoa lê.
export const VIEWS = [
  { id: 'conjunto', label: 'Conjunto' },
  { id: 'camadas', label: 'Camadas' },
  { id: 'corte', label: 'Corte' },
  { id: 'planta', label: 'Planta' },
];

// Cores por camada (mesma paleta azul-grafite das maquetes DEMELLO; as disciplinas se diferenciam por matiz).
export const LAYER_COLOR = {
  estrutura: '#9cc2ec',
  hidrossanitario: '#35c6e8',
  eletrica: '#f2b134',
  incendio: '#e5584a',
  gas: '#a78bfa',
  terreno: '#59c08a',
};

export function sceneSpec(model) {
  const fp = model?.area?.footprint;
  const t = fp ? Math.min(1, Math.max(0, (fp.w - 110) / 150)) : 0.35;
  const w = Math.round((14 + 16 * t) * 10) / 10;
  const terrain = model?.area?.kind === 'terrain' || (model?.layers ?? []).includes('terreno');
  // Sem pavimentos informados a maquete mostra um volume genérico de dois níveis (a legenda não afirma pavimentos).
  const floors = Math.min(MAX_FLOORS, Math.max(1, model?.floorsDrawn ?? 2));
  return {
    w,
    d: Math.round(w * 0.66 * 10) / 10,
    floors,
    floorsKnown: model?.floorsDrawn != null,
    layers: (model?.layers ?? []).filter((l) => l !== 'terreno'),
    terrain,
    hasArea: !!model?.area,
  };
}

// Texto equivalente da maquete (leitor de tela e legenda): descreve o que está desenhado, sem número que não seja da pessoa.
export function describeScene(spec, layerLabels) {
  const parts = [spec.floorsKnown ? `${spec.floors} ${spec.floors === 1 ? 'pavimento' : 'pavimentos'}` : 'um volume genérico'];
  const names = [...spec.layers, ...(spec.terrain ? ['terreno'] : [])].map((l) => layerLabels[l]).filter(Boolean);
  return `Maquete esquemática: ${parts[0]}${names.length ? `, com ${names.join(', ')}` : ''}.`;
}

// ---- projeção isométrica (fallback sem WebGL e primeira pintura) ------------------------------------------------------
const C30 = Math.cos(Math.PI / 6);
const S30 = Math.sin(Math.PI / 6);
export const iso = (x, y, z) => [(x - z) * C30, (x + z) * S30 - y];
const pt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const poly = (...ps) => ps.map(pt).join(' ');

// Caixa em (x0,y0,z0) com largura w, altura h e profundidade d: três faces visíveis.
function box(x0, y0, z0, w, h, d) {
  return {
    top: poly(iso(x0, y0 + h, z0), iso(x0 + w, y0 + h, z0), iso(x0 + w, y0 + h, z0 + d), iso(x0, y0 + h, z0 + d)),
    left: poly(iso(x0, y0, z0 + d), iso(x0 + w, y0, z0 + d), iso(x0 + w, y0 + h, z0 + d), iso(x0, y0 + h, z0 + d)),
    right: poly(iso(x0 + w, y0, z0), iso(x0 + w, y0, z0 + d), iso(x0 + w, y0 + h, z0 + d), iso(x0 + w, y0 + h, z0)),
  };
}

// Formas do SVG isométrico, na ordem de pintura. `exploded` afasta os pavimentos (vista "Camadas").
export function isoShapes(spec, view = 'conjunto') {
  const k = view === 'camadas' ? 1.9 : 1;
  const { w, d, floors } = spec;
  const out = [];
  const x0 = -w / 2;
  const z0 = -d / 2;
  const slabH = 0.34;
  const gx = w * 1.55;
  out.push({ kind: 'ground', points: poly(iso(-gx / 2, 0, -gx * 0.33), iso(gx / 2, 0, -gx * 0.33), iso(gx / 2, 0, gx * 0.33), iso(-gx / 2, 0, gx * 0.33)) });
  if (spec.terrain) {
    for (const f of [0.3, 0.55, 0.8]) {
      out.push({ kind: 'contour', points: poly(iso(-gx / 2 * f * 1.2, 0.02, -gx * 0.33 * f), iso(gx / 2 * f * 1.2, 0.02, -gx * 0.33 * f), iso(gx / 2 * f * 1.2, 0.02, gx * 0.33 * f), iso(-gx / 2 * f * 1.2, 0.02, gx * 0.33 * f)) });
    }
  }
  const lay = new Set(spec.layers);
  for (let i = 0; i < floors; i += 1) {
    const y = i * FLOOR_H * k;
    const s = box(x0, y, z0, w, slabH, d);
    out.push({ kind: 'slab-left', points: s.left }, { kind: 'slab-right', points: s.right }, { kind: 'slab-top', points: s.top });
    // camadas por pavimento, sobre a laje
    if (lay.has('estrutura')) {
      for (const [fx, fz] of [[0.08, 0.1], [0.5, 0.1], [0.92, 0.1], [0.08, 0.9], [0.5, 0.9], [0.92, 0.9]]) {
        const a = iso(x0 + w * fx, y + slabH, z0 + d * fz);
        const b = iso(x0 + w * fx, y + FLOOR_H * k, z0 + d * fz);
        out.push({ kind: 'estrutura', d: `M${pt(a)}L${pt(b)}` });
      }
    }
    if (lay.has('hidrossanitario')) {
      const a = iso(x0 + w * 0.2, y + slabH + 0.05, z0 + d * 0.3);
      const b = iso(x0 + w * 0.2, y + slabH + 0.05, z0 + d * 0.75);
      const c = iso(x0 + w * 0.72, y + slabH + 0.05, z0 + d * 0.75);
      out.push({ kind: 'hidrossanitario', d: `M${pt(a)}L${pt(b)}L${pt(c)}` });
    }
    if (lay.has('eletrica')) {
      const pts = [[0.2, 0.25], [0.45, 0.45], [0.7, 0.3], [0.8, 0.7]].map(([fx, fz]) => iso(x0 + w * fx, y + slabH + 0.05, z0 + d * fz));
      out.push({ kind: 'eletrica', d: `M${pts.map(pt).join('L')}` });
      for (const p of pts) out.push({ kind: 'eletrica-ponto', cx: p[0], cy: p[1] });
    }
    if (lay.has('incendio')) out.push({ kind: 'incendio-ponto', cx: iso(x0 + w * 0.9, y + slabH + 0.1, z0 + d * 0.15)[0], cy: iso(x0 + w * 0.9, y + slabH + 0.1, z0 + d * 0.15)[1] });
    if (lay.has('gas')) {
      const a = iso(x0 + w * 0.05, y + slabH + 0.05, z0 + d * 0.95);
      const b = iso(x0 + w * 0.6, y + slabH + 0.05, z0 + d * 0.95);
      out.push({ kind: 'gas', d: `M${pt(a)}L${pt(b)}` });
    }
  }
  return out;
}

// Caixa de enquadramento do desenho isométrico (viewBox), com folga.
export function isoViewBox(spec, view = 'conjunto') {
  const shapes = isoShapes(spec, view);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const s of shapes) {
    const nums = (s.points ?? s.d ?? '').match(/-?\d+(?:\.\d+)?/g);
    if (nums) for (let i = 0; i + 1 < nums.length; i += 2) add(Number(nums[i]), Number(nums[i + 1]));
  }
  const padX = (maxX - minX) * 0.08 + 1;
  const padY = (maxY - minY) * 0.12 + 1;
  return { x: minX - padX, y: minY - padY, w: maxX - minX + 2 * padX, h: maxY - minY + 2 * padY };
}

// Enquadramento e escala gráfica das maquetes das páginas de serviço. Funções PURAS (sem DOM e sem Three).
// CÓPIA FIEL de orcamento-src/src/maquete5_building.mjs (calculadora R4): cameraBasis, fitBox e scaleBar.
// O visualizador público não pode depender de orcamento-src (não é publicado); o teste maquetes_v03 confere a paridade.
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

// Distância da câmera para a caixa {w,h,d} caber no quadro, descontando a faixa dos controles (band, fração da altura).
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

// Escala gráfica: o passo "redondo" mais próximo de targetPx pixels.
export function scaleBar(metersPerPx, targetPx = 80) {
  const raw = metersPerPx * targetPx;
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const m = steps.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
  return { meters: m, px: m / metersPerPx };
}

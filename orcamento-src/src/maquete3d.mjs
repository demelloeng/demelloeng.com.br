// Maquete 3D da calculadora — cena paramétrica leve com o Three.js já hospedado pelo site (mesmos bytes das maquetes DEMELLO).
// O Three entra por import() dinâmico: nada disso pesa na primeira tela e o formulário nunca espera pela cena.
// A cena só DESENHA o escopo informado (sceneSpec). Não calcula preço e não afirma quantidades técnicas.
import { FLOOR_H, LAYER_COLOR } from './maquete_model.mjs';

const THREE_URL = '/assets/vendor/three/build/three.module.js';
let threePromise = null;
export const loadThree = () => (threePromise ??= import(/* @vite-ignore */ THREE_URL));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const deg = (a) => (a * Math.PI) / 180;

// Câmera de cada vista: azimute e elevação em graus; k = abertura vertical dos pavimentos.
const VIEW_CAM = {
  conjunto: { az: 38, el: 27, k: 1, cut: false },
  camadas: { az: 38, el: 22, k: 1.9, cut: false },
  corte: { az: 22, el: 20, k: 1, cut: true },
  planta: { az: 0, el: 86, k: 1, cut: false },
};

export async function createMaquete(host, { reduced = false, mobile = false } = {}) {
  const THREE = await loadThree();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'mq-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 600);
  scene.add(new THREE.HemisphereLight(0xcfe2f6, 0x1b242d, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(30, 50, 25);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6aa0d8, 0.7);
  rim.position.set(-30, 18, -22);
  scene.add(rim);

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.4);
  const stage = new THREE.Group();
  scene.add(stage);

  // ---- materiais compartilhados (um por camada) ----
  const mats = {};
  const track = [];
  const mat = (key, params) => {
    if (!mats[key]) {
      mats[key] = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, transparent: true, ...params });
      mats[key].userData.base = params.opacity ?? 1;
      track.push(mats[key]);
    }
    return mats[key];
  };
  const lineMat = (key, color, opacity) => {
    if (!mats[key]) {
      mats[key] = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      mats[key].userData.base = opacity;
      track.push(mats[key]);
    }
    return mats[key];
  };

  const geos = [];
  const geo = (g) => { geos.push(g); return g; };
  // geometrias e texturas de uma construção: liberadas na reconstrução seguinte
  let buildGeos = [];
  const bgeo = (g) => { buildGeos.push(g); return g; };
  const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 14));
  const sphGeo = geo(new THREE.SphereGeometry(1, 14, 10));
  const edgeGeo = geo(new THREE.EdgesGeometry(boxGeo));

  const state = {
    spec: null,
    view: 'conjunto',
    k: 1, kT: 1,
    az: 38, azT: 38,
    el: 27, elT: 27,
    dist: 40, distT: 40,
    ty: 4, tyT: 4,
    cut: 0, cutT: 0,
    appear: new Map(),     // chave -> progresso 0..1
    appearT: new Map(),
    group: null,
    floorGroups: [],
    verticals: null,
    visible: true,
    running: false,
    raf: 0,
    safety: 0,
    destroyed: false,
    dragging: false,
  };

  function disposeGroup(g) {
    buildGeos.forEach((b) => b.dispose());
    buildGeos = [];
    g?.traverse?.((o) => { if (o.userData?.own) o.geometry?.dispose?.(); });
    if (g) stage.remove(g);
  }

  // ---- construção da cena a partir do spec ----
  function build(spec) {
    disposeGroup(state.group);
    const root = new THREE.Group();
    state.group = root;
    state.floorGroups = [];
    const { w, d, floors } = spec;
    const lay = new Set(spec.layers);
    const x0 = -w / 2;
    const z0 = -d / 2;

    // chão e sombra de contato
    const gsize = Math.max(w, d) * 2.8;
    const disc = new THREE.Mesh(bgeo(new THREE.CircleGeometry(gsize / 2, 64)), mat('ground', { color: 0x222d36, roughness: 0.95, metalness: 0 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.02;
    root.add(disc);
    const grid = new THREE.GridHelper(gsize, 20, 0x3b5875, 0x2a3c4d);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.position.y = 0;
    track.push(grid.material);
    root.add(grid);
    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const r = g.createRadialGradient(64, 64, 8, 64, 64, 62);
      r.addColorStop(0, 'rgba(0,0,0,.55)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      return bgeo(new THREE.CanvasTexture(c));
    })();
    const shadow = new THREE.Mesh(bgeo(new THREE.PlaneGeometry(w * 1.7, d * 1.9)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    root.add(shadow);

    if (spec.terrain) {
      const seg = 44;
      const tg = bgeo(new THREE.PlaneGeometry(gsize * 0.92, gsize * 0.92, seg, seg));
      tg.rotateX(-Math.PI / 2);
      const pos = tg.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const lo = new THREE.Color(0x27404a);
      const hi = new THREE.Color(0x59c08a);
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const r = Math.hypot(x / (w * 1.1), z / (d * 1.2));
        const plateau = Math.min(1, Math.max(0, (r - 0.7) / 0.9));       // plataforma plana sob a obra
        const h = (Math.sin(x * 0.28) * 1.6 + Math.cos(z * 0.33) * 1.3 + Math.sin((x + z) * 0.17) * 1.1) * plateau * plateau;
        pos.setY(i, h);
        const c = lo.clone().lerp(hi, clamp01((h + 2.5) / 6));
        col.set([c.r, c.g, c.b], i * 3);
      }
      tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      tg.computeVertexNormals();
      const tm = new THREE.Mesh(tg, mat('terreno', { vertexColors: true, flatShading: true, opacity: 0.95, roughness: 0.9 }));
      tm.position.y = -0.04;
      tm.userData.layer = 'terreno';
      root.add(tm);
      const wire = new THREE.LineSegments(bgeo(new THREE.WireframeGeometry(tg)), lineMat('terreno-linha', 0x59c08a, 0.28));
      wire.position.y = -0.03;
      wire.userData.layer = 'terreno';
      root.add(wire);
    }

    const H = floors * FLOOR_H;
    // volume envoltório translúcido
    const env = new THREE.Mesh(boxGeo, mat('envelope', { color: 0x6aa0d8, opacity: 0.07, depthWrite: false }));
    env.scale.set(w, H, d);
    env.position.set(0, H / 2, 0);
    env.userData.envelope = true;
    root.add(env);
    const envEdges = new THREE.LineSegments(edgeGeo, lineMat('envelope-linha', 0x9cc2ec, 0.5));
    envEdges.scale.copy(env.scale);
    envEdges.position.copy(env.position);
    envEdges.userData.envelope = true;
    root.add(envEdges);

    // pavimentos: laje + elementos horizontais de cada camada
    for (let i = 0; i < floors; i += 1) {
      const fg = new THREE.Group();
      fg.userData.floor = i;
      const slab = new THREE.Mesh(boxGeo, mat('laje', { color: 0xcfe6fa, roughness: 0.6, opacity: 0.94 }));
      slab.scale.set(w, 0.34, d);
      slab.position.set(0, 0.17, 0);
      fg.add(slab);
      const slabEdge = new THREE.LineSegments(edgeGeo, lineMat('laje-linha', 0xffffff, 0.8));
      slabEdge.scale.copy(slab.scale);
      slabEdge.position.copy(slab.position);
      fg.add(slabEdge);

      if (lay.has('estrutura')) {
        for (const fz of [0.1, 0.5, 0.9]) {
          const b = new THREE.Mesh(boxGeo, mat('viga', { color: 0x6fc4ff, emissive: 0x6fc4ff, emissiveIntensity: 0.25 }));
          b.scale.set(w * 0.86, 0.26, 0.3);
          b.position.set(0, FLOOR_H - 0.13, z0 + d * fz);
          b.userData.layer = 'estrutura';
          fg.add(b);
        }
        for (const fx of [0.08, 0.5, 0.92]) {
          const b = new THREE.Mesh(boxGeo, mat('viga', {}));
          b.scale.set(0.3, 0.26, d * 0.8);
          b.position.set(x0 + w * fx, FLOOR_H - 0.13, 0);
          b.userData.layer = 'estrutura';
          fg.add(b);
        }
      }
      if (lay.has('hidrossanitario')) {
        const m = mat('hidro', { color: 0x35c6e8, emissive: 0x35c6e8, emissiveIntensity: 0.35 });
        const run = new THREE.Mesh(cylGeo, m);
        run.rotation.z = Math.PI / 2;
        run.scale.set(0.11, w * 0.66, 0.11);
        run.position.set(x0 + w * 0.2 + (w * 0.66) / 2, FLOOR_H - 0.5, z0 + d * 0.28);
        run.userData.layer = 'hidrossanitario';
        fg.add(run);
        const br = new THREE.Mesh(cylGeo, m);
        br.rotation.x = Math.PI / 2;
        br.scale.set(0.11, d * 0.46, 0.11);
        br.position.set(x0 + w * 0.7, FLOOR_H - 0.5, z0 + d * 0.28 + (d * 0.46) / 2);
        br.userData.layer = 'hidrossanitario';
        fg.add(br);
        const es = new THREE.Mesh(cylGeo, mat('esgoto', { color: 0x2a8fa8, emissive: 0x2a8fa8, emissiveIntensity: 0.2 }));
        es.rotation.z = Math.PI / 2;
        es.scale.set(0.15, w * 0.5, 0.15);
        es.position.set(x0 + w * 0.22 + (w * 0.5) / 2, FLOOR_H - 0.78, z0 + d * 0.72);
        es.userData.layer = 'hidrossanitario';
        fg.add(es);
      }
      if (lay.has('eletrica')) {
        const pts = [[0.2, 0.3], [0.42, 0.5], [0.62, 0.3], [0.82, 0.55], [0.3, 0.78], [0.72, 0.8]];
        const m = mat('eletrica', { color: 0xf2b134, emissive: 0xf2b134, emissiveIntensity: 0.55 });
        const verts = [];
        pts.forEach(([fx, fz]) => {
          const p = new THREE.Mesh(sphGeo, m);
          p.scale.setScalar(0.24);
          p.position.set(x0 + w * fx, FLOOR_H - 0.55, z0 + d * fz);
          p.userData.layer = 'eletrica';
          fg.add(p);
          verts.push(p.position.clone());
        });
        const lg = new THREE.BufferGeometry().setFromPoints(verts);
        const line = new THREE.Line(lg, lineMat('eletrica-linha', 0xf2b134, 0.9));
        line.userData.layer = 'eletrica';
        line.userData.own = true;
        fg.add(line);
      }
      if (lay.has('incendio')) {
        const m = mat('incendio', { color: 0xe5584a, emissive: 0xe5584a, emissiveIntensity: 0.4 });
        const h = new THREE.Mesh(cylGeo, m);
        h.scale.set(0.3, 0.9, 0.3);
        h.position.set(x0 + w * 0.9, 0.34 + 0.45, z0 + d * 0.15);
        h.userData.layer = 'incendio';
        fg.add(h);
        const top = new THREE.Mesh(sphGeo, m);
        top.scale.setScalar(0.24);
        top.position.set(x0 + w * 0.9, 0.34 + 1.0, z0 + d * 0.15);
        top.userData.layer = 'incendio';
        fg.add(top);
      }
      if (lay.has('gas')) {
        const g = new THREE.Mesh(cylGeo, mat('gas', { color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.35 }));
        g.rotation.z = Math.PI / 2;
        g.scale.set(0.09, w * 0.6, 0.09);
        g.position.set(x0 + w * 0.05 + (w * 0.6) / 2, 0.55, z0 + d * 0.95);
        g.userData.layer = 'gas';
        fg.add(g);
      }
      root.add(fg);
      state.floorGroups.push(fg);
    }

    // elementos verticais: escalam em y junto com a abertura dos pavimentos
    const vg = new THREE.Group();
    if (lay.has('estrutura')) {
      const m = mat('pilar', { color: 0x9cc2ec, emissive: 0x9cc2ec, emissiveIntensity: 0.18 });
      for (const fx of [0.08, 0.5, 0.92]) {
        for (const fz of [0.1, 0.5, 0.9]) {
          const p = new THREE.Mesh(boxGeo, m);
          p.scale.set(0.34, H, 0.34);
          p.position.set(x0 + w * fx, H / 2, z0 + d * fz);
          p.userData.layer = 'estrutura';
          p.userData.floorsH = H;
          vg.add(p);
        }
      }
    }
    if (lay.has('hidrossanitario')) {
      const p = new THREE.Mesh(cylGeo, mat('hidro', {}));
      p.scale.set(0.16, H, 0.16);
      p.position.set(x0 + w * 0.2, H / 2, z0 + d * 0.28);
      p.userData.layer = 'hidrossanitario';
      vg.add(p);
    }
    if (lay.has('eletrica')) {
      const q = new THREE.Mesh(boxGeo, mat('eletrica', {}));
      q.scale.set(0.2, H, 0.2);
      q.position.set(x0 + w * 0.92, H / 2, z0 + d * 0.55);
      q.userData.layer = 'eletrica';
      vg.add(q);
    }
    if (lay.has('gas')) {
      const p = new THREE.Mesh(cylGeo, mat('gas', {}));
      p.scale.set(0.09, H, 0.09);
      p.position.set(x0 + w * 0.05, H / 2, z0 + d * 0.95);
      p.userData.layer = 'gas';
      vg.add(p);
    }
    root.add(vg);
    state.verticals = vg;
    stage.add(root);
  }

  // ---- aplicação do estado animado ----
  function apply() {
    const spec = state.spec;
    if (!spec) return;
    const k = state.k;
    state.floorGroups.forEach((fg, i) => {
      const p = ease(state.appear.get(`f${i}`) ?? 1);
      fg.position.y = i * FLOOR_H * k;
      fg.scale.set(1, Math.max(0.001, p), 1);
      fg.visible = p > 0.005;
    });
    if (state.verticals) {
      state.verticals.scale.y = k;
      // cada elemento vertical tem a altura total dos pavimentos; o conjunto cresce com o último pavimento aparecido
      const last = ease(state.appear.get(`f${spec.floors - 1}`) ?? 1);
      state.verticals.scale.y = k * Math.max(0.001, last);
    }
    // opacidade de camadas e do terreno acompanha o progresso de cada uma
    const layerP = (id) => ease(state.appear.get(`l:${id}`) ?? 1);
    state.group?.traverse((o) => {
      const id = o.userData?.layer;
      if (id && o.material) {
        const a = layerP(id);
        o.visible = a > 0.01;
        o.material.opacity = (o.material.userData.base ?? 1) * a;
      }
    });
    const planta = state.view === 'planta';
    state.group?.traverse((o) => { if (o.userData?.envelope) o.visible = !planta; });
    cutPlane.constant = 0.4 + 60 * (1 - clamp01(state.cut));
    renderer.clippingPlanes = state.cut > 0.02 ? [cutPlane] : [];
    // câmera
    const H = spec.floors * FLOOR_H * k;
    const ty = H * 0.45;
    state.ty = ty;
    const az = deg(state.az);
    const el = deg(state.el);
    camera.position.set(Math.sin(az) * Math.cos(el) * state.dist, ty + Math.sin(el) * state.dist, Math.cos(az) * Math.cos(el) * state.dist);
    camera.lookAt(0, ty - state.dist * 0.05, 0);
    renderer.render(scene, camera);
  }

  function targetDistance(spec, view) {
    const k = VIEW_CAM[view].k;
    const H = spec.floors * FLOOR_H * k;
    const r = 0.5 * Math.hypot(spec.w, spec.d, H) * 1.06;
    const aspect = camera.aspect || 1.6;
    const fovV = deg(camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const f = Math.min(fovV, fovH);
    const planta = view === 'planta';
    return (planta ? Math.max(spec.w, spec.d * aspect * 0.7) * 0.78 : r / Math.sin(f / 2)) * 0.7;
  }

  // ---- laço sob demanda: roda só enquanto algo se move ----
  function step(dt) {
    let moving = false;
    const damp = (cur, tgt, rate) => {
      const next = cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
      if (Math.abs(next - tgt) < 0.002 * Math.max(1, Math.abs(tgt))) return tgt;
      moving = true;
      return next;
    };
    state.k = damp(state.k, state.kT, 4);
    state.az = damp(state.az, state.azT, 4);
    state.el = damp(state.el, state.elT, 4);
    state.dist = damp(state.dist, state.distT, 4);
    state.cut = damp(state.cut, state.cutT, 4);
    for (const [key, target] of state.appearT) {
      const cur = state.appear.get(key) ?? 0;
      const rate = key.startsWith('f') ? 2.4 : 2.0;
      const next = Math.abs(cur - target) < 0.004 ? target : cur + (target - cur) * (1 - Math.exp(-rate * dt));
      if (next !== target) moving = true;
      state.appear.set(key, next);
    }
    return moving;
  }

  let last = 0;
  function frame(now) {
    state.raf = 0;
    if (state.destroyed || !state.visible || document.hidden) { state.running = false; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const moving = reducedSnap() ? snapAll() : step(dt);
    apply();
    if (moving || state.dragging) state.raf = requestAnimationFrame(frame);
    else { state.running = false; last = 0; }
  }
  const reducedSnap = () => reduced;
  function snapAll() {
    state.k = state.kT; state.az = state.azT; state.el = state.elT; state.dist = state.distT; state.cut = state.cutT;
    for (const [key, target] of state.appearT) state.appear.set(key, target);
    return false;
  }
  function kick() {
    if (state.destroyed || !state.visible) return;
    if (!state.running) { state.running = true; state.raf = requestAnimationFrame(frame); }
    // garantia: se a aba não entregar quadros (segundo plano), o estado final ainda é desenhado
    clearTimeout(state.safety);
    state.safety = setTimeout(() => { if (!state.destroyed) { snapAll(); apply(); state.running = false; } }, 2600);
  }

  // ---- tamanho ----
  const resize = () => {
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (state.spec) { state.distT = targetDistance(state.spec, state.view); if (!state.running) state.dist = state.distT; }
    kick();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---- interação: arrastar na horizontal gira; a página continua rolando na vertical (touch-action: pan-y) ----
  let px = 0;
  const onDown = (e) => { state.dragging = true; px = e.clientX; host.setPointerCapture?.(e.pointerId); kick(); };
  const onMove = (e) => {
    if (!state.dragging) return;
    state.azT += (e.clientX - px) * 0.45;
    state.az = state.azT;
    px = e.clientX;
    kick();
  };
  const onUp = () => { state.dragging = false; };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { state.azT -= 10; kick(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.azT += 10; kick(); e.preventDefault(); }
  };
  host.addEventListener('keydown', onKey);

  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  return {
    canvas,
    update(spec, view = state.view) {
      const prev = state.spec;
      state.spec = spec;
      state.view = view;
      const cfg = VIEW_CAM[view];
      build(spec);
      // o que já existia aparece pronto; o que é novo se forma
      const keys = [];
      for (let i = 0; i < spec.floors; i += 1) keys.push(`f${i}`);
      for (const l of [...spec.layers, ...(spec.terrain ? ['terreno'] : [])]) keys.push(`l:${l}`);
      state.appearT = new Map();
      for (const key of keys) {
        const existed = prev && (key.startsWith('f') ? Number(key.slice(1)) < prev.floors : (key === 'l:terreno' ? prev.terrain : prev.layers.includes(key.slice(2))));
        if (!existed) state.appear.set(key, 0);
        else if (!state.appear.has(key)) state.appear.set(key, 1);
        state.appearT.set(key, 1);
      }
      if (!prev) { state.azT = cfg.az; state.az = cfg.az - 30; }
      else state.azT = cfg.az;
      state.elT = cfg.el;
      state.kT = cfg.k;
      state.cutT = cfg.cut ? 1 : 0;
      state.distT = targetDistance(spec, view);
      if (!prev) { state.dist = state.distT * 1.25; state.el = cfg.el; state.k = cfg.k; }
      resize();
      apply();
      kick();
    },
    setView(view) {
      if (!state.spec) return;
      const cfg = VIEW_CAM[view];
      state.view = view;
      state.azT = cfg.az;
      state.elT = cfg.el;
      state.kT = cfg.k;
      state.cutT = cfg.cut ? 1 : 0;
      state.distT = targetDistance(state.spec, view);
      kick();
    },
    setVisible(v) { state.visible = v; if (v) kick(); },
    render: () => { snapAll(); apply(); },
    stats: () => ({ geometries: renderer.info.memory.geometries, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    destroy() {
      state.destroyed = true;
      cancelAnimationFrame(state.raf);
      clearTimeout(state.safety);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      host.removeEventListener('keydown', onKey);
      disposeGroup(state.group);
      geos.forEach((g) => g.dispose());
      track.forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}

// Maquete V05 — cena Three.js da calculadora. Three 0.160.0, o mesmo arquivo já hospedado pelo site, por import() dinâmico.
// CÓPIA de docs/prototipos/calculadora-v05/src/scene.mjs; a única diferença é como o Three e os complementos são carregados.
// Só DESENHA as peças do gerador (building.mjs). Não calcula preço e não expõe contagem de peças.
import { generate, fitBox, FH, BASE_Y, LAYER_LABEL, ILLUSTRATIVE_NOTE, scaleBar } from './maquete5_building.mjs';
import { transition } from './maquete5_transicao.mjs';   // R2: lógica da transição, pura e testada

const THREE_URL = '/assets/vendor/three/build/three.module.js';
// Complementos (ambiente de estúdio e oclusão): opcionais. Se a pasta não tiver os arquivos, a cena segue sem eles.
const ADDONS_URL = '/assets/vendor/three/examples/jsm/';
const addon = (file) => import(/* @vite-ignore */ `${ADDONS_URL}${file}`);
let THREE = null;   // preenchido em createMaqueteV5; nenhuma função deste módulo roda antes disso

export const VIEWS = [
  { id: 'conjunto', label: 'Conjunto' },
  { id: 'disciplinas', label: 'Disciplinas' },
  { id: 'pavimentos', label: 'Pavimentos' },
  { id: 'corte', label: 'Corte' },
  { id: 'planta', label: 'Planta' },
];
const VIEW_CAM = {
  conjunto: { az: 28, el: 21, fov: 30, k: 1, ghost: false, cut: null },   // R2: 17 -> 21 graus
  disciplinas: { az: 38, el: 24, fov: 30, k: 1, ghost: true, cut: null },
  pavimentos: { az: 38, el: 18, fov: 30, k: 1.75, ghost: false, cut: null },
  corte: { az: 12, el: 15, fov: 30, k: 1, ghost: false, cut: 'v' },
  planta: { az: 0, el: 89.6, fov: 7, k: 1, ghost: false, cut: 'h' },
};
export const LAYER_COLOR = {
  arquitetura: '#f4f2ee', estrutura: '#9aa7b4', hidrossanitario: '#35a8e8', eletrica: '#f2b134', incendio: '#e5484a', gas: '#a78bfa', terreno: '#59c08a',
};
// Materiais foscos de caixa que só diferem na cor: viram UM grupo por camada, com a cor por peça (instanceColor).
// Menos grupos = menos chamadas de desenho em todas as passadas (cena, sombra e oclusão).
const MERGED = new Set(['parede', 'concreto', 'fundacao', 'porta', 'neutro', 'pedra', 'madeira', 'deck', 'escada', 'piso', 'fundo']);   // R2: esquadria fora, para manter o contorno forte
const MAT = {
  fosco: { color: 0xffffff, roughness: 0.9 },
  laje: { color: 0xe6e3dd, roughness: 0.9, skipY: true },
  parede: { color: 0xf3f1ec, roughness: 0.92 },
  concreto: { color: 0xb4bbc3, roughness: 0.85 },
  fundacao: { color: 0x8d969f, roughness: 0.95 },
  telhado: { color: 0xa9b4c0, roughness: 0.8 },
  porta: { color: 0x3a3936, roughness: 0.7 },          // R2: grafite, distinta do revestimento (antes 0x8a6f57, quase o tom da pedra)
  neutro: { color: 0xd2d5d7, roughness: 0.9 },
  piso: { color: 0x9a958c, roughness: 0.95 },          // R2: caminho, garagem e varanda no tom do chão (antes, placas claras soltas)
  esquadria: { color: 0x2c3440, roughness: 0.5, metalness: 0.3 },
  pedra: { color: 0x9a7b5c, roughness: 0.95 },
  madeira: { color: 0xa9683c, roughness: 0.7 },
  deck: { color: 0xcdb999, roughness: 0.85 },
  fundo: { color: 0x1f5f7d, roughness: 0.9 },          // R2 (B2): fundo da piscina, visto através da água
  agua: { color: 0x2f9fd8, roughness: 0.08, metalness: 0.1, opacity: 0.78, glass: true, emissive: 0x1b7fc0, emissiveIntensity: 0.25 },
  fantasma: { color: 0xa9bccf, roughness: 0.6, opacity: 0.26, glass: true },
  escada: { color: 0xd6d1c8, roughness: 0.9 },
  vidro: { color: 0x35506c, roughness: 0.12, metalness: 0.2, opacity: 0.62, glass: true },
  reservatorio: { color: 0x7fc4ee, roughness: 0.5, emissive: 0x7fc4ee, emissiveIntensity: 0.12 },
  af: { color: 0x35a8e8, roughness: 0.45, emissive: 0x35a8e8, emissiveIntensity: 0.3 },
  es: { color: 0xa0714a, roughness: 0.6, emissive: 0xa0714a, emissiveIntensity: 0.18 },
  eletrica: { color: 0xf2b134, roughness: 0.5, emissive: 0xf2b134, emissiveIntensity: 0.35 },
  arvore: { color: 0xffffff, roughness: 0.95, vertexColors: true },   // R2 (B3): cor vem da geometria (tronco e copa)
  luz: { color: 0xffe08a, roughness: 0.4, emissive: 0xffd166, emissiveIntensity: 0.9 },
  incendio: { color: 0xe5484a, roughness: 0.5, emissive: 0xe5484a, emissiveIntensity: 0.3 },
  gas: { color: 0xa78bfa, roughness: 0.5, emissive: 0xa78bfa, emissiveIntensity: 0.3 },
};
const STAGE_BG = 0x1b242d;
export const PIPE_VIS = 2.2;
// R2: transições quando a pessoa marca ou desmarca um serviço
const LEAVE_S = 0.4;        // peça que sai encolhe neste tempo (s)
const TINT_S = 0.9;         // peça que só muda de material troca a cor neste tempo (s)
const REVEAL_ALPHA = 0.2;   // edificação translúcida enquanto a disciplina nova monta
const REVEAL_HOLD = 900;    // depois que a montagem termina, a edificação ainda fica translúcida por este tempo (ms)

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; }
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const deg = (a) => (a * Math.PI) / 180;

// Arestas desenhadas no próprio material das caixas: linha de largura constante em pixels na borda de cada face.
function withEdges(material, strength = 0.55, skipY = false) {
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fax;\nvarying vec2 vUvE;\nvarying vec2 vSzE;\nvarying float vSkE;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #else
          vec3 sc = vec3(1.0);
        #endif
        vUvE = uv;
        vSkE = (fax.x < 0.5 && fax.y > 1.5) ? 1.0 : 0.0;
        vSzE = vec2(fax.x < 0.5 ? sc.x : (fax.x < 1.5 ? sc.y : sc.z), fax.y < 0.5 ? sc.x : (fax.y < 1.5 ? sc.y : sc.z));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vUvE;\nvarying vec2 vSzE;\nvarying float vSkE;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 ddE = min(vUvE, 1.0 - vUvE) * vSzE;
        float dE = min(ddE.x, ddE.y);
        float wE = max(fwidth(dE), 1e-5);
        float eE = (1.0 - smoothstep(wE * 0.7, wE * 1.7, dE)) * (1.0 - vSkE * ${skipY ? '1.0' : '0.0'});
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.22, eE * ${strength.toFixed(2)});`);
  };
  material.customProgramCacheKey = () => `edges${strength}${skipY}`;
  return material;
}

function boxGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  // eixos (u,v) de cada face, na ordem do BoxGeometry: +x,-x (u=z,v=y) · +y,-y (u=x,v=z) · +z,-z (u=x,v=y)
  const axes = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]];
  const fax = new Float32Array(24 * 2);
  for (let f = 0; f < 6; f += 1) for (let v = 0; v < 4; v += 1) fax.set(axes[f], (f * 4 + v) * 2);
  g.setAttribute('fax', new THREE.BufferAttribute(fax, 2));
  return g;
}

// Prisma de duas águas: x e z em [-0.5,0.5]; y de 0 (beiral) a 1 (cumeeira, ao longo de x). Sólido fechado.
function gableGeometry() {
  const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 0, -0.5], D = [-0.5, 0, -0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0];
  const tris = [A, B, F, A, F, E, C, D, E, C, E, F, D, A, E, B, C, F, A, D, C, A, C, B];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  g.computeVertexNormals();
  return g;
}

// R2 (B3): árvore = tronco + copa numa só geometria, com cor por vértice; centrada em y (de -0,5 a 0,5) como a caixa.
function treeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.06, 0.08, 0.42, 6).toNonIndexed();
  trunk.translate(0, -0.29, 0);
  const crown = new THREE.IcosahedronGeometry(0.5, 1);
  crown.scale(1, 0.72, 1);
  crown.translate(0, 0.14, 0);
  const pos = []; const nor = []; const col = [];
  for (const [g, hex] of [[trunk, 0x6b5240], [crown, 0x5b8a62]]) {
    g.computeVertexNormals();
    const c = new THREE.Color(hex);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i += 1) col.push(c.r, c.g, c.b);
    g.dispose();
  }
  const t = new THREE.BufferGeometry();
  t.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  t.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  t.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return t;
}

function hatchTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#dfe6ee';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#1f5b96';
  g.lineWidth = 5;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createMaqueteV5(host, { reduced = false, mobile = false, ao = !mobile, onPick = null, onFrame = null } = {}) {
  THREE = await import(/* @vite-ignore */ THREE_URL);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, stencil: true, powerPreference: mobile ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(STAGE_BG, 1);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  canvas.className = 'mq-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE_BG);
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.5, 4000);

  // luz de estúdio: ambiente suave (sala) + chave com sombra + contraluz fria
  let envRT = null;
  try {
    const { RoomEnvironment } = await addon('environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();
  } catch { /* sem ambiente: as luzes abaixo bastam */ }
  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x55606b, envRT ? 0.32 : 1.0));   // R2: chão menos escuro, parede lê branca
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xd4dde8, 0.35);                          // R2: contraluz menos azul
  scene.add(rim);

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
  const cutPlanes = [];                               // compartilhado por todos os materiais; vazio = sem corte
  const stage = new THREE.Group();
  scene.add(stage);

  const geo = { box: boxGeometry(), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), gable: gableGeometry(), arvore: treeGeometry() };
  const hatch = hatchTexture();
  const capMat = new THREE.MeshBasicMaterial({
    map: hatch, side: THREE.DoubleSide, toneMapped: false,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), capMat);
  cap.renderOrder = 1.1;
  cap.userData.noAO = true;
  cap.onAfterRender = () => renderer.clearStencil();
  cap.visible = false;
  scene.add(cap);
  const stencilMat = (side, op) => new THREE.MeshBasicMaterial({
    side, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: cutPlanes,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
  });
  const stBack = stencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp);
  const stFront = stencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp);

  const state = {
    spec: null, dims: null, parts: [], buckets: [], stages: [], maxOrder: 1,
    view: 'conjunto', isolate: null, cutFrac: 0.36, planFloor: 0,
    az: 38, azT: 38, el: 24, elT: 24, fov: 30, fovT: 30, dist: 60, distT: 60, zoom: 1, zoomT: 1,
    k: 1, kT: 1, T: 0, TT: 0, playing: false,
    alpha: new Map(), alphaT: new Map(),
    cutOn: 0, cutOnT: 0,
    band: 0.2, visible: true, running: false, raf: 0, safety: 0, destroyed: false, dragging: false, moved: 0,
    picked: null, dirty: true, shadowDirty: true, ground: null,
    colorT: 1, tintDirty: false, leaveT: 1, revealOn: false, revealTimer: 0,
  };
  const dummy = new THREE.Object3D();
  const qAxis = { y: new THREE.Quaternion(), x: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), z: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) };
  const tint = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  const accent = new THREE.Color(0x4aa3ff);
  const tintTo = new THREE.Color();

  function clearBuild() {
    for (const h of state.helpers ?? []) { stage.remove(h); h.dispose?.(); }
    state.helpers = [];
    state.helperKey = null;
    for (const b of state.buckets) {
      stage.remove(b.mesh);
      b.mesh.dispose?.();
      b.material.dispose();
      b.edges?.geometry.dispose();
      b.edges?.material.dispose();
    }
    if (state.ground) { stage.remove(state.ground); state.ground.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    state.buckets = [];
    state.ground = null;
  }

  function buildGround(spec, dims) {
    const g = new THREE.Group();
    const R = Math.max(spec.w, spec.d) * 0.72 + 3 + (dims.pool ? dims.pool.w + 2.5 : 0);   // R2: base menor, casa maior no quadro
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x33414e, roughness: 1, metalness: 0, clippingPlanes: cutPlanes, clipShadows: true });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, 72), baseMat);
    plate.position.y = -0.15;
    plate.receiveShadow = true;
    plate.userData.ground = true;
    state.plate = plate;
    g.add(plate);
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(R, R, 0.3, 72), 30), new THREE.LineBasicMaterial({ color: 0x4d6a86, transparent: true, opacity: 0.8 }));
    ring.position.y = -0.15;
    g.add(ring);
    const gN = Math.max(2, Math.floor((R * 1.36) / 5));
    const grid = new THREE.GridHelper(gN * 5, gN, 0x40586f, 0x34485b);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    grid.material.depthWrite = false;
    grid.userData.noAO = true;
    g.add(grid);
    if (spec.terrain) {
      plate.visible = false; ring.visible = false; grid.visible = false;   // o terreno é a própria base
      const seg = 96;
      const size = R * 2;
      const tg = new THREE.PlaneGeometry(size, size, seg, seg);
      tg.rotateX(-Math.PI / 2);
      const pos = tg.attributes.position;
      const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i); const z = pos.getZ(i);
        // plataforma plana sob a obra; talude suave até o terreno natural (relevo de desenho, sem medida)
        const r = Math.max(Math.abs(x) / (spec.w / 2 + 2.5), Math.abs(z) / (spec.d / 2 + 2.5));
        const natural = Math.sin(x * 0.09 + 0.6) * 1.3 + Math.cos(z * 0.11) * 1.0 + (x * 0.6 + z) * 0.05;
        pos.setY(i, natural * sm(1, 1.9, r) + 0.02);
      }
      tg.computeVertexNormals();
      const tmat = new THREE.MeshStandardMaterial({ color: 0x4a5f57, roughness: 1, clippingPlanes: cutPlanes, clipShadows: true });
      tmat.onBeforeCompile = (sh) => {
        sh.uniforms.uR = { value: R };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vWP;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
uniform float uR;`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            if (length(vWP.xz) > uR) discard;
            float hC = vWP.y / 0.5;
            float fwC = fwidth(hC);
            float lnC = (1.0 - clamp(abs(fract(hC - 0.5) - 0.5) / max(fwC, 1e-5), 0.0, 1.0)) * smoothstep(0.002, 0.012, fwC);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.88, 0.70), lnC * 0.85);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22, 1.0 - smoothstep(0.0, 0.004, fwC));`);
      };
      const tm = new THREE.Mesh(tg, tmat);
      tm.receiveShadow = true;
      tm.userData.ground = true;
      g.add(tm);
    }
    stage.add(g);
    state.ground = g;
    // sombra: o volume inteiro cabe no frustum da luz
    const rad = Math.hypot(spec.w, spec.d) / 2 + 4;
    const cam = sun.shadow.camera;
    const S = rad + dims.height * 1.2; cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.near = 1; cam.far = rad * 6 + dims.height * 3;
    cam.updateProjectionMatrix();
    state.sunRad = rad;
    placeSun();
    sun.target.position.set(0, dims.height / 3, 0);
    rim.position.set(-rad * 2, rad, -rad * 1.5);
  }

  function placeSun() {
    const rad = state.sunRad ?? 20;
    const h = state.dims?.height ?? 6;
    if (state.view === 'planta') sun.position.set(0.02, rad * 3 + h * 2, 0.02);
    else sun.position.set(rad * 1.6, rad * 1.5 + h, rad * 0.7);     // R2 (B1): sol da direita; a sombra da casa cai à esquerda, à vista, longe da piscina
    state.shadowDirty = true;
  }

  function build(spec, prev) {
    clearBuild();
    const { parts, dims, stages } = generate(spec);
    state.dims = dims;
    state.stages = stages;
    state.parts = parts;
    state.maxOrder = parts.reduce((m, p) => Math.max(m, p.order), 0) + 1.2;
    buildGround(spec, dims);
    // R2: o que ficou não cresce de novo (e troca a cor se mudou de material); o que saiu encolhe (ver maquete5_transicao.mjs)
    const tr = transition(prev, parts, (p) => (p.shape === 'box' && MERGED.has(p.mat) ? MAT[p.mat].color : 0xffffff), { reduced });
    parts.push(...tr.leaving);                                     // no fim de cada grupo: a cena para de desenhá-las ao fim da saída
    const groups = new Map();
    for (const p of parts) {
      const k = `${p.shape}|${p.shape === 'box' && MERGED.has(p.mat) ? 'fosco' : p.mat}|${p.layer}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    const newOrders = parts.filter((p) => !p.settled).map((p) => p.order);
    state.newMin = newOrders.length ? Math.min(...newOrders) : 0;
    for (const [k, list] of groups) {
      const [shape, matKey, layer] = k.split('|');
      const def = MAT[matKey];
      const material = new THREE.MeshStandardMaterial({
        color: def.color, roughness: def.roughness ?? 0.8, metalness: def.metalness ?? 0, envMapIntensity: 0.28,
        emissive: def.emissive ?? 0x000000, emissiveIntensity: def.emissiveIntensity ?? 0,
        transparent: !!def.glass, opacity: def.opacity ?? 1, depthWrite: !def.glass, vertexColors: !!def.vertexColors,
        clippingPlanes: cutPlanes, clipShadows: true,
      });
      material.userData.base = def.opacity ?? 1;
      // R2 (ajuste 3): contorno fraco nas vedações e no acabamento; forte na estrutura
      const edge = def.edge ?? (def.glass ? 0.3 : matKey === 'fosco' && layer !== 'estrutura' ? 0.3 : matKey === 'laje' ? 0.45 : 0.72);
      if (shape === 'box') withEdges(material, edge, !!def.skipY);
      const mesh = new THREE.InstancedMesh(geo[shape], material, list.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = !def.glass;
      mesh.receiveShadow = !def.glass;
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i += 1) mesh.setColorAt(i, tint.set(list[i].fromHex ?? list[i].tintHex));
      if (shape === 'gable') material.side = THREE.DoubleSide;      // telhado: casca oca no corte (sem tampa)
      const capped = !def.glass && shape !== 'gable' && shape !== 'arvore';   // entra na tampa do corte (vegetação não)
      let edges = null;
      if (shape === 'gable') {
        edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo.gable, 20), new THREE.LineBasicMaterial({ color: 0x3c4856, transparent: true, clippingPlanes: cutPlanes }));
        edges.userData.noAO = true;
        mesh.add(edges);
      }
      stage.add(mesh);
      state.buckets.push({ mesh, capped, shape, ghost: false, material, list, layer, glass: !!def.glass, edges, allLeaving: list.every((p) => p.leaving), liveCount: list.filter((p) => !p.leaving).length });
      list.forEach((p, i) => { p.bucket = state.buckets.length - 1; p.index = i; });
    }
    // Auxiliares da tampa do corte: só escrevem no stencil, então não dependem do material.
    // Um par (face de trás, face da frente) por FORMA, e não por grupo de material: 4 chamadas no lugar de 2 por grupo.
    for (const shape of ['box', 'cyl']) {
      const total = state.buckets.reduce((n, b) => n + (b.capped && b.shape === shape ? b.list.length : 0), 0);
      if (!total) continue;
      for (const sm of [stBack, stFront]) {
        const h = new THREE.InstancedMesh(geo[shape], sm, total);
        h.count = 0;
        h.frustumCulled = false;
        h.renderOrder = 1;
        h.visible = false;
        h.userData.noAO = true;
        h.userData.shape = shape;
        stage.add(h);
        state.helpers.push(h);
      }
    }
    for (const l of new Set(parts.map((p) => p.layer))) if (!state.alpha.has(l)) state.alpha.set(l, 1);
    state.dirty = true;
    state.shadowDirty = true;
    return tr;
  }

  // ---- posição animada de cada peça ----
  function layout() {
    const k = state.k;
    const floors = state.spec.floors;
    for (const b of state.buckets) {
      for (const p of b.list) {
        const local = p.settled ? 1 : clamp01((state.T - (p.order - state.newMin)) / 1.0);
        const lift = (p.floor < 0 ? 0 : Math.min(p.floor, floors)) * FH * (k - 1) + (p.floor >= floors && k > 1 ? 0.6 * (k - 1) * FH : 0);
        const e = local <= 0 ? 0 : (p.anim === 'pop' ? Math.max(0, outBack(local)) : ease(local));
        let [x, y, z] = p.p;
        let [sx, sy, sz] = p.s;
        if (p.shape === 'cyl' && sx < 0.1) { sx *= PIPE_VIS; sz *= PIPE_VIS; }   // tubos: espessura ampliada só no visual
        if (p.leaving) { const g = 1 - ease(clamp01(state.leaveT / LEAVE_S)); sx *= g; sy *= g; sz *= g; } else if (e <= 0) { sx = sy = sz = 0; } else if (p.anim === 'drop') {
          y += (1 - e) * 1.6; sx *= 0.9 + 0.1 * e; sz *= 0.9 + 0.1 * e; sy *= e;
        } else if (p.anim === 'pop') { sx *= e; sy *= e; sz *= e; } else if ((p.axis ?? 'y') === 'y') {
          y = y - sy / 2 + (sy * e) / 2; sy *= e;
        } else sy *= e;
        dummy.position.set(x, y + lift, z);
        dummy.quaternion.copy(qAxis[p.axis ?? 'y']);
        dummy.scale.set(Math.max(sx, 1e-5), Math.max(sy, 1e-5), Math.max(sz, 1e-5));
        dummy.updateMatrix();
        b.mesh.setMatrixAt(p.index, dummy.matrix);
      }
      b.mesh.instanceMatrix.needsUpdate = true;
      b.mesh.boundingSphere = null;            // o raycast recalcula: as matrizes mudaram
      b.mesh.boundingBox = null;
    }
    state.layoutV = (state.layoutV ?? 0) + 1;
    state.shadowDirty = true;
  }

  // Tampa do corte: o stencil só precisa das peças que o plano atravessa (as demais se anulam e só custam desenho).
  const m4 = new THREE.Matrix4();
  function refreshHelpers() {
    if (!cutPlanes.length || !state.helpers?.length) return;
    const horizontal = Math.abs(cutPlane.normal.y) > 0.5;
    const key = `${horizontal}|${cutPlane.constant.toFixed(3)}|${state.layoutV}|${state.buckets.map((b) => (b.ghost ? 1 : 0)).join('')}`;
    if (key === state.helperKey) return;
    state.helperKey = key;
    const n = { box: 0, cyl: 0 };
    for (const b of state.buckets) {
      if (!b.capped || b.ghost) continue;                    // camada translúcida ou oculta não entra na tampa
      const hs = state.helpers.filter((h) => h.userData.shape === b.shape);
      for (const p of b.list) {
        if (p.leaving) continue;                              // R2: peça que saiu não entra na tampa
        b.mesh.getMatrixAt(p.index, m4);
        const c = horizontal ? m4.elements[13] : m4.elements[14];
        const half = 0.5 * Math.max(p.s[0], p.s[1], p.s[2]) * (p.shape === 'cyl' ? PIPE_VIS : 1) + 0.05;
        if (Math.abs(c - cutPlane.constant) <= half) { for (const h of hs) h.setMatrixAt(n[b.shape], m4); n[b.shape] += 1; }
      }
    }
    for (const h of state.helpers) { h.count = n[h.userData.shape]; h.instanceMatrix.needsUpdate = true; }
  }

  function applyMaterials() {
    const cutting = state.cutOn > 0.02 && !(mobile && state.dragging);    // no celular a tampa some enquanto se arrasta
    const ghostGround = VIEW_CAM[state.view].ghost;
    if (state.plate && state.plate.material.transparent !== ghostGround) {   // raio-X: a base fica translúcida e a fundação aparece
      state.plate.material.transparent = ghostGround; state.plate.material.opacity = ghostGround ? 0.3 : 1;
      state.plate.material.depthWrite = !ghostGround; state.plate.material.needsUpdate = true; state.plate.userData.noAO = ghostGround;
    }
    for (const b of state.buckets) {
      const a = state.alpha.get(b.layer) ?? 1;
      const op = b.material.userData.base * a;
      const ghost = a < 0.98 || b.glass;
      if (b.material.transparent !== ghost) { b.material.transparent = ghost; b.material.needsUpdate = true; }
      b.material.opacity = op;
      b.material.depthWrite = !ghost;
      if (b.mesh.castShadow !== !ghost) { b.mesh.castShadow = !ghost; state.shadowDirty = true; }
      b.mesh.userData.noAO = ghost;
      b.mesh.renderOrder = ghost ? 2 : 0;
      b.mesh.visible = a > 0.01 && !(b.allLeaving && state.leaveT >= LEAVE_S)
        && !(b.shape === 'arvore' && (VIEW_CAM[state.view].cut || VIEW_CAM[state.view].ghost));   // R2 (B3): vegetação só no Conjunto e nos Pavimentos
      b.mesh.count = state.leaveT >= LEAVE_S ? b.liveCount : b.list.length;   // R2: as que saíram ficam no fim do grupo e param de ser desenhadas
      if (b.edges) b.edges.material.opacity = a;
      b.ghost = ghost || a <= 0.01;
    }
    refreshHelpers();
    for (const h of state.helpers ?? []) h.visible = cutting;
  }

  function applyCut() {
    const { spec, dims } = state;
    const cfg = VIEW_CAM[state.view];
    const on = state.cutOn;
    if (on <= 0.02) {
      if (cutPlanes.length) { cutPlanes.length = 0; renderer.clippingPlanes = []; state.shadowDirty = true; }
      cap.visible = false;
      return;
    }
    if (!cutPlanes.length) { cutPlanes.push(cutPlane); renderer.clippingPlanes = cutPlanes; }
    const big = Math.max(spec.w, spec.d) * 4 + 40;
    cap.scale.set(big, big, 1);
    hatch.repeat.set(big / 0.6, big / 0.6);
    if ((cfg.cut ?? state.lastCut) === 'h') {
      const yFull = dims.height + 3;
      const yc = BASE_Y + state.planFloor * FH * state.k + 1.25;
      const y = yFull + (yc - yFull) * ease(on);
      cutPlane.normal.set(0, -1, 0); cutPlane.constant = y;
      cap.rotation.set(-Math.PI / 2, 0, 0); cap.position.set(0, y - 0.004, 0);
    } else {
      const zFull = spec.d / 2 + 3;
      const zc = spec.d / 2 - state.cutFrac * spec.d;
      const z = zFull + (zc - zFull) * ease(on);
      cutPlane.normal.set(0, 0, -1); cutPlane.constant = z;
      cap.rotation.set(0, 0, 0); cap.position.set(0, 0, z - 0.004);
    }
    cap.visible = !(mobile && state.dragging);
    refreshHelpers();
    state.shadowDirty = true;
  }

  function viewBox(view) {
    const { spec, dims } = state;
    const cfg = VIEW_CAM[view];
    if (view === 'planta') return { box: { w: spec.w + 2, h: 0.2, d: spec.d + 2 }, ty: BASE_Y + state.planFloor * FH + 1.2, tz: 0 };
    const under = view === 'corte' || view === 'disciplinas' ? 1.2 : 0;
    const h = dims.height + (cfg.k - 1) * FH * (spec.floors + 0.6) + under + 0.2;
    if (view === 'corte') {
      const zc = spec.d / 2 - state.cutFrac * spec.d;
      const dk = zc + spec.d / 2 + 1;
      return { box: { w: spec.w + 1.6, h, d: dk }, ty: h / 2 - under, tz: (zc - spec.d / 2 - 1) / 2 };
    }
    const side = dims.pool ? dims.pool.w + 2.4 : 0;                // piscina na lateral: o quadro se desloca para incluí-la
    const front = dims.front ?? 0;                                 // garagem e caminho de entrada à frente
    const left = dims.flora ? 2.4 : 0;                             // R2 (B3): árvore do lado esquerdo dentro do quadro
    return { box: { w: spec.w + 1.6 + side + left, h, d: spec.d + 1.6 + front }, ty: h / 2 - under, tz: front / 2, tx: (side - left) / 2 };
  }
  function retarget() {
    if (!state.spec) return;
    const cfg = VIEW_CAM[state.view];
    const vb = viewBox(state.view);
    state.fovT = cfg.fov;
    state.distT = fitBox(vb.box, { az: state.azT, el: state.elT, fovDeg: cfg.fov, aspect: camera.aspect || 1.6, band: state.band, margin: 0.97 });
    state.tyT = vb.ty; state.tzT = vb.tz; state.txT = vb.tx ?? 0;
    if (state.ty === undefined) { state.ty = vb.ty; state.tz = vb.tz; state.tx = state.txT; }
  }

  // ---- pós-processamento (só no computador): oclusão ambiente GTAO, do próprio pacote do three ----
  let composer = null;
  let gtao = null;
  if (ao) {
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
        addon('postprocessing/EffectComposer.js'), addon('postprocessing/RenderPass.js'),
        addon('postprocessing/GTAOPass.js'), addon('postprocessing/OutputPass.js'),
      ]);
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, stencilBuffer: true, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      gtao = new GTAOPass(scene, camera, 4, 4);
      gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.2, thickness: 1.2, scale: 1.25, samples: 16, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      gtao.blendIntensity = 1;
      const ov = gtao.overrideVisibility.bind(gtao);
      const rv = gtao.restoreVisibility.bind(gtao);
      const hidden = [];
      gtao.overrideVisibility = () => { scene.traverse((o) => { if (o.userData?.noAO && o.visible) { o.visible = false; hidden.push(o); } }); ov(); };
      gtao.restoreVisibility = () => { rv(); hidden.forEach((o) => { o.visible = true; }); hidden.length = 0; };
      composer.addPass(gtao);
      composer.addPass(new OutputPass());
    } catch (err) { composer = null; gtao = null; console.warn('maquete v05: sem pós-processamento', err); }
  }

  // R2: interpola a cor das peças que só mudaram de material
  function applyTints() {
    state.tintDirty = false;
    const t = ease(clamp01(state.colorT));
    for (const b of state.buckets) {
      let touched = false;
      for (const p of b.list) {
        if (p.fromHex == null || p === state.picked) continue;
        b.mesh.setColorAt(p.index, tint.set(p.fromHex).lerp(tintTo.set(p.tintHex), t));
        touched = true;
      }
      if (touched) b.mesh.instanceColor.needsUpdate = true;
    }
    if (t >= 1) for (const p of state.parts) p.fromHex = null;
  }

  function draw() {
    if (!state.spec) return;
    if (state.dirty) { layout(); state.dirty = false; }
    if (state.tintDirty) applyTints();
    applyMaterials();
    applyCut();
    const az = deg(state.az); const el = deg(state.el);
    const dist = state.dist * state.zoom;
    if (Math.abs(camera.fov - state.fov) > 1e-3) { camera.fov = state.fov; camera.updateProjectionMatrix(); }
    camera.near = Math.max(0.3, dist * 0.05); camera.far = dist * 4 + 400;
    camera.updateProjectionMatrix();
    const ty = state.ty ?? 3; const tz = state.tz ?? 0; const tx = state.tx ?? 0;
    camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
    camera.up.set(0, 1, 0);
    if (state.el > 89) camera.up.set(0, 0, -1);
    camera.lookAt(tx, ty, tz);
    if (state.shadowDirty) { renderer.shadowMap.needsUpdate = true; state.shadowDirty = false; }
    renderer.info.reset();
    if (composer) composer.render(); else renderer.render(scene, camera);
    onFrame?.(api);
  }

  function step(dt) {
    let moving = false;
    const damp = (cur, tgt, rate) => {
      if (cur === tgt || tgt === undefined) return tgt ?? cur;
      const next = cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
      if (Math.abs(next - tgt) < 0.0015 * Math.max(1, Math.abs(tgt))) return tgt;
      moving = true;
      return next;
    };
    state.az = damp(state.az, state.azT, 5); state.el = damp(state.el, state.elT, 5);
    state.fov = damp(state.fov, state.fovT, 5); state.dist = damp(state.dist, state.distT, 5);
    state.zoom = damp(state.zoom, state.zoomT, 8);
    state.ty = damp(state.ty, state.tyT, 5); state.tz = damp(state.tz, state.tzT, 5); state.tx = damp(state.tx ?? 0, state.txT ?? 0, 5);
    const k = damp(state.k, state.kT, 4);
    if (k !== state.k) { state.k = k; state.dirty = true; }
    state.cutOn = damp(state.cutOn, state.cutOnT, 5);
    for (const [l, t] of state.alphaT) {
      const a = damp(state.alpha.get(l) ?? 1, t, 7);
      state.alpha.set(l, a);
    }
    if (state.colorT < 1) { state.colorT = Math.min(1, state.colorT + dt / TINT_S); state.tintDirty = true; moving = true; }
    if (state.leaveT < LEAVE_S) { state.leaveT = Math.min(LEAVE_S, state.leaveT + dt); state.dirty = true; moving = true; }
    if (state.playing) {
      state.T = Math.min(state.TT, state.T + dt * state.rate);
      state.dirty = true;
      if (state.T >= state.TT) state.playing = false; else moving = true;
    }
    return moving;
  }
  function snapAll() {
    for (const key of ['az', 'el', 'fov', 'dist', 'zoom', 'k', 'cutOn', 'ty', 'tz', 'tx']) if (state[`${key}T`] !== undefined) state[key] = state[`${key}T`];
    for (const [l, t] of state.alphaT) state.alpha.set(l, t);
    state.T = state.TT; state.playing = false; state.dirty = true;
    state.colorT = 1; state.tintDirty = true; state.leaveT = LEAVE_S;
    return false;
  }
  let last = 0;
  function frame(now) {
    state.raf = 0;
    if (state.destroyed || !state.visible || document.hidden) { state.running = false; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const moving = reduced ? snapAll() : step(dt);
    draw();
    if (moving || state.dragging) state.raf = requestAnimationFrame(frame);
    else { state.running = false; last = 0; }
  }
  function kick() {
    if (state.destroyed || !state.visible) return;
    if (!state.running) { state.running = true; state.raf = requestAnimationFrame(frame); }
    clearTimeout(state.safety);
    state.safety = setTimeout(() => { if (!state.destroyed && !state.dragging) { snapAll(); draw(); state.running = false; } }, 9000);
  }

  function controlsBand(h) {
    const tabs = host.parentElement?.querySelector('.v5-bottom') ?? host.parentElement?.querySelector('.mq-tabs');
    if (!tabs || !h) return 0.05;
    return Math.min(0.55, Math.max(0.12, (tabs.offsetHeight + 16) / h));
  }
  const resize = () => {
    const w = host.clientWidth || 320; const h = host.clientHeight || 200;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    state.band = controlsBand(h);
    camera.setViewOffset(w, h, 0, Math.round((state.band * h) / 2), w, h);
    camera.updateProjectionMatrix();
    retarget();
    if (!state.running) { state.dist = state.distT; }
    kick();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function setAlphaTargets() {
    const cfg = VIEW_CAM[state.view];
    const layers = new Set(state.parts.map((p) => p.layer));
    for (const l of layers) {
      let a = 1;
      if (cfg.ghost) {
        if (l === 'volume') a = state.isolate === 'volume' ? 1 : 0.1;
        else if (state.isolate && state.isolate !== l) a = 0.07;
      }
      if (!cfg.ghost && state.revealOn && l === 'volume') a = REVEAL_ALPHA;   // R2: revelar ao marcar
      state.alphaT.set(l, a);
    }
  }

  // ---- interação ----
  const pointers = new Map();
  let pinch = 0;
  const onDown = (e) => {
    pointers.set(e.pointerId, e);
    state.dragging = true; state.moved = 0;
    try { host.setPointerCapture?.(e.pointerId); } catch { /* ponteiro sintético ou já solto */ }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    kick();
  };
  const onMove = (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch > 0) api.zoomBy(pinch / dd);
      pinch = dd; state.moved += 10;
      return;
    }
    const dx = e.clientX - prev.clientX; const dy = e.clientY - prev.clientY;
    state.moved += Math.abs(dx) + Math.abs(dy);
    state.azT -= dx * 0.4; state.az = state.azT;
    if (e.pointerType === 'mouse' && state.view !== 'planta') { state.elT = Math.max(4, Math.min(80, state.elT + dy * 0.3)); state.el = state.elT; }
    kick();
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) {
      state.dragging = false;
      if (state.moved < 5) pickAt(e.clientX, e.clientY);
      retarget(); kick();
    }
  };
  const onWheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); api.zoomBy(e.deltaY > 0 ? 1.08 : 0.92); };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { state.azT -= 10; kick(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.azT += 10; kick(); e.preventDefault(); }
    if (e.key === '+' || e.key === '=') { api.zoomBy(0.9); e.preventDefault(); }
    if (e.key === '-') { api.zoomBy(1.1); e.preventDefault(); }
    if (e.key === 'Escape') { setPicked(null); }
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('keydown', onKey);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function setPicked(p) {
    const old = state.picked;
    if (old && state.buckets[old.bucket]) { const m = state.buckets[old.bucket].mesh; m.setColorAt(old.index, tint.set(old.tintHex ?? 0xffffff)); m.instanceColor.needsUpdate = true; }
    state.picked = p;
    if (p) { const m = state.buckets[p.bucket].mesh; m.setColorAt(p.index, tint.copy(accent)); m.instanceColor.needsUpdate = true; }
    onPick?.(p ? { name: p.name, layer: p.layer, layerLabel: LAYER_LABEL[p.layer], note: ILLUSTRATIVE_NOTE } : null);
    kick();
  }
  function pickAt(cx, cy) {
    const r = host.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = state.buckets.filter((b) => (state.alpha.get(b.layer) ?? 1) > 0.5 && !b.glass && b.shape !== 'arvore').map((b) => b.mesh);
    const hits = ray.intersectObjects(targets, false).filter((h) => !cutPlanes.length || cutPlane.distanceToPoint(h.point) >= 0);
    if (!hits.length) { setPicked(null); return; }
    const b = state.buckets.find((x) => x.mesh === hits[0].object);
    setPicked(b.list[hits[0].instanceId] ?? null);
  }

  const api = {
    canvas,
    debug: { renderer, scene, sun, camera, state },
    update(spec, view = state.view) {
      const first = !state.spec;
      const tr = build(spec, first ? null : state.parts);
      state.spec = spec;
      state.picked = null;
      state.colorT = tr.recolor ? 0 : 1;
      state.tintDirty = false;
      state.leaveT = tr.leaving.length ? 0 : LEAVE_S;
      // R2 (ajuste 1): disciplina nova → a edificação fica translúcida enquanto ela monta, e depois volta
      clearTimeout(state.revealTimer);
      state.revealOn = tr.reveal;
      if (state.revealOn) state.revealTimer = setTimeout(() => { state.revealOn = false; setAlphaTargets(); kick(); }, 1400 + REVEAL_HOLD);
      state.planFloor = Math.min(state.planFloor, spec.floors - 1);
      const span = state.maxOrder - state.newMin;
      state.T = 0; state.TT = span; state.span = span; state.rate = span / (first ? 4.2 : 1.4); state.playing = state.parts.some((p) => !p.settled);
      api.setView(view, !first);
      if (first) { state.az = state.azT - 35; state.el = state.elT; state.fov = state.fovT; state.dist = state.distT * 1.2; state.k = state.kT; }
      resize();
    },
    setView(view, keepAngle = false) {
      if (!state.spec) return;
      const cfg = VIEW_CAM[view];
      if (cfg.cut) state.lastCut = cfg.cut;
      state.view = view;
      placeSun();
      if (!keepAngle || view === 'planta' || state.elT > 85) { state.azT = cfg.az; state.elT = cfg.el; }
      if (view === 'planta') { state.azT = Math.round(state.az / 360) * 360; }
      state.kT = cfg.k;
      state.cutOnT = cfg.cut ? 1 : 0;
      state.zoomT = 1;
      setAlphaTargets();
      retarget();
      kick();
    },
    setIsolate(layer) { state.isolate = layer; setAlphaTargets(); kick(); },
    setCut(frac) { state.cutFrac = clamp01(frac); retarget(); kick(); },
    setPlanFloor(i) { state.planFloor = Math.max(0, Math.min(state.spec.floors - 1, i)); retarget(); kick(); },
    replay() { for (const p of state.parts) p.settled = false; state.newMin = 0; state.span = state.maxOrder; state.T = 0; state.TT = state.maxOrder; state.rate = state.maxOrder / 5; state.playing = true; state.dirty = true; kick(); },
    scrub(frac) { for (const p of state.parts) p.settled = false; state.newMin = 0; state.span = state.maxOrder; state.playing = false; state.T = state.TT = clamp01(frac) * state.maxOrder; state.dirty = true; kick(); },
    progress: () => (state.parts.every((p) => p.settled) ? 1 : clamp01(state.T / (state.span || 1))),
    stages: () => state.stages.map((s) => ({ ...s, frac: s.at / state.maxOrder })),
    zoomBy(f) { state.zoomT = Math.max(0.45, Math.min(1.8, state.zoomT * f)); kick(); },
    layers: () => [...new Set(state.parts.filter((p) => !p.leaving).map((p) => p.layer))],
    // metros por pixel na distância do alvo (para a escala gráfica)
    scale() {
      const h = host.clientHeight || 1;
      const mpp = (2 * state.dist * state.zoom * Math.tan(deg(state.fov) / 2)) / h;
      return scaleBar(mpp);
    },
    // Rótulos de nível: posição na tela de cada pavimento (só no Corte e nos Pavimentos).
    levels() {
      if (!state.spec?.hasBuilding || !state.spec.floorsKnown || (state.view !== 'corte' && state.view !== 'pavimentos')) return [];
      const { spec } = state;
      const z = state.view === 'corte' ? spec.d / 2 - state.cutFrac * spec.d : spec.d / 2;
      const wpx = host.clientWidth; const hpx = host.clientHeight;
      const v = new THREE.Vector3();
      const out = [];
      for (let f = 0; f < spec.floors; f += 1) {
        v.set(-spec.w / 2 - 0.5, BASE_Y + f * FH * state.k + 1.4, z).project(camera);
        out.push({ label: f === 0 ? 'Térreo' : `${f + 1}º pav.`, x: (v.x * 0.5 + 0.5) * wpx, y: (-v.y * 0.5 + 0.5) * hpx });
      }
      return out;
    },
    setVisible(v) { state.visible = v; if (v) kick(); },
    render: () => { snapAll(); draw(); },
    busy: () => state.running,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, parts: state.parts.length, buckets: state.buckets.length, ao: !!composer }),
    destroy() {
      state.destroyed = true;
      cancelAnimationFrame(state.raf); clearTimeout(state.safety); clearTimeout(state.revealTimer); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const [t, f] of [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['wheel', onWheel], ['keydown', onKey]]) host.removeEventListener(t, f);
      clearBuild();
      Object.values(geo).forEach((g) => g.dispose());
      hatch.dispose(); capMat.dispose(); cap.geometry.dispose(); stBack.dispose(); stFront.dispose();
      envRT?.dispose(); composer?.dispose?.(); gtao?.dispose?.();
      renderer.dispose(); canvas.remove();
    },
  };
  return api;
}

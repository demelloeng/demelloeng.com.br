/* Maquete das redes hidrossanitárias em 3D (three.js): monta as redes de baixo para cima, separa as redes e identifica cada peça.
   Dados vêm do próprio modelo: o GLB (uma malha por camada) e o JSON com nome e pavimento de cada elemento.
   Pré-visualização: o importmap da página aponta para o jsDelivr; antes de publicar, three.js e addons passam a ficar hospedados no próprio site. */
const $ = (id) => document.getElementById(id);
const caixa = $('caixa'), palco = $('palco'), carregando = $('carregando');
const MODELOS = {
  hidro: { glb: caixa.dataset.glb, meta: caixa.dataset.meta, sub: 'Instalações de uma casa, em 3D · espessura ampliada', zoom: 1.05,
    dica: 'Casa com piscina. Espessura dos tubos ampliada. Toque nas peças.' },
};
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

let THREE, OrbitControls, GLTFLoader;
try {
  THREE = await import('three');
  ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
} catch (e) {
  carregando.textContent = 'Não foi possível carregar a maquete 3D. Atualize a página.';
  throw e;
}

// ordem de montagem; janela = trecho da montagem (0 a 1) em que a camada cresce; desloca = quanto sobe ao explodir (fração da altura)
const CAMADAS = [
  { id: 'esgoto',    nome: 'Esgoto',          um: 'Esgoto',         cor: 0xd6a56f, janela: [0.00, 0.50], desloca: -0.45 },
  { id: 'agua-fria', nome: 'Água fria',       um: 'Água fria',      cor: 0x5ab4ff, janela: [0.40, 0.85], desloca: 0.35 },
  { id: 'pluvial',   nome: 'Águas pluviais',  um: 'Águas pluviais', cor: 0x6fd3b0, janela: [0.70, 1.00], desloca: 1.15 },
];
const BASE_CAM = CAMADAS.map((k) => ({ um: k.um, nome: k.nome }));
const FUNDO = 0x1b242d, LINHA = 0xbfe3ff, DESTAQUE = 0xffffff;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lim = (t) => Math.max(0, Math.min(1, t));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
palco.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(FUNDO);
const camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 4000);
scene.add(new THREE.HemisphereLight(0xcfe2f6, 0x1b242d, 1.25));
const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(60, 90, 50); scene.add(sol);
const contra = new THREE.DirectionalLight(0x6aa0d8, 0.6); contra.position.set(-60, 30, -40); scene.add(contra);

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08; controles.enabled = false;
controles.autoRotate = !reduz; controles.autoRotateSpeed = 0.6;
controles.minPolarAngle = 0.001; controles.maxPolarAngle = Math.PI / 2 - 0.02;

const G = {};            // id -> { malha, faces, mat, matL, ymin, ymax, ligada, plano, meta }
let meta = null, tam = new THREE.Vector3(), raio = 50, alvo = new THREE.Vector3(), base = 0, H = 10;
let p = 0, raioX = false, pronto = false, aberta = false, girar = !reduz, tween = null, jaTocou = false;
let varredura, grade;

let raizAtual = null, modeloAtual = 'hidro';
function limpar() {
  if (raizAtual) scene.remove(raizAtual); if (grade) scene.remove(grade); if (varredura) scene.remove(varredura);
  raizAtual = grade = varredura = null;
  for (const k of Object.keys(G)) delete G[k];
  $('camadas').innerHTML = ''; destacar(null); escolhido = null; ficha.hidden = true; tip.hidden = true;
}
function carregarModelo(chave) {
  const M = MODELOS[chave]; modeloAtual = chave; pronto = false; tween = null; tweenCam = null; carregando.hidden = false; carregando.textContent = 'Carregando as redes…';
  limpar(); $('rotulo').querySelector('span').textContent = M.sub; $('ui').querySelector('.topo p').textContent = M.dica;
  return fetch(M.glb).then((r) => { if (!r.ok) throw new Error('GLB ' + r.status); return r.arrayBuffer(); })
  .then((buf) => Promise.all([new Promise((ok, no) => new GLTFLoader().parse(buf, '', ok, no)), fetch(M.meta).then((r) => r.json())]))
  .then(([gltf, m]) => {
    meta = m; CAMADAS.forEach((k, i) => Object.assign(k, BASE_CAM[i], (meta.rotulos || {})[k.id] || {}));
    const raiz = gltf.scene; scene.add(raiz); raizAtual = raiz;
    let cx = new THREE.Box3().setFromObject(raiz);
    const c = cx.getCenter(new THREE.Vector3());
    raiz.position.set(-c.x, -cx.min.y, -c.z); base = raiz.position.y;
    cx = new THREE.Box3().setFromObject(raiz); cx.getSize(tam); H = tam.y;
    raio = cx.getBoundingSphere(new THREE.Sphere()).radius; alvo.set(0, H * 0.3, 0);

    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const cam = CAMADAS.find((k) => k.id === o.name || (o.parent && k.id === o.parent.name));
      if (!cam) { o.visible = false; return; }   // só as três redes entram
      if (G[cam.id]) return;
      o.geometry.computeBoundingBox();
      const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x000000, roughness: 0.55, metalness: 0.1,
        flatShading: true, side: THREE.DoubleSide, clippingPlanes: [plano], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const matL = new THREE.LineBasicMaterial({ color: LINHA, transparent: true, opacity: 0.34, clippingPlanes: [plano] });
      mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.5;'); };   // brilho na cor de cada peça
      o.material = mat;   // sem arestas: os tubos são finos e as linhas apagariam a cor de cada rede
      G[cam.id] = { malha: o, mat, matL, plano, ymin: o.geometry.boundingBox.min.y, ymax: o.geometry.boundingBox.max.y,
        ligada: true, cam, elementos: meta.grupos[cam.id] || [] };
    });

    const lado = Math.max(tam.x, tam.z) * 2.4;
    grade = new THREE.GridHelper(lado, Math.round(lado / 4), 0x3b6ea5, 0x26405a);
    grade.position.y = -0.05; grade.material.transparent = true; grade.material.opacity = 0.5; scene.add(grade);
    scene.fog = new THREE.Fog(FUNDO, raio * 4, raio * 16);   // no celular a câmera fica longe; a névoa curta apagava a casa
    varredura = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.18, tam.z * 1.18),
      new THREE.MeshBasicMaterial({ color: 0x9cc2ec, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    varredura.rotation.x = -Math.PI / 2; varredura.visible = false;
    varredura.add(new THREE.LineSegments(new THREE.EdgesGeometry(varredura.geometry), new THREE.LineBasicMaterial({ color: 0xbfe3ff })));
    scene.add(varredura);

    const dl = $('leg-det'); if (dl) dl.open = innerWidth > 640;
    const lg = $('legenda'); if (lg) lg.innerHTML = Object.entries(meta.legenda || {}).filter(([n]) => n !== 'Tubo').map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
    montarCamadas(); ajustar(); posicionar('3d', 0);
    p = 0; aplicar(); pronto = true; carregando.hidden = true; jaTocou = false;
    if (visivel || aberta) tocar();
  })
  .catch((erro) => { carregando.textContent = 'Não foi possível carregar a maquete.'; console.error(erro); });
}

/* ---------- montagem, explosão e raio-X ---------- */
function aplicar() {
  const e = +$('explodir').value / 100;
  for (const g of Object.values(G)) {
    const off = e * H * g.cam.desloca;
    g.malha.position.y = off;
    const s = ease(lim((p - g.cam.janela[0]) / (g.cam.janela[1] - g.cam.janela[0])));
    g.plano.constant = s >= 1 ? 1e5 : base + off + g.ymin + (g.ymax - g.ymin) * s;
    g.malha.visible = g.ligada && s > 0.002;
  }
  if (varredura) { varredura.visible = p > 0.002 && p < 0.998; varredura.position.y = Math.max(0.05, H * p * (1 + e * 0.6)); }
  $('construir').value = Math.round(p * 100);
  $('pct').textContent = Math.round(p * 100) + '%';
}
function aplicarRaioX() {
  for (const g of Object.values(G)) {
    g.mat.transparent = raioX; g.mat.opacity = raioX ? (g.cam.id === 'lajes' ? 0.12 : 0.34) : 1; g.mat.depthWrite = !raioX;
    g.matL.opacity = raioX ? 0.6 : 0.34; g.mat.needsUpdate = true;
  }
}
function tocar() {                      // monta do zero, com a luz de varredura subindo
  if (!pronto) return; jaTocou = true;
  const ms = reduz ? 0 : 6500, t0 = performance.now(), de = 0;
  p = de; aplicar();
  if (!ms) { p = 1; aplicar(); return; }
  tween = (agora) => { const t = lim((agora - t0) / ms); p = t; aplicar(); if (t >= 1) tween = null; };
}
function montarCamadas() {
  const alvoDiv = $('camadas');
  for (const k of CAMADAS.filter((x) => G[x.id])) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = k.nome; b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => { G[k.id].ligada = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(G[k.id].ligada)); aplicar(); });
    alvoDiv.appendChild(b);
  }
}

/* ---------- vistas ---------- */
const DIRS = { '3d': [1, 0.62, 1.15], planta: [0.0001, 1, 0.0001], frente: [0, 0.22, 1] };
function posicionar(vista, ms = 700) {
  const d = new THREE.Vector3(...DIRS[vista]).normalize(), dist = raio * (vista === 'planta' ? 2.1 : 2.35) * (MODELOS[modeloAtual].zoom || 1) * (camera.aspect < 1.4 ? Math.min(2.2, Math.pow(1.5 / camera.aspect, 0.75)) : 1);   // telas estreitas: afasta para caber a largura
  const estreita = camera.aspect < 0.9, alvoV = estreita ? alvo.clone().add(new THREE.Vector3(0, -raio * 0.3, 0)) : alvo;   // celular em pé: a casa sobe para a parte livre da tela
  const fim = d.multiplyScalar(estreita ? dist * 0.62 : dist).add(alvoV); controles.target.copy(alvoV);
  if (!ms || reduz) { camera.position.copy(fim); controles.update(); return; }
  const ini = camera.position.clone(), t0 = performance.now();
  tweenCam = (agora) => { const t = lim((agora - t0) / ms); camera.position.lerpVectors(ini, fim, ease(t)); camera.lookAt(controles.target); if (t >= 1) tweenCam = null; };
}
let tweenCam = null;

/* ---------- passar o mouse: realce e nome do elemento ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), tip = $('elemento'), ficha = $('ficha');
let realce = null, escolhido = null, pendente = null, desde = null;
function achar(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const alvos = Object.values(G).filter((g) => g.malha.visible).map((g) => g.malha);
  const hit = ray.intersectObjects(alvos, false)[0];
  if (!hit) return null;
  const g = Object.values(G).find((x) => x.malha === hit.object); const f = hit.faceIndex;
  let a = 0, b = g.elementos.length - 1;                       // busca binária pela primeira face de cada elemento
  while (a < b) { const m = (a + b + 1) >> 1; if (g.elementos[m][2] <= f) a = m; else b = m - 1; }
  return { g, el: g.elementos[a], malha: hit.object };
}
function destacar(h) {
  if (realce) { realce.parent && realce.parent.remove(realce); realce.geometry.dispose(); realce = null; }
  if (!h) return;
  const geo = h.malha.geometry, idx = geo.index, pos = geo.attributes.position, [, , ini, n] = h.el, v = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const vi = idx ? idx.getX((ini + i) * 3 + k) : (ini + i) * 3 + k;
    v.set([pos.getX(vi), pos.getY(vi), pos.getZ(vi)], i * 9 + k * 3);
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(v, 3));
  realce = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: DESTAQUE, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  h.malha.add(realce);
}
const pav = (i) => ({ PERGOLADO_PISCINA: 'Piscina', TERREO: 'Térreo', LAJE_SUPERIOR: 'Laje superior', COBERTURA: 'Cobertura' }[meta.pavimentos[i]] || meta.pavimentos[i] || '');
const rotulo = (h) => `${h.g.cam.nome} · ${h.el[0]}`;
addEventListener('pointermove', (ev) => { if (aberta && ev.target === renderer.domElement) { pendente = ev; } });
function quadro() {
  if (!pendente) return; const ev = pendente; pendente = null;
  const h = achar(ev); destacar(h || escolhido);
  if (h) { tip.hidden = false; tip.textContent = `${rotulo(h)} · ${pav(h.el[1])}`; const r = caixa.getBoundingClientRect(); tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 190) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px'; renderer.domElement.style.cursor = 'pointer'; }
  else { tip.hidden = true; renderer.domElement.style.cursor = 'grab'; }
}
renderer.domElement.addEventListener('pointerdown', (ev) => { desde = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!aberta || !desde || Math.hypot(ev.clientX - desde.x, ev.clientY - desde.y) > 6) return;
  const h = achar(ev); escolhido = h; destacar(h);
  if (!h) { ficha.hidden = true; return; }
  ficha.hidden = false;
  ficha.innerHTML = `<b>${rotulo(h)}</b><span>${pav(h.el[1])}</span><span>${h.el[4] || meta.padrao || ''}</span><button type="button" id="soltar">Limpar</button>`;
  $('soltar').addEventListener('click', () => { escolhido = null; destacar(null); ficha.hidden = true; });
});

/* ---------- abrir e fechar (a caixa cresce até a tela inteira) ---------- */
let ocioso = null;
const retomar = () => { clearTimeout(ocioso); if (girar) ocioso = setTimeout(() => { controles.autoRotate = true; }, 4000); };
controles.addEventListener('start', () => { controles.autoRotate = false; clearTimeout(ocioso); });
controles.addEventListener('end', retomar);
const animar = (de, para, ms) => {
  if (reduz) return Promise.resolve();
  const anim = caixa.animate([de, para], { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  return Promise.race([anim.finished.catch(() => {}), new Promise((ok) => setTimeout(ok, ms + 80))]);
};
const cheia = { top: '0px', left: '0px', width: '100vw', height: '100dvh' };
let origemEl = null;
async function abrir(origem) {
  if (aberta || !pronto) return; aberta = true; origemEl = origem || null;
  const r = (origem || caixa).getBoundingClientRect(), de = { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' };
  Object.assign(caixa.style, de); caixa.classList.add('aberta'); document.body.classList.add('travado');
  caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', 'Maquete 3D das redes hidrossanitárias');
  $('rotulo').hidden = true; $('explorar').hidden = true; $('ui').hidden = false;
  await animar(de, cheia, 480);
  caixa.getAnimations().forEach((a) => a.cancel()); Object.assign(caixa.style, cheia); ajustar();
  controles.enabled = true; controles.autoRotate = girar; posicionar('3d', 600); $('fechar').focus();
  if (p < 0.001 && !tween) tocar();   // aberta a partir de outro ponto da página: monta ao abrir
}
async function fechar() {
  if (!aberta) return; controles.enabled = false; destacar(null); escolhido = null; tip.hidden = true; ficha.hidden = true;
  const v = (origemEl && document.contains(origemEl) ? origemEl : caixa.parentElement).getBoundingClientRect(), para = { top: v.top + 'px', left: v.left + 'px', width: v.width + 'px', height: v.height + 'px' };
  $('ui').hidden = true; await animar(cheia, para, 420);
  caixa.getAnimations().forEach((a) => a.cancel()); caixa.classList.remove('aberta'); caixa.removeAttribute('style'); document.body.classList.remove('travado');
  caixa.setAttribute('role', 'button'); caixa.removeAttribute('aria-modal'); caixa.setAttribute('aria-label', 'Abrir a maquete 3D das redes hidrossanitárias em tela cheia');
  $('rotulo').hidden = false; $('explorar').hidden = false; aberta = false; ajustar(); controles.autoRotate = !reduz; posicionar('3d', 0); caixa.focus();
}
caixa.addEventListener('click', () => { if (!aberta) abrir(); });
caixa.addEventListener('keydown', (e) => { if (!aberta && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
document.querySelectorAll('[data-abrir-maquete]').forEach((b) => b.addEventListener('click', async () => {
  if (aberta) return;
  const chave = b.dataset.abrirMaquete;
  if (chave !== modeloAtual) await carregarModelo(chave);
  abrir(b);
}));
$('fechar').addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
$('ui').addEventListener('click', (e) => e.stopPropagation());

document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  controles.autoRotate = false; posicionar(b.dataset.vista); retomar();
}));
$('raiox').addEventListener('click', (e) => { raioX = !raioX; e.currentTarget.setAttribute('aria-pressed', String(raioX)); aplicarRaioX(); });
$('girar').addEventListener('click', (e) => { girar = !girar; e.currentTarget.setAttribute('aria-pressed', String(girar)); controles.autoRotate = girar; });
$('montar').addEventListener('click', () => { tocar(); });

$('construir').addEventListener('input', (e) => { tween = null; p = +e.target.value / 100; aplicar(); });
$('explodir').addEventListener('input', () => { aplicar(); });

/* ---------- tamanho e laço de desenho ---------- */
function ajustar() { const w = palco.clientWidth || 1, h = palco.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(ajustar).observe(palco);
let visivel = false;
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel && pronto && !jaTocou) tocar(); }).observe(caixa.parentElement);
function laco(agora) {
  requestAnimationFrame(laco);
  if (!pronto || (!visivel && !aberta) || document.hidden) return;
  try {
    if (tween) tween(agora); if (tweenCam) tweenCam(agora); quadro();
    controles.update(); renderer.render(scene, camera);
  } catch (e) { window.__erroMaquete = String(e && e.stack || e); }
}
requestAnimationFrame(laco);
carregarModelo('hidro');

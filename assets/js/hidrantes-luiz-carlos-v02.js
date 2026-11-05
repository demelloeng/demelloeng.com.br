// V02 refined hydrant viewer, adapted from maquete-hidro-3d.js (V02).
import {elementoDaFace, primeiroHitVisivel} from './hidrantes-luiz-carlos-core.mjs?v=1';
/* Maquete das redes hidrossanitárias em 3D (three.js): monta as redes de baixo para cima, separa as redes e identifica cada peça.
   Dados vêm do próprio modelo: o GLB (uma malha por camada) e o JSON com nome e pavimento de cada elemento.
   Integração V02: Three.js e addons hospedados no próprio site; ativação sob demanda. */
const $ = (id) => document.getElementById(id);
const caixa = $('caixa'), palco = $('palco'), carregando = $('carregando');
const MODELOS = {
  hidro: { glb: caixa.dataset.glb, meta: caixa.dataset.meta, sub: 'Hidrantes V02 · 171 componentes', zoom: 1.05,
    dica: 'Colégio Luiz Carlos · Toque nas peças ou escolha um componente para aproximar.' },
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
  {id:'tubulacao', nome:'Distribuição', um:'Distribuição', janela:[0,0.7], desloca:0},
  {id:'hidrantes', nome:'Hidrantes e instrumentos', um:'Hidrantes', janela:[0.25,0.88], desloca:0.5},
  {id:'casa-bombas', nome:'Reservação e bombas', um:'Equipamentos', janela:[0.5,1], desloca:1.1},
];
const BASE_CAM = CAMADAS.map((k) => ({ um: k.um, nome: k.nome }));
const FUNDO = 0x1b242d, LINHA = 0xbfe3ff, DESTAQUE = 0xffffff;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lim = (t) => Math.max(0, Math.min(1, t));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(max-width:700px)').matches ? 1.5 : 2));
renderer.localClippingEnabled = true;
palco.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(FUNDO);
const camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 4000);
scene.add(new THREE.HemisphereLight(0xcfe2f6, 0x1b242d, 1.7));
const sol = new THREE.DirectionalLight(0xfff4e5, 2.8); sol.position.set(60, 90, 50); scene.add(sol);
const contra = new THREE.DirectionalLight(0x80bdff, 1.6); contra.position.set(-60, 30, -40); scene.add(contra);

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08; controles.enabled = false;
controles.autoRotate = !reduz; controles.autoRotateSpeed = 0.6;
controles.minDistance = 0.08; controles.minPolarAngle = 0.001; controles.maxPolarAngle = Math.PI / 2 - 0.02;

const G = {};            // id -> { malha, faces, mat, matL, ymin, ymax, ligada, plano, meta }
let meta = null, tam = new THREE.Vector3(), raio = 50, alvo = new THREE.Vector3(), base = 0, H = 10;
let p = 0, raioX = false, pronto = false, aberta = false, girar = !reduz, tween = null, jaTocou = false;
let varredura, grade, precisaDesenhar = true;
controles.addEventListener('change',()=>{precisaDesenhar=true;});

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
    raio = cx.getBoundingSphere(new THREE.Sphere()).radius; alvo.set(0, H * 0.5, 0); controles.maxDistance = raio * 12;

    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const cam = CAMADAS.find((k) => k.id === o.name || (o.parent && k.id === o.parent.name));
      if (!cam) { o.visible = false; return; }   // só as três redes entram
      if (G[cam.id]) throw new Error('Mais de uma malha na mesma camada');
      o.geometry.computeBoundingBox();
      const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x000000, roughness: cam.id==='hidrantes'?.62:.38, metalness: cam.id==='hidrantes'?.06:.22,
        flatShading: false, side: THREE.DoubleSide, clippingPlanes: [plano], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const matL = new THREE.LineBasicMaterial({ color: LINHA, transparent: true, opacity: 0.34, clippingPlanes: [plano] });
      mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.12;'); };   // brilho na cor de cada peça
      o.material = mat;   // sem arestas: os tubos são finos e as linhas apagariam a cor de cada rede
      o.userData.cut = 1e5;
       G[cam.id] = { malha: o, mat, matL, plano, ymin: o.geometry.boundingBox.min.y, ymax: o.geometry.boundingBox.max.y,
        ligada: true, cam, elementos: meta.grupos[cam.id] || [] };
    });

    const lado = Math.max(tam.x, tam.z) * 2.4;
    grade = new THREE.GridHelper(lado, Math.round(lado / 4), 0x3b6ea5, 0x26405a);
    grade.position.y = -0.05; grade.material.transparent = true; grade.material.opacity = 0.28; scene.add(grade);
    scene.fog = new THREE.Fog(FUNDO, raio * 4, raio * 16);   // no celular a câmera fica longe; a névoa curta apagava a casa
    varredura = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.18, tam.z * 1.18),
      new THREE.MeshBasicMaterial({ color: 0x9cc2ec, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    varredura.rotation.x = -Math.PI / 2; varredura.visible = false;
    varredura.add(new THREE.LineSegments(new THREE.EdgesGeometry(varredura.geometry), new THREE.LineBasicMaterial({ color: 0xbfe3ff })));
    scene.add(varredura);

    const dl = $('leg-det'); if (dl) dl.open = false;
    $('leg-det').addEventListener('toggle',()=>{if(pronto){if(escolhido)focar();else posicionar('3d',0);}});
     const lg = $('legenda'); if (lg) lg.innerHTML = Object.entries(meta.legenda || {}).filter(([n]) => n !== 'Tubo').map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
    const tube=G['tubulacao'];if(tube && meta.eixos_tubos){const values=Object.values(meta.eixos_tubos).flat(2);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(values,3));tracado=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xe46b72,transparent:true,opacity:.65,depthTest:true,depthWrite:false,clippingPlanes:[tube.plano]}));tracado.material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n mvPosition.z += 0.06; gl_Position = projectionMatrix * mvPosition;');};tube.malha.add(tracado);}
    montarCamadas(); montarLista(); ajustar(); posicionar('3d', 0);
    p = 0; aplicar(); pronto = true; caixa.dataset.pronto = 'true'; carregando.hidden = true; jaTocou = false;
    if (visivel || aberta) tocar();
  })
  .catch((erro) => { carregando.textContent = 'Não foi possível carregar a maquete. Atualize a página para tentar novamente.'; caixa.dataset.erro = 'true'; console.error(erro); });
}

/* ---------- montagem, explosão e raio-X ---------- */
function aplicar() {
  precisaDesenhar=true;
  const e = +$('explodir').value / 100;
  for (const g of Object.values(G)) {
    const off = e * H * g.cam.desloca;
    g.malha.position.y = off;
    const s = ease(lim((p - g.cam.janela[0]) / (g.cam.janela[1] - g.cam.janela[0])));
    g.plano.constant = s >= 1 ? 1e5 : base + off + g.ymin + (g.ymax - g.ymin) * s;
    g.malha.visible = g.ligada && s > 0.002 && (!isolado || escolhido?.g === g); g.malha.userData.cut = g.plano.constant;
     if (escolhido?.g === g && !g.malha.visible) selecionar(null);
  }
  if (realce && escolhido) realce.material.clippingPlanes = [escolhido.g.plano];
   if (varredura) { varredura.visible = p > 0.002 && p < 0.998; varredura.position.y = Math.max(0.05, H * p * (1 + e * 0.6)); }
  $('construir').value = Math.round(p * 100);
  $('pct').textContent = Math.round(p * 100) + '%'; caixa.dataset.progresso = String(p);
}
function aplicarRaioX() {
  precisaDesenhar=true;
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
    b.type = 'button'; b.className = 'chip'; b.textContent = k.nome; b.setAttribute('aria-pressed', 'true'); b.dataset.camada=k.id;
    b.addEventListener('click', () => { selecionar(null); G[k.id].ligada = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(G[k.id].ligada)); aplicar(); });
    alvoDiv.appendChild(b);
  }
}

/* ---------- vistas ---------- */
const DIRS = { '3d': [1, 0.62, 1.15], planta: [0.0001, 1, 0.0001], frente: [0, 0.22, 1] };
function areaLivre() {
  precisaDesenhar=true;
  const w=palco.clientWidth||1,h=palco.clientHeight||1;
  const top=aberta ? Math.min(110,h*.2) : 28;
  const bottom=aberta ? Math.min($('ui').querySelector('.baixo').getBoundingClientRect().height+24,h*.58) : 70;
  camera.setViewOffset(w,h,0,(bottom-top)/2,w,h);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  return {tanH:tanV*camera.aspect*.88,tanV:tanV*Math.max(.25,(h-top-bottom)/h)*.88};
}
function distanciaCaixa(low,high,dir,area) {
  const center=low.clone().add(high).multiplyScalar(.5),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();
  const up=new THREE.Vector3().crossVectors(dir,right).normalize();let distance=.5;
  for(const x of [low.x,high.x])for(const y of [low.y,high.y])for(const z of [low.z,high.z]) {
    const d=new THREE.Vector3(x,y,z).sub(center),depth=d.dot(dir);
    distance=Math.max(distance,depth+Math.abs(d.dot(right))/area.tanH,depth+Math.abs(d.dot(up))/area.tanV);
  }
  return distance*1.08;
}
function posicionar(vista, ms = 700) {
  const offset=+$('explodir').value/100*H*1.1;
  const low=new THREE.Vector3(-tam.x/2,0,-tam.z/2),high=new THREE.Vector3(tam.x/2,H+offset,tam.z/2);
  const viewDir=vista==='3d'&&camera.aspect<.9?[.1,1.1,1]:DIRS[vista];
  const center=low.clone().add(high).multiplyScalar(.5),dir=new THREE.Vector3(...viewDir).normalize();
  const distance=distanciaCaixa(low,high,dir,areaLivre());
  camera.near=.08;camera.updateProjectionMatrix();
  const fim=center.clone().addScaledVector(dir,distance),ini=camera.position.clone(),targetIni=controles.target.clone(),t0=performance.now();
  if(!ms||reduz){camera.position.copy(fim);controles.target.copy(center);controles.update();return;}
  tweenCam=now=>{const t=lim((now-t0)/ms),u=ease(t);camera.position.lerpVectors(ini,fim,u);controles.target.lerpVectors(targetIni,center,u);if(t>=1)tweenCam=null;};
}
let tweenCam = null;

/* ---------- passar o mouse: realce e nome do elemento ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), tip = $('elemento'), ficha = $('ficha');
let realce = null, escolhido = null, pendente = null, desde = null, isolado = false;
function achar(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const alvos = Object.values(G).filter((g) => g.malha.visible).map((g) => g.malha);
  const hit = primeiroHitVisivel(ray.intersectObjects(alvos, false));
  if (!hit) return null;
  const g = Object.values(G).find(x => x.malha === hit.object);
  const el = elementoDaFace(g.elementos, hit.faceIndex);
  return el ? {g,el,malha:hit.object} : null;
}
function destacar(h) {
  precisaDesenhar=true;
  if (realce && h && realce.userData.id === h.el[5]) return;
  if (realce) { realce.traverse(o=>{if(o!==realce){o.geometry?.dispose();o.material?.dispose();}});realce.material.dispose(); realce.parent && realce.parent.remove(realce); realce.geometry.dispose(); realce = null; }
  if (!h) return;
  const geo = h.malha.geometry, idx = geo.index, pos = geo.attributes.position, [, , ini, n] = h.el, v = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const vi = idx ? idx.getX((ini + i) * 3 + k) : (ini + i) * 3 + k;
    v.set([pos.getX(vi), pos.getY(vi), pos.getZ(vi)], i * 9 + k * 3);
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(v, 3));
  realce = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: DESTAQUE, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, clippingPlanes:[h.g.plano], transparent:true, opacity:0.04 }));
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(bg,28),new THREE.LineBasicMaterial({color:0xbfe3ff,transparent:true,opacity:.55,clippingPlanes:[h.g.plano]}));realce.add(edge);
  realce.userData.id = h.el[5];
  h.malha.add(realce);
}
const pav = (i) => ({ PERGOLADO_PISCINA: 'Piscina', TERREO: 'Térreo', LAJE_SUPERIOR: 'Laje superior', COBERTURA: 'Cobertura' }[meta.pavimentos[i]] || meta.pavimentos[i] || '');
const rotulo = (h) => `${h.el[0]} · ${h.el[5]}`;
addEventListener('pointermove', (ev) => { if (aberta && ev.target === renderer.domElement) { pendente = ev; } });
function quadro() {
  if (!pendente) return; const ev = pendente; pendente = null;
  const h = achar(ev); destacar(h || escolhido);
  if (h) { tip.hidden = false; tip.textContent = `${rotulo(h)} · ${pav(h.el[1])}`; const r = caixa.getBoundingClientRect(); tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 190) + 'px'; tip.style.top = (ev.clientY - r.top + 14) + 'px'; renderer.domElement.style.cursor = 'pointer'; }
  else { tip.hidden = true; renderer.domElement.style.cursor = 'grab'; }
}
renderer.domElement.addEventListener('pointerleave',()=>{pendente=null;destacar(escolhido);tip.hidden=true;});
renderer.domElement.addEventListener('pointerdown', (ev) => { desde = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!aberta || !desde || Math.hypot(ev.clientX - desde.x, ev.clientY - desde.y) > 6) return;
  selecionar(achar(ev));
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
let transicao = 0, fechando = false;
async function abrir(origem) {
  if (aberta || fechando || !pronto) return; aberta = true; origemEl = origem || null;
  const versao = ++transicao;
  const r = (origem || caixa).getBoundingClientRect(), de = { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' };
  Object.assign(caixa.style, de); caixa.classList.add('aberta'); document.body.classList.add('travado');
  caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', 'Maquete 3D do sistema de hidrantes');
  $('rotulo').hidden = true; $('explorar').hidden = true; $('ui').hidden = false;
  await animar(de, cheia, 480);
  if (versao !== transicao || !aberta) return;
  caixa.getAnimations().forEach((a) => a.cancel()); Object.assign(caixa.style, cheia); ajustar();
  controles.enabled = true; controles.autoRotate = girar; posicionar('3d', 600); $('fechar').focus();
  if (p < 0.001 && !tween) tocar();   // aberta a partir de outro ponto da página: monta ao abrir
}
async function fechar() {
  if (!aberta || fechando) return;
  fechando = true; ++transicao;
  caixa.getAnimations().forEach((a) => a.cancel());
  controles.enabled = false; selecionar(null); pendente=null; tip.hidden = true; ficha.hidden = true;
  const v = (origemEl && document.contains(origemEl) ? origemEl : caixa.parentElement).getBoundingClientRect(), para = { top: v.top + 'px', left: v.left + 'px', width: v.width + 'px', height: v.height + 'px' };
  $('ui').hidden = true; await animar(cheia, para, 420);
  caixa.getAnimations().forEach((a) => a.cancel()); caixa.classList.remove('aberta'); caixa.removeAttribute('style'); document.body.classList.remove('travado');
  caixa.setAttribute('role', 'button'); caixa.removeAttribute('aria-modal'); caixa.setAttribute('aria-label', 'Abrir a maquete 3D do sistema de hidrantes em tela cheia');
  $('rotulo').hidden = false; $('explorar').hidden = false; aberta = false; fechando = false; ajustar(); controles.autoRotate = girar; posicionar('3d', 0); caixa.focus();
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
ficha.addEventListener('click', e => e.stopPropagation());

document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  controles.autoRotate = false; posicionar(b.dataset.vista); retomar();
}));
$('raiox').addEventListener('click', (e) => { raioX = !raioX; e.currentTarget.setAttribute('aria-pressed', String(raioX)); aplicarRaioX(); });
$('girar').addEventListener('click', (e) => { girar = !girar; e.currentTarget.setAttribute('aria-pressed', String(girar)); controles.autoRotate = girar; });
$('montar').addEventListener('click', () => { selecionar(null); tocar(); });

$('construir').addEventListener('input', (e) => { tween = null; p = +e.target.value / 100; aplicar(); });
$('explodir').addEventListener('input', () => { aplicar(); });
$('explodir').addEventListener('change', () => { selecionar(null); posicionar('3d'); });

/* ---------- tamanho e laço de desenho ---------- */
function ajustar() { precisaDesenhar=true; const w = palco.clientWidth || 1, h = palco.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(()=>{ajustar();if(pronto){if(escolhido){focar();}else posicionar('3d',0);}}).observe(palco);
let visivel = false;
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel && pronto && !jaTocou) tocar(); }).observe(caixa.parentElement);
function laco(agora) {
  requestAnimationFrame(laco);
  if (!pronto || (!visivel && !aberta) || document.hidden) return;
  try {
    if(tween||tweenCam)precisaDesenhar=true;
    if (tween) tween(agora); if (tweenCam) tweenCam(agora); quadro();
    controles.update();
    if(precisaDesenhar){if(tracado){tracado.visible=!isolado;tracado.material.opacity=.7*lim((controles.getDistance()-10)/25);}
    atualizarMarcadores();renderer.render(scene,camera);precisaDesenhar=false;}
  } catch (e) { window.__erroMaquete = String(e && e.stack || e); }
}
requestAnimationFrame(laco);

const lista = $('componente'), marcadores = $('marcadores');
let pins=[],tracado=null;
function montarLista() {
  lista.replaceChildren(new Option('Escolha um componente…',''));
  pins=[]; marcadores.replaceChildren();
  for (const g of Object.values(G)) {
    const optgroup=document.createElement('optgroup'); optgroup.label=g.cam.nome;
    for(const el of g.elementos) {
      optgroup.appendChild(new Option(`${el[0]} · ${el[5]} · ${pav(el[1])}`,el[5]));
      if(el[0].startsWith('Hidrante')) {
        const button=document.createElement('button');button.type='button';button.className='pin';
        button.textContent=el[0].includes('recalque')?'R':String(pins.length+1);
        button.setAttribute('aria-label',`${el[0]} ${el[5]}`);
        button.addEventListener('click',e=>{e.stopPropagation();selecionar({g,el,malha:g.malha});focar();});
        marcadores.appendChild(button);pins.push({button,g,el});
      }
    }
    lista.appendChild(optgroup);
  }
}
function atualizarMarcadores() {
  const occupied=[];
  for(const pin of pins) {
    const point=pin.g.malha.localToWorld(new THREE.Vector3(...pin.el[6]));
    const project=point.clone().project(camera);
    pin.button.hidden=!aberta || !pin.g.malha.visible || point.y>pin.g.plano.constant || project.z>1 || project.z< -1 || Math.abs(project.x)>.95 || Math.abs(project.y)>.85 || !!escolhido;
    const px=(project.x+1)*palco.clientWidth/2,py=(1-project.y)*palco.clientHeight/2;
    if(occupied.some(([x,y])=>Math.abs(x-px)<48&&Math.abs(y-py)<48))pin.button.hidden=true;
    if(!pin.button.hidden)occupied.push([px,py]);
    pin.button.style.left=`${(project.x+1)*50}%`;pin.button.style.top=`${(1-project.y)*50}%`;
  }
}
function selecionar(h) {
  isolado=false;for(const g of Object.values(G)){g.malha.geometry.setDrawRange(0,Infinity);g.malha.visible=g.ligada;}
  escolhido=h; destacar(h);tip.hidden=true;
  ficha.replaceChildren(); ficha.hidden=!h;
  if(!h) {lista.value='';aplicar();return;}
  lista.value=h.el[5];
  const title=document.createElement('b');title.textContent=rotulo(h);ficha.appendChild(title);
  for(const text of [pav(h.el[1]), h.g.cam.nome, h.el[4]]) {const span=document.createElement('span');span.textContent=text;ficha.appendChild(span);}
  const actions=document.createElement('div'); actions.className='ficha-acoes';
  const focus=document.createElement('button');focus.type='button';focus.textContent='Aproximar';focus.addEventListener('click',focar);
  const clear=document.createElement('button');clear.type='button';clear.textContent='Limpar';clear.addEventListener('click',()=>selecionar(null));
  const isolate=document.createElement('button');isolate.type='button';isolate.textContent='Isolar';isolate.dataset.action='isolar';isolate.setAttribute('aria-pressed','false');
  isolate.addEventListener('click',()=>{
    precisaDesenhar=true;destacar(h);isolado=!isolado;isolate.setAttribute('aria-pressed',String(isolado));isolate.textContent=isolado?'Ver sistema':'Isolar';
    for(const g of Object.values(G)){g.malha.geometry.setDrawRange(0,Infinity);g.malha.visible=g.ligada&&(!isolado||g===h.g);}
    if(isolado)h.malha.geometry.setDrawRange(h.el[2]*3,h.el[3]*3);focar();
  });
  actions.append(focus,isolate,clear);ficha.appendChild(actions);aplicar();
}
function focar() {
  if(!escolhido)return;
  const h=escolhido;girar=false;clearTimeout(ocioso);controles.autoRotate=false;$('girar').setAttribute('aria-pressed','false');tweenCam=null;
  if(innerWidth<=700) {$('painel-expandido').classList.remove('expandido');$('controles-mobile').setAttribute('aria-expanded','false');}
  const box=h.el[7],low=h.malha.localToWorld(new THREE.Vector3(...box[0])),high=h.malha.localToWorld(new THREE.Vector3(...box[1]));
  const center=low.clone().add(high).multiplyScalar(.5),dir=new THREE.Vector3(1,.55,1).normalize();
  const distance=Math.max(distanciaCaixa(low,high,dir,areaLivre())*1.28,0.24);
  camera.near=Math.max(.003,Math.min(.08,distance/60));camera.updateProjectionMatrix();
  camera.position.copy(center).addScaledVector(dir,distance);controles.target.copy(center);controles.update();
}
lista.addEventListener('change',()=>{
  for(const g of Object.values(G)) {const el=g.elementos.find(e=>e[5]===lista.value);if(!el)continue;
    g.ligada=true; const chip=$('camadas').querySelector(`[data-camada="${g.cam.id}"]`);chip?.setAttribute('aria-pressed','true');
    tween=null;p=1;aplicar();selecionar({g,el,malha:g.malha});focar();return;
  } selecionar(null);
});
$('visao-geral').addEventListener('click',()=>{selecionar(null);posicionar('3d');});
$('controles-mobile').addEventListener('click',e=>{const expanded=e.currentTarget.getAttribute('aria-expanded')!=='true';e.currentTarget.setAttribute('aria-expanded',String(expanded));$('painel-expandido').classList.toggle('expandido',expanded);requestAnimationFrame(()=>{if(escolhido)areaLivre();else posicionar('3d',0);});});
caixa.addEventListener('keydown',e=>{
  if(!aberta || e.key!=='Tab')return;
  const focusable=[...caixa.querySelectorAll('button,input,select,summary')].filter(x=>!x.hidden && x.getClientRects().length && !x.disabled);
  const first=focusable[0],last=focusable.at(-1);
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pronto=false;carregando.hidden=false;carregando.textContent='A visualização foi interrompida. Atualize a página para recarregar.';});

$('girar').setAttribute('aria-pressed',String(girar));
carregarModelo('hidro');



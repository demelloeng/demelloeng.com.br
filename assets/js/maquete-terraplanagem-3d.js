/* v5 (so terreno, pisos, corte, aterro e contencoes; sem edificacoes, patamares, urbanizacao e revisao; janelas da animacao refeitas). v4 (sem fade dos volumes; marcas de corte e aterro coladas na superficie final; camadas de REVISAO desligadas por padrao). v3 (camadas Coberturas e Patamares; o v2 fica intacto). v2: corrige o sombreamento dos volumes. Maquete da terraplanagem em 3D (three.js): terreno natural, os pisos entram, uma linha desce mostrando corte e aterro, depois as edificações.
   Dados vêm do próprio modelo: o GLB (uma malha por camada) e o JSON com a ordem e o aviso. Modelo ilustrativo: sem volumes, relevo exagerado.
   Pré-visualização: o importmap da página aponta para o jsDelivr; antes de publicar, three.js e addons passam a ficar hospedados no próprio site. */
const $ = (id) => document.getElementById(id);
const caixa = $('caixa'), palco = $('palco'), carregando = $('carregando');
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EXAG = 2;                                   // exagero vertical; a página avisa

let THREE, OrbitControls, GLTFLoader;
try {
  THREE = await import('three');
  ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
} catch (e) { carregando.textContent = 'Não foi possível carregar a maquete 3D. Atualize a página.'; throw e; }

// grupos que o visitante liga e desliga; ids = nomes das malhas no GLB
const GRUPOS = [
  { id: 'terreno',   nome: 'Terreno',        malhas: ['TERRENO_NATURAL', 'TERRENO_FINAL'] },
  { id: 'pisos',     nome: 'Pisos',          malhas: ['PISOS'] },
  { id: 'volumes',   nome: 'Corte e aterro', malhas: ['VOLUME_CORTE', 'VOLUME_ATERRO', 'MARCA_CORTE', 'MARCA_ATERRO'] },
  { id: 'contencao', nome: 'Contenções',     malhas: ['CONTENCOES'] },
];
const NOME = { TERRENO_NATURAL: 'Terreno natural', TERRENO_FINAL: 'Terreno terraplanado', PISOS: 'Piso', VOLUME_CORTE: 'Corte', VOLUME_ATERRO: 'Aterro',
  MARCA_CORTE: 'Corte', MARCA_ATERRO: 'Aterro', CONTENCOES: 'Contenção (ilustrativa)', EDIFICACOES: 'Edificação', URBANIZACAO: 'Urbanização', PATAMARES: 'Patamar',
  REVISAO_COBERTURAS: 'Revisão: cobertura', REVISAO_LAJES: 'Revisão: laje a confirmar', REVISAO_URBANIZACAO: 'Revisão: urbanização fora da superfície' };
const LEGENDA = { 'Corte': '#e87e22', 'Aterro': '#2ea05a', 'Contenção': '#6e7076', 'Piso': '#d6dce2' };
const FUNDO = 0x1b242d, LINHA = 0xbfe3ff;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lim = (t) => Math.max(0, Math.min(1, t));
// janelas da animação (0 a 1): terreno natural sobe; pisos caem; a linha desce; os volumes somem; edificações e urbanização sobem
const T = { nat: [0, 0.14], pisos: [0.14, 0.42], linha: [0.44, 1.0], vol: [1, 1], edif: [1, 1] };
const janela = (p, [a, b]) => lim((p - a) / (b - a));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
palco.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(FUNDO);
const camera = new THREE.PerspectiveCamera(32, 16 / 10, 1, 8000);
scene.add(new THREE.HemisphereLight(0xcfe2f6, 0x1b242d, 1.25));
const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(120, 200, 90); scene.add(sol);
const contra = new THREE.DirectionalLight(0x6aa0d8, 0.6); contra.position.set(-120, 60, -80); scene.add(contra);

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08; controles.enabled = false;
controles.autoRotate = !reduz; controles.autoRotateSpeed = 0.5;
controles.minPolarAngle = 0.001; controles.maxPolarAngle = Math.PI / 2 - 0.02;

const M = {};                // nome da malha -> { obj, mat, ymin, ymax, ligada }
const grupoLigado = Object.fromEntries(GRUPOS.map((g) => [g.id, !g.revisao]));
let meta = null, caixaMundo = new THREE.Box3(), raio = 100, alvo = new THREE.Vector3(), H = 10, raiz = null;
let p = 0, raioX = false, pronto = false, aberta = false, girar = !reduz, tween = null, tweenCam = null, jaTocou = false, visivel = false;
let folha = null;            // plano luminoso da linha que desce
const ZERO = 1e5;
const planoAtras = new THREE.Plane(new THREE.Vector3(0, 0, -1), ZERO);     // mantém o que está ATRÁS da linha (z < zl)
const planoAdiante = new THREE.Plane(new THREE.Vector3(0, 0, 1), ZERO);    // mantém o que está ADIANTE da linha (z > zl)
const sobe = {};                                                           // um plano de subida por malha

function carregar() {
  return fetch(caixa.dataset.glb).then((r) => { if (!r.ok) throw new Error('GLB ' + r.status); return r.arrayBuffer(); })
    .then((buf) => Promise.all([new Promise((ok, no) => new GLTFLoader().parse(buf, '', ok, no)), fetch(caixa.dataset.meta).then((r) => r.json())]))
    .then(([gltf, m]) => {
      meta = m; raiz = gltf.scene; raiz.scale.y = EXAG; scene.add(raiz);
      let cx = new THREE.Box3().setFromObject(raiz); const c = cx.getCenter(new THREE.Vector3());
      raiz.position.set(-c.x, -cx.min.y, -c.z); raiz.updateMatrixWorld(true);
      caixaMundo = new THREE.Box3().setFromObject(raiz); H = caixaMundo.max.y - caixaMundo.min.y;
      raio = caixaMundo.getBoundingSphere(new THREE.Sphere()).radius; alvo.set(0, H * 0.25, 0);
      raiz.traverse((o) => {
        if (!o.isMesh || !NOME[o.name]) { if (o.isMesh) o.visible = false; return; }
        o.geometry.computeBoundingBox();
        const bb = new THREE.Box3().setFromObject(o);
        const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), ZERO); sobe[o.name] = plano;
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.08, flatShading: !o.geometry.attributes.normal, side: THREE.DoubleSide,
          clippingPlanes: [plano], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.35;'); };
        if (o.name.startsWith('VOLUME')) { mat.transparent = true; mat.opacity = 1; mat.depthWrite = false; o.renderOrder = 3; }   // a transparência vem do alfa do vértice
        if (o.name.startsWith('MARCA')) { mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; o.renderOrder = 2; }   // marca colada na superfície final, sempre por cima
        o.material = mat;
        M[o.name] = { obj: o, mat, ymin: bb.min.y, ymax: bb.max.y, base: o.position.y };
      });
      // a malha final, os volumes e as contenções só existem atrás da linha; o natural, só adiante dela
      const atras = ['TERRENO_FINAL', 'VOLUME_CORTE', 'VOLUME_ATERRO', 'MARCA_CORTE', 'MARCA_ATERRO', 'CONTENCOES'];
      for (const n of atras) if (M[n]) M[n].mat.clippingPlanes = [planoAtras, sobe[n]];
      if (M.TERRENO_NATURAL) M.TERRENO_NATURAL.mat.clippingPlanes = [planoAdiante, sobe.TERRENO_NATURAL];
      const larg = caixaMundo.max.x - caixaMundo.min.x;
      folha = new THREE.Mesh(new THREE.PlaneGeometry(larg * 1.12, H * 1.5),
        new THREE.MeshBasicMaterial({ color: 0x9cc2ec, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      folha.add(new THREE.LineSegments(new THREE.EdgesGeometry(folha.geometry), new THREE.LineBasicMaterial({ color: LINHA })));
      folha.visible = false; scene.add(folha);
      const lado = Math.max(larg, caixaMundo.max.z - caixaMundo.min.z) * 1.5;
      const grade = new THREE.GridHelper(lado, Math.round(lado / 10), 0x3b6ea5, 0x26405a);
      grade.position.y = -0.15; grade.material.transparent = true; grade.material.opacity = 0.45; scene.add(grade);
      const lg = $('legenda'); if (lg) lg.innerHTML = Object.entries(LEGENDA).map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
      const dl = $('leg-det'); if (dl) dl.open = innerWidth > 640;
      montarChips(); ajustar(); posicionar('3d', 0); p = 0; aplicar(); pronto = true; carregando.hidden = true;
      if (visivel || aberta) tocar();
    }).catch((erro) => { carregando.textContent = 'Não foi possível carregar a maquete.'; console.error(erro); });
}

/* ---------- a animação, por janelas ---------- */
function aplicar() {
  const zmin = caixaMundo.min.z, zmax = caixaMundo.max.z, sNat = ease(janela(p, T.nat)), sPisos = ease(janela(p, T.pisos));
  const sLinha = janela(p, T.linha), sVol = janela(p, T.vol), sEdi = ease(janela(p, T.edif));
  const zl = zmin + (zmax - zmin) * sLinha, linhaAtiva = sLinha > 0.001;
  const fimLinha = sLinha >= 0.999;
  planoAtras.constant = fimLinha ? ZERO : zl; planoAdiante.constant = -zl;
  const lig = (id) => grupoLigado[id];
  const set = (n, vis) => { if (M[n]) M[n].obj.visible = vis; };
  // terreno natural sobe do zero; some quando a linha termina
  if (M.TERRENO_NATURAL) { sobe.TERRENO_NATURAL.constant = M.TERRENO_NATURAL.ymin + (M.TERRENO_NATURAL.ymax - M.TERRENO_NATURAL.ymin) * sNat + 0.01;
    set('TERRENO_NATURAL', lig('terreno') && sNat > 0.002 && !fimLinha); }
  if (M.TERRENO_FINAL) { sobe.TERRENO_FINAL.constant = ZERO; set('TERRENO_FINAL', lig('terreno') && linhaAtiva); }
  // pisos caem do alto até a cota, com o terreno natural já de pé
  if (M.PISOS) { M.PISOS.obj.position.y = M.PISOS.base + (1 - sPisos) * (H * 0.9) / EXAG; sobe.PISOS.constant = ZERO; set('PISOS', lig('pisos') && sPisos > 0.002); }
  // volumes de corte e aterro aparecem atrás da linha e depois esmaecem
  for (const n of ['VOLUME_CORTE', 'VOLUME_ATERRO', 'MARCA_CORTE', 'MARCA_ATERRO']) if (M[n]) { sobe[n].constant = ZERO; set(n, lig('volumes') && linhaAtiva); }   // V4: permanecem visíveis até 100% e no controle manual
  if (M.CONTENCOES) { sobe.CONTENCOES.constant = ZERO; set('CONTENCOES', lig('contencao') && linhaAtiva); }
  // edificações e urbanização crescem de baixo para cima no fim
  for (const [n, g] of [['EDIFICACOES', 'edificios'], ['PATAMARES', 'patamares'], ['URBANIZACAO', 'urbano']]) if (M[n]) {
    sobe[n].constant = M[n].ymin + (M[n].ymax - M[n].ymin) * sEdi + 0.01; set(n, lig(g) && sEdi > 0.002); }
  for (const [n, g] of [['REVISAO_COBERTURAS', 'rev-cob'], ['REVISAO_LAJES', 'rev-laj'], ['REVISAO_URBANIZACAO', 'rev-urb']]) if (M[n]) { sobe[n].constant = ZERO; set(n, lig(g)); }   // revisão: só quando ligada
  if (folha) { folha.visible = linhaAtiva && !fimLinha; folha.position.set(0, H * 0.5, zl); }
  $('construir').value = Math.round(p * 100); $('pct').textContent = Math.round(p * 100) + '%';
  const fase = p < T.pisos[0] ? 'Terreno natural' : p < T.linha[0] ? 'Os pisos entram' : p < 0.999 ? 'Corte e aterro' : 'Terreno terraplanado';
  $('fase').textContent = fase;
}
function aplicarRaioX() {
  for (const n of ['TERRENO_NATURAL', 'TERRENO_FINAL']) if (M[n]) { const m = M[n].mat; m.transparent = raioX; m.opacity = raioX ? 0.32 : 1; m.depthWrite = !raioX; m.needsUpdate = true; }
}
function tocar() {
  if (!pronto) return; jaTocou = true;
  const ms = reduz ? 0 : 15000, t0 = performance.now(); p = 0; aplicar();
  if (!ms) { p = 1; aplicar(); return; }
  tween = (agora) => { const t = lim((agora - t0) / ms); p = t; aplicar(); if (t >= 1) tween = null; };
}
function montarChips() {
  const div = $('camadas');
  for (const g of GRUPOS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = g.nome; b.setAttribute('aria-pressed', String(grupoLigado[g.id]));
    b.addEventListener('click', () => { grupoLigado[g.id] = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(grupoLigado[g.id])); aplicar(); });
    div.appendChild(b);
  }
}

/* ---------- vistas ---------- */
const DIRS = { '3d': [0.9, 0.7, 1.15], planta: [0.0001, 1, 0.0001], frente: [0, 0.2, 1] };
function posicionar(vista, ms = 700) {
  const d = new THREE.Vector3(...DIRS[vista]).normalize();
  const dist = raio * (vista === 'planta' ? 2.2 : 2.3) * (camera.aspect < 1.4 ? Math.min(2.2, Math.pow(1.5 / camera.aspect, 0.75)) : 1);
  const estreita = camera.aspect < 0.9, alvoV = estreita ? alvo.clone().add(new THREE.Vector3(0, -raio * 0.3, 0)) : alvo;
  const fim = d.multiplyScalar(estreita ? dist * 0.62 : dist).add(alvoV); controles.target.copy(alvoV);
  if (!ms || reduz) { camera.position.copy(fim); controles.update(); return; }
  const ini = camera.position.clone(), t0 = performance.now();
  tweenCam = (agora) => { const t = lim((agora - t0) / ms); camera.position.lerpVectors(ini, fim, ease(t)); camera.lookAt(controles.target); if (t >= 1) tweenCam = null; };
}

/* ---------- passar o mouse: nome da camada ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), tip = $('elemento');
let pendente = null;
addEventListener('pointermove', (ev) => { if (aberta && ev.target === renderer.domElement) pendente = ev; });
function quadro() {
  if (!pendente) return; const ev = pendente; pendente = null;
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
  const vis = Object.values(M).filter((x) => x.obj.visible).map((x) => x.obj), hit = ray.intersectObjects(vis, false)[0];
  if (!hit) { tip.hidden = true; renderer.domElement.style.cursor = 'grab'; return; }
  tip.hidden = false; tip.textContent = NOME[hit.object.name]; const rc = caixa.getBoundingClientRect();
  tip.style.left = Math.min(ev.clientX - rc.left + 14, rc.width - 190) + 'px'; tip.style.top = (ev.clientY - rc.top + 14) + 'px'; renderer.domElement.style.cursor = 'pointer';
}

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
async function abrir() {
  if (aberta || !pronto) return; aberta = true;
  const r = caixa.getBoundingClientRect(), de = { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' };
  Object.assign(caixa.style, de); caixa.classList.add('aberta'); document.body.classList.add('travado');
  caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', 'Maquete 3D da terraplanagem');
  $('rotulo').hidden = true; $('explorar').hidden = true; $('ui').hidden = false;
  await animar(de, cheia, 480);
  caixa.getAnimations().forEach((a) => a.cancel()); Object.assign(caixa.style, cheia); ajustar();
  controles.enabled = true; controles.autoRotate = girar; posicionar('3d', 600); $('fechar').focus();
  if (p < 0.001 && !tween) tocar();
}
async function fechar() {
  if (!aberta) return; controles.enabled = false; tip.hidden = true;
  const v = caixa.parentElement.getBoundingClientRect(), para = { top: v.top + 'px', left: v.left + 'px', width: v.width + 'px', height: v.height + 'px' };
  $('ui').hidden = true; await animar(cheia, para, 420);
  caixa.getAnimations().forEach((a) => a.cancel()); caixa.classList.remove('aberta'); caixa.removeAttribute('style'); document.body.classList.remove('travado');
  caixa.setAttribute('role', 'button'); caixa.removeAttribute('aria-modal'); caixa.setAttribute('aria-label', 'Abrir a maquete 3D da terraplanagem em tela cheia');
  $('rotulo').hidden = false; $('explorar').hidden = false; aberta = false; ajustar(); controles.autoRotate = !reduz; posicionar('3d', 0); caixa.focus();
}
caixa.addEventListener('click', () => { if (!aberta) abrir(); });
caixa.addEventListener('keydown', (e) => { if (!aberta && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
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

/* ---------- tamanho e laço de desenho ---------- */
function ajustar() { const w = palco.clientWidth || 1, h = palco.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(ajustar).observe(palco);
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel && pronto && !jaTocou) tocar(); }).observe(caixa.parentElement);
function laco(agora) {
  requestAnimationFrame(laco);
  if (!pronto || (!visivel && !aberta) || document.hidden) return;
  try { if (tween) tween(agora); if (tweenCam) tweenCam(agora); quadro(); controles.update(); renderer.render(scene, camera); }
  catch (e) { window.__erroMaquete = String(e && e.stack || e); }
}
requestAnimationFrame(laco);
carregar();

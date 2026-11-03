/* Maquete 3D (three.js). Pré-visualização: o importmap da página aponta para o jsDelivr; antes de publicar, três.js e addons passam a ficar hospedados no próprio site. */
const GLB_URL = document.getElementById('caixa').dataset.glb;
const $ = (id) => document.getElementById(id);
const caixa = $('caixa'), palco = $('palco'), carregando = $('carregando');
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

let THREE, OrbitControls, GLTFLoader;
try {
  THREE = await import('three');
  ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
} catch (e) {
  carregando.textContent = 'Não foi possível carregar a maquete 3D. Atualize a página.';
  throw e;
}

const NOMES = { paredes: 'Paredes', muros: 'Muros', piso: 'Pisos', deck: 'Deck', cobertura: 'Cobertura', janelas: 'Janelas', portas: 'Portas', pilares: 'Pilares', gradil: 'Gradil', piscina: 'Piscina' };
const PALETAS = {           // por grupo: cor, opacidade normal, opacidade no raio-X
  projeto: {
    paredes:   [0xe6eef6, 1.0, 0.13],
    muros:     [0xcdd9e6, 1.0, 0.10],
    piso:      [0xa9bccf, 1.0, 0.18],
    deck:      [0x7f9bb8, 1.0, 0.25],
    cobertura: [0x2f6aa8, 1.0, 0.10],
    janelas:   [0x78b8f2, 0.55, 0.40],
    portas:    [0x9fb3c8, 1.0, 0.30],
    pilares:   [0xcfdcea, 1.0, 0.45],
    gradil:    [0x8fa5bb, 1.0, 0.45],
    piscina:   [0x5aa7e0, 0.9, 0.35],
  },
  realista: {              // a cor vem do material de cada tipo: reboco, concreto, madeira, metal, vidro, água
    paredes:   [0xf0ebe0, 1.0, 0.13],   // alvenaria rebocada e pintada
    muros:     [0xd9d3c7, 1.0, 0.10],   // concreto / reboco areia
    piso:      [0xb9b4aa, 1.0, 0.18],   // concreto e contrapiso
    deck:      [0x9a6b43, 1.0, 0.25],   // madeira ripada
    cobertura: [0xcfd4d9, 1.0, 0.10],   // telha sanduíche (metálica). Telha cerâmica seria 0xb4573b
    janelas:   [0x9cc7e6, 0.5, 0.35],   // vidro
    portas:    [0x7b5a3d, 1.0, 0.30],   // madeira
    pilares:   [0xcfcac1, 1.0, 0.45],   // concreto
    gradil:    [0x3a4650, 1.0, 0.45],   // metal escuro
    piscina:   [0x4fb3d9, 0.9, 0.35],   // água e revestimento azul
  },
};
const ESTILO = PALETAS.projeto;
let estiloAtual = 'projeto';
const est = (nome) => PALETAS[estiloAtual][nome];
const FUNDO = 0x1b242d, LINHA = 0x6aa0d8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
palco.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(FUNDO);
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 2000);
const hemi = new THREE.HemisphereLight(0xcfe2f6, 0x1b242d, 1.15); scene.add(hemi);
const sol = new THREE.DirectionalLight(0xffffff, 1.6); sol.position.set(30, 50, 25); scene.add(sol);
const contra = new THREE.DirectionalLight(0x6aa0d8, 0.55); contra.position.set(-30, 20, -20); scene.add(contra);

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08;
controles.enabled = false; controles.autoRotate = !reduzMovimento; controles.autoRotateSpeed = 0.7;
controles.minPolarAngle = 0.001; controles.maxPolarAngle = Math.PI / 2 - 0.02;

const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
const grupos = {};   // nome -> { faces, linhas, matFace, matLinha }
let tam = new THREE.Vector3(), raio = 30, alvo = new THREE.Vector3(), planoCorte, bordaCorte, grade, chao;
let raioX = false, pronto = false, aberta = false;

function carregar() {
  fetch(GLB_URL).then((r) => { if (!r.ok) throw new Error('GLB ' + r.status); return r.arrayBuffer(); }).then((buf) => new GLTFLoader().parse(buf, '', (gltf) => {
    const raiz = gltf.scene; scene.add(raiz);
    let caixaMed = new THREE.Box3().setFromObject(raiz);
    const c = caixaMed.getCenter(new THREE.Vector3());
    raiz.position.set(-c.x, -caixaMed.min.y, -c.z);
    caixaMed = new THREE.Box3().setFromObject(raiz);
    caixaMed.getSize(tam);
    raio = caixaMed.getBoundingSphere(new THREE.Sphere()).radius;
    alvo.set(0, tam.y * 0.35, 0);

    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const nome = (o.parent && o.parent !== raiz ? o.parent.name : o.name) || o.name;
      const chave = ESTILO[nome] ? nome : (ESTILO[o.name] ? o.name : null);
      if (!chave) return;
      const [cor, op] = ESTILO[chave];
      const matFace = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0, flatShading: true,
        transparent: op < 1, opacity: op, side: THREE.DoubleSide, clippingPlanes: [plano],
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const matLinha = new THREE.LineBasicMaterial({ color: LINHA, transparent: true, opacity: 0.5, clippingPlanes: [plano] });
      o.material = matFace; o.castShadow = true; o.receiveShadow = true;
      const linhas = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), matLinha);
      o.add(linhas);
      (grupos[chave] ||= { faces: [], linhas: [], matFace, matLinha }).faces.push(o);
      grupos[chave].linhas.push(linhas);
    });

    // chão: grade fina que some na distância
    const lado = Math.max(tam.x, tam.z) * 2.6;
    grade = new THREE.GridHelper(lado, Math.round(lado / 2.5), 0x3b6ea5, 0x26405a);
    grade.position.y = -0.02; grade.material.transparent = true; grade.material.opacity = 0.55;
    scene.add(grade);
    scene.fog = new THREE.Fog(FUNDO, raio * 2.4, raio * 5.2);
    chao = new THREE.Mesh(new THREE.CircleGeometry(lado * 0.6, 72), new THREE.MeshStandardMaterial({ color: 0x7fa56a, roughness: 1, metalness: 0 }));
    chao.rotation.x = -Math.PI / 2; chao.position.y = -0.04; chao.receiveShadow = true; chao.visible = false; scene.add(chao);
    sol.position.set(raio * 0.9, raio * 1.5, raio * 0.7); sol.target.position.set(0, 0, 0); scene.add(sol.target);
    Object.assign(sol.shadow.camera, { left: -raio * 1.15, right: raio * 1.15, top: raio * 1.15, bottom: -raio * 1.15, near: 1, far: raio * 6 });
    sol.shadow.camera.updateProjectionMatrix(); sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.05;

    // plano do corte
    const larg = tam.x * 1.25, prof = tam.z * 1.12;
    planoCorte = new THREE.Mesh(new THREE.PlaneGeometry(larg, prof),
      new THREE.MeshBasicMaterial({ color: LINHA, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    planoCorte.rotation.x = -Math.PI / 2;
    bordaCorte = new THREE.LineSegments(new THREE.EdgesGeometry(planoCorte.geometry), new THREE.LineBasicMaterial({ color: 0x9cc2ec }));
    planoCorte.add(bordaCorte); planoCorte.visible = false; scene.add(planoCorte);

    construirSolo();
    montarCamadas();
    aplicarCorte();
    ajustar(); posicionar('3d', 0);
    pronto = true; carregando.hidden = true;
  }, (erro) => { carregando.textContent = 'Não foi possível ler a maquete.'; console.error(erro); })).catch((erro) => { carregando.textContent = 'Não foi possível carregar a maquete.'; console.error(erro); });
}


/* ---------- solo: o modelo não tem terreno, então ele é criado a partir da base dos muros ---------- */
const solo = { malhas: [], topo: null, lado: null, linha: null, fundo: 0 };
function construirSolo() {
  const V = new THREE.Vector3(), faixa = 1.5, perfil = new Map();
  let xmin = 1e9, xmax = -1e9, zmin = 1e9, zmax = -1e9;
  const fontes = grupos.muros ? grupos.muros.faces : [];
  fontes.forEach((m) => {
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      V.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = Math.floor(V.z / faixa);
      perfil.set(k, Math.min(perfil.get(k) ?? 1e9, V.y));
      xmin = Math.min(xmin, V.x); xmax = Math.max(xmax, V.x); zmin = Math.min(zmin, V.z); zmax = Math.max(zmax, V.z);
    }
  });
  if (!perfil.size) {   // sem muros: um nível só, na cota do menor piso
    const b = new THREE.Box3(); (grupos.piso ? grupos.piso.faces : []).forEach((m) => b.expandByObject(m));
    xmin = -tam.x / 2; xmax = tam.x / 2; zmin = -tam.z / 2; zmax = tam.z / 2;
    perfil.set(0, isFinite(b.min.y) ? b.min.y : 0);
  }
  // faixas vizinhas com a mesma cota viram um degrau só
  const chaves = [...perfil.keys()].sort((a, b) => a - b), degraus = [];
  let y = perfil.get(chaves[0]);
  for (let k = chaves[0]; k <= chaves[chaves.length - 1]; k++) {
    const v = perfil.get(k) ?? y, atual = degraus[degraus.length - 1];
    if (atual && Math.abs(v - atual.y) < 0.15) { atual.z1 = (k + 1) * faixa; atual.n++; atual.soma += v; atual.y = atual.soma / atual.n; }
    else degraus.push({ z0: k * faixa, z1: (k + 1) * faixa, y: v, n: 1, soma: v });
    y = v;
  }
  const margem = 3;
  degraus[0].z0 = zmin - margem; degraus[degraus.length - 1].z1 = zmax + margem;
  const x0 = xmin - margem, x1 = xmax + margem;
  const pb = new THREE.Box3(); (grupos.piscina ? grupos.piscina.faces : []).forEach((m) => pb.expandByObject(m));
  const temPiscina = isFinite(pb.min.y);
  solo.fundo = Math.min(...degraus.map((d) => d.y), temPiscina ? pb.min.y : 1e9) - 1.4;

  const base = { roughness: 1, metalness: 0, flatShading: true, clippingPlanes: [plano], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  solo.topo = new THREE.MeshStandardMaterial({ ...base, color: 0x1f2c38 });
  solo.lado = new THREE.MeshStandardMaterial({ ...base, color: 0x182430 });
  solo.linha = new THREE.LineBasicMaterial({ color: LINHA, transparent: true, opacity: 0.45, clippingPlanes: [plano] });

  degraus.forEach((d) => {
    const forma = new THREE.Shape();
    forma.moveTo(x0, -d.z0); forma.lineTo(x1, -d.z0); forma.lineTo(x1, -d.z1); forma.lineTo(x0, -d.z1); forma.closePath();
    // furo da piscina: só no degrau que está na cota do topo da piscina
    if (temPiscina && Math.abs(d.y - pb.max.y) < 0.3 && pb.max.z > d.z0 && pb.min.z < d.z1) {
      const hz0 = Math.max(pb.min.z, d.z0), hz1 = Math.min(pb.max.z, d.z1), h = new THREE.Path();
      h.moveTo(pb.min.x, -hz0); h.lineTo(pb.min.x, -hz1); h.lineTo(pb.max.x, -hz1); h.lineTo(pb.max.x, -hz0); h.closePath();
      forma.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(forma, { depth: d.y - solo.fundo, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);                                  // a extrusão vira altura
    const m = new THREE.Mesh(g, [solo.topo, solo.lado]);
    m.position.y = solo.fundo; m.castShadow = true; m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), solo.linha));
    scene.add(m); solo.malhas.push(m);
  });
  if (grade) grade.position.y = solo.fundo - 0.02;
  if (chao) chao.position.y = solo.fundo - 0.03;
}

/* ---------- vistas ---------- */
const DIRS = { '3d': new THREE.Vector3(0.78, 0.62, 0.9), planta: new THREE.Vector3(0.0001, 1, 0.0001), fachada: new THREE.Vector3(1, 0.13, 0.0001) };
function distancia(v) {
  const meio = THREE.MathUtils.degToRad(camera.fov / 2);
  const base = raio / Math.sin(meio) * (v === 'planta' ? 0.78 : 0.82);
  return base * Math.max(1, 1.3 / camera.aspect);
}
let tween = null;
function posicionar(vista, ms = 700) {
  const dist = distancia(vista);
  if (scene.fog) { scene.fog.near = dist * 1.15; scene.fog.far = dist * 2.8; }   // a neblina acompanha a distância da câmera
  const fim = DIRS[vista].clone().normalize().multiplyScalar(dist).add(alvo);
  controles.target.copy(alvo);
  if (!ms || reduzMovimento) { camera.position.copy(fim); controles.update(); return; }
  const ini = camera.position.clone(), t0 = performance.now();
  tween = (agora) => {
    const t = Math.min(1, (agora - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(ini, fim, e); camera.lookAt(controles.target);
    if (t >= 1) tween = null;
  };
}

/* ---------- raio-X, corte, camadas ---------- */
function aplicarRaioX() {
  for (const [nome, g] of Object.entries(grupos)) {
    const [, normal, xray] = est(nome);
    g.matFace.opacity = raioX ? xray : normal;
    g.matFace.transparent = raioX || normal < 1;
    g.matFace.depthWrite = !raioX && normal >= 1;
    g.matLinha.opacity = estiloAtual === 'realista' ? (raioX ? 0.7 : 0.22) : (raioX ? 0.95 : 0.5);
    g.matFace.needsUpdate = true;
  }
}
function aplicarEstilo(nome) {
  estiloAtual = nome; const real = nome === 'realista';
  caixa.classList.toggle('realista', real);
  const fundo = real ? 0xbcd8ef : FUNDO;
  scene.background = new THREE.Color(fundo); if (scene.fog) scene.fog.color.set(fundo);
  hemi.color.set(real ? 0xe4f1ff : 0xcfe2f6); hemi.groundColor.set(real ? 0x8a9a78 : 0x1b242d); hemi.intensity = real ? 1.0 : 1.15;
  sol.color.set(real ? 0xfff0d8 : 0xffffff); sol.intensity = real ? 2.4 : 1.6; sol.castShadow = real;
  contra.intensity = real ? 0.25 : 0.55;
  if (grade) grade.visible = !real; if (chao) chao.visible = real;
  for (const [n, g] of Object.entries(grupos)) {
    g.matFace.color.set(PALETAS[nome][n][0]); g.matLinha.color.set(real ? 0x2c3a46 : LINHA); g.matFace.needsUpdate = true;
  }
  if (solo.topo) {
    solo.topo.color.set(real ? 0x7fa56a : 0x1f2c38); solo.lado.color.set(real ? 0x6b5844 : 0x182430);
    solo.linha.color.set(real ? 0x2c3a46 : LINHA); solo.linha.opacity = real ? 0.12 : 0.45;
  }
  aplicarRaioX();
}
function aplicarCorte() {
  const v = +$('corte').value / 100;
  const y = v >= 1 ? tam.y * 1.05 : 0.05 + (tam.y * 1.0) * v;
  plano.constant = y;
  if (planoCorte) { planoCorte.visible = v < 1; planoCorte.position.y = y; }
}
function montarCamadas() {
  const alvoDiv = $('camadas');
  for (const nome of Object.keys(grupos)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = NOMES[nome]; b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      const ligado = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(ligado));
      grupos[nome].faces.forEach((m) => { m.visible = ligado; });
    });
    alvoDiv.appendChild(b);
  }
  if (solo.malhas.length) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = 'Solo'; b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      const ligado = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(ligado));
      solo.malhas.forEach((m) => { m.visible = ligado; });
    });
    alvoDiv.prepend(b);
  }
}

/* ---------- abrir e fechar (a caixa cresce até a tela inteira) ---------- */
let girarLigado = !reduzMovimento, ocioso = null;
function retomarGiro() { clearTimeout(ocioso); if (girarLigado) ocioso = setTimeout(() => { controles.autoRotate = true; }, 4000); }
controles.addEventListener('start', () => { controles.autoRotate = false; clearTimeout(ocioso); });
controles.addEventListener('end', retomarGiro);

const animar = (de, para, ms) => {
  if (reduzMovimento) return Promise.resolve();
  const anim = caixa.animate([de, para], { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  // prazo de segurança: se a animação não terminar (aba em segundo plano), a interface segue mesmo assim
  return Promise.race([anim.finished.catch(() => {}), new Promise((ok) => setTimeout(ok, ms + 80))]);
};
const cheia = { top: '0px', left: '0px', width: '100vw', height: '100dvh' };

async function abrir() {
  if (aberta || !pronto) return; aberta = true;
  const r = caixa.getBoundingClientRect();
  const de = { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' };
  Object.assign(caixa.style, de); caixa.classList.add('aberta'); document.body.classList.add('travado');
  caixa.removeAttribute('role'); caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', 'Maquete 3D da casa');
  $('rotulo').hidden = true; $('explorar').hidden = true; $('ui').hidden = false;
  await animar(de, cheia, 480);
  caixa.getAnimations().forEach((a) => a.cancel()); Object.assign(caixa.style, cheia); ajustar();
  controles.enabled = true; controles.autoRotate = girarLigado; posicionar('3d', 600);
  $('fechar').focus();
}
async function fechar() {
  if (!aberta) return;
  controles.enabled = false;
  const vaga = caixa.parentElement.getBoundingClientRect();
  const para = { top: vaga.top + 'px', left: vaga.left + 'px', width: vaga.width + 'px', height: vaga.height + 'px' };
  $('ui').hidden = true;
  await animar(cheia, para, 420);
  caixa.getAnimations().forEach((a) => a.cancel());
  caixa.classList.remove('aberta'); caixa.removeAttribute('style'); document.body.classList.remove('travado');
  caixa.setAttribute('role', 'button'); caixa.removeAttribute('aria-modal'); caixa.setAttribute('aria-label', 'Abrir a maquete 3D da casa em tela cheia');
  $('rotulo').hidden = false; $('explorar').hidden = false; aberta = false;
  ajustar(); controles.autoRotate = !reduzMovimento; posicionar('3d', 0); caixa.focus();
}
caixa.addEventListener('click', (e) => { if (!aberta) abrir(); });
caixa.addEventListener('keydown', (e) => { if (!aberta && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
$('fechar').addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
$('ui').addEventListener('click', (e) => e.stopPropagation());

document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-vista]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  controles.autoRotate = false; posicionar(b.dataset.vista); retomarGiro();
}));
document.querySelectorAll('[data-estilo]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-estilo]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  aplicarEstilo(b.dataset.estilo);
}));
$('raiox').addEventListener('click', (e) => { raioX = !raioX; e.currentTarget.setAttribute('aria-pressed', String(raioX)); aplicarRaioX(); });
$('girar').addEventListener('click', (e) => { girarLigado = !girarLigado; e.currentTarget.setAttribute('aria-pressed', String(girarLigado)); controles.autoRotate = girarLigado; });
$('corte').addEventListener('input', aplicarCorte);

/* ---------- tamanho e laço de desenho ---------- */
function ajustar() {
  const w = palco.clientWidth || 1, h = palco.clientHeight || 1;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(ajustar).observe(palco);
let visivel = true;
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(caixa.parentElement);
function laco(agora) {
  requestAnimationFrame(laco);
  if (!pronto || (!visivel && !aberta) || document.hidden) return;
  if (tween) tween(agora);
  controles.update(); renderer.render(scene, camera);
}
requestAnimationFrame(laco);
carregar();

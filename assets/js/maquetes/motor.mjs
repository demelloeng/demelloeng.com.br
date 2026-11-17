// MOTOR COMUM das maquetes V03 das páginas de serviço (estrutural, hidrossanitária e incêndio).
// Recursos da maquete de incêndio (V02 e protótipo), ligados SÓ pela configuração: nivelChao, níveis com cota fixa,
// guias (tubo fino com espessura mínima de tela), lista de componentes, marcadores e ficha completa (Aproximar,
// Isolar, Limpar). Sem eles na configuração, o comportamento das outras maquetes não muda.
// Ganchos da maquete de terraplanagem (17/11/2026), também só pela configuração: exagero (escala vertical), extensao
// (antesDeMontar, aposMontar e aplicar: o terreno que se transforma fica em terraplanagem.mjs), montagemMs e
// montagemAbertaMs (a sequência longa só com a maquete aberta), tampa (cor da seção), brilhoVertice, vistas (direção,
// abertura e margem por vista), camada com semTampa ou semRealce e textoPorDentro. Ausentes, nada muda.
// Arquitetura (17/11/2026), também opcional: arestaVariavel (contorno com força ajustável, para os estilos Projeto e
// Realista), respeitaPlanos (o clique ignora o recorte da planta cortada) e, no ctx da extensão, luzes, tampa, base,
// renderer e aplicar() (refaz a sombra). Ausentes, as outras maquetes desenham e respondem como antes.
// Substitui maquete-estrutura-3d.js e maquete-hidro-3d.js (que ficam no site para reversão) sem mudar o modelo:
// a geometria vem dos GLB publicados, intactos (SHA-256 conferido em orcamento-src/tests/maquetes_v03.test.mjs).
// Mantém o comportamento aceito da página (caixa viva no topo, tela cheia, Esc e foco) e traz o acabamento da
// calculadora R4: palco, luz, sombra, oclusão parada, Planta quase ortográfica, corte com tampa, níveis e escala.
// Three.js e complementos vêm do próprio site (importmap da página); nada é carregado de fora.
import { fitBox, scaleBar } from './enquadrar.mjs?v=1';
import { caixasDosElementos, uniao, niveisPorTopo, alturasHorizontais, nomePavimento, aplicarRotulos, bordasReais, juntarCasca, verticesQueCruzam, isolarFundo, focoDeVolta, giroFechado, semMaqueteAtalhos } from './dados.mjs?v=3';

const $ = (id) => document.getElementById(id);
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const movel = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const FUNDO = 0x1b242d;            // o mesmo palco das maquetes publicadas e da calculadora R4
const DESTAQUE = 0x4aa3ff;
const MONTAGEM_MS = 4200;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lim = (t) => Math.max(0, Math.min(1, t));
const VISTAS = {   // direção da câmera e abertura (graus); a Planta é quase ortográfica, como na R4
  '3d': { dir: [1, 0.62, 1.15], fov: 30 }, corte: { dir: [0.32, 0.34, 1], fov: 30 },
  planta: { dir: [0, 1, 0.0001], fov: 7 }, frente: { dir: [0, 0.22, 1], fov: 30 },
};

function temWebgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
// a maquete só baixa o Three e o modelo quando a caixa chega perto da tela
const quandoPerto = (el) => new Promise((ok) => {
  if (!('IntersectionObserver' in window)) { ok(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); ok(); } }, { rootMargin: '300px' });
  io.observe(el);
});

export async function maquete(cfg) {
  const caixa = $('caixa'); const palco = $('palco'); const carregando = $('carregando');
  const tip = $('elemento'); const ficha = $('ficha');
  // botões que abrem outra maquete (o cartão do mezanino): um clique dado antes de a maquete estar pronta fica guardado
  // e é atendido quando ela fica pronta; sem WebGL, o cartão dá lugar ao texto do mezanino (não fica um botão que não responde)
  const atalhos = [...document.querySelectorAll('[data-abrir-maquete]')]; let pedido = null;
  const guardar = (e) => { pedido = e.currentTarget; pedido.setAttribute('aria-busy', 'true'); };
  atalhos.forEach((b) => b.addEventListener('click', guardar));
  const semMaquete = () => {   // sem 3D: a caixa vira só a capa com o aviso (nada de botão que não responde)
    semMaqueteAtalhos(atalhos, $('sobre'));
    caixa.classList.add('sem-3d'); for (const a of ['role', 'tabindex', 'aria-label']) caixa.removeAttribute(a);
  };
  await quandoPerto(caixa.parentElement);
  if (!temWebgl()) { semMaquete(); carregando.textContent = 'Este navegador não abre a maquete 3D. O texto da página continua disponível.'; return; }
  let THREE; let OrbitControls; let GLTFLoader;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (e) { semMaquete(); carregando.textContent = 'Não foi possível carregar a maquete 3D. Atualize a página.'; throw e; }

  // ---- renderizador, cena e luz (valores da R4) ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: movel ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, movel ? 1.5 : 2));
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // a sombra só é refeita quando algo muda (não ao girar a câmera)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement; canvas.setAttribute('aria-hidden', 'true');
  palco.appendChild(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(FUNDO);
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.3, 4000);
  let temAmbiente = false;
  try {
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose(); temAmbiente = true;
  } catch { /* sem ambiente: as luzes bastam */ }
  const hemi = new THREE.HemisphereLight(0xe8eef5, 0x55606b, temAmbiente ? 0.32 : 1.0); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff4e6, 2.6);
  const MAPA = movel ? 1024 : 2048;
  sol.castShadow = true; sol.shadow.mapSize.set(MAPA, MAPA); sol.shadow.bias = -0.0004;
  scene.add(sol, sol.target);
  const contra = new THREE.DirectionalLight(0xd4dde8, 0.35); scene.add(contra);

  // ---- oclusão (só no computador, com a maquete aberta, montada e parada) ----
  let composer = null; let gtao = null; let oclusaoPedida = false;
  // a cadeia de oclusão só é baixada quando o visitante abre a maquete (a página não paga por ela antes)
  async function prepararOclusao() {
    if (oclusaoPedida || movel || cfg.oclusao === false) return; oclusaoPedida = true;
    try {
      const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/GTAOPass.js'), import('three/addons/postprocessing/OutputPass.js'),
      ]);
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, stencilBuffer: true, samples: 4 });
      const c = new EffectComposer(renderer, rt); c.addPass(new RenderPass(scene, camera));
      const g = new GTAOPass(scene, camera, 4, 4);
      g.updateGtaoMaterial({ radius: cfg.oclusao?.raio ?? 0.8, distanceExponent: 1.2, thickness: 1.2, scale: 1.2, samples: 16, screenSpaceRadius: false });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      const ov = g.overrideVisibility.bind(g); const rv = g.restoreVisibility.bind(g); const ocultos = [];
      g.overrideVisibility = () => { renderer.clippingPlanes = cortando ? [planoCorte] : []; scene.traverse((o) => { if (o.userData?.semAO && o.visible) { o.visible = false; ocultos.push(o); } }); ov(); };
      g.restoreVisibility = () => { renderer.clippingPlanes = []; rv(); ocultos.forEach((o) => { o.visible = true; }); ocultos.length = 0; };
      const saida = new OutputPass(); c.addPass(g); c.addPass(saida);
      // compila os sombreadores da oclusão em segundo plano (KHR_parallel_shader_compile): sem isso, o primeiro
      // quadro parado trava a página enquanto o navegador compila (medido: 3,4 s com o cache de sombreadores vazio)
      const q = new THREE.PlaneGeometry(2, 2); const aquecer = new THREE.Scene();
      for (const m of [g.gtaoMaterial, g.normalMaterial, g.pdMaterial, g.copyMaterial, g.blendMaterial]) if (m) aquecer.add(new THREE.Mesh(q, m));
      const fila = [];
      renderer.setRenderTarget(rt);
      for (const planos of [[], [planoCorte]]) { renderer.clippingPlanes = planos; fila.push(renderer.compileAsync(aquecer, camera)); }
      renderer.clippingPlanes = []; renderer.setRenderTarget(null);
      const tela = new THREE.Scene(); tela.add(new THREE.Mesh(q, saida.material)); fila.push(renderer.compileAsync(tela, camera));
      await Promise.all(fila).catch(() => {}); q.dispose();
      composer = c; gtao = g;   // só entra no desenho depois de compilada
    } catch (err) { composer = null; gtao = null; console.warn('maquete: sem oclusão', err); }
    ajustar(); pedir();
  }

  const controles = new OrbitControls(camera, canvas);
  controles.enableDamping = true; controles.dampingFactor = 0.08; controles.enabled = false;
  controles.minPolarAngle = 0.001; controles.maxPolarAngle = Math.PI / 2 - 0.02;
  controles.autoRotate = !reduz; controles.autoRotateSpeed = 0.6;

  // ---- corte com tampa: hachura em espaço de TELA, visível mesmo em peças de 20 cm ----
  const planoCorte = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);
  const hachura = (cfg.tampa?.linha || [0.62, 0.78, 0.93]).map((c) => c.toFixed(2)).join(', ');
  const tampaMat = new THREE.MeshBasicMaterial({
    color: cfg.tampa?.cor ?? 0x23507d, side: THREE.DoubleSide, toneMapped: false,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  tampaMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float hz = fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${hachura}), step(0.72, hz));`);
  };
  const tampa = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tampaMat);
  tampa.renderOrder = 1.1; tampa.userData.semAO = true; tampa.visible = false; tampa.onAfterRender = () => renderer.clearStencil();
  scene.add(tampa);

  // ---- estado ----
  const G = {}; let CAM = []; let meta = null; let raiz = null; let base = null; let casca = null;
  let modeloAtual = cfg.principal; let pronto = false; let aberta = false; let p = 0; let raioX = false; let girar = !reduz; let ocioso = 0;
  let vista = '3d'; let cortando = false; let fracCorte = typeof cfg.corteInicial === 'number' ? cfg.corteInicial : 0.5; let verTudo = false;
  let caixaTudo = null; let caixaFoco = null; let niveis = []; let tween = null; let tweenCam = null;
  let sombraSuja = true; let quadro = 0; let realce = null; let escolhido = null; let pendente = null;
  let arrastando = false; let agitado = false; let tAcabamento = 0; let jaTocou = false; let visivel = false;
  let inicioApresentacao = null; let desfazerIsolamento = null; let isolado = null; let pinos = []; let jaAbriu = false;
  const medidas = { quadros: 0, ao: 0, ms: [], carga: 0 };
  // o que uma extensão (cfg.extensao) enxerga do motor; os valores que mudam são lidos na hora
  // arestaVariavel (arquitetura): a força do contorno vira um uniforme que a extensão muda sem recompilar
  const uForca = { value: cfg.forcaAresta ?? 0.55 };
  const ctx = {
    THREE, scene, camera, planoCorte, pedir: () => pedir(),
    get raiz() { return raiz; }, get G() { return G; }, get meta() { return meta; }, get p() { return p; },
    get cortando() { return cortando; }, get raioX() { return raioX; }, get aberta() { return aberta; },
    // arquitetura (17/11/2026): a extensão troca o estilo (luz, fundo, base, tampa) e refaz a sombra com aplicar()
    renderer, tampa, luzes: { hemi, sol, contra }, forcaAresta: uForca, get base() { return base; }, aplicar: () => aplicar(),
  };
  $('corte').value = Math.round((1 - fracCorte) * 100);
  $('girar').setAttribute('aria-pressed', String(girar));   // com movimento reduzido, começa desligado

  function limpar() {
    for (const o of [raiz, base]) if (o) { scene.remove(o); o.traverse?.((x) => { x.geometry?.dispose(); x.material?.dispose?.(); }); }
    raiz = base = casca = null; isolado = null; for (const k of Object.keys(G)) delete G[k];
    $('camadas').innerHTML = ''; destacar(null); escolhido = null; ficha.hidden = true; tip.hidden = true;
  }

  // caixa em coordenadas do mundo de um {min,max} local da raiz
  const v3 = new THREE.Vector3();
  function noMundo(c, obj = raiz) {
    const b = new THREE.Box3();
    for (const x of [c.min[0], c.max[0]]) for (const y of [c.min[1], c.max[1]]) for (const z of [c.min[2], c.max[2]]) b.expandByPoint(v3.set(x, y, z).applyMatrix4(obj.matrixWorld));
    return b;
  }

  async function carregar(chave) {
    const M = cfg.modelos[chave]; modeloAtual = chave; pronto = false; tween = null; tweenCam = null;
    carregando.hidden = false; carregando.textContent = cfg.textoCarregando;
    const t0 = performance.now();
    limpar();
    $('rotulo').querySelector('span').textContent = M.sub;
    $('ui').querySelector('.topo p').textContent = M.dica;
    const sb = $('sobre'); if (sb) sb.hidden = chave !== 'aco';
    const [buf, m] = await Promise.all([
      fetch(M.glb).then((r) => { if (!r.ok) throw new Error(`GLB ${r.status}`); return r.arrayBuffer(); }),
      fetch(M.meta).then((r) => r.json()),
    ]);
    const gltf = await new Promise((ok, no) => new GLTFLoader().parse(buf, '', ok, no));
    meta = m; CAM = aplicarRotulos(M.camadas ?? cfg.camadas, meta.rotulos);
    raiz = gltf.scene; scene.add(raiz);
    raiz.rotation.y = THREE.MathUtils.degToRad(cfg.giroCena || 0); raiz.scale.y = cfg.exagero || 1; raiz.updateMatrixWorld(true);
    cfg.extensao?.antesDeMontar?.({ THREE, raiz, meta });   // ex.: a terraplanagem troca a malha do terreno pelo bloco fechado
    let cx = new THREE.Box3().setFromObject(raiz, true); const c = cx.getCenter(new THREE.Vector3());
    // 'zero': o nível 0 do modelo é o do terreno (a fundação fica enterrada); 'min': o chão fica sob o ponto mais baixo
    // nivelChao: altura, no modelo, do piso térreo (no GLB de hidrantes, o 0 é o tubo mais fundo, não o chão)
    raiz.position.set(-c.x, cfg.chao === 'min' ? -cx.min.y : -(cfg.nivelChao || 0), -c.z); raiz.updateMatrixWorld(true);

    const caixasTodas = []; const elsTodos = [];
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const cam = CAM.find((k) => k.id === o.name || (o.parent && k.id === o.parent.name));
      if (!cam) { o.visible = false; return; }
      if (G[cam.id]) return;
      const elementos = meta.grupos[cam.id] || [];
      const pos0 = o.geometry.attributes.position.array; const idx0 = o.geometry.index ? o.geometry.index.array : null;
      const caixas = caixasDosElementos(pos0, idx0, elementos);
      caixasTodas.push(...caixas); elsTodos.push(...elementos);
      const contorno = cfg.contorno !== false && !cfg.corPorVertice;
      const mask = contorno ? bordasReais(pos0, idx0, 20) : null;
      // o GLB não traz normais (a oclusão precisa delas). Sem índice, cada face ganha a sua; a ordem das faces não muda,
      // então a ficha continua achando o elemento pelo índice da face.
      o.geometry = o.geometry.toNonIndexed(); o.geometry.computeVertexNormals(); o.geometry.computeBoundingBox();
      if (mask) {
        const n = o.geometry.attributes.position.count; const bar = new Float32Array(n * 3); const em = new Float32Array(n * 3);
        for (let t = 0; t < n / 3; t += 1) for (let k = 0; k < 3; k += 1) {
          bar[(t * 3 + k) * 3 + k] = 1;
          em.set([mask[t * 3], mask[t * 3 + 1], mask[t * 3 + 2]], (t * 3 + k) * 3);
        }
        o.geometry.setAttribute('bary', new THREE.BufferAttribute(bar, 3)); o.geometry.setAttribute('emask', new THREE.BufferAttribute(em, 3));
      }
      const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5); const planos = [plano, planoCorte];
      const cores = M.cores || {}; const metal = !!M.metal && cores[cam.id] !== undefined;
      const porVertice = !!cfg.corPorVertice && !!o.geometry.attributes.color;
      const mat = new THREE.MeshStandardMaterial({
        color: porVertice ? 0xffffff : (cores[cam.id] ?? cam.cor), vertexColors: porVertice, roughness: metal ? 0.5 : porVertice ? 0.55 : 0.88,
        metalness: metal ? 0.25 : 0, envMapIntensity: metal ? 0.5 : 0.28, flatShading: true, clippingPlanes: planos, clipShadows: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      const forca = cfg.forcaAresta ?? 0.55; const brilho = cfg.brilhoVertice ?? 0.3; const variavel = !!cfg.arestaVariavel;
      const fForca = variavel ? 'uForca' : forca.toFixed(2);
      mat.onBeforeCompile = (sh) => {
        if (variavel) sh.uniforms.uForca = uForca;
        if (porVertice) {   // tubos: a cor de cada peça (do IFC) também emite um pouco, para o fio não sumir na sombra
          sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * ${brilho};`);
        }
        if (mask) {          // contorno no próprio material, só nas arestas reais, com largura constante na tela
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 bary;\nattribute vec3 emask;\nvarying vec3 vBar;\nvarying vec3 vEm;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBar = bary;\nvEm = emask;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vBar;\nvarying vec3 vEm;${variavel ? '\nuniform float uForca;' : ''}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
              vec3 dB = vBar + (1.0 - vEm) * 4.0;
              float dE = min(dB.x, min(dB.y, dB.z));
              float wE = max(fwidth(dE), 1e-5);
              float eE = (1.0 - smoothstep(wE * 0.6, wE * 1.6, dE)) * (1.0 - smoothstep(0.12, 0.4, wE));
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.24, eE * ${fForca});`);
        }
      };
      mat.customProgramCacheKey = () => `mq3|${porVertice}|${!!mask}|${forca}|${brilho}${variavel ? '|v' : ''}`;
      o.material = mat; o.castShadow = true; o.receiveShadow = true;
      let matL = null;
      if (!mask && cfg.arestasLinha) {   // reserva: linhas separadas (sem o contorno no material)
        matL = new THREE.LineBasicMaterial({ color: 0x25313d, transparent: true, opacity: cfg.arestasLinha, clippingPlanes: planos });
        const ls = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), matL); ls.userData.semAO = true; o.add(ls);
      }
      // tampa: as duas passadas de stencil usam uma geometria própria, que divide as posições com a malha
      // e só indexa as peças que o plano atravessa (refeita quando o corte muda de lugar)
      const faixas = caixas.map((c, i) => { const b = noMundo(c, o); return { zmin: b.min.z, zmax: b.max.z, f0: elementos[i][2], n: elementos[i][3] }; });
      const geoTampa = new THREE.BufferGeometry(); geoTampa.setAttribute('position', o.geometry.attributes.position);
      geoTampa.setIndex(new THREE.BufferAttribute(new Uint32Array(o.geometry.attributes.position.count), 1)); geoTampa.setDrawRange(0, 0);
      geoTampa.boundingSphere = o.geometry.boundingSphere; geoTampa.boundingBox = o.geometry.boundingBox;
      const aux = [];
      for (const [lado, op] of [[THREE.BackSide, THREE.IncrementWrapStencilOp], [THREE.FrontSide, THREE.DecrementWrapStencilOp]]) {
        const h = new THREE.Mesh(geoTampa, new THREE.MeshBasicMaterial({
          side: lado, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: planos,
          stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
        }));
        h.renderOrder = 1; h.visible = false; h.userData.semAO = true; h.raycast = () => {}; o.add(h); aux.push(h);
      }
      G[cam.id] = { malha: o, mat, matL, plano, aux, geoTampa, faixas, zTampa: NaN, ymin: o.geometry.boundingBox.min.y, ymax: o.geometry.boundingBox.max.y, ligada: true, cam, elementos, caixas };
    });

    // caixa de tudo e caixa de foco (no mundo); o modelo não muda, só o que o quadro mostra primeiro
    caixaTudo = new THREE.Box3().setFromObject(raiz, true);
    const pavsFoco = M.foco ? M.foco(meta) : null;
    const uf = pavsFoco ? uniao(caixasTodas, elsTodos, pavsFoco) : null;
    caixaFoco = null;
    if (uf) {
      caixaFoco = noMundo(uf);
      caixaFoco.min.y = caixaTudo.min.y; caixaFoco.max.y = Math.max(caixaFoco.max.y, caixaTudo.max.y);   // a fundação entra no quadro
      caixaFoco.expandByVector(new THREE.Vector3(2, 0, 2));
    }
    if (cfg.corteInicial === 'auto' && G.lajes) {
      const b = caixaFoco || caixaTudo; const zs = G.lajes.caixas.map((c) => noMundo(c, G.lajes.malha));
      let melhor = 0.5; let nMelhor = -1;
      for (let f = 0.12; f <= 0.88; f += 0.02) {
        const z = b.max.z - f * (b.max.z - b.min.z); const n = zs.filter((c) => c.min.z < z && c.max.z > z).length;
        if (n > nMelhor || (n === nMelhor && Math.abs(f - 0.4) < Math.abs(melhor - 0.4))) { nMelhor = n; melhor = f; }
      }
      fracCorte = melhor; $('corte').value = Math.round((1 - fracCorte) * 100);
    }
    if (cfg.guias && G[cfg.guias.camada] && meta.eixos_tubos) montarGuia(G[cfg.guias.camada]);
    if (cfg.casca) { try { await montarCasca(cfg.casca); } catch (e) { console.warn('maquete: sem a casca', e); } }
    if (casca && cfg.casca.enquadrar) { caixaTudo.expandByObject(casca); }   // o quadro mostra o prédio inteiro, não só os tubos
    niveis = calcularNiveis(M);
    montarBase(); montarCamadas(); montarLegenda(); montarComponentes();
    cfg.extensao?.aposMontar?.(ctx);   // ex.: a terraplanagem prepara o terreno que se transforma, as curvas e a seção
    ajustar(); ajustarSombra(); posicionar(vista, 0);
    await renderer.compileAsync(scene, camera).catch(() => {});   // compila em segundo plano: o primeiro quadro não trava a página
    if (modeloAtual !== chave) return;
    p = reduz ? 1 : 0; aplicar(); pronto = true; carregando.hidden = true; jaTocou = false;
    caixa.dataset.pronto = 'true'; medidas.carga = Math.round(performance.now() - t0);
    if (visivel || aberta) tocar();   // senão, a montagem começa quando a caixa aparecer na tela
    pedir();
  }

  // ---- casca: a arquitetura do MESMO projeto, numa malha só, com opacidade por peça (sem ficha, sombra nem oclusão) ----
  async function montarCasca(c) {
    const g2 = await new Promise((ok, no) => new GLTFLoader().load(c.glb, ok, undefined, no));
    const malhas = []; g2.scene.traverse((o) => { if (o.isMesh) malhas.push({ nome: o.name, pos: o.geometry.attributes.position.array, idx: o.geometry.index ? o.geometry.index.array : null }); });
    const j = juntarCasca(malhas, { opacidades: c.opacidades, padrao: c.opacidade ?? 0.1, cores: c.cores || {}, ...(c.fatorAresta ? { fatorAresta: c.fatorAresta } : {}) });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(j.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(j.cor, 4)); geo.computeVertexNormals();
    const faces = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, clippingPlanes: [planoCorte] }));
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.BufferAttribute(j.linhas.pos, 3)); gl.setAttribute('color', new THREE.BufferAttribute(j.linhas.cor, 4));
    const linhas = new THREE.LineSegments(gl, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, clippingPlanes: [planoCorte] }));
    casca = new THREE.Group(); casca.name = 'casca';
    casca.rotation.y = THREE.MathUtils.degToRad(c.giroY || 0); casca.position.fromArray(c.posicao || [0, 0, 0]);
    for (const o of [faces, linhas]) { o.renderOrder = 3; o.userData.semAO = true; o.raycast = () => {}; casca.add(o); }
    casca.userData.malhas = malhas; raiz.add(casca); raiz.updateMatrixWorld(true);
  }

  // ---- guias: tubo na bitola real vira fio de 1 pixel na vista geral. Cada tubo ganha um cilindro no eixo da ficha
  // (meta.eixos_tubos), com espessura mínima de tela; ao aproximar, o guia some e fica só o tubo real. O guia
  // responde ao clique (abre a ficha do tubo) e não entra na sombra nem na oclusão. ----
  const eixoY = new THREE.Vector3(0, 1, 0); const m4 = new THREE.Matrix4(); const q4 = new THREE.Quaternion();
  const w1 = new THREE.Vector3(); const w2 = new THREE.Vector3(); const w3 = new THREE.Vector3();
  function montarGuia(g) {
    const porId = new Map(g.elementos.map((el) => [el[5], el]));
    const eixos = Object.entries(meta.eixos_tubos).filter(([id]) => porId.has(id));
    if (!eixos.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: cfg.guias.cor, emissive: cfg.guias.cor, emissiveIntensity: 0.35, roughness: 0.6, clippingPlanes: [g.plano, planoCorte] });
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), mat, eixos.length);
    mesh.frustumCulled = false; mesh.userData.semAO = true; mesh.castShadow = false; mesh.visible = false;
    g.malha.add(mesh);
    g.guia = { mesh, eixos, els: eixos.map(([id]) => porId.get(id)), raio: -1 };
  }
  function atualizarGuias() {
    for (const g of Object.values(G)) {
      if (!g.guia) continue;
      const dist = camera.position.distanceTo(controles.target);
      const porPixel = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / (palcoA || 1);
      const r = (cfg.guias.pxMin * porPixel) / 2;
      const liga = r > cfg.guias.raioReal * 1.2 && !raioX && !isolado;
      if (g.guia.mesh.visible !== liga) g.guia.mesh.visible = liga;
      if (!liga || Math.abs(r - g.guia.raio) < g.guia.raio * 0.04) continue;
      g.guia.raio = r;
      g.guia.eixos.forEach(([, [a, b]], i) => {
        w1.fromArray(a); w2.fromArray(b); w3.subVectors(w2, w1);
        const len = w3.length() || 1e-4;
        q4.setFromUnitVectors(eixoY, w3.divideScalar(len));
        m4.compose(w1.add(w2).multiplyScalar(0.5), q4, w3.set(r, len + r, r));
        g.guia.mesh.setMatrixAt(i, m4);
      });
      g.guia.mesh.instanceMatrix.needsUpdate = true; g.guia.mesh.boundingSphere = null; g.guia.mesh.boundingBox = null;
    }
  }

  // ---- níveis: só nomes, tirados da própria geometria (topo das lajes ou pisos da casca) ----
  function calcularNiveis(M) {
    const out = [];
    if (M.niveis === 'lajes' && G.lajes) {
      const lista = niveisPorTopo(G.lajes.caixas, G.lajes.elementos);
      if (!lista.some((n) => n.pav === 0) && meta.pavimentos[0] && cfg.chao !== 'min') lista.unshift({ pav: 0, y: 0 });
      for (const n of lista) { const { nome, ressalva } = nomePavimento(meta.pavimentos[n.pav]); out.push({ nome: ressalva ? `${nome} · ${ressalva}` : nome, y: n.y + raiz.position.y }); }
    } else if (Array.isArray(M.niveis)) {
      const porNome = casca ? Object.fromEntries(casca.userData.malhas.map((m) => [m.nome, m])) : {};
      casca?.updateMatrixWorld(true);
      for (const n of M.niveis) {
        // cota fixa do modelo (ex.: IfcBuildingStorey do mesmo IFC), quando o nível não tem face desenhada
        if (typeof n.y === 'number') { out.push({ nome: n.nome, y: n.y + raiz.position.y }); continue; }
        const m = porNome[n.malha]; if (!m) continue;
        let yLocal = null;
        if (n.base) { for (let i = 1; i < m.pos.length; i += 3) yLocal = Math.min(yLocal ?? Infinity, m.pos[i]); } else { const gs = alturasHorizontais(m.pos, m.idx); if (gs[n.grupo]) yLocal = gs[n.grupo].y; }
        if (yLocal !== null) out.push({ nome: n.nome, y: v3.set(0, yLocal, 0).applyMatrix4(casca.matrixWorld).y });
      }
    }
    const div = $('niveis'); div.innerHTML = out.map((n) => `<span><i></i>${n.nome}</span>`).join('');
    return out;
  }

  // ---- base: bloco de solo translúcido (a fundação continua visível) ou laje de apoio sob o ponto mais baixo ----
  function montarBase() {
    if (base) { scene.remove(base); base.traverse((x) => { x.geometry?.dispose(); x.material?.dispose?.(); }); }
    base = new THREE.Group();
    // a caixa inclui a casca (os muros do lote passam da caixa dos tubos)
    const b = new THREE.Box3().setFromObject(raiz, true); const mx = 3; const w = b.max.x - b.min.x + 2 * mx; const d = b.max.z - b.min.z + 2 * mx;
    const cx = (b.min.x + b.max.x) / 2; const cz = (b.min.z + b.max.z) / 2;
    const linha = (geo, cor, op) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: op, depthWrite: false })); l.userData.semAO = true; return l; };
    if (cfg.chao === 'min') {
      const g = new THREE.BoxGeometry(w, 0.3, d);
      const laje = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x26323e, roughness: 1 }));
      laje.position.set(cx, -0.15, cz); laje.receiveShadow = true; laje.userData.semAO = true; laje.raycast = () => {};
      const borda = linha(g, 0x4d6a86, 0.8); borda.position.copy(laje.position);
      base.add(laje, borda);
    } else {
      const fundo = Math.min(b.min.y, 0) - 0.4; const h = -fundo;
      const g = new THREE.BoxGeometry(w, h, d);
      const solo = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5b6f80, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      solo.position.set(cx, fundo / 2, cz); solo.userData.semAO = true; solo.raycast = () => {}; solo.renderOrder = 2;
      const borda = linha(g, 0x6f8fb0, 0.55); borda.position.copy(solo.position);
      const topo = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.ShadowMaterial({ opacity: 0.38 }));
      topo.rotation.x = -Math.PI / 2; topo.position.set(cx, 0.003, cz); topo.receiveShadow = true; topo.userData.semAO = true; topo.raycast = () => {};
      base.add(solo, borda, topo);
    }
    const passo = Math.max(w, d) > 40 ? 10 : Math.max(w, d) > 12 ? 5 : 1; const lado = Math.ceil(Math.max(w, d) / passo) * passo;
    const grade = new THREE.GridHelper(lado, lado / passo, 0x40586f, 0x34485b);
    grade.position.set(cx, cfg.chao === 'min' ? 0.005 : 0.006, cz); grade.material.transparent = true; grade.material.opacity = 0.45; grade.material.depthWrite = false; grade.userData.semAO = true;
    base.add(grade); scene.add(base);
  }

  // ---- sombra: o frustum cobre só o que está em quadro; o desvio acompanha o tamanho do texel ----
  function ajustarSombra() {
    const b = (!verTudo && caixaFoco) ? caixaFoco : caixaTudo; const s0 = b.getBoundingSphere(new THREE.Sphere());
    const r = s0.radius; const s = r * 1.15;
    const placa = vista === 'planta';
    sol.position.copy(s0.center).add(placa ? new THREE.Vector3(0.02, r * 3, 0.02) : new THREE.Vector3(r * 1.6, r * 1.5, r * 0.7));   // sol da direita; a pino na Planta
    sol.target.position.copy(s0.center);
    Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: r * 6 });
    sol.shadow.camera.updateProjectionMatrix();
    sol.shadow.normalBias = 1.25 * ((2 * s) / MAPA);   // ~1,25 texel
    contra.position.copy(s0.center).add(new THREE.Vector3(-r * 2, r, -r * 1.5));
    sombraSuja = true;
  }

  // ---- montagem, separação, raio-X e corte ----
  function aplicar() {
    const e = +$('explodir').value / 100; const H = caixaTudo ? caixaTudo.max.y - caixaTudo.min.y : 10;
    const esc = raiz ? raiz.scale.y : 1;   // exagero vertical (só a terraplanagem; nas outras é 1)
    for (const g of Object.values(G)) {
      const off = e * H * g.cam.desloca; g.malha.position.y = off / esc;
      const s = ease(lim((p - g.cam.janela[0]) / (g.cam.janela[1] - g.cam.janela[0])));
      g.plano.constant = s >= 1 ? 1e5 : raiz.position.y + off + (g.ymin + (g.ymax - g.ymin) * s) * esc;
      g.malha.visible = g.ligada && s > 0.002 && (!isolado || isolado.g === g);
      g.mat.transparent = raioX; g.mat.opacity = raioX ? (g.cam.id === 'lajes' ? 0.14 : 0.36) : 1; g.mat.depthWrite = !raioX;
      g.malha.castShadow = !raioX; g.malha.userData.semAO = raioX;
      for (const h of g.aux) h.visible = cortando && !raioX && !g.cam.semTampa && g.geoTampa.drawRange.count > 0;   // o desenho de cada quadro ainda esconde a tampa enquanto a câmera se move
    }
    if (cortando) {
      const b = (!verTudo && caixaFoco) ? caixaFoco : caixaTudo; const z = b.max.z - fracCorte * (b.max.z - b.min.z);
      planoCorte.constant = z;
      for (const g of Object.values(G)) if (g.zTampa !== z) {   // só as peças que o plano atravessa entram na tampa
        const ix = g.geoTampa.index; const n = verticesQueCruzam(g.faixas, z, ix.array);
        ix.clearUpdateRanges(); ix.addUpdateRange(0, Math.max(n, 1)); ix.needsUpdate = true; g.geoTampa.setDrawRange(0, n); g.zTampa = z;
        for (const h of g.aux) h.visible = h.visible && n > 0;
      }
      const lado = Math.max(caixaTudo.max.x - caixaTudo.min.x, caixaTudo.max.z - caixaTudo.min.z) * 3 + 40;
      tampa.scale.set(lado, lado, 1); tampa.position.set(0, 0, z - 0.004); tampa.visible = !raioX;
    } else { planoCorte.constant = 1e5; tampa.visible = false; }
    cfg.extensao?.aplicar?.(ctx);
    $('construir').value = Math.round(p * 100); $('pct').textContent = `${Math.round(p * 100)}%`;
    sombraSuja = true; agitado = true; pedir();
  }
  function tocar() {
    if (!pronto) return; if (!jaTocou) inicioApresentacao = performance.now(); jaTocou = true;
    if (reduz) { p = 1; aplicar(); return; }
    const t0 = performance.now(); p = 0; aplicar();
    const ms = (aberta && cfg.montagemAbertaMs) || cfg.montagemMs || MONTAGEM_MS;   // fechada, tudo abaixo de 5 s
    tween = (agora) => { p = lim((agora - t0) / ms); aplicar(); if (p >= 1) tween = null; };
    pedir();
  }
  function montarCamadas() {
    const alvo = $('camadas');
    for (const k of CAM.filter((x) => G[x.id])) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true');
      b.innerHTML = cfg.corPorVertice ? k.nome : `<i style="background:#${G[k.id].mat.color.getHexString()}"></i>${k.nome}`;
      b.addEventListener('click', () => { G[k.id].ligada = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(G[k.id].ligada)); aplicar(); });
      alvo.appendChild(b);
    }
    if (casca) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true'); b.textContent = cfg.casca.nome || 'Casa';
      b.addEventListener('click', () => { casca.visible = !casca.visible; b.setAttribute('aria-pressed', String(casca.visible)); pedir(); });
      alvo.appendChild(b);
    }
    const vt = $('ver-tudo'); if (vt) vt.hidden = !caixaFoco;
  }
  function montarLegenda() {
    const lg = $('legenda'); if (!lg) return;
    const fora = new Set(cfg.semLegenda || []);
    lg.innerHTML = Object.entries(meta.legenda || {}).filter(([n]) => !fora.has(n)).map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('');
    const dl = $('leg-det'); if (dl) { dl.open = false; dl.addEventListener('toggle', () => { medirFaixa(); posicionar(vista); }); }
  }

  // ---- vistas: o quadro desconta a faixa dos controles; a Planta é quase ortográfica ----
  let faixa = 0; let topoUI = 0;
  function posicionar(v, ms = 700, entrada = false) {
    vista = v; const V = cfg.vistas?.[v] || VISTAS[v];   // cfg.vistas: só a terraplanagem (câmera mais alta no Conjunto)
    const d = new THREE.Vector3(...V.dir).normalize();
    const b = (!verTudo && caixaFoco) ? caixaFoco : caixaTudo; const centro = b.getCenter(new THREE.Vector3()); const tam = b.getSize(new THREE.Vector3());
    let fundo = tam.z;
    if (v === 'corte') { const z = b.max.z - fracCorte * tam.z; fundo = z - b.min.z; centro.z = (z + b.min.z) / 2; }
    const h = palco.clientHeight || 1;
    const band = aberta ? Math.min(0.7, (faixa + topoUI) / h) : 0.08;
    const dist = fitBox({ w: tam.x, h: tam.y, d: fundo }, {
      az: (Math.atan2(d.x, d.z) * 180) / Math.PI, el: (Math.asin(d.y) * 180) / Math.PI,
      fovDeg: V.fov, aspect: camera.aspect, band, margin: V.margem ?? 0.9,
    });
    const fim = d.clone().multiplyScalar(dist).add(centro);
    controles.minDistance = dist * 0.25; controles.maxDistance = dist * 2.6;
    const fov0 = camera.fov; const ini = entrada ? d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-35)).multiplyScalar(dist * 1.2).add(centro) : camera.position.clone();
    const alvoIni = controles.target.clone();
    if (!ms || reduz) { camera.fov = V.fov; camera.updateProjectionMatrix(); camera.position.copy(fim); controles.target.copy(centro); controles.update(); ajustarSombra(); pedir(); return; }
    const t0 = performance.now(); if (entrada) camera.position.copy(ini);
    tweenCam = (agora) => {
      const t = lim((agora - t0) / ms); const e = ease(t);
      camera.fov = fov0 + (V.fov - fov0) * e; camera.updateProjectionMatrix();
      camera.position.lerpVectors(ini, fim, e); controles.target.lerpVectors(alvoIni, centro, e); camera.lookAt(controles.target);
      if (t >= 1) tweenCam = null;
    };
    ajustarSombra(); pedir();
  }
  const sph = new THREE.Spherical();
  function girarAz(graus) { const o = camera.position.clone().sub(controles.target); sph.setFromVector3(o); sph.theta += THREE.MathUtils.degToRad(graus); o.setFromSpherical(sph); camera.position.copy(controles.target).add(o); controles.update(); agitado = true; pedir(); }
  function aproximar(f) { const o = camera.position.clone().sub(controles.target); const l = Math.max(controles.minDistance, Math.min(controles.maxDistance, o.length() * f)); camera.position.copy(controles.target).add(o.setLength(l)); controles.update(); agitado = true; pedir(); }

  // ---- ficha por elemento ----
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
  function achar(ev) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const vivos = Object.values(G).filter((g) => g.malha.visible);
    const alvos = vivos.flatMap((g) => (g.guia?.mesh.visible ? [g.malha, g.guia.mesh] : [g.malha]));
    // respeitaPlanos (arquitetura): o clique também ignora o que o plano da própria camada recortou (a planta cortada)
    const naCamada = (h) => { if (!cfg.respeitaPlanos) return true; const g = vivos.find((x) => x.malha === h.object); return !g || g.plano.distanceToPoint(h.point) >= 0; };
    const hit = ray.intersectObjects(alvos, false).find((h) => (!cortando || planoCorte.distanceToPoint(h.point) >= 0) && naCamada(h));
    if (!hit) return null;
    const dono = vivos.find((x) => x.guia?.mesh === hit.object);   // clique no guia = clique no tubo dele
    if (dono) return { g: dono, el: dono.guia.els[hit.instanceId], malha: dono.malha };
    const g = vivos.find((x) => x.malha === hit.object); const f = hit.faceIndex;
    let a = 0; let bb = g.elementos.length - 1;
    while (a < bb) { const m = (a + bb + 1) >> 1; if (g.elementos[m][2] <= f) a = m; else bb = m - 1; }
    return { g, el: g.elementos[a], malha: hit.object };
  }
  function destacar(h) {
    if (realce) { realce.parent?.remove(realce); realce.geometry.dispose(); realce.material.dispose(); realce = null; }
    if (!h || h.g.cam.semRealce) { pedir(); return; }   // semRealce: o terreno é uma peça só; pintá-lo todo esconderia a maquete
    const pos = h.malha.geometry.attributes.position; const [, , ini, n] = h.el; const v = new Float32Array(n * 9);
    for (let i = 0; i < n * 3; i += 1) v.set([pos.getX(ini * 3 + i), pos.getY(ini * 3 + i), pos.getZ(ini * 3 + i)], i * 3);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(v, 3));
    realce = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: DESTAQUE, side: THREE.DoubleSide, toneMapped: false, clippingPlanes: [planoCorte], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    realce.userData.semAO = true; realce.raycast = () => {}; h.malha.add(realce); pedir();
  }
  const pav = (i) => nomePavimento(meta.pavimentos[i] || '');
  const rotulo = (h) => [h.g.cam.um, h.el[0]].filter(Boolean).join(' ');
  const mesmo = (a, b) => (a && b ? a.el === b.el : a === b);
  let sobre = null; let rafPassar = 0;
  canvas.addEventListener('pointermove', (ev) => {
    if (!aberta || ev.pointerType !== 'mouse' || ev.buttons) return;
    pendente = ev; if (!rafPassar) rafPassar = requestAnimationFrame(() => { rafPassar = 0; passar(); });
  });
  canvas.addEventListener('pointerleave', () => { pendente = null; sobre = null; tip.hidden = true; destacar(escolhido); });
  function passar() {   // passar o mouse não redesenha a cena: só quando o realce muda de peça
    if (!pendente) return; const ev = pendente; pendente = null;
    const h = achar(ev);
    if (!mesmo(h, sobre)) { sobre = h; destacar(h || escolhido); }
    if (h) {
      tip.hidden = false; tip.textContent = [rotulo(h), pav(h.el[1]).nome].filter(Boolean).join(' · ');
      const r = caixa.getBoundingClientRect(); tip.style.left = `${Math.min(ev.clientX - r.left + 14, r.width - 220)}px`; tip.style.top = `${ev.clientY - r.top + 14}px`; canvas.style.cursor = 'pointer';
    } else { tip.hidden = true; canvas.style.cursor = 'grab'; }
  }
  let desde = null;
  canvas.addEventListener('pointerdown', (ev) => { desde = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!aberta || !desde || Math.hypot(ev.clientX - desde.x, ev.clientY - desde.y) > 6) return;
    escolher(achar(ev));
  });
  function escolher(h) {
    if (isolado && (!h || h.el !== isolado.el)) isolar(null);
    escolhido = h; destacar(h);
    const sel = $('componente'); if (sel && cfg.componentes) sel.value = h ? String(itensComp.findIndex((it) => it.el === h.el)) : '';
    if (!h) { ficha.hidden = true; return; }
    const pv = pav(h.el[1]); ficha.hidden = false;
    if (cfg.fichaCompleta) {   // como na V02: nome e identidade, pavimento, camada, representação, e as ações
      ficha.replaceChildren();
      const t = document.createElement('b'); t.textContent = `${rotulo(h)}${h.el[5] ? ` · ${h.el[5]}` : ''}`; ficha.append(t);
      for (const txt of [`${pv.nome}${pv.ressalva ? ` · ${pv.ressalva}` : ''}`, h.g.cam.nome, h.el[4] || meta.padrao || '']) {
        if (!txt) continue; const s = document.createElement('span'); s.textContent = txt; ficha.append(s);
      }
      const acoes = document.createElement('div'); acoes.className = 'ficha-acoes';
      const botao = (txt, fn, extra = {}) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; Object.assign(b.dataset, extra.dataset || {}); if (extra.pressed !== undefined) b.setAttribute('aria-pressed', String(extra.pressed)); b.addEventListener('click', fn); acoes.append(b); return b; };
      botao('Aproximar', () => focar(h));
      const bi = botao(isolado ? 'Ver sistema' : 'Isolar', () => { isolar(isolado ? null : h); bi.textContent = isolado ? 'Ver sistema' : 'Isolar'; bi.setAttribute('aria-pressed', String(!!isolado)); }, { pressed: !!isolado, dataset: { acao: 'isolar' } });
      botao('Limpar', () => { escolher(null); ($('componente') || $('fechar')).focus(); });   // o botão some com a ficha: o foco não cai no fundo
      ficha.append(acoes);
      return;
    }
    ficha.innerHTML = `<b>${rotulo(h)}</b>${pv.nome ? `<span>${pv.nome}${pv.ressalva ? ` · ${pv.ressalva}` : ''}</span>` : ''}<span>${h.el[4] || meta.padrao || ''}</span><button type="button" id="soltar">Limpar</button>`;
    $('soltar').addEventListener('click', () => { escolhido = null; destacar(null); ficha.hidden = true; });
  }

  // ---- isolar: só a peça escolhida fica na cena (as faces dela, na malha da camada) ----
  function isolar(h) {
    if (isolado) isolado.malha.geometry.setDrawRange(0, Infinity);
    isolado = h;
    if (h) h.malha.geometry.setDrawRange(h.el[2] * 3, h.el[3] * 3);   // malha sem índice: 3 vértices por face
    aplicar();
  }

  // ---- aproximar: a câmera vai até a caixa da peça (el[7], no modelo), sem perder a direção em que se olhava ----
  function focar(h) {
    if (!h?.el[7]) return;
    const [lo, hi] = h.el[7]; h.malha.updateMatrixWorld(true);
    const a = w1.fromArray(lo).applyMatrix4(h.malha.matrixWorld).clone(); const b = w2.fromArray(hi).applyMatrix4(h.malha.matrixWorld).clone();
    const centro = a.clone().add(b).multiplyScalar(0.5); const tam = Math.max(a.distanceTo(b), 0.15);
    const dist = Math.max(tam * 1.6, 0.9) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);   // a peça ocupa cerca de 1/3 da altura do quadro
    const dir = camera.position.clone().sub(controles.target).normalize(); dir.y = Math.max(dir.y, 0.35); dir.normalize();
    girar = false; controles.autoRotate = false; clearTimeout(ocioso); $('girar').setAttribute('aria-pressed', 'false');
    controles.minDistance = Math.min(controles.minDistance, dist * 0.3);
    const fim = centro.clone().addScaledVector(dir, dist); const ini = camera.position.clone(); const alvoIni = controles.target.clone();
    if (reduz) { camera.position.copy(fim); controles.target.copy(centro); controles.update(); pedir(); return; }
    const t0 = performance.now();
    tweenCam = (agora) => { const t = lim((agora - t0) / 700); const e = ease(t); camera.position.lerpVectors(ini, fim, e); controles.target.lerpVectors(alvoIni, centro, e); camera.lookAt(controles.target); if (t >= 1) tweenCam = null; };
    pedir();
  }

  // ---- lista de componentes (select nativo, agrupado por camada) e marcadores numerados, como na V02 ----
  let itensComp = [];
  function montarComponentes() {
    const sel = $('componente'); const mk = $('marcadores');
    if (mk) mk.replaceChildren(); pinos = [];
    if (!sel || !cfg.componentes) return;
    sel.replaceChildren(new Option('Escolha um componente…', '')); itensComp = [];
    const ordem = cfg.ordemComponentes || CAM.map((k) => k.id);
    for (const id of ordem) {
      const g = G[id]; if (!g) continue;
      const grupo = document.createElement('optgroup'); grupo.label = g.cam.nome;
      for (const el of g.elementos) {
        if (!cfg.componentes(el, g.cam)) continue;
        grupo.append(new Option(`${el[0]} · ${el[5]} · ${pav(el[1]).nome}`, String(itensComp.length)));
        itensComp.push({ g, el });
        if (mk && cfg.marcadores?.(el)) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'pino';
          b.textContent = cfg.marcadores(el) === true ? String(pinos.filter((x) => x.numerado).length + 1) : cfg.marcadores(el);
          b.setAttribute('aria-label', `${el[0]} ${el[5]}`); b.hidden = true;
          const h = { g, el, malha: g.malha };
          b.addEventListener('click', (e) => { e.stopPropagation(); escolher(h); focar(h); });
          mk.append(b); pinos.push({ b, g, el, numerado: cfg.marcadores(el) === true, ant: '' });
        }
      }
      if (grupo.children.length) sel.append(grupo);
    }
  }
  $('componente')?.addEventListener('change', (e) => {
    const it = itensComp[+e.target.value]; if (e.target.value === '' || !it) { escolher(null); return; }
    if (!it.g.ligada) { it.g.ligada = true; [...$('camadas').children].find((b) => b.textContent === it.g.cam.nome)?.setAttribute('aria-pressed', 'true'); }
    tween = null; p = 1; aplicar();
    const h = { g: it.g, el: it.el, malha: it.g.malha }; escolher(h); focar(h);
  });
  $('visao-geral')?.addEventListener('click', () => { escolher(null); posicionar(vista === 'corte' ? 'corte' : '3d'); });
  const vm = new THREE.Vector3(); const ocupados = [];
  function atualizarMarcadores() {   // não lê layout: posição em % do palco; dois marcadores a menos de 48 px, fica o primeiro
    ocupados.length = 0;
    for (const pn of pinos) {
      vm.fromArray(pn.el[6]).applyMatrix4(pn.g.malha.matrixWorld); const acima = vm.y > pn.g.plano.constant; vm.project(camera);
      const px = (vm.x + 1) * palcoL / 2; const py = (1 - vm.y) * palcoA / 2;
      let esconde = !aberta || !pn.g.malha.visible || !!escolhido || acima || vm.z > 1 || vm.z < -1 || Math.abs(vm.x) > 0.95 || Math.abs(vm.y) > 0.85 || (cortando && planoCorte.distanceToPoint(w3.fromArray(pn.el[6]).applyMatrix4(pn.g.malha.matrixWorld)) < 0);
      if (!esconde && ocupados.some(([x, y]) => Math.abs(x - px) < 48 && Math.abs(y - py) < 48)) esconde = true;
      if (!esconde) ocupados.push([px, py]);
      if (pn.b.hidden !== esconde) pn.b.hidden = esconde;
      const tr = `translate(calc(${Math.round(px)}px - 50%), calc(${Math.round(py)}px - 50%))`; if (!esconde && pn.ant !== tr) { pn.ant = tr; pn.b.style.transform = tr; }
    }
  }

  // ---- abrir e fechar (a caixa cresce até a tela inteira), como na página publicada ----
  const animar = (de, para, ms) => {
    if (reduz) return Promise.resolve();
    const anim = caixa.animate([de, para], { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    return Promise.race([anim.finished.catch(() => {}), new Promise((ok) => setTimeout(ok, ms + 80))]);
  };
  const cheia = { top: '0px', left: '0px', width: '100vw', height: '100dvh' };
  let origemEl = null;
  async function abrir(origem) {
    if (aberta || !pronto) return; aberta = true; origemEl = origem || null;
    const r = (origem || caixa).getBoundingClientRect(); const de = { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` };
    Object.assign(caixa.style, de); caixa.classList.add('aberta'); document.body.classList.add('travado', 'mq3-aberta');   // mq3-aberta: o botão do WhatsApp sai
    caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-modal', 'true'); caixa.setAttribute('aria-label', cfg.rotuloDialogo);
    desfazerIsolamento = isolarFundo(caixa);   // Tab e Shift+Tab ficam dentro da maquete aberta
    $('rotulo').hidden = true; $('explorar').hidden = true; $('ui').hidden = false;
    await animar(de, cheia, 480);
    caixa.getAnimations().forEach((a) => a.cancel()); Object.assign(caixa.style, cheia);
    controles.enabled = true; controles.autoRotate = girar; ajustar(); prepararOclusao();
    posicionar(vista, 900, true); $('fechar').focus();
    // com montagemAbertaMs (terraplanagem), a primeira abertura conta a sequência inteira, mais devagar
    if ((p < 0.001 && !tween) || (cfg.montagemAbertaMs && !jaAbriu)) tocar();
    jaAbriu = true;
    const sb = $('sobre'); if (sb && !sb.hidden) sb.open = innerWidth > 640;
  }
  async function fechar() {
    if (!aberta) return; controles.enabled = false; clearTimeout(ocioso); destacar(null); escolhido = null; tip.hidden = true; ficha.hidden = true;
    const v = (origemEl && document.contains(origemEl) ? origemEl : caixa.parentElement).getBoundingClientRect();
    const para = { top: `${v.top}px`, left: `${v.left}px`, width: `${v.width}px`, height: `${v.height}px` };
    $('ui').hidden = true; await animar(cheia, para, 420);
    caixa.getAnimations().forEach((a) => a.cancel()); caixa.classList.remove('aberta'); caixa.removeAttribute('style'); document.body.classList.remove('travado', 'mq3-aberta');
    caixa.setAttribute('role', 'button'); caixa.removeAttribute('aria-modal'); caixa.removeAttribute('aria-label');   // fechada, o nome vem do texto visível (título, legenda e "Montar e explorar")
    $('rotulo').hidden = false; $('explorar').hidden = false; aberta = false;
    escolherVista('3d', false); verTudo = false; $('ver-tudo')?.setAttribute('aria-pressed', 'false');
    if (desfazerIsolamento) { desfazerIsolamento(); desfazerIsolamento = null; }
    controles.autoRotate = false; ajustar(); posicionar('3d', 0); focoDeVolta(origemEl, caixa).focus();   // fechada, a caixa fica parada
    if (modeloAtual !== cfg.principal) carregar(cfg.principal);   // a maquete principal volta a ser a do topo
  }
  caixa.addEventListener('click', () => { if (!aberta) abrir(); });
  caixa.addEventListener('keydown', (e) => { if (!aberta && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(); } });
  addEventListener('keydown', (e) => {
    if (!aberta) return;
    const campo = e.target instanceof HTMLInputElement;
    if (e.key === 'Escape') {   // primeiro limpa a peça escolhida; na ficha completa, se o foco estava nela (que some), vai para a lista
      if (escolhido) { const naFicha = cfg.fichaCompleta && ficha.contains(document.activeElement); escolher(null); if (naFicha) ($('componente') || $('fechar')).focus(); } else fechar();
      return;
    }
    if (campo) return;
    if (e.key === 'ArrowLeft') { girarAz(-10); e.preventDefault(); }
    if (e.key === 'ArrowRight') { girarAz(10); e.preventDefault(); }
    if (e.key === '+' || e.key === '=') { aproximar(0.88); e.preventDefault(); }
    if (e.key === '-') { aproximar(1.14); e.preventDefault(); }
  });
  async function abrirAtalho(b) {
    b.removeAttribute('aria-busy');
    if (aberta) return; const chave = b.dataset.abrirMaquete;
    if (chave !== modeloAtual) await carregar(chave);
    abrir(b);
  }
  $('fechar').addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
  $('ui').addEventListener('click', (e) => e.stopPropagation());

  // ---- controles ----
  function escolherVista(v, mover = true) {
    document.querySelectorAll('#ui [data-vista]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.vista === v)));
    cortando = v === 'corte'; $('faixa-corte').hidden = !cortando;
    const [txtDentro, txtFora] = cfg.textoPorDentro || ['Ver por dentro', 'Voltar ao exterior'];
    const pd = $('por-dentro'); if (pd) { pd.setAttribute('aria-pressed', String(cortando)); pd.textContent = cortando ? txtFora : txtDentro; }
    medirFaixa(); aplicar(); if (mover) posicionar(v);
  }
  controles.addEventListener('start', () => { arrastando = true; controles.autoRotate = false; clearTimeout(ocioso); if (movel && cortando) aplicar(); });
  controles.addEventListener('end', () => { arrastando = false; if (girar) ocioso = setTimeout(() => { if (aberta) { controles.autoRotate = true; pedir(); } }, 4000); if (movel && cortando) aplicar(); pedir(); });
  controles.addEventListener('change', pedir);
  document.querySelectorAll('#ui [data-vista]').forEach((b) => b.addEventListener('click', () => escolherVista(b.dataset.vista)));
  $('por-dentro')?.addEventListener('click', () => escolherVista(cortando ? '3d' : 'corte'));
  $('ver-tudo')?.addEventListener('click', (e) => { verTudo = !verTudo; e.currentTarget.setAttribute('aria-pressed', String(verTudo)); ajustarSombra(); aplicar(); posicionar(vista); });
  $('raiox').addEventListener('click', (e) => { raioX = !raioX; e.currentTarget.setAttribute('aria-pressed', String(raioX)); for (const g of Object.values(G)) g.mat.needsUpdate = true; aplicar(); });
  $('girar').addEventListener('click', (e) => { clearTimeout(ocioso); girar = !girar; e.currentTarget.setAttribute('aria-pressed', String(girar)); controles.autoRotate = girar; pedir(); });
  $('montar').addEventListener('click', tocar);
  $('construir').addEventListener('input', (e) => { tween = null; p = +e.target.value / 100; aplicar(); });
  $('explodir').addEventListener('input', aplicar);
  $('corte').addEventListener('input', (e) => { fracCorte = 1 - +e.target.value / 100; aplicar(); });
  $('mais-zoom')?.addEventListener('click', () => aproximar(0.85));
  $('menos-zoom')?.addEventListener('click', () => aproximar(1.18));
  $('mais')?.addEventListener('toggle', () => { medirFaixa(); });

  // ---- tamanho, escala, níveis e desenho sob demanda ----
  function medirFaixa() {
    if (!aberta) { faixa = 0; topoUI = 0; camera.clearViewOffset(); return; }
    const w = palco.clientWidth || 1; const h = palco.clientHeight || 1;
    faixa = ($('ui').querySelector('.baixo')?.offsetHeight || 0) + 16; topoUI = ($('ui').querySelector('.topo')?.offsetHeight || 0) * 0.75;
    camera.setViewOffset(w, h, 0, Math.round((faixa - topoUI) / 2), w, h);
  }
  let palcoL = 1; let palcoA = 1;
  function ajustar() {
    const w = palco.clientWidth || 1; const h = palco.clientHeight || 1; palcoL = w; palcoA = h;
    renderer.setSize(w, h, false); composer?.setSize(w, h);
    if (gtao) { const pr = renderer.getPixelRatio(); gtao.setSize(Math.max(2, Math.round(w * pr * 0.5)), Math.max(2, Math.round(h * pr * 0.5))); }
    camera.aspect = w / h; medirFaixa(); camera.updateProjectionMatrix(); pedir();
  }
  new ResizeObserver(() => { ajustar(); if (pronto) posicionar(vista, 0); }).observe(palco);
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel && pronto && !jaTocou) tocar(); if (visivel) pedir(); }).observe(caixa.parentElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pedir(); });

  const escalaEl = $('escala'); const niveisEl = $('niveis'); const vp = new THREE.Vector3();
  // escala e rótulos de nível: a cada quadro em movimento. Só escreve no DOM o que mudou e não lê layout
  // (tamanho do palco vem de ajustar(); largura de cada rótulo é medida uma vez), para não forçar o navegador a refazer a página.
  let escalaAnt = ''; const mostra = (el, v) => { if (el.hidden === v) el.hidden = !v; };
  function atualizarSobreposicoes() {
    if (escalaEl) {
      mostra(escalaEl, aberta);
      if (aberta) {
        const mpp = (2 * camera.position.distanceTo(controles.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / palcoA;
        const s = scaleBar(mpp); const px = Math.round(s.px); const txt = `${String(s.meters).replace('.', ',')} m`;
        if (`${px}|${txt}` !== escalaAnt) { escalaAnt = `${px}|${txt}`; escalaEl.querySelector('i').style.width = `${px}px`; escalaEl.querySelector('span').textContent = txt; }
      }
    }
    const mostrar = aberta && niveis.length > 0 && (vista === 'corte' || vista === 'frente') && p >= 1 && +$('explodir').value === 0;
    mostra(niveisEl, mostrar);
    if (mostrar) {
      const b = caixaFoco || caixaTudo; const z = cortando ? planoCorte.constant : b.max.z;   // rótulos sempre junto ao prédio
      let ultimoY = Infinity;   // de baixo para cima; um rótulo que colidiria com o anterior fica escondido
      [...niveisEl.children].forEach((el, i) => {
        if (!el._larg) { el.hidden = false; el._larg = el.offsetWidth; }
        vp.set(b.min.x - 0.6, niveis[i].y, z).project(camera);
        const py = (-vp.y * 0.5 + 0.5) * palcoA; let esconde = ultimoY - py < 26; if (!esconde) ultimoY = py;
        const px = Math.max((vp.x * 0.5 + 0.5) * palcoL, el._larg + 12); esconde = esconde || vp.z > 1 || px > palcoL - 60;
        if (el.hidden !== esconde) el.hidden = esconde;
        const tr = `translate(calc(${Math.round(px)}px - 100%), calc(${Math.round(py)}px - 50%))`; if (el._tr !== tr) { el._tr = tr; el.style.transform = tr; }
      });
    }
  }


  function pedir() { if (!quadro) quadro = requestAnimationFrame(desenhar); }
  function desenhar(agora) {
    quadro = 0;
    if (!raiz || (!visivel && !aberta) || document.hidden) return;
    if (tween) tween(agora); if (tweenCam) tweenCam(agora);
    passar();
    if (cfg.guias) atualizarGuias();
    if (!aberta) controles.autoRotate = giroFechado(inicioApresentacao == null ? null : agora - inicioApresentacao, { reduz, girar });
    const mexeu = controles.update();
    const dc = camera.position.distanceTo(controles.target); camera.near = Math.max(cfg.pertoMin ?? 0.3, dc * 0.02); camera.far = dc * 4 + 400; camera.updateProjectionMatrix();
    if (sombraSuja) { renderer.shadowMap.needsUpdate = true; sombraSuja = false; }
    renderer.info.reset();
    const t0 = performance.now();
    // oclusão só com a maquete aberta, montada e parada: um quadro de acabamento entra depois de uma pausa curta
    const movendo = !!(tween || tweenCam || controles.autoRotate || mexeu || arrastando || agitado);
    medidas.motivo = movendo ? [tween && 'montagem', tweenCam && 'camera', controles.autoRotate && 'girar', mexeu && 'controles', arrastando && 'arrasto', agitado && 'cena'].filter(Boolean).join(',') : '';
    agitado = false;
    // ficha completa (incêndio): com peça escolhida, sem o quadro de oclusão; nele o realce ficava encoberto em parte
    // (medido em 17/11/2026 na maquete de incêndio). Nas outras maquetes, o comportamento não muda.
    const podeAO = aberta && composer && p >= 1 && !raioX && !(cfg.fichaCompleta && escolhido);
    // corte: a tampa (duas passadas de stencil por camada) some enquanto a câmera se move e volta quando ela para
    const camMovendo = !!(tweenCam || controles.autoRotate || mexeu || arrastando);
    const comTampa = cortando && !raioX && !camMovendo;
    tampa.visible = comTampa; for (const g of Object.values(G)) for (const h of g.aux) h.visible = comTampa && !g.cam.semTampa && g.geoTampa.drawRange.count > 0;
    clearTimeout(tAcabamento);
    if (podeAO && !movendo) { composer.render(); medidas.ao += 1; } else { renderer.render(scene, camera); if (podeAO || (cortando && camMovendo)) tAcabamento = setTimeout(pedir, 160); }
    medidas.quadros += 1; medidas.ms.push(performance.now() - t0); if (medidas.ms.length > 120) medidas.ms.shift();
    atualizarSobreposicoes(); if (pinos.length) atualizarMarcadores();
    if (tween || tweenCam || controles.autoRotate || mexeu) pedir();
  }

  // gancho de medição (validação local; não muda nada na página)
  if (new URLSearchParams(location.search).has('medir')) window.__maquete = {
    stats: () => ({ chamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, memoria: { ...renderer.info.memory, programas: renderer.info.programs?.length ?? 0 }, tampa: Object.fromEntries(Object.entries(G).map(([k, g]) => [k, g.geoTampa.drawRange.count / 3])), quadros: medidas.quadros, quadrosAO: medidas.ao, msMediana: [...medidas.ms].sort((a, b) => a - b)[medidas.ms.length >> 1] ?? null, carga: medidas.carga, motivo: medidas.motivo, ao: !!composer, p, vista, aberta, modelo: modeloAtual, texelSombra: +((2 * sol.shadow.camera.right) / MAPA).toFixed(4), normalBias: +sol.shadow.normalBias.toFixed(4) }),
    pronto: () => pronto && !tween && !tweenCam, abrir: () => abrir(), vista: (v) => escolherVista(v), niveis: () => niveis.map((n) => ({ ...n, y: +n.y.toFixed(2) })),
    interno: () => ({ renderer, scene, camera }),   // só para medir no navegador de teste
    girar: (g) => girarAz(g), parar: () => { clearTimeout(ocioso); girar = false; controles.autoRotate = false; },
    andamento: (v) => { tween = null; p = v; aplicar(); },   // capturas de um estado da montagem
    extensao: () => cfg.extensao?.medir?.() ?? null,
  };

  try { await carregar(modeloAtual); } catch (e) { carregando.hidden = false; carregando.textContent = 'Não foi possível carregar a maquete.'; console.error(e); semMaquete(); return; }
  // daqui em diante o atalho abre direto; o clique guardado (se houve) é atendido agora
  atalhos.forEach((b) => { b.removeEventListener('click', guardar); b.addEventListener('click', () => abrirAtalho(b)); });
  if (pedido) { const b = pedido; pedido = null; abrirAtalho(b); }
}

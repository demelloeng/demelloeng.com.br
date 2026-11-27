// Maquete V03 da página de projeto de arquitetura: configuração e a extensão própria do motor.
// Modelo: casa-exemplo.glb, intacto (o mesmo que a maquete hidrossanitária usa como casca; SHA-256 conferido nos
// testes). O GLB vem agrupado por classe (paredes, portas, janelas...), sem nomes de ambiente, sem pavimentos e sem
// norte. O que a extensão faz, só com a geometria dele:
// - cada camada é dividida nas suas peças (a ficha identifica uma porta, uma janela, uma parede);
// - nas janelas, o painel de espessura zero (o vidro) vira uma camada à parte, translúcida, e o caixilho fica opaco;
// - o solo sob o lote sai da base dos muros, em degraus (o comportamento da maquete publicada);
// - dois estilos: Projeto (técnico, com contorno) e Realista (cores de material por aproximação, luz de dia);
// - a Planta é cortada a 1,50 m do piso térreo, como uma planta baixa.
import { maquete } from './motor.mjs?v=7';
import { pecas, juntarVizinhas, separarPlanas, medida, degrausDoSolo } from './casa.mjs?v=1';

const caixa = document.getElementById('caixa');
const TERREO = 3.68;              // piso térreo (faces horizontais do grupo mais baixo da malha "piso", em m do modelo)
const FOLGA_PORTA = 0.25;        // m: junta as guarnições (dos dois lados da parede) e a folha de cada porta
const CORTE_PLANTA = 1.5;         // altura do corte da planta acima do piso térreo (convenção de planta baixa)
const m2 = (v) => v.toFixed(2).replace('.', ',');

// cores por estilo (sRGB). Realista: aproximação visual do material de cada classe, não especificação.
const CORES = {
  projeto: { paredes: 0xe9eef3, muros: 0xc6d2de, piso: 0xaebfcf, deck: 0x86a0ba, cobertura: 0x3a72ad, janelas: 0x56789a, vidros: 0x8ec9f5, portas: 0x9db2c7, pilares: 0xd3dde8, gradil: 0x7f97b0, piscina: 0x4fa3e0 },
  realista: { paredes: 0xf2ede3, muros: 0xd8d1c4, piso: 0xbdb7ab, deck: 0x9a6b43, cobertura: 0xa9b0b7, janelas: 0x3d4852, vidros: 0xa9cfe8, portas: 0x7b5a3d, pilares: 0xd2cdc4, gradil: 0x37424c, piscina: 0x3fa9d6 },
};
const SOLO = { projeto: { topo: 0x263544, lado: 0x1c2833, linha: 0x6aa0d8, opLinha: 0.5 }, realista: { topo: 0x86a96d, lado: 0x6f5a45, linha: 0x3d4a3a, opLinha: 0.18 } };
const PALCO = {
  projeto: { fundo: 0x1b242d, hemi: [0xe8eef5, 0x55606b], sol: [0xfff4e6, 2.6], contra: 0.35, forca: 0.55, exposicao: 1.05, tampa: 0x23507d, grade: true },
  realista: { fundo: 0xdfe7ee, hemi: [0xeaf3ff, 0x8a9a78], sol: [0xfff0d8, 3.1], contra: 0.25, forca: 0.16, exposicao: 1.1, tampa: 0x4a4a46, grade: false },
};
const POCHE = ['paredes', 'muros', 'pilares'];            // camadas escurecidas na planta cortada
const CORES_PLANTA = { projeto: 0x24313e, realista: 0x3b3a37 };
const NOMES = { paredes: 'Parede', portas: 'Porta', janelas: 'Janela', vidros: 'Vidro', cobertura: 'Cobertura', piscina: 'Piscina', pilares: 'Pilar', deck: 'Deck', muros: 'Muro', gradil: 'Gradil' };

const E = { estilo: 'projeto', solo: null, auxSolo: [], matsSolo: null };   // estado da extensão

const xyz = (o) => { const a = o.geometry.attributes.position; const out = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i += 1) out.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3); return out; };
const indice = (o) => (o.geometry.index ? Uint32Array.from(o.geometry.index.array) : null);

const extensao = {
  // antes de o motor montar as camadas: as peças de cada malha viram os elementos da ficha; os vidros saem das janelas
  antesDeMontar({ THREE, raiz, meta }) {
    meta.grupos = {};
    const elementos = (id, lista, texto) => lista.map((p) => {
      const nome = id === 'piso' ? (p.min[1] > TERREO + 1 ? 'Laje' : 'Piso') : NOMES[id];
      if (id === 'piso') return [nome, 0, p.ini, p.n, nome === 'Laje' ? 'Laje sobre o térreo, no modelo.' : 'Piso no nível do térreo, no modelo.'];
      return [nome, 0, p.ini, p.n, texto(p)];
    });
    const padrao = (id) => () => meta.textos?.[id] || '';
    for (const o of [...raiz.children]) {
      if (!o.isMesh) continue;
      const id = o.name; const pos = xyz(o); const idx = indice(o); let lista = pecas(pos, idx);
      if (id === 'muros') E.muros = pos;
      if (id === 'piscina') E.piscina = lista[0];
      if (id === 'janelas') {
        const s = separarPlanas(pos, idx, lista);
        const geo = (P) => {   // com índice sequencial: o motor desfaz o índice de toda camada (a ordem das faces não muda)
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
          g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: P.length / 3 }, (_, i) => i), 1)); return g;
        };
        o.geometry.dispose(); o.geometry = geo(s.solidas.pos);
        const vidros = new THREE.Mesh(geo(s.planas.pos)); vidros.name = 'vidros'; raiz.add(vidros);
        meta.grupos.janelas = elementos('janelas', s.solidas.pecas, (p) => `Medida da peça no modelo: ${medida(p)}.`);
        meta.grupos.vidros = elementos('vidros', s.planas.pecas, padrao('vidros'));
        continue;
      }
      if (id === 'portas') lista = juntarVizinhas(lista, FOLGA_PORTA);   // guarnições e folha de cada porta viram uma peça só
      const texto = id === 'portas' ? (p) => `Medida da peça no modelo: ${medida(p)}.`
        : id === 'paredes' ? (p) => `Altura da peça no modelo: ${m2(p.max[1] - p.min[1])} m.` : padrao(id);
      meta.grupos[id] = elementos(id, lista, texto);
    }
  },

  // depois de montadas as camadas: o solo, o vidro ligado às janelas e os botões de estilo
  aposMontar(ctx) {
    const { THREE, G, raiz, planoCorte } = ctx;
    montarSolo(THREE, raiz, planoCorte);
    // a base do motor (laje escura sob o ponto mais baixo) fica por baixo do solo; a grade desce ao fundo do solo
    const [laje, borda, grade] = ctx.base.children; laje.visible = false; borda.visible = false; grade.position.y = E.fundo + raiz.position.y - 0.01;
    E.grade = grade;
    // o vidro acompanha o botão das janelas (um botão só para a esquadria)
    const chips = [...document.querySelectorAll('#camadas .chip')];
    chips.find((b) => b.textContent === 'Vidros')?.remove();
    const bj = chips.find((b) => b.textContent === 'Janelas');
    bj?.addEventListener('click', () => { if (G.vidros) { G.vidros.ligada = G.janelas.ligada; ctx.aplicar(); } });
    // botão do solo, no fim das camadas
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true'); b.innerHTML = '<i></i>Solo'; E.chipSolo = b;
    b.addEventListener('click', () => { E.solo.visible = !E.solo.visible; b.setAttribute('aria-pressed', String(E.solo.visible)); ctx.aplicar(); });
    document.getElementById('camadas').appendChild(b);
    document.querySelectorAll('#ui [data-estilo]').forEach((x) => x.addEventListener('click', () => {
      document.querySelectorAll('#ui [data-estilo]').forEach((y) => y.setAttribute('aria-checked', String(y === x)));
      aplicarEstilo(ctx, x.dataset.estilo);
    }));
    E.nota = document.getElementById('nota-vista');
    montarTampaPlanta(ctx);
    aplicarEstilo(ctx, E.estilo, false);
  },

  // a cada passo (depois do motor): vidro translúcido, planta cortada e o solo no corte
  aplicar(ctx) {
    const { G, raiz, p, raioX, cortando } = ctx; if (!E.solo) return;
    const vidro = G.vidros;
    if (vidro && !raioX) {
      vidro.mat.transparent = true; vidro.mat.opacity = E.estilo === 'realista' ? 0.32 : 0.42; vidro.mat.depthWrite = false;
      vidro.malha.castShadow = false; vidro.malha.userData.semAO = true;
    }
    const vista = document.querySelector('#ui [data-vista][aria-checked="true"]')?.dataset.vista;   // o motor só atualiza a vista depois
    const cortada = vista === 'planta' && p >= 1;
    const y = TERREO + CORTE_PLANTA + raiz.position.y;
    for (const g of Object.values(G)) if (cortada) g.plano.constant = Math.min(g.plano.constant, y + g.malha.position.y);
    // tampa da planta: o que o plano atravessa nas paredes, muros e pilares fica escuro, como a parede cortada no desenho
    // (só sem separar camadas: separadas, cada camada estaria numa altura e a tampa única não caberia)
    const comTampa = cortada && !raioX && +document.getElementById('explodir').value === 0;
    E.tampaPlanta.visible = comTampa; E.tampaPlanta.position.y = y; E.tampaPlanta.material.color.set(CORES_PLANTA[E.estilo]);
    for (const h of E.auxPlanta) h.visible = comTampa && h.userData.g.ligada;
    if (E.nota) { const t = cortada ? 'Planta cortada a 1,50 m do piso térreo.' : ''; if (E.nota.textContent !== t) { E.nota.textContent = t; E.nota.hidden = !t; } }
    for (const h of E.auxSolo) h.visible = cortando && !raioX && E.solo.visible;
    E.solo.traverse((o) => { if (o.isMesh && !o.userData.aux) { o.castShadow = !raioX; o.material.forEach?.((m) => { m.transparent = raioX; m.opacity = raioX ? 0.25 : 1; m.depthWrite = !raioX; }); } });
  },
};

// ---- tampa da planta: duas passadas de stencil por camada (recortadas pelo plano horizontal de cada uma, g.plano) e um
// plano escuro na altura do corte, desenhado só onde o plano está dentro de uma peça (como a tampa do Corte do motor) ----
function montarTampaPlanta({ THREE, G, scene, renderer }) {
  E.auxPlanta = [];
  for (const id of POCHE) {
    const g = G[id]; if (!g) continue;
    for (const [lado, op] of [[THREE.BackSide, THREE.IncrementWrapStencilOp], [THREE.FrontSide, THREE.DecrementWrapStencilOp]]) {
      const h = new THREE.Mesh(g.malha.geometry, new THREE.MeshBasicMaterial({ side: lado, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: [g.plano], stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op }));
      h.renderOrder = 1; h.visible = false; h.userData.semAO = true; h.userData.g = g; h.raycast = () => {}; g.malha.add(h); E.auxPlanta.push(h);
    }
  }
  const t = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: CORES_PLANTA.projeto, toneMapped: false, stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp }));
  t.rotation.x = -Math.PI / 2; t.renderOrder = 1.1; t.visible = false; t.userData.semAO = true; t.raycast = () => {};
  t.onAfterRender = () => renderer.clearStencil(); scene.add(t); E.tampaPlanta = t;
}

// ---- solo: degraus pela base dos muros, com o furo da piscina (como na maquete publicada) ----
function montarSolo(THREE, raiz, planoCorte) {
  const d = degrausDoSolo(E.muros); if (!d) return;
  const pb = E.piscina; const fundo = Math.min(...d.degraus.map((x) => x.y), pb ? pb.min[1] : Infinity) - 1.4; E.fundo = fundo;
  const base = { roughness: 1, metalness: 0, flatShading: true, clippingPlanes: [planoCorte], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  E.matsSolo = { topo: new THREE.MeshStandardMaterial({ ...base }), lado: new THREE.MeshStandardMaterial({ ...base }), linha: new THREE.LineBasicMaterial({ transparent: true, clippingPlanes: [planoCorte] }) };
  const solo = new THREE.Group(); solo.name = 'solo';
  for (const g of d.degraus) {
    const forma = new THREE.Shape(); forma.moveTo(d.x0, -g.z0); forma.lineTo(d.x1, -g.z0); forma.lineTo(d.x1, -g.z1); forma.lineTo(d.x0, -g.z1); forma.closePath();
    if (pb && Math.abs(g.y - pb.max[1]) < 0.3 && pb.max[2] > g.z0 && pb.min[2] < g.z1) {   // furo da piscina no degrau da cota dela
      const z0 = Math.max(pb.min[2], g.z0); const z1 = Math.min(pb.max[2], g.z1); const h = new THREE.Path();
      h.moveTo(pb.min[0], -z0); h.lineTo(pb.min[0], -z1); h.lineTo(pb.max[0], -z1); h.lineTo(pb.max[0], -z0); h.closePath(); forma.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(forma, { depth: g.y - fundo, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [E.matsSolo.topo, E.matsSolo.lado]); m.position.y = fundo; m.castShadow = true; m.receiveShadow = true; m.raycast = () => {};
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), E.matsSolo.linha); l.userData.semAO = true; l.raycast = () => {}; m.add(l);
    // tampa do corte: as mesmas duas passadas de stencil das camadas (o solo cortado não fica oco)
    for (const [lado, op] of [[THREE.BackSide, THREE.IncrementWrapStencilOp], [THREE.FrontSide, THREE.DecrementWrapStencilOp]]) {
      const h = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: lado, colorWrite: false, depthWrite: false, depthTest: false, clippingPlanes: [planoCorte], stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op }));
      h.renderOrder = 1; h.visible = false; h.userData.semAO = true; h.userData.aux = true; h.raycast = () => {}; m.add(h); E.auxSolo.push(h);
    }
    solo.add(m);
  }
  raiz.add(solo); raiz.updateMatrixWorld(true); E.solo = solo;
}

// ---- estilos: cores das camadas, do solo, do palco e a força do contorno ----
function aplicarEstilo(ctx, nome, refazer = true) {
  const { G, scene, luzes, renderer, tampa } = ctx; E.estilo = nome; const P = PALCO[nome]; const C = CORES[nome];
  caixa.classList.toggle('realista', nome === 'realista');
  scene.background.set(P.fundo);
  luzes.hemi.color.set(P.hemi[0]); luzes.hemi.groundColor.set(P.hemi[1]);
  luzes.sol.color.set(P.sol[0]); luzes.sol.intensity = P.sol[1]; luzes.contra.intensity = P.contra;
  renderer.toneMappingExposure = P.exposicao; ctx.forcaAresta.value = P.forca; tampa.material.color.set(P.tampa);
  if (E.grade) E.grade.visible = P.grade;
  for (const [id, g] of Object.entries(G)) if (C[id] !== undefined) g.mat.color.set(C[id]);
  const S = SOLO[nome]; if (E.matsSolo) { E.matsSolo.topo.color.set(S.topo); E.matsSolo.lado.color.set(S.lado); E.matsSolo.linha.color.set(S.linha); E.matsSolo.linha.opacity = S.opLinha; }
  // amostras de cor dos botões e a legenda acompanham o estilo
  for (const b of document.querySelectorAll('#camadas .chip')) {
    const i = b.querySelector('i'); if (!i) continue;
    const id = Object.keys(NOMES_CAMADA).find((k) => NOMES_CAMADA[k] === b.textContent);
    if (id === 'solo') i.style.background = `#${new ctx.THREE.Color(S.topo).getHexString()}`; else if (id && C[id] !== undefined) i.style.background = `#${C[id].toString(16).padStart(6, '0')}`;
  }
  const lg = document.getElementById('legenda');
  if (lg) lg.innerHTML = Object.entries(NOMES_CAMADA).filter(([id]) => id === 'solo' || C[id] !== undefined).map(([id, n]) => `<li><i style="background:#${(id === 'solo' ? S.topo : C[id]).toString(16).padStart(6, '0')}"></i>${n}</li>`).join('');
  if (refazer) ctx.aplicar();
}

const CAMADAS = [
  { id: 'piscina', nome: 'Piscina', cor: CORES.projeto.piscina, janela: [0.0, 0.22], desloca: 0 },
  { id: 'muros', nome: 'Muros', cor: CORES.projeto.muros, janela: [0.0, 0.3], desloca: 0 },
  { id: 'deck', nome: 'Deck', cor: CORES.projeto.deck, janela: [0.06, 0.32], desloca: 0 },
  { id: 'gradil', nome: 'Gradil', cor: CORES.projeto.gradil, janela: [0.16, 0.36], desloca: 0 },
  { id: 'piso', nome: 'Pisos', cor: CORES.projeto.piso, janela: [0.14, 0.72], desloca: 0.06 },   // a laje (no topo da malha) chega depois das paredes
  { id: 'pilares', nome: 'Pilares', cor: CORES.projeto.pilares, janela: [0.3, 0.52], desloca: 0.18 },
  { id: 'paredes', nome: 'Paredes', cor: CORES.projeto.paredes, janela: [0.34, 0.7], desloca: 0.22 },
  { id: 'portas', nome: 'Portas', cor: CORES.projeto.portas, janela: [0.6, 0.82], desloca: 0.34 },
  { id: 'janelas', nome: 'Janelas', cor: CORES.projeto.janelas, janela: [0.6, 0.82], desloca: 0.34 },
  { id: 'vidros', nome: 'Vidros', cor: CORES.projeto.vidros, janela: [0.64, 0.86], desloca: 0.34 },
  { id: 'cobertura', nome: 'Cobertura', cor: CORES.projeto.cobertura, janela: [0.78, 1], desloca: 0.72 },
];
const NOMES_CAMADA = { ...Object.fromEntries(CAMADAS.filter((k) => k.id !== 'vidros').map((k) => [k.id, k.nome])), solo: 'Solo' };

maquete({
  principal: 'casa',
  textoCarregando: 'Carregando a casa…',
  rotuloDialogo: 'Maquete 3D da casa',
  chao: 'min',                 // lote em desnível: a base fica sob o ponto mais baixo (fundo da piscina); o solo vem da extensão
  giroCena: -90,               // o lote comprido (52 m) deita na largura da tela; o Corte passa ao longo do lote
  corteInicial: 0.27,          // o plano do corte passa pela piscina, pelo deck e pela casa
  arestaVariavel: true,        // o contorno é forte no Projeto e suave no Realista
  respeitaPlanos: true,        // na planta cortada, o clique não pega a cobertura recortada
  oclusao: { raio: 0.5 },
  vistas: {
    '3d': { dir: [-1, 0.68, 1.15], fov: 30 },          // Conjunto: a casa à frente, a piscina e o deck atrás
    frente: { dir: [0, 0.3, 1], fov: 30, margem: 0.76 },   // Fachada: o lado comprido do lote, um pouco acima do muro, livre dos botões de zoom
    planta: { dir: [0, 1, 0.0001], fov: 7, margem: 0.68 },  // o lote quase quadrado na tela encostava no texto do topo
  },
  camadas: CAMADAS,
  extensao,
  modelos: {
    casa: {
      glb: caixa.dataset.glb, meta: caixa.dataset.meta,
      sub: 'Casa de exemplo, modelada no Revit',
      dica: 'Casa de exemplo, modelada no Revit. Passe o mouse ou toque nos elementos.',
      // níveis com o nome que a maquete hidrossanitária já usa para esta casa; cota das faces horizontais do GLB
      niveis: [
        { nome: 'Piscina', y: 1.51 },
        { nome: 'Térreo', y: TERREO },
        { nome: 'Laje superior', y: 6.68 },
        { nome: 'Cobertura', y: 7.35 },
      ],
    },
  },
});

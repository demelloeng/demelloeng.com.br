// Maquete V03 da página de terraplanagem (Infraestrutura): configuração e a extensão própria do motor.
// Modelo: terraplanagem-djalma.glb (V5, 02/11/2026), intacto (SHA-256 conferido nos testes). Ilustrativo, sem volumes,
// terreno natural reconstruído, relevo exagerado 2 vezes. O que a extensão faz, só com a geometria do próprio GLB:
// - o terreno natural vira um bloco fechado (como uma maquete de mesa), e a linha que desce (o recurso aprovado da V5)
//   passa a transformar o terreno de verdade: atrás dela, cada ponto vai da cota natural à final;
// - a cor da terra não muda; onde a cota baixa fica laranja (corte) e onde sobe fica verde (aterro);
// - as curvas de nível do terreno natural ficam onde estavam: sobram no ar onde houve corte e somem no aterro;
// - na vista Seção, o perfil do natural (tracejado), o do terreno atual e, entre os dois, o corte e o aterro.
// Os prismas de corte e aterro do GLB ficam entre as duas superfícies (conferido: topo do corte no natural, fundo
// no final). Nenhum número de volume aparece (decisão de Marcos de 02/11/2026: aterro medido ≠ memorial).
import { maquete } from './motor.mjs?v=6';
import { blocoTerreno, curvasDeNivel, linhaDe, fatorLinha, corTerreno, secao, linear, CORTE, ATERRO } from './terreno.mjs?v=1';

const caixa = document.getElementById('caixa');
const FAIXA = 8;          // metros atrás da linha em que a terra desce ou sobe até a cota final
const BASE = 1;           // a base do bloco fica 1 m (do modelo) abaixo do ponto mais baixo
// janelas da montagem (0 a 1): o terreno natural já está de pé em 0% (quem volta o andamento ao início vê o natural,
// não o tabuleiro vazio); depois os pisos descem e a linha passa
const J = { natural: [-0.1, 0], pisos: [0.14, 0.38], linha: [0.42, 1] };
const FASES = [[0.999, 'Terreno terraplanado'], [J.linha[0], 'Corte e aterro'], [J.pisos[0], 'Os pisos entram'], [0, 'Terreno natural']];
// parede no alto, na base e fundo: terra escura, para a lateral do bloco não competir com a superfície
const COR_PAREDE = [[0.33, 0.27, 0.2], [0.19, 0.15, 0.11], [0.13, 0.1, 0.08]].map((c) => c.map(linear));
const lim = (t) => Math.max(0, Math.min(1, t));
const janela = (p, [a, b]) => lim((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const xyz = (a) => { const o = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i += 1) o.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3); return o; };

const T = {};   // estado do terreno (preenchido ao montar)

const extensao = {
  // antes de o motor montar as camadas: o terreno natural vira o bloco fechado; o final só empresta as cotas
  antesDeMontar({ THREE, raiz, meta }) {
    const nat = raiz.getObjectByName('TERRENO_NATURAL'); const fin = raiz.getObjectByName('TERRENO_FINAL');
    const pn = xyz(nat.geometry.attributes.position); const pf = xyz(fin.geometry.attributes.position);
    const idx = Uint32Array.from(nat.geometry.index.array); const n = pn.length / 3;
    let ymin = Infinity; for (let i = 0; i < n; i += 1) ymin = Math.min(ymin, pn[i * 3 + 1], pf[i * 3 + 1]);
    const b = blocoTerreno(pn, idx, ymin - BASE);
    const cor = new Float32Array(b.pos.length);
    for (let v = 0; v < b.tipo.length; v += 1) cor.set(b.tipo[v] === 0 ? corTerreno(0, 0) : COR_PAREDE[b.tipo[v] - 1], v * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(b.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cor, 3)); geo.setIndex(new THREE.BufferAttribute(b.idx, 1));
    nat.geometry.dispose(); nat.geometry = geo;
    meta.grupos.TERRENO_NATURAL[0][3] = b.faces;   // a ficha e a tampa do corte cobrem o bloco inteiro
    for (const nome of ['TERRENO_FINAL', 'MARCA_CORTE', 'MARCA_ATERRO']) {   // as marcas viram a cor do próprio terreno
      const o = raiz.getObjectByName(nome); if (o) { o.geometry.dispose(); o.removeFromParent(); }
    }
    // as cores por vértice do GLB foram gravadas em sRGB; o three.js as lê como lineares (sairiam desbotadas)
    for (const nome of ['PISOS', 'VOLUME_CORTE', 'VOLUME_ATERRO', 'CONTENCOES']) {
      const c = raiz.getObjectByName(nome)?.geometry.attributes.color; if (!c) continue;
      for (let i = 0; i < c.count; i += 1) { c.setX(i, linear(c.getX(i))); c.setY(i, linear(c.getY(i))); c.setZ(i, linear(c.getZ(i))); }
    }
    const nY = new Float32Array(n); const fY = new Float32Array(n); const zT = new Float32Array(n);
    for (let i = 0; i < n; i += 1) { nY[i] = pn[i * 3 + 1]; fY[i] = pf[i * 3 + 1]; zT[i] = pn[i * 3 + 2]; }
    let zmin = Infinity; let zmax = -Infinity; for (const z of zT) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
    Object.assign(T, { pn, idx, bloco: b, nY, fY, zT, zmin, zmax, atual: Float32Array.from(nY), tAtual: new Float32Array(n), zl: NaN, pronto: false });
  },

  // depois de montadas as camadas: o terreno que se transforma, as curvas, a linha, a seção e o botão das curvas
  aposMontar(ctx) {
    const { THREE, G, raiz, planoCorte, scene } = ctx; const g = G.TERRENO_NATURAL; if (!g) return;
    const geo = g.malha.geometry; const nV = geo.attributes.position.count;
    T.g = g; T.pos = geo.attributes.position; T.cor = geo.attributes.color;
    T.src = new Int32Array(nV); T.topo = new Uint8Array(nV);   // vértice (sem índice) -> vértice do topo; é do topo?
    for (let v = 0; v < nV; v += 1) { const k = T.bloco.idx[v]; T.src[v] = T.bloco.origem[k]; T.topo[v] = T.bloco.tipo[k] === 0 ? 1 : 0; }
    // a caixa do terreno vale para as duas superfícies (a sombra, o raio e o recorte não cortam o que subiu)
    geo.computeBoundingBox(); for (let i = 0; i < T.fY.length; i += 1) geo.boundingBox.expandByPoint(new THREE.Vector3(T.pn[i * 3], T.fY[i], T.pn[i * 3 + 2]));
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    // curvas de nível do terreno natural, de metro em metro (do modelo); não mudam com a terraplanagem
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(curvasDeNivel(T.pn, T.idx, 1, 0.06), 3));
    T.curvas = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0xf3e6cf, transparent: true, opacity: 0.6, depthWrite: false, clippingPlanes: [g.plano, planoCorte] }));
    T.curvas.userData.semAO = true; T.curvas.raycast = () => {}; T.curvas.renderOrder = 2; g.malha.add(T.curvas);
    // prismas de corte e aterro: translúcidos, sem sombra, atrás da linha; as contenções também nascem atrás dela
    for (const id of ['VOLUME_CORTE', 'VOLUME_ATERRO', 'CONTENCOES']) {
      const c = G[id]; if (!c) continue;
      c.plano.normal.set(0, 0, -1);   // o plano de montagem desta camada vira o da linha: fica só o que está atrás dela (z menor)
      if (id !== 'CONTENCOES') { c.mat.polygonOffsetFactor = 3; c.mat.polygonOffsetUnits = 3; c.malha.renderOrder = 3; }
    }
    // a linha que desce: o plano luminoso da V5
    const bb = new THREE.Box3().setFromObject(g.malha); const tam = bb.getSize(new THREE.Vector3());
    T.folha = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.06, tam.y * 1.35), new THREE.MeshBasicMaterial({ color: 0x9cc2ec, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    T.folha.add(new THREE.LineSegments(new THREE.EdgesGeometry(T.folha.geometry), new THREE.LineBasicMaterial({ color: 0xbfe3ff, toneMapped: false })));
    T.folha.position.set((bb.min.x + bb.max.x) / 2, bb.min.y + tam.y * 0.6, 0); T.folha.visible = false; T.folha.renderOrder = 4;
    T.folha.traverse((o) => { o.userData.semAO = true; o.raycast = () => {}; }); scene.add(T.folha);
    // seção: triângulos de corte (laranja) e aterro (verde) entre os dois perfis, e as linhas dos perfis
    const MAX = 6000;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    const ln = new THREE.BufferGeometry(); ln.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3)); ln.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    const la = new THREE.BufferGeometry(); la.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    T.secao = new THREE.Group();
    T.secao.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false, toneMapped: false })),
      new THREE.LineSegments(ln, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.2, gapSize: 0.8, toneMapped: false })),
      new THREE.LineSegments(la, new THREE.LineBasicMaterial({ color: 0x2b2118, toneMapped: false })));
    T.secao.traverse((o) => { o.userData.semAO = true; o.raycast = () => {}; o.frustumCulled = false; o.renderOrder = 5; });
    T.secao.visible = false; raiz.add(T.secao); T.zSecao = NaN;
    // botão das curvas, junto das camadas
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true'); b.textContent = 'Curvas do natural';
    b.addEventListener('click', () => { T.curvas.visible = !T.curvas.visible; b.setAttribute('aria-pressed', String(T.curvas.visible)); ctx.pedir(); });
    document.getElementById('camadas').appendChild(b);
    T.fase = document.getElementById('fase'); T.faseAnt = ''; T.pronto = true;
  },

  // a cada passo da montagem (depois do motor): terreno, prismas, pisos, linha, seção e o nome da etapa
  aplicar(ctx) {
    if (!T.pronto) return;
    const { G, raiz, p } = ctx; const g = T.g;
    const sL = janela(p, J.linha); const zl = linhaDe(sL, T.zmin, T.zmax, FAIXA);
    if (zl !== T.zl) {   // o terreno só é reescrito quando a linha anda
      T.zl = zl; const pa = T.pos.array; const ca = T.cor.array;
      for (let i = 0; i < T.nY.length; i += 1) { const t = fatorLinha(T.zT[i], zl, FAIXA); T.tAtual[i] = t; T.atual[i] = T.nY[i] + (T.fY[i] - T.nY[i]) * t; }
      for (let v = 0; v < T.src.length; v += 1) {
        const i = T.src[v]; if (i < 0) continue;
        pa[v * 3 + 1] = T.atual[i];
        if (T.topo[v]) corTerreno(T.fY[i] - T.nY[i], T.tAtual[i], ca, v * 3);
      }
      T.pos.needsUpdate = true; T.cor.needsUpdate = true; T.zSecao = NaN;
    }
    const zMundo = zl + raiz.position.z;
    for (const id of ['VOLUME_CORTE', 'VOLUME_ATERRO', 'CONTENCOES']) {
      const c = G[id]; if (!c) continue;
      c.plano.constant = sL >= 1 ? 1e5 : zMundo;
      if (id !== 'CONTENCOES') { c.mat.transparent = true; c.mat.opacity = ctx.raioX ? 0.7 : 0.9; c.mat.depthWrite = false; c.malha.castShadow = false; }
    }
    const pisos = G.PISOS;
    if (pisos) {   // os pisos descem do alto até a cota, com o terreno natural já de pé
      const s = ease(janela(p, J.pisos)); pisos.plano.constant = 1e5;
      pisos.malha.position.y += (1 - s) * ((pisos.ymax - pisos.ymin) + 12);
    }
    T.folha.visible = sL > 0 && sL < 1 && g.ligada && !ctx.cortando; T.folha.position.z = zMundo;
    // seção: refeita só quando o plano ou o terreno mudam
    T.secao.visible = ctx.cortando && g.ligada;
    if (T.secao.visible) {
      const zc = ctx.planoCorte.constant - raiz.position.z;
      if (zc !== T.zSecao) { T.zSecao = zc; montarSecao(zc); }
    }
    const fase = FASES.find(([a]) => p >= a)[1];
    if (T.fase && fase !== T.faseAnt) { T.faseAnt = fase; T.fase.textContent = fase; }   // só quando a etapa muda
  },

  medir: () => ({ linha: +T.zl.toFixed(2), fase: T.faseAnt, curvas: T.curvas ? T.curvas.geometry.attributes.position.count / 2 : 0, secao: T.secao ? T.secao.children[0].geometry.drawRange.count / 3 : 0 }),
};

function montarSecao(zc) {
  const s = secao(T.pn, T.idx, T.nY, T.atual, zc);
  const z = zc + 0.05;   // um pouco à frente da tampa, do lado de quem olha
  const [m, ln, la] = T.secao.children;
  const pm = m.geometry.attributes.position; const cm = m.geometry.attributes.color; const nt = Math.min(s.sinal.length, pm.count / 3);
  for (let t = 0; t < nt; t += 1) {
    const c = s.sinal[t] < 0 ? CORTE : ATERRO;
    for (let k = 0; k < 3; k += 1) { const q = t * 3 + k; pm.setXYZ(q, s.tris[q * 2], s.tris[q * 2 + 1], z); cm.setXYZ(q, ...c); }
  }
  m.geometry.setDrawRange(0, nt * 3); pm.needsUpdate = true; cm.needsUpdate = true;
  for (const [obj, arr, tracejada] of [[ln, s.linhaN, true], [la, s.linhaA, false]]) {
    const pa = obj.geometry.attributes.position; const da = obj.geometry.attributes.lineDistance; const np = Math.min(arr.length / 2, pa.count);
    for (let q = 0; q < np; q += 1) {
      pa.setXYZ(q, arr[q * 2], arr[q * 2 + 1], z + 0.01);
      if (tracejada) da.setX(q, q % 2 === 0 ? arr[q * 2] : arr[(q - 1) * 2] + Math.hypot(arr[q * 2] - arr[(q - 1) * 2], arr[q * 2 + 1] - arr[(q - 1) * 2 + 1]));
    }
    obj.geometry.setDrawRange(0, np); pa.needsUpdate = true; if (tracejada) da.needsUpdate = true;
  }
}

maquete({
  principal: 'terreno',
  textoCarregando: 'Carregando a terraplanagem…',
  rotuloDialogo: 'Maquete 3D da terraplanagem',
  chao: 'min',                // o bloco de terreno fica sobre a laje de apoio, como numa maquete de mesa
  exagero: 2,                 // relevo exagerado 2 vezes; a página avisa
  corPorVertice: true,
  brilhoVertice: 0.06,        // a terra não brilha como os tubos: só o bastante para a cor não sumir na sombra
  contorno: false,
  corteInicial: 0.5,
  oclusao: { raio: 3 },
  montagemMs: 4200,           // caixa fechada: tudo abaixo de 5 s
  montagemAbertaMs: 11000,    // aberta, a primeira vez conta a sequência inteira, devagar
  tampa: { cor: 0x3d2f22, linha: [0.37, 0.31, 0.24].map(linear) },   // a seção do solo em terra, discreta (não o azul do concreto)
  vistas: {
    '3d': { dir: [1, 1.05, 1.15], fov: 30 },                // a câmera mais alta mostra a superfície, não a lateral do bloco
    planta: { dir: [0, 1, 0.0001], fov: 7, margem: 0.84 },  // o terreno quase quadrado encostava no texto do topo
  },
  textoPorDentro: ['Ver a seção', 'Voltar ao conjunto'],
  camadas: [
    { id: 'TERRENO_NATURAL', nome: 'Terreno', um: '', cor: 0x96805f, janela: J.natural, desloca: 0, semRealce: true },
    { id: 'PISOS', nome: 'Pisos', um: '', cor: 0xd6dce2, janela: J.pisos, desloca: 0.35 },
    { id: 'VOLUME_CORTE', nome: 'Corte', um: '', cor: 0xe87e22, janela: J.linha, desloca: 0.6, semTampa: true },
    { id: 'VOLUME_ATERRO', nome: 'Aterro', um: '', cor: 0x2ea05a, janela: J.linha, desloca: 0.3, semTampa: true },
    { id: 'CONTENCOES', nome: 'Contenções', um: '', cor: 0x6e7076, janela: J.linha, desloca: 0.15 },
  ],
  extensao,
  modelos: {
    terreno: {
      glb: caixa.dataset.glb, meta: caixa.dataset.meta,
      sub: 'Terraplanagem de um colégio, em 3D · ilustrativo · relevo exagerado 2 vezes',   // texto da V5, aprovado
      dica: 'Do terreno natural ao terraplanado: os pisos entram e uma linha desce mostrando corte e aterro. Relevo exagerado 2 vezes.',
    },
  },
});

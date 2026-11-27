// Maquete V03 da página de projeto hidrossanitário: só a configuração. O desenho está em motor.mjs.
// Tubos: hidro-casa.glb com as cores do IFC (por vértice, decisão 103). Casa: casa-exemplo.glb, do MESMO projeto,
// como casca transparente (decisão 160). Nenhum GLB é alterado: o encaixe são três números (hidro/encaixe.py do
// protótipo; a inversa confere a 4 mm). A espessura dos tubos é ampliada só no visual, e a página avisa.
import { maquete } from './motor.mjs?v=4';

const caixa = document.getElementById('caixa');
maquete({
  principal: 'casa',
  textoCarregando: 'Carregando as redes…',
  rotuloDialogo: 'Maquete 3D das redes hidrossanitárias',
  chao: 'min',                // terreno em desnível: a base fica sob o ponto mais baixo (piscina); nada de terreno inventado
  corPorVertice: true,
  contorno: false,            // sem arestas nos tubos: as linhas apagariam a cor de cada rede
  giroCena: -142.11,          // desfaz o giro do IFC (-232,11) e deita o lote comprido na largura da tela (+90)
  corteInicial: 0.55,
  oclusao: { raio: 0.6 },
  semLegenda: ['Tubo'],       // a cor do tubo é a de cada rede, do IFC; a entrada genérica da legenda enganaria
  camadas: [
    { id: 'esgoto', nome: 'Esgoto', um: 'Esgoto', cor: 0xd6a56f, janela: [0.00, 0.50], desloca: -0.45 },
    { id: 'agua-fria', nome: 'Água fria', um: 'Água fria', cor: 0x5ab4ff, janela: [0.40, 0.85], desloca: 0.35 },
    { id: 'pluvial', nome: 'Águas pluviais', um: 'Águas pluviais', cor: 0x6fd3b0, janela: [0.70, 1.00], desloca: 1.15 },
  ],
  casca: {
    nome: 'Casa', glb: caixa.dataset.glbCasca, giroY: 232.11, posicao: [12.821, -3.552, 17.124],
    opacidade: 0.1,
    opacidades: { cobertura: 0.025, paredes: 0.1, piso: 0.045, piscina: 0.3, muros: 0.04, deck: 0.05, pilares: 0.08, portas: 0.06, janelas: 0.06, gradil: 0.04 },
    cores: { piscina: [0.18, 0.62, 0.85] },   // a própria malha da piscina, em tom de água (representação; nada novo é modelado)
  },
  modelos: {
    casa: {
      glb: caixa.dataset.glb, meta: caixa.dataset.meta,
      sub: 'Instalações de uma casa, em 3D · espessura ampliada',
      dica: 'Instalações de uma casa com piscina, com a espessura dos tubos ampliada para leitura. Passe o mouse ou toque nos elementos.',
      // níveis pelos pisos da casca (faces horizontais), só com o nome
      niveis: [
        { nome: 'Piscina', malha: 'deck', grupo: 0 },
        { nome: 'Térreo', malha: 'piso', grupo: 0 },
        { nome: 'Laje superior', malha: 'piso', grupo: 1 },
        { nome: 'Cobertura', malha: 'cobertura', base: true },
      ],
    },
  },
});

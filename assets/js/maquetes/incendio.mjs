// Maquete V03 da página de incêndio: só a configuração. O desenho está em motor.mjs.
// Sistema de hidrantes do Colégio Luiz Carlos: hidrantes-luiz-carlos-v02.glb e .json, os mesmos da V02, intactos
// (171 componentes; cores por vértice do IFC; decisão 103). A casca é o térreo do colégio lido da planta 1:75 do
// projeto hidrossanitário (scripts/gerar-casca-luiz-carlos.py), já no sistema do GLB de hidrantes: nenhum encaixe a
// ajustar aqui. Paredes até o nível da calha (5,53 m, do IFC); muro e calçada só no chão.
import { maquete } from './motor.mjs?v=4';

const caixa = document.getElementById('caixa');
// cotas do IfcBuildingStorey do mesmo IFC, no sistema do GLB (o 0 do GLB é o tubo mais fundo: Térreo = 2,25)
const TERREO = 2.25;
maquete({
  principal: 'hidrantes',
  textoCarregando: 'Carregando o sistema de hidrantes…',
  rotuloDialogo: 'Maquete 3D do sistema de hidrantes do Colégio Luiz Carlos',
  chao: 'zero',
  nivelChao: TERREO,          // o chão da maquete é o piso térreo; a rede enterrada fica sob o solo translúcido
  corPorVertice: true,        // cores gravadas no GLB: tubulação, conexões, válvulas, abrigos, motores, reservatórios
  contorno: false,
  giroCena: 90,               // o colégio é comprido: o lado maior fica na largura da tela
  corteInicial: 0.5,
  pertoMin: 0.05,             // aproximar de um manômetro de 15 cm sem o plano de recorte comer a peça
  oclusao: { raio: 0.6 },
  camadas: [
    { id: 'casa-bombas', nome: 'Reservação e bombas', um: '', cor: 0x657f98, janela: [0.00, 0.30], desloca: 0.9 },
    { id: 'tubulacao', nome: 'Distribuição', um: '', cor: 0xce4146, janela: [0.20, 0.80], desloca: 0 },
    { id: 'hidrantes', nome: 'Hidrantes e instrumentos', um: '', cor: 0xb83138, janela: [0.70, 1.00], desloca: -0.6 },
  ],
  // o tubo está na bitola real; na vista geral ganha espessura mínima de tela, e ao aproximar fica só o tubo real
  guias: { camada: 'tubulacao', cor: 0xce4146, pxMin: 3.2, raioReal: 0.04 },
  // lista com os 171 componentes da V02, por camada; marcadores nos hidrantes (o de recalque leva "R")
  componentes: () => true,
  ordemComponentes: ['hidrantes', 'casa-bombas', 'tubulacao'],
  marcadores: (el) => (el[0].startsWith('Hidrante') ? (el[0].includes('recalque') ? 'R' : true) : false),
  fichaCompleta: true,
  casca: {
    nome: 'Colégio', glb: caixa.dataset.glbCasca, enquadrar: true,
    fatorAresta: 1.6,         // o colégio tem muitas divisórias: aresta discreta para a rede continuar na frente
    opacidades: { paredes: 0.07, cobertura: 0.025, contorno: 0.2 },
  },
  modelos: {
    hidrantes: {
      glb: caixa.dataset.glb, meta: caixa.dataset.meta,
      sub: '171 componentes · materiais e equipamentos refinados',   // textos da V02, aprovados
      dica: 'Colégio Luiz Carlos · Selecione uma peça para ver sua identificação.',
      niveis: [
        { nome: 'Térreo', y: TERREO + 0.0 },
        { nome: 'Pavimento 1', y: TERREO + 5.53 },
        { nome: 'Cobertura', y: TERREO + 8.83 },
      ],
    },
  },
});

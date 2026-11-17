// Maquete V03 da página de projeto estrutural: só a configuração. O desenho está em motor.mjs.
// Modelos: os mesmos GLB/JSON publicados (caminhos com ?v no atributo da caixa, gerados pelo gerador da página).
import { maquete } from './motor.mjs?v=3';

const caixa = document.getElementById('caixa');
// ordem de montagem; janela = trecho (0 a 1) em que a camada cresce; desloca = quanto sobe ao separar (fração da altura).
// Cores: concreto em degraus de tom, das fundações (escuras) às lajes (claras), na paleta da calculadora R4.
const CAMADAS = [
  { id: 'estacas', nome: 'Estacas', um: 'Estaca', cor: 0x7d858d, janela: [0.00, 0.18], desloca: -0.55 },
  { id: 'fundacoes', nome: 'Fundações', um: 'Fundação', cor: 0x8d969f, janela: [0.16, 0.34], desloca: -0.15 },
  { id: 'pilares', nome: 'Pilares', um: 'Pilar', cor: 0xcfc6b8, janela: [0.32, 0.62], desloca: 0.30 },
  { id: 'vigas', nome: 'Vigas', um: 'Viga', cor: 0xaeb8c2, janela: [0.58, 0.84], desloca: 0.75 },
  { id: 'lajes', nome: 'Lajes', um: 'Laje', cor: 0xe6e3dd, janela: [0.80, 1.00], desloca: 1.15 },
  { id: 'roupeiros', nome: 'Roupeiros', um: 'Roupeiro', cor: 0xb07a4a, janela: [0.90, 1.00], desloca: 1.7 },   // só no mezanino: a carga de uso
];

maquete({
  principal: 'concreto',
  textoCarregando: 'Carregando a estrutura…',
  rotuloDialogo: 'Maquete 3D da estrutura',
  chao: 'zero',               // o nível 0 do modelo é o do terreno: estacas e sapatas ficam dentro do solo translúcido
  camadas: CAMADAS,
  corteInicial: 'auto',     // o plano passa pelo bloco (onde cruza mais lajes)
  oclusao: { raio: 0.8 },
  forcaAresta: 0.6,
  modelos: {
    concreto: {
      glb: caixa.dataset.glb, meta: caixa.dataset.meta, niveis: 'lajes',
      sub: 'Anteprojeto estrutural real, em 3D', dica: 'Anteprojeto estrutural real. Passe o mouse ou toque nos elementos.',
      // abre nos blocos (pavimentos acima do térreo, sem o muro); "Ver o terreno todo" mostra o lote inteiro
      foco: (meta) => meta.pavimentos.flatMap((n, i) => (/T[ÉE]RREO|MURO/i.test(n) ? [] : [i])),
    },
    aco: {
      glb: caixa.dataset.glbAco, meta: caixa.dataset.metaAco, niveis: 'lajes', metal: true, cores: { pilares: 0x7fa3c8, vigas: 0x93b4d6 },
      sub: 'Mezanino metálico, modelo preliminar em BIM', dica: 'Mezanino metálico, modelo preliminar. Passe o mouse ou toque nos elementos.',
    },
  },
});

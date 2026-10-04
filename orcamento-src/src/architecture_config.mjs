// Parâmetros da ESTIMATIVA COMERCIAL DE ÁREA da Arquitetura — centralizados, versionados e cobertos por testes.
//
// ATENÇÃO: são heurísticas COMERCIAIS de orientação (ponto de partida para o orçamento), NÃO regra urbanística,
// NÃO potencial construtivo, NÃO consulta a legislação. Os números abaixo precisam de validação humana (Marcos)
// antes de qualquer uso comercial amplo. Mudar qualquer valor = mudar `version`.
//
// Nada fora deste arquivo carrega número mágico da estimativa.
export const ARCH_ESTIMATOR_VERSION = 'ARQ_EST_V1';

export const ARCH_CONFIG = Object.freeze({
  version: ARCH_ESTIMATOR_VERSION,
  // m² de área construída por item do programa de necessidades (valores de referência comercial)
  program: Object.freeze({
    areaPerItem: Object.freeze({
      quarto: 10,       // quarto (sem suíte)
      suite: 14,        // suíte (já inclui o banheiro dela)
      banheiro: 3.5,    // banheiro fora das suítes
      sala: 16,
      cozinha: 9,
      lavanderia: 4,
      garagemVaga: 12,  // por vaga
      escritorio: 8,
      varanda: 10,      // varanda ou área gourmet
    }),
    circulacao: 0.12,                 // acréscimo de circulação/paredes sobre a soma dos ambientes
    circulacaoPorPavimentoExtra: 0.03, // escada e circulação vertical, por pavimento acima do primeiro
    padraoFator: Object.freeze({ compacto: 0.9, confortavel: 1.0, amplo: 1.15 }),
    faixa: Object.freeze({ inferior: 0.92, superior: 1.08 }), // faixa em torno do valor central
    limites: Object.freeze({ quartos: 10, suites: 10, banheiros: 10, garagem: 6, pavimentos: 4 }),
  }),
  // terreno -> faixa conservadora de provável área construída (NÃO é potencial construtivo legal)
  lot: Object.freeze({
    fatorMin: 0.66,
    fatorMax: 0.69,
    tetoAreaConstruida: 600, // teto da faixa estimada só pelo terreno (conservador)
    terrenoMin: 40,
    terrenoMax: 5000,
  }),
  // proteção contra resultados absurdos (fora disso: conferência humana)
  areaPlausivel: Object.freeze({ min: 20, max: 1500 }),
  arredondamentoM2: 5, // faixas e referência arredondadas ao múltiplo de 5 m²
  // faixas de apresentação para a mensuração (sem valores exatos)
  bands: Object.freeze({
    area: Object.freeze([[60, 'lt_60'], [100, '60_100'], [150, '100_150'], [250, '150_250'], [400, '250_400']]),
    lot: Object.freeze([[200, 'lt_200'], [360, '200_360'], [600, '360_600'], [1000, '600_1000']]),
    program: Object.freeze([[80, 'lt_80'], [140, '80_140'], [220, '140_220']]),
  }),
});

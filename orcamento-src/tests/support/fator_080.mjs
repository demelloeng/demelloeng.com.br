// R4: fixa a configuração do fator em 0,80 para os testes de CONTRATO DA METODOLOGIA (decisão 146), cujos valores
// foram derivados a 0,80. O fator saiu da tabela e veio da configuração comercial (semente 0,60); a metodologia não
// depende do valor do fator. Importar por efeito colateral, no topo do arquivo de teste:
//   import './support/fator_080.mjs';
// Cada arquivo roda em processo próprio no node --test: o pin não vaza. Valores a 0,60 em tests/r4_fator.test.mjs.
import { setFactorConfig } from '../../src/pricing/active_config.mjs';

export const CFG_080 = { revision: 1, factor_demello: '0.80' };
setFactorConfig(CFG_080);

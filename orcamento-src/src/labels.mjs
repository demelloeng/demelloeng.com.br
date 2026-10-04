// Textos que dependem de um fato do código. Derivados da fonte da verdade para não divergirem de novo.
import TABLE from './pricing/pricing-table.v2.json' with { type: 'json' };
import {routes} from './journey.mjs';

// "DEMELLO_V2" -> "TABELA DEMELLO V2". A versão vigente vem da própria tabela de preços.
export const TABLE_LABEL=`TABELA ${String(TABLE.table_version).replace('_',' ')}`;

// Número de entradas (rotas) da jornada, por extenso — "cinco entradas" nunca fica desatualizado.
const WORDS=['nenhuma','uma','duas','três','quatro','cinco','seis','sete','oito'];
export const ENTRY_COUNT=Object.keys(routes).length;
export const ENTRY_COUNT_WORD=WORDS[ENTRY_COUNT];

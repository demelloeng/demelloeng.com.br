// Devolutiva da Arquitetura: tudo o que o visitante recebe quando não sabe a área do projeto.
// Nunca só um número: ponto de partida, referência usada no orçamento, origem, preço inicial só da Arquitetura,
// explicação curta, ressalva técnica e próximo passo.
//
// LIMITES DE LINGUAGEM (testados): nada aqui afirma metragem permitida, potencial construtivo legal, autorização da
// prefeitura, consulta a código de obras ou metragem aprovada. Só "estimativa inicial", "faixa aproximada", "referência
// para orçamento", "normalmente", "a confirmar na análise técnica".
import { architectureEstimate } from './architecture.mjs';
import { SOURCE } from './architecture_estimator.mjs';
import { derivePricingInputs } from './payload_v2.mjs';
import { buildPricingPreview } from './pricing/engine.mjs';
import { brlStr } from './pricing/decimal.mjs';

export const m2 = (n) => `${Number(n).toLocaleString('pt-BR')} m²`;
const faixa = (min, max) => (min === max ? m2(min) : `${m2(min)} a ${m2(max)}`);

// Preço inicial SÓ da Arquitetura (mesmo motor e mesma tabela; nenhum outro serviço entra na conta).
export function architecturePrice(a, reference) {
  if (reference === null || reference === undefined) return null;
  const alone = { ...a, services: ['Arquitetura'], S3: { value: String(reference) } };
  const pv = buildPricingPreview(derivePricingInputs(alone));
  const s = pv.services.find((x) => x.service === 'ARQUITETURA');
  return s && s.status === 'CALCULATED' ? brlStr(s.demello.total) : null;
}

const WHY_LOT = {
  title: 'Por que a construção não ocupa todo o terreno?',
  text: 'Porque normalmente precisamos considerar algumas coisinhas complicadas, como recuos, permeabilidade, taxa de ocupação, circulação e regras de zoneamento.',
};
const WHY_PROGRAM = {
  title: 'O que pesa nesse número?',
  text: 'Quartos, suítes, banheiros, garagem, número de pavimentos e padrão pesam mais. Circulação e paredes também entram na conta.',
};
const DISCLAIMER = 'Esta é uma referência inicial para o orçamento — não é a área permitida nem o potencial construtivo do seu terreno. Na etapa técnica, a DEMELLO analisa o terreno e a legislação aplicável para confirmar a melhor solução.';
const NEXT = 'Próximo passo: peça uma proposta ou tire uma dúvida sobre o escopo. Mudou o que você imagina? Volte e refaça a estimativa.';
const NEXT_REVIEW = 'Próximo passo: envie o caso para avaliação. A equipe confere o que você já sabe e orienta.';

export function architectureReturn(a) {
  const est = architectureEstimate(a);
  if (!est || est.source === SOURCE.USER_DECLARED) return null; // área informada: a devolutiva padrão do resultado basta
  const t = est.lot?.terreno ?? null;
  if (est.source === SOURCE.HUMAN_REVIEW_REQUIRED) {
    return {
      source: est.source, rows: [], title: 'Seu ponto de partida',
      paragraphs: ['Sem a área do projeto, sem o terreno e sem o programa de necessidades, ainda não dá para estimar a Arquitetura. Nada é inventado: a equipe confere o seu caso.'],
      why: null, disclaimer: DISCLAIMER, next: NEXT_REVIEW, price: null,
    };
  }
  const price = architecturePrice(a, est.reference);
  const rows = [];
  if (t !== null) rows.push(['Terreno informado', m2(t)]);
  rows.push(['Área construída estimada', faixa(est.min, est.max)]);
  rows.push(['Referência usada no orçamento', m2(est.reference)]);
  if (price) rows.push(['Estimativa inicial de Arquitetura', price]);

  let paragraphs, why;
  if (est.source === SOURCE.NEEDS_PROGRAM_ESTIMATE) {
    paragraphs = [`Pelo programa informado, sua casa provavelmente ficará entre ${m2(est.min)} e ${m2(est.max)}. Para calcular esta estimativa inicial, consideraremos ${m2(est.reference)}.`];
    why = WHY_PROGRAM;
  } else if (est.source === SOURCE.LOT_ONLY_ESTIMATE) {
    paragraphs = [`Seu terreno tem ${m2(t)}, mas isso não significa que toda essa área será ocupada pela construção. Algumas coisinhas complicadas — como recuos, permeabilidade, taxa de ocupação e zoneamento — normalmente reduzem a área aproveitável. Para esta estimativa inicial, vamos considerar uma faixa aproximada entre ${m2(est.min)} e ${m2(est.max)}.`];
    why = WHY_LOT;
  } else if (est.intense) {
    paragraphs = [`O programa que você imaginou pode exigir um aproveitamento mais intenso do terreno. Para esta estimativa inicial, utilizaremos aproximadamente ${m2(est.reference)}. A viabilidade será conferida na análise técnica.`];
    why = WHY_LOT;
  } else if (est.coherence === 'COERENTE') {
    paragraphs = [`O programa que você imaginou e o seu terreno de ${m2(t)} apontam para uma área parecida. Para esta estimativa inicial, utilizaremos aproximadamente ${m2(est.reference)}.`];
    why = WHY_LOT;
  } else {
    paragraphs = [`O programa que você imaginou é menor do que um terreno de ${m2(t)} normalmente comporta. Para esta estimativa inicial, consideraremos ${m2(est.reference)}, com base no programa.`];
    why = WHY_PROGRAM;
  }
  return { source: est.source, rows, title: 'Seu ponto de partida', paragraphs, why, disclaimer: DISCLAIMER, next: NEXT, price, isolated: !!(a.services || []).length && !(a.services || []).every((s) => s === 'Arquitetura') };
}

// Todo o texto exibido por esta devolutiva (para os testes de linguagem).
export function allReturnTexts(ret) {
  if (!ret) return [];
  return [ret.title, ...ret.paragraphs, ret.why?.title, ret.why?.text, ret.disclaimer, ret.next, ...ret.rows.flat()].filter(Boolean);
}

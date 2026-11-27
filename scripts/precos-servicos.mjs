// Pisos comerciais FAQ: consulta o motor publicado, independente do Portal.
import TABLE from '../orcamento-src/src/pricing/pricing-table.v2.json' with { type: 'json' };
import { buildPricingPreview, FATOR_PISO } from '../orcamento-src/src/pricing/engine.mjs';
import { dec } from '../orcamento-src/src/pricing/decimal.mjs';

const limits = TABLE.automatic_estimate_limits;
const common = { typology: 'CASA' };
const config = { revision: 1, factor_demello: FATOR_PISO };
const disciplines = {
  'projeto-arquitetura': ['ARQUITETURA', 'área nova', { area_new: limits.Q_NOVA }],
  'projeto-hidrossanitario': ['HIDROSSANITARIO', 'área nova', { area_new: limits.Q_NOVA }],
  'projeto-prevencao-incendio': ['INCENDIO', 'área total', { area_total: limits.Q_TOTAL }],
  'projeto-gas-glp': ['GAS_GLP', 'área atendida', { area_atendida: limits.Q_ATENDIDA }],
  'projeto-terraplanagem': ['TERRAPLENAGEM', 'área do terreno', { area_terreno: limits.Q_TERRENO }],
  'compatibilizacao-bim': ['COMPATIBILIZACAO', 'área do escopo', { area_escopo: limits.Q_ESCOPO }],
  regularizacao: ['REGULARIZACAO', 'área regularizada', {
    regularizacao: {
      area_matricula: '0',
      area_iptu: limits.Q_REGULARIZACAO,
      levantamento: 'NOT_REQUIRED',
      projeto_legal: 'NOT_REQUIRED',
    },
  }],
  'orcamento-tecnico': ['ORCAMENTO', 'área do escopo', { area_escopo: limits.Q_ESCOPO }],
};

function quote(service, base, fields) {
  const input = { ...common, services: [service], ...fields };
  const preview = buildPricingPreview(input, config);
  const item = preview.services[0];
  if (item?.status !== 'CALCULATED' || !(item.q > 0) || preview.factor_demello !== Number(FATOR_PISO)) {
    throw new Error('O motor não produziu estimativa automática com o piso para ' + service);
  }
  // A função divide o total monetário que a calculadora de fato exibe pela
  // área retornada pelo motor. Inteiros evitam arredondar centavos para cima.
  const total = dec(item.demello.total);
  const area = dec(String(item.q));
  const cents = (total.n * 10n ** BigInt(2 + area.e)) / (area.n * 10n ** BigInt(total.e));
  const amount = String(cents / 100n) + '.' + String(cents % 100n).padStart(2, '0');
  return {
    valor: amount,
    base_m2: base,
    entrada: input,
    tabela: preview.table_version,
    regra: preview.pricing_rule,
    fator: FATOR_PISO,
    quantidade_m2: item.q,
    total_demello: item.demello.total,
    referencia_motor: item.base_reference,
  };
}

function structural() {
  const area = Math.min(Number(limits.Q_SUPERESTRUTURA), Number(limits.Q_FUNDACAO));
  const input = {
    area_new: String(area),
    structural_system: 'CONCRETO_ARMADO',
    structural_scope: 'FULL',
    foundations_selected: true,
  };
  const byFoundation = (footprint) => quote('ESTRUTURAL', 'área construída',
    { ...input, area_fundacao: String(footprint) });
  return {
    terrea: byFoundation(area),
    sobrado: byFoundation(area / 2),
  };
}

const services = Object.fromEntries(Object.entries(disciplines)
  .map(([slug, [service, base, fields]]) => [slug, quote(service, base, fields)]));
const cases = structural();
// Anúncio = sobrado (fundação em metade da área), menor caso real com o fator 0,60. Decisão de Marcos, 26/11.
services['projeto-estrutural'] = { ...cases.sobrado, cenarios: cases };
console.log(JSON.stringify(services, null, 2));

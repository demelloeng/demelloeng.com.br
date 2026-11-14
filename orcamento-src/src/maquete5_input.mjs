// Maquete V05 — entrada do gerador a partir das respostas REAIS da calculadora.
// Lê os mesmos pricing_inputs do motor (área, tipologia, serviços) e duas respostas que o motor não usa no preço:
// pavimentos (CA5) e padrão (CA6). Não calcula nada e não inventa valor: o que a pessoa não informou vai como null.
import { derivePricingInputs } from './payload_v2.mjs';

const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const raw = (v) => (v && typeof v === 'object' ? v.value : v);

export function maquete5Input(answers) {
  let pi;
  try {
    pi = derivePricingInputs(answers || {});
  } catch {
    return null;
  }
  const floorsRaw = raw(answers?.CA5);
  const floors = typeof floorsRaw === 'string' && /^[1-9][0-9]{0,2}$/.test(floorsRaw.trim()) ? Number(floorsRaw)
    : Number.isInteger(floorsRaw) && floorsRaw > 0 ? floorsRaw : null;
  const standard = raw(answers?.CA6) ?? answers?.arq_programa?.padrao ?? null;
  return {
    areaProj: num(pi.area_fundacao),
    areaTotal: num(pi.area_total) ?? num(pi.area_new) ?? num(pi.area_escopo) ?? num(pi.area_atendida),
    areaTerreno: num(pi.area_terreno),
    floors,
    typology: pi.typology ?? null,
    standard: typeof standard === 'string' ? standard : null,
    services: Array.isArray(pi.services) ? pi.services : [],
  };
}

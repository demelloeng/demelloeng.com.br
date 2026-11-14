// Maquete V05 — entrada do gerador a partir das respostas REAIS da calculadora.
// Lê os mesmos pricing_inputs do motor (área, tipologia, serviços) e duas respostas que o motor não usa no preço:
// pavimentos e padrão. Não calcula nada e não inventa valor: o que a pessoa não informou vai como null.
//
// R03 — origem pela jornada ATIVA (routeNodes, o mesmo contrato da navegação): CA5/CA6 só existem na rota
// "Construir ou ampliar"; o programa de Arquitetura (ARQ_PROG) só na rota "Já sei", quando a área do projeto é
// desconhecida. Resposta de etapa inativa, marcada como desconhecida ou inválida não é declaração atual.
// A área de REFERÊNCIA que o motor estima para a Arquitetura (pricing_inputs.area_new na rota "Já sei") serve só ao
// preço: nunca vira área física da maquete.
import { derivePricingInputs } from './payload_v2.mjs';
import { routeNodes } from './journey.mjs';
import { programValid } from './architecture_estimator.mjs';

const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const raw = (v) => (v && typeof v === 'object' ? v.value : v);
const STANDARDS = ['Econômico', 'Médio', 'Alto'];                  // CA6 ("Ainda não sei" não é padrão)

function floorsOf(answer) {
  if (!answer || (typeof answer === 'object' && answer.unknown === true)) return null;
  const v = raw(answer);
  if (typeof v === 'string' && /^[1-9][0-9]{0,2}$/.test(v.trim())) return Number(v);
  return Number.isInteger(v) && v > 0 ? v : null;
}

export function maquete5Input(answers) {
  const a = answers || {};
  let pi;
  let active;
  try {
    pi = derivePricingInputs(a);
    active = new Set(routeNodes(a) || []);
  } catch {
    return null;
  }
  const prog = active.has('ARQ_PROG') && programValid(a.arq_programa) ? a.arq_programa : null;
  const floors = (active.has('CA5') ? floorsOf(a.CA5) : null) ?? (prog ? Number(prog.pavimentos) : null);
  const ca6 = active.has('CA6') ? raw(a.CA6) : null;
  const standard = STANDARDS.includes(ca6) ? ca6 : prog ? prog.padrao : null;
  // área nova DECLARADA só existe na rota "Construir"; na rota "Já sei" area_new é a referência do motor (Arquitetura)
  const declaredNew = a.route === 'build' ? num(pi.area_new) : null;
  return {
    areaProj: num(pi.area_fundacao),
    areaTotal: num(pi.area_total) ?? declaredNew ?? num(pi.area_escopo) ?? num(pi.area_atendida),
    areaTerreno: num(pi.area_terreno),
    floors,
    typology: pi.typology ?? null,
    standard,
    services: Array.isArray(pi.services) ? pi.services : [],
  };
}

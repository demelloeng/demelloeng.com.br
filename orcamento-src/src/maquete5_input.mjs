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
import { MAX_DECLARED_FLOORS } from './maquete5_building.mjs';

const num = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const raw = (v) => (v && typeof v === 'object' ? v.value : v);
const STANDARDS = ['Econômico', 'Médio', 'Alto'];                  // CA6 ("Ainda não sei" não é padrão)

function floorsOf(answer) {
  if (!answer || (typeof answer === 'object' && answer.unknown === true)) return null;
  const v = raw(answer);
  const n = typeof v === 'string' && /^[1-9][0-9]{0,2}$/.test(v.trim()) ? Number(v) : Number.isInteger(v) ? v : null;
  return n !== null && n >= 1 && n <= MAX_DECLARED_FLOORS ? n : null;   // mesmo contrato da pergunta CA5 (1 a 200)
}

// R03 complementar — modelo ÚNICO de proveniência para as três representações (V05 expandida, fallback antigo e chip
// compacto do celular). `area` = { kind, source, value } ou null:
//   kind 'building' = área da edificação: 'declarada' (CA_AREA na rota Construir, S3 na rota Já sei) ou 'derivada'
//        (existente + nova na ampliação). A referência que o motor estima para a Arquitetura NUNCA entra aqui.
//   kind 'terrain'  = área do terreno informada (Terraplenagem).
//   kind 'scope'    = área do escopo de um serviço (Compatibilização/Orçamento): não é área construída.
//   kind 'served'   = área atendida por uma instalação (Gás): não é área construída.
// Os valores de pricing_inputs continuam os mesmos: este módulo só nomeia a origem, nunca recalcula preço.
export function maquetteFacts(answers) {
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
  const has = (k) => pi[k] !== null && pi[k] !== undefined;
  let area = null;
  if (has('area_total')) {
    const derived = a.route === 'build' && a.CA1 === 'Ampliar um imóvel existente';
    area = { kind: 'building', source: derived ? 'derivada' : 'declarada', value: pi.area_total };
  } else if (a.route === 'build' && has('area_new')) {
    area = { kind: 'building', source: 'declarada', value: pi.area_new };     // área nova declarada (rota Construir)
  } else if (has('area_terreno')) {
    area = { kind: 'terrain', source: 'declarada', value: pi.area_terreno };
  } else if (has('area_escopo')) {
    area = { kind: 'scope', source: 'declarada', value: pi.area_escopo };
  } else if (has('area_atendida')) {
    area = { kind: 'served', source: 'declarada', value: pi.area_atendida };
  }
  return { pi, floors, standard, area };
}

export function maquete5Input(answers) {
  const f = maquetteFacts(answers);
  if (!f) return null;
  const { pi } = f;
  return {
    areaProj: num(pi.area_fundacao),
    areaTotal: f.area && f.area.kind === 'building' ? num(f.area.value) : null,   // só a área da edificação
    areaTerreno: num(pi.area_terreno),
    floors: f.floors,
    typology: pi.typology ?? null,
    standard: f.standard,
    services: Array.isArray(pi.services) ? pi.services : [],
  };
}

// R06 — o que aparece junto ao modelo: só dados de origem conhecida. Área = área da EDIFICAÇÃO declarada ou derivada
// (escopo, área atendida, terreno e a referência do motor não entram); pavimentos = os INFORMADOS, com os representados
// quando o desenho é limitado. Nenhum título é inventado a partir de tipologia ou padrão.
export function stageFacts(answers, spec) {
  const f = maquetteFacts(answers);
  const area = f && f.area && f.area.kind === 'building'
    ? `${Number(String(f.area.value).replace(',', '.')).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²` : null;
  const n = spec && spec.floorsKnown ? spec.floorsDeclared : null;
  const floors = n === null || n === undefined ? null
    : spec.floorsExtra ? `${n} pavimentos · ${spec.floors} representados`
      : `${n} ${n === 1 ? 'pavimento' : 'pavimentos'}`;
  return { area, floors };
}

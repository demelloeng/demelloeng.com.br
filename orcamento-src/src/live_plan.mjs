// P05 — modelo de "Planta que se desenha" + "Orçamento em movimento".
// Tudo vem dos dados REAIS da calculadora (pricing_inputs / pricing_preview do motor): nenhum valor, área ou serviço é inventado aqui.
// O desenho é ILUSTRATIVO: a forma é sempre a mesma (retângulo), só a escala acompanha a ordem de grandeza da área informada.
// Este módulo não calcula preço: lê o que o motor devolveu (status e total por serviço) e decide o que mostrar.
import { derivePricingInputs } from './payload_v2.mjs';
import { buildPricingPreview, REASON_ABOVE_AUTOMATIC_LIMIT } from './pricing/engine.mjs';

// Camadas de disciplina: cada serviço do motor que tem desenho próprio. Os demais (orçamento, consultoria etc.) aparecem
// só na lista do orçamento, sem camada na planta (nada de desenho que não corresponda ao serviço).
export const LAYER_OF = {
  ESTRUTURAL: 'estrutura',
  HIDROSSANITARIO: 'hidrossanitario',
  ELETRICA: 'eletrica',
  INCENDIO: 'incendio',
  GAS_GLP: 'gas',
  TERRAPLENAGEM: 'terreno',
};

// Texto de cada camada (a legenda nomeia a camada: a cor nunca é a única informação).
export const LAYER_LABEL = {
  estrutura: 'Estrutura',
  hidrossanitario: 'Hidrossanitário',
  eletrica: 'Elétrica',
  incendio: 'Incêndio',
  gas: 'Gás',
  terreno: 'Terraplanagem',
};

export const ILLUSTRATIVE_NOTICE = 'Desenho ilustrativo: mostra a ordem de grandeza e as disciplinas escolhidas, não o seu projeto.';

const MAX_FLOORS_DRAWN = 8;

// Escala do desenho: largura do retângulo (unidades do SVG) cresce com o log10 da área, de 10 m² até 10.000 m².
export function footprintFor(area) {
  const a = Number(area);
  if (!Number.isFinite(a) || a <= 0) return null;
  const t = Math.min(1, Math.max(0.08, Math.log10(Math.max(a, 1)) / 4));
  const w = Math.round(110 + 150 * t);
  return { w, h: Math.round(w / 1.5) };
}

const areaOf = (pi) => {
  for (const [key, kind] of [['area_total', 'building'], ['area_new', 'building'], ['area_escopo', 'building'], ['area_atendida', 'building'], ['area_terreno', 'terrain']]) {
    if (pi[key] !== null && pi[key] !== undefined) return { value: pi[key], kind };
  }
  return null;
};

const floorsOf = (answers) => {
  const raw = answers?.CA5?.value;
  const n = typeof raw === 'string' && /^[1-9][0-9]{0,2}$/.test(raw.trim()) ? Number(raw) : null;
  return n;
};

// Retorna null quando ainda não há o que desenhar (nenhum serviço escolhido e nenhuma área).
export function livePlanModel(answers) {
  let pi;
  let pv;
  try {
    pi = derivePricingInputs(answers || {});
    pv = buildPricingPreview(pi);
  } catch {
    return null;
  }
  const area = areaOf(pi);
  if (!pv.services.length && !area) return null;

  const rows = pv.services.map((s) => ({
    key: s.service,
    layer: LAYER_OF[s.service] || null,
    state: s.status === 'CALCULATED' ? 'priced' : s.reason === REASON_ABOVE_AUTOMATIC_LIMIT ? 'over_limit' : 'pending',
    total: s.status === 'CALCULATED' ? s.demello.total : null,
    service: s,
  }));
  const layers = [...new Set(rows.map((r) => r.layer).filter(Boolean))];
  const floors = floorsOf(answers);
  const allPriced = pv.status === 'CALCULATED' && pv.total_demello !== null;
  return {
    area: area ? { ...area, footprint: footprintFor(area.value) } : null,
    floors,
    floorsDrawn: floors === null ? null : Math.min(floors, MAX_FLOORS_DRAWN),
    floorsExtra: floors !== null && floors > MAX_FLOORS_DRAWN ? floors - MAX_FLOORS_DRAWN : 0,
    layers,
    rows,
    // Total só quando o motor calculou TODOS os serviços; senão o painel diz o que falta, sem somar parcial.
    total: allPriced ? pv.total_demello : null,
    mode: allPriced ? 'with_price' : rows.some((r) => r.state === 'over_limit') ? 'over_limit' : 'without_price',
    notice: ILLUSTRATIVE_NOTICE,
  };
}

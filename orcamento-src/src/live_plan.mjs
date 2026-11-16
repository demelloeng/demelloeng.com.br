// P05 — modelo de "Planta que se desenha" + "Orçamento em movimento".
// Tudo vem dos dados REAIS da calculadora (pricing_inputs / pricing_preview do motor): nenhum valor, área ou serviço é inventado aqui.
// O desenho é ILUSTRATIVO: a forma é sempre a mesma (retângulo), só a escala acompanha a ordem de grandeza da área informada.
// Este módulo não calcula preço: lê o que o motor devolveu (status e total por serviço) e decide o que mostrar.
import { maquetteFacts } from './maquete5_input.mjs';
import { REASON_ABOVE_AUTOMATIC_LIMIT, REASON_HOURLY_NOT_DISCRIMINATED } from './pricing/engine.mjs';
import { Q_PT } from './labels.mjs';
import { pricePreview } from './pricing/active_config.mjs';

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

export const ILLUSTRATIVE_LABEL = 'Visualização ilustrativa';
export const ILLUSTRATIVE_NOTICE = 'A maquete acompanha suas escolhas de área, pavimentos e disciplinas.';

const MAX_FLOORS_DRAWN = 8;

// Escala do desenho: largura do retângulo (unidades do SVG) cresce com o log10 da área, de 10 m² até 10.000 m².
export function footprintFor(area) {
  const a = Number(area);
  if (!Number.isFinite(a) || a <= 0) return null;
  const t = Math.min(1, Math.max(0.08, Math.log10(Math.max(a, 1)) / 4));
  const w = Math.round(110 + 150 * t);
  return { w, h: Math.round(w / 1.5) };
}

// R03 complementar: área e pavimentos vêm do MESMO modelo de proveniência da V05 (maquetteFacts). Só a área da
// edificação e a do terreno dão escala ao desenho; escopo e área atendida aparecem no texto, sem escala de edificação.
const DRAWN_KINDS = ['building', 'terrain'];
const AREA_LABEL = {
  'building:declarada': 'Área informada',
  'building:derivada': 'Área total (existente + nova)',
  'terrain:declarada': 'Área do terreno informada',
  'scope:declarada': 'Área do escopo informada',
  'served:declarada': 'Área atendida informada',
};
// Texto acessível da área, pelo que ela é (nunca "informada" para o que não foi).
export function areaPhrase(area) {
  const label = area && AREA_LABEL[`${area.kind}:${area.source}`];
  return label ? `${label}: ${String(area.value).replace('.', ',')} m².` : '';
}

// Retorna null quando ainda não há o que desenhar (nenhum serviço escolhido e nenhuma área).
export function livePlanModel(answers) {
  let facts;
  let pv;
  try {
    facts = maquetteFacts(answers);
    if (!facts) return null;
    pv = pricePreview(facts.pi);
  } catch {
    return null;
  }
  const { area } = facts;
  if (!pv.services.length && !area) return null;

  const rows = pv.services.map((s) => ({
    key: s.service,
    layer: LAYER_OF[s.service] || null,
    state: s.status === 'CALCULATED' ? 'priced' : s.reason === REASON_ABOVE_AUTOMATIC_LIMIT ? 'over_limit' : 'pending',
    total: s.status === 'CALCULATED' ? s.demello.total : null,
    service: s,
  }));
  const layers = [...new Set(rows.map((r) => r.layer).filter(Boolean))];
  const floors = facts.floors;
  const allPriced = pv.status === 'CALCULATED' && pv.total_demello !== null;
  return {
    area: area ? { ...area, footprint: DRAWN_KINDS.includes(area.kind) ? footprintFor(area.value) : null } : null,
    floors,
    floorsDrawn: floors === null ? null : Math.min(floors, MAX_FLOORS_DRAWN),
    floorsExtra: floors !== null && floors > MAX_FLOORS_DRAWN ? floors - MAX_FLOORS_DRAWN : 0,
    layers,
    rows,
    // Total só quando o motor calculou TODOS os serviços; senão o painel diz o que falta, sem somar parcial.
    total: allPriced ? pv.total_demello : null,
    mode: allPriced ? 'with_price' : rows.some((r) => r.state === 'over_limit') ? 'over_limit' : 'without_price',
    label: ILLUSTRATIVE_LABEL,
    notice: ILLUSTRATIVE_NOTICE,
  };
}

// R05 — frase de cada linha do painel a partir do motivo do motor. Limite, dado ambíguo, inconsistência, falta de
// referência e falta de quantidade NÃO se fundem na mesma frase; a quantidade que falta usa o nome já exibido no
// detalhamento (Q_PT). Motivo desconhecido mantém o texto genérico existente.
const MISSING_RE = /^quantidade essencial \(([A-Z_, ]+)\) não informada$/;
export function rowLabel(r) {
  if (r.state === 'priced') return null;
  if (r.state === 'over_limit') return 'Avaliação da equipe';
  const reason = r.service?.reason ?? '';
  const miss = MISSING_RE.exec(reason);
  if (miss) {
    const names = miss[1].split(',').map((s) => s.trim()).map((b) => `a ${Q_PT[b] ?? b}`);
    return names.length > 1 ? `Faltam ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : `Falta ${names[0]}`;
  }
  if (reason === REASON_HOURLY_NOT_DISCRIMINATED) return 'Informe as horas de cada serviço';
  if (/inconsistência/.test(reason)) return 'Áreas a conferir';
  if (reason === 'nenhuma referência externa aplicável' || reason === 'serviço fora da TABELA DEMELLO V2') return 'Sem referência automática';
  return 'Aguardando dados';
}

// R05 — legenda: as camadas do painel e, quando a vista ativa (V05) desenha a Arquitetura, ela também. O fallback e a
// miniatura não desenham Arquitetura, então lá ela não aparece (`drawn` = camadas da cena ativa, ou null).
export function legendLayers(modelLayers, drawn) {
  return Array.isArray(drawn) && drawn.includes('arquitetura') ? ['arquitetura', ...modelLayers] : [...modelLayers];
}

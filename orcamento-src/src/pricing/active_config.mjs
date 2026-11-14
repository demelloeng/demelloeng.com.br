// R4 — configuração comercial do fator DEMELLO no browser (fonte única para o motor do site).
//
// O motor exige {revision, factor_demello}; nunca usa o factor_demello da tabela (0,80 é só da reprodução R2).
// Ponto de partida: o instantâneo da revisão publicada junto com o site (pricing-config.snapshot.json = semente do D1).
// Na abertura, refreshFactorConfig() consulta o Worker da prévia (GET {endpoint}/pricing-config) e, se a revisão ativa
// mudou na área privada, troca a configuração e avisa os assinantes (a tela recalcula). Se a consulta falhar, fica o
// instantâneo: o Worker confere a revisão na emissão e responde 409 FACTOR_REVISION_MISMATCH se ela estiver velha.
import SNAPSHOT from './pricing-config.snapshot.json' with { type: 'json' };
import { buildPricingPreview, parseFactorConfig } from './engine.mjs';

const CONFIG_ROUTE = 'pricing-config';
const TIMEOUT_MS = 6000;

let active = normalize(SNAPSHOT);
const listeners = new Set();

function normalize(cfg) {
  parseFactorConfig(cfg);                       // lança se inválida: nunca aceita configuração malformada
  return { revision: cfg.revision, factor_demello: String(cfg.factor_demello) };
}

export const getFactorConfig = () => active;

export function setFactorConfig(cfg) {
  const next = normalize(cfg);
  const changed = next.revision !== active.revision || next.factor_demello !== active.factor_demello;
  active = next;
  if (changed) for (const fn of listeners) fn(active);
  return changed;
}

export function onFactorConfig(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Todo cálculo exibido ao visitante passa por aqui, com a configuração ativa.
export const pricePreview = (pricingInputs) => buildPricingPreview(pricingInputs, active);

// Só para testes: volta ao instantâneo publicado.
export function resetFactorConfig() { active = normalize(SNAPSHOT); }

export function configUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, '')}/${CONFIG_ROUTE}`;
}

// { ok, changed, status }. Nunca lança para a UI.
export async function refreshFactorConfig({ endpoint, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!endpoint || !f) return { ok: false, changed: false, status: 0 };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const r = await f(configUrl(endpoint), { method: 'GET', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
    if (r.status !== 200) return { ok: false, changed: false, status: r.status };
    const body = await r.json();
    if (!body || body.schema !== 'PRICING_CONFIG_V1') return { ok: false, changed: false, status: r.status };
    return { ok: true, changed: setFactorConfig({ revision: body.revision, factor_demello: body.factor_demello }), status: 200 };
  } catch {
    return { ok: false, changed: false, status: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

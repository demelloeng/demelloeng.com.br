// DEMELLO — camada de mensuração do funil, desacoplada de qualquer fornecedor.
//
// O que ESTE módulo faz: valida o evento contra um contrato fechado, remove qualquer
// parâmetro fora do contrato, impede duplicidade e entrega o evento a "sinks" (destinos)
// registrados por quem quiser. O que ele NÃO faz: falar com GA4, GTM, Meta, Clarity ou
// qualquer rede. Nenhum fornecedor e nenhum identificador de conta existem aqui.
//
// Contrato completo, origem de cada parâmetro e como conectar uma ferramenta depois:
//   docs/MENSURACAO_FUNIL.md
//
// Regras de privacidade (impostas em código, não por convenção):
//   - só entram parâmetros declarados em EVENTS[nome].params;
//   - cada parâmetro tem um validador FECHADO (enum ou padrão estrito), então texto livre,
//     e-mail, telefone, nome de arquivo ou foto não passam, mesmo se alguém tentar;
//   - eventos pós-venda (proposal_sent, contract_won) só podem ser emitidos pelo CRM/back-office,
//     nunca pelo navegador — o site não conhece esses resultados e não os simula.

export const SCHEMA = 'demello-analytics/1';

const ROUTES = ['build', 'regularize', 'problem', 'known', 'support'];
const SERVICES = [
  'estrutural', 'hidrossanitario', 'incendio', 'gas_glp', 'arquitetura', 'regularizacao',
  'orcamento', 'terraplenagem', 'compatibilizacao', 'consultoria_tecnica', 'mentoria_tecnica',
  'multiple', 'none',
];
const PAGE_RE = /^\/(?:[a-z0-9-]{1,40}\/){0,3}(?:[a-z0-9-]{1,60}\.html)?$/;

// Validadores fechados por parâmetro. Valor fora do contrato é descartado, nunca "limpo".
export const PARAMS = Object.freeze({
  page: (v) => typeof v === 'string' && v.length <= 100 && PAGE_RE.test(v),
  origin: (v) => ['direct', 'internal', 'external'].includes(v),
  origin_page: (v) => typeof v === 'string' && v.length <= 100 && PAGE_RE.test(v),
  route: (v) => ROUTES.includes(v),
  entry: (v) => ['deeplink', 'manual', 'redirect'].includes(v),
  service: (v) => SERVICES.includes(v),
  service_count: (v) => Number.isInteger(v) && v >= 0 && v <= 11,
  step: (v) => typeof v === 'string' && /^[A-Z][A-Z0-9_-]{0,15}$/.test(v),
  result_status: (v) => ['calculated', 'needs_review', 'safety_hold'].includes(v),
  request_intent: (v) => ['proposal', 'scope_question', 'evaluation_only'].includes(v),
  rule: (v) => v === 'R1',
  // Arquitetura (estimativa comercial de área): só enums e faixas — nunca valores exatos, texto livre ou dados pessoais.
  area_source: (v) => ['USER_DECLARED', 'NEEDS_PROGRAM_ESTIMATE', 'PROGRAM_AND_LOT_ESTIMATE', 'LOT_ONLY_ESTIMATE', 'HUMAN_REVIEW_REQUIRED'].includes(v),
  area_band: (v) => ['na', 'lt_60', '60_100', '100_150', '150_250', '250_400', 'gt_400'].includes(v),
  lot_area_band: (v) => ['na', 'lt_200', '200_360', '360_600', '600_1000', 'gt_1000'].includes(v),
  program_size_band: (v) => ['na', 'lt_80', '80_140', '140_220', 'gt_220'].includes(v),
  estimation_version: (v) => typeof v === 'string' && /^ARQ_EST_V\d{1,3}$/.test(v),
});

// emitters: quem tem autoridade para emitir. 'site' = navegador do visitante; 'crm' = back-office.
// planned: previsto no contrato, mas o site ainda não tem como saber (não é emitido pelo navegador).
export const EVENTS = Object.freeze({
  page_view: { emitters: ['site'], params: ['page', 'origin', 'origin_page'], stage: 'visita' },
  estimate_started: { emitters: ['site'], params: ['route', 'entry', 'step'], stage: 'estimativa' },
  situation_selected: { emitters: ['site'], params: ['route', 'entry', 'service', 'step'], stage: 'estimativa' },
  estimate_completed: { emitters: ['site'], params: ['route', 'service', 'service_count', 'result_status', 'step'], stage: 'estimativa' },
  framing_delivered: { emitters: ['site'], params: ['route', 'service', 'service_count', 'result_status', 'step'], stage: 'estimativa' },
  proposal_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
  scope_question_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
  evaluation_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
  qualified_lead: { emitters: ['site', 'crm'], params: ['route', 'service', 'service_count', 'rule'], stage: 'qualificação' },
  // Ramificação de Arquitetura (cliente sem a área do projeto). Parâmetros: faixas e enums apenas.
  architecture_area_known: { emitters: ['site'], params: ['area_source', 'area_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_area_unknown: { emitters: ['site'], params: ['area_source', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimator_started: { emitters: ['site'], params: ['lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimated_by_program: { emitters: ['site'], params: ['area_source', 'area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimated_by_lot: { emitters: ['site'], params: ['area_source', 'area_band', 'lot_area_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimated_by_program_and_lot: { emitters: ['site'], params: ['area_source', 'area_band', 'lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimator_human_review: { emitters: ['site'], params: ['area_source', 'lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
  architecture_estimate_presented: { emitters: ['site'], params: ['area_source', 'area_band', 'estimation_version'], stage: 'arquitetura' },
  proposal_sent: { emitters: ['crm'], params: ['route', 'service'], stage: 'comercial', planned: true },
  contract_won: { emitters: ['crm'], params: ['route', 'service'], stage: 'comercial', planned: true },
});

const QUEUE_MAX = 50;

// Fábrica pura (testável): cada instância tem seu próprio estado de deduplicação, fila e sinks.
export function createTracker({ emitter = 'site', enabled = true } = {}) {
  const sinks = new Set();
  const fired = new Set();
  const queue = [];
  let on = enabled;

  function deliver(event) {
    queue.push(event);
    if (queue.length > QUEUE_MAX) queue.shift();
    for (const sink of sinks) {
      try { sink(event); } catch { /* um destino com erro nunca derruba a página nem os outros destinos */ }
    }
  }

  // track(nome, parâmetros, { dedupeKey }) -> { ok, reason?, event?, dropped? }
  function track(name, params = {}, { dedupeKey } = {}) {
    if (!on) return { ok: false, reason: 'disabled' };
    if (typeof name !== 'string' || !Object.hasOwn(EVENTS, name)) return { ok: false, reason: 'unknown_event' };
    const def = EVENTS[name];
    if (!def.emitters.includes(emitter)) return { ok: false, reason: 'not_allowed_emitter' };

    const clean = {};
    const dropped = [];
    const input = params && typeof params === 'object' ? params : {};
    for (const key of Object.keys(input)) {
      if (!def.params.includes(key) || !Object.hasOwn(PARAMS, key) || !PARAMS[key](input[key])) dropped.push(key);
      else clean[key] = input[key];
    }
    const ordered = Object.fromEntries(Object.keys(clean).sort().map((k) => [k, clean[k]]));
    const key = `${name}|${dedupeKey ?? JSON.stringify(ordered)}`;
    if (fired.has(key)) return { ok: false, reason: 'duplicate', dropped };
    fired.add(key);

    const event = Object.freeze({ schema: SCHEMA, name, emitter, params: Object.freeze(ordered) });
    deliver(event);
    return { ok: true, event, dropped };
  }

  // subscribe(fn, { replay }) -> unsubscribe. replay=true entrega o que já ocorreu na página (para tags carregadas depois).
  function subscribe(fn, { replay = false } = {}) {
    if (typeof fn !== 'function') return () => {};
    sinks.add(fn);
    if (replay) for (const e of queue) { try { fn(e); } catch { /* idem */ } }
    return () => sinks.delete(fn);
  }

  return {
    track,
    subscribe,
    setEnabled(value) { on = !!value; },
    isEnabled: () => on,
    // só para testes
    _reset() { fired.clear(); queue.length = 0; sinks.clear(); },
    _queue: () => queue.slice(),
  };
}

// Respeita Do Not Track / Global Privacy Control por padrão. Conectar uma ferramenta externa
// exige, além disso, a política de consentimento (LGPD) — ver docs/MENSURACAO_FUNIL.md.
function privacySignalsAllowTracking() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav) return true;
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return false;
  } catch { /* ambiente sem navigator */ }
  return true;
}

const tracker = createTracker({ emitter: 'site', enabled: privacySignalsAllowTracking() });

export const track = tracker.track;
export const subscribe = tracker.subscribe;
export const setEnabled = tracker.setEnabled;
export const isEnabled = tracker.isEnabled;

// Destino neutro padrão: um CustomEvent no window. Nenhum fornecedor; qualquer tag futura escuta isto.
tracker.subscribe((event) => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('demello:analytics', { detail: event }));
  }
});

// Ponto de conexão público e estável para tags futuras (GA4/GTM/Meta/etc.).
if (typeof window !== 'undefined') {
  window.DemelloAnalytics = Object.freeze({ schema: SCHEMA, subscribe: tracker.subscribe, events: Object.keys(EVENTS) });
}

// ---- page_view (páginas estáticas e /orcamento/) -------------------------------------------------------------------

// Normaliza o caminho: sem query/hash, "index.html" vira "/", sempre minúsculo. Fora do padrão -> null (não envia).
export function normalizePath(pathname) {
  if (typeof pathname !== 'string') return null;
  let p = pathname.split('?')[0].split('#')[0].toLowerCase();
  p = p.replace(/index\.html$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/') && !p.endsWith('.html')) p += '/';
  return PARAMS.page(p) ? p : null;
}

// Origem sem dado pessoal: só "direct", "external" (sem revelar o domínio) ou o caminho interno do próprio site.
export function originOf(referrer, ownOrigin) {
  if (!referrer) return { origin: 'direct' };
  try {
    const url = new URL(referrer);
    if (url.origin === ownOrigin) {
      const page = normalizePath(url.pathname);
      return page ? { origin: 'internal', origin_page: page } : { origin: 'direct' };
    }
    return { origin: 'external' };
  } catch {
    return { origin: 'direct' };
  }
}

export function trackPageView(win = typeof window !== 'undefined' ? window : null, doc = typeof document !== 'undefined' ? document : null) {
  if (!win || !doc) return null;
  const page = normalizePath(win.location.pathname);
  if (!page) return null;
  return track('page_view', { page, ...originOf(doc.referrer, win.location.origin) });
}

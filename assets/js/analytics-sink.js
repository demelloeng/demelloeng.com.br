/* DEMELLO — destino (sink) da mensuração: Simple Analytics.
   Script clássico, carregado com "defer" ANTES de site-analytics.mjs e do bundle do /orcamento/, para já estar ouvindo quando o
   primeiro evento sair. Só liga o Simple Analytics quando o navegador NÃO envia Do Not Track nem Global Privacy Control.
   Os eventos vêm do adaptador neutro (assets/js/analytics.mjs): contrato fechado, sem texto livre e sem dado pessoal.
   Visitas e origem ficam por conta do próprio script do Simple Analytics (sem cookies); por isso "page_view" não é reenviado.
   Contrato e passos de conexão: docs/MENSURACAO_FUNIL.md */
(function () {
  'use strict';
  var SA_SRC = 'https://scripts.simpleanalyticscdn.com/latest.js';
  function trackingAllowed() {
    try {
      var nav = window.navigator || {};
      return !(nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl === true);
    } catch (e) { return false; }
  }
  if (!trackingAllowed()) return;

  // Espelho fechado do contrato neutro: clássico compatível com o bundle publicado.
  const ROUTES = ['build', 'regularize', 'problem', 'known', 'support'];
  const SERVICES = [
    'estrutural', 'hidrossanitario', 'incendio', 'gas_glp', 'arquitetura', 'regularizacao',
    'orcamento', 'terraplenagem', 'compatibilizacao', 'consultoria_tecnica', 'mentoria_tecnica', 'eletrica',
    'multiple', 'none',
  ];
  const PAGE_RE = /^\/(?:[a-z0-9-]{1,40}\/){0,3}(?:[a-z0-9-]{1,60}\.html)?$/;

  const PARAMS = Object.freeze({
    page: (v) => typeof v === 'string' && v.length <= 100 && PAGE_RE.test(v),
    origin: (v) => ['direct', 'internal', 'external'].includes(v),
    origin_page: (v) => typeof v === 'string' && v.length <= 100 && PAGE_RE.test(v),
    route: (v) => ROUTES.includes(v),
    entry: (v) => ['deeplink', 'manual', 'redirect'].includes(v),
    service: (v) => SERVICES.includes(v),
    service_count: (v) => Number.isInteger(v) && v >= 0 && v <= 12,
    step: (v) => typeof v === 'string' && /^[A-Z][A-Z0-9_-]{0,15}$/.test(v),
    result_status: (v) => ['calculated', 'needs_review', 'safety_hold'].includes(v),
    request_intent: (v) => ['proposal', 'scope_question', 'evaluation_only'].includes(v),
    rule: (v) => v === 'R1',
    area_source: (v) => ['USER_DECLARED', 'NEEDS_PROGRAM_ESTIMATE', 'PROGRAM_AND_LOT_ESTIMATE', 'LOT_ONLY_ESTIMATE', 'HUMAN_REVIEW_REQUIRED'].includes(v),
    area_band: (v) => ['na', 'lt_60', '60_100', '100_150', '150_250', '250_400', 'gt_400'].includes(v),
    lot_area_band: (v) => ['na', 'lt_200', '200_360', '360_600', '600_1000', 'gt_1000'].includes(v),
    program_size_band: (v) => ['na', 'lt_80', '80_140', '140_220', 'gt_220'].includes(v),
    estimation_version: (v) => typeof v === 'string' && /^ARQ_EST_V\d{1,3}$/.test(v),
    placement: (v) => ['topbar', 'menu', 'cta_band', 'contact_page', 'footer', 'body'].includes(v),
  });

  const EVENTS = Object.freeze({
    page_view: { emitters: ['site'], params: ['page', 'origin', 'origin_page'], stage: 'visita' },
    estimate_started: { emitters: ['site'], params: ['route', 'entry', 'step'], stage: 'estimativa' },
    situation_selected: { emitters: ['site'], params: ['route', 'entry', 'service', 'step'], stage: 'estimativa' },
    estimate_completed: { emitters: ['site'], params: ['route', 'service', 'service_count', 'result_status', 'step'], stage: 'estimativa' },
    framing_delivered: { emitters: ['site'], params: ['route', 'service', 'service_count', 'result_status', 'step'], stage: 'estimativa' },
    proposal_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
    scope_question_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
    evaluation_requested: { emitters: ['site'], params: ['route', 'service', 'service_count', 'request_intent', 'step'], stage: 'pedido' },
    qualified_lead: { emitters: ['site', 'crm'], params: ['route', 'service', 'service_count', 'rule'], stage: 'qualificação' },
    architecture_area_known: { emitters: ['site'], params: ['area_source', 'area_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_area_unknown: { emitters: ['site'], params: ['area_source', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimator_started: { emitters: ['site'], params: ['lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimated_by_program: { emitters: ['site'], params: ['area_source', 'area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimated_by_lot: { emitters: ['site'], params: ['area_source', 'area_band', 'lot_area_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimated_by_program_and_lot: { emitters: ['site'], params: ['area_source', 'area_band', 'lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimator_human_review: { emitters: ['site'], params: ['area_source', 'lot_area_band', 'program_size_band', 'estimation_version'], stage: 'arquitetura' },
    architecture_estimate_presented: { emitters: ['site'], params: ['area_source', 'area_band', 'estimation_version'], stage: 'arquitetura' },
    whatsapp_contact_started: { emitters: ['site'], params: ['page', 'placement', 'route', 'service'], stage: 'contato_direto' },
    phone_contact_started: { emitters: ['site'], params: ['page', 'placement', 'route', 'service'], stage: 'contato_direto' },
    email_contact_started: { emitters: ['site'], params: ['page', 'placement', 'route', 'service'], stage: 'contato_direto' },
    proposal_sent: { emitters: ['crm'], params: ['route', 'service'], stage: 'comercial', planned: true },
    contract_won: { emitters: ['crm'], params: ['route', 'service'], stage: 'comercial', planned: true },
  });

  window.sa_event = window.sa_event || function () {
    var a = [].slice.call(arguments);
    window.sa_event.q ? window.sa_event.q.push(a) : (window.sa_event.q = [a]);
  };

  window.addEventListener('demello:analytics', function (e) {
    try {
      if (!trackingAllowed()) return;
      var ev = e && e.detail;
      if (!ev || typeof ev.name !== 'string' || ev.name === 'page_view' || !Object.hasOwn(EVENTS, ev.name)) return;
      var def = EVENTS[ev.name];
      if (!def.emitters.includes('site')) return;
      var meta = {};
      var params = ev.params && typeof ev.params === 'object' ? ev.params : {};
      def.params.forEach(function (k) {
        if (Object.hasOwn(params, k) && PARAMS[k](params[k])) meta[k] = params[k];
      });
      window.sa_event(ev.name, meta);
    } catch (err) { /* medição nunca derruba a página */ }
  });

  try {
    var s = document.createElement('script');
    s.async = true;
    s.src = SA_SRC;
    document.head.appendChild(s);
  } catch (err) { /* DOM indisponível: a navegação continua */ }
})();

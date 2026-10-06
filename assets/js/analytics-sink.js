/* DEMELLO — destino (sink) da mensuração: Simple Analytics.
   Script clássico, carregado com "defer" ANTES de site-analytics.mjs e do bundle do /orcamento/, para já estar ouvindo quando o
   primeiro evento sair. Só liga o Simple Analytics quando o navegador NÃO envia Do Not Track nem Global Privacy Control.
   Os eventos vêm do adaptador neutro (assets/js/analytics.mjs): contrato fechado, sem texto livre e sem dado pessoal.
   Visitas e origem ficam por conta do próprio script do Simple Analytics (sem cookies); por isso "page_view" não é reenviado.
   Contrato e passos de conexão: docs/MENSURACAO_FUNIL.md */
(function () {
  'use strict';
  var SA_SRC = 'https://scripts.simpleanalyticscdn.com/latest.js';
  try {
    var nav = window.navigator || {};
    if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl === true) return;
  } catch (e) { return; }

  window.sa_event = window.sa_event || function () {
    var a = [].slice.call(arguments);
    window.sa_event.q ? window.sa_event.q.push(a) : (window.sa_event.q = [a]);
  };

  window.addEventListener('demello:analytics', function (e) {
    var ev = e && e.detail;
    if (!ev || typeof ev.name !== 'string' || ev.name === 'page_view') return;
    var name = ev.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 200);
    var meta = {};
    var params = ev.params || {};
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') meta[k] = v;
    });
    try { window.sa_event(name, meta); } catch (err) { /* medição nunca derruba a página */ }
  });

  var s = document.createElement('script');
  s.async = true;
  s.src = SA_SRC;
  document.head.appendChild(s);
})();

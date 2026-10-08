/* DEMELLO — Pixel da Meta (Facebook/Instagram).
   Script clássico, carregado com "defer" depois do analytics-sink.js em todas as páginas.
   Regras (política de privacidade, seção "Anúncios e Meta"):
   - NÃO carrega para quem envia Do Not Track ou Global Privacy Control;
   - nos demais casos, carrega com a página (sem aviso de consentimento, mesma lógica do site do Amor em Todos os Cantos);
   - o evento Lead (pedido de proposta, dúvida de escopo, avaliação) NÃO sai daqui: sai do Worker, pela API de Conversões,
     depois que o CRM aceita o envio (sem duplicidade);
   - envia à Meta, deste navegador, só PageView e os eventos do contrato fechado (assets/js/analytics.mjs), com parâmetros de lista fechada:
     nunca nome, contato, texto digitado ou foto;
   - sem correspondência avançada (nenhum e-mail ou telefone, nem em hash, sai do navegador).
   Para desligar tudo: PIXEL_ID vazio. */
(function () {
  'use strict';
  var PIXEL_ID = '1931062271390595';
  var FB_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
  if (!PIXEL_ID) return;

  var nav = window.navigator || {};
  try {
    if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl === true) return;
  } catch (e) { return; }

  var SAFE = { route: /^(build|regularize|problem|known|support)$/, service: /^[a-z_]{2,30}$/ };
  function safeParams(p) {
    var out = {};
    p = p || {};
    Object.keys(SAFE).forEach(function (k) {
      if (typeof p[k] === 'string' && SAFE[k].test(p[k])) out[k] = p[k];
    });
    return out;
  }

  var MAP = {
    qualified_lead: ['trackCustom', 'QualifiedLead'],
    estimate_completed: ['trackCustom', 'EstimateCompleted'],
    whatsapp_contact_started: ['track', 'Contact'],
    phone_contact_started: ['track', 'Contact'],
    email_contact_started: ['track', 'Contact']
  };

  function loadPixel() {
    /* Código-base oficial da Meta (instrução enviada pelo Gerenciador de Eventos), sem o <noscript>. */
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', FB_SRC);
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    window.addEventListener('demello:analytics', function (e) {
      var ev = e && e.detail;
      if (!ev || typeof ev.name !== 'string' || !MAP[ev.name]) return;
      try { window.fbq(MAP[ev.name][0], MAP[ev.name][1], safeParams(ev.params)); } catch (err) { /* medição nunca derruba a página */ }
    });
  }

  loadPixel();
})();

/* DEMELLO — botão flutuante de WhatsApp (P04). Script clássico, "defer", em todas as páginas e na calculadora.

   O que faz: um acesso reconhecível ao WhatsApp institucional, sem procurar no menu ou no rodapé.
   O que NÃO faz: não simula atendimento online, não promete tempo de resposta, não abre janela sobre a página,
   não guarda nada no navegador (o site declara "sem cookie, sem armazenamento"; por isso o recolhimento do texto
   vale só para a página aberta) e não mede por conta própria: o clique é um link wa.me comum, medido pelo ouvinte
   único de contato (assets/js/contact-clicks.mjs) com a posição "floating". Um evento por clique.

   Acessibilidade: link de verdade (Enter e toque), nome acessível fixo, foco visível, contraste AA (verde escuro com
   texto branco), alvo de 56 px (44 px quando acoplado), "prefers-reduced-motion" sem animação, sai de cima do campo quando o
   teclado do celular abre (foco em campo de texto). Nas páginas ele flutua no canto; na calculadora ele fica acoplado ao rodapé
   (computador) ou ao painel fixo "Seu projeto" (celular) e não cobre nada. */
(function () {
  'use strict';
  if (window.__dmFlutuante) return;
  window.__dmFlutuante = true;

  var NUMBER = '554498202552'; // WhatsApp Business institucional registrado na Meta
  var MESSAGE = 'Olá! Vim pelo site da DEMELLO Engenharia.';
  var HREF = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(MESSAGE);
  var GLYPH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.18 2.095 3.195 5.076 4.483.714.306 1.272.489 1.705.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

  var CSS = [
    '.dm-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;align-items:center;gap:6px;font-family:"Montserrat",Arial,sans-serif;animation:dm-fab-in .24s ease-out both}',
    '.dm-fab[hidden]{display:none}',
    '.dm-fab--teclado{display:none}',
    '.dm-fab__link{display:flex;align-items:center;gap:10px;min-height:56px;min-width:56px;padding:0 16px;border-radius:28px;background:#0f7a3c;color:#fff;text-decoration:none;font-size:15px;font-weight:600;line-height:1.2;box-shadow:0 0 0 2px #fff,0 4px 14px rgba(0,0,0,.28);justify-content:center}',
    '.dm-fab__link:hover{background:#0b6631}',
    '.dm-fab__link:focus-visible,.dm-fab__fechar:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px #0643a7}',
    '.dm-fab__link svg{width:28px;height:28px;flex:none;fill:currentColor}',
    '.dm-fab__rotulo{display:block;max-width:200px;overflow:hidden;white-space:nowrap;transition:max-width .2s ease,opacity .2s ease}',
    '.dm-fab--recolhido .dm-fab__rotulo{max-width:0;opacity:0}',
    '.dm-fab--recolhido .dm-fab__link{padding:0}',
    '.dm-fab--recolhido .dm-fab__fechar{display:none}',
    '.dm-fab__fechar{width:32px;height:32px;border:0;border-radius:50%;background:#fff;color:#0a2d55;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)}',
    /* Calculadora: o botão fica dentro da barra fixa do rodapé, como um item dela (ícone no celular, ícone e texto no computador). */
    '.dm-fab--docked{position:static;animation:none;z-index:auto;margin-left:12px;flex:none}',
    '.dm-fab--docked .dm-fab__fechar{display:none}',
    '.dm-fab--docked .dm-fab__link{min-height:44px;min-width:44px;padding:0 14px;border-radius:22px;font-size:14px}',
    '.dm-fab--docked .dm-fab__link svg{width:24px;height:24px}',
    '@media (max-width:900px){.dm-fab--docked .dm-fab__rotulo{display:none}.dm-fab--docked .dm-fab__link{padding:0;justify-content:center}}',
    /* Painel "Seu projeto" no celular: área de toque de 44 px, círculo visível de 32 px (proporcional ao título e ao botão Expandir). */
    '@media (max-width:900px){.case-panel .dm-fab--docked{position:absolute;right:128px;top:12px;width:44px;height:44px;margin:0;z-index:6}.case-panel .dm-fab--docked .dm-fab__link{position:relative;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;background:transparent;box-shadow:none;border-radius:50%}.case-panel .dm-fab--docked .dm-fab__link:before{content:"";position:absolute;inset:6px;border-radius:50%;background:#0f7a3c;box-shadow:0 0 0 2px #fff,0 2px 8px rgba(0,0,0,.25)}.case-panel .dm-fab--docked .dm-fab__link:hover:before{background:#0b6631}.case-panel .dm-fab--docked .dm-fab__link:focus-visible{outline:0;box-shadow:none}.case-panel .dm-fab--docked .dm-fab__link:focus-visible:before{box-shadow:0 0 0 2px #fff,0 0 0 5px #0643a7}.case-panel .dm-fab--docked .dm-fab__link svg{position:relative;width:18px;height:18px}}',
    '@keyframes dm-fab-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '@media (max-width:520px){.dm-fab{right:12px}}',
    '@media (prefers-reduced-motion:reduce){.dm-fab{animation:none}.dm-fab__rotulo{transition:none}}',
    '@media print{.dm-fab{display:none}}'
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'dm-fab-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'dm-fab';
  if (location.pathname.indexOf('/orcamento') === 0) {
    wrap.className += ' dm-fab--calc';
  }

  var link = document.createElement('a');
  link.className = 'dm-fab__link';
  link.href = HREF;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('data-contact-placement', 'floating');
  link.setAttribute('aria-label', 'WhatsApp DEMELLO: conversar agora (abre em nova aba)');
  link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + GLYPH + '"/></svg><span class="dm-fab__rotulo" aria-hidden="true">WhatsApp DEMELLO</span>';

  var fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'dm-fab__fechar';
  fechar.setAttribute('aria-label', 'Recolher o texto do botão do WhatsApp');
  fechar.textContent = '×';

  function recolher() { wrap.className += ' dm-fab--recolhido'; }
  fechar.addEventListener('click', recolher);

  wrap.appendChild(link);
  wrap.appendChild(fechar);
  document.body.appendChild(wrap);

  // O texto aparece na entrada e se recolhe sozinho: sobra o ícone, que continua com nome acessível.
  // No celular (largura de até 520 px) ele já nasce recolhido: o texto cobriria um cartão inteiro da pergunta.
  var estreita = window.matchMedia && window.matchMedia('(max-width:520px)').matches;
  var timer = estreita ? 0 : setTimeout(recolher, 6000);
  if (estreita) recolher();
  fechar.addEventListener('click', function () { clearTimeout(timer); });

  // Calculadora: a jornada é um formulário com rolagem. Por isso o botão não flutua sobre ela: fica ACOPLADO a uma barra fixa,
  // onde nunca há campo, valor, legenda nem controle por baixo. Acima de 900 px ele entra no rodapé; até 900 px, no painel
  // "Seu projeto", que fica fixo no topo do celular (o cabeçalho rola para fora e o rodapé não tem espaço livre). Sem
  // sobreposição possível, sem esquiva e sem opacidade reduzida.
  // A calculadora desenha as duas barras depois deste script: o botão espera por elas e troca de lugar quando a largura muda.
  if (wrap.className.indexOf('dm-fab--calc') !== -1) {
    var estreitaCalc = window.matchMedia ? window.matchMedia('(max-width:900px)') : { matches: false };
    var acoplar = function () {
      var noPainel = estreitaCalc.matches;
      var barra = document.querySelector(noPainel ? '.case-panel' : '.site-footer');
      if (!barra) return false;
      wrap.classList.add('dm-fab--docked');
      document.body.classList.toggle('dm-fab-no-painel', noPainel);
      if (wrap.parentNode !== barra) barra.appendChild(wrap);
      return true;
    };
    if (!acoplar() && window.MutationObserver) {
      var espera = new MutationObserver(function () { if (acoplar()) espera.disconnect(); });
      espera.observe(document.body, { childList: true, subtree: true });
    }
    if (estreitaCalc.addEventListener) estreitaCalc.addEventListener('change', acoplar);
  }

  // Teclado do celular: com foco em campo de texto, o botão sai de cima do que a pessoa está preenchendo.
  var TEXTUAL = /^(?:text|search|tel|email|url|number|password|date|time|datetime-local|month|week)$/i;
  function ehCampoDeTexto(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag === 'input') return TEXTUAL.test(el.getAttribute('type') || 'text');
    return !!el.isContentEditable;
  }
  document.addEventListener('focusin', function (e) { if (ehCampoDeTexto(e.target)) wrap.classList.add('dm-fab--teclado'); });
  document.addEventListener('focusout', function (e) { if (ehCampoDeTexto(e.target)) wrap.classList.remove('dm-fab--teclado'); });
})();

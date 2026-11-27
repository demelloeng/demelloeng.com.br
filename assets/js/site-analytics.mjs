// Páginas estáticas do site: dispara `page_view` (rota normalizada + origem interna) e liga a medição dos cliques de contato
// direto (WhatsApp, telefone, e-mail). Nenhum cookie, nenhum identificador, nenhuma query string, nenhum fragmento.
// Contrato e pontos de conexão: docs/MENSURACAO_FUNIL.md
import { normalizePath, track, trackPageView } from './analytics.mjs';
import { installContactClicks } from './contact-clicks.mjs';
import { forwardAcquisition, isEstimateLink } from './acquisition.mjs';

trackPageView();
installContactClicks();
forwardAcquisition(document);

let estimateClicks = 0;
function trackEstimateLink(event) {
  const link = event.target?.closest?.('a[href]');
  if (!link || event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
  let target;
  try { target = new URL(link.href, document.baseURI); } catch { return; }
  if (isEstimateLink(target, location.origin)) {
    track('estimate_link_clicked', { page: normalizePath(location.pathname) }, { dedupeKey: ++estimateClicks });
  }
}

document.addEventListener('click', trackEstimateLink);
document.addEventListener('auxclick', trackEstimateLink);

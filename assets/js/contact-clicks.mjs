// DEMELLO — cliques em contato direto (WhatsApp, telefone, e-mail) nas páginas estáticas.
//
// Um único ouvinte delegado no documento cobre TODOS os links de contato (os atuais e os que vierem depois): nenhum link
// precisa ser marcado um a um. O evento entra no MESMO barramento do funil (assets/js/analytics.mjs, contrato fechado):
//   whatsapp_contact_started | phone_contact_started | email_contact_started
// São INTENÇÃO de contato. Não são pedido de proposta nem lead qualificado (qualified_lead segue só pela regra R1).
//
// Privacidade, imposta em código: o evento só leva a página, a POSIÇÃO do botão (lista fechada) e, quando a página
// define, a rota ou o serviço (códigos controlados). O href, o número, o endereço de e-mail e qualquer texto nunca são lidos
// para dentro do evento. Este módulo não usa cookie, armazenamento nem rede, e nunca bloqueia a navegação.
import { track, normalizePath } from './analytics.mjs';

export const CHANNELS = Object.freeze([
  { event: 'whatsapp_contact_started', match: (href) => /^https:\/\/wa\.me\//i.test(href) },
  { event: 'phone_contact_started', match: (href) => /^tel:/i.test(href) },
  { event: 'email_contact_started', match: (href) => /^mailto:/i.test(href) },
]);

export function channelOf(href) {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  for (const c of CHANNELS) if (c.match(h)) return c.event;
  return null;
}

// Página -> rota/serviço (códigos do contrato). Fora da tabela: só a página.
const PAGE_CONTEXT = Object.freeze({
  '/construir-ou-ampliar/': { route: 'build' },
  '/avaliar-um-problema/': { route: 'problem' },
  '/servicos/': { route: 'known' },
  '/servicos/projeto-estrutural/': { route: 'known', service: 'estrutural' },
  '/servicos/projeto-hidrossanitario/': { route: 'known', service: 'hidrossanitario' },
  '/servicos/projeto-prevencao-incendio/': { route: 'known', service: 'incendio' },
  '/servicos/projeto-gas-glp/': { route: 'known', service: 'gas_glp' },
  '/servicos/projeto-arquitetura/': { route: 'known', service: 'arquitetura' },
  '/servicos/regularizacao/': { route: 'regularize', service: 'regularizacao' },
  '/servicos/orcamento-tecnico/': { route: 'known', service: 'orcamento' },
  '/servicos/projeto-terraplenagem/': { route: 'known', service: 'terraplenagem' },
  '/servicos/compatibilizacao-bim/': { route: 'known', service: 'compatibilizacao' },
});

export function contextOf(page) {
  return (page && Object.hasOwn(PAGE_CONTEXT, page)) ? PAGE_CONTEXT[page] : {};
}

// Posição do botão: atributo explícito (data-contact-placement) ou o contêiner onde ele está.
export function placementOf(link, page) {
  const explicit = link.closest?.('[data-contact-placement]')?.getAttribute('data-contact-placement');
  if (explicit) return explicit;
  if (link.closest?.('.topbar')) return 'topbar';
  if (link.closest?.('.site-footer')) return 'footer';
  if (link.closest?.('.nav')) return 'menu';
  if (link.closest?.('.cta-band, .cta-stack')) return 'cta_band';
  if (page === '/contato/') return 'contact_page';
  return 'body';
}

// Monta o evento a partir do clique. Devolve null se o clique não for em link de contato.
export function buildEvent(target, win) {
  const link = target?.closest ? target.closest('a[href]') : null;
  if (!link) return null;
  const event = channelOf(link.getAttribute('href'));
  if (!event) return null;
  const page = normalizePath(win?.location?.pathname ?? '');
  const params = { placement: placementOf(link, page), ...contextOf(page) };
  if (page) params.page = page;
  return { event, params };
}

export function handleClick(e, win = typeof window !== 'undefined' ? window : null, trackFn = track) {
  try {
    if (!win) return null;
    const built = buildEvent(e?.target, win);
    if (!built) return null;
    return trackFn(built.event, built.params);
  } catch { return null; /* a medição nunca atrapalha o clique */ }
}

export function installContactClicks(win = typeof window !== 'undefined' ? window : null, doc = typeof document !== 'undefined' ? document : null) {
  if (!win || !doc || typeof doc.addEventListener !== 'function') return false;
  const onClick = (e) => { handleClick(e, win); };
  // click cobre mouse, toque e teclado (Enter); auxclick cobre o botão do meio (abrir em nova aba).
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('auxclick', (e) => { if (e.button === 1) onClick(e); }, true);
  return true;
}

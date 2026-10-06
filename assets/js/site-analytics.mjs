// Páginas estáticas do site: dispara `page_view` (rota normalizada + origem interna) e liga a medição dos cliques de contato
// direto (WhatsApp, telefone, e-mail). Nenhum cookie, nenhum identificador, nenhuma query string, nenhum fragmento.
// Contrato e pontos de conexão: docs/MENSURACAO_FUNIL.md
import { trackPageView } from './analytics.mjs';
import { installContactClicks } from './contact-clicks.mjs';

trackPageView();
installContactClicks();

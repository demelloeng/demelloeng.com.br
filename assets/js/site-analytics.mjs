// Páginas estáticas do site: dispara somente `page_view` (rota normalizada + origem interna).
// Nenhum cookie, nenhum identificador, nenhuma query string, nenhum fragmento.
// Contrato e pontos de conexão: docs/MENSURACAO_FUNIL.md
import { trackPageView } from './analytics.mjs';

trackPageView();

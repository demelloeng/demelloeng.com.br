// Páginas publicadas (lidas da allowlist) e o bloqueio de tudo que não é 127.0.0.1.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './playwright.config.mjs';

const ALLOWLIST = path.join(RAIZ, '.github', 'pages', 'allowlist.txt');
// arquivo de verificação do Google não é página
export const PAGINAS = fs.readFileSync(ALLOWLIST, 'utf8').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l.endsWith('.html') && !l.startsWith('google'));

export const nome = (p) => p.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '_') || 'home';

export async function bloquearExterno(page) {
  const bloqueados = new Set();
  await page.route('**/*', (rota) => {
    const host = new URL(rota.request().url()).hostname;
    if (host === '127.0.0.1') return rota.continue();
    bloqueados.add(host);
    return rota.abort('blockedbyclient');
  });
  return bloqueados;
}

export function errosDeConsole(page) {
  const erros = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {   // recurso local que falha é defeito; externo bloqueado não é
    if (new URL(r.url()).hostname === '127.0.0.1') erros.push(`falhou ${r.url()}: ${r.failure()?.errorText}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (m.location()?.url && new URL(m.location().url).hostname !== '127.0.0.1') return;
    if (/Failed to load resource/.test(t)) return;   // a falha local já entra por requestfailed
    if (/ERR_BLOCKED_BY_CLIENT|blockedbyclient/i.test(t)) return;   // efeito do bloqueio externo
    erros.push(t);
  });
  return erros;
}

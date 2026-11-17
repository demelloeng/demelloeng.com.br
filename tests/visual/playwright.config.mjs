// Testes headless do site (CONDUTA §5: só 127.0.0.1, todo domínio externo bloqueado, inclusive analytics).
// SITE_ROOT: pasta servida (padrão: a raiz deste repositório). SNAP_DIR: onde ficam as imagens de referência.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(process.env.SITE_ROOT || path.join(AQUI, '..', '..'));
const PORTA = Number(process.env.PORTA || 8791);
const PY = process.platform === 'win32' ? 'python' : 'python3';
const SNAP = path.resolve(process.env.SNAP_DIR || path.join(AQUI, '.snapshots'));

export default defineConfig({
  testDir: AQUI,
  testMatch: /.*\.spec\.mjs$/,
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  snapshotPathTemplate: `${SNAP.replaceAll('\\', '/')}/{arg}{ext}`,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' } },
  use: { baseURL: `http://127.0.0.1:${PORTA}`, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' },
  webServer: {
    command: `${PY} "${path.join(AQUI, 'servidor.py')}" ${PORTA} "${RAIZ}"`,
    url: `http://127.0.0.1:${PORTA}/index.html`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

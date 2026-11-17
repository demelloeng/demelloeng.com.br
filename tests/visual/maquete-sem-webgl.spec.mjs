// Maquetes V03 sem WebGL: a caixa vira capa com aviso, sem botão que não responde.
import { test, expect } from '@playwright/test';
import { bloquearExterno } from './comum.mjs';

const V03 = ['servicos/projeto-estrutural/index.html', 'servicos/projeto-hidrossanitario/index.html', 'servicos/projeto-prevencao-incendio/index.html'];

test.describe('sem WebGL', () => {
  for (const pagina of V03) {
    test(`sem 3D: ${pagina}`, async ({ page }) => {
      await bloquearExterno(page);
      // navegador sem WebGL, de forma determinística: getContext devolve null para webgl e webgl2
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (tipo, ...r) { return /webgl/i.test(tipo) ? null : original.call(this, tipo, ...r); };
      });
      await page.goto(`/${pagina}`);
      const caixa = page.locator('#caixa');
      await caixa.scrollIntoViewIfNeeded();
      await expect(caixa).toHaveClass(/sem-3d/, { timeout: 30_000 });
      for (const a of ['role', 'tabindex', 'aria-label']) {
        expect(await caixa.getAttribute(a), `${a} deve sair sem 3D`).toBeNull();
      }
      await expect(page.locator('#carregando')).toContainText('não abre a maquete 3D');
    });
  }
});

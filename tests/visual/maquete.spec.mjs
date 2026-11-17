// Maquetes V03 (motor comum): abrir por teclado, foco preso, Escape fecha e o foco volta; sem WebGL, sem botão morto.
import { test, expect } from '@playwright/test';
import { bloquearExterno, errosDeConsole } from './comum.mjs';

const V03 = ['servicos/projeto-estrutural/index.html', 'servicos/projeto-hidrossanitario/index.html'];

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

test.describe.configure({ mode: 'serial' });   // SwiftShader é lento: uma maquete de cada vez

test.describe('com WebGL (SwiftShader)', () => {
  for (const pagina of V03) {
    test(`teclado: ${pagina}`, async ({ page }) => {
      test.setTimeout(150_000);
      await bloquearExterno(page);
      const erros = errosDeConsole(page);
      await page.goto(`/${pagina}`);
      const caixa = page.locator('#caixa');
      await caixa.scrollIntoViewIfNeeded();
      await expect(caixa).not.toHaveClass(/sem-3d/, { timeout: 15_000 });
      // a maquete só abre quando o modelo termina de carregar: tenta Enter até virar diálogo
      await expect(async () => {
        await caixa.focus();
        await page.keyboard.press('Enter');
        await expect(caixa).toHaveAttribute('role', 'dialog', { timeout: 1_500 });
      }).toPass({ timeout: 120_000 });
      await expect(caixa).toHaveAttribute('aria-modal', 'true');
      await expect(page.locator('#fechar')).toBeFocused({ timeout: 5_000 });
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.getElementById('caixa').contains(document.activeElement)), `Tab ${i + 1} fora da maquete`).toBe(true);
      }
      expect(await page.evaluate(() => [...document.body.children].some((el) => el.inert)), 'fundo inerte').toBe(true);
      await page.keyboard.press('Escape');
      await expect(caixa).toHaveAttribute('role', 'button', { timeout: 5_000 });
      await expect(caixa).toBeFocused();
      expect(await page.evaluate(() => [...document.body.children].some((el) => el.inert)), 'fundo volta ao normal').toBe(false);
      expect(erros).toEqual([]);
    });
  }
});

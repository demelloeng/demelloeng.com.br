// Regressão visual das páginas publicadas: a referência sai da base (SITE_ROOT=<base> --update-snapshots) e o PR
// é comparado com ela. Diferença em página que não estava no pedido = mudança não autorizada (perfil DEMELLO).
// Maquete (canvas) e mídia ficam mascaradas: o teste vê a página, não o giro do 3D.
import { test, expect } from '@playwright/test';
import { PAGINAS, nome, bloquearExterno } from './comum.mjs';

const LARGURAS = [390, 1280];

for (const pagina of PAGINAS) {
  for (const largura of LARGURAS) {
    test(`visual: ${pagina} @${largura}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await bloquearExterno(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${pagina}`, { waitUntil: 'load' });
      await page.evaluate(async () => {   // carrega imagens preguiçosas e volta ao topo
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
        window.scrollTo(0, 0);
        await document.fonts.ready;
      });
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`${nome(pagina)}-${largura}.png`, {
        fullPage: true,
        mask: [page.locator('canvas, video, iframe, #palco')],
      });
    });
  }
}

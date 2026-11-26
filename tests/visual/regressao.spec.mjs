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
      // A captura de página inteira estica a janela até a altura do documento. O carrossel de Serviços
      // reage a essa mudança e troca de maquete no meio da captura. Esticar antes e esperar assentar deixa
      // a página no mesmo estado que a captura vai ver: a comparação continua a mesma, só fica estável.
      for (let i = 0; i < 3; i++) {
        const altura = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: largura, height: altura });
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`${nome(pagina)}-${largura}.png`, {
        fullPage: true,
        timeout: 20_000, // página alta com vidro e desfoque demora mais que 5 s para capturar duas vezes
        mask: [page.locator('canvas, video, iframe, #palco')],
      });
    });
  }
}

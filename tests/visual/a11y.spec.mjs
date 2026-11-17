// Acessibilidade e integridade básica das páginas publicadas, a 390 px (celular).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { PAGINAS, bloquearExterno, errosDeConsole } from './comum.mjs';

const CONHECIDOS = JSON.parse(fs.readFileSync(new URL('./conhecidos.json', import.meta.url), 'utf8')).itens;
const conhecido = (pagina, verificacao) => CONHECIDOS.find((c) => c.pagina === pagina && c.verificacao === verificacao);

for (const pagina of PAGINAS) {
  test(`a11y: ${pagina}`, async ({ page }) => {
    const bloqueados = await bloquearExterno(page);
    const erros = errosDeConsole(page);
    const r = await page.goto(`/${pagina}`, { waitUntil: 'load' });
    expect(r.status(), 'resposta').toBe(200);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => {
      const nomeAcessivel = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent
        || [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') || '').trim();
      const visivel = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return {
        lang: document.documentElement.lang,
        h1: document.querySelectorAll('h1').length,
        semAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src')),
        semNome: [...document.querySelectorAll('a[href], button')].filter((el) => visivel(el) && !nomeAcessivel(el))
          .map((el) => el.outerHTML.slice(0, 90)),
      };
    });
    // rolagem lateral persistente: até 8 medidas em ~3 s, vale a menor (transição de carregamento sob carga não conta)
    await page.evaluate(() => document.fonts.ready);
    d.overflow = Infinity;
    for (let i = 0; i < 8 && d.overflow > 1; i++) {
      d.overflow = Math.min(d.overflow, await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
      if (d.overflow > 1) await page.waitForTimeout(400);
    }
    expect(d.lang, 'html[lang]').toBeTruthy();
    expect(d.h1, 'um único h1').toBe(1);
    const c = conhecido(pagina, 'overflow');
    if (c && d.overflow > 1) test.info().annotations.push({ type: 'conformidade atual (não reprova)', description: c.achado });
    else expect(d.overflow, 'rolagem lateral a 390 px').toBeLessThanOrEqual(1);
    expect(d.semAlt, 'imagem sem atributo alt').toEqual([]);
    expect(d.semNome, 'link ou botão sem nome acessível').toEqual([]);
    expect(erros, 'erros no console').toEqual([]);
    test.info().annotations.push({ type: 'externos bloqueados', description: [...bloqueados].join(', ') || 'nenhum' });
  });
}

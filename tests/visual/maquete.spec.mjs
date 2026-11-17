// Maquetes V03 (motor comum; a terraplanagem desde 17/11/2026): abrir por teclado, foco preso, Escape fecha e o foco volta; sem WebGL, sem botão morto.
import { test, expect } from '@playwright/test';
import { bloquearExterno, errosDeConsole } from './comum.mjs';

const V03 = ['servicos/projeto-estrutural/index.html', 'servicos/projeto-hidrossanitario/index.html', 'servicos/projeto-prevencao-incendio/index.html', 'servicos/projeto-terraplenagem/index.html'];

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

// Incêndio V03: o que vem da V02 (lista de componentes, ficha com ações, marcadores) funciona pelo teclado.
test.describe('incêndio V03: componentes, ficha e marcadores', () => {
  test('lista, ficha, Isolar e Escape em dois passos', async ({ page }) => {
    test.setTimeout(150_000);
    await bloquearExterno(page);
    const erros = errosDeConsole(page);
    await page.goto('/servicos/projeto-prevencao-incendio/index.html');
    const caixa = page.locator('#caixa');
    await caixa.scrollIntoViewIfNeeded();
    await expect(async () => {
      await caixa.focus();
      await page.keyboard.press('Enter');
      await expect(caixa).toHaveAttribute('role', 'dialog', { timeout: 1_500 });
    }).toPass({ timeout: 120_000 });
    const lista = page.locator('#componente');
    await expect(lista.locator('option')).toHaveCount(172);   // 171 componentes da V02 + "Escolha um componente…"
    await expect(page.locator('#marcadores .pino')).toHaveCount(6);
    expect(await page.locator('#marcadores .pino').evaluateAll((bs) => bs.every((b) => /^Hidrante/.test(b.getAttribute('aria-label'))))).toBe(true);
    const valor = await lista.locator('option', { hasText: 'Bomba de incêndio' }).first().getAttribute('value');
    await lista.focus();
    await lista.selectOption(valor);
    const ficha = page.locator('#ficha');
    await expect(ficha).toBeVisible();
    await expect(ficha).toHaveAttribute('role', 'status');
    await expect(ficha).toContainText('Bomba de incêndio');
    await expect(ficha).toContainText('Representação ilustrativa');
    const isolar = ficha.locator('[data-acao="isolar"]');
    await isolar.click();
    await expect(isolar).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');   // primeiro Escape: limpa a escolha (e o isolamento), a maquete continua aberta
    await expect(ficha).toBeHidden();
    await expect(caixa).toHaveAttribute('role', 'dialog');
    await expect(lista).toHaveValue('');
    await page.keyboard.press('Escape');   // segundo: fecha, e o foco volta à caixa
    await expect(caixa).toHaveAttribute('role', 'button', { timeout: 5_000 });
    await expect(caixa).toBeFocused();
    expect(erros).toEqual([]);
  });
});

// Terraplanagem V03: o andamento mostra a etapa, a seção e as curvas do natural respondem, e com movimento reduzido
// a maquete já nasce no terreno terraplanado (sem animação).
test.describe('terraplanagem V03: andamento, seção e curvas', () => {
  const PAGINA = '/servicos/projeto-terraplenagem/index.html';
  const abrir = async (page) => {
    const caixa = page.locator('#caixa');
    await caixa.scrollIntoViewIfNeeded();
    await expect(async () => {
      await caixa.focus();
      await page.keyboard.press('Enter');
      await expect(caixa).toHaveAttribute('role', 'dialog', { timeout: 1_500 });
    }).toPass({ timeout: 120_000 });
    return caixa;
  };

  test('andamento com o nome da etapa, Ver a seção e Curvas do natural', async ({ page }) => {
    test.setTimeout(150_000);
    await bloquearExterno(page);
    const erros = errosDeConsole(page);
    await page.goto(PAGINA);
    const caixa = await abrir(page);
    const fase = page.locator('#fase');
    // o deslizador de andamento, como um arraste (o Playwright não preenche input do tipo range)
    const mover = (v) => page.locator('#construir').evaluate((el, x) => { el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await mover('0');
    await expect(fase).toHaveText('Terreno natural');
    await mover('60');
    await expect(fase).toHaveText('Corte e aterro');
    await mover('100');
    await expect(fase).toHaveText('Terreno terraplanado');
    const secao = page.locator('#por-dentro');
    await secao.click();
    await expect(secao).toHaveAttribute('aria-pressed', 'true');
    await expect(secao).toHaveText('Voltar ao conjunto');
    await expect(page.locator('[data-vista="corte"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#faixa-corte')).toBeVisible();
    const curvas = page.locator('#camadas .chip', { hasText: 'Curvas do natural' });
    await expect(curvas).toHaveAttribute('aria-pressed', 'true');
    await curvas.click();
    await expect(curvas).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#camadas .chip')).toHaveText(['Terreno', 'Pisos', 'Corte', 'Aterro', 'Contenções', 'Curvas do natural']);
    await page.keyboard.press('Escape');
    await expect(caixa).toHaveAttribute('role', 'button', { timeout: 5_000 });
    expect(erros).toEqual([]);
  });

  test('movimento reduzido: sem animação, direto no terreno terraplanado', async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bloquearExterno(page);
    const erros = errosDeConsole(page);
    await page.goto(PAGINA);
    await abrir(page);
    await expect(page.locator('#fase')).toHaveText('Terreno terraplanado');
    await expect(page.locator('#construir')).toHaveValue('100');
    await expect(page.locator('#girar')).toHaveAttribute('aria-pressed', 'false');
    expect(erros).toEqual([]);
  });
});

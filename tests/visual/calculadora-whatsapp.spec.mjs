import { test, expect } from '@playwright/test';
import path from 'node:path';

const id = 'SITE-SUB-abcdef012345';
const intake = 'https://ma-demello-site-intake.ma-demello.workers.dev/api/site-intake';
test.describe.configure({mode: 'parallel'});

async function stubExternal(context, {waitForFirst} = {}) {
  const attempts = { submissions: [], whatsapp: [], acquisitions: [] };
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'wa.me') attempts.whatsapp.push(url.href);
    if (url.href === intake && request.method() === 'POST') {
      const { payload } = request.postDataJSON();
      attempts.submissions.push(payload.pricing_preview?.status);
      attempts.acquisitions.push(payload.acquisition);
      const first = attempts.submissions.length === 1;
      if (first && waitForFirst) await waitForFirst;
      return route.fulfill({status: 202, headers: {'access-control-allow-origin': '*'},
                            json: {accepted: true, submission_id: waitForFirst && !first ? 'SITE-SUB-123456abcdef' : id,
                                   state: 'PENDING_PERSIST'}});
    }
    if (url.href === intake && request.method() === 'OPTIONS') {
      return route.fulfill({status: 204, headers: {'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type'}});
    }
    return route.abort('blockedbyclient');
  });
  return attempts;
}

const next = (page) => page.getByRole('button', {name: 'Continuar', exact: true}).click();

async function choose(page, name) {
  await page.getByRole('radio', {name, exact: true}).check();
  await next(page);
}

async function location(page) {
  await page.getByRole('combobox', {name: 'UF', exact: true}).selectOption('PR');
  await page.getByRole('combobox', {name: 'Município'}).fill('Curitiba');
  await page.getByRole('option', {name: 'Curitiba', exact: true}).click();
  await next(page);
}

async function fillContact(page, label) {
  await page.getByLabel('Nome', {exact: true}).fill('Pessoa fictícia');
  await page.getByLabel('E-mail', {exact: true}).fill('pessoa@example.invalid');
  const button = page.getByRole('button', {name: label, exact: true});
  await button.click();
  await expect(page.locator('.result-card.success')).toBeVisible();
}

async function evaluationContact(page, entry = '/orcamento/?situacao=problem') {
  await page.goto(entry);
  await choose(page, 'Preciso de uma avaliação técnica por outro motivo');
  await page.getByLabel('Seu relato').fill('Relato inteiramente fictício para o teste.');
  await next(page);
  await choose(page, 'Casa / sobrado');
  await location(page);
  await choose(page, 'Entender o que está acontecendo');
  await next(page);
  await page.getByRole('button', {name: 'Enviar meu caso para avaliação'}).click();
}

test('F8A: CTA preserva deep link e pedido simulado recebe apenas origem válida', async ({page, context}) => {
  const attempts = await stubExternal(context);
  await page.goto('/servicos/projeto-hidrossanitario/?utm_source=linkedin&utm_medium=social&utm_campaign=e1-teste&utm_content=P01');
  const cta = page.getByRole('link', {name: /Ver a estimativa do meu projeto hidrossanitário/}).first();
  await expect(cta).toHaveAttribute('href', /utm_campaign=e1-teste/);
  const target = new URL(await cta.getAttribute('href'));
  expect([...target.searchParams]).toEqual([
    ['situacao', 'known'], ['servico', 'hidrossanitario'],
    ['utm_source', 'linkedin'], ['utm_medium', 'social'], ['utm_campaign', 'e1-teste'],
  ]);
  await cta.focus();
  await expect(cta).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(target.href);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
  target.searchParams.set('situacao', 'problem');
  target.searchParams.delete('servico');
  await evaluationContact(page, target.href);
  await fillContact(page, 'Enviar meu caso');
  expect(attempts.acquisitions).toEqual([{source: 'linkedin', medium: 'social', campaign: 'e1-teste'}]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
});

for (const width of [1440, 390]) {
  test(`F8A: frase de Privacidade está visível a ${width}px`, async ({page, context}) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 900});
    await stubExternal(context);
    await page.goto('/privacidade/');
    const section = page.getByRole('region', {name: 'Que dados chegam ao site'});
    const sentence = section.getByText('Chegou por link, relaxa. A DEMELLO só guarda de onde você veio.', {exact: true});
    await expect(sentence).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await section.evaluate(element => element.scrollIntoView({block: 'start', behavior: 'instant'}));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const folder = process.env.F8A_EVIDENCE_DIR;
    if (folder) await page.screenshot({path: path.join(folder, `privacidade-${width}.png`), animations: 'disabled'});
  });
}

for (const width of [1440, 390]) {
  test(`caso sem prévia: confirmação, nova aba e medição existente em ${width}px`, async ({page, context}) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 1000});
    const attempts = await stubExternal(context);
    await page.addInitScript(() => {
      window.contactEvents = [];
      window.addEventListener('demello:analytics', (event) => {
        if (event.detail?.name === 'whatsapp_contact_started') window.contactEvents.push(event.detail.params);
      });
    });
    await evaluationContact(page);
    const link = page.getByRole('link', {name: 'Falar agora no WhatsApp'});
    await expect(link).toHaveCount(0);
    await fillContact(page, 'Enviar meu caso');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    const href = new URL(await link.getAttribute('href'));
    expect([...href.searchParams]).toEqual([['text', `Olá. Enviei meu caso pelo site. Código: ${id}.`]]);
    expect(attempts.submissions).toHaveLength(1);
    expect(attempts.submissions[0]).not.toBe('CALCULATED');
    expect(context.pages()).toHaveLength(1);
    expect(attempts.whatsapp).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await link.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
    expect(await link.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    const evidence = process.env.F8B_EVIDENCE_DIR;
    if (evidence) await page.screenshot({path: path.join(evidence, `calculadora-${width}.png`)});
    await link.focus();
    await expect(link).toBeFocused();
    const popup = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    const opened = await popup;
    await expect.poll(() => attempts.whatsapp).toEqual([href.href]);
    await opened.close();
    await expect.poll(() => page.evaluate(() => window.contactEvents)).toEqual([{page: '/orcamento/', placement: 'body'}]);
  });
}

test('confirmação com prévia CALCULATED não mostra a ação do WhatsApp', async ({page, context}) => {
  const attempts = await stubExternal(context);
  await page.goto('/orcamento/?situacao=known&servico=estrutural');
  await next(page);
  await page.getByLabel('Área de projeção (fundações)').fill('100');
  await next(page);
  await choose(page, 'Casa / sobrado');
  await page.locator('#measure').fill('100');
  await next(page);
  await location(page);
  await choose(page, 'Arquitetura pronta');
  await choose(page, 'Ainda sem prazo');
  await next(page);
  await page.getByRole('button', {name: 'Quero receber uma proposta'}).click();
  await fillContact(page, 'Enviar pedido de proposta');
  expect(attempts.submissions).toEqual(['CALCULATED']);
  await expect(page.getByRole('link', {name: 'Falar agora no WhatsApp'})).toHaveCount(0);
  expect(attempts.whatsapp).toEqual([]);
  expect(context.pages()).toHaveLength(1);
});

test('resposta atrasada de outro envio não troca o código da confirmação', async ({page, context}) => {
  let releaseFirst;
  const waitForFirst = new Promise(resolve => { releaseFirst = resolve; });
  const attempts = await stubExternal(context, {waitForFirst});
  try {
    await evaluationContact(page);
    await page.getByLabel('Nome', {exact: true}).fill('Pessoa fictícia');
    await page.getByLabel('E-mail', {exact: true}).fill('pessoa@example.invalid');
    await page.getByRole('button', {name: 'Enviar meu caso', exact: true}).click();
    await expect.poll(() => attempts.submissions.length).toBe(1);
    await page.evaluate(() => window.history.back());
    await page.getByRole('button', {name: 'Enviar meu caso para avaliação'}).click();
    await page.getByLabel('Nome', {exact: true}).fill('Outra pessoa fictícia');
    await page.getByRole('button', {name: 'Enviar meu caso', exact: true}).click();
    const link = page.getByRole('link', {name: 'Falar agora no WhatsApp'});
    await expect(link).toHaveAttribute('href', /SITE-SUB-123456abcdef/);
    const response = page.waitForResponse(async (r) => r.url() === intake
      && r.request().method() === 'POST' && (await r.json()).submission_id === id);
    releaseFirst();
    await response;
    await page.waitForFunction(() => document.querySelector('.result-card.success'));
    await expect(link).toHaveAttribute('href', /SITE-SUB-123456abcdef/);
  } finally {
    releaseFirst();
  }
});

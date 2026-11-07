import assert from 'node:assert/strict';
import './support/catalogo.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildClientSummary, NEXT_STEP } from '../src/client_summary.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const area = (value) => ({ value, unknown: false });

const pages = [
  'index.html',
  'construir-ou-ampliar/index.html',
  'avaliar-um-problema/index.html',
  'empresa/index.html',
  'empresa/trajetoria-do-fundador.html',
  'servicos/index.html',
  'metodologia/index.html',
  'experiencia-tecnica/index.html',
  'contato/index.html',
];

test('home leads with the estimate CTA and keeps the way to "Como trabalhamos"', async () => {
  const html = await readFile(path.join(siteRoot, 'index.html'), 'utf8');
  // primeira dobra comercial: o CTA principal abre a estimativa já na rota "Construir ou ampliar"
  // Home V02: o CTA do hero é "Calcular estimativa" (mesma rota); o caminho para "Como trabalhamos" está no menu principal.
  assert.match(html, /<a class="btn-cta" href="\.\/orcamento\/\?situacao=build">Calcular estimativa<\/a>/i);
  assert.match(html, /<nav class="nav"[\s\S]*?<a href="\.\/metodologia\/">Como trabalhamos<\/a>/i);
  assert.doesNotMatch(html, /Fale com quem assina o projeto/i);
});

test('shared navigation: commercial order, estimate CTA highlighted, Contato and WhatsApp secondary', async () => {
  // Principais, na ordem: Início · Construir ou ampliar · Outros serviços · Experiência · Como trabalhamos · Calcular estimativa.
  // Contato e WhatsApp seguem acessíveis (faixa superior no desktop; dentro do menu no móvel), sem competir com o CTA.
  const expected = ['Início', 'Construir ou ampliar', 'Outros serviços', 'Experiência', 'Como trabalhamos', 'Calcular estimativa', 'Contato', 'WhatsApp'];
  // Páginas V02 (Home, Serviços e Contato): "Início · Serviços · Projetos · Como trabalhamos · Contato · Construir ou ampliar · Calcular estimativa · WhatsApp".
  const expectedV02 = ['Início', 'Serviços', 'Projetos', 'Como trabalhamos', 'Contato', 'Construir ou ampliar', 'Calcular estimativa', 'WhatsApp'];
  for (const page of pages) {
    const html = await readFile(path.join(siteRoot, page), 'utf8');
    const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const labels = [...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((match) => match[1].trim());
    assert.deepEqual(labels, ['index.html', 'servicos/index.html', 'contato/index.html', 'construir-ou-ampliar/index.html', 'avaliar-um-problema/index.html', 'metodologia/index.html', 'experiencia-tecnica/index.html', 'empresa/index.html'].includes(page) ? expectedV02 : expected, page);
    assert.match(nav, /<a class="nav-budget" href="(?:\.\/|(?:\.\.\/)+)orcamento\/"/);
    // O botão novo vem logo antes do orçamento e leva à jornada principal; só as páginas V02 o têm.
    if (['index.html', 'servicos/index.html', 'contato/index.html', 'construir-ou-ampliar/index.html', 'avaliar-um-problema/index.html', 'metodologia/index.html', 'experiencia-tecnica/index.html', 'empresa/index.html'].includes(page)) assert.match(nav, /<a class="nav-build" href="(?:\.\/|(?:\.\.\/)+)construir-ou-ampliar\/"(?: aria-current="page")?>Construir ou ampliar<\/a><a class="nav-budget"/, page);
    assert.match(nav, /<a class="nav-extra nav-whatsapp" href="https:\/\/wa\.me\/5541985124056"/);
  }
});

test('budget CTA animation runs twice and is disabled for reduced motion', async () => {
  const css = await readFile(path.join(siteRoot, 'assets', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.nav-budget\{[^}]*animation:budget-cta-entry [^;}]* 2[;}]/);
  assert.match(css, /@keyframes budget-cta-entry\{0%,100%\{transform:scale\(1\)\}50%\{transform:scale\(1\.04\)\}\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.nav-budget\{animation:none\}\}/);
});

test('client download is a human UTF-8 text summary and keeps payload generation internal', async () => {
  const app = await readFile(path.join(appRoot, 'src', 'GlobalApp.jsx'), 'utf8');
  assert.match(app, /packageForCRMv2\(answers\)/);
  assert.match(app, /buildClientSummary\(payload\)/);
  assert.match(app, /text\/plain;charset=utf-8/);
  assert.match(app, /demello-resumo-do-seu-caso\.txt/);
  assert.match(app, /Baixar resumo do seu caso/i);
  assert.doesNotMatch(app, /JSON\.stringify\(packageForCRMv2/);
  assert.doesNotMatch(app, /demello-caso-v2\.json|Baixar caso estruturado/i);
});

test('human summary contains only friendly case, price and applicable reference data', () => {
  const payload = packageForCRMv2({
    route: 'known',
    services: ['Fundações'],
    property: 'Comercial',
    S3: area('1500'),
    area_fundacao: area('1500'),
    location: { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' },
    contact: { name: 'Cliente Teste', whatsapp: '41999999999', email: '' },
  });
  const text = buildClientSummary(payload);

  assert.match(text, /DEMELLO ENGENHARIA\nRESUMO DO SEU CASO/);
  assert.match(text, /SERVIÇOS\nFundações/);
  assert.match(text, /ESTIMATIVA INICIAL DEMELLO\nR\$ 12\.876,00/);
  assert.match(text, /REFERÊNCIAS\nSECID\/PR — Fundações: R\$ 16\.095,00/);
  assert.doesNotMatch(text, /AltoQi/);
  assert.match(text, /Nome: Cliente Teste/);
  assert.match(text, new RegExp(NEXT_STEP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(text, /schema|source|prototype|sent_to_crm|answers|pricing_inputs|q_basis|q_inputs|pricing_context|structural_system_default_used|base_reference|unrounded_total/i);
});

test('active experience does not promise automatic contact', async () => {
  const app = await readFile(path.join(appRoot, 'src', 'GlobalApp.jsx'), 'utf8');
  const summaryModule = await readFile(path.join(appRoot, 'src', 'client_summary.mjs'), 'utf8');
  assert.match(summaryModule, /Para avançar, entre em contato com a DEMELLO/);
  assert.match(app, /NEXT_STEP/);
  assert.doesNotMatch(app, />Entraremos em contato|>Iremos verificar/);
  // capture-first consent copy - transparent about the send, never overclaims the CRM
  assert.match(app, /você envia estes dados e as respostas do seu caso para a DEMELLO Engenharia/);
  assert.match(app, /Recebemos as informações do seu caso/);
  assert.doesNotMatch(app, /registramos seu caso no CRM|proposta enviada/i);
});

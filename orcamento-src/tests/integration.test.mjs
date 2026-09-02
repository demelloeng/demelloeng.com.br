import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const routeRoot = path.join(siteRoot, 'orcamento');

test('production route keeps the approved local-only behavior', async () => {
  const app = await readFile(path.join(appRoot, 'src', 'GlobalApp.jsx'), 'utf8');
  const payload = await readFile(path.join(appRoot, 'src', 'payload_v2.mjs'), 'utf8');

  assert.match(app, /const mode='preview'/);
  assert.doesNotMatch(app, /setMode|Controles de demonstração|CRM simulado/);
  assert.match(app, /Nada é enviado automaticamente/);
  assert.match(payload, /schema:\s*'site-intake\/payload\/2'/);
  assert.match(payload, /V2_SOURCE\s*=\s*'DEMELLO_SITE'/);
  assert.match(payload, /source:\s*V2_SOURCE/);
  assert.match(payload, /prototype:\s*false/);
  assert.match(payload, /sent_to_crm:\s*false/);
  assert.doesNotMatch(payload, /\bproposal_value\s*:/);
});

test('built /orcamento route is self-contained and indexable', async () => {
  const html = await readFile(path.join(routeRoot, 'index.html'), 'utf8');
  const files = await readdir(path.join(routeRoot, 'assets'));
  const bundleName = files.find((name) => /^index-.*\.js$/.test(name));

  assert.match(html, /https:\/\/demelloeng\.com\.br\/orcamento\//);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.match(html, /\/orcamento\/assets\/index-.*\.js/);
  assert.ok(bundleName, 'compiled JavaScript bundle is missing');

  const bundle = await readFile(path.join(routeRoot, 'assets', bundleName), 'utf8');
  assert.match(bundle, /site-intake\/payload\/2/);
  assert.match(bundle, /DEMELLO_SITE/);
  assert.match(bundle, /Previsão inicial DEMELLO/);
  assert.doesNotMatch(bundle, /CRM simulado|Controles de demonstração/);
});

test('site navigation and sitemap expose /orcamento without changing the domain', async () => {
  const pages = [
    'index.html',
    'empresa/index.html',
    'empresa/trajetoria-do-fundador.html',
    'servicos/index.html',
    'metodologia/index.html',
    'experiencia-tecnica/index.html',
    'contato/index.html',
  ];

  for (const page of pages) {
    const html = await readFile(path.join(siteRoot, page), 'utf8');
    assert.match(html, /href="(?:\.\.\/|\.\/)orcamento\/"/);
  }

  assert.equal((await readFile(path.join(siteRoot, 'CNAME'), 'utf8')).trim(), 'demelloeng.com.br');
  assert.match(await readFile(path.join(siteRoot, 'sitemap.xml'), 'utf8'), /https:\/\/demelloeng\.com\.br\/orcamento\//);
});

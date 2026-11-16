// R07 (HANDOFF_OPUS_R4_V03): perfis de teste e produção isolados; nenhum código ou endereço de teste se torna público.
// Estrutural, não convenção: (1) o modo `teste` escreve FORA de ../orcamento, numa pasta fora da allowlist do Pages e
// ignorada pelo Git; (2) o publish-guard bloqueia qualquer pacote com endereço local ou sem TLS e exige os endereços de
// produção compilados; (3) o pacote versionado em ../orcamento passa no guard (o CI o confere antes de publicar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import viteConfig, { TESTE_OUT_DIR } from '../vite.config.mjs';
import { bundleProblems, guard, PRODUCTION_VERIFY_BASE } from '../scripts/publish-guard.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const PROD = { intake: 'https://ma-demello-site-intake.ma-demello.workers.dev/api/site-intake',
  preview: 'https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1' };
const prodBundle = `fetch("${PROD.intake}");fetch("${PROD.preview}");const v="${PRODUCTION_VERIFY_BASE}";createElementNS("http://www.w3.org/2000/svg")`;
const envOf = async (name) => readFile(path.join(appRoot, name), 'utf8');
const val = (text, key) => (text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, 'm')) || [])[1] ?? null;

test('R07 guard: pacote de produção passa; endereço local, sem TLS ou endereço de produção ausente bloqueiam', () => {
  assert.deepEqual(bundleProblems(prodBundle, PROD), [], 'namespaces do W3C não são endereço de envio');
  for (const local of ['http://127.0.0.1:8797/api/previews/v1', 'http://localhost:5173/x', 'http://0.0.0.0:8788']) {
    const p = bundleProblems(prodBundle + `;fetch("${local}")`, PROD);
    assert.ok(p.some((m) => /local address/.test(m)), local);
    assert.ok(p.some((m) => /non-https/.test(m)), local);
  }
  assert.ok(bundleProblems(prodBundle + ';fetch("http://exemplo.com/a")', PROD).some((m) => /non-https/.test(m)));
  assert.ok(bundleProblems(prodBundle.replace(PROD.preview, 'x'), PROD).some((m) => /VITE_PREVIEW_ENDPOINT .* not baked/.test(m)));
  assert.ok(bundleProblems(prodBundle.replace(PRODUCTION_VERIFY_BASE, 'x'), PROD).some((m) => /VERIFY_BASE .* not baked/.test(m)));
  assert.deepEqual(bundleProblems('', PROD), ['no built bundle found (orcamento/assets/*.js)']);
});

test('R07 perfis: produção escreve em ../orcamento; teste escreve fora da allowlist e do Git', async () => {
  assert.equal(viteConfig({ mode: 'production' }).build.outDir, '../orcamento');
  assert.equal(viteConfig({}).build.outDir, '../orcamento');
  assert.equal(viteConfig({ mode: 'teste' }).build.outDir, TESTE_OUT_DIR);
  const rel = path.relative(siteRoot, path.resolve(appRoot, TESTE_OUT_DIR)).split(path.sep).join('/');
  assert.equal(rel, 'docs/prototipos/calculadora-v05-r4/teste/app/orcamento');
  const allow = (await readFile(path.join(siteRoot, '.github', 'pages', 'allowlist.txt'), 'utf8'))
    .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const entry of allow) {
    const prefix = entry.replace(/\*\*$/, '');
    assert.ok(!rel.startsWith(prefix) && !prefix.startsWith('docs/'), `allowlist não publica ${entry}`);
  }
  const ignore = await readFile(path.join(siteRoot, '.gitignore'), 'utf8');
  assert.match(ignore, /^\/docs\/prototipos\/calculadora-v05-r4\/teste\/app\/\r?$/m);
  assert.match(ignore, /^\/docs\/prototipos\/calculadora-v05-r4\/teste\/run\/\r?$/m);
});

test('R07 perfis: .env.teste só fala com 127.0.0.1; .env.production só com produção e não redefine o destino do QR', async () => {
  const teste = await envOf('.env.teste');
  for (const key of ['VITE_PREVIEW_ENDPOINT', 'VITE_VERIFY_BASE', 'VITE_INTAKE_ENDPOINT']) {
    assert.match(val(teste, key) || '', /^http:\/\/127\.0\.0\.1:\d+\//, key);
  }
  assert.doesNotMatch(teste, /workers\.dev|demelloeng\.com\.br/, 'teste nunca aponta para a nuvem nem para o site');
  const prod = await envOf('.env.production');
  assert.equal(val(prod, 'VITE_PREVIEW_ENDPOINT'), PROD.preview);
  assert.equal(val(prod, 'VITE_INTAKE_ENDPOINT'), PROD.intake);
  assert.doesNotMatch(prod, /127\.0\.0\.1|localhost/);
  assert.ok([null, PRODUCTION_VERIFY_BASE].includes(val(prod, 'VITE_VERIFY_BASE')));
  assert.ok((await guard({ envText: prod.replace(/^(\s*VITE_VERIFY_BASE\s*=).*$/m, '') + '\nVITE_VERIFY_BASE=http://127.0.0.1:8796/verificar/\n',
    assetsDir: path.join(siteRoot, 'orcamento', 'assets') })).some((m) => /VITE_VERIFY_BASE must be/.test(m)));
});

test('R07 pacote publicado: ../orcamento passa no guard (sem endereço local nem de teste)', async () => {
  const prod = await envOf('.env.production');
  assert.deepEqual(await guard({ envText: prod, assetsDir: path.join(siteRoot, 'orcamento', 'assets') }), []);
});

test('R07 verificar local: a página publicada tem exatamente um endereço da prévia (o servidor de teste troca só ele)', async () => {
  const html = await readFile(path.join(siteRoot, 'verificar', 'index.html'), 'utf8');
  assert.equal(html.split('https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1/').length - 1, 1);
});

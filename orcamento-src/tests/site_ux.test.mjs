// Frente UX comercial (IT112/114/115/117) — estrutura + estados editoriais + invariantes.
// Cobre: H1 aplicado, exatamente 4 entradas, catálogo de 9 serviços com página própria
// (slugs canônicos; nenhum slug fora do conjunto), HIDDEN honesto (sem case/prova/depoimento/FAQ
// falsos), CTA só para destinos reais, e nenhuma alteração de árvore/rotas/payload/pricing do intake.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const read = (p) => readFile(path.join(siteRoot, p), 'utf8');
const readSrc = (p) => readFile(path.join(appRoot, 'src', p), 'utf8');

// Nomes públicos aprovados (H1). SERVICE_ID permanece inalterado.
const H1_NAMES = [
  'Projeto estrutural',
  'Projeto hidrossanitário',
  'prevenção contra incêndio',
  'Projeto de gás / GLP',
  'Projeto de arquitetura',
  'Regularização',
  'Orçamento técnico',
  'Projeto de terraplenagem',
  'Compatibilização BIM',
];

// Slugs canônicos das nove páginas individuais de serviço (sob /servicos/). Congelado.
const SERVICE_SLUGS = [
  'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-prevencao-incendio',
  'projeto-gas-glp', 'projeto-arquitetura', 'regularizacao',
  'orcamento-tecnico', 'projeto-terraplenagem', 'compatibilizacao-bim',
];

const INTERNAL_HREF_WHITELIST = new Set([
  './', '../', './orcamento/', '../orcamento/', './servicos/', '../servicos/',
  './empresa/', '../empresa/', './metodologia/', '../metodologia/',
  './experiencia-tecnica/', '../experiencia-tecnica/', './contato/', '../contato/',
  './trajetoria-do-fundador.html', '#conteudo', '#site-nav',
  ...SERVICE_SLUGS.flatMap((s) => [`./${s}/`, `./servicos/${s}/`]), // /servicos/ e HOME -> páginas individuais das nove frentes
]);
const EXTERNAL_HREF_ALLOWED = [
  /^https:\/\/wa\.me\/5541985124056$/,
  /^mailto:marcos@demelloeng\.com\.br$/,
  /^tel:\+55\d{10,11}$/,
  /^https:\/\/www\.instagram\.com\/demelloeng\/$/,
  /^https:\/\/www\.linkedin\.com\/company\/demello-engenharia\/$/,
  /^https:\/\/www\.educacao\.pr\.gov\.br\//,
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
  /^https:\/\/unpkg\.com\/three@/,
  /^https:\/\/demelloeng\.com\.br\//, // canonical / og:image do próprio domínio
];

function bodyAnchorHrefs(html) {
  const body = (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '') + (html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? '');
  return [...body.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
}

test('HOME: exatamente quatro entradas de situação, todas para /orcamento/', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="situation-entry"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco situation-entry presente');
  const cards = [...block.matchAll(/<a class="card" href="([^"]+)">/g)].map((m) => m[1]);
  assert.equal(cards.length, 4, 'quatro cards');
  assert.ok(cards.every((h) => h === './orcamento/'), 'todos apontam para ./orcamento/');
  // rótulos vêm da própria jornada (journey.routes)
  for (const label of ['Construir ou ampliar', 'Regularizar meu imóvel', 'Avaliar um problema', 'Já sei o serviço']) {
    assert.ok(block.includes(label), `rótulo de rota: ${label}`);
  }
});

test('HOME: catálogo de nove frentes, cada uma com link para a página individual', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="service-summary"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco service-summary presente');
  assert.equal([...block.matchAll(/<div class="row">/g)].length, 9, 'nove frentes');
  assert.ok(block.includes('href="./servicos/"'), 'link do catálogo /servicos/ preservado');
  // cada nome de frente enlaça a sua página individual sob /servicos/<slug>/
  for (const s of SERVICE_SLUGS) {
    assert.match(block, new RegExp(`<span class="row-t"><a href="\\./servicos/${s}/">`), `frente enlaça ./servicos/${s}/`);
  }
  const linked = [...block.matchAll(/href="\.\/servicos\/([a-z-]+)\/"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(linked)].sort(), [...SERVICE_SLUGS].sort(), 'somente os nove slugs canônicos');
});

test('SERVIÇOS: nove serviços, H1, destino /orcamento/, sem lista de entregáveis universal', async () => {
  const html = await read('servicos/index.html');
  const block = html.match(/<section[^>]*data-block="service-summary"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco service-summary presente');
  assert.equal([...block.matchAll(/<div class="bleed-row">/g)].length, 9, 'nove serviços');
  for (const name of H1_NAMES) assert.ok(html.includes(name), `nome público H1: ${name}`);
  assert.match(html, /href="\.\.\/orcamento\/"[^>]*>Faça seu orçamento/, 'CTA para /orcamento/');
  assert.doesNotMatch(block, /<ul\b|<ol\b/, 'sem lista de entregáveis renderizada');
  assert.doesNotMatch(block, /O que (normalmente )?faz parte|entregáveis|entregamos|você recebe/i,
    'sem promessa de entregável universal');
  // cada frente enlaça a sua página individual; nada além dos nove slugs canônicos
  for (const s of SERVICE_SLUGS) {
    assert.match(block, new RegExp(`<h2><a href="\\./${s}/">`), `frente enlaça ./${s}/`);
  }
  const linked = [...block.matchAll(/<h2><a href="\.\/([a-z-]+)\/">/g)].map((m) => m[1]);
  assert.deepEqual(linked.sort(), [...SERVICE_SLUGS].sort(), 'somente os nove slugs canônicos');
  assert.doesNotMatch(html, /href="\.\.\/servicos\/[a-z-]+\/?"/, 'nenhum slug de serviço absoluto inventado');
});

test('nove páginas individuais de serviço existem, com H1 único e CTA canônica para /orcamento/', async () => {
  for (const slug of SERVICE_SLUGS) {
    const html = await read(`servicos/${slug}/index.html`);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
    assert.equal(h1s.length, 1, `${slug}: H1 único`);
    assert.match(html, /<link rel="canonical" href="https:\/\/demelloeng\.com\.br\/servicos\/[a-z-]+\/">/, `${slug}: canonical`);
    assert.match(html, /href="\.\.\/\.\.\/orcamento\/"[^>]*>Conte o que você precisa →<\/a>/, `${slug}: CTA canônica`);
    // as nove páginas de serviço não reabrem números/afirmações fora da copy congelada
    assert.doesNotMatch(html, /R\$ ?8[.,]3|8,3 milh|Acervo Público|60 ARTs/i, `${slug}: sem número proibido`);
  }
});

test('estados HIDDEN honestos: sem case, depoimento, prova sem contexto ou FAQ sem resposta', async () => {
  for (const p of ['index.html', 'servicos/index.html']) {
    const html = await read(p);
    assert.doesNotMatch(html, /data-block="(case-card|testimonial|contextual-faq)"/, `${p}: sem bloco oculto renderizado`);
    assert.doesNotMatch(html, /class="testimonial"|blockquote[^>]*data-|depoimento de cliente/i, `${p}: sem depoimento`);
    // nenhum marcador editorial interno vaza para o público
    assert.doesNotMatch(html, /CONTENT_READY|CONTENT_PARTIAL|NO_EVIDENCE|NOT_APPLICABLE|\bHIDDEN\b/, `${p}: sem marcador interno`);
  }
});

test('preview-explainer distingue prévia de proposta sem prometer preço', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="preview-explainer"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco preview-explainer presente');
  assert.match(block, /não é proposta, contrato nem garantia de preço/);
  assert.match(block, /receber o caso não é aceite comercial/);
  assert.doesNotMatch(block, /proposta enviada|preço garantido|melhor preço|economia de/i);
});

test('CTA / rotas: nenhum href inventado nas páginas alteradas', async () => {
  for (const p of ['index.html', 'servicos/index.html']) {
    const html = await read(p);
    for (const h of bodyAnchorHrefs(html)) {
      if (INTERNAL_HREF_WHITELIST.has(h)) continue;
      if (EXTERNAL_HREF_ALLOWED.some((re) => re.test(h))) continue;
      assert.fail(`${p}: href fora da whitelist / possível slug inventado -> ${h}`);
    }
  }
});

test('navegação compartilhada permanece com os oito itens congelados', async () => {
  const expected = ['Início', 'Orçamento', 'Serviços', 'Empresa', 'Metodologia', 'Experiência', 'Contato', 'WhatsApp'];
  for (const p of ['index.html', 'servicos/index.html']) {
    const html = await read(p);
    const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const labels = [...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim());
    assert.deepEqual(labels, expected, p);
  }
});

test('INVARIANTES do intake: 4 rotas, 9 SERVICE_IDs, árvore/pricing/payload intactos, REG_A2=0 preservado', async () => {
  const journey = await readSrc('journey.mjs');
  const routesLine = journey.match(/export const routes=\{([^}]*)\}/)?.[1] ?? '';
  const routeKeys = [...routesLine.matchAll(/(\w+):/g)].map((m) => m[1]);
  assert.deepEqual(routeKeys, ['build', 'regularize', 'problem', 'known'], 'exatamente quatro rotas');
  assert.match(journey, /ZERO_VALID_AREA_NODES=new Set\(\['REG_A2'\]\)/, 'patch REG_A2 preservado');

  const table = JSON.parse(await readSrc('pricing/pricing-table.v1.json'));
  assert.deepEqual(Object.keys(table.services).sort(), [
    'ARQUITETURA', 'COMPATIBILIZACAO', 'ESTRUTURAL', 'GAS_GLP', 'HIDROSSANITARIO',
    'INCENDIO', 'ORCAMENTO', 'REGULARIZACAO', 'TERRAPLENAGEM',
  ], 'nove SERVICE_IDs na tabela de preço');

  const payload = await readSrc('payload_v2.mjs');
  assert.match(payload, /schema:\s*'site-intake\/payload\/2'/);
  assert.match(payload, /V2_SOURCE\s*=\s*'DEMELLO_SITE'/);
  assert.doesNotMatch(payload, /\bproposal_value\s*:/);
  const flow = await readSrc('flow.mjs');
  assert.match(flow, /allowZero\s*=\s*false/, 'area() mantém default > 0');
});

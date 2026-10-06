// Frente UX comercial — estrutura + estados editoriais + invariantes.
// Atualizado para a ARQUITETURA COMERCIAL (situação → orientação → estimativa → prova → proposta):
//  - HOME: primeira dobra com um único CTA; situações (eixo construir/ampliar + alternativas);
//  - catálogo de nove frentes preservado, agora em "Outros serviços" (distribuidor de intenções);
//  - nove páginas de serviço com CTA específico; nenhuma alteração de árvore/rotas/payload/pricing do intake.
// Os testes de links, nav, sitemap e metadados de TODAS as páginas estão em commercial_site.test.mjs.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const read = (p) => readFile(path.join(siteRoot, p), 'utf8');
const exists = (p) => access(path.join(siteRoot, p)).then(() => true, () => false);
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

test('HOME: primeira dobra faz só três coisas (situação, promessa, primeiro clique) e não traz conteúdo institucional', async () => {
  const html = await read('index.html');
  const hero = html.match(/<section[^>]*data-block="situation-entry"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(hero, 'bloco situation-entry presente');
  assert.match(hero, /<h1[^>]*>Vai construir ou ampliar\?<\/h1>/);
  assert.match(hero, /Descubra quais projetos sua obra pode precisar e veja uma estimativa inicial\./);
  assert.match(hero, /<a class="btn-cta" href="\.\/orcamento\/\?situacao=build">Calcular minha estimativa/);
  assert.match(hero, /Sem compromisso · contato somente no final/);
  assert.equal([...hero.matchAll(/<a\b/g)].length, 1, 'um único link (o CTA) na primeira dobra');
  // fora da primeira dobra: disciplinas, BIM, ARTs, histórico, municípios, institucional
  assert.doesNotMatch(hero, /BIM|ART|munic[ií]pio|estrutural|hidrossanit|inc[êe]ndio|g[áa]s|anos|fundad|empresa/i, 'sem conteúdo institucional/técnico na hero');
});

test('HOME (visual V2): quatro cartões de situação com ícone; "Já sei o serviço" lista as nove frentes; apoio técnico é link secundário', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="situations"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco situations presente');
  const main = [...block.matchAll(/<a class="sit-main" href="([^"]+)">\s*<img class="sit-ico"[^>]*>\s*<h3>([^<]+)<\/h3>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(main, [
    ['Construir uma casa', './construir-ou-ampliar/#construir'],
    ['Ampliar ou reformar', './construir-ou-ampliar/#ampliar'],
    ['Regularizar um imóvel', './servicos/regularizacao/'],
    ['Avaliar um problema', './avaliar-um-problema/'],
  ], 'quatro situações, destinos preservados');
  assert.match(block, /<span class="sit-go">Quero construir →<\/span>/, 'CTA do cartão construir');
  assert.match(block, /<span class="sit-go">Quero ampliar ou reformar →<\/span>/, 'CTA do cartão ampliar');
  assert.doesNotMatch(block, /Ver regularização|Começar avaliação/, 'nenhum texto novo nos cartões');
  assert.match(block, /<p class="sit-support">[^<]*<a href="\.\/orcamento\/\?situacao=support">Consultoria e mentoria técnica<\/a>/, 'apoio técnico preservado como link secundário');
  const direct = html.match(/<section[^>]*data-block="services-direct"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(direct, /<p class="eyebrow">Já sei o serviço<\/p>/, 'rótulo "Já sei o serviço" preservado');
  assert.match(direct, /Vá direto ao projeto ou serviço de que precisa\./, 'frase original preservada');
  const links = [...direct.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => [m[2], m[1]]);
  assert.equal(links.length, 9, 'nove frentes');
  const svcPage = await read('servicos/index.html');
  for (const [name, href] of links) {
    assert.ok(await exists(href.replace('./', '') + 'index.html'), `destino existe: ${href}`);
    assert.ok(svcPage.includes(name), `nome exato presente em /servicos/: ${name}`);
  }
});

test('HOME: seções posteriores exigidas (insegurança, prova, benefícios, funcionamento, experiência, FAQ, CTA final)', async () => {
  const html = await read('index.html');
  for (const block of ['preview-explainer', 'reassurance', 'benefits', 'technical-proof', 'selected-experience', 'faq']) {
    assert.match(html, new RegExp(`data-block="${block}"`), `bloco ${block}`);
  }
  assert.match(html, /<details>/, 'FAQ com <details>');
  const finalCta = html.slice(html.lastIndexOf('class="cta-band"'));
  assert.match(finalCta, /href="\.\/orcamento\/\?situacao=build">Calcular minha estimativa/);
});

test('HOME: catálogo de nove frentes não é mais a porta de entrada; nove frentes vivem em /servicos/ (Outros serviços)', async () => {
  const home = await read('index.html');
  assert.doesNotMatch(home, /data-block="service-summary"/, 'a home não repete o catálogo de nove frentes');
  assert.match(home, /href="\.\/servicos\/"/, 'a home ainda conduz a /servicos/');
});

test('OUTROS SERVIÇOS: nove frentes, H1, resultado primeiro, limites preservados, conduz às landings', async () => {
  const html = await read('servicos/index.html');
  const block = html.match(/<section[^>]*data-block="service-summary"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco service-summary presente');
  assert.equal([...block.matchAll(/<div class="svc-item">/g)].length, 9, 'nove serviços');
  for (const name of H1_NAMES) assert.ok(html.includes(name), `nome público H1: ${name}`);
  for (const s of SERVICE_SLUGS) {
    assert.match(block, new RegExp(`<h3><a href="\\./${s}/">`), `frente enlaça ./${s}/`);
  }
  const linked = [...block.matchAll(/<h3><a href="\.\/([a-z-]+)\/">/g)].map((m) => m[1]);
  assert.deepEqual(linked.sort(), [...SERVICE_SLUGS].sort(), 'somente os nove slugs canônicos');
  // cada frente carrega o seu limite técnico/contratual
  assert.equal([...block.matchAll(/<span class="svc-limit">/g)].length, 9, 'um limite por frente');
  assert.match(block, /Não inclui execução da obra\./);
  assert.match(block, /A DEMELLO não executa movimentação de terra\./);
  assert.match(block, /não garante aprovação pelo órgão competente/);
  assert.match(block, /Sem promessa de aprovação automática/);
  assert.match(block, /Não promete o custo final da obra/);
  assert.doesNotMatch(block, /<ul\b|<ol\b/, 'sem lista de entregáveis renderizada');
  assert.doesNotMatch(block, /O que (normalmente )?faz parte|entregáveis|entregamos|você recebe/i, 'sem promessa de entregável universal');
  // não é a principal porta de entrada: aponta primeiro para as rotas por situação
  const routes = html.match(/<section[^>]*data-block="routes"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(routes, /construir-ou-ampliar\//);
  assert.match(routes, /avaliar-um-problema\//);
  assert.match(routes, /href="\.\/regularizacao\/"/);
  assert.match(routes, /orcamento\/\?situacao=support/);
  assert.ok(html.indexOf('data-block="service-summary"') < html.indexOf('data-block="routes"'), 'quem já sabe o serviço vê o catálogo primeiro; as rotas por situação vêm depois, como rede de segurança');
  assert.doesNotMatch(html, /href="\.\.\/servicos\/[a-z-]+\/?"/, 'nenhum slug de serviço absoluto inventado');
});

test('nove páginas individuais: H1 único, canonical, hero com CTA específico e seções exigidas', async () => {
  const CTA = {
    'projeto-estrutural': ['Ver uma estimativa para meu projeto', 'known&amp;servico=estrutural'],
    'projeto-hidrossanitario': ['Calcular estimativa do meu projeto', 'known&amp;servico=hidrossanitario'],
    'projeto-prevencao-incendio': ['Avaliar meu projeto', 'known&amp;servico=incendio'],
    'projeto-gas-glp': ['Avaliar meu projeto', 'known&amp;servico=gas-glp'],
    'projeto-arquitetura': ['Descrever meu projeto de arquitetura', 'known&amp;servico=arquitetura'],
    regularizacao: ['Entender o que meu imóvel precisa', 'regularize'],
    'orcamento-tecnico': ['Descrever o orçamento que preciso', 'known&amp;servico=orcamento-tecnico'],
    'projeto-terraplenagem': ['Descrever meu projeto de terraplenagem', 'known&amp;servico=terraplenagem'],
    'compatibilizacao-bim': ['Avaliar a compatibilização do meu projeto', 'known&amp;servico=compatibilizacao'],
  };
  for (const slug of SERVICE_SLUGS) {
    const html = await read(`servicos/${slug}/index.html`);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
    assert.equal(h1s.length, 1, `${slug}: H1 único`);
    assert.match(html, /<link rel="canonical" href="https:\/\/demelloeng\.com\.br\/servicos\/[a-z-]+\/">/, `${slug}: canonical`);
    const [label, query] = CTA[slug];
    const cta = new RegExp(`<a class="btn-cta" href="\\.\\./\\.\\./orcamento/\\?situacao=${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">${label}`);
    assert.match(html, cta, `${slug}: CTA específico no hero`);
    assert.equal([...html.matchAll(new RegExp(`>${label}<svg`, 'g'))].length, 2, `${slug}: o mesmo CTA no hero e no fechamento`);
    assert.doesNotMatch(html, /Conte o que você precisa/, `${slug}: sem o CTA genérico antigo`);
    for (const h2 of ['Para quem é', 'Entregáveis', 'O que muda para você', 'Como funciona', 'Prova técnica', 'Escopo e limites', 'Próximo passo']) {
      assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
    }
    // as nove páginas de serviço não reabrem números/afirmações fora da copy congelada
    assert.doesNotMatch(html, /R\$ ?8[.,]3|8,3 milh|Acervo Público|60 ARTs/i, `${slug}: sem número proibido`);
  }
});

test('estados HIDDEN honestos: sem depoimento, prova sem contexto ou marcador interno', async () => {
  for (const p of ['index.html', 'servicos/index.html', 'construir-ou-ampliar/index.html', 'avaliar-um-problema/index.html', 'metodologia/index.html', 'experiencia-tecnica/index.html']) {
    const html = await read(p);
    assert.doesNotMatch(html, /data-block="(testimonial|contextual-faq)"/, `${p}: sem bloco oculto renderizado`);
    assert.doesNotMatch(html, /class="testimonial"|depoimento de cliente/i, `${p}: sem depoimento`);
    // nenhum marcador editorial interno vaza para o público
    assert.doesNotMatch(html, /CONTENT_READY|CONTENT_PARTIAL|NO_EVIDENCE|NOT_APPLICABLE|\bHIDDEN\b/, `${p}: sem marcador interno`);
  }
});

test('preview-explainer distingue estimativa de proposta sem prometer preço', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="preview-explainer"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco preview-explainer presente');
  assert.match(block, /não é proposta, contrato nem garantia de preço/);
  assert.match(block, /receber o caso não é aceite comercial/);
  assert.match(block, /só pedimos o seu contato|contato só é pedido|Só então pedimos/i, 'contato depois do valor entregue');
  assert.doesNotMatch(block, /proposta enviada|preço garantido|melhor preço|economia de/i);
});

test('INVARIANTES do intake: 4 rotas originais + entrada de apoio técnico, 9 SERVICE_IDs, árvore/pricing/payload intactos, REG_A2=0 preservado', async () => {
  const journey = await readSrc('journey.mjs');
  const routesLine = journey.match(/export const routes=\{([^}]*)\}/)?.[1] ?? '';
  const routeKeys = [...routesLine.matchAll(/(\w+):/g)].map((m) => m[1]);
  // A 5a entrada ("Preciso de orientação ou apoio técnico") foi APROVADA por Marcos; as 4 rotas originais seguem intactas e em ordem.
  assert.deepEqual(routeKeys, ['build', 'regularize', 'problem', 'known', 'support'], 'quatro rotas originais + apoio técnico');
  assert.match(journey, /ZERO_VALID_AREA_NODES=new Set\(\['REG_A2'\]\)/, 'patch REG_A2 preservado');

  const table = JSON.parse(await readSrc('pricing/pricing-table.v2.json'));
  assert.deepEqual(Object.keys(table.services).sort(), [
    'ARQUITETURA', 'COMPATIBILIZACAO', 'CONSULTORIA_TECNICA', 'ESTRUTURAL', 'GAS_GLP', 'HIDROSSANITARIO',
    'INCENDIO', 'MENTORIA_TECNICA', 'ORCAMENTO', 'REGULARIZACAO', 'TERRAPLENAGEM',
  ], 'nove SERVICE_IDs originais + CONSULTORIA_TECNICA/MENTORIA_TECNICA na tabela V2');

  const payload = await readSrc('payload_v2.mjs');
  assert.match(payload, /schema:\s*'site-intake\/payload\/2'/);
  assert.match(payload, /V2_SOURCE\s*=\s*'DEMELLO_SITE'/);
  assert.doesNotMatch(payload, /\bproposal_value\s*:/);
  const flow = await readSrc('flow.mjs');
  assert.match(flow, /allowZero\s*=\s*false/, 'area() mantém default > 0');
});

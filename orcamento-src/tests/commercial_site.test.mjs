// Site estático — validações automatizadas da arquitetura comercial (sem navegador):
// links internos, âncoras, deep links, sitemap, robots, canonical, metadados, semântica, texto sem JavaScript,
// terminologia, números/atribuições (nada inventado), consistência do pipeline (allowlist, bundle, testes).
// NÃO VERIFICADO VISUALMENTE: nada aqui renderiza páginas; só inspeciona os arquivos.
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SERVICE_DEEPLINKS, routeFromSearch, serviceFromSearch } from '../src/deeplink.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const ORIGIN = 'https://demelloeng.com.br';
const read = (p) => readFile(path.join(siteRoot, p), 'utf8');
const exists = (p) => access(path.join(siteRoot, p)).then(() => true, () => false);

const SERVICE_SLUGS = [
  'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-prevencao-incendio', 'projeto-gas-glp', 'projeto-arquitetura',
  'regularizacao', 'orcamento-tecnico', 'projeto-terraplenagem', 'compatibilizacao-bim',
];
const COMMERCIAL = [
  'index.html', 'construir-ou-ampliar/index.html', 'avaliar-um-problema/index.html', 'servicos/index.html',
  ...SERVICE_SLUGS.map((s) => `servicos/${s}/index.html`),
  'metodologia/index.html', 'experiencia-tecnica/index.html', 'contato/index.html',
];
const OTHER = ['empresa/index.html', 'empresa/trajetoria-do-fundador.html', 'privacidade/index.html', 'verificar/index.html'];
const ALL = [...COMMERCIAL, ...OTHER];
const INDEXABLE = ALL.filter((p) => p !== 'verificar/index.html');
// Páginas no visual V02 (menu e rodapé novos). As páginas antigas ficam fora deste conjunto.
const PAGINAS_V02 = [
  'index.html', 'servicos/index.html', 'contato/index.html', 'construir-ou-ampliar/index.html',
  ...['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem', 'projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao'].map((s) => `servicos/${s}/index.html`),
];

const pageUrl = (file) => `${ORIGIN}/${file.replace(/index\.html$/, '')}`;
const HTML = Object.fromEntries(await Promise.all(ALL.map(async (p) => [p, await read(p)])));

const decode = (s) => s.replaceAll('&amp;', '&');
const visibleText = (html) => html
  .replace(/<head>[\s\S]*?<\/head>/, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&(?:amp|nbsp|[a-z]+);/g, ' ').replace(/\s+/g, ' ').trim();
const mainOf = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';

const EXTERNAL_ALLOWED = [
  /^https:\/\/wa\.me\/5541985124056$/, /^mailto:marcos@demelloeng\.com\.br$/, /^tel:\+55\d{10,11}$/,
  /^https:\/\/www\.instagram\.com\/demelloeng\/$/, /^https:\/\/www\.linkedin\.com\/company\/demello-engenharia\/$/,
  /^https:\/\/www\.facebook\.com\/demelloeng\/$/,   // Contato V02 (IT039): Facebook oficial, URL personalizada confirmada pelo proprietário
  /^https:\/\/www\.educacao\.pr\.gov\.br\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/, /^https:\/\/unpkg\.com\/three@/,
  // Arquitetura V11: matérias de imprensa citadas na página (scripts/importar-copy-servico-v02.py, IMPRENSA). URLs exatas, não domínios.
  /^https:\/\/www\.instagram\.com\/reel\/DZpkXZBOcjA\/$/,
  /^https:\/\/www\.bemparana\.com\.br\/noticias\/parana\/colegio-civico-militar-da-grande-curitiba-cria-528-novas-vagas-apos-obra-de-ampliacao\/$/,
  /^https:\/\/www\.folhadecampolargo\.com\.br\/noticia\/56187\/ccm-djalma-marinho-recebe-investimento-historico-de-r-83-mil$/,
];

// ---- links --------------------------------------------------------------------------------------------------------
function references(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|link|script|img|video|source)\b[^>]*?\b(href|src|srcset)="([^"]+)"/g)) out.push({ tag: m[1], attr: m[2], value: decode(m[3]) });
  return out;
}

test('links: todo href/src interno resolve para um arquivo existente; externos só os permitidos', async () => {
  let internal = 0;
  for (const file of ALL) {
    for (const { tag, attr, value } of references(HTML[file])) {
      if (value.startsWith('#')) continue;
      if (/^(mailto:|tel:)/.test(value)) { assert.ok(EXTERNAL_ALLOWED.some((re) => re.test(value)), `${file}: ${value}`); continue; }
      if (/^https?:\/\//.test(value)) {
        if (value.startsWith(ORIGIN + '/')) { /* canonical / og:image do próprio domínio: resolvido abaixo */ }
        else { assert.ok(EXTERNAL_ALLOWED.some((re) => re.test(value)), `${file}: link externo fora da lista -> ${value}`); continue; }
      }
      const url = new URL(attr === 'srcset' ? value.split(/\s+/)[0] : value, pageUrl(file));
      assert.equal(url.origin, ORIGIN, `${file}: ${value}`);
      let rel = decodeURIComponent(url.pathname).replace(/^\//, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      assert.ok(await exists(rel), `${file}: <${tag} ${attr}="${value}"> -> ${rel} não existe`);
      internal += 1;
    }
  }
  assert.ok(internal > 300, `links internos verificados: ${internal}`);
});

test('links: âncoras entre páginas apontam para ids que existem', async () => {
  const idsOf = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  let checked = 0;
  for (const file of ALL) {
    for (const { tag, attr, value } of references(HTML[file])) {
      if (tag !== 'a' || attr !== 'href' || !value.includes('#') || /^https?:|^mailto:|^tel:/.test(value)) continue;
      const url = new URL(value, pageUrl(file));
      let rel = url.pathname.replace(/^\//, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const target = HTML[rel] ?? (await read(rel));
      assert.ok(idsOf(target).has(url.hash.slice(1)), `${file}: âncora ${value} inexistente em ${rel}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 3, `âncoras verificadas: ${checked}`);
  assert.ok(HTML['construir-ou-ampliar/index.html'].includes('id="construir"') && HTML['construir-ou-ampliar/index.html'].includes('id="ampliar"'));
});

test('deep links: todo link para /orcamento/ com query usa situação e disciplina VÁLIDAS (nada fora da tabela)', () => {
  const seen = new Set();
  for (const file of ALL) {
    for (const { tag, attr, value } of references(HTML[file])) {
      if (tag !== 'a' || attr !== 'href' || !/orcamento\/\?/.test(value)) continue;
      const url = new URL(value, pageUrl(file));
      assert.equal(url.pathname, '/orcamento/', `${file}: ${value}`);
      const keys = [...url.searchParams.keys()].sort();
      assert.ok(keys.every((k) => ['situacao', 'servico'].includes(k)), `${file}: parâmetros inesperados ${keys}`);
      assert.notEqual(routeFromSearch(url.search), null, `${file}: situacao inválida em ${value}`);
      if (url.searchParams.has('servico')) {
        assert.equal(url.searchParams.get('situacao'), 'known', `${file}: servico exige situacao=known`);
        assert.notEqual(serviceFromSearch(url.search), null, `${file}: servico inválido em ${value}`);
      }
      seen.add(`${url.searchParams.get('situacao')}|${url.searchParams.get('servico') ?? ''}`);
    }
  }
  // cobertura: cada disciplina com deep link por servico é usada por uma página; regularização usa a rota exclusiva
  for (const key of Object.keys(SERVICE_DEEPLINKS)) {
    if (key === 'regularizacao' || key === 'terraplenagem') continue;   // regularização usa rota exclusiva; Infraestrutura não leva estimativa (decisão 97)
    assert.ok(seen.has(`known|${key}`), `nenhuma página usa o deep link da disciplina ${key}`);
  }
  for (const route of ['build', 'regularize', 'problem', 'support', 'known']) assert.ok(seen.has(`${route}|`), `rota ${route}`);
});

test('landings: CTAs abrem DIRETAMENTE a rota correspondente da estimativa', () => {
  const build = HTML['construir-ou-ampliar/index.html'];
  const problem = HTML['avaliar-um-problema/index.html'];
  assert.equal([...build.matchAll(/href="\.\.\/orcamento\/\?situacao=build">Calcular minha estimativa/g)].length, 2, 'hero + fechamento');
  assert.equal([...problem.matchAll(/href="\.\.\/orcamento\/\?situacao=problem">Descrever meu caso/g)].length, 2, 'hero + fechamento');
  assert.doesNotMatch(build, /situacao=(?!build)/);
  assert.doesNotMatch(problem, /situacao=(?!problem)/);
  assert.match(HTML['servicos/regularizacao/index.html'], /href="\.\.\/\.\.\/orcamento\/\?situacao=regularize">Entender o que meu imóvel precisa/);
});

// ---- SEO / metadados ----------------------------------------------------------------------------------------------
test('metadados: title, description, canonical, Open Graph e idioma em todas as páginas', async () => {
  const titles = new Set();
  for (const file of ALL) {
    const html = HTML[file];
    assert.match(html, /^<!doctype html>\s*<html lang="pt-BR">/i, file);   // as páginas V02 geradas usam <!doctype html> em minúsculas
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/, file);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title && title.length >= 12 && title.length <= 78, `${file}: title (${title?.length})`);
    assert.ok(!titles.has(title), `${file}: title duplicado`);
    titles.add(title);
    const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(desc && desc.length >= 60 && desc.length <= 200, `${file}: description (${desc?.length})`);
    assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], pageUrl(file), `${file}: canonical`);
    if (INDEXABLE.includes(file)) {
      assert.ok(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1], `${file}: og:title`);
      assert.ok(html.match(/<meta property="og:description" content="([^"]+)"/)?.[1], `${file}: og:description`);
    }
    if (COMMERCIAL.includes(file)) {
      assert.equal(html.match(/<meta property="og:title" content="([^"]+)"/)[1], title, `${file}: og:title = title`);
      assert.equal(html.match(/<meta property="og:description" content="([^"]+)"/)[1], desc, `${file}: og:description = description`);
    }
    if (INDEXABLE.includes(file)) {
      assert.match(html, /<meta property="og:type" content="website">/, file);
      assert.match(html, /<meta property="og:locale" content="pt_BR">/, file);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? '';
      assert.ok(ogImage.startsWith(`${ORIGIN}/assets/images/`), `${file}: og:image fora de /assets/images/`);
      assert.ok(await exists(ogImage.slice(ORIGIN.length + 1)), `${file}: og:image aponta para arquivo inexistente (${ogImage})`);
      if (file !== 'index.html') assert.equal(ogImage, `${ORIGIN}/assets/images/logo.png`, `${file}: og:image`);   // só a Home V02 tem imagem de compartilhamento própria
    }
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    if (ogUrl) assert.equal(ogUrl, pageUrl(file), `${file}: og:url`);
    assert.equal(/name="robots" content="noindex/.test(html), file === 'verificar/index.html', `${file}: noindex só em /verificar/`);
  }
  for (const file of COMMERCIAL) assert.match(HTML[file], /<meta property="og:url"/, `${file}: og:url nas páginas comerciais`);
});

test('/orcamento/: título, descrição e canonical da experiência (código-fonte e página publicada)', async () => {
  for (const p of ['orcamento/index.html', 'orcamento-src/index.html']) {
    const html = await read(p);
    assert.match(html, /<title>Calcular estimativa \| DEMELLO Engenharia<\/title>/, p);
    assert.match(html, /<link rel="canonical" href="https:\/\/demelloeng\.com\.br\/orcamento\/" \/>/, p);
    assert.match(html, /name="robots" content="index, follow"/, p);
    assert.doesNotMatch(html, /Faça seu orçamento|previsão inicial/i, p);
  }
});

test('sitemap: exatamente as páginas indexáveis, sem duplicidade, com URL canônica', async () => {
  const xml = await read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'sem duplicatas');
  const expected = [...INDEXABLE.map(pageUrl), `${ORIGIN}/orcamento/`].sort();
  assert.deepEqual([...locs].sort(), expected);
  for (const loc of locs) assert.ok(loc.startsWith(ORIGIN + '/'), loc);
  assert.ok(locs.includes(`${ORIGIN}/construir-ou-ampliar/`) && locs.includes(`${ORIGIN}/avaliar-um-problema/`), 'novas páginas comerciais');
  assert.ok(!locs.some((l) => l.includes('verificar')), '/verificar/ é noindex e não entra');
});

test('robots.txt: permite rastreamento, aponta o sitemap e não bloqueia deliberadamente nenhum crawler', async () => {
  const robots = await read('robots.txt');
  assert.match(robots, /^User-agent: \*\s*$/m);
  assert.match(robots, /^Allow: \/\s*$/m);
  assert.match(robots, /^Sitemap: https:\/\/demelloeng\.com\.br\/sitemap\.xml\s*$/m);
  assert.doesNotMatch(robots, /^\s*Disallow:\s*\S/m, 'nenhum Disallow');
  assert.doesNotMatch(robots, /OAI-AdsBot|OAI-SearchBot|GPTBot|ChatGPT-User|Googlebot|bingbot/i, 'sem regra específica por crawler');
});

// ---- semântica / acessibilidade ----------------------------------------------------------------------------------
test('HTML semântico: um H1, landmarks, hierarquia de títulos sem saltos, imagens com alt, skip link, nav rotulada', () => {
  for (const file of ALL) {
    const html = HTML[file];
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${file}: H1 único`);
    assert.equal([...html.matchAll(/<main\b/g)].length, 1, `${file}: <main>`);
    assert.match(html, /<main id="conteudo">/, file);
    assert.match(html, /<a class="skip" href="#conteudo">/, file);
    assert.match(html, /<header class="site-header">[\s\S]*<nav class="nav" id="site-nav" aria-label="Principal">/, file);
    assert.match(html, /<button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">/, file);
    assert.match(html, /<footer class="site-footer(?: [a-z-]+)*">/, file);   // as páginas V02 usam "site-footer rodape"
    for (const img of html.matchAll(/<img\b[^>]*>/g)) assert.match(img[0], /\balt="/, `${file}: img sem alt -> ${img[0].slice(0, 60)}`);
    const levels = [...mainOf(html).matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    if (COMMERCIAL.includes(file)) {
      assert.equal(levels[0], 1, `${file}: o primeiro título do <main> é o H1`);
      for (let i = 1; i < levels.length; i += 1) assert.ok(levels[i] <= levels[i - 1] + 1, `${file}: salto de título h${levels[i - 1]} -> h${levels[i]}`);
    }
    // texto visível mínimo sem depender de JavaScript
    if (COMMERCIAL.includes(file)) assert.ok(visibleText(mainOf(html)).split(' ').length >= (file === 'contato/index.html' ? 60 : 120), `${file}: conteúdo textual estático insuficiente`);
  }
});

test('rodapé: as seis páginas lançadas (Home, Serviços e as quatro de projeto) e o Contato e o Construir ou ampliar V02 têm o mesmo rodapé', () => {
  // Resolve href/src relativos para caminhos do site, para comparar o bloco sem depender da profundidade da página.
  const normaliza = (file, html) => {
    const rodape = html.match(/<footer[\s\S]*?<\/footer>/)[0].replace(/\r\n/g, '\n');   // o fim de linha dos arquivos varia (CRLF e LF)
    const dir = path.posix.dirname(`/${file}`);
    return rodape.replace(/(href|src)="([^"]+)"/g, (m, attr, v) => (/^(?:[a-z]+:|#)/i.test(v) ? m : `${attr}="${path.posix.join(dir, v)}"`));
  };
  const LANCADAS = ['index.html', 'servicos/index.html', ...['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem', 'projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao'].map((s) => `servicos/${s}/index.html`), 'contato/index.html', 'construir-ou-ampliar/index.html'];
  const referencia = normaliza(LANCADAS[2], HTML[LANCADAS[2]]);
  assert.match(referencia, /rodape-grade/, 'a referência é o rodapé rico das páginas de projeto');
  for (const file of LANCADAS) assert.equal(normaliza(file, HTML[file]), referencia, `${file}: rodapé diferente do das páginas de projeto`);
});

test('menu V02: mesmos itens, ordem e destinos em todas as páginas V02; "Construir ou ampliar" logo antes do orçamento', () => {
  // Resolve href relativos para caminhos do site e ignora espaços entre tags; o item atual (aria-current) é a única diferença permitida.
  const normaliza = (file, html) => {
    const nav = html.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0].replace(/\r\n/g, '\n').replace(/ aria-current="page"/g, '').replace(/>\s+</g, '><');
    const dir = path.posix.dirname(`/${file}`);
    return nav.replace(/href="([^"]+)"/g, (m, v) => (/^(?:[a-z]+:|#)/i.test(v) ? m : `href="${path.posix.join(dir, v)}"`));
  };
  const referencia = normaliza(PAGINAS_V02[0], HTML[PAGINAS_V02[0]]);
  assert.match(referencia, /<a class="nav-build" href="\/construir-ou-ampliar\/">Construir ou ampliar<\/a><a class="nav-budget" href="\/orcamento\/">Calcular estimativa<\/a>/);
  for (const file of PAGINAS_V02) assert.equal(normaliza(file, HTML[file]), referencia, `${file}: menu diferente do das demais páginas V02`);
});

test('rodapé V02: Facebook oficial entre Instagram e LinkedIn, no mesmo padrão dos links sociais', () => {
  const ig = '<a href="https://www.instagram.com/demelloeng/" target="_blank" rel="noopener">Instagram</a>';
  const fb = '<a href="https://www.facebook.com/demelloeng/" target="_blank" rel="noopener">Facebook</a>';
  const li = '<a href="https://www.linkedin.com/company/demello-engenharia/" target="_blank" rel="noopener">LinkedIn</a>';
  for (const file of PAGINAS_V02) {
    const rodape = HTML[file].match(/<footer[\s\S]*?<\/footer>/)[0].replace(/\r\n/g, '\n');
    assert.equal([...rodape.matchAll(/facebook\.com/g)].length, 1, `${file}: um único link do Facebook no rodapé`);
    assert.ok(rodape.includes(ig + fb + li), `${file}: ordem Instagram → Facebook → LinkedIn`);
  }
});

test('navegação: item atual marcado com aria-current na página correspondente', () => {
  const current = (file) => [...(HTML[file].match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] ?? '').matchAll(/<a[^>]*aria-current="page"[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(current('index.html'), ['Início']);
  assert.deepEqual(current('construir-ou-ampliar/index.html'), ['Construir ou ampliar']);
  // Páginas V02 (Serviços e as quatro de projeto com copy nova): o item atual do menu é "Serviços". As demais seguem com "Outros serviços".
  const V02_SERVICES = new Set(['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem', 'projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao']);
  assert.deepEqual(current('servicos/index.html'), ['Serviços']);
  for (const s of SERVICE_SLUGS) assert.deepEqual(current(`servicos/${s}/index.html`), V02_SERVICES.has(s) ? ['Serviços'] : ['Outros serviços'], s);
  assert.deepEqual(current('experiencia-tecnica/index.html'), ['Experiência']);
  assert.deepEqual(current('metodologia/index.html'), ['Como trabalhamos']);
  assert.deepEqual(current('contato/index.html'), ['Contato']);
});

test('navegação: "Empresa" deixa de ser eixo principal, mas a página e as URLs antigas continuam existindo e linkadas', async () => {
  for (const file of ALL) {
    const nav = HTML[file].match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
    assert.doesNotMatch(nav, />Empresa</, `${file}: Empresa fora da navegação principal`);
    assert.match(HTML[file].match(/<footer[\s\S]*<\/footer>/)[0], /href="(?:\.\/|(?:\.\.\/)+)empresa\/">Empresa</, `${file}: Empresa no rodapé`);
  }
  // URLs antigas preservadas (nenhuma foi removida)
  for (const p of ['empresa/index.html', 'empresa/trajetoria-do-fundador.html', 'servicos/index.html', 'metodologia/index.html', 'experiencia-tecnica/index.html', 'contato/index.html', 'orcamento/index.html', 'verificar/index.html']) {
    assert.ok(await exists(p), p);
  }
  assert.match(HTML['metodologia/index.html'], /href="\.\.\/empresa\/">Conheça a empresa<\/a>/, 'a função de Empresa foi absorvida por Como trabalhamos (responsabilidade técnica)');
});

// ---- conteúdo ---------------------------------------------------------------------------------------------------
test('promessa de contato: toda página com CTA de estimativa diz que o contato só vem no final', () => {
  // Infraestrutura (terraplanagem) não leva estimativa (decisão 97): o CTA vai a /contato/ e não há promessa de "contato só no final".
  for (const file of ['construir-ou-ampliar/index.html', 'avaliar-um-problema/index.html', 'metodologia/index.html', ...SERVICE_SLUGS.filter((s) => s !== 'projeto-terraplenagem').map((s) => `servicos/${s}/index.html`)]) {
    assert.match(HTML[file], /Sem compromisso · contato somente no final/, file);
  }
  assert.doesNotMatch(mainOf(HTML['servicos/projeto-terraplenagem/index.html']), /orcamento\/\?/, 'Infraestrutura não abre a estimativa');
  // Home V02: a seção da estimativa foi reescrita; a promessa equivalente é que nada é enviado sem confirmação.
  assert.match(HTML['index.html'], /Nada é enviado sem a sua confirmação\./, 'Home V02: nada é enviado sem confirmação');
  for (const file of COMMERCIAL) assert.doesNotMatch(visibleText(mainOf(HTML[file])), /entraremos em contato (agora|imediatamente)|ligamos em|retornamos em \d/i, file);
});

test('terminologia: "estimativa" é o termo da oferta; "previsão/prévia/Faça seu orçamento" não aparecem nas páginas', () => {
  for (const file of ALL.filter((f) => f !== 'verificar/index.html')) {
    const text = visibleText(HTML[file]);
    assert.doesNotMatch(text, /\bprévia\b|\bprevisão\b|faça seu orçamento/i, `${file}: termo antigo`);
  }
  // "orçamento técnico" = serviço contratado; nunca confundido com a estimativa
  assert.match(visibleText(HTML['servicos/orcamento-tecnico/index.html']), /diferente da estimativa|Orçamento técnico ≠ estimativa/i);
  assert.match(visibleText(HTML['servicos/index.html']), /diferente da estimativa deste site/);
  // estimativa nunca é apresentada como proposta, contrato ou garantia
  for (const file of ['index.html', 'construir-ou-ampliar/index.html']) assert.match(visibleText(HTML[file]), /não é proposta, contrato nem garantia de preço/i, file);   // Home V02: "Não é proposta…" no início da frase
});

test('referências obsoletas: sem "quatro entradas" e sem TABELA V1 em nenhum texto servido (páginas, código-fonte e bundle)', async () => {
  const files = [...ALL.map((f) => path.join(siteRoot, f))];
  const walk = async (dir) => {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'tests') out.push(...await walk(p)); } else if (/\.(mjs|jsx|js|html|css|md)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  files.push(...await walk(path.join(appRoot, 'src')));
  files.push(...await walk(path.join(siteRoot, 'orcamento')));
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    assert.doesNotMatch(text, /quatro (entradas|situações|rotas|opções|cards)/i, `${path.relative(siteRoot, f)}: contagem obsoleta`);
    assert.doesNotMatch(text, /TABELA(?: DEMELLO)? V1\b/, `${path.relative(siteRoot, f)}: TABELA V1`);
  }
  const bundleDir = path.join(siteRoot, 'orcamento/assets');
  const bundle = (await readdir(bundleDir)).find((n) => /^index-.*\.js$/.test(n));
  const js = await readFile(path.join(bundleDir, bundle), 'utf8');
  for (const must of [' entradas e responda apenas às perguntas', 'TABELA DEMELLO V2', 'Quero receber uma proposta', 'Tenho uma dúvida sobre o escopo', 'ESTIMATIVA INICIAL DEMELLO', 'CALCULAR ESTIMATIVA']) {
    assert.ok(js.includes(must), `bundle desatualizado: falta "${must}" (rebuild do orcamento-src)`);
  }
  assert.ok(js.includes('cinco'), 'bundle com "cinco entradas"');
  assert.doesNotMatch(js, /quatro entradas|FAÇA SEU ORÇAMENTO|PREVISÃO DEMELLO"\}|Cálculo offline pela TABELA V2/);
});

test('experiência: um único case documentado, estruturado e com a proveniência preservada', () => {
  const html = HTML['experiencia-tecnica/index.html'];
  const cases = [...html.matchAll(/data-block="case-card"/g)].length;
  assert.equal(cases, 1, 'um case');
  for (const h of ['Situação', 'Trabalho desenvolvido', 'Resultado ou entrega', 'Disciplinas']) assert.ok(html.includes(`<h3>${h}</h3>`), h);
  assert.match(html, /Único case documentado disponível até o momento/);
  assert.match(html, /em atuação anterior à DEMELLO Engenharia/);
  assert.match(html, /Não correspondem ao acervo operacional próprio do CNPJ atual/);
  assert.match(html, /Quantitativos vinculados ao acervo profissional de Marcos de Mello Silva/);
  assert.ok(html.indexOf('data-block="case-card"') < html.indexOf('data-block="technical-proof"'), 'case antes dos números');
  // disciplinas só como informação complementar (lista), depois de situação/trabalho/resultado
  assert.ok(html.indexOf('<h3>Disciplinas</h3>') > html.indexOf('<h3>Resultado ou entrega</h3>'));
  // personalidade da marca preservada, em citação atribuída
  assert.match(html, /<blockquote class="case-quote">[\s\S]*Todo em BIM\. Meu projeto mais querido\.[\s\S]*<cite>Marcos de Mello Silva<\/cite>/);
});

test('proveniência: a prova técnica continua atribuída ao acervo profissional do responsável técnico, nunca ao CNPJ', () => {
  // Páginas V02 (Home e as quatro de projeto): a ressalva sobre o CNPJ foi retirada por decisão de Marcos (29/10/2026; "acervo é do profissional").
  // A invariante continua: o dado é atribuído ao acervo profissional de Marcos de Mello Silva, nunca à empresa.
  for (const [file, re] of [
    ['index.html', /Acervo profissional de Marcos de Mello Silva, fundador da DEMELLO Engenharia\./],
    ['index.html', /Esses dados descrevem a trajetória profissional do fundador\./],
    ['construir-ou-ampliar/index.html', /Acervo profissional de Marcos de Mello Silva\./],   // V02: a ressalva sobre o CNPJ saiu, como nas demais páginas V02 (Voz V07)
    ['servicos/projeto-estrutural/index.html', /O acervo profissional de Marcos de Mello Silva reúne 67\.762 m² de experiência técnica estrutural documentada/],
    ['servicos/projeto-hidrossanitario/index.html', /O acervo profissional de Marcos de Mello Silva registra 42\.789 m² de experiência técnica hidrossanitária documentada/],
    ['servicos/projeto-gas-glp/index.html', /O acervo profissional de Marcos de Mello Silva registra:/],
    ['servicos/projeto-arquitetura/index.html', /O acervo profissional de Marcos de Mello Silva registra 4\.981 m² de experiência técnica arquitetônica documentada/],
    ['servicos/projeto-prevencao-incendio/index.html', /registra 12\.879 m² de experiência técnica em prevenção contra incêndio/],
    ['servicos/projeto-terraplenagem/index.html', /O acervo profissional de Marcos de Mello Silva registra:/],
    ['servicos/projeto-terraplenagem/index.html', /4\.959 m³/],
  ]) assert.match(HTML[file], re, file);
  for (const slug of ['projeto-estrutural', 'projeto-hidrossanitario', 'projeto-arquitetura', 'projeto-terraplenagem']) assert.doesNotMatch(HTML[`servicos/${slug}/index.html`], /acervo (?:operacional )?(?:da|do) (?:DEMELLO|CNPJ|empresa)/i, `${slug}: acervo atribuído à empresa`);
  assert.doesNotMatch(HTML['construir-ou-ampliar/index.html'], /acervo (?:operacional )?(?:da|do) (?:DEMELLO|CNPJ|empresa)/i, 'construir-ou-ampliar: acervo atribuído à empresa');
  // A manchete de imprensa da Arquitetura V11 ("... R$ 8,3 milhões ...") é título de terceiro, com veículo e link; fora desse bloco o valor continua proibido.
  const semImprensa = (html) => html.replace(/<div class="rico-imprensa">[\s\S]*?<\/div>/, '');
  for (const slug of SERVICE_SLUGS) assert.doesNotMatch(semImprensa(HTML[`servicos/${slug}/index.html`]), /R\$ ?8[.,]3|8,3 milh|Acervo Público|60 ARTs/i, slug);
});

// Todo número que aparece em texto visível precisa existir no conteúdo original do site (ou ser dado de segurança pública / limite da própria interface).
const NUMERIC_FACTS = new Set([
  // numeração de etapas
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '1', '2', '6',
  // acervo profissional do responsável técnico (conteúdo original)
  '60', '23', '12', '16', '528', '55', '8,3', '67.762', '42.789', '12.879', '4.487', '26', '9.451', '4.981', '4.959', '2.447', '2.512',
  // identificação legal / contato (rodapé e contato, conteúdo original)
  '65.613.230/0001-71', '92585', '146906', '41', '98512-4056', '44', '99820-2552', '2026', '010/2026',
  // endereço da sede, no rodapé das páginas V02 (fonte: docs/arquivo/servicos-v01-20261028/conteudo.json e scripts/gerar-paginas-servico-v02.py)
  '730', '80010-020',
  // trajetória do fundador (conteúdo original)
  '15', '22', '80', '120', '2010', '2014', '2018', '2019', '2020', '2022', '2023', '2024',
  // limites já existentes na interface do /orcamento/ (relato de até 600 caracteres)
  '600',
  // telefones públicos de emergência (orientação de segurança; NÃO é dado da DEMELLO) — ver docs, item INFERIDO
  '193', '199',
]);

// Numerais que só valem em UMA página, cada um com a fonte conferida (nada é liberado para o site inteiro).
const PAGE_FACTS = {
  // Maquete Luiz Carlos V02 aceita (b52e32d): 171 IDs; 100% é estado do controle.
  'servicos/projeto-prevencao-incendio/index.html': ['171', '100'],
  // referências de preço da tabela DEMELLO V2: Resolução SECID/PR e Credenciamento Fundepar (orcamento-src/src/pricing/pricing-table.v2.json; journey.mjs)
  'index.html': ['009/2026', '001/2025'],
  // data das matérias de imprensa citadas (scripts/importar-copy-servico-v02.py, IMPRENSA, aprovadas na Arquitetura V11)
  'servicos/projeto-arquitetura/index.html': ['16/06/2026'],
  // especificação da maquete e área do projeto estrutural: docs/arquivo/paginas-servico-v02/copy/COPY_ESTRUTURAL_V06_20261030.md (aprovada)
  'servicos/projeto-estrutural/index.html': ['3', '9', '40', '100', '300', '7,50', '4,60', '3,00', '1.200', '2.500', '34,5', '1,1', '4.856,55'],
  // rótulo do botão da maquete ("Construir 100%"): estado da interface, não afirmação
  'servicos/projeto-hidrossanitario/index.html': ['100'],
  // indicador de andamento da maquete ("Andamento 0%"): estado da interface, não afirmação
  'servicos/projeto-terraplenagem/index.html': ['0'],
};

test('nenhum número técnico, case ou credencial novo: todo numeral visível existe no conteúdo original (ou é limite/segurança documentado)', () => {
  const unexpected = [];
  // A política de privacidade traz só referências legais (Lei 13.709/2018, art. 7º, V) e "3D"; ela é conferida em privacy_and_sink.test.mjs.
  for (const file of ALL.filter((f) => f !== 'verificar/index.html' && f !== 'privacidade/index.html')) {
    // "3D" é notação de dimensão, não quantidade
    for (const m of visibleText(HTML[file]).replace(/\b3D\b/g, ' ').matchAll(/\d[\d.,/-]*\d|\d/g)) if (!NUMERIC_FACTS.has(m[0]) && !(PAGE_FACTS[file] ?? []).includes(m[0])) unexpected.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(unexpected, []);
  // quantidade de disciplinas/etapas descritas por extenso continua batendo com a estrutura
  assert.equal([...HTML['metodologia/index.html'].matchAll(/<div class="step">/g)].length, 6, 'seis etapas');
  // Serviços V02: um <article class="service"> por frente
  assert.equal([...HTML['servicos/index.html'].matchAll(/<article class="service"[\s\S]*?<h3><a href="\.\/[a-z-]+\/">/g)].length, 8, 'oito cartões comerciais; nove URLs de serviço');
});

test('Como trabalhamos: as seis etapas pedidas, nesta ordem; BIM aparece como método, não como abertura', () => {
  const html = HTML['metodologia/index.html'];
  const titles = [...html.matchAll(/<div class="step"><span class="step-n">\d\d<\/span><div class="step-in"><h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Compreensão da necessidade', 'Definição do escopo', 'Desenvolvimento', 'Compatibilização', 'Documentação e entrega', 'Responsabilidade técnica']);
  assert.match(html, /<h1[^>]*>Como será trabalhar com a DEMELLO\?<\/h1>/);
  const hero = html.slice(html.indexOf('<main'), html.indexOf('data-block="steps"'));
  assert.doesNotMatch(hero, /BIM/, 'a abertura não trata BIM como protagonista isolado');
  const bim = html.match(/data-block="bim-method"[\s\S]*?<\/section>/)[0];
  for (const t of ['Coordenação', 'Antecipação de conflitos', 'Organização', 'Compatibilização']) assert.ok(bim.includes(`<strong>${t}:</strong>`), t);
  assert.match(html, /href="\.\.\/orcamento\/">Calcular minha estimativa/, 'CTA de retorno à estimativa');
});

test('Avaliar um problema: reconhecimento, enquadramento, limites, segurança sem diagnóstico remoto e regras de retenção preservadas', async () => {
  const html = HTML['avaliar-um-problema/index.html'];
  for (const b of ['landing-hero', 'situations', 'safety', 'framing', 'limits', 'faq']) assert.match(html, new RegExp(`data-block="${b}"`), b);
  const text = visibleText(mainOf(html));
  assert.match(text, /não existe diagnóstico remoto|sem diagnóstico remoto/i);
  assert.match(text, /não confirmam a segurança do imóvel/);
  assert.match(text, /fissura ou rachadura/);
  assert.match(text, /antes de comprar ou vender/);
  assert.match(text, /nenhum valor é calculado a partir d/i);
  // a regra de retenção continua no código da jornada, intacta
  const journey = await readFile(path.join(appRoot, 'src/journey.mjs'), 'utf8');
  assert.match(journey, /desab\|colapso\|desmoron\|caindo\|caiu\|soltando\|cedendo\|aumentou\|aumentando\|piorou\|rapida\|de repente/);
  const app = await readFile(path.join(appRoot, 'src/GlobalApp.jsx'), 'utf8');
  assert.match(app, /Esse caso precisa de avaliação antes de uma estimativa\./);
  assert.match(app, /Esta interface não confirma a segurança do imóvel\./);
});

// ---- pipeline (allowlist / bundle / testes) -----------------------------------------------------------------------
test('pipeline: toda página e script novos estão na allowlist; nenhum arquivo proibido é referenciado', async () => {
  const allow = (await read('.github/pages/allowlist.txt')).split(/\r?\n/).map((l) => l.split('#')[0].trim()).filter(Boolean);
  const exact = allow.filter((l) => !l.includes('*'));
  for (const p of [...ALL, 'assets/js/analytics.mjs', 'assets/js/site-analytics.mjs', 'sitemap.xml', 'robots.txt', 'orcamento/index.html']) assert.ok(exact.includes(p), `allowlist sem ${p}`);
  for (const p of exact) assert.ok(await exists(p), `allowlist aponta para arquivo inexistente: ${p}`);
  for (const file of ALL) for (const { value } of references(HTML[file])) assert.doesNotMatch(value, /case-padrepedro|logo-empilhada|orcamento-src/, `${file}: referência a arquivo fora do artefato`);
});

test('pipeline: build_artifact.py aponta para o bundle e o CSS realmente publicados em /orcamento/', async () => {
  const py = await read('.github/pages/build_artifact.py');
  const bundle = py.match(/RUNTIME_BUNDLE = "orcamento\/assets\/(index-[^"]+\.js)"/)?.[1];
  const css = py.match(/RUNTIME_CSS = "orcamento\/assets\/(index-[^"]+\.css)"/)?.[1];
  assert.ok(bundle && css);
  assert.ok(await exists(`orcamento/assets/${bundle}`), `bundle ${bundle} ausente`);
  assert.ok(await exists(`orcamento/assets/${css}`), `css ${css} ausente`);
  const html = await read('orcamento/index.html');
  assert.ok(html.includes(`/orcamento/assets/${bundle}`) && html.includes(`/orcamento/assets/${css}`), 'orcamento/index.html referencia o bundle/CSS atuais');
  const files = (await readdir(path.join(siteRoot, 'orcamento/assets'))).filter((n) => /^index-.*\.(js|css)$/.test(n));
  assert.deepEqual(files.sort(), [bundle, css].sort(), 'sem bundles órfãos');
  assert.ok(py.includes(`/orcamento/assets/${bundle}`) && py.includes(`"${bundle}", "${css}"`), 'smoke tests apontam para os mesmos nomes');
});

test('pipeline: todos os arquivos de teste entram no CI (workflow) e em `pnpm test`', async () => {
  const names = (await readdir(path.join(appRoot, 'tests'))).filter((n) => n.endsWith('.test.mjs')).sort();
  const wf = await read('.github/workflows/pages.yml');
  const pkg = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'));
  for (const n of names) {
    assert.ok(wf.includes(`tests/${n}`), `workflow sem tests/${n}`);
    assert.ok(pkg.scripts.test.includes(`tests/${n}`), `package.json sem tests/${n}`);
  }
});

test('marcação: tags balanceadas em todas as páginas (sem tag aberta ou fechada fora de lugar)', async () => {
  const VOID = new Set(['meta', 'link', 'img', 'br', 'hr', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
  HTML['orcamento/index.html'] = await read('orcamento/index.html');
  for (const file of [...ALL, 'orcamento/index.html']) {
    const html = HTML[file].replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '<script></script>').replace(/<style[\s\S]*?<\/style>/g, '<style></style>');
    const stack = [];
    for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
      const name = m[1].toLowerCase();
      const closing = m[0][1] === '/';
      if (!closing && (VOID.has(name) || m[2] === '/')) continue;
      if (!closing) { stack.push(name); continue; }
      assert.equal(stack.pop(), name, `${file}: </${name}> fora de lugar perto de "${html.slice(Math.max(0, m.index - 50), m.index + 20).replace(/\s+/g, ' ')}"`);
    }
    assert.deepEqual(stack, [], `${file}: tags sem fechamento`);
  }
});


test('/orcamento/: texto estático e indexável no HTML (decisão 89), nas duas cópias; o bundle da calculadora não muda', async () => {
  for (const p of ['orcamento/index.html', 'orcamento-src/index.html']) {
    const html = await read(p);
    const texto = visibleText(html);
    assert.ok(texto.split(' ').length >= 60, `${p}: texto estático insuficiente (${texto.split(' ').length} palavras)`);
    assert.match(texto, /Quanto custa o projeto\? Calcule a estimativa\./, p);
    assert.match(texto, /Não é proposta, contrato nem garantia de preço\./, p);
    assert.match(texto, /nada é enviado sem a sua confirmação/i, p);
    assert.doesNotMatch(texto, /\bprévia\b|\bprevisão\b|faça seu orçamento|\d/i, `${p}: termo antigo ou número novo no texto estático`);
    assert.doesNotMatch(html, /name="robots" content="noindex/, `${p}: indexável`);
  }
  const publicada = await read('orcamento/index.html');
  assert.ok(publicada.includes('/orcamento/assets/index-CsN7vBmE.js') && publicada.includes('/orcamento/assets/index-B16Vzy82.css'), 'a página publicada segue apontando para o bundle e o CSS ancorados (G5)');
});

test('JSON-LD das nove páginas de serviço: atendimento em todo o Brasil (não só PR e SP)', () => {
  for (const slug of SERVICE_SLUGS) {
    const html = HTML[`servicos/${slug}/index.html`];
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const servico = ld['@graph'].find((n) => n['@type'] === 'Service');
    assert.deepEqual(servico.areaServed, { '@type': 'Country', name: 'Brasil' }, `${slug}: areaServed`);
    assert.doesNotMatch(html, /"name":"Paraná"\},\{"@type":"AdministrativeArea"/, `${slug}: cobertura restrita a PR e SP`);
  }
});

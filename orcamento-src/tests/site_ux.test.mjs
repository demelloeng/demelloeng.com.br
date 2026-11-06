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

test('HOME V02: primeira dobra apresenta o que a DEMELLO projeta e leva à estimativa ou ao WhatsApp; sem números de acervo', async () => {
  // A Home V02 (IT040, aprovada por Marcos) substituiu a primeira dobra "Vai construir ou ampliar?". A situação passa a ser escolhida na seção "Comece pela situação".
  const html = await read('index.html');
  const hero = html.match(/<section[^>]*data-block="situation-entry"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(hero, 'bloco situation-entry presente');
  const h1 = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(h1, 'Projeto estrutural e projetos complementares.');
  assert.match(hero, /Da planta de casa aos projetos complementares: arquitetura, estrutura e instalações desenvolvidas juntas, em BIM\./);
  assert.match(hero, /Também desenvolvemos projetos de terraplanagem\./);
  assert.match(hero, /<a class="btn-cta" href="\.\/orcamento\/\?situacao=build">Calcular estimativa<\/a>/);
  assert.match(hero, /<a class="wa-link"[^>]*href="https:\/\/wa\.me\/5541985124056"/);
  assert.equal([...hero.matchAll(/<a\b/g)].length, 2, 'dois links na primeira dobra: estimativa e WhatsApp');
  assert.doesNotMatch(hero, /\d+ ARTs|\d+ munic[ií]pios|anos de/i, 'números de acervo ficam fora da primeira dobra');
});

test('HOME (visual V2): quatro cartões de situação com ícone; "Já sei o serviço" lista as nove frentes; apoio técnico é link secundário', async () => {
  const html = await read('index.html');
  const block = html.match(/<section[^>]*data-block="situations"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(block, 'bloco situations presente');
  // Home V02: cartões `a.situation` com o mesmo ícone e os mesmos quatro destinos; "Já sabe o serviço?" lista as nove frentes.
  const main = [...block.matchAll(/<a class="situation" href="([^"]+)"><img src="\.\/assets\/icons\/situacao-[a-z]+-v1\.svg"[^>]*>\s*<h3>([^<]+)<\/h3>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(main, [
    ['Construir uma casa.', './construir-ou-ampliar/#construir'],
    ['Ampliar ou reformar.', './construir-ou-ampliar/#ampliar'],
    ['Regularizar um imóvel.', './servicos/regularizacao/'],
    ['Avaliar um problema.', './avaliar-um-problema/'],
  ], 'quatro situações, destinos preservados');
  assert.match(block, /<p class="sit-support">[^<]*<a href="\.\/orcamento\/\?situacao=support">Consultoria e mentoria técnica<\/a>/, 'apoio técnico preservado como link secundário');
  const direct = html.match(/<div[^>]*data-block="services-direct"[\s\S]*?<\/ul><\/div>/)?.[0] ?? '';
  assert.ok(direct, 'bloco services-direct presente');
  assert.match(direct, /<h3>Já sabe o serviço\?<\/h3>/, 'chamada "Já sabe o serviço?"');
  const links = [...direct.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => [m[2], m[1]]);
  assert.equal(links.length, 9, 'nove frentes');
  const svcPage = await read('servicos/index.html');
  for (const [name, href] of links) {
    assert.ok(await exists(href.replace('./', '') + 'index.html'), `destino existe: ${href}`);
    const slug = href.replace('./servicos/', '');
    assert.ok(svcPage.includes(`href="./${slug}"`), `serviço da Home continua acessível no catálogo: ${name}`);
  }
});

test('HOME: seções posteriores exigidas (insegurança, prova, benefícios, funcionamento, experiência, FAQ, CTA final)', async () => {
  const html = await read('index.html');
  // Home V02: a seção de benefícios foi substituída por "Integração em BIM" e "Escopo e entregas"; a experiência selecionada virou o bloco de prova técnica.
  for (const block of ['preview-explainer', 'reassurance', 'technical-proof', 'clients', 'deliverables', 'faq', 'final-cta']) {
    assert.match(html, new RegExp(`data-block="${block}"`), `bloco ${block}`);
  }
  assert.match(html, /aria-labelledby="integracao-title"/, 'seção Integração em BIM');
  assert.match(html, /<details>/, 'FAQ com <details>');
  const finalCta = html.slice(html.lastIndexOf('class="section cta-band"'));
  assert.match(finalCta, /href="\.\/orcamento\/\?situacao=build">Calcular a estimativa dos projetos/);
});

test('HOME: catálogo de nove frentes não é mais a porta de entrada; nove frentes vivem em /servicos/ (Outros serviços)', async () => {
  const home = await read('index.html');
  assert.doesNotMatch(home, /data-block="service-summary"/, 'a home não repete o catálogo de nove frentes');
  assert.match(home, /href="\.\/servicos\/"/, 'a home ainda conduz a /servicos/');
});

test('SERVIÇOS V02: nove destinos, copy corrigida, limites e caminhos por situação preservados', async () => {
  const html = await read('servicos/index.html');
  const items = [...html.matchAll(/<article class="service"[\s\S]*?<\/article>/g)].map(m => m[0]);
  assert.equal(items.length, 8, 'oito agrupamentos comerciais; nove URLs técnicas preservadas');
  const expected = ['Projeto de arquitetura', 'Projeto estrutural', 'Projeto hidrossanitário', 'AVCB, PPCI/PSCIP e gás/GLP', 'Projeto de terraplanagem', 'Compatibilização BIM', 'Regularização de imóvel', 'Orçamento e cronograma'];
  const titles = items.map(item => item.match(/<h3><a[^>]*>([^<]+)<\/a><\/h3>/)?.[1]);
  assert.deepEqual(titles, expected, 'ordem e nomes da copy validada');
  const slugs = items.map(item => item.match(/<h3><a href="\.\/([a-z-]+)\/">/)?.[1]);
  assert.deepEqual(slugs, ['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-prevencao-incendio', 'projeto-terraplenagem', 'compatibilizacao-bim', 'regularizacao', 'orcamento-tecnico']);
  assert.match(items[3], /href="\.\/projeto-gas-glp\/"/);
  for (const item of items) {
    assert.match(item, /<p class="service-limit">[^<]+<\/p>/, 'limite técnico disponível sem interação');
    assert.match(item, /<img[^>]+src="\.\.\/assets\/icons\/servicos-v02\/[a-z-]+\.svg"[^>]+alt=""/, 'ícone decorativo junto ao nome textual');
  }
  const block = items.join('\n');
  for (const limit of ['Não inclui execução da obra.', 'O projeto define as soluções técnicas para a movimentação de terra e suas interfaces com a implantação e a infraestrutura do empreendimento.', 'não garante aprovação pelo órgão competente', 'Sem promessa de aprovação automática', 'Não promete o custo final da obra']) assert.ok(block.includes(limit), limit);
  assert.match(block, /planta de casa/);
  assert.doesNotMatch(block, /Orçamento técnico/);
  assert.doesNotMatch(block, /O que (normalmente )?faz parte|entregáveis|entregamos|você recebe/i);
  const routes = html.match(/<section[^>]*data-block="routes"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(routes, /construir-ou-ampliar\//);
  assert.match(routes, /avaliar-um-problema\//);
  assert.match(routes, /href="\.\/regularizacao\/"/);
  assert.match(routes, /orcamento\/\?situacao=support/);
  assert.match(html, /href="\.\.\/orcamento\/\?situacao=known"/);
  assert.ok(html.indexOf('data-block="service-summary"') < html.indexOf('data-block="routes"'));
});

test('nove páginas individuais: H1 único, canonical, hero com CTA específico e seções exigidas', async () => {
  // Páginas V02 (estrutural, hidrossanitário, arquitetura, terraplanagem): CTA `a.cta` com seta; seções do corpo em <h2>; Entregáveis, Como funciona e Escopo e limites
  // ficam em "Detalhes do escopo" (<h3>). A Infraestrutura não leva estimativa (decisão 97) e seu CTA vai a /contato/.
  const V02 = {
    'projeto-estrutural': ['Ver a estimativa do meu projeto estrutural', '../../orcamento/?situacao=known&amp;servico=estrutural'],
    'projeto-hidrossanitario': ['Ver a estimativa do meu projeto hidrossanitário', '../../orcamento/?situacao=known&amp;servico=hidrossanitario'],
    'projeto-arquitetura': ['Ver a estimativa do meu projeto de casa', '../../orcamento/?situacao=known&amp;servico=arquitetura'],
    'projeto-terraplenagem': ['Conversar sobre meu projeto de terraplanagem', '../../contato/'],
  };
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
    if (['projeto-prevencao-incendio','projeto-gas-glp'].includes(slug)) {
      assert.match(html, /class="rico-hero-fundo"/);
      const id=slug==='projeto-gas-glp'?'gas-glp':'incendio';
      const destino=`../../orcamento/?situacao=known&amp;servico=${id}`;
      const rotulo=id==='incendio'?'Ver a estimativa do meu projeto de incêndio':'Ver a estimativa do projeto de gás/GLP';
      const ctas=[...html.matchAll(/<a class="cta" href="([^"]+)">([^<]+) →<\/a>/g)].filter(m=>m[1]===destino).map(m=>[m[2],m[1]]);
      assert.deepEqual(ctas,[[rotulo,destino],[rotulo,destino]],`${slug}: CTA principal no hero e fechamento`);
      const sections=['Para quem é','O que muda para você','Prova técnica','Escopo e limites','Próximo passo',...(id==='gas-glp'?['Entregáveis','Como funciona']:['Do projeto ao AVCB','Rede e central de gás/GLP'])];
      for(const section of sections) assert.ok(html.includes(`<h2>${section}</h2>`),`${slug}: ${section}`);
      const nodes=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(m=>JSON.parse(m[1])['@graph']??[]);
      const services=nodes.filter(n=>n['@type']==='Service');
      assert.equal(services.length,1,`${slug}: somente o próprio Service`);
      assert.equal(services[0].url,`https://demelloeng.com.br/servicos/${slug}/`);
      if(id==='incendio') assert.match(html, /AVCB ou o documento aplicável no estado \(no Paraná, CVCB ou CLCB\)/);
    } else if (slug === 'regularizacao') {
      // Regularização V02 (issue #16): copy V02 aprovada. CTA único para a rota exclusiva, no hero e no fechamento.
      assert.match(html, /class="rico-hero-fundo"/, `${slug}: hero no layout rico`);
      const destino = '../../orcamento/?situacao=regularize';
      const rotulo = 'Entender o que meu imóvel precisa';
      const ctas = [...html.matchAll(/<a class="cta" href="([^"]+)">([^<]+) →<\/a>/g)].map((m) => [m[2], m[1]]);
      assert.deepEqual(ctas, [[rotulo, destino], [rotulo, destino]], `${slug}: o mesmo CTA no hero e no fechamento`);
      for (const h2 of ['Qual é a situação do seu imóvel?', 'Quando a pendência aparece', 'Do problema ao documento', 'O que a DEMELLO faz', 'Experiência aplicada: Colégio Djalma Marinho', 'Perguntas frequentes', 'Próximo passo']) {
        assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
      }
      for (const h3 of ['Entregáveis', 'Como funciona', 'Como o escopo é definido', 'Escopo e limites']) assert.ok(html.includes(`<h3>${h3}</h3>`), `${slug}: detalhe "${h3}"`);
      assert.equal([...html.matchAll(/<li><svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<h3>/g)].length, 6, `${slug}: seis situações`);
      assert.equal([...html.matchAll(/<article><h3>/g)].length, 4, `${slug}: quatro contextos comerciais`);
      assert.equal([...html.matchAll(/<details class="rico-pergunta"/g)].length, 8, `${slug}: oito perguntas`);
      assert.equal([...html.matchAll(/<ol class="rico-etapas reg-etapas"[\s\S]*?<\/ol>/g)].map((m) => (m[0].match(/<li>/g) ?? []).length)[0], 5, `${slug}: cinco etapas`);
      const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? []);
      const services = nodes.filter((n) => n['@type'] === 'Service');
      assert.equal(services.length, 1, `${slug}: somente o próprio Service`);
      assert.equal(services[0].url, `https://demelloeng.com.br/servicos/${slug}/`);
      for (const href of ['../projeto-arquitetura/', '../../construir-ou-ampliar/', '../../avaliar-um-problema/']) assert.ok(html.includes(`<a href="${href}">`), `${slug}: link interno ${href}`);
    } else if (slug === 'orcamento-tecnico') {
      // Orçamento e cronograma V02 (issue #15): copy V01 aprovada. URL e identificador da calculadora preservados.
      assert.match(html, /class="rico-hero-fundo"/, `${slug}: hero no layout rico`);
      const destino = '../../orcamento/?situacao=known&amp;servico=orcamento-tecnico';
      const rotulo = 'Calcular a estimativa deste serviço';
      const ctas = [...html.matchAll(/<a class="cta" href="([^"]+)">([^<]+) →<\/a>/g)].map((m) => [m[2], m[1]]);
      assert.deepEqual(ctas, [[rotulo, destino], [rotulo, destino]], `${slug}: o mesmo CTA no hero e no fechamento`);
      for (const h2 of ['Quando o orçamento faz diferença', 'O que você precisa ter', 'O que você recebe', 'Do projeto à planilha', 'Orçamento ou estimativa?', 'Prova técnica', 'Experiência aplicada: Colégio Djalma Marinho', 'Perguntas frequentes', 'Próximo passo']) {
        assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
      }
      for (const h3 of ['Entregáveis', 'Como funciona', 'Como o escopo é definido', 'Escopo e limites']) assert.ok(html.includes(`<h3>${h3}</h3>`), `${slug}: detalhe "${h3}"`);
      assert.equal([...html.matchAll(/<ul class="rico-opcoes orc-situacoes">[\s\S]*?<\/ul>/g)].map((m) => (m[0].match(/<li>/g) ?? []).length)[0], 4, `${slug}: quatro situações`);
      assert.equal([...html.matchAll(/<ol class="rico-etapas orc-etapas"[\s\S]*?<\/ol>/g)].map((m) => (m[0].match(/<li>/g) ?? []).length)[0], 5, `${slug}: cinco etapas`);
      assert.equal([...html.matchAll(/<details class="rico-pergunta"/g)].length, 4, `${slug}: quatro perguntas`);
      const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? []);
      const services = nodes.filter((n) => n['@type'] === 'Service');
      assert.equal(services.length, 1, `${slug}: somente o próprio Service`);
      assert.equal(services[0].url, `https://demelloeng.com.br/servicos/${slug}/`);
      assert.equal(services[0].name, 'Orçamento e cronograma', `${slug}: nome vigente do serviço (decisão 75)`);
      assert.ok(html.includes('<a href="../compatibilizacao-bim/">Compatibilização BIM</a>'), `${slug}: link para Compatibilização BIM`);
    } else if (slug === 'compatibilizacao-bim') {
      // Compatibilização BIM V02 (issue #15): copy V02 aprovada. URL e identificador da calculadora preservados.
      assert.match(html, /class="rico-hero-fundo"/, `${slug}: hero no layout rico`);
      const destino = '../../orcamento/?situacao=known&amp;servico=compatibilizacao';
      const rotulo = 'Calcular a estimativa da compatibilização';
      const ctas = [...html.matchAll(/<a class="cta" href="([^"]+)">([^<]+) →<\/a>/g)].map((m) => [m[2], m[1]]);
      assert.deepEqual(ctas, [[rotulo, destino], [rotulo, destino]], `${slug}: o mesmo CTA no hero e no fechamento`);
      for (const h2 of ['Quando vale compatibilizar', 'O que muda para você', 'O que a DEMELLO faz', 'Das interfaces às decisões coordenadas', 'Experiência aplicada: Colégio Djalma Marinho', 'Perguntas frequentes', 'Detalhes do escopo', 'Próximo passo']) {
        assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
      }
      assert.equal([...html.matchAll(/<ol class="rico-etapas bim-etapas"[\s\S]*?<\/ol>/g)].map((m) => (m[0].match(/<li>/g) ?? []).length)[0], 4, `${slug}: quatro etapas`);
      assert.equal([...html.matchAll(/<details class="rico-pergunta"/g)].length, 5, `${slug}: cinco perguntas`);
      const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? []);
      const services = nodes.filter((n) => n['@type'] === 'Service');
      assert.equal(services.length, 1, `${slug}: somente o próprio Service`);
      assert.equal(services[0].url, `https://demelloeng.com.br/servicos/${slug}/`);
      assert.equal(services[0].name, 'Compatibilização BIM', `${slug}: nome do serviço preservado`);
      for (const link of ['<a href="../../metodologia/">Conheça como a DEMELLO trabalha com BIM</a>', '<a href="../orcamento-tecnico/">Orçamento e cronograma</a>']) {
        assert.ok(html.includes(link), `${slug}: link contextual ${link}`);
      }
    } else if (V02[slug]) {
      const [rotulo, destino] = V02[slug];
      const ctas = [...html.matchAll(/<a class="cta" href="([^"]+)">([^<]+) →<\/a>/g)].map((m) => [m[2], m[1]]);
      assert.deepEqual(ctas, [[rotulo, destino], [rotulo, destino]], `${slug}: o mesmo CTA no hero e no fechamento`);
      const corpo = slug === 'projeto-terraplenagem' ? ['Para quem é', 'O que muda para você', 'Prova técnica', 'Próximo passo'] : ['Para quem é', 'O que muda para você', 'Prova técnica', 'Próximo passo'];
      for (const h2 of corpo) assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
      const detalhes = slug === 'projeto-terraplenagem' ? ['Entregáveis', 'Como o escopo é definido'] : ['Entregáveis', 'Como funciona', 'Como o escopo é definido', 'Escopo e limites'];
      for (const h3 of detalhes) assert.ok(html.includes(`<h3>${h3}</h3>`), `${slug}: detalhe "${h3}"`);
    } else {
    const [label, query] = CTA[slug];
    const cta = new RegExp(`<a class="btn-cta" href="\\.\\./\\.\\./orcamento/\\?situacao=${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">${label}`);
    assert.match(html, cta, `${slug}: CTA específico no hero`);
    assert.equal([...html.matchAll(new RegExp(`>${label}<svg`, 'g'))].length, 2, `${slug}: o mesmo CTA no hero e no fechamento`);
    for (const h2 of ['Para quem é', 'Entregáveis', 'O que muda para você', 'Como funciona', 'Prova técnica', 'Escopo e limites', 'Próximo passo']) {
      assert.ok(html.includes(`<h2>${h2}</h2>`), `${slug}: seção "${h2}"`);
    }
    }
    // Invariantes comuns passam por TODOS os perfis, sem continue que os ignore.
    assert.doesNotMatch(html, /Conte o que você precisa/, `${slug}: sem o CTA genérico antigo`);
    // as nove páginas de serviço não reabrem números/afirmações fora da copy congelada
    assert.doesNotMatch(html.replace(/<div class="rico-imprensa">[\s\S]*?<\/div>/, ''), /R\$ ?8[.,]3|8,3 milh|Acervo Público|60 ARTs/i, `${slug}: sem número proibido`);
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
  assert.match(block, /não é proposta, contrato nem garantia de preço/i);   // Home V02: "Não é proposta…" no início da frase
  assert.match(block, /Nada é enviado sem a sua confirmação\./, 'nada é enviado antes da confirmação');
  assert.match(block, /A proposta vem depois\./, 'a proposta é etapa posterior à estimativa');
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

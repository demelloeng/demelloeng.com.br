import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialState} from '../src/deeplink.mjs';
const site=new URL('../../',import.meta.url);
const read=p=>readFile(new URL(p,site),'utf8');
const fire='projeto-prevencao-incendio',gas='projeto-gas-glp';
test('PSCIP/GLP: quatro referências contextuais em posições distintas',async()=>{
 for(const [from,to] of [[fire,gas],[gas,fire]]){
  const h=await read(`servicos/${from}/index.html`),main=h.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  const links=[...main.matchAll(new RegExp(`<a[^>]*href="\\.\\./${to}/"[^>]*>([^<]+)</a>`,'g'))];
  assert.ok(links.length>=2,from);assert.notEqual(links[0].index,links.at(-1).index);
  assert.ok(links.every(x=>x[1].length>12));
 }
});
test('PSCIP/GLP: rotas próprias indexáveis e dois CTAs independentes',async()=>{
 for(const slug of [fire,gas]){
  const h=await read(`servicos/${slug}/index.html`),url=`https://demelloeng.com.br/servicos/${slug}/`;
  assert.ok(h.includes(`rel="canonical" href="${url}"`));assert.ok(h.includes(`property="og:url" content="${url}"`));
  assert.doesNotMatch(h,/noindex|http-equiv="refresh"/);assert.equal([...h.matchAll(/<h1\b/g)].length,1);
  for(const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);
 }
 const h=await read(`servicos/${fire}/index.html`);
 for(const [id,name]of [['incendio','Incêndio'],['gas-glp','Gás']]){
  assert.ok(h.includes(`../../orcamento/?situacao=known&amp;servico=${id}`));
  assert.deepEqual(initialState(`?situacao=known&servico=${id}`).answers.services,[name]);
 }
});
test('PSCIP/GLP: oito cartões e acessos independentes, sem fundir os serviços técnicos',async()=>{
 const h=await read('servicos/index.html');assert.equal([...h.matchAll(/<article class="service"/g)].length,8);
 const card=h.match(/<article class="service" data-service="incendio">[\s\S]*?<\/article>/)[0];
 for(const url of ['./projeto-prevencao-incendio/','./projeto-gas-glp/','../orcamento/?situacao=known&amp;servico=incendio','../orcamento/?situacao=known&amp;servico=gas-glp'])assert.ok(card.includes(url),url);
 assert.ok(h.includes('./compatibilizacao-bim/'));assert.ok(h.includes('./orcamento-tecnico/'));
});
test('Hidrantes: arquivos aceitos preservados, 171 peças e indicação ilustrativa',async()=>{
 const glb=await readFile(new URL('assets/models/hidrantes-luiz-carlos-v02.glb',site));
 assert.equal(glb.length,1857508);assert.equal(createHash('sha256').update(glb).digest('hex'),'350b52603363964386270bba4b1fbdda04f9cd26ab4483559f6b12868021c04a');
 const bytes=await readFile(new URL('assets/models/hidrantes-luiz-carlos-v02.json',site));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'2e4e019029d304d122a125c6919ea0a9061e30a58890ba4854d03dff8a8feae8');
 const d=JSON.parse(bytes);assert.equal(Object.values(d.grupos).flat().length,171);assert.ok(d.representacoes);
});
test('Hidrantes: ativação explícita e pôster sem dependência do 3D',async()=>{
 const h=await read(`servicos/${fire}/index.html`);assert.match(h,/data-poster/);assert.match(h,/Explorar maquete 3D/);assert.match(h,/<noscript>/);
 assert.doesNotMatch(h,/<script[^>]+src="[^"]*hidrantes-luiz-carlos-v02.js/);
 const js=await read('assets/js/hidrantes-luiz-carlos-ativar.js');assert.ok(js.indexOf("addEventListener('click'")<js.indexOf("await import("));
 assert.ok(h.includes('Equipamentos')||h.includes('equipamentos ilustrativos'));
});

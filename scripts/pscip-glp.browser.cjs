/* Validação em localhost. NODE_PATH aponta para o Playwright já disponível. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:8774';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Somente localhost');
const out=path.resolve(__dirname,'../docs/arquivo/pscip-glp-v02-20261105');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],blockedExternal:[],performance:{},screenshots:[]};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name)};
const routes={incendio:'/servicos/projeto-prevencao-incendio/',glp:'/servicos/projeto-gas-glp/',catalogo:'/servicos/'};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
 async function ctx(opts={}){
  const c=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',...opts});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin||['data:','blob:'].includes(u.protocol))return r.continue();report.blockedExternal.push(u.href);return r.abort()});
  return c;
 }
 async function shot(p,name,fullPage=false){await p.screenshot({path:path.join(out,name+'.png'),fullPage,scale:'css'});report.screenshots.push(name+'.png')}
 try{
 const c=await ctx();const p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));
 const downloads=[];p.on('request',r=>downloads.push(r.url()));
 for(const [name,url] of Object.entries(routes)){
  const res=await p.goto(origin+url,{waitUntil:'networkidle'});check(name+': HTTP 200',res.status()===200);
  check(name+': sem rolagem horizontal',await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  check(name+': menu e Facebook V02',await p.locator('.nav-build').count()===1&&await p.locator('.site-footer a[href="https://www.facebook.com/demelloeng/"]').count()===1);
  await shot(p,name+'-desktop');await shot(p,name+'-desktop-completa',true);
  if(name==='incendio')report.performance.initial=await p.evaluate(()=>{const a=performance.getEntriesByType('resource').filter(x=>new URL(x.name).origin===location.origin);return{resources:a.length,decodedBytes:a.reduce((n,x)=>n+x.decodedBodySize,0),modelRequests:a.filter(x=>/\.glb|three\.module/.test(x.name)).length}});
 }
 await p.goto(origin+routes.incendio,{waitUntil:'networkidle'});
 check('Sem download Three.js/GLB antes de ativar',!downloads.some(x=>/three\.module|GLTFLoader|OrbitControls|\.glb/.test(x)));
 check('Pôster disponível',await p.locator('[data-poster] img').evaluate(x=>x.complete&&x.naturalWidth>0));
 for(const [from,to]of [['incendio','glp'],['glp','incendio']]){
  await p.goto(origin+routes[from]);const links=p.locator(`main a[href="..${routes[to].replace('/servicos','')}"]`);
  check(from+': duas referências cruzadas',await links.count()>=2);
  for(let i=0;i<2;i++){await links.nth(i).click();check(from+': link contextual '+(i+1)+' navega',new URL(p.url()).pathname===routes[to]);await p.goBack();}
 }
 for(const [id,label]of [['incendio','Incêndio'],['gas-glp','Gás']]){
  await p.goto(origin+routes.incendio);await p.locator(`a[href="../../orcamento/?situacao=known&servico=${id}"]`).first().click();
  check('CTA '+id+': destino preservado',new URL(p.url()).searchParams.get('servico')===id);
  await p.waitForTimeout(200);check('CTA '+id+': calculadora carregou',await p.locator('#root').innerText().then(x=>x.length>40));
  await shot(p,'calculadora-'+id);
 }
 await p.goto(origin+routes.incendio,{waitUntil:'networkidle'});
 const activate=p.locator('[data-ativar-hidrantes]');await activate.focus();await p.keyboard.press('Enter');await p.waitForSelector('#caixa[data-pronto=true]',{timeout:45000});await p.waitForSelector('#caixa.aberta');
 check('Maquete abre por teclado',await p.locator('#caixa').getAttribute('aria-modal')==='true');
 check('171 peças disponíveis',await p.locator('#componente option').count()===172);
 check('Pôster sai após carga concluída',await p.locator('[data-poster]').isHidden());
 check('Movimento reduzido preservado',await p.locator('#girar').getAttribute('aria-pressed')==='false');
 await shot(p,'maquete-desktop');
 const pump=p.locator('#componente option').filter({hasText:'Bomba de incêndio'}).first();await p.selectOption('#componente',await pump.getAttribute('value'));
 check('Ficha de equipamento ilustrativo',/ilustrativ/i.test(await p.locator('#ficha').innerText()));
 await p.locator('[data-action=isolar]').click();check('Isolamento',await p.locator('[data-action=isolar]').getAttribute('aria-pressed')==='true');await shot(p,'maquete-bomba');
 await p.locator('#ficha button').filter({hasText:'Limpar'}).click();await p.locator('#raiox').click();check('Raio-X',await p.locator('#raiox').getAttribute('aria-pressed')==='true');await p.locator('#raiox').click();
 await p.locator('#construir').fill('50');check('Montagem',await p.locator('#pct').innerText()==='50%');await p.locator('#construir').fill('100');
 await p.locator('#explodir').fill('60');await p.locator('#explodir').dispatchEvent('change');await shot(p,'maquete-camadas');
 await p.keyboard.press('Escape');check('Escape fecha e devolve foco',await p.locator('#caixa').evaluate(e=>document.activeElement===e&&e.getAttribute('role')==='button'));
 report.performance.resources=await p.evaluate(()=>performance.getEntriesByType('resource').filter(x=>/\.glb|three\.module/.test(x.name)).map(x=>({name:new URL(x.name).pathname,bytes:x.decodedBodySize,durationMs:x.duration})));
 const phone=await ctx({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const m=await phone.newPage();m.on('pageerror',e=>report.errors.push(e.message));
 for(const [name,url]of Object.entries(routes)){
  await m.goto(origin+url,{waitUntil:'networkidle'});check(name+': mobile sem overflow',await m.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  check(name+': botão de menu acessível',await m.locator('.nav-toggle').isVisible());
  await shot(m,name+'-mobile');await shot(m,name+'-mobile-completa',true);
  if(name!=='catalogo')check(name+': CTA antes da maquete/diagrama no mobile',await m.evaluate(()=>document.querySelector('.rico-texto .cta').getBoundingClientRect().bottom<document.querySelector('.rico-caixa').getBoundingClientRect().top));
  await m.locator('.nav-toggle').click();check(name+': menu móvel abre',await m.locator('.nav-toggle').getAttribute('aria-expanded')==='true');await m.locator('.nav-toggle').click();
 }
 await m.goto(origin+routes.incendio);await m.locator('[data-ativar-hidrantes]').tap();await m.waitForSelector('#caixa[data-pronto=true]');await m.waitForSelector('#caixa.aberta');await m.locator('#controles-mobile').tap();
 check('Mobile: controles e seletor acessíveis',await m.locator('#componente').isVisible());await shot(m,'maquete-mobile');
 report.performance.mobileFrames=await m.evaluate(async()=>{const intervals=[];let last=performance.now();for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now}intervals.sort((a,b)=>a-b);return{medianMs:intervals[15],p95Ms:intervals[28],note:'Viewport/toque emulados; não comprova desempenho de aparelho físico'}});
 await m.keyboard.press('Escape');
 const nojs=await ctx({javaScriptEnabled:false});const n=await nojs.newPage();await n.goto(origin+routes.incendio);check('Sem JavaScript: pôster e CTA utilizáveis',await n.locator('[data-poster] img').isVisible()&&await n.locator('.rico-texto .cta').isVisible());await shot(n,'fallback-sem-js');
 const failed=await ctx();const f=await failed.newPage();await f.route('**/hidrantes-luiz-carlos-v02.glb*',r=>r.abort());await f.goto(origin+routes.incendio);await f.locator('[data-ativar-hidrantes]').click();await f.getByRole('status').filter({hasText:'A imagem e os links'}).waitFor({timeout:45000});check('Falha no GLB: fallback preservado',await f.locator('[data-poster] img').isVisible());await shot(f,'fallback-download');
 const nogl=await ctx();await nogl.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(name,...args){return /webgl/.test(name)?null:original.call(this,name,...args)}});const g=await nogl.newPage();await g.goto(origin+routes.incendio);await g.locator('[data-ativar-hidrantes]').click();await g.getByRole('status').filter({hasText:'A imagem e os links'}).waitFor();check('Sem WebGL: pôster e CTA permanecem',await g.locator('[data-poster] img').isVisible()&&await g.locator('.rico-texto .cta').isVisible());await shot(g,'fallback-webgl');
 check('Sem exceções nas páginas e interações principais',report.errors.length===0);
 }finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close()}
 console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,screenshots:report.screenshots.length}));
})().catch(e=>{console.error(e);process.exitCode=1});

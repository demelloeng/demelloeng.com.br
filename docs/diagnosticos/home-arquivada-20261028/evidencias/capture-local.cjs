const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), crypto=require('node:crypto');
const {chromium}=require('C:/Users/mms_e/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'home'), out=path.resolve(__dirname,'../../outputs/home-auditoria-20261028');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected='73b5794b623eb118555beb04c1d8b77a8f924c906dc2fa2d1f892dbfef973573';
if(hash(fs.readFileSync(path.join(root,'index.html')))!==expected)throw Error('Invalid archive hash');
const served=new Map(), serverErrors=[];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(root,'.'+name);
  if(file!==root&&!file.startsWith(root+path.sep))throw Error('Path outside archive');
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){serverErrors.push({url:req.url,status:404});res.writeHead(404);return res.end('Not in archive');}
  const bytes=fs.readFileSync(file);served.set(path.relative(root,file),{bytes:bytes.length,sha256:hash(bytes)});
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'"});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){serverErrors.push({error:String(e)});res.writeHead(403);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 const report={source:{branch:'arquivo/home-20261028',commit:'cca24fffa6720ad5ac97a882957df7e73057657c',index_sha256:expected},scope:'Original archive served unchanged. External requests blocked; CSP prohibits connections/forms; no form submissions or contact clicks.',viewports:[]};
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps']});
  report.browser=browser.version();
  for(const [label,width,height,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',extraHTTPHeaders:{DNT:'1'}});
   const blocked=[],errors=[],consoleErrors=[],responses=[],failed=[];
   await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();blocked.push({url:r.url(),method:r.method()});return route.abort('blockedbyclient');});
   if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
   const page=await context.newPage();
   page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
   page.on('requestfailed',r=>failed.push({url:r.url(),failure:r.failure()}));page.on('response',r=>responses.push({url:r.url(),status:r.status()}));
   await page.goto(origin+'/',{waitUntil:'networkidle'});
   await page.evaluate(async()=>{await document.fonts.ready;});
   for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=Math.floor(height*.8)){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(50);}
   await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);
   const details=await page.evaluate(()=>({h1:[...document.querySelectorAll('h1')].map(e=>e.innerText.replace(/\s+/g,' ').trim()),width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,stylesheets:[...document.styleSheets].map(s=>({href:s.href,rules:s.cssRules.length})),fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),fontStatus:document.fonts.status,images:[...document.images].map(i=>({src:new URL(i.currentSrc||i.src).pathname,loaded:i.complete&&i.naturalWidth>0,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,alt:i.alt})),sections:[...document.querySelectorAll('main>section')].map((s,i)=>({i,id:s.id,class:s.className,title:s.querySelector('h1,h2')?.innerText,top:s.getBoundingClientRect().top+scrollY,height:s.getBoundingClientRect().height})),links:[...document.querySelectorAll('a')].map(a=>({text:a.innerText.trim()||a.querySelector('img')?.alt,href:a.getAttribute('href')}))}));
   details.label=label;details.blocked=[...blocked];details.pageErrors=[...errors];details.consoleErrors=[...consoleErrors];details.failedRequests=[...failed];details.responses=[...responses];
   details.h1Matches=details.h1.length===1&&details.h1[0]==='Projeto estrutural e projetos complementares.';details.horizontalOverflow=details.documentWidth>width;
   if(!details.h1Matches||details.images.some(i=>!i.loaded)||details.stylesheets.length!==2||details.fonts.some(f=>f.status!=='loaded')||responses.some(r=>r.status>=400)||errors.length)throw Error('Capture quality gate failed: '+JSON.stringify(details));
   await page.screenshot({path:path.join(out,`${label}-full.png`),fullPage:true,animations:'disabled'});
   await page.screenshot({path:path.join(out,`${label}-hero.png`),animations:'disabled'});
   for(const s of details.sections){await page.locator('main>section').nth(s.i).screenshot({path:path.join(out,`${label}-section-${String(s.i+1).padStart(2,'0')}.png`),animations:'disabled'});}
   // Test only local home interactions and the entry into the estimate route. No form filling or sending.
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);
   details.interactions={};
   if(mobile){const menu=page.locator('.nav-toggle');await menu.click();details.interactions.menuOpens=await menu.getAttribute('aria-expanded')==='true'&&await page.locator('#site-nav').isVisible();await page.screenshot({path:path.join(out,'mobile-menu.png'),animations:'disabled'});await menu.click();details.interactions.menuCloses=await menu.getAttribute('aria-expanded')==='false';}
   const faq=page.locator('details').first();await faq.locator('summary').click();details.interactions.faqOpens=await faq.getAttribute('open')!==null;
   await faq.locator('summary').click();
   await page.locator('.hero .btn-cta').click();await page.waitForLoadState('networkidle');
   details.interactions.primaryCtaDestination=new URL(page.url()).pathname+new URL(page.url()).search;
   details.interactions.primaryCtaReachedLocalEstimate=new URL(page.url()).pathname==='/orcamento/';
   details.interactions.estimateTitle=await page.title();
   details.interactions.estimateH1=await page.locator('h1').allTextContents();
   details.interactions.blocked=[...blocked];details.interactions.pageErrors=[...errors];details.interactions.consoleErrors=[...consoleErrors];
   await page.screenshot({path:path.join(out,`${label}-estimate-entry.png`),animations:'disabled'});
   report.viewports.push(details);await context.close();
  }
 }finally{
  report.served=Object.fromEntries(served);report.serverErrors=serverErrors;report.source.index_sha256_after=hash(fs.readFileSync(path.join(root,'index.html')));
  fs.writeFileSync(path.join(out,'verificacao.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();await new Promise(r=>server.close(r));
 }
 console.log(JSON.stringify({out,browser:report.browser,viewports:report.viewports.map(v=>({label:v.label,height:v.documentHeight,images:v.images.length,fonts:v.fonts,overflow:v.horizontalOverflow,pageErrors:v.pageErrors,consoleErrors:v.consoleErrors,blocked:v.blocked,interactions:v.interactions})),served:served.size,serverErrors},null,2));
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

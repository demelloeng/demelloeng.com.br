const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  await p.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8774'?r.continue():r.abort());
  await p.addInitScript(()=>{
   let closed=false;new MutationObserver(()=>{const el=document.querySelector('#caixa');if(el?.classList.contains('aberta')&&!closed){closed=true;dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))}}).observe(document,{subtree:true,attributes:true,attributeFilter:['class']});
  });
  await p.goto('http://127.0.0.1:8774/servicos/projeto-prevencao-incendio/');await p.locator('[data-ativar-hidrantes]').click();await p.waitForSelector('#caixa[data-pronto=true]');await p.waitForTimeout(1000);
  const state=await p.locator('#caixa').evaluate(e=>({modal:e.classList.contains('aberta'),style:e.getAttribute('style'),role:e.getAttribute('role'),focus:document.activeElement.id}));
  console.log(JSON.stringify(state));assert.equal(state.modal,false);assert.equal(state.style,null);assert.equal(state.role,'button');assert.equal(state.focus,'caixa');
  await p.locator('#caixa').click();await p.waitForTimeout(550);assert.equal(await p.locator('#caixa').getAttribute('role'),'dialog');await p.keyboard.press('Escape');await p.waitForTimeout(550);assert.equal(await p.locator('#caixa').getAttribute('style'),null);console.log('PASS: Escape durante abertura, fechamento duplicado e reabertura');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

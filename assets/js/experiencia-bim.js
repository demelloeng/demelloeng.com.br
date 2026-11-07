// Adaptador local: uma única instância do visualizador publicado, sob demanda.
const root = document.querySelector('[data-hidrantes-widget]');
const button = root.querySelector('[data-ativar-hidrantes]');
const poster = root.querySelector('[data-poster]');
const runtime = root.querySelector('[data-runtime]');
const box = root.querySelector('#caixa');
const status = poster.querySelector('[role=status]');
const failure = 'Não foi possível abrir o modelo 3D. A imagem e as informações do projeto continuam disponíveis. Você também pode conhecer o serviço de prevenção contra incêndio.';
const instructions = 'Colégio Luiz Carlos · Selecione uma peça para ver sua identificação.';
button.hidden = false;
let started = false, ready = false, failed = false, timer;
function fail() {
  if (failed) return; failed = true;
  clearTimeout(timer);status.textContent = failure;button.hidden = true;
  runtime.inert = true;runtime.setAttribute('aria-hidden','true');poster.hidden = false;
}
const background = [...document.querySelectorAll('header, footer, main>section')].filter(e => !e.contains(root));
new MutationObserver(() => {
  if (box.dataset.erro === 'true') return fail();
  const loading = root.querySelector('#carregando');
  if (/Não foi possível|interrompida/.test(loading.textContent)) return fail();
  if (box.dataset.pronto === 'true' && !ready) {
    ready = true;clearTimeout(timer);runtime.inert = false;runtime.removeAttribute('aria-hidden');poster.hidden = true;box.tabIndex = 0;box.focus();box.click();
  }
  const tip = root.querySelector('.topo p');
  if (tip.textContent !== instructions) tip.textContent = instructions;
  const open = box.classList.contains('aberta');
  for (const e of background) e.inert = open;
}).observe(runtime,{subtree:true,attributes:true,childList:true,characterData:true});
button.addEventListener('click',async () => {
  if(started)return;started=true;button.disabled=true;status.textContent='Carregando o sistema de hidrantes…';
  timer=setTimeout(fail,45000);
  try { await import('./hidrantes-luiz-carlos-v02.js?v=1'); } catch { fail(); }
});
box.addEventListener('keydown',e=>{
  if(!box.classList.contains('aberta'))return;
  if(e.key==='Escape'){setTimeout(()=>{box.focus();},0);return;}
  if(e.key!=='Tab')return;
  const items=[...box.querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.hidden&&!el.disabled&&el.getClientRects().length);
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===box)){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});

// Único ponto de ativação: não importa Three.js antes da ação explícita do visitante.
const root = document.querySelector('[data-hidrantes-widget]');
const button = root.querySelector('[data-ativar-hidrantes]');
const poster = root.querySelector('[data-poster]');
const runtime = root.querySelector('[data-runtime]');
const status = poster.querySelector('[role=status]');
button.hidden = false;
let activated = false;
button.addEventListener('click', async () => {
  if (activated) return;
  activated = true; button.disabled = true; status.textContent = 'Carregando a maquete 3D…';
  const box = root.querySelector('#caixa');
  let timer;
  const observer = new MutationObserver(() => {
    if (box.dataset.pronto !== 'true') return;
    observer.disconnect(); clearTimeout(timer);
    runtime.inert = false; runtime.removeAttribute('aria-hidden');
    poster.hidden = true; box.tabIndex = 0; box.focus(); box.click();
  });
  const fail = () => {
    observer.disconnect(); clearTimeout(timer);
    status.textContent = 'Não foi possível abrir o 3D. A imagem e os links de estimativa continuam disponíveis.';
    button.hidden = true;
  };
  observer.observe(box, {attributes:true,attributeFilter:['data-pronto']});
  timer = setTimeout(fail, 45000);
  try { await import('./hidrantes-luiz-carlos-v02.js?v=1'); }
  catch { fail(); }
  const loading = root.querySelector('#carregando');
  new MutationObserver((_,obs) => {
    if (/Não foi possível|Erro/.test(loading.textContent)) { fail(); obs.disconnect(); }
  }).observe(loading,{childList:true,subtree:true});
});

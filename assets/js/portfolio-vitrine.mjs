// A Home carrega sua camada original. Aqui, a régua e os cartazes reagem ao ponteiro.
const ruler = document.querySelector('.portfolio-ruler');
const control = ruler.querySelector('.gvl-motion');
const label = control.querySelector('.gvl-motion-label');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const canDraw = CSS.supports('animation-timeline: view()');
let enabled = true;

function updateMotion() {
  ruler.dataset.motion = enabled && !reduced.matches ? 'on' : 'off';
  control.hidden = reduced.matches || (!pointer.matches && !canDraw);
  control.dataset.enabled = ruler.dataset.motion === 'on';
  label.textContent = enabled ? 'Pausar luz' : 'Ativar luz';
}

control.addEventListener('click', () => {
  enabled = !enabled;
  if (!enabled) {
    for (const row of ruler.querySelectorAll('.portfolio-scale > li')) row.dataset.drawn = '';
  }
  updateMotion();
});

ruler.addEventListener('animationend', event => {
  if (event.animationName === 'portfolio-draw') event.target.closest('li').dataset.drawn = '';
});

ruler.addEventListener('pointermove', event => {
  if (!pointer.matches || ruler.dataset.motion !== 'on') return;
  const box = ruler.getBoundingClientRect();
  ruler.style.setProperty('--mx', `${event.clientX - box.left}px`);
  ruler.style.setProperty('--my', `${event.clientY - box.top}px`);
}, { passive: true });

reduced.addEventListener('change', updateMotion);
pointer.addEventListener('change', updateMotion);
updateMotion();

const posterHover = matchMedia('(hover: hover)');
for (const poster of document.querySelectorAll('.portfolio-poster')) {
  poster.addEventListener('pointermove', event => {
    if (!posterHover.matches || event.pointerType === 'touch') return;
    const box = poster.getBoundingClientRect();
    poster.style.setProperty('--mx', (event.clientX - box.left) + 'px');
    poster.style.setProperty('--my', (event.clientY - box.top) + 'px');
  }, { passive: true });
}

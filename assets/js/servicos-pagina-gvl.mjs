const pointer = matchMedia('(hover: hover) and (pointer: fine)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

document.querySelector('main').addEventListener('pointermove', (event) => {
  if (!pointer.matches || motion.matches || event.pointerType === 'touch') return;
  const panel = event.target.closest('[data-servico-vidro]');
  if (!panel) return;
  const box = panel.getBoundingClientRect();
  panel.style.setProperty('--mx', (event.clientX - box.left) + 'px');
  panel.style.setProperty('--my', (event.clientY - box.top) + 'px');
}, { passive: true });

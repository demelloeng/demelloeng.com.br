/* DEMELLO · Home candidata V2 · "Grafite, vidro e luz"
   Sem este script a página fica completa e estática. Ele só:
   1) liga e desliga a luz do hero (com botão de pausa, WCAG 2.2.2);
   2) faz o reflexo das superfícies de vidro seguir o cursor. */
(() => {
  const hero = document.querySelector('body.gvl .hero');
  const control = hero?.querySelector('.gvl-motion');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (hero && control && 'IntersectionObserver' in window) {
    const label = control.querySelector('.gvl-motion-label');
    let enabled = !reduced.matches;   // movimento reduzido começa estático
    let userChoice = null;            // escolha explícita vence a preferência
    let inView = true;

    const update = () => {
      const moving = enabled && inView && !document.hidden;
      // "false" congela o quadro atual; sem o atributo nada se move
      if (enabled || hero.hasAttribute('data-moving')) hero.dataset.moving = String(moving);
      control.dataset.enabled = String(enabled);
      label.textContent = enabled ? 'Pausar luz' : 'Ativar luz';
    };

    control.addEventListener('click', () => {
      enabled = !enabled;
      userChoice = enabled;
      update();
    });
    reduced.addEventListener('change', () => {
      if (userChoice === null) { enabled = !reduced.matches; update(); }
    });
    document.addEventListener('visibilitychange', update);
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }).observe(hero);

    // Sob movimento reduzido o CSS não anima nada; o botão só aparece quando há o que pausar.
    if (!reduced.matches) control.hidden = false;
    reduced.addEventListener('change', () => { control.hidden = reduced.matches; });
    update();
  }

  /* Reflexo que segue o cursor: só com mouse e sem movimento reduzido. */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!finePointer.matches || reduced.matches) return;
  const surfaces = document.querySelectorAll(
    'body.gvl .entry, body.gvl .situation, body.gvl .service-row, body.gvl .case, body.gvl .cta-band .wrap'
  );
  surfaces.forEach(el => {
    el.classList.add('gvl-spot');
    el.addEventListener('pointermove', event => {
      const box = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${event.clientX - box.left}px`);
      el.style.setProperty('--my', `${event.clientY - box.top}px`);
    }, { passive: true });
  });
})();

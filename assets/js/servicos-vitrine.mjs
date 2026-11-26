import { track } from './analytics.mjs';

const stage = document.querySelector('.sv3-stage');
const rail = stage.querySelector('.sv3-track');
const slides = [...rail.children];
const strip = stage.querySelector('.sv3-chips');
const title = stage.querySelector('#sv3-disciplina');
const model = stage.querySelector('#sv3-abrir');
const service = stage.querySelector('#sv3-servico');
const status = stage.querySelector('[role="status"]');
const beam = stage.querySelector('.gvl-beam');
const desktop = matchMedia('(min-width: 1100px)');
const hasScrollEnd = 'onscrollend' in rail;

let settled = slides[0];
let marked;
let pending;
let pendingStart;
let queuedDirection;
let sequence = false;
let frame;
let debounce;
let unlock;
let interaction = 0;

const center = slide => slide.offsetLeft + slide.offsetWidth / 2 - rail.clientWidth / 2;
const nearest = () => slides.reduce((a, b) =>
  Math.abs(center(a) - rail.scrollLeft) <= Math.abs(center(b) - rail.scrollLeft) ? a : b);
const visualOrder = () => [...slides].sort((a, b) => a.offsetLeft - b.offsetLeft);
const emit = (name, slide) => track(name, { discipline: slide.dataset.discipline }, { dedupeKey: ++interaction });

for (const [i, slide] of slides.entries()) {
  slide.style.setProperty('--index', i);
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.textContent = slide.dataset.title;
  chip.addEventListener('click', event => {
    if (slide === (pending?.slide || nearest())) return;
    if (!sequence) {
      park(nearest(), true);
      sequence = true;
    }
    navigate(slide, event.isTrusted);
  });
  strip.append(chip);
}

if (!CSS.supports('order: sibling-count()')) {
  rail.style.setProperty('--children-count', slides.length);
}

function mark(slide) {
  const chip = strip.children[slides.indexOf(slide)];
  if (marked === chip) return;
  marked?.removeAttribute('aria-current');
  marked = chip;
  marked.setAttribute('aria-current', 'true');
  const area = strip.getBoundingClientRect();
  const item = marked.getBoundingClientRect();
  const padding = parseFloat(getComputedStyle(strip).scrollPaddingInlineStart) || 0;
  if (item.left < area.left + padding || item.right > area.right - padding) {
    strip.scrollBy({ left: (item.left + item.right - area.left - area.right) / 2 });
  }
}

// Reordering moves layout boxes in the rail. Compensate in the same task.
function park(anchor, domOrder = false, lock = true) {
  cancelAnimationFrame(unlock);
  const x = center(anchor);
  const left = rail.scrollLeft;
  rail.style.scrollSnapType = 'none';
  rail.style.overflowX = lock && !domOrder ? 'hidden' : '';
  if (domOrder) rail.style.removeProperty('--current');
  else rail.style.setProperty('--current', slides.indexOf(anchor));
  rail.scrollTo({ left: left + center(anchor) - x, behavior: 'instant' });
  rail.style.scrollSnapType = '';
  if (lock && !domOrder) {
    unlock = requestAnimationFrame(() => {
      unlock = requestAnimationFrame(() => { rail.style.overflowX = ''; });
    });
  }
}

function allowNearbyImages() {
  stage.setAttribute('data-engaged', '');
}

function navigate(slide, intentional) {
  allowNearbyImages();
  rail.style.overflowX = '';
  pendingStart = rail.scrollLeft;
  pending = { slide, intentional };
  mark(slide);
  const target = center(slide);
  if (Math.abs(target - pendingStart) < 1) {
    settle(true);
    return;
  }
  rail.scrollTo({ left: target });
}

function step(direction, intentional) {
  const from = pending?.slide || nearest();
  const order = visualOrder();
  const next = order[order.indexOf(from) + direction];
  if (next) navigate(next, intentional);
  else queuedDirection = { direction, intentional };
}

function settle(alreadyThere = false) {
  if (pending && !alreadyThere && Math.abs(rail.scrollLeft - pendingStart) < 1) return;
  const current = nearest();
  if (pending && Math.abs(center(current) - rail.scrollLeft) > 2) return;
  const intentional = pending?.intentional && pending.slide === current;
  pending = null;
  const changed = current !== settled;
  if (sequence || changed) park(current, false, !queuedDirection);
  sequence = false;
  mark(current);
  if (changed) {
    settled.removeAttribute('data-active');
    settled = current;
    current.setAttribute('data-active', '');
    current.querySelector('figure').append(beam);
    title.textContent = current.dataset.title;
    model.href = current.dataset.serviceUrl + '#caixa';
    service.href = current.dataset.serviceUrl;
    status.textContent = current.dataset.title + ', ' + current.getAttribute('aria-label');
    if (intentional) emit('service_showcase_selected', current);
  }
  if (queuedDirection) {
    const { direction, intentional: click } = queuedDirection;
    queuedDirection = null;
    step(direction, click);
  }
}

rail.addEventListener('scroll', () => {
  if (nearest() !== settled) allowNearbyImages();
  if (!pending && !frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!pending) mark(nearest());
    });
  }
  if (!hasScrollEnd) {
    clearTimeout(debounce);
    debounce = setTimeout(settle, 160);
  }
}, { passive: true });
if (hasScrollEnd) rail.addEventListener('scrollend', () => settle());

function clearIntent() {
  allowNearbyImages();
  pending = null;
  queuedDirection = null;
}
rail.addEventListener('pointerdown', clearIntent, { passive: true });
rail.addEventListener('wheel', clearIntent, { passive: true });
rail.addEventListener('keydown', clearIntent);

stage.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', event => step(Number(button.dataset.direction), event.isTrusted));
});
model.addEventListener('click', event => {
  if (event.isTrusted && !event.defaultPrevented) emit('service_showcase_model_opened', settled);
});

mark(settled);
park(settled, false, false);
rail.scrollTo({ left: center(settled), behavior: 'instant' });
stage.querySelectorAll('[data-controls]').forEach(control => { control.hidden = false; });

desktop.addEventListener('change', () => {
  clearIntent();
  sequence = false;
  park(settled, false, false);
  rail.scrollTo({ left: center(settled), behavior: 'instant' });
});

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    stage.toggleAttribute('data-in-view', entry.isIntersecting);
  }).observe(rail);
}

// The Home module already tracks the pointer on the calculator card.
const pointerMotion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
for (const slide of slides) {
  const poster = slide.querySelector('figure');
  poster.classList.add('gvl-spot');
  poster.addEventListener('pointermove', event => {
    if (slide !== settled || !pointerMotion.matches || event.pointerType !== 'mouse') return;
    const box = poster.getBoundingClientRect();
    poster.style.setProperty('--mx', (event.clientX - box.left) / box.width * 100 + '%');
    poster.style.setProperty('--my', (event.clientY - box.top) / box.height * 100 + '%');
  }, { passive: true });
}

const layers = document.querySelectorAll('[data-depth]');
const hero = document.querySelector('.hero');
const mouseLight = document.querySelector('.mouse-light');

function updateParallax(clientX, clientY) {
  const rect = hero.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width - 0.5;
  const y = (clientY - rect.top) / rect.height - 0.5;

  layers.forEach((layer) => {
    const depth = Number(layer.dataset.depth || 0);
    const moveX = x * depth * 120;
    const moveY = y * depth * 90;
    layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.08)`;
  });
}

hero.addEventListener('pointermove', (event) => updateParallax(event.clientX, event.clientY));
hero.addEventListener('pointerleave', () => {
  layers.forEach((layer) => {
    layer.style.transform = 'translate3d(0, 0, 0) scale(1.08)';
  });
});

window.addEventListener('pointermove', (event) => {
  mouseLight.style.left = `${event.clientX}px`;
  mouseLight.style.top = `${event.clientY}px`;
  mouseLight.style.opacity = '.22';
});

document.documentElement.addEventListener('mouseleave', () => {
  mouseLight.style.opacity = '0';
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll('.observe').forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
  observer.observe(element);
});

window.addEventListener('deviceorientation', (event) => {
  if (event.beta == null || event.gamma == null) return;
  const x = Math.max(-1, Math.min(1, event.gamma / 35));
  const y = Math.max(-1, Math.min(1, event.beta / 45));
  layers.forEach((layer) => {
    const depth = Number(layer.dataset.depth || 0);
    layer.style.transform = `translate3d(${x * depth * 90}px, ${y * depth * 70}px, 0) scale(1.08)`;
  });
});

// Interactive elliptical orbit for the six skill cards. Drag horizontally to
// rotate the skillset; hovering pauses motion without relocating any card.
const orbitStage = document.querySelector('#skills-orbit-stage');
const orbitCards = orbitStage ? [...orbitStage.querySelectorAll('.skill-float')] : [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let orbitFrame = 0;
let orbitStart = performance.now();
let orbitAngleOffset = 0;
let orbitPaused = false;
let pauseStarted = 0;
let isOrbitDragging = false;
let dragStartX = 0;
let dragStartAngle = 0;
let lastDragX = 0;
let lastDragTime = 0;
let dragVelocity = 0;
let inertiaVelocity = 0;
let suppressCardClick = false;

function renderSkillOrbit(now) {
  if (!orbitStage || !orbitCards.length || window.innerWidth <= 680) return;

  if (orbitPaused || isOrbitDragging) {
    if (!pauseStarted) pauseStarted = now;
  } else if (pauseStarted) {
    orbitStart += now - pauseStarted;
    pauseStarted = 0;
  }

  if (!orbitPaused && !isOrbitDragging && Math.abs(inertiaVelocity) > 0.00002) {
    orbitAngleOffset += inertiaVelocity * 16.67;
    inertiaVelocity *= 0.94;
  }

  const rect = orbitStage.getBoundingClientRect();
  const radiusX = Math.max(260, rect.width * 0.35);
  const radiusY = Math.max(205, rect.height * 0.32);
  const elapsed = (now - orbitStart) / 1000;
  const autoAngle = reduceMotion.matches ? 0 : elapsed * 0.105;

  orbitCards.forEach((card, index) => {
    const angle = autoAngle + orbitAngleOffset + index * (Math.PI * 2 / orbitCards.length) - Math.PI / 2;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    const depthAxis = Math.sin(angle);
    const depth = (depthAxis + 1) / 2;
    const scale = 0.78 + depth * 0.28;
    const translateZ = -150 + depth * 320;
    const zIndex = depthAxis >= 0 ? 60 + Math.round(depth * 40) : 8 + Math.round(depth * 24);
    const blur = depthAxis < -0.28 ? Math.abs(depthAxis) * 1.4 : 0;

    card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${translateZ}px) scale(${scale})`;
    card.style.setProperty('--orbit-z', String(zIndex));
    card.style.setProperty('--orbit-blur', `${blur.toFixed(2)}px`);
    card.style.opacity = String(0.58 + depth * 0.42);
    card.dataset.orbitSide = depthAxis >= 0 ? 'front' : 'back';
    card.classList.add('is-orbiting');
  });

  orbitFrame = requestAnimationFrame(renderSkillOrbit);
}

function restartOrbit() {
  cancelAnimationFrame(orbitFrame);
  orbitStart = performance.now();
  if (window.innerWidth > 680) {
    orbitFrame = requestAnimationFrame(renderSkillOrbit);
  } else {
    orbitCards.forEach((card) => {
      card.style.removeProperty('transform');
      card.style.removeProperty('--orbit-z');
      card.style.removeProperty('--orbit-blur');
      card.style.removeProperty('opacity');
      delete card.dataset.orbitSide;
    });
  }
}

if (orbitStage) {
  orbitStage.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 680 || event.button !== 0 || event.target.closest('.skill-float')) return;
    isOrbitDragging = true;
    suppressCardClick = false;
    inertiaVelocity = 0;
    dragStartX = event.clientX;
    lastDragX = event.clientX;
    lastDragTime = performance.now();
    dragStartAngle = orbitAngleOffset;
    orbitStage.classList.add('is-dragging');
    orbitStage.setPointerCapture(event.pointerId);
  });

  orbitStage.addEventListener('pointermove', (event) => {
    if (!isOrbitDragging) return;
    const dx = event.clientX - dragStartX;
    if (Math.abs(dx) > 4) suppressCardClick = true;
    orbitAngleOffset = dragStartAngle + dx * 0.008;
    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime);
    dragVelocity = ((event.clientX - lastDragX) * 0.008) / dt;
    lastDragX = event.clientX;
    lastDragTime = now;
  });

  const endDrag = (event) => {
    if (!isOrbitDragging) return;
    isOrbitDragging = false;
    inertiaVelocity = dragVelocity;
    orbitStage.classList.remove('is-dragging');
    if (orbitStage.hasPointerCapture?.(event.pointerId)) orbitStage.releasePointerCapture(event.pointerId);
  };
  orbitStage.addEventListener('pointerup', endDrag);
  orbitStage.addEventListener('pointercancel', endDrag);
}

restartOrbit();
window.addEventListener('resize', restartOrbit);
reduceMotion.addEventListener?.('change', restartOrbit);

// Hover/focus pauses the orbit in its current position only.
orbitCards.forEach((card) => {
  card.setAttribute('tabindex', '0');
  const enter = () => { orbitPaused = true; card.classList.add('is-hovered'); };
  const leave = () => { orbitPaused = false; card.classList.remove('is-hovered'); };
  card.addEventListener('pointerenter', enter);
  card.addEventListener('pointerleave', leave);
  card.addEventListener('focus', enter);
  card.addEventListener('blur', leave);
});

// Activate in-place portfolio motion only while the portfolio grid intersects
// a narrow band around the exact vertical center of the viewport.
const portfolioGrid = document.querySelector('.portfolio-grid');
if (portfolioGrid) {
  const portfolioCenterObserver = new IntersectionObserver(
    ([entry]) => portfolioGrid.classList.toggle('is-centered', entry.isIntersecting),
    { root: null, rootMargin: '-47% 0px -47% 0px', threshold: 0 }
  );
  portfolioCenterObserver.observe(portfolioGrid);
}

// Skill details modal and inquiry form.
const skillModal = document.querySelector('#skill-modal');
const modalTitle = document.querySelector('#skill-modal-title');
const modalKicker = document.querySelector('#skill-modal-kicker');
const modalDescription = document.querySelector('#skill-modal-description');
const skillNameInput = document.querySelector('#skill-name');
const skillMessage = document.querySelector('#skill-message');
const skillForm = document.querySelector('#skill-inquiry-form');
const skillFormStatus = document.querySelector('#skill-form-status');

function openSkillModal(card) {
  const title = card.querySelector('h3')?.textContent.trim() || 'Creative service';
  const kicker = card.querySelector('small')?.textContent.trim() || 'Creative service';
  const description = card.querySelector('p')?.textContent.trim() || '';
  modalTitle.textContent = title;
  modalKicker.textContent = kicker;
  modalDescription.textContent = description;
  skillNameInput.value = title;
  skillFormStatus.textContent = '';
  skillModal.classList.add('is-open');
  skillModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => skillMessage.focus(), 80);
}
function closeSkillModal() {
  skillModal.classList.remove('is-open');
  skillModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}
orbitCards.forEach((card) => {
  card.addEventListener('click', () => { if (suppressCardClick) { suppressCardClick = false; return; } openSkillModal(card); });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSkillModal(card); }
  });
});
document.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', closeSkillModal));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && skillModal.classList.contains('is-open')) closeSkillModal(); });
skillForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const skill = skillNameInput.value;
  const message = skillMessage.value.trim();
  if (!message) return;
  const subject = encodeURIComponent(`Portfolio inquiry: ${skill}`);
  const body = encodeURIComponent(`Service: ${skill}\n\nProject details:\n${message}`);
  skillFormStatus.textContent = 'Opening your email app…';
  window.location.href = `mailto:joseph@example.com?subject=${subject}&body=${body}`;
});


// Scroll-driven Y-axis displacement for the page's major visual elements.
// CSS individual translate is used so existing orbit and reveal transforms remain intact.
const scrollParallaxElements = [...document.querySelectorAll(
  '.profile-card, .section-heading, .skills-orbit, .project-card, .video-shell, .embed-note, .cta'
)];
scrollParallaxElements.forEach((element, index) => {
  element.classList.add('scroll-parallax');
  element.dataset.scrollSpeed = String(0.018 + (index % 5) * 0.008);
});

let parallaxTicking = false;
function updateScrollParallax() {
  const viewportCenter = window.innerHeight / 2;
  scrollParallaxElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const elementCenter = rect.top + rect.height / 2;
    const distance = elementCenter - viewportCenter;
    const speed = Number(element.dataset.scrollSpeed || 0.02);
    const shift = Math.max(-42, Math.min(42, -distance * speed));
    element.style.translate = `0 ${shift.toFixed(2)}px`;
  });
  parallaxTicking = false;
}
window.addEventListener('scroll', () => {
  if (!parallaxTicking) {
    parallaxTicking = true;
    requestAnimationFrame(updateScrollParallax);
  }
}, { passive: true });
window.addEventListener('resize', updateScrollParallax);
updateScrollParallax();

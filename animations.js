// Animations de l'accueil : barre de progression + apparition au scroll
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var root = document.documentElement;
  root.classList.add('js-anim');

  var bar = document.createElement('div');
  bar.className = 'scroll-bar';
  document.body.appendChild(bar);
  var ticking = false;
  function update() {
    var max = root.scrollHeight - root.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? root.scrollTop / max : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  if (!('IntersectionObserver' in window)) { root.classList.remove('js-anim'); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  var groups = [
    '.quick-card', '.featured .wrap > *', '.categories .wrap > *', '.events .wrap > *',
    '.community .wrap > *', '.how-head', '.steps li', '.regions .wrap > *'
  ];
  groups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) {
      el.classList.add('rv');
      if (sel === '.quick-card' || sel === '.steps li') el.style.transitionDelay = (i * 130) + 'ms';
      io.observe(el);
    });
  });
})();
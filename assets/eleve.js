/* Section « L'élève » : lance l'animation d'entrée quand la section arrive à l'écran.
   Sans JavaScript, ou si l'utilisateur préfère moins d'animations, tout reste affiché normalement. */
(function () {
  var section = document.querySelector('.eleve');
  if (!section || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  section.classList.add('eleve--anim');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { section.classList.add('is-in'); io.disconnect(); }
    });
  }, { threshold: 0.25 });
  io.observe(section);
})();

/* "Le centre" photos: centered carousel (dots, tap a side photo to center it). */
(function () {
  // Centered carousel: native scroll-snap swipe; dots + active slide follow the scroll position.
  document.querySelectorAll('[data-peek]').forEach(function (root) {
    var track = root.querySelector('.peek-track');
    var slides = Array.prototype.slice.call(track.children);
    var dotsBox = root.querySelector('.peek-dots');
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'peek-dot';
      b.setAttribute('aria-label', 'Photo ' + (i + 1) + ' sur ' + slides.length);
      b.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(b);
    });
    var dots = dotsBox.children, current = -1;

    function go(i) {
      var el = slides[i];
      track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    }
    function centered() {
      var mid = track.scrollLeft + track.clientWidth / 2, best = 0, d = Infinity;
      slides.forEach(function (s, i) { var x = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (x < d) { d = x; best = i; } });
      return best;
    }
    function update() {
      var i = centered();
      if (i === current) return;
      current = i;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      Array.prototype.forEach.call(dots, function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    // Tapping a side photo brings it to the center.
    slides.forEach(function (s, i) { s.addEventListener('click', function () { if (i !== current) go(i); }); });
    window.addEventListener('resize', function () { current = -1; update(); });
    update();
  });
})();

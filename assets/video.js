/* Présentation vidéo (Wistia), chargée en différé.
   La page affiche d'abord une image d'aperçu légère (.vsl-facade). Le lecteur Wistia (plusieurs centaines de Ko)
   se charge ensuite : au clic sur l'aperçu, ou quand la page a fini de charger et que le navigateur est libre.
   Suivi Meta/GTM : VideoPlay, VideoProgress (25/50/75 %) et VideoComplete via window.arcadiaTrack. */
(function () {
  var frame = document.querySelector('.vsl-frame[data-wistia]');
  if (!frame) return;
  var mediaId = frame.getAttribute('data-wistia');
  var facade = frame.querySelector('.vsl-facade');
  var player = null, wantsPlay = false;

  var track = function (name, params) { if (window.arcadiaTrack) window.arcadiaTrack(name, params); };

  function addScript(src, isModule) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    if (isModule) s.type = 'module';
    document.head.appendChild(s);
  }

  function bindTracking(p) {
    var started = false, sent = {};
    p.addEventListener('play', function () {
      if (!started) { started = true; track('VideoPlay', { video: 'presentation' }); }
    });
    p.addEventListener('time-update', function () {
      var d = p.duration;
      if (!d) return;
      var pct = (p.currentTime / d) * 100;
      [25, 50, 75].forEach(function (q) {
        if (pct >= q && !sent[q]) { sent[q] = true; track('VideoProgress', { video: 'presentation', percent: q }); }
      });
    });
    p.addEventListener('ended', function () {
      if (!sent.done) { sent.done = true; track('VideoComplete', { video: 'presentation' }); }
    });
  }

  // The player sits under the preview image; the preview is removed once the player is ready (no blank flash).
  function load() {
    if (player) return;
    player = document.createElement('wistia-player');
    player.setAttribute('media-id', mediaId);
    player.setAttribute('aspect', '1.7777777777777777');
    player.setAttribute('player-color', 'E8A33D');
    if (wantsPlay) player.setAttribute('autoplay', '');
    bindTracking(player);
    var ready = function () {
      if (frame.classList.contains('is-ready')) return;
      frame.classList.add('is-ready');
      if (wantsPlay && player.play) { try { player.play(); } catch (e) {} }
    };
    player.addEventListener('api-ready', ready);
    player.addEventListener('play', ready);
    // Fallback if "api-ready" never comes: reveal the player shortly after the component is defined.
    if (window.customElements) customElements.whenDefined('wistia-player').then(function () { setTimeout(ready, 1500); });
    frame.insertBefore(player, facade);
    addScript('https://fast.wistia.com/player.js');
    addScript('https://fast.wistia.com/embed/' + mediaId + '.js', true);
  }

  facade.addEventListener('click', function () {
    wantsPlay = true;
    frame.classList.add('is-loading');
    if (!player) load();
    else if (frame.classList.contains('is-ready') && player.play) player.play();
    else player.setAttribute('autoplay', '');
  });

  // Preload the player once the page is fully loaded and idle, so a later tap starts playback at once.
  function idle() {
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2500);
  }
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle);
})();

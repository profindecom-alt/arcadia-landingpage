/* Renders real testimonials from ARCADIA_CONFIG.testimonials. Section stays hidden while the list is empty. */
(function () {
  var list = ((window.ARCADIA_CONFIG || {}).testimonials || []).filter(function (t) { return t && t.texte && t.nom; });
  var section = document.getElementById('avis');
  if (!section || !list.length) return;

  var wrap = section.querySelector('.proof-list');
  list.forEach(function (t) {
    var fig = document.createElement('figure');
    fig.className = 'proof';

    var mark = document.createElement('span');
    mark.className = 'proof-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '“';

    var quote = document.createElement('blockquote');
    quote.textContent = t.texte;

    var cap = document.createElement('figcaption');
    var name = document.createElement('strong');
    name.textContent = t.nom;
    cap.appendChild(name);
    var meta = [t.details, t.resultat].filter(Boolean).join(' · ');
    if (meta) cap.appendChild(document.createTextNode(' · ' + meta));

    fig.appendChild(mark);
    fig.appendChild(quote);
    fig.appendChild(cap);
    wrap.appendChild(fig);
  });
  section.hidden = false;
})();

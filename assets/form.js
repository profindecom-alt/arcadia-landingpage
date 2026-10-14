/* Lead form → n8n webhook → thank-you page. */
(function () {
  var cfg = window.ARCADIA_CONFIG || {};
  var TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'];

  function store(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function load(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; } }

  // Keep the ad click parameters from the landing URL for the whole visit.
  var attribution = load('arcadia_attribution') || {};
  var params = new URLSearchParams(location.search);
  TRACKING_KEYS.forEach(function (k) { if (params.get(k)) attribution[k] = params.get(k); });
  if (!attribution.landing_url) attribution.landing_url = location.href;
  if (!attribution.referrer && document.referrer) attribution.referrer = document.referrer;
  store('arcadia_attribution', attribution);

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Moroccan numbers: 06/07/05 + 8 digits, or +212 / 00212 + 9 digits → E.164 (+2126XXXXXXXX).
  function normalizePhone(raw) {
    var d = String(raw).replace(/[\s.\-()]/g, '');
    var m = d.match(/^(?:\+212|00212|212|0)([5-7]\d{8})$/);
    return m ? '+212' + m[1] : null;
  }
  // Local Moroccan format for the call team: +212612345678 → "06 12 34 56 78".
  function localPhone(e164) {
    return ('0' + e164.slice(4)).replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
  }

  // Ad-set message match: ?niveau=2bac pre-selects the level in step 2.
  var NIVEAUX = { 'tc': 'T.Commun', '1bac': '1 Bac', '2bac': '2 Bac', 'autre': 'Autre' };

  // Filières offered for each niveau. T.Commun and "Autre" have no filière question (straight to the subjects).
  var FILIERES = {
    '1 Bac': ['Sciences Math', 'Sciences Expérimentales', 'Autre'],
    '2 Bac': ['PC', 'SVT', 'Sciences Math', 'Autre']
  };

  // Réduction selon le nombre total de matières (sciences et lettres confondues) :
  // 1 → 0 %, 2 → 10 %, 3 → 15 %, 4 ou plus → 20 %.
  function savingsPct(n) { return n >= 4 ? 20 : n === 3 ? 15 : n === 2 ? 10 : 0; }
  var SAVINGS_HINT = [
    'Plus vous choisissez de matières, plus la réduction est grande.',
    'Ajoutez une autre matière pour bénéficier d\'une réduction.',
    'Ajoutez-en une 3e pour passer à −15 %.',
    'Encore une matière et c\'est −20 %.',
    'Vous profitez de la réduction maximale.'
  ];

  // Webhook POST with a 15 s timeout.
  function post(payload) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
    }).finally(function () { if (timer) clearTimeout(timer); });
  }
  // The form is the only contact channel: retry once before giving up.
  function postWithRetry(payload) {
    return post(payload).catch(function () {
      return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return post(payload); });
    });
  }

  // Two steps, one lead_id: step 1 → webhook statut "partiel", step 2 → statut "total" + thank-you page.
  // n8n should upsert on lead_id.
  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    var nom = form.querySelector('[name="nom"]');
    var tel = form.querySelector('[name="telephone"]');
    var ville = form.querySelector('[name="ville"]');
    var submit = form.querySelector('[type="submit"]');
    var submitLabel = form.querySelector('.form-submit-label');
    var backBtn = form.querySelector('.form-back');
    var steps = form.querySelectorAll('.form-step');
    var alertBox = form.querySelector('.form-alert');
    var filiereField = form.querySelector('[data-filiere-field]');
    var filiereBox = form.querySelector('[data-filieres]');
    var matieresField = form.querySelector('[data-matieres-field]');
    var savings = form.querySelector('.savings');
    var step = 1, sending = false, leadId = null, base = null, leadTracked = false;
    var partial = Promise.resolve();

    // First interaction with the form → one "FormStart" signal for the ad platforms.
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      if (window.arcadiaTrack) window.arcadiaTrack('FormStart', { formulaire: form.getAttribute('data-lead-form') });
    });

    function setError(input, msg) {
      var el = document.getElementById(input.getAttribute('aria-describedby'));
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (el) el.textContent = msg || '';
    }
    function setGroupError(name, msg) {
      var el = form.querySelector('[data-error-for="' + name + '"]');
      if (el) el.textContent = msg || '';
    }
    function checked(name) { return (form.querySelector('[name="' + name + '"]:checked') || {}).value || ''; }
    function selectedSubjects() {
      return Array.prototype.map.call(form.querySelectorAll('[name="matieres"]:checked'), function (i) { return i.value; });
    }
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    }
    function radio(name, value) {
      var i = el('input'); i.type = 'radio'; i.name = name; i.value = value;
      return i;
    }

    nom.addEventListener('input', function () { setError(nom, ''); });
    tel.addEventListener('input', function () { setError(tel, ''); });
    ville.addEventListener('input', function () { setError(ville, ''); });

    function updateSavings() {
      var n = selectedSubjects().length, pct = savingsPct(n);
      savings.querySelectorAll('.savings-bar i').forEach(function (b, i) { b.classList.toggle('on', i < n); });
      savings.classList.toggle('is-on', pct > 0);
      savings.querySelector('[data-savings-label]').textContent = !n ? 'Choisissez :' : pct ? '−' + pct + ' %' : '0 %';
      savings.querySelector('[data-savings-hint]').textContent = SAVINGS_HINT[Math.min(n, 4)];
    }

    function showMatieres(show) {
      matieresField.hidden = !show;
      if (show) return;
      form.querySelectorAll('[name="matieres"]').forEach(function (i) { i.checked = false; });
      setGroupError('matieres', '');
      updateSavings();
    }

    // Filière: options depend on the niveau. "Autre" goes straight to the subjects.
    function renderFilieres(niveau) {
      filiereBox.textContent = '';
      setGroupError('filiere', '');
      setGroupError('matieres', '');
      var list = FILIERES[niveau];
      filiereField.hidden = !list;
      showMatieres(!!niveau && !list);
      (list || []).forEach(function (nom) {
        var l = el('label');
        l.appendChild(radio('filiere', nom));
        l.appendChild(el('span', '', nom));
        filiereBox.appendChild(l);
      });
    }

    form.addEventListener('change', function (e) {
      var name = e.target.name;
      setGroupError(name, '');
      if (name === 'niveau') renderFilieres(e.target.value);
      if (name === 'filiere') showMatieres(true);
      if (name === 'matieres') updateSavings();
    });

    var pNiveau = NIVEAUX[(params.get('niveau') || '').toLowerCase()];
    if (pNiveau) {
      form.querySelector('[name="niveau"][value="' + pNiveau + '"]').checked = true;
      renderFilieres(pNiveau);
    }

    // "Lead" = phone number received (step 1). Fired once per lead_id.
    function trackLead() {
      if (leadTracked || !window.arcadiaTrack) return;
      leadTracked = true;
      window.arcadiaTrack('Lead', { content_name: "Séance d'essai gratuite – Arcadia Academy" }, leadId);
    }

    function setBusy(busy) {
      sending = busy;
      submit.disabled = busy;
      form.classList.toggle('is-sending', busy);
    }

    function showStep(n) {
      step = n;
      steps.forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(n); });
      submitLabel.textContent = n === 1 ? 'Envoyer' : 'Valider ma demande';
      backBtn.hidden = n === 1;
      alertBox.hidden = true;
    }

    // Step 1: nom complet, téléphone, ville → webhook "partiel", then step 2 right away.
    function submitStep1() {
      var name = nom.value.trim().replace(/\s+/g, ' ');
      var phone = normalizePhone(tel.value);
      var city = ville.value.trim();

      var firstInvalid = null;
      if (name.length < 2) { setError(nom, 'Indiquez votre nom complet.'); firstInvalid = firstInvalid || nom; }
      if (!phone) { setError(tel, 'Numéro invalide. Exemple : 06 12 34 56 78'); firstInvalid = firstInvalid || tel; }
      if (city.length < 2) { setError(ville, 'Indiquez votre ville.'); firstInvalid = firstInvalid || ville; }
      if (firstInvalid) { firstInvalid.focus(); return; }

      // Honeypot filled → silently pretend success for bots.
      if (form.querySelector('[name="website"]').value) { location.href = cfg.thankYouUrl || 'merci.html'; return; }

      leadId = leadId || uuid();
      base = Object.assign({
        lead_id: leadId,
        nom: name,
        telephone: phone,
        telephone_local: localPhone(phone),
        telephone_saisi: tel.value.trim(),
        ville: city,
        offre: 'seance_essai_gratuite',
        formulaire: form.getAttribute('data-lead-form'),
        version: document.documentElement.getAttribute('data-version') || 'v1',
        page_url: location.href,
        user_agent: navigator.userAgent,
        fbp: cookie('_fbp'),
        fbc: cookie('_fbc') || (attribution.fbclid ? 'fb.1.' + Date.now() + '.' + attribution.fbclid : '')
      }, attribution);

      // Sent in the background: step 2 shows immediately while the lead is saved.
      partial = postWithRetry(Object.assign({}, base, { statut: 'partiel', etape: 1, submitted_at: new Date().toISOString() }))
        .then(trackLead, function (err) { console.error('[arcadia] envoi partiel impossible :', err); });

      form.querySelector('[data-lead-prenom]').textContent = name.split(' ')[0];
      showStep(2);
      var card = form.closest('.form-card') || form;
      if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' });
      form.querySelector('.step2-title').focus({ preventScroll: true });
    }

    // Step 2: niveau → filière → matières → webhook "total", then thank-you page.
    function submitStep2() {
      var niveau = checked('niveau');
      var filiere = checked('filiere');
      var matieres = selectedSubjects();

      var missing = null;
      if (!niveau) { setGroupError('niveau', 'Choisissez le niveau.'); missing = 'niveau'; }
      else if (FILIERES[niveau] && !filiere) { setGroupError('filiere', 'Choisissez la filière.'); missing = 'filiere'; }
      else if (!matieres.length) { setGroupError('matieres', 'Choisissez au moins une matière.'); missing = 'matieres'; }
      if (missing) { form.querySelector('[name="' + missing + '"]').focus(); return; }

      setBusy(true);
      var payload = Object.assign({}, base, {
        statut: 'total',
        etape: 2,
        niveau: niveau,
        filiere: filiere,
        matieres: matieres,
        reduction: savingsPct(matieres.length),
        submitted_at: new Date().toISOString()
      });

      // Wait for the partial send so "total" always reaches n8n last.
      partial.then(function () { return postWithRetry(payload); }).then(function () {
        trackLead();
        store('arcadia_lead', { id: leadId, prenom: base.nom.split(' ')[0], niveau: niveau, filiere: filiere, matieres: matieres });
        var url = (cfg.thankYouUrl || 'merci.html');
        location.href = url + (url.indexOf('?') < 0 ? '?' : '&') + 'lead=' + encodeURIComponent(leadId);
      }).catch(function (err) {
        console.error('[arcadia] envoi du formulaire impossible :', err);
        alertBox.querySelector('.form-alert-msg').textContent = 'L’envoi n’a pas abouti. Vérifiez votre connexion internet puis appuyez à nouveau sur « Valider ma demande ».';
        alertBox.hidden = false;
        setBusy(false);
      });
    }

    backBtn.addEventListener('click', function () { showStep(1); nom.focus(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      alertBox.hidden = true;
      if (step === 1) submitStep1(); else submitStep2();
    });
  });

  // Mobile sticky CTA: hide while the form (or footer) is on screen.
  var sticky = document.querySelector('.sticky-cta');
  var watched = document.querySelectorAll('#inscription, .final-cta, .footer-halo');
  if (sticky && watched.length && 'IntersectionObserver' in window) {
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? visible.add(en.target) : visible.delete(en.target); });
      sticky.classList.toggle('is-hidden', visible.size > 0);
    }, { threshold: 0.15 });
    watched.forEach(function (el) { io.observe(el); });
  }
})();

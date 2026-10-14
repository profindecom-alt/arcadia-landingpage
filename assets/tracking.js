/* Loads Meta Pixel, Google Tag Manager and Microsoft Clarity only when their IDs are set in config.js,
   and exposes window.arcadiaTrack(name, params, eventId) for all of them. */
(function () {
  var cfg = window.ARCADIA_CONFIG || {};
  window.dataLayer = window.dataLayer || [];

  if (cfg.clarityId) {
    /* Standard Microsoft Clarity tag */
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', cfg.clarityId);
    // Filter recordings by landing version (v1 / v2 / v3 / v4) in the Clarity dashboard.
    window.clarity('set', 'version', document.documentElement.getAttribute('data-version') || 'merci');
  }

  if (cfg.gtmId) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(cfg.gtmId);
    document.head.appendChild(g);
  }

  if (cfg.metaPixelId) {
    /* Standard Meta Pixel bootstrap */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', cfg.metaPixelId);
    window.fbq('track', 'PageView');
  }

  // Meta event names map to GA4-style dataLayer events. Non-standard names go through trackCustom.
  var GA_EVENT = { Lead: 'generate_lead', CompleteRegistration: 'form_complete', Contact: 'contact', FormStart: 'form_start', ViewContent: 'form_view', CTAClick: 'cta_click' };
  var META_STANDARD = { Lead: 1, CompleteRegistration: 1, Contact: 1, ViewContent: 1, Schedule: 1, SubmitApplication: 1 };

  window.arcadiaTrack = function (name, params, eventId) {
    params = params || {};
    try {
      if (window.fbq) {
        var method = META_STANDARD[name] ? 'track' : 'trackCustom';
        if (eventId) window.fbq(method, name, params, { eventID: eventId });
        else window.fbq(method, name, params);
      }
      window.dataLayer.push(Object.assign({ event: GA_EVENT[name] || name, event_id: eventId }, params));
      // Same events in Clarity: filter recordings by "Lead", "FormStart", "CTAClick"…
      if (window.clarity) {
        window.clarity('event', name);
        if (name === 'Lead' || name === 'CompleteRegistration') window.clarity('upgrade', name);
      }
    } catch (e) { /* tracking must never break the page */ }
  };

  // Tracked clicks: <a data-track="Contact" data-channel="telephone">
  // CTA buttons to the form: "CTAClick" with the button's place on the page (data-cta, or its zone).
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var a = e.target.closest('[data-track]');
    if (a) window.arcadiaTrack(a.getAttribute('data-track'), { channel: a.getAttribute('data-channel') || '' });
    var cta = e.target.closest('a[href="#inscription"]');
    if (cta) {
      var zone = cta.getAttribute('data-cta') ||
        (cta.closest('.sticky-cta') && 'sticky') || (cta.closest('.site-header') && 'header') ||
        (cta.closest('.hero') && 'hero') || 'autre';
      window.arcadiaTrack('CTAClick', { cta: zone });
    }
  });

  // Form seen on screen (once per page view) → "ViewContent", so the ad sets can optimise on real interest.
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('inscription');
    if (!form || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      window.arcadiaTrack('ViewContent', { content_name: 'Formulaire inscription', content_category: document.documentElement.getAttribute('data-version') || 'v1' });
    }, { threshold: 0.4 });
    io.observe(form);
  });
})();

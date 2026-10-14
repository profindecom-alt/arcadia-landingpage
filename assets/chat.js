/* Thank-you page assistant (simple in-page chat) → n8n chat webhook. */
(function () {
  var cfg = window.ARCADIA_CONFIG || {};
  var root = document.getElementById('chat');
  if (!root || !cfg.chatbotUrl) return;

  var SESSION_KEY = 'arcadia_chat_session';
  var FALLBACK = "Désolé, je n'arrive pas à répondre pour le moment. Pas d'inquiétude : notre équipe vous rappelle très vite pour répondre à toutes vos questions.";

  function load(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (e) { return null; } }
  function store(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Same lead as the form, so n8n can tie the conversation to the CRM row.
  var lead = load('arcadia_lead') || {};
  var leadId = new URLSearchParams(location.search).get('lead') || lead.id || '';
  var sessionId = load(SESSION_KEY) || leadId || uuid();
  store(SESSION_KEY, sessionId);

  // Fresh chat on every visit: only the opening question, never old or automatic messages.
  try { sessionStorage.removeItem('arcadia_chat_history'); } catch (e) {}
  var sent = 0;
  var busy = false;

  // Agent replies are often light Markdown: escape, then **bold**, links, line breaks.
  function format(text) {
    var html = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return html.replace(/\n/g, '<br>');
  }

  // n8n replies come in several shapes depending on the last node.
  function extractReply(data) {
    if (Array.isArray(data)) data = data[0];
    if (typeof data === 'string') return data.trim();
    if (!data || typeof data !== 'object') return '';
    if (data.json) data = data.json;
    var keys = ['output', 'text', 'reply', 'response', 'answer', 'message'];
    for (var i = 0; i < keys.length; i++) {
      var v = data[keys[i]];
      if (typeof v === 'string' && v.trim() && v !== 'Workflow was started') return v.trim();
    }
    return '';
  }

  function ask(message) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 45000);
    return fetch(cfg.chatbotUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId: sessionId,
        chatInput: message,
        lead_id: leadId || undefined,
        prenom: lead.prenom || undefined,
        niveau: lead.niveau || undefined,
        filiere: lead.filiere || undefined,
        formule: lead.formule || undefined,
        matieres: lead.matieres && lead.matieres.length ? lead.matieres : undefined,
        page: 'merci'
      }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (body) {
      var data; try { data = JSON.parse(body); } catch (e) { data = body; }
      return extractReply(data);
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  // ── DOM ──
  root.innerHTML =
    '<div class="chat-log" aria-live="polite"></div>' +
    '<form class="chat-form" autocomplete="off">' +
      '<label class="sr-only" for="chat-input">Votre question</label>' +
      '<textarea id="chat-input" rows="1" maxlength="1000" placeholder="Écrivez votre question…"></textarea>' +
      '<button type="submit" class="chat-send" aria-label="Envoyer">' +
        '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
      '</button>' +
    '</form>';
  root.hidden = false;

  var log = root.querySelector('.chat-log');
  var form = root.querySelector('.chat-form');
  var input = root.querySelector('#chat-input');
  var send = root.querySelector('.chat-send');

  var AVATAR = '<span class="chat-ava" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg></span>';

  // Bot messages sit next to a small avatar. Scroll the log only (never the page).
  function bubble(role, text) {
    var msg = document.createElement('div');
    msg.className = 'chat-msg chat-msg--' + role;
    if (role === 'bot') msg.innerHTML = format(text); else msg.textContent = text;
    var el = msg;
    if (role === 'bot') {
      el = document.createElement('div');
      el.className = 'chat-row';
      el.innerHTML = AVATAR;
      el.appendChild(msg);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // Opening line, shown only: nothing is sent to n8n until the visitor writes.
  bubble('bot', "Est-ce que vous avez une question en attendant l'appel ?");

  function submit(text) {
    text = text.trim();
    if (!text || busy) return;
    if (!sent++) window.arcadiaTrack && window.arcadiaTrack('Contact', { content_name: 'Assistant – page merci' });
    busy = true; send.disabled = true;
    input.value = ''; autosize();
    bubble('user', text);

    var typing = bubble('bot', '');
    var dots = typing.querySelector('.chat-msg');
    dots.classList.add('chat-typing');
    dots.innerHTML = '<i></i><i></i><i></i>';
    dots.setAttribute('aria-label', 'L\'assistant écrit…');

    ask(text).catch(function () { return ''; }).then(function (reply) {
      typing.remove();
      reply = reply || FALLBACK;
      bubble('bot', reply);
      busy = false; send.disabled = false;
    });
  }

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); submit(input.value); });
})();

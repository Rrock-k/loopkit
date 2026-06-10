(function () {
  'use strict';

  var LOOPKIT_VERSION = '0.0.1';
  var host;
  var root;
  var state = {
    mode: null,
    hoverTarget: null,
    composer: null,
    meta: null,
    decisions: [],
    events: []
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
  }

  function safeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readMeta() {
    var script = document.querySelector('script[type="application/loopkit+json"], script[type="application/loopkit+meta"]');
    var parsed = {};
    if (script && script.textContent.trim()) {
      try {
        parsed = JSON.parse(script.textContent);
      } catch (error) {
        console.warn('[LoopKit] Failed to parse metadata JSON', error);
      }
    }
    return {
      artifact_id: parsed.artifact_id || parsed.artifactId || document.documentElement.getAttribute('data-loop-artifact-id') || 'artifact',
      artifact_version: parsed.artifact_version || parsed.artifactVersion || document.documentElement.getAttribute('data-loop-artifact-version') || 'v1',
      project_id: parsed.project_id || parsed.projectId || 'default',
      title: parsed.title || document.title || 'LoopKit Artifact'
    };
  }

  function readDecisions() {
    var node = document.getElementById('loopkit-decisions') || document.querySelector('script[type="text/loopkit-decisions"]');
    if (!node) return [];
    return node.textContent
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line && !/^DECISIONS:?$/i.test(line); })
      .map(function (line) { return line.replace(/^-\s*/, ''); });
  }

  function storageKey() {
    return 'loopkit:feedback:' + state.meta.artifact_id + ':' + state.meta.artifact_version;
  }

  function loadEvents() {
    try {
      state.events = JSON.parse(localStorage.getItem(storageKey()) || '[]');
      if (!Array.isArray(state.events)) state.events = [];
    } catch (error) {
      state.events = [];
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state.events));
    } catch (error) {
      console.warn('[LoopKit] Failed to save events', error);
    }
  }

  function getTargets() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-loop-id]')).filter(function (el) {
      return !el.closest('[data-loop-ignore]');
    });
  }

  function closestTarget(el) {
    if (!el || el === document || el === window) return null;
    var target = el.closest && el.closest('[data-loop-id]');
    if (!target || target.closest('[data-loop-ignore]')) return null;
    return target;
  }

  function selectorFor(el) {
    var id = el.getAttribute('data-loop-id');
    if (id) return '[data-loop-id="' + cssEscape(id) + '"]';
    return '';
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function targetPayload(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    return {
      loop_id: el.getAttribute('data-loop-id'),
      kind: el.getAttribute('data-loop-kind') || el.tagName.toLowerCase(),
      title: el.getAttribute('data-loop-title') || safeText(el.textContent).slice(0, 80) || el.tagName.toLowerCase(),
      selector: selectorFor(el),
      text_quote: safeText(el.textContent).slice(0, 260),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  }

  function createHost() {
    host = document.createElement('div');
    host.setAttribute('data-loopkit-root', '');
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '' +
      '<style>' + styles() + '</style>' +
      '<div class="lk-toolbar" part="toolbar">' +
      '  <button data-mode="markup" title="Выбрать элемент и оставить фидбэк">Mark up</button>' +
      '  <button data-mode="comments" title="Оставить свободный комментарий на экране">Comments</button>' +
      '  <button data-action="export" title="Скопировать feedback bundle">Export</button>' +
      '</div>' +
      '<div class="lk-highlight" hidden></div>' +
      '<div class="lk-pins"></div>' +
      '<div class="lk-toast" hidden></div>';

    root.querySelector('[data-mode="markup"]').addEventListener('click', function () { setMode(state.mode === 'markup' ? null : 'markup'); });
    root.querySelector('[data-mode="comments"]').addEventListener('click', function () { setMode(state.mode === 'comments' ? null : 'comments'); });
    root.querySelector('[data-action="export"]').addEventListener('click', function () { copyBundle(); });
  }

  function styles() {
    return [
      ':host{all:initial;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#151515}',
      '*{box-sizing:border-box}',
      '.lk-toolbar{pointer-events:auto;position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;padding:5px;background:rgba(255,255,255,.92);border:1px solid rgba(20,20,20,.12);border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.10);backdrop-filter:blur(14px)}',
      'button{font:500 13px/1.1 inherit;color:#202020;background:transparent;border:0;border-radius:10px;padding:8px 10px;cursor:pointer}',
      'button:hover{background:#f2f2f0}',
      'button.is-active{background:#161616;color:white}',
      '.lk-highlight{position:fixed;pointer-events:none;border:2px solid #2563eb;border-radius:10px;background:rgba(37,99,235,.055);box-shadow:0 0 0 4px rgba(37,99,235,.10)}',
      '.lk-highlight::before{content:attr(data-title);position:absolute;left:-2px;top:-28px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border-radius:8px;background:#111;color:white;font:500 12px/1 inherit}',
      '.lk-composer{pointer-events:auto;position:fixed;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid rgba(20,20,20,.14);border-radius:16px;box-shadow:0 18px 58px rgba(0,0,0,.18);padding:12px}',
      '.lk-composer-title{font:650 13px/1.25 inherit;margin:0 0 8px;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      'textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #d9d9d6;border-radius:12px;padding:10px;font:400 14px/1.4 inherit;outline:none;color:#111;background:#fff}',
      'textarea:focus{border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,.06)}',
      '.lk-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}',
      '.lk-actions .lk-primary{background:#111;color:white}',
      '.lk-pin{pointer-events:none;position:fixed;width:22px;height:22px;border-radius:999px;background:#111;color:white;display:grid;place-items:center;font:700 12px/1 inherit;box-shadow:0 7px 18px rgba(0,0,0,.24);transform:translate(-50%,-50%)}',
      '.lk-pin.is-free{background:#2563eb}',
      '.lk-toast{pointer-events:none;position:fixed;right:16px;bottom:16px;padding:9px 12px;border-radius:12px;background:#111;color:#fff;font:500 13px/1.25 inherit;box-shadow:0 12px 28px rgba(0,0,0,.18)}'
    ].join('\n');
  }

  function setMode(mode) {
    state.mode = mode;
    root.querySelectorAll('[data-mode]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-mode') === mode);
    });
    hideComposer();
    updateHighlight(null);
    if (mode === 'markup') toast('Кликни элемент с data-loop-id');
    if (mode === 'comments') toast('Кликни в место для комментария');
  }

  function updateHighlight(el) {
    var box = root.querySelector('.lk-highlight');
    if (!el) {
      box.hidden = true;
      return;
    }
    var rect = el.getBoundingClientRect();
    box.hidden = false;
    box.style.left = Math.round(rect.left - 3) + 'px';
    box.style.top = Math.round(rect.top - 3) + 'px';
    box.style.width = Math.round(rect.width + 6) + 'px';
    box.style.height = Math.round(rect.height + 6) + 'px';
    box.dataset.title = el.getAttribute('data-loop-title') || el.getAttribute('data-loop-id') || el.tagName.toLowerCase();
  }

  function showComposer(options) {
    hideComposer();
    var composer = document.createElement('div');
    composer.className = 'lk-composer';
    composer.innerHTML = '' +
      '<div class="lk-composer-title"></div>' +
      '<textarea placeholder="Напиши фидбэк..."></textarea>' +
      '<div class="lk-actions">' +
      '  <button data-cancel>Cancel</button>' +
      '  <button class="lk-primary" data-save>Save</button>' +
      '</div>';
    root.appendChild(composer);
    state.composer = composer;

    composer.querySelector('.lk-composer-title').textContent = options.title || 'Feedback';
    var textarea = composer.querySelector('textarea');
    composer.querySelector('[data-cancel]').addEventListener('click', hideComposer);
    composer.querySelector('[data-save]').addEventListener('click', function () {
      var message = textarea.value.trim();
      if (!message) {
        textarea.focus();
        return;
      }
      addEvent(options.buildEvent(message));
      hideComposer();
      setMode(null);
      renderPins();
      toast('Saved');
    });

    var x = clamp(options.x || window.innerWidth / 2, 14, window.innerWidth - 374);
    var y = clamp(options.y || 70, 14, window.innerHeight - 190);
    composer.style.left = x + 'px';
    composer.style.top = y + 'px';
    setTimeout(function () { textarea.focus(); }, 0);
  }

  function hideComposer() {
    if (state.composer) state.composer.remove();
    state.composer = null;
  }

  function addEvent(event) {
    var full = Object.assign({
      id: uid('fb'),
      protocol: 'loopkit-event/v0',
      artifact_id: state.meta.artifact_id,
      artifact_version: state.meta.artifact_version,
      project_id: state.meta.project_id,
      page_title: document.title,
      page_url: location.href,
      created_at: new Date().toISOString()
    }, event);
    state.events.push(full);
    saveEvents();
    return full;
  }

  function renderPins() {
    var pins = root.querySelector('.lk-pins');
    pins.innerHTML = '';
    state.events.forEach(function (event, index) {
      var pin = document.createElement('div');
      pin.className = 'lk-pin' + (event.type === 'comment.pin' ? ' is-free' : '');
      pin.textContent = String(index + 1);
      var x = 18;
      var y = 18;
      if (event.type === 'markup.comment' && event.target && event.target.loop_id) {
        var el = document.querySelector('[data-loop-id="' + cssEscape(event.target.loop_id) + '"]');
        if (el) {
          var rect = el.getBoundingClientRect();
          x = rect.right;
          y = rect.top;
        } else if (event.target.rect) {
          x = event.target.rect.x + event.target.rect.width;
          y = event.target.rect.y;
        }
      }
      if (event.type === 'comment.pin' && event.position) {
        x = event.position.x;
        y = event.position.y;
      }
      pin.style.left = x + 'px';
      pin.style.top = y + 'px';
      pins.appendChild(pin);
    });
  }

  function makeBundle() {
    return {
      protocol: 'loopkit-feedback-bundle/v0',
      loopkit_version: LOOPKIT_VERSION,
      artifact: {
        id: state.meta.artifact_id,
        version: state.meta.artifact_version,
        project_id: state.meta.project_id,
        title: state.meta.title,
        url: location.href
      },
      decisions: state.decisions,
      rule: 'This feedback bundle is single-use and valid only for this artifact version.',
      items: state.events
    };
  }

  function bundleMarkdown() {
    var bundle = makeBundle();
    var lines = [];
    lines.push('# LoopKit Feedback Bundle');
    lines.push('');
    lines.push('- Artifact: `' + bundle.artifact.id + '`');
    lines.push('- Version: `' + bundle.artifact.version + '`');
    lines.push('- Title: ' + bundle.artifact.title);
    lines.push('');
    if (bundle.decisions.length) {
      lines.push('## DECISIONS');
      bundle.decisions.forEach(function (d) { lines.push('- ' + d); });
      lines.push('');
    }
    lines.push('## Feedback');
    if (!bundle.items.length) lines.push('No feedback items.');
    bundle.items.forEach(function (item, index) {
      lines.push('');
      lines.push('### ' + (index + 1) + '. ' + item.type);
      if (item.target && item.target.loop_id) lines.push('- Target: `' + item.target.loop_id + '`');
      if (item.target && item.target.title) lines.push('- Target title: ' + item.target.title);
      if (item.target && item.target.text_quote) lines.push('- Target text: ' + item.target.text_quote);
      if (item.position) lines.push('- Position: x=' + item.position.x + ', y=' + item.position.y);
      lines.push('- Message: ' + item.message);
    });
    lines.push('');
    lines.push('## Machine JSON');
    lines.push('```json');
    lines.push(JSON.stringify(bundle, null, 2));
    lines.push('```');
    return lines.join('\n');
  }

  async function copyBundle() {
    var text = bundleMarkdown();
    try {
      await navigator.clipboard.writeText(text);
      toast('Feedback bundle copied');
    } catch (error) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      toast('Feedback bundle copied');
    }
  }

  function toast(message) {
    var el = root.querySelector('.lk-toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.hidden = true; }, 1400);
  }

  function installDocumentHandlers() {
    document.addEventListener('pointermove', function (event) {
      if (state.mode !== 'markup') return;
      if (event.composedPath && event.composedPath().indexOf(host) >= 0) return;
      var target = closestTarget(document.elementFromPoint(event.clientX, event.clientY));
      state.hoverTarget = target;
      updateHighlight(target);
    }, true);

    document.addEventListener('click', function (event) {
      if (!state.mode) return;
      if (event.composedPath && event.composedPath().indexOf(host) >= 0) return;

      if (state.mode === 'markup') {
        var target = closestTarget(event.target);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        var payload = targetPayload(target);
        showComposer({
          title: payload.title,
          x: event.clientX + 12,
          y: event.clientY + 12,
          buildEvent: function (message) {
            return {
              type: 'markup.comment',
              target: payload,
              message: message
            };
          }
        });
      }

      if (state.mode === 'comments') {
        event.preventDefault();
        event.stopPropagation();
        showComposer({
          title: 'Comment pin',
          x: event.clientX + 12,
          y: event.clientY + 12,
          buildEvent: function (message) {
            return {
              type: 'comment.pin',
              target: null,
              position: { x: Math.round(event.clientX), y: Math.round(event.clientY) },
              message: message
            };
          }
        });
      }
    }, true);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        hideComposer();
        setMode(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        copyBundle();
      }
    });

    window.addEventListener('resize', function () {
      updateHighlight(state.hoverTarget);
      renderPins();
    });
    document.addEventListener('scroll', function () {
      updateHighlight(state.hoverTarget);
      renderPins();
    }, true);
  }

  function init() {
    if (window.__LOOPKIT_INITIALIZED__) return;
    window.__LOOPKIT_INITIALIZED__ = true;
    state.meta = readMeta();
    state.decisions = readDecisions();
    loadEvents();
    createHost();
    installDocumentHandlers();
    renderPins();
    window.LoopKit = {
      version: LOOPKIT_VERSION,
      getMeta: function () { return state.meta; },
      getEvents: function () { return state.events.slice(); },
      clearEvents: function () { state.events = []; saveEvents(); renderPins(); toast('Feedback cleared'); },
      addEvent: addEvent,
      exportBundle: makeBundle,
      exportMarkdown: bundleMarkdown,
      copyBundle: copyBundle
    };
    if (!getTargets().length) console.warn('[LoopKit] No data-loop-id targets found');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

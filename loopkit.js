(function () {
  'use strict';

  var LOOPKIT_VERSION = '0.1.2-portable';
  var STORAGE_PREFIX = 'loopkit:v0:';
  var state = {
    mode: null,
    meta: null,
    decisions: '',
    events: [],
    hoverTarget: null,
    composer: null,
    pins: [],
    hidden: false
  };

  var host;
  var root;
  var hoverBox;
  var toolbar;
  var feedbackButton;
  var toastTimer;

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);
  }

  function readMeta() {
    var node = $('script[type="application/loopkit+json"], script[type="application/loopkit+meta"]');
    var fallback = {
      artifactId: document.title || 'loopkit-artifact',
      artifactVersion: 'v1',
      title: document.title || 'LoopKit Artifact'
    };
    if (!node) return fallback;
    try {
      var raw = JSON.parse(node.textContent || '{}');
      return {
        artifactId: raw.artifactId || raw.artifact_id || fallback.artifactId,
        artifactVersion: raw.artifactVersion || raw.artifact_version || fallback.artifactVersion,
        title: raw.title || fallback.title,
        description: raw.description || ''
      };
    } catch (error) {
      console.warn('[LoopKit] Failed to parse metadata', error);
      return fallback;
    }
  }

  function readDecisions() {
    var node = $('#loopkit-decisions');
    return node ? (node.textContent || '').trim() : '';
  }

  function storageKey() {
    return STORAGE_PREFIX + state.meta.artifactId + ':' + state.meta.artifactVersion;
  }

  function loadEvents() {
    try {
      state.events = JSON.parse(localStorage.getItem(storageKey()) || '[]');
    } catch (_) {
      state.events = [];
    }
  }

  function persistEvents() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state.events));
    } catch (error) {
      console.warn('[LoopKit] localStorage save failed', error);
    }
  }

  function targetFromElement(el) {
    if (!el) return null;
    var target = el.closest && el.closest('[data-loop-id]');
    if (!target || target.closest('[data-loop-ignore]')) return null;
    var rect = target.getBoundingClientRect();
    return {
      id: target.getAttribute('data-loop-id'),
      kind: target.getAttribute('data-loop-kind') || target.tagName.toLowerCase(),
      title: target.getAttribute('data-loop-title') || target.getAttribute('aria-label') || target.textContent.trim().slice(0, 80) || target.tagName.toLowerCase(),
      selector: '[data-loop-id="' + cssEscape(target.getAttribute('data-loop-id')) + '"]',
      text: target.textContent.trim().replace(/\s+/g, ' ').slice(0, 600),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/(["\\.\[\]#:])/g, '\\$1');
  }

  function getElementByTarget(target) {
    if (!target || !target.id) return null;
    try {
      return document.querySelector('[data-loop-id="' + cssEscape(target.id) + '"]');
    } catch (_) {
      return null;
    }
  }

  function saveEvent(event) {
    var fullEvent = Object.assign({
      id: uid('fb'),
      loopkit: 'event-v0',
      runtimeVersion: LOOPKIT_VERSION,
      artifactId: state.meta.artifactId,
      artifactVersion: state.meta.artifactVersion,
      createdAt: new Date().toISOString(),
      url: location.href
    }, event);
    state.events.push(fullEvent);
    persistEvents();
    renderPins();
    renderFeedbackButton();
    toast('Saved');
    return fullEvent;
  }

  function createBundle() {
    return {
      loopkit: 'feedback-bundle-v0',
      runtimeVersion: LOOPKIT_VERSION,
      artifact: {
        id: state.meta.artifactId,
        version: state.meta.artifactVersion,
        title: state.meta.title,
        description: state.meta.description || '',
        url: location.href
      },
      decisions: state.decisions,
      rule: 'This feedback bundle is single-use and valid only for this artifact version. The next agent must respond to every item and must not carry this bundle forward automatically.',
      items: state.events.slice()
    };
  }

  function bundleMarkdown() {
    var bundle = createBundle();
    var lines = [];
    lines.push('# LoopKit feedback bundle');
    lines.push('');
    lines.push('Artifact: ' + (bundle.artifact.title || bundle.artifact.id));
    lines.push('ID: ' + bundle.artifact.id);
    lines.push('Version: ' + bundle.artifact.version);
    lines.push('');
    if (bundle.decisions) {
      lines.push('## DECISIONS');
      lines.push(bundle.decisions);
      lines.push('');
    }
    lines.push('## Feedback items');
    if (!bundle.items.length) lines.push('No feedback items.');
    bundle.items.forEach(function (item, index) {
      lines.push(String(index + 1) + '. ' + item.type);
      if (item.target) lines.push('   Target: ' + item.target.id + ' — ' + (item.target.title || item.target.kind || 'target'));
      if (item.point) lines.push('   Point: x=' + Math.round(item.point.x) + ', y=' + Math.round(item.point.y));
      lines.push('   Message: ' + item.message);
      lines.push('');
    });
    lines.push('## Machine-readable JSON');
    lines.push('```json');
    lines.push(JSON.stringify(bundle, null, 2));
    lines.push('```');
    return lines.join('\n');
  }

  function copyBundle() {
    var text = bundleMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('Feedback bundle copied');
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.focus();
    area.select();
    document.execCommand('copy');
    area.remove();
    toast('Copied');
  }

  function injectUi() {
    host = document.createElement('div');
    host.id = 'loopkit-root';
    host.setAttribute('data-loop-ignore', 'true');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + styles() + '</style><div class="lk-layer"><div class="lk-toolbar"></div><div class="lk-feedback"></div><div class="lk-toast"></div></div>';
    toolbar = root.querySelector('.lk-toolbar');
    feedbackButton = root.querySelector('.lk-feedback');
    renderToolbar();
    renderFeedbackButton();
  }

  function styles() {
    return `
      :host{all:initial;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
      *{box-sizing:border-box}
      .lk-layer{pointer-events:none;position:fixed;inset:0;z-index:2147483647}
      .lk-toolbar{pointer-events:auto;position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:rgba(255,255,255,.92);border:1px solid rgba(24,24,27,.12);box-shadow:0 12px 34px rgba(0,0,0,.12);border-radius:16px;backdrop-filter:blur(16px)}
      .lk-btn{height:32px;border:0;background:transparent;color:#52525b;border-radius:11px;padding:0 10px;font-size:13px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .lk-btn:hover{background:#f4f4f5;color:#18181b}
      .lk-btn.active{background:#18181b;color:#fff}
      .lk-btn.danger{color:#b91c1c}
      .lk-pill{pointer-events:auto;position:fixed;right:14px;bottom:14px;background:#18181b;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer}
      .lk-pop{pointer-events:auto;position:fixed;width:340px;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.20);padding:12px;z-index:2147483647}
      .lk-title{font-size:12px;font-weight:760;color:#18181b;margin:0 0 8px;line-height:1.3}
      .lk-sub{font-size:11px;color:#71717a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .lk-textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px 11px;font:14px/1.35 inherit;outline:none;background:#fff;color:#18181b}
      .lk-textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}
      .lk-row{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      .lk-action{height:32px;border:1px solid #e4e4e7;background:#fff;color:#18181b;border-radius:11px;padding:0 12px;font-size:13px;font-weight:650;cursor:pointer}
      .lk-action:hover{border-color:#a1a1aa;background:#fafafa}
      .lk-action.primary{background:#18181b;color:#fff;border-color:#18181b}
      .lk-action.primary:hover{background:#27272a}
      .lk-outline{pointer-events:none;position:fixed;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.13);z-index:2147483646}
      .lk-outline-label{position:absolute;top:-27px;left:0;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:11px/1.1 Inter,system-ui,sans-serif;font-weight:700;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      .lk-pin{pointer-events:auto;position:fixed;min-width:22px;height:22px;border-radius:999px;background:#18181b;color:#fff;border:2px solid #fff;box-shadow:0 8px 22px rgba(0,0,0,.22);font:11px/18px Inter,system-ui,sans-serif;font-weight:800;text-align:center;cursor:pointer;transform:translate(-50%,-50%)}
      .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(10px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:8px 12px;font:12px/1.2 Inter,system-ui,sans-serif;font-weight:700;transition:.16s ease}
      .lk-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .lk-panel{pointer-events:auto;position:fixed;right:14px;bottom:54px;width:360px;max-height:min(520px,calc(100vh - 90px));overflow:auto;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.2);padding:12px}
      .lk-item{border:1px solid #eee;border-radius:13px;padding:10px;margin-top:8px;background:#fafafa}
      .lk-item-type{font-size:11px;font-weight:800;color:#71717a;text-transform:uppercase;letter-spacing:.04em}
      .lk-item-msg{font-size:13px;line-height:1.35;margin-top:4px;color:#18181b;white-space:pre-wrap}
      .lk-shake{animation:lkshake .22s ease-in-out 0s 2}
      @keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
    `;
  }

  function renderToolbar() {
    if (!toolbar) return;
    toolbar.innerHTML = '';
    [
      ['markup', 'Mark up'],
      ['comments', 'Comments'],
      ['tweaks', 'Tweaks']
    ].forEach(function (entry) {
      var button = document.createElement('button');
      button.className = 'lk-btn' + (state.mode === entry[0] ? ' active' : '');
      button.textContent = entry[1];
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        setMode(state.mode === entry[0] ? null : entry[0]);
      });
      toolbar.appendChild(button);
    });
    var copy = document.createElement('button');
    copy.className = 'lk-btn';
    copy.textContent = 'Copy bundle';
    copy.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      copyBundle();
    });
    toolbar.appendChild(copy);
  }

  function setMode(mode) {
    closeComposer();
    state.mode = mode;
    clearHover();
    renderToolbar();
    document.documentElement.setAttribute('data-loopkit-mode', mode || 'off');
    if (mode === 'tweaks') openTweaksComposer();
  }

  function clearHover() {
    state.hoverTarget = null;
    if (hoverBox) hoverBox.remove();
    hoverBox = null;
  }

  function drawHover(target) {
    if (!target) return clearHover();
    var el = getElementByTarget(target);
    if (!el) return clearHover();
    var rect = el.getBoundingClientRect();
    if (!hoverBox) {
      hoverBox = document.createElement('div');
      hoverBox.className = 'lk-outline';
      var label = document.createElement('div');
      label.className = 'lk-outline-label';
      hoverBox.appendChild(label);
      root.querySelector('.lk-layer').appendChild(hoverBox);
    }
    hoverBox.style.left = Math.round(rect.left) + 'px';
    hoverBox.style.top = Math.round(rect.top) + 'px';
    hoverBox.style.width = Math.round(rect.width) + 'px';
    hoverBox.style.height = Math.round(rect.height) + 'px';
    hoverBox.querySelector('.lk-outline-label').textContent = target.title || target.id;
  }

  function openComposer(options) {
    if (state.composer && state.composer.dirty) {
      shake(state.composer.el);
      return;
    }
    closeComposer();
    var pop = document.createElement('div');
    pop.className = 'lk-pop';
    pop.style.left = Math.min(window.innerWidth - 360, Math.max(12, options.x || 24)) + 'px';
    pop.style.top = Math.min(window.innerHeight - 190, Math.max(56, options.y || 70)) + 'px';
    var title = options.title || 'Feedback';
    pop.innerHTML = '<div class="lk-title">' + escapeHtml(title) + '<div class="lk-sub">' + escapeHtml(options.subtitle || '') + '</div></div><textarea class="lk-textarea" placeholder="Напиши фидбэк..."></textarea><div class="lk-row"><button class="lk-action" data-cancel>Cancel</button><button class="lk-action primary" data-save>Save</button></div>';
    root.querySelector('.lk-layer').appendChild(pop);
    var textarea = pop.querySelector('textarea');
    var dirty = false;
    textarea.addEventListener('input', function () {
      dirty = true;
      state.composer.dirty = true;
    });
    ['keydown', 'keyup', 'keypress', 'click', 'pointerdown', 'pointerup'].forEach(function (type) {
      pop.addEventListener(type, function (event) { event.stopPropagation(); }, true);
    });
    pop.querySelector('[data-cancel]').addEventListener('click', closeComposer);
    pop.querySelector('[data-save]').addEventListener('click', function () {
      var message = textarea.value.trim();
      if (!message) {
        shake(pop);
        return;
      }
      saveEvent(options.createEvent(message));
      closeComposer();
      if (options.afterSave) options.afterSave();
    });
    state.composer = { el: pop, dirty: dirty };
    setTimeout(function () { textarea.focus(); }, 0);
  }

  function openMarkupComposer(target, clientX, clientY) {
    openComposer({
      x: clientX + 12,
      y: clientY + 12,
      title: target.title || target.id,
      subtitle: target.id,
      createEvent: function (message) {
        return { type: 'markup.comment', target: target, message: message };
      }
    });
  }

  function openPinComposer(target, point) {
    openComposer({
      x: point.x + 12,
      y: point.y + 12,
      title: 'Comment pin',
      subtitle: target ? target.title : 'Screen comment',
      createEvent: function (message) {
        return { type: 'comment.pin', target: target, point: point, message: message };
      }
    });
  }

  function openTweaksComposer() {
    openComposer({
      x: window.innerWidth / 2 - 170,
      y: 62,
      title: 'Tweaks request',
      subtitle: 'Опиши, какие интерактивные настройки добавить в следующей версии',
      createEvent: function (message) {
        return { type: 'tweak.request', target: null, message: message };
      },
      afterSave: function () { setMode(null); }
    });
  }

  function closeComposer() {
    if (state.composer && state.composer.el) state.composer.el.remove();
    state.composer = null;
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('lk-shake');
    void el.offsetWidth;
    el.classList.add('lk-shake');
  }

  function getEventTargetFromPoint(x, y) {
    var hidden = host;
    var oldDisplay = hidden.style.display;
    hidden.style.display = 'none';
    var el = document.elementFromPoint(x, y);
    hidden.style.display = oldDisplay;
    return targetFromElement(el);
  }

  function onPointerMove(event) {
    if (state.mode !== 'markup') return;
    var target = getEventTargetFromPoint(event.clientX, event.clientY);
    state.hoverTarget = target;
    drawHover(target);
  }

  function onPointerDown(event) {
    if (state.mode !== 'markup' && state.mode !== 'comments') return;
    if (event.composedPath && event.composedPath().includes(host)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (state.composer && state.composer.dirty) {
      shake(state.composer.el);
      return;
    }
    var target = getEventTargetFromPoint(event.clientX, event.clientY) || targetFromElement(document.body);
    if (state.mode === 'markup') {
      if (!target) return toast('No data-loop-id target');
      openMarkupComposer(target, event.clientX, event.clientY);
    } else if (state.mode === 'comments') {
      var point = { x: event.clientX, y: event.clientY };
      if (target) {
        var el = getElementByTarget(target);
        if (el) {
          var rect = el.getBoundingClientRect();
          point.relX = rect.width ? (event.clientX - rect.left) / rect.width : 0;
          point.relY = rect.height ? (event.clientY - rect.top) / rect.height : 0;
        }
      }
      openPinComposer(target, point);
    }
  }

  function renderPins() {
    all('.lk-pin', root).forEach(function (pin) { pin.remove(); });
    var layer = root.querySelector('.lk-layer');
    state.events.forEach(function (event, index) {
      if (event.type !== 'comment.pin' && event.type !== 'markup.comment') return;
      var x;
      var y;
      if (event.point && event.point.relX != null && event.target) {
        var el = getElementByTarget(event.target);
        if (!el) return;
        var rect = el.getBoundingClientRect();
        x = rect.left + rect.width * event.point.relX;
        y = rect.top + rect.height * event.point.relY;
      } else if (event.point) {
        x = event.point.x;
        y = event.point.y;
      } else if (event.target) {
        var targetEl = getElementByTarget(event.target);
        if (!targetEl) return;
        var targetRect = targetEl.getBoundingClientRect();
        x = targetRect.right;
        y = targetRect.top;
      } else {
        return;
      }
      var pin = document.createElement('button');
      pin.className = 'lk-pin';
      pin.textContent = String(index + 1);
      pin.title = event.message || '';
      pin.style.left = Math.round(x) + 'px';
      pin.style.top = Math.round(y) + 'px';
      pin.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toast(event.message || 'Feedback');
      });
      layer.appendChild(pin);
    });
  }

  function renderFeedbackButton() {
    if (!feedbackButton) return;
    if (!state.events.length) {
      feedbackButton.innerHTML = '';
      return;
    }
    feedbackButton.innerHTML = '<button class="lk-pill">Feedback ' + state.events.length + '</button>';
    feedbackButton.querySelector('button').addEventListener('click', openFeedbackPanel);
  }

  function openFeedbackPanel() {
    var existing = root.querySelector('.lk-panel');
    if (existing) {
      existing.remove();
      return;
    }
    var panel = document.createElement('div');
    panel.className = 'lk-panel';
    panel.innerHTML = '<div class="lk-title">Feedback bundle<div class="lk-sub">' + escapeHtml(state.meta.title) + ' · ' + escapeHtml(state.meta.artifactVersion) + '</div></div><div class="lk-row" style="justify-content:flex-start"><button class="lk-action primary" data-copy>Copy for AI</button><button class="lk-action danger" data-clear>Clear</button></div>';
    state.events.forEach(function (event) {
      var item = document.createElement('div');
      item.className = 'lk-item';
      item.innerHTML = '<div class="lk-item-type">' + escapeHtml(event.type) + (event.target ? ' · ' + escapeHtml(event.target.id) : '') + '</div><div class="lk-item-msg">' + escapeHtml(event.message) + '</div>';
      panel.appendChild(item);
    });
    root.querySelector('.lk-layer').appendChild(panel);
    panel.querySelector('[data-copy]').addEventListener('click', copyBundle);
    panel.querySelector('[data-clear]').addEventListener('click', function () {
      state.events = [];
      persistEvents();
      panel.remove();
      renderPins();
      renderFeedbackButton();
      toast('Cleared');
    });
  }

  function toast(message) {
    var node = root && root.querySelector('.lk-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 1400);
  }

  function onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      copyBundle();
    }
    if (event.key === 'Escape') {
      setMode(null);
      closeComposer();
    }
  }

  function init() {
    if (window.LoopKit && window.LoopKit.__initialized) return;
    state.meta = readMeta();
    state.decisions = readDecisions();
    loadEvents();
    injectUi();
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', renderPins);
    document.addEventListener('keydown', onKeyDown, true);
    renderPins();
  }

  window.LoopKit = {
    __initialized: true,
    version: LOOPKIT_VERSION,
    init: init,
    getEvents: function () { return state.events.slice(); },
    clearEvents: function () { state.events = []; persistEvents(); renderPins(); renderFeedbackButton(); },
    exportBundle: createBundle,
    exportMarkdown: bundleMarkdown,
    copyBundle: copyBundle,
    saveEvent: saveEvent
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  'use strict';

  const VERSION = '0.1.5-portable';
  const ROOT_ID = 'loopkit-root';
  const META_SELECTOR = 'script[type="application/loopkit+json"],script[type="application/loopkit+meta"]';
  const DECISIONS_SELECTOR = '#loopkit-decisions';

  let mode = null;
  let events = [];
  let activeTarget = null;
  let activePoint = null;
  let draftDirty = false;

  const meta = readMeta();
  const decisions = readDecisions();
  const storeKey = `loopkit:v0:${meta.artifactId}:${meta.artifactVersion}`;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    if (document.getElementById(ROOT_ID)) return;
    events = readEvents();
    injectStyle();
    injectRoot();
    bindUi();
    bindDocument();
    renderAll();
    window.LoopKit = Object.assign(window.LoopKit || {}, {
      version: VERSION,
      meta,
      getEvents: () => events.slice(),
      clearEvents,
      exportBundle,
      exportMarkdown,
      copyBundle,
      saveEvent(event) {
        const next = { id: uid('fb'), createdAt: new Date().toISOString(), artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, url: location.href, ...event };
        events.push(next);
        persistEvents();
        renderAll();
        return next;
      }
    });
    console.info('[LoopKit] initialized', VERSION, meta);
  }

  function injectRoot() {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-loop-ignore', 'true');
    root.innerHTML = `
      <div class="lk-bar" data-lk-ui>
        <button type="button" data-mode="markup">Mark up</button>
        <button type="button" data-mode="comments">Comments</button>
        <button type="button" data-mode="tweaks">Tweaks</button>
        <button type="button" data-copy>Copy bundle</button>
      </div>
      <div class="lk-outline"><span></span></div>
      <div class="lk-composer" data-lk-ui>
        <div class="lk-title"></div>
        <textarea placeholder="Напиши фидбэк..."></textarea>
        <div class="lk-actions">
          <button type="button" data-cancel>Cancel</button>
          <button type="button" data-save>Save</button>
        </div>
      </div>
      <button type="button" class="lk-pill" data-lk-ui></button>
      <div class="lk-drawer" data-lk-ui>
        <div class="lk-drawer-head"><b>Feedback bundle</b><button type="button" data-close>×</button></div>
        <div class="lk-list"></div>
        <div class="lk-actions"><button type="button" data-clear>Clear</button><button type="button" data-copy>Copy for AI</button></div>
      </div>
      <div class="lk-pins"></div>
      <div class="lk-toast"></div>
    `;
    document.documentElement.appendChild(root);
  }

  function bindUi() {
    const root = getRoot();
    root.querySelectorAll('[data-lk-ui], [data-lk-ui] *').forEach((node) => {
      ['pointerdown', 'mousedown', 'click', 'keydown', 'keyup', 'keypress'].forEach((type) => {
        node.addEventListener(type, (event) => event.stopPropagation(), true);
      });
    });

    root.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', (event) => {
        stop(event);
        setMode(mode === button.dataset.mode ? null : button.dataset.mode);
      });
    });

    root.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', (event) => { stop(event); copyBundle(); }));
    root.querySelector('[data-save]').addEventListener('click', (event) => { stop(event); saveDraft(); });
    root.querySelector('[data-cancel]').addEventListener('click', (event) => { stop(event); closeComposer(); });
    root.querySelector('[data-close]').addEventListener('click', (event) => { stop(event); root.querySelector('.lk-drawer').classList.remove('is-visible'); });
    root.querySelector('[data-clear]').addEventListener('click', (event) => { stop(event); clearEvents(); });
    root.querySelector('.lk-pill').addEventListener('click', (event) => { stop(event); renderList(); root.querySelector('.lk-drawer').classList.toggle('is-visible'); });

    const textarea = root.querySelector('textarea');
    textarea.addEventListener('input', () => { draftDirty = textarea.value.trim().length > 0; });
    textarea.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        saveDraft();
      }
    }, true);
  }

  function bindDocument() {
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', renderPins);
  }

  function setMode(nextMode) {
    mode = nextMode;
    closeComposer();
    hideOutline();
    const root = getRoot();
    root.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
    document.documentElement.dataset.loopkitMode = mode || '';
    if (mode === 'tweaks') openComposer({ type: 'tweak.request', title: 'Tweaks request', x: window.innerWidth / 2 - 180, y: 62 });
  }

  function onPointerMove(event) {
    if (mode !== 'markup' || isLoopKitEvent(event)) return;
    const target = targetAt(event.clientX, event.clientY);
    if (!target) return hideOutline();
    showOutline(target);
  }

  function onPointerDown(event) {
    if (!mode || isLoopKitEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const composer = getRoot().querySelector('.lk-composer');
    if (composer.classList.contains('is-visible') && draftDirty) {
      shake(composer);
      return;
    }

    if (mode === 'markup') {
      const target = targetAt(event.clientX, event.clientY);
      if (!target) return toast('Нет data-loop-id');
      activeTarget = target;
      activePoint = null;
      openComposer({ type: 'markup.comment', title: targetTitle(target), x: event.clientX + 12, y: event.clientY + 12 });
    }

    if (mode === 'comments') {
      const target = targetAt(event.clientX, event.clientY) || document.querySelector('[data-loop-id]');
      activeTarget = target;
      activePoint = makePoint(target, event.clientX, event.clientY);
      openComposer({ type: 'comment.pin', title: target ? targetTitle(target) : 'Screen comment', x: event.clientX + 12, y: event.clientY + 12 });
    }
  }

  function onDocumentClick(event) {
    if (!mode || isLoopKitEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'e') {
      event.preventDefault();
      copyBundle();
    }
    if (event.key === 'Escape') {
      setMode(null);
      getRoot().querySelector('.lk-drawer').classList.remove('is-visible');
    }
  }

  function openComposer({ type, title, x, y }) {
    const root = getRoot();
    const composer = root.querySelector('.lk-composer');
    const textarea = root.querySelector('textarea');
    composer.dataset.type = type;
    composer.querySelector('.lk-title').textContent = title || 'Feedback';
    composer.style.left = clamp(x, 14, window.innerWidth - 380) + 'px';
    composer.style.top = clamp(y, 52, window.innerHeight - 220) + 'px';
    textarea.value = '';
    draftDirty = false;
    composer.classList.add('is-visible');
    requestAnimationFrame(() => textarea.focus());
  }

  function closeComposer() {
    const root = getRoot();
    const composer = root.querySelector('.lk-composer');
    const textarea = root.querySelector('textarea');
    composer.classList.remove('is-visible');
    textarea.value = '';
    draftDirty = false;
    activeTarget = null;
    activePoint = null;
  }

  function saveDraft() {
    const root = getRoot();
    const composer = root.querySelector('.lk-composer');
    const textarea = root.querySelector('textarea');
    const message = textarea.value.trim();
    if (!message) {
      shake(composer);
      return;
    }
    const type = composer.dataset.type || 'markup.comment';
    const event = {
      id: uid('fb'),
      type,
      artifactId: meta.artifactId,
      artifactVersion: meta.artifactVersion,
      createdAt: new Date().toISOString(),
      message,
      url: location.href
    };
    if (type !== 'tweak.request') event.target = targetInfo(activeTarget);
    if (type === 'comment.pin') event.point = activePoint;
    events.push(event);
    persistEvents();
    closeComposer();
    renderAll();
    toast('Saved');
  }

  function targetAt(x, y) {
    const root = getRoot();
    const previousDisplay = root.style.display;
    root.style.display = 'none';
    const element = document.elementFromPoint(x, y);
    root.style.display = previousDisplay;
    if (!element) return null;
    const target = element.closest('[data-loop-id]');
    if (!target || target.closest('[data-loop-ignore]')) return null;
    return target;
  }

  function targetInfo(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      id: element.dataset.loopId,
      kind: element.dataset.loopKind || element.tagName.toLowerCase(),
      title: targetTitle(element),
      selector: `[data-loop-id="${cssEscape(element.dataset.loopId)}"]`,
      text: compact(element.textContent, 700),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  }

  function targetTitle(element) {
    if (!element) return '';
    return element.dataset.loopTitle || element.getAttribute('aria-label') || compact(element.textContent, 80) || element.dataset.loopId;
  }

  function makePoint(target, x, y) {
    const point = { x: Math.round(x), y: Math.round(y) };
    if (target) {
      const rect = target.getBoundingClientRect();
      point.relX = rect.width ? (x - rect.left) / rect.width : 0;
      point.relY = rect.height ? (y - rect.top) / rect.height : 0;
    }
    return point;
  }

  function showOutline(target) {
    const rect = target.getBoundingClientRect();
    const outline = getRoot().querySelector('.lk-outline');
    outline.style.display = 'block';
    outline.style.left = Math.round(rect.left) + 'px';
    outline.style.top = Math.round(rect.top) + 'px';
    outline.style.width = Math.round(rect.width) + 'px';
    outline.style.height = Math.round(rect.height) + 'px';
    outline.querySelector('span').textContent = targetTitle(target);
  }

  function hideOutline() {
    const outline = getRoot().querySelector('.lk-outline');
    if (outline) outline.style.display = 'none';
  }

  function renderAll() {
    renderPill();
    renderList();
    renderPins();
  }

  function renderPill() {
    const pill = getRoot().querySelector('.lk-pill');
    pill.textContent = 'Feedback ' + events.length;
    pill.classList.toggle('is-visible', events.length > 0);
  }

  function renderList() {
    const list = getRoot().querySelector('.lk-list');
    if (!events.length) {
      list.innerHTML = '<div class="lk-item">Пока нет фидбэка.</div>';
      return;
    }
    list.innerHTML = '';
    events.forEach((event, index) => {
      const item = document.createElement('div');
      item.className = 'lk-item';
      item.innerHTML = `<small>${index + 1}. ${escapeHtml(event.type)} ${event.target ? '· ' + escapeHtml(event.target.id) : ''}</small>${escapeHtml(event.message)}`;
      list.appendChild(item);
    });
  }

  function renderPins() {
    const pins = getRoot().querySelector('.lk-pins');
    pins.innerHTML = '';
    events.forEach((event, index) => {
      const position = pinPosition(event);
      if (!position) return;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'lk-pin';
      pin.textContent = String(index + 1);
      pin.title = event.message;
      pin.style.left = position.x + 'px';
      pin.style.top = position.y + 'px';
      pins.appendChild(pin);
    });
  }

  function pinPosition(event) {
    let target = null;
    if (event.target && event.target.id) {
      try { target = document.querySelector(`[data-loop-id="${cssEscape(event.target.id)}"]`); }
      catch { target = null; }
    }
    if (target && event.point && event.point.relX != null) {
      const rect = target.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width * event.point.relX),
        y: Math.round(rect.top + rect.height * event.point.relY)
      };
    }
    if (event.point) return { x: event.point.x, y: event.point.y };
    if (target) {
      const rect = target.getBoundingClientRect();
      return { x: Math.round(rect.right), y: Math.round(rect.top) };
    }
    return null;
  }

  function exportBundle() {
    return {
      loopkit: 'feedback-bundle-v0',
      runtimeVersion: VERSION,
      artifact: {
        id: meta.artifactId,
        version: meta.artifactVersion,
        title: meta.title,
        description: meta.description || '',
        url: location.href
      },
      decisions,
      rule: 'This feedback bundle is single-use and valid only for this artifact version. The next agent must respond to every item and must not carry this bundle forward automatically.',
      items: events.slice()
    };
  }

  function exportMarkdown() {
    const bundle = exportBundle();
    const lines = [];
    lines.push('# LoopKit feedback bundle', '');
    lines.push('Artifact: ' + (bundle.artifact.title || bundle.artifact.id));
    lines.push('ID: ' + bundle.artifact.id);
    lines.push('Version: ' + bundle.artifact.version, '');
    if (decisions) lines.push('## DECISIONS', decisions, '');
    lines.push('## Feedback items');
    if (!events.length) lines.push('No feedback items.');
    events.forEach((event, index) => {
      lines.push(`${index + 1}. ${event.type}`);
      if (event.target) lines.push(`   Target: ${event.target.id} — ${event.target.title}`);
      if (event.point) lines.push(`   Point: x=${event.point.x}, y=${event.point.y}`);
      lines.push('   Message: ' + event.message, '');
    });
    lines.push('## Machine-readable JSON', '```json', JSON.stringify(bundle, null, 2), '```');
    return lines.join('\n');
  }

  async function copyBundle() {
    const text = exportMarkdown();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast('Feedback bundle copied');
  }

  function clearEvents() {
    events = [];
    persistEvents();
    renderAll();
    getRoot().querySelector('.lk-drawer').classList.remove('is-visible');
    toast('Cleared');
  }

  function readMeta() {
    const fallback = { artifactId: document.title || 'artifact', artifactVersion: 'v1', title: document.title || 'Artifact', description: '' };
    const node = document.querySelector(META_SELECTOR);
    if (!node) return fallback;
    try {
      const raw = JSON.parse(node.textContent || '{}');
      return {
        artifactId: raw.artifactId || raw.artifact_id || fallback.artifactId,
        artifactVersion: raw.artifactVersion || raw.artifact_version || fallback.artifactVersion,
        title: raw.title || fallback.title,
        description: raw.description || ''
      };
    } catch {
      return fallback;
    }
  }

  function readDecisions() {
    return (document.querySelector(DECISIONS_SELECTOR)?.textContent || '').trim();
  }

  function readEvents() {
    try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); }
    catch { return []; }
  }

  function persistEvents() {
    localStorage.setItem(storeKey, JSON.stringify(events));
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.id = 'loopkit-style';
    style.textContent = `
      #${ROOT_ID}{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
      #${ROOT_ID} *{box-sizing:border-box}
      #${ROOT_ID} [data-lk-ui],#${ROOT_ID} [data-lk-ui] *,#${ROOT_ID} .lk-bar,#${ROOT_ID} .lk-bar *,#${ROOT_ID} .lk-composer,#${ROOT_ID} .lk-composer *,#${ROOT_ID} .lk-drawer,#${ROOT_ID} .lk-drawer *,#${ROOT_ID} .lk-pill,#${ROOT_ID} .lk-pin{pointer-events:auto}
      #${ROOT_ID} .lk-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:rgba(255,255,255,.94);border:1px solid rgba(24,24,27,.14);border-radius:16px;box-shadow:0 16px 45px rgba(0,0,0,.14);backdrop-filter:blur(14px)}
      #${ROOT_ID} button{height:32px;border:0;border-radius:11px;background:transparent;color:#52525b;padding:0 10px;font:700 13px/1 inherit;cursor:pointer;white-space:nowrap}
      #${ROOT_ID} button:hover{background:#f4f4f5;color:#18181b}#${ROOT_ID} button.is-active{background:#18181b;color:#fff}
      #${ROOT_ID} .lk-outline{position:fixed;display:none;pointer-events:none;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
      #${ROOT_ID} .lk-outline span{position:absolute;left:0;top:-26px;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:700 11px/1 inherit;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      #${ROOT_ID} .lk-composer{position:fixed;display:none;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}
      #${ROOT_ID} .lk-composer.is-visible{display:block}#${ROOT_ID} .lk-title{font:800 12px/1.25 inherit;color:#18181b;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${ROOT_ID} textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px;font:14px/1.35 inherit;outline:none;color:#18181b;background:#fff}
      #${ROOT_ID} textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}#${ROOT_ID} .lk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #${ROOT_ID} .lk-actions button{border:1px solid #e4e4e7;background:#fff;color:#18181b}#${ROOT_ID} .lk-actions button:last-child{background:#18181b;color:#fff;border-color:#18181b}
      #${ROOT_ID} .lk-pill{position:fixed;right:14px;bottom:14px;display:none;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;box-shadow:0 16px 36px rgba(0,0,0,.22)}#${ROOT_ID} .lk-pill.is-visible{display:block}
      #${ROOT_ID} .lk-drawer{position:fixed;right:14px;bottom:58px;width:min(380px,calc(100vw - 28px));max-height:min(540px,calc(100vh - 86px));overflow:auto;display:none;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}
      #${ROOT_ID} .lk-drawer.is-visible{display:block}#${ROOT_ID} .lk-drawer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}#${ROOT_ID} .lk-item{border-top:1px solid #eee;padding:10px 0;font:13px/1.35 inherit}#${ROOT_ID} .lk-item small{display:block;color:#71717a;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
      #${ROOT_ID} .lk-pin{position:fixed;min-width:22px;height:22px;border-radius:999px;border:2px solid #fff;background:#18181b;color:#fff;font:800 11px/18px inherit;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25);transform:translate(-50%,-50%)}
      #${ROOT_ID} .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(8px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;font:800 12px/1 inherit;box-shadow:0 14px 34px rgba(0,0,0,.22);transition:.16s ease}#${ROOT_ID} .lk-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}
      #${ROOT_ID} .lk-shake{animation:lkshake .22s ease-in-out 0s 2}@keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`;
    document.head.appendChild(style);
  }

  function getRoot() { return document.getElementById(ROOT_ID); }
  function isLoopKitEvent(event) { return !!(event.target && event.target.closest && event.target.closest('#' + ROOT_ID)); }
  function stop(event) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); }
  function shake(el) { if (!el) return; el.classList.remove('lk-shake'); void el.offsetWidth; el.classList.add('lk-shake'); }
  function toast(message) { const el = getRoot().querySelector('.lk-toast'); el.textContent = message; el.classList.add('is-visible'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('is-visible'), 1300); }
  function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`; }
  function compact(value, max) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function cssEscape(value) { return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
})();
/*
 * LoopKit runtime v0.1.2-portable
 * Portable feedback runtime for self-describing HTML artifacts.
 * Modes: Mark up, Comments, Tweaks request, Export bundle.
 */
(function () {
  const VERSION = "0.1.2-portable";
  const META_SELECTOR = 'script[type="application/loopkit+json"]';
  const DECISIONS_SELECTOR = '#loopkit-decisions';
  const TARGET_SELECTOR = '[data-loop-id]:not([data-loop-ignore])';
  const IGNORE_SELECTOR = '[data-loop-ignore]';

  const icon = {
    marker: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    tweak: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  let meta = readMeta();
  let decisions = readDecisions();
  let events = readEvents();
  let activeMode = null;
  let selectedTarget = null;
  let pinMode = false;
  let currentDraft = '';
  let localPinPoint = null;

  const host = document.createElement('div');
  host.id = 'loopkit-host';
  host.setAttribute('data-loop-ignore', 'true');
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';
  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${styles()}</style>
    <div class="lk-shell">
      <div class="lk-toolbar" part="toolbar">
        <button class="lk-tool" data-mode="markup" title="Выбрать элемент и оставить комментарий">${icon.marker}<span>Mark up</span></button>
        <button class="lk-tool" data-mode="comments" title="Оставить свободный pin-комментарий">${icon.comment}<span>Comments</span></button>
        <button class="lk-tool" data-mode="tweaks" title="Попросить добавить интерактивные настройки">${icon.tweak}<span>Tweaks</span></button>
        <button class="lk-tool" data-copy title="Скопировать feedback bundle">${icon.copy}<span>Copy</span></button>
      </div>
      <button class="lk-edge" title="Показать LoopKit">LoopKit</button>
      <div class="lk-outline"><span></span></div>
      <div class="lk-composer" role="dialog" aria-label="LoopKit composer">
        <div class="lk-composer-head">
          <div>
            <div class="lk-composer-title">Feedback</div>
            <div class="lk-composer-target"></div>
          </div>
          <button class="lk-iconbtn" data-close-composer>${icon.close}</button>
        </div>
        <textarea class="lk-textarea" placeholder="Напиши комментарий..."></textarea>
        <div class="lk-composer-actions">
          <button class="lk-btn ghost" data-cancel>Cancel</button>
          <button class="lk-btn primary" data-save>Save</button>
        </div>
      </div>
      <div class="lk-tweaks" role="dialog" aria-label="LoopKit tweaks request">
        <div class="lk-composer-head">
          <div>
            <div class="lk-composer-title">Tweaks request</div>
            <div class="lk-composer-target">Опиши, какие интерактивные настройки добавить в следующей версии</div>
          </div>
          <button class="lk-iconbtn" data-close-tweaks>${icon.close}</button>
        </div>
        <textarea class="lk-tweak-textarea" placeholder="Например: добавь контролы палитры, размера заголовков и плотности интерфейса..."></textarea>
        <div class="lk-composer-actions">
          <button class="lk-btn ghost" data-cancel-tweaks>Cancel</button>
          <button class="lk-btn primary" data-save-tweaks>Save tweak request</button>
        </div>
      </div>
      <button class="lk-count" title="Открыть feedback list"></button>
      <div class="lk-drawer">
        <div class="lk-drawer-head">
          <div>
            <div class="lk-composer-title">Feedback bundle</div>
            <div class="lk-composer-target">${escapeHtml(meta.title || meta.artifactId)} · ${escapeHtml(meta.artifactVersion)}</div>
          </div>
          <button class="lk-iconbtn" data-close-drawer>${icon.close}</button>
        </div>
        <div class="lk-list"></div>
        <div class="lk-composer-actions">
          <button class="lk-btn ghost" data-clear>Clear</button>
          <button class="lk-btn primary" data-copy-drawer>Copy for AI</button>
        </div>
      </div>
      <div class="lk-toast"></div>
      <div class="lk-pins"></div>
    </div>
  `;

  const bar = root.querySelector('.lk-toolbar');
  const edge = root.querySelector('.lk-edge');
  const outline = root.querySelector('.lk-outline');
  const composer = root.querySelector('.lk-composer');
  const textarea = root.querySelector('.lk-textarea');
  const tweakPanel = root.querySelector('.lk-tweaks');
  const tweakTextarea = root.querySelector('.lk-tweak-textarea');
  const count = root.querySelector('.lk-count');
  const drawer = root.querySelector('.lk-drawer');
  const list = root.querySelector('.lk-list');
  const pins = root.querySelector('.lk-pins');
  const toastEl = root.querySelector('.lk-toast');

  renderCount();
  renderList();
  renderPins();

  root.querySelectorAll('.lk-tool[data-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(activeMode === button.dataset.mode ? null : button.dataset.mode));
  });
  root.querySelector('[data-copy]').addEventListener('click', copyBundle);
  root.querySelector('[data-copy-drawer]').addEventListener('click', copyBundle);
  root.querySelector('[data-close-composer]').addEventListener('click', hideComposer);
  root.querySelector('[data-cancel]').addEventListener('click', hideComposer);
  root.querySelector('[data-save]').addEventListener('click', saveComment);
  root.querySelector('[data-close-tweaks]').addEventListener('click', () => setMode(null));
  root.querySelector('[data-cancel-tweaks]').addEventListener('click', () => setMode(null));
  root.querySelector('[data-save-tweaks]').addEventListener('click', saveTweakRequest);
  root.querySelector('[data-close-drawer]').addEventListener('click', () => drawer.classList.remove('is-visible'));
  root.querySelector('[data-clear]').addEventListener('click', clearFeedback);
  count.addEventListener('click', () => drawer.classList.toggle('is-visible'));
  edge.addEventListener('click', () => setHidden(false));

  [composer, tweakPanel, drawer, bar].forEach(node => {
    ['pointerdown', 'click', 'keydown', 'keyup', 'keypress'].forEach(type => {
      node.addEventListener(type, event => event.stopPropagation(), true);
    });
  });

  textarea.addEventListener('input', () => { currentDraft = textarea.value; });
  tweakTextarea.addEventListener('input', () => { currentDraft = tweakTextarea.value; });

  document.addEventListener('pointermove', event => {
    if (activeMode !== 'markup') return;
    const target = findLoopTarget(event.clientX, event.clientY);
    if (!target) return hideOutline();
    showOutline(target);
  }, true);

  document.addEventListener('pointerdown', event => {
    if (activeMode !== 'markup' && activeMode !== 'comments') return;
    if (isFromLoopKit(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (currentDraft.trim()) {
      shake(composer.classList.contains('is-visible') ? composer : tweakPanel);
      return;
    }

    const target = findLoopTarget(event.clientX, event.clientY);
    if (activeMode === 'markup') {
      if (!target) return toast('Нет data-loop-id');
      openComposer(target, event.clientX, event.clientY, 'markup.comment');
    } else {
      const fallback = target || pageTarget();
      const point = pointForTarget(fallback, event.clientX, event.clientY);
      openPinComposer(fallback, point, event.clientX, event.clientY);
    }
  }, true);

  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'l') { event.preventDefault(); setHidden(!bar.classList.contains('is-hidden')); }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'e') { event.preventDefault(); copyBundle(); }
    if ((event.metaKey || event.ctrlKey) && key === 'enter') {
      if (composer.classList.contains('is-visible')) { event.preventDefault(); saveComment(); }
      if (tweakPanel.classList.contains('is-visible')) { event.preventDefault(); saveTweakRequest(); }
    }
    if (event.key === 'Escape') { hideAllModes(); drawer.classList.remove('is-visible'); }
  });

  window.addEventListener('resize', () => { hideOutline(); renderPins(); });
  window.addEventListener('scroll', () => renderPins(), true);

  window.LoopKit = Object.assign(window.LoopKit || {}, {
    version: VERSION,
    meta,
    getEvents: () => events.slice(),
    clearEvents: () => { events = []; persist(); renderCount(); renderList(); renderPins(); },
    exportBundle: createBundle,
    copyBundle,
    addEvent: (event) => { events.push({ id: uid('fb'), createdAt: new Date().toISOString(), artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, ...event }); persist(); renderCount(); renderList(); renderPins(); },
  });

  function setMode(mode) {
    activeMode = mode;
    currentDraft = '';
    hideComposer();
    drawer.classList.remove('is-visible');
    tweakPanel.classList.toggle('is-visible', mode === 'tweaks');
    if (mode === 'tweaks') tweakTextarea.focus();
    root.querySelectorAll('.lk-tool[data-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.mode === mode));
    document.documentElement.dataset.loopkitMode = mode || '';
    if (!mode) hideOutline();
  }

  function hideAllModes() {
    activeMode = null;
    currentDraft = '';
    hideComposer();
    tweakPanel.classList.remove('is-visible');
    root.querySelectorAll('.lk-tool[data-mode]').forEach(button => button.classList.remove('is-active'));
    hideOutline();
    document.documentElement.dataset.loopkitMode = '';
  }

  function setHidden(hidden) {
    bar.classList.toggle('is-hidden', hidden);
    edge.classList.toggle('is-visible', hidden);
    if (hidden) hideAllModes();
  }

  function findLoopTarget(x, y) {
    const previous = host.style.display;
    host.style.display = 'none';
    const element = document.elementFromPoint(x, y);
    host.style.display = previous;
    if (!element) return null;
    const target = element.closest(TARGET_SELECTOR);
    if (!target || target.closest(IGNORE_SELECTOR)) return null;
    return target;
  }

  function getTargetData(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      id: element.dataset.loopId,
      kind: element.dataset.loopKind || element.tagName.toLowerCase(),
      title: element.dataset.loopTitle || element.getAttribute('aria-label') || compact(element.textContent, 80),
      selector: `[data-loop-id="${cssEscape(element.dataset.loopId)}"]`,
      text: compact(element.textContent, 700),
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }

  function pageTarget() {
    const target = document.querySelector('[data-loop-id]');
    return target ? getTargetData(target) : null;
  }

  function pointForTarget(target, x, y) {
    const point = { x, y };
    if (!target) return point;
    const el = document.querySelector(target.selector);
    if (!el) return point;
    const rect = el.getBoundingClientRect();
    point.relX = rect.width ? (x - rect.left) / rect.width : 0;
    point.relY = rect.height ? (y - rect.top) / rect.height : 0;
    return point;
  }

  function showOutline(target) {
    const rect = target.getBoundingClientRect();
    outline.style.left = `${Math.round(rect.left)}px`;
    outline.style.top = `${Math.round(rect.top)}px`;
    outline.style.width = `${Math.round(rect.width)}px`;
    outline.style.height = `${Math.round(rect.height)}px`;
    outline.querySelector('span').textContent = target.dataset.loopTitle || target.dataset.loopId;
    outline.classList.add('is-visible');
  }

  function hideOutline() { outline.classList.remove('is-visible'); }

  function openComposer(targetEl, x, y, type) {
    selectedTarget = getTargetData(targetEl);
    root.querySelector('.lk-composer-title').textContent = type === 'markup.comment' ? 'Mark up' : 'Comment';
    root.querySelector('.lk-composer-target').textContent = `${selectedTarget.title} · ${selectedTarget.id}`;
    textarea.value = '';
    currentDraft = '';
    composer.dataset.type = type;
    composer.style.left = `${clamp(x + 14, 16, window.innerWidth - 380)}px`;
    composer.style.top = `${clamp(y + 14, 56, window.innerHeight - 220)}px`;
    composer.classList.add('is-visible');
    requestAnimationFrame(() => textarea.focus());
  }

  function openPinComposer(target, point, x, y) {
    selectedTarget = target;
    localPinPoint = point;
    root.querySelector('.lk-composer-title').textContent = 'Comment';
    root.querySelector('.lk-composer-target').textContent = target ? `${target.title} · ${target.id}` : 'Screen comment';
    textarea.value = '';
    currentDraft = '';
    composer.dataset.type = 'comment.pin';
    composer.style.left = `${clamp(x + 14, 16, window.innerWidth - 380)}px`;
    composer.style.top = `${clamp(y + 14, 56, window.innerHeight - 220)}px`;
    composer.classList.add('is-visible');
    requestAnimationFrame(() => textarea.focus());
  }

  function hideComposer() {
    composer.classList.remove('is-visible');
    textarea.value = '';
    selectedTarget = null;
    localPinPoint = null;
    currentDraft = '';
  }

  function saveComment() {
    const message = textarea.value.trim();
    if (!message) return shake(composer);
    const type = composer.dataset.type || 'markup.comment';
    const event = baseEvent(type, message);
    event.target = selectedTarget;
    if (type === 'comment.pin') event.point = localPinPoint;
    events.push(event);
    persist();
    hideComposer();
    renderCount(); renderList(); renderPins();
    toast('Saved');
  }

  function saveTweakRequest() {
    const message = tweakTextarea.value.trim();
    if (!message) return shake(tweakPanel);
    events.push(baseEvent('tweak.request', message));
    tweakTextarea.value = '';
    currentDraft = '';
    setMode(null);
    persist();
    renderCount(); renderList();
    toast('Tweak request saved');
  }

  function baseEvent(type, message) {
    return {
      id: uid('fb'),
      type,
      artifactId: meta.artifactId,
      artifactVersion: meta.artifactVersion,
      createdAt: new Date().toISOString(),
      message,
      url: location.href
    };
  }

  function renderCount() {
    count.textContent = events.length ? `Feedback ${events.length}` : '';
    count.classList.toggle('is-visible', events.length > 0);
  }

  function renderList() {
    list.innerHTML = '';
    if (!events.length) {
      list.innerHTML = '<div class="lk-empty">Нет фидбэка. Включи Mark up или Comments.</div>';
      return;
    }
    events.forEach((event, index) => {
      const item = document.createElement('div');
      item.className = 'lk-item';
      item.innerHTML = `<div class="lk-item-kicker">${index + 1}. ${escapeHtml(event.type)}</div><div class="lk-item-target">${escapeHtml(event.target?.id || 'artifact')}</div><div class="lk-item-text">${escapeHtml(event.message)}</div>`;
      list.appendChild(item);
    });
  }

  function renderPins() {
    pins.innerHTML = '';
    events.forEach((event, index) => {
      if (event.type !== 'comment.pin' && event.type !== 'markup.comment') return;
      const pos = getPinPosition(event);
      if (!pos) return;
      const pin = document.createElement('button');
      pin.className = 'lk-pin';
      pin.textContent = index + 1;
      pin.title = event.message;
      pin.style.left = `${pos.x}px`;
      pin.style.top = `${pos.y}px`;
      pin.addEventListener('click', () => toast(event.message));
      pins.appendChild(pin);
    });
  }

  function getPinPosition(event) {
    if (event.point?.relX != null && event.target?.selector) {
      const el = document.querySelector(event.target.selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width * event.point.relX, y: rect.top + rect.height * event.point.relY };
    }
    if (event.point) return event.point;
    if (event.target?.selector) {
      const el = document.querySelector(event.target.selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.right, y: rect.top };
    }
    return null;
  }

  function createBundle() {
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
      items: events
    };
  }

  function bundleText() {
    const bundle = createBundle();
    const lines = [];
    lines.push('# LoopKit feedback bundle', '');
    lines.push(`Artifact: ${bundle.artifact.title || bundle.artifact.id}`);
    lines.push(`ID: ${bundle.artifact.id}`);
    lines.push(`Version: ${bundle.artifact.version}`, '');
    if (decisions) lines.push('## DECISIONS', decisions, '');
    lines.push('## Feedback items');
    if (!events.length) lines.push('No feedback items.');
    events.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.type}`);
      if (item.target) lines.push(`   Target: ${item.target.id} — ${item.target.title}`);
      if (item.point) lines.push(`   Point: x=${Math.round(item.point.x)}, y=${Math.round(item.point.y)}`);
      lines.push(`   Message: ${item.message}`, '');
    });
    lines.push('## Machine-readable JSON', '```json', JSON.stringify(bundle, null, 2), '```');
    return lines.join('\n');
  }

  async function copyBundle() {
    const text = bundleText();
    try {
      await navigator.clipboard.writeText(text);
      toast('Feedback bundle copied');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast('Copied');
    }
  }

  function clearFeedback() {
    events = [];
    persist();
    renderCount(); renderList(); renderPins();
    drawer.classList.remove('is-visible');
    toast('Cleared');
  }

  function readMeta() {
    const node = document.querySelector(META_SELECTOR);
    if (!node) return { artifactId: document.title || 'artifact', artifactVersion: 'v1', title: document.title || 'Artifact' };
    try {
      const raw = JSON.parse(node.textContent);
      return {
        artifactId: raw.artifactId || raw.artifact_id || 'artifact',
        artifactVersion: raw.artifactVersion || raw.artifact_version || 'v1',
        title: raw.title || document.title || 'Artifact',
        description: raw.description || ''
      };
    } catch {
      return { artifactId: document.title || 'artifact', artifactVersion: 'v1', title: document.title || 'Artifact' };
    }
  }

  function readDecisions() {
    return document.querySelector(DECISIONS_SELECTOR)?.textContent.trim() || '';
  }

  function storageKey() { return `loopkit:${meta.artifactId}:${meta.artifactVersion}:events`; }
  function readEvents() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); }
    catch { return []; }
  }
  function persist() { localStorage.setItem(storageKey(), JSON.stringify(events)); }

  function isFromLoopKit(event) { return event.composedPath().includes(host); }
  function compact(value, max) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 120); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function cssEscape(value) { return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function shake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  let toastTimer;
  function toast(message) { toastEl.textContent = message; toastEl.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1400); }

  function styles() { return `
    :host{all:initial;color:#18181b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}
    .lk-shell{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
    .lk-toolbar{pointer-events:auto;position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:5px;background:rgba(255,255,255,.92);border:1px solid rgba(24,24,27,.13);border-radius:16px;box-shadow:0 16px 45px rgba(0,0,0,.14);backdrop-filter:blur(14px);transition:.16s ease}
    .lk-toolbar.is-hidden{opacity:0;pointer-events:none;transform:translateX(-50%) translateY(-14px)}
    .lk-edge{pointer-events:auto;position:fixed;top:10px;right:-2px;display:none;border:1px solid rgba(24,24,27,.14);border-right:0;border-radius:12px 0 0 12px;background:#fff;color:#18181b;padding:7px 10px;font:12px/1.1 inherit;font-weight:760;box-shadow:0 12px 28px rgba(0,0,0,.12);cursor:pointer}
    .lk-edge.is-visible{display:block}
    .lk-tool{height:32px;border:0;border-radius:11px;background:transparent;color:#52525b;padding:0 10px;display:inline-flex;align-items:center;gap:6px;font:13px/1 inherit;font-weight:720;cursor:pointer}
    .lk-tool:hover{background:#f4f4f5;color:#18181b}.lk-tool.is-active{background:#18181b;color:#fff}
    .lk-outline{pointer-events:none;position:fixed;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.12);opacity:0;transition:opacity .08s ease}.lk-outline.is-visible{opacity:1}.lk-outline span{position:absolute;left:0;top:-26px;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:11px/1 inherit;font-weight:760;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
    .lk-composer,.lk-tweaks,.lk-drawer{pointer-events:auto;position:fixed;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}.lk-composer,.lk-tweaks{width:360px;display:none}.lk-composer.is-visible,.lk-tweaks.is-visible{display:block}.lk-tweaks{top:62px;left:50%;transform:translateX(-50%)}
    .lk-composer-head,.lk-drawer-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}.lk-composer-title{font:13px/1.2 inherit;font-weight:820}.lk-composer-target{margin-top:3px;font:11px/1.2 inherit;color:#71717a;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lk-iconbtn{width:28px;height:28px;border:0;border-radius:9px;background:#f4f4f5;color:#52525b;display:grid;place-items:center;cursor:pointer}.lk-iconbtn:hover{background:#e4e4e7;color:#18181b}
    .lk-textarea,.lk-tweak-textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px;font:14px/1.35 inherit;color:#18181b;outline:none}.lk-textarea:focus,.lk-tweak-textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}
    .lk-composer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.lk-btn{height:32px;border:1px solid #e4e4e7;border-radius:11px;background:#fff;color:#18181b;padding:0 12px;font:13px/1 inherit;font-weight:760;cursor:pointer}.lk-btn:hover{border-color:#a1a1aa;background:#fafafa}.lk-btn.primary{background:#18181b;border-color:#18181b;color:#fff}.lk-btn.ghost{background:#fff}.lk-btn.danger{color:#b91c1c}
    .lk-count{pointer-events:auto;position:fixed;right:14px;bottom:14px;display:none;background:#18181b;color:#fff;border:0;border-radius:999px;padding:9px 12px;font:12px/1 inherit;font-weight:820;box-shadow:0 16px 36px rgba(0,0,0,.22);cursor:pointer}.lk-count.is-visible{display:block}
    .lk-drawer{right:14px;bottom:58px;width:380px;max-height:min(540px,calc(100vh - 86px));display:none;overflow:auto}.lk-drawer.is-visible{display:block}.lk-item{border:1px solid #eee;border-radius:13px;background:#fafafa;padding:10px;margin-top:8px}.lk-item-kicker{font:11px/1.2 inherit;font-weight:840;color:#71717a;text-transform:uppercase;letter-spacing:.04em}.lk-item-target{font:12px/1.2 inherit;color:#52525b;margin-top:4px}.lk-item-text{font:13px/1.35 inherit;color:#18181b;margin-top:5px;white-space:pre-wrap}.lk-empty{font:13px/1.4 inherit;color:#71717a;padding:18px;text-align:center}
    .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(8px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;font:12px/1 inherit;font-weight:820;box-shadow:0 14px 34px rgba(0,0,0,.22);transition:.16s ease}.lk-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}
    .lk-pin{pointer-events:auto;position:fixed;min-width:22px;height:22px;border:2px solid #fff;border-radius:999px;background:#18181b;color:#fff;font:11px/18px inherit;font-weight:850;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25);transform:translate(-50%,-50%);cursor:pointer}
    .shake{animation:lkshake .22s ease-in-out 0s 2}@keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
  `; }
})();

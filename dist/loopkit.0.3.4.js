(function(){
  'use strict';

  const VERSION = '0.3.4-merged';
  const ROOT_ID = 'loopkit-root';
  const META_SELECTOR = 'script[type="application/loopkit+json"],script[type="application/loopkit+meta"]';
  const DECISIONS_SELECTOR = '#loopkit-decisions';
  const AGENT_INSTRUCTIONS_SELECTOR = '#loopkit-agent-instructions';

  const ICONS = {
    markup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4l7.5 17 2.2-7.2L21 11.5 4 4z"/></svg>',
    comments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    tweaks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m18 15-6-6-6 6"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 8h16"/><path d="M4 16h16"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  if (window.LoopKit && window.LoopKit.__installed) return;

  const meta = readMeta();
  const decisions = textOf(DECISIONS_SELECTOR);
  const agentInstructions = textOf(AGENT_INSTRUCTIONS_SELECTOR);
  const storageKey = `loopkit:v0:${meta.artifactId}:${meta.artifactVersion}`;
  const uiKey = `loopkit:ui:${meta.artifactId}:${meta.artifactVersion}`;

  let events = readEvents();
  let mode = null;
  let hoverTarget = null;
  let targetEl = null;
  let point = null;
  let dirty = false;
  let blockNext = false;
  let collapsed = readUi().collapsed || false;
  let previewEventId = null;
  let pendingDeleteId = null;
  let host;
  let root;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init(){
    if (document.getElementById(ROOT_ID)) return;

    host = document.createElement('div');
    host.id = ROOT_ID;
    host.setAttribute('data-loop-ignore', '');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; }
        :host { all: initial; }
        .lk-ui {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          color: #171717;
          --bg: rgba(255,255,255,.93);
          --solid: #fff;
          --text: #171717;
          --muted: #737373;
          --line: rgba(23,23,23,.13);
          --soft: rgba(23,23,23,.055);
          --accent: #111827;
          --danger: #dc2626;
          --shadow: 0 18px 60px rgba(0,0,0,.18);
        }
        button, textarea { font: inherit; }
        svg { width: 15px; height: 15px; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
        .bar {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
          height: 42px;
          padding: 4px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--bg);
          backdrop-filter: blur(18px);
          box-shadow: 0 10px 32px rgba(0,0,0,.16);
          pointer-events: auto;
          transition: opacity .16s ease, transform .16s ease;
        }
        :host(.is-collapsed) .bar { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(-12px); }
        .edge {
          position: fixed;
          top: 12px;
          right: 14px;
          display: none;
          align-items: center;
          gap: 7px;
          height: 32px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--bg);
          backdrop-filter: blur(18px);
          box-shadow: 0 8px 22px rgba(0,0,0,.14);
          color: var(--text);
          pointer-events: auto;
          cursor: pointer;
        }
        :host(.is-collapsed) .edge { display: inline-flex; }
        .btn, .edge {
          border: 0;
          color: var(--muted);
          padding: 0 11px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }
        .btn {
          height: 32px;
          border-radius: 999px;
          background: transparent;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
        }
        .btn:hover, .edge:hover { background: var(--soft); color: var(--text); }
        .btn.is-active { background: var(--accent); color: #fff; }
        .btn.icon { width: 32px; padding: 0; justify-content: center; }
        .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
        .outline {
          position: fixed;
          display: none;
          border: 2px solid #38bdf8;
          border-radius: 12px;
          pointer-events: none;
          box-shadow: 0 0 0 4px rgba(56,189,248,.15);
        }
        .outline.is-visible { display: block; }
        .outline span {
          position: absolute;
          left: 0;
          top: -27px;
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 5px 8px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          font-size: 11px;
          line-height: 1;
          box-shadow: 0 8px 20px rgba(0,0,0,.22);
        }
        .composer, .preview, .drawer {
          border: 1px solid var(--line);
          border-radius: 18px;
          background: var(--solid);
          box-shadow: var(--shadow);
          pointer-events: auto;
          color: var(--text);
        }
        .composer {
          position: fixed;
          display: none;
          width: min(370px, calc(100vw - 28px));
          overflow: hidden;
        }
        .composer.is-visible { display: block; }
        .head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:13px 14px 10px;
          border-bottom:1px solid rgba(23,23,23,.08);
        }
        .title { min-width:0; font-size:13px; font-weight:800; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .sub { margin-top:2px; font-size:11px; color:var(--muted); }
        .x { width:28px; height:28px; padding:0; border-radius:999px; background:transparent; border:0; color:var(--muted); cursor:pointer; }
        .x:hover { background: var(--soft); color: var(--text); }
        .body { padding:12px 14px 14px; }
        textarea {
          width:100%;
          min-height:96px;
          resize:vertical;
          border:1px solid rgba(23,23,23,.14);
          border-radius:14px;
          padding:10px 11px;
          outline:none;
          font-size:13px;
          line-height:1.35;
          color:var(--text);
          background:#fff;
        }
        textarea:focus { border-color:rgba(15,23,42,.45); box-shadow:0 0 0 4px rgba(15,23,42,.07); }
        .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }
        .action {
          height:32px;
          border:1px solid rgba(23,23,23,.14);
          background:#fff;
          border-radius:999px;
          padding:0 12px;
          color:var(--text);
          cursor:pointer;
          font-size:12px;
          font-weight:700;
        }
        .action:hover { background:#f5f5f5; }
        .action.primary { background:#111827; color:#fff; border-color:#111827; }
        .pin {
          position: fixed;
          min-width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          border: 2px solid rgba(255,255,255,.95);
          box-shadow: 0 10px 24px rgba(0,0,0,.25);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          pointer-events: auto;
          cursor: pointer;
          transform: translate(-50%, -50%);
        }
        .pin.free { background:#0ea5e9; }
        .pill {
          position: fixed;
          right: 14px;
          bottom: 14px;
          display: none;
          height: 34px;
          padding: 0 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: var(--bg);
          backdrop-filter: blur(18px);
          color: var(--text);
          box-shadow: 0 10px 26px rgba(0,0,0,.14);
          font-size: 12px;
          font-weight: 700;
          pointer-events: auto;
          cursor: pointer;
        }
        .pill.is-visible { display:inline-flex; align-items:center; gap:7px; }
        .drawer {
          position: fixed;
          right: 14px;
          bottom: 58px;
          width: min(410px, calc(100vw - 28px));
          max-height: min(560px, calc(100vh - 86px));
          display: none;
          overflow: hidden;
          flex-direction: column;
          background: rgba(255,255,255,.96);
          backdrop-filter: blur(18px);
        }
        .drawer.is-visible { display:flex; }
        .drawer-list { overflow:auto; padding:10px; display:grid; gap:8px; }
        .item { position:relative; border:1px solid rgba(23,23,23,.10); border-radius:14px; padding:10px 42px 10px 10px; background:rgba(23,23,23,.025); }
        .item small { display:block; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin-bottom:5px; font-size:11px; }
        .item-text { font-size:12px; line-height:1.35; white-space:pre-wrap; }
        .delete-zone { position:absolute; right:7px; top:7px; display:flex; align-items:center; gap:4px; }
        .icon-btn { width:28px; height:28px; padding:0; border:0; border-radius:999px; background:transparent; color:var(--muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
        .icon-btn:hover { background:var(--soft); color:var(--danger); }
        .confirm-delete { display:flex; align-items:center; gap:5px; padding:3px 4px 3px 8px; border:1px solid rgba(220,38,38,.16); border-radius:999px; background:#fff; box-shadow:0 8px 22px rgba(0,0,0,.08); }
        .confirm-delete span { font-size:11px; font-weight:800; color:var(--danger); white-space:nowrap; }
        .confirm-delete button { height:24px; border:0; border-radius:999px; background:transparent; color:var(--muted); padding:0 7px; font-size:11px; font-weight:800; cursor:pointer; }
        .confirm-delete button:hover { background:var(--soft); color:var(--text); }
        .confirm-delete .yes { background:var(--danger); color:#fff; }
        .confirm-delete .yes:hover { background:#b91c1c; color:#fff; }
        .preview { position: fixed; display:none; width:min(340px, calc(100vw - 28px)); padding:12px; }
        .preview.is-visible { display:block; }
        .preview-text { font-size:13px; line-height:1.35; white-space:pre-wrap; }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%) translateY(8px);
          opacity: 0;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 14px 34px rgba(0,0,0,.22);
          pointer-events: none;
          transition: .16s ease;
        }
        .toast.is-visible { opacity:1; transform:translateX(-50%) translateY(0); }
        .shake { animation: shake .22s ease-in-out 0s 2; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
      </style>
      <div class="lk-ui">
        <div class="bar">
          <button class="btn" type="button" data-mode="markup" title="Mark up">${ICONS.markup}<span>Mark up</span></button>
          <button class="btn" type="button" data-mode="comments" title="Comments">${ICONS.comments}<span>Comments</span></button>
          <button class="btn" type="button" data-mode="tweaks" title="Tweaks request">${ICONS.tweaks}<span>Tweaks</span></button>
          <button class="btn icon" type="button" data-copy title="Copy feedback bundle">${ICONS.copy}<span class="sr">Copy</span></button>
          <button class="btn icon" type="button" data-collapse title="Свернуть LoopKit">${ICONS.collapse}<span class="sr">Collapse</span></button>
        </div>
        <button class="edge" type="button" data-expand>${ICONS.expand}<span>LoopKit</span></button>
        <div class="outline"><span></span></div>
        <div class="composer">
          <div class="head"><div><div class="title">Feedback</div><div class="sub"></div></div><button class="x" type="button" data-cancel>${ICONS.close}</button></div>
          <div class="body"><textarea placeholder="Напиши фидбэк..."></textarea><div class="actions"><button class="action" type="button" data-cancel>Cancel</button><button class="action primary" type="button" data-save>Save</button></div></div>
        </div>
        <button class="pill" type="button"></button>
        <div class="drawer">
          <div class="head"><div><div class="title">Feedback bundle</div><div class="sub">Одноразовый фидбэк для этой версии</div></div><button class="x" type="button" data-close>${ICONS.close}</button></div>
          <div class="drawer-list"></div>
          <div class="body"><div class="actions"><button class="action" type="button" data-clear>Clear</button><button class="action primary" type="button" data-copy>Copy for AI</button></div></div>
        </div>
        <div class="preview"></div>
        <div class="pins"></div>
        <div class="toast"></div>
      </div>`;

    bindUi();
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onMaybeBlock, true);
    document.addEventListener('click', onMaybeBlock, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', () => { renderPins(); hidePreview(); });

    setCollapsed(collapsed);
    render();
    window.LoopKit = Object.assign(window.LoopKit || {}, {
      __installed: true,
      version: VERSION,
      meta,
      getEvents: () => events.slice(),
      clearEvents,
      deleteEvent,
      exportBundle,
      exportMarkdown,
      copyBundle,
      collapse: () => setCollapsed(true),
      expand: () => setCollapsed(false),
      saveEvent(ev){
        events.push(Object.assign(base(ev.type || 'custom', ev.message || ''), ev));
        persist();
        render();
      }
    });
    console.info('[LoopKit] initialized', VERSION, meta);
  }

  function bindUi(){
    root.addEventListener('pointerdown', e => e.stopPropagation(), false);
    root.addEventListener('click', e => e.stopPropagation(), false);
    root.addEventListener('keydown', onShadowKey, false);

    root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', e => {
      stop(e);
      const next = mode === button.dataset.mode ? null : button.dataset.mode;
      setMode(next);
      if (!next) releaseFocus();
    }));
    root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', e => { stop(e); copyBundle(); }));
    root.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', e => { stop(e); closeComposer(); releaseFocus(); }));
    $('.composer [data-save]').addEventListener('click', e => { stop(e); saveDraft(); });
    $('[data-close]').addEventListener('click', e => { stop(e); $('.drawer').classList.remove('is-visible'); releaseFocus(); });
    $('[data-clear]').addEventListener('click', e => { stop(e); clearEvents(); });
    $('[data-collapse]').addEventListener('click', e => { stop(e); setCollapsed(true); });
    $('[data-expand]').addEventListener('click', e => { stop(e); setCollapsed(false); });
    $('.pill').addEventListener('click', e => { stop(e); $('.drawer').classList.toggle('is-visible'); renderList(); });
    $('textarea').addEventListener('input', e => { dirty = !!e.target.value.trim(); });
  }

  function onShadowKey(e){
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isTextInputEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
      saveDraft();
      return;
    }

    const active = isLoopKitActive();
    if (!active) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      clearMode();
      closeComposer();
      hidePreview();
      $('.drawer').classList.remove('is-visible');
      releaseFocus();
      return;
    }

    if (isTextInputEvent(e)) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
    if (isNavigationKey(e)) e.preventDefault();
  }

  function setCollapsed(next){
    collapsed = !!next;
    host.classList.toggle('is-collapsed', collapsed);
    writeUi({ collapsed });
    if (collapsed) {
      clearMode();
      closeComposer();
      hidePreview();
      $('.drawer').classList.remove('is-visible');
      releaseFocus();
    } else {
      releaseFocus();
    }
  }

  function setMode(next){
    if (collapsed) setCollapsed(false);
    mode = next;
    closeComposer();
    hidePreview();
    hideOutline();
    root.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.mode === mode));
    document.documentElement.dataset.loopkitMode = mode || '';
    if (!mode) return;
    if (mode === 'tweaks') {
      openComposer(null, window.innerWidth / 2 - 180, 64, 'tweak.request', 'Tweaks request', 'Опиши, какие интерактивные настройки нужно добавить в следующей версии.');
    }
  }

  function clearMode(){
    mode = null;
    hideOutline();
    if (root) root.querySelectorAll('[data-mode]').forEach(button => button.classList.remove('is-active'));
    document.documentElement.dataset.loopkitMode = '';
  }

  function onMove(e){
    if (mode !== 'markup' || isLK(e)) return;
    const target = targetAt(e.clientX, e.clientY);
    if (target !== hoverTarget) hoverTarget = target;
    if (target) showOutline(target);
    else hideOutline();
  }

  function onDown(e){
    if (!mode || isLK(e)) return;
    stop(e);
    blockNext = true;

    if ($('.composer').classList.contains('is-visible') && dirty) {
      shake($('.composer'));
      return;
    }

    const target = targetAt(e.clientX, e.clientY);
    if (mode === 'markup') {
      if (!target) { toast('Нет data-loop-id'); return; }
      targetEl = target;
      point = null;
      openComposer(target, e.clientX + 12, e.clientY + 12, 'markup.comment', titleOf(target));
    } else if (mode === 'comments') {
      targetEl = target || activeScope();
      point = makePoint(targetEl, e.clientX, e.clientY);
      openComposer(targetEl, e.clientX + 12, e.clientY + 12, 'comment.pin', 'Comment');
    }
  }

  function onMaybeBlock(e){
    if (!mode || isLK(e)) return;
    if (blockNext || mode) {
      stop(e);
      blockNext = false;
    }
  }

  function onKey(e){
    const key = e.key.toLowerCase();

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'e') {
      stop(e);
      copyBundle();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'l') {
      stop(e);
      setCollapsed(!collapsed);
      return;
    }

    if (isTextInputEvent(e)) return;

    const active = isLoopKitActive();
    if (!active) return;

    e.stopPropagation();
    e.stopImmediatePropagation && e.stopImmediatePropagation();

    if (isNavigationKey(e)) e.preventDefault();

    if (e.key === 'Escape') {
      e.preventDefault();
      clearMode();
      closeComposer();
      hidePreview();
      $('.drawer').classList.remove('is-visible');
      releaseFocus();
    }
  }

  function openComposer(target, x, y, type, title, subtitle){
    const composer = $('.composer');
    const textarea = composer.querySelector('textarea');
    composer.dataset.type = type;
    composer.querySelector('.title').textContent = title || 'Feedback';
    composer.querySelector('.sub').textContent = subtitle || (target ? target.dataset.loopId || '' : '');
    composer.style.left = clamp(x, 14, window.innerWidth - 390) + 'px';
    composer.style.top = clamp(y, 54, window.innerHeight - 240) + 'px';
    textarea.value = '';
    dirty = false;
    composer.classList.add('is-visible');
    setTimeout(() => textarea.focus(), 0);
  }

  function closeComposer(){
    const composer = $('.composer');
    if (!composer) return;
    composer.classList.remove('is-visible');
    const textarea = composer.querySelector('textarea');
    if (textarea) textarea.value = '';
    dirty = false;
    targetEl = null;
    point = null;
  }

  function saveDraft(){
    const composer = $('.composer');
    const textarea = composer.querySelector('textarea');
    const message = textarea.value.trim();
    if (!message) { shake(composer); return; }

    const type = composer.dataset.type || 'markup.comment';
    const ev = base(type, message);
    if (type !== 'tweak.request') ev.target = info(targetEl);
    if (type === 'comment.pin') ev.point = point;

    events.push(ev);
    persist();
    closeComposer();
    clearMode();
    render();
    releaseFocus();
    toast('Saved');
  }

  function targetAt(x, y){
    const old = host.style.display;
    host.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    host.style.display = old;
    const target = el && el.closest && el.closest('[data-loop-id]');
    if (!target || target.closest('[data-loop-ignore]')) return null;
    return target;
  }

  function activeScope(){
    return document.querySelector('.slide.active,[aria-current="true"],[data-loop-active="true"]') || document.querySelector('[data-loop-id]');
  }

  function makePoint(target, x, y){
    const p = { x: Math.round(x), y: Math.round(y) };
    if (target) {
      const rect = target.getBoundingClientRect();
      p.relX = rect.width ? (x - rect.left) / rect.width : 0;
      p.relY = rect.height ? (y - rect.top) / rect.height : 0;
    }
    return p;
  }

  function showOutline(target){
    const rect = target.getBoundingClientRect();
    const outline = $('.outline');
    outline.style.left = Math.round(rect.left) + 'px';
    outline.style.top = Math.round(rect.top) + 'px';
    outline.style.width = Math.round(rect.width) + 'px';
    outline.style.height = Math.round(rect.height) + 'px';
    outline.querySelector('span').textContent = titleOf(target);
    outline.classList.add('is-visible');
  }
  function hideOutline(){ const outline = $('.outline'); if (outline) outline.classList.remove('is-visible'); }

  function render(){
    renderPill();
    renderList();
    renderPins();
    if (previewEventId && !events.some(ev => ev.id === previewEventId)) hidePreview();
  }

  function renderPill(){
    const pill = $('.pill');
    pill.textContent = 'Feedback ' + events.length;
    pill.classList.toggle('is-visible', events.length > 0);
  }

  function renderList(){
    const list = $('.drawer-list');
    if (!list) return;

    if (!events.length) {
      list.innerHTML = '<div class="item">Пока нет фидбэка.</div>';
      return;
    }

    list.innerHTML = '';
    events.forEach((ev, index) => {
      const item = document.createElement('div');
      item.className = 'item';

      const small = document.createElement('small');
      small.textContent = `${index + 1}. ${ev.type}${ev.target ? ' · ' + ev.target.id : ''}`;
      const text = document.createElement('div');
      text.className = 'item-text';
      text.textContent = ev.message;
      const zone = document.createElement('div');
      zone.className = 'delete-zone';

      if (pendingDeleteId === ev.id) {
        zone.innerHTML = '<div class="confirm-delete"><span>Delete?</span><button type="button" class="yes">Yes</button><button type="button">No</button></div>';
        zone.querySelector('.yes').addEventListener('click', e => { stop(e); deleteEvent(ev.id); });
        zone.querySelector('button:not(.yes)').addEventListener('click', e => { stop(e); pendingDeleteId = null; renderList(); });
      } else {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'icon-btn';
        del.title = 'Delete feedback';
        del.innerHTML = ICONS.trash + '<span class="sr">Delete</span>';
        del.addEventListener('click', e => { stop(e); pendingDeleteId = ev.id; renderList(); });
        zone.appendChild(del);
      }

      item.appendChild(small);
      item.appendChild(text);
      item.appendChild(zone);
      list.appendChild(item);
    });
  }

  function renderPins(){
    const box = $('.pins');
    if (!box) return;
    box.innerHTML = '';

    events.forEach((ev, index) => {
      const pos = pinPos(ev);
      if (!pos) return;

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin' + (ev.type === 'comment.pin' ? ' free' : '');
      pin.textContent = String(index + 1);
      pin.title = ev.message;
      pin.style.left = pos.x + 'px';
      pin.style.top = pos.y + 'px';
      pin.addEventListener('click', e => { stop(e); showPreview(ev, pin, index + 1); });
      box.appendChild(pin);
    });
  }

  function pinPos(ev){
    let target = null;
    if (ev.target && ev.target.id) {
      try { target = document.querySelector(`[data-loop-id="${cssEsc(ev.target.id)}"]`); } catch {}
    }

    if (target && ev.point && ev.point.relX != null) {
      const rect = target.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width * ev.point.relX), y: Math.round(rect.top + rect.height * ev.point.relY) };
    }
    if (ev.point) return { x: ev.point.x, y: ev.point.y };
    if (target) {
      const rect = target.getBoundingClientRect();
      return { x: Math.round(rect.right), y: Math.round(rect.top) };
    }
    return null;
  }

  function showPreview(ev, anchor, number){
    const preview = $('.preview');
    const rect = anchor.getBoundingClientRect();
    previewEventId = ev.id;
    preview.innerHTML = `<div class="head"><div><div class="title">${number}. ${esc(ev.type)}</div><div class="sub">${esc(ev.target?.id || 'artifact')}</div></div><button type="button" class="x" data-preview-close>${ICONS.close}</button></div><div class="body"><div class="preview-text">${esc(ev.message)}</div></div>`;
    preview.style.left = clamp(rect.left + 12, 14, window.innerWidth - 360) + 'px';
    preview.style.top = clamp(rect.top + 12, 54, window.innerHeight - 220) + 'px';
    preview.classList.add('is-visible');
    preview.querySelector('[data-preview-close]').addEventListener('click', e => { stop(e); hidePreview(); });
  }

  function hidePreview(){
    const preview = $('.preview');
    if (!preview) return;
    preview.classList.remove('is-visible');
    preview.innerHTML = '';
    previewEventId = null;
  }

  function deleteEvent(id){
    const before = events.length;
    events = events.filter(ev => ev.id !== id);
    if (events.length === before) return;
    pendingDeleteId = null;
    persist();
    render();
    hidePreview();
    toast('Deleted');
  }

  function base(type, message){
    return { id: uid('fb'), type, artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, createdAt: new Date().toISOString(), message, url: location.href };
  }

  function info(target){
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return {
      id: target.dataset.loopId,
      kind: target.dataset.loopKind || target.tagName.toLowerCase(),
      title: titleOf(target),
      selector: `[data-loop-id="${cssEsc(target.dataset.loopId)}"]`,
      text: compact(target.textContent, 700),
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }

  function exportBundle(){
    return {
      protocol: 'loopkit.feedback_bundle.v0',
      runtimeVersion: VERSION,
      artifact: {
        id: meta.artifactId,
        version: meta.artifactVersion,
        title: meta.title,
        description: meta.description || '',
        url: location.href,
        feedback_policy: 'single-use'
      },
      decisions,
      agent_instructions: agentInstructions,
      items: events.slice()
    };
  }

  function exportMarkdown(){
    const bundle = exportBundle();
    const lines = ['# LoopKit feedback bundle', '', `Artifact: ${bundle.artifact.title}`, `ID: ${bundle.artifact.id}`, `Version: ${bundle.artifact.version}`, 'Policy: feedback is single-use and applies only to this artifact version.', ''];
    if (decisions) lines.push('## DECISIONS', decisions, '');
    lines.push('## Feedback items');
    if (!events.length) lines.push('No feedback items.');
    events.forEach((ev, index) => {
      lines.push('', `### ${index + 1}. ${ev.type}`);
      if (ev.target) lines.push(`Target: ${ev.target.id} — ${ev.target.title}`);
      if (ev.point) lines.push(`Point: x=${ev.point.x}, y=${ev.point.y}`);
      lines.push(`Message: ${ev.message}`);
    });
    lines.push('', '## Machine-readable JSON', '```json', JSON.stringify(bundle, null, 2), '```');
    return lines.join('\n');
  }

  async function copyBundle(){
    const text = exportMarkdown();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast('Feedback bundle copied');
  }

  function clearEvents(){
    events = [];
    pendingDeleteId = null;
    persist();
    render();
    $('.drawer').classList.remove('is-visible');
    hidePreview();
    toast('Cleared');
  }

  function isLoopKitActive(){
    return !!mode || $('.composer')?.classList.contains('is-visible') || $('.drawer')?.classList.contains('is-visible');
  }

  function isNavigationKey(e){
    return [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key);
  }

  function isTextInputEvent(e){
    const node = e.composedPath?.()[0] || e.target;
    const tag = node?.tagName;
    return tag === 'TEXTAREA' || tag === 'INPUT' || node?.isContentEditable;
  }

  function releaseFocus(){
    try { root?.activeElement?.blur?.(); } catch {}
    try { if (document.activeElement === host) host.blur(); } catch {}
    const body = document.body;
    if (!body) return;
    if (!body.hasAttribute('tabindex')) body.setAttribute('tabindex', '-1');
    try { body.focus({ preventScroll: true }); } catch {}
  }

  function readEvents(){ try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; } }
  function persist(){ localStorage.setItem(storageKey, JSON.stringify(events)); }
  function readUi(){ try { return JSON.parse(localStorage.getItem(uiKey) || '{}'); } catch { return {}; } }
  function writeUi(value){ localStorage.setItem(uiKey, JSON.stringify(value)); }

  function readMeta(){
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
    } catch { return fallback; }
  }

  function textOf(selector){ return (document.querySelector(selector)?.textContent || '').trim(); }
  function $(selector){ return root.querySelector(selector); }
  function isLK(e){ return e.composedPath && e.composedPath().includes(host); }
  function stop(e){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }
  function titleOf(target){ return target?.dataset.loopTitle || target?.getAttribute('aria-label') || compact(target?.textContent, 80) || target?.dataset.loopId || 'Feedback'; }
  function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`; }
  function compact(value, max){ return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function cssEsc(value){ return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function shake(el){ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function toast(message){ const toastEl = $('.toast'); toastEl.textContent = message; toastEl.classList.add('is-visible'); clearTimeout(toast._timer); toast._timer = setTimeout(() => toastEl.classList.remove('is-visible'), 1300); }
})();

/* LoopKit merged UX layer: floating collapsed control + feedback panel inside toolbar. */
(function(){
  'use strict';

  const STYLE_ID = 'loopkit-merged-ux-style';
  const POSITIONS = ['top-notch','top-left','top-mid-left','top-center','top-mid-right','top-right','right-top','right-center','right-bottom','bottom-right','bottom-mid-right','bottom-center','bottom-mid-left','bottom-left','left-bottom','left-center','left-top'];
  const STORAGE_PREFIX = 'loopkit:merged-edge-position:';
  let installed = false;
  let drag = null;
  let raf = 0;
  let pendingDeleteId = null;
  let updater = 0;

  function install(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    const api = window.LoopKit;
    if (!host || !shadow || !api) return false;
    if (installed) return true;

    const bar = shadow.querySelector('.bar');
    const edge = shadow.querySelector('.edge,[data-expand]');
    const pill = shadow.querySelector('.pill');
    const drawer = shadow.querySelector('.drawer');
    const lkui = shadow.querySelector('.lk-ui');
    if (!bar || !edge || !pill || !drawer || !lkui) return false;

    installed = true;

    const artifactId = api.meta && api.meta.artifactId || 'artifact';
    const storageKey = STORAGE_PREFIX + artifactId;

    const commentsButton = bar.querySelector('[data-mode="comments"]');
    if (commentsButton) {
      const label = commentsButton.querySelector('span:not(.sr)');
      if (label) label.textContent = '+ Comment';
      commentsButton.title = '+ Comment';
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .lk-ui { --overlay-border: rgba(56, 189, 248, .78); }
      .bar { border-color: var(--overlay-border) !important; }
      .pill, .drawer { display: none !important; }

      .edge {
        position: fixed !important;
        width: auto !important;
        min-width: 98px !important;
        height: 32px !important;
        padding: 0 12px !important;
        display: none;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        border: 1px solid var(--overlay-border) !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.93) !important;
        color: #171717 !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.14) !important;
        backdrop-filter: blur(18px) !important;
        opacity: .94 !important;
        cursor: grab !important;
        user-select: none !important;
        transition: opacity .16s ease, box-shadow .16s ease !important;
      }
      :host(.is-collapsed) .edge { display: inline-flex !important; }
      .edge:hover, .edge:focus-visible { opacity: 1 !important; box-shadow: 0 14px 34px rgba(0,0,0,.18) !important; }
      .edge.is-dragging {
        left: var(--lk-edge-drag-x) !important;
        top: var(--lk-edge-drag-y) !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        cursor: grabbing !important;
        opacity: 1 !important;
        transition: none !important;
        z-index: 3;
        will-change: left, top, transform;
      }
      .edge.is-snapping {
        left: var(--lk-edge-snap-x) !important;
        top: var(--lk-edge-snap-y) !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        opacity: 1 !important;
        transition: left .22s cubic-bezier(.2,.8,.2,1), top .22s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease !important;
        z-index: 3;
      }
      .edge-target-zone {
        position: fixed; left: -9999px; top: -9999px;
        width: 98px; height: 32px;
        border: 1.5px solid rgba(56,189,248,.85);
        border-radius: 999px;
        background: rgba(56,189,248,.10);
        box-shadow: 0 0 0 4px rgba(56,189,248,.13);
        pointer-events: none;
        opacity: 0;
        transform: translate(-50%, -50%) scale(.94);
        transition: opacity .12s ease, transform .12s ease, left .16s cubic-bezier(.2,.8,.2,1), top .16s cubic-bezier(.2,.8,.2,1);
        z-index: 2;
      }
      .edge-target-zone.is-visible { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      .edge-grip { width: 20px; height: 4px; border-radius: 999px; background: currentColor; opacity: .42; flex: 0 0 auto; }
      .edge-label { font-size: 12px; font-weight: 800; white-space: nowrap; }
      .edge-shortcut {
        position: absolute; left: 50%; bottom: calc(100% + 8px);
        transform: translateX(-50%) translateY(3px);
        opacity: 0; pointer-events: none; white-space: nowrap;
        padding: 6px 9px; border-radius: 999px; border: 1px solid rgba(23,23,23,.13);
        background: rgba(255,255,255,.96); color: #171717;
        font-size: 11px; font-weight: 800; box-shadow: 0 10px 26px rgba(0,0,0,.14);
        transition: opacity .14s ease, transform .14s ease;
      }
      .edge:hover .edge-shortcut, .edge:focus-visible .edge-shortcut { opacity: 1; transform: translateX(-50%) translateY(0); }

      :host([data-lk-edge-position="top-left"]) .edge { left: 14px !important; top: 14px !important; right:auto !important; bottom:auto !important; transform:none !important; }
      :host([data-lk-edge-position="top-mid-left"]) .edge { left: 25% !important; top: 14px !important; right:auto !important; bottom:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="top-center"]) .edge { left: 50% !important; top: 14px !important; right:auto !important; bottom:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="top-mid-right"]) .edge { left: 75% !important; top: 14px !important; right:auto !important; bottom:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="top-right"]) .edge { right: 14px !important; top: 14px !important; left:auto !important; bottom:auto !important; transform:none !important; }

      :host([data-lk-edge-position="right-top"]) .edge { right: 14px !important; top: 25% !important; left:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position="right-center"]) .edge { right: 14px !important; top: 50% !important; left:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position="right-bottom"]) .edge { right: 14px !important; top: 75% !important; left:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }

      :host([data-lk-edge-position="bottom-right"]) .edge { right: 14px !important; bottom: 14px !important; left:auto !important; top:auto !important; transform:none !important; }
      :host([data-lk-edge-position="bottom-mid-right"]) .edge { left: 75% !important; bottom: 14px !important; right:auto !important; top:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="bottom-center"]) .edge { left: 50% !important; bottom: 14px !important; right:auto !important; top:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="bottom-mid-left"]) .edge { left: 25% !important; bottom: 14px !important; right:auto !important; top:auto !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="bottom-left"]) .edge { left: 14px !important; bottom: 14px !important; right:auto !important; top:auto !important; transform:none !important; }

      :host([data-lk-edge-position="left-bottom"]) .edge { left: 14px !important; top: 75% !important; right:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position="left-center"]) .edge { left: 14px !important; top: 50% !important; right:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position="left-top"]) .edge { left: 14px !important; top: 25% !important; right:auto !important; bottom:auto !important; transform: translateY(-50%) !important; }

      :host([data-lk-edge-position="top-notch"]) .edge {
        left: 50% !important;
        top: -20px !important;
        right: auto !important;
        bottom: auto !important;
        min-width: 126px !important;
        height: 34px !important;
        padding-top: 18px !important;
        transform: translateX(-50%) !important;
        border-top: 0 !important;
        border-radius: 0 0 28px 28px / 0 0 14px 14px !important;
      }
      :host([data-lk-edge-position="top-notch"]) .edge:hover,
      :host([data-lk-edge-position="top-notch"]) .edge:focus-visible {
        top: -10px !important;
      }
      :host([data-lk-edge-position="top-notch"]) .edge-grip {
        height: 3px;
        opacity: .55;
      }

      :host([data-lk-edge-position^="top-"]) .edge-shortcut,
      :host([data-lk-edge-position="top-notch"]) .edge-shortcut { bottom:auto; top: calc(100% + 8px); }

      .edge-target-zone[data-position="top-notch"] {
        height: 34px !important;
        border-top: 0;
        border-radius: 0 0 28px 28px / 0 0 14px 14px;
        transform: translate(-50%, -50%) scale(.98);
      }

      :host(.is-collapsed) .edge.is-dragging,
      :host([data-lk-edge-position]) .edge.is-dragging {
        left: var(--lk-edge-drag-x) !important;
        top: var(--lk-edge-drag-y) !important;
        right: auto !important;
        bottom: auto !important;
        padding-top: 0 !important;
        transform: translate(-50%, -50%) !important;
        border-top: 1px solid var(--overlay-border) !important;
        border-radius: 999px !important;
      }

      :host(.is-collapsed) .edge.is-snapping,
      :host([data-lk-edge-position]) .edge.is-snapping {
        left: var(--lk-edge-snap-x) !important;
        top: var(--lk-edge-snap-y) !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
      }

      .toolbar-feedback {
        height: 32px; border: 0; border-radius: 999px; background: transparent; color: var(--muted, #737373);
        padding: 0 10px; display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
        font-size: 13px; font-weight: 700; white-space: nowrap;
      }
      .toolbar-feedback:hover { background: var(--soft, rgba(23,23,23,.055)); color: var(--text, #171717); }
      .toolbar-feedback.is-open { background: #111827; color: #fff; }
      .toolbar-feedback.has-items:not(.is-open) { background: rgba(56,189,248,.12); color: var(--text, #171717); }
      .toolbar-feedback svg { width: 15px; height: 15px; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .toolbar-feedback-count {
        min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
        display: inline-flex; align-items: center; justify-content: center;
        background: #111827; color: #fff; font-size: 11px; line-height: 1; font-weight: 800;
      }
      .toolbar-feedback.is-open .toolbar-feedback-count { background: rgba(255,255,255,.18); color: #fff; }
      .toolbar-feedback:not(.has-items):not(.is-open) .toolbar-feedback-count { background: rgba(23,23,23,.10); color: var(--muted, #737373); }

      .toolbar-feedback-panel {
        position: fixed; top: 62px; left: 50%; width: min(430px, calc(100vw - 28px));
        max-height: min(560px, calc(100vh - 82px));
        border: 1px solid rgba(23,23,23,.13); border-radius: 20px;
        background: rgba(255,255,255,.96); color: #171717;
        backdrop-filter: blur(18px); box-shadow: 0 18px 60px rgba(0,0,0,.18);
        pointer-events: auto; overflow: hidden; opacity: 0;
        transform: translateX(-50%) translateY(-10px) scale(.985);
        visibility: hidden;
        transition: opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1), visibility .18s ease;
      }
      .toolbar-feedback-panel.is-open { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); visibility: visible; }
      .tf-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 14px; border-bottom:1px solid rgba(23,23,23,.08); }
      .tf-title { font-size:13px; font-weight:800; }
      .tf-sub { margin-top:2px; color:#737373; font-size:11px; }
      .tf-close { width:28px; height:28px; border:0; border-radius:999px; background:transparent; color:#737373; cursor:pointer; }
      .tf-close:hover { background:rgba(23,23,23,.055); color:#171717; }
      .tf-list { max-height:min(410px, calc(100vh - 190px)); overflow:auto; padding:10px; display:grid; gap:8px; }
      .tf-empty, .tf-item { border:1px solid rgba(23,23,23,.10); border-radius:14px; background:rgba(23,23,23,.025); padding:10px; }
      .tf-empty { color:#737373; font-size:12px; text-align:center; padding:18px; }
      .tf-item { position:relative; padding-right:42px; }
      .tf-meta { display:block; margin-bottom:5px; color:#737373; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
      .tf-text { white-space:pre-wrap; font-size:12px; line-height:1.35; }
      .tf-delete-zone { position:absolute; right:7px; top:7px; display:flex; align-items:center; gap:4px; }
      .tf-icon { width:28px; height:28px; padding:0; border:0; border-radius:999px; background:transparent; color:#737373; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
      .tf-icon:hover { background:rgba(23,23,23,.055); color:#dc2626; }
      .tf-icon svg { width:15px; height:15px; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
      .tf-confirm { display:flex; align-items:center; gap:5px; padding:3px 4px 3px 8px; border:1px solid rgba(220,38,38,.16); border-radius:999px; background:#fff; box-shadow:0 8px 22px rgba(0,0,0,.08); }
      .tf-confirm span { color:#dc2626; font-size:11px; font-weight:800; white-space:nowrap; }
      .tf-confirm button { height:24px; border:0; border-radius:999px; background:transparent; color:#737373; padding:0 7px; font-size:11px; font-weight:800; cursor:pointer; }
      .tf-confirm .yes { background:#dc2626; color:#fff; }
      .tf-actions { display:flex; justify-content:flex-end; gap:8px; padding:12px 14px 14px; border-top:1px solid rgba(23,23,23,.08); }
      .tf-action { height:32px; border:1px solid rgba(23,23,23,.14); border-radius:999px; background:#fff; color:#171717; padding:0 12px; cursor:pointer; font-size:12px; font-weight:700; }
      .tf-action.primary { background:#111827; border-color:#111827; color:#fff; }

      @media (max-width: 760px) {
        .bar { max-width: calc(100vw - 12px); gap: 2px !important; }
        .bar [data-mode="markup"] span, .bar [data-mode="comments"] span { display: inline !important; }
        .bar [data-mode="tweaks"] span, .toolbar-feedback-label { display: none !important; }
        .toolbar-feedback { width: 32px; padding: 0 !important; justify-content: center; position: relative; }
        .toolbar-feedback-count { position:absolute; right:-2px; top:-4px; min-width:15px; height:15px; padding:0 4px; font-size:10px; }
        .toolbar-feedback-panel { top:58px; width:calc(100vw - 16px); }
      }
    `;
    if (!shadow.getElementById(STYLE_ID)) shadow.appendChild(style);

    setupEdge(host, shadow, edge, storageKey);
    setupFeedbackPanel(shadow, bar, lkui);
    return true;
  }

  function setupEdge(host, shadow, edge, storageKey){
    const lkui = shadow.querySelector('.lk-ui');

    edge.innerHTML = '<span class="edge-grip"></span><span class="edge-label">LoopKit</span><span class="edge-shortcut">Ctrl/⌘⇧L</span>';
    edge.title = 'Drag to an edge position · Ctrl/⌘+Shift+L';

    let zone = shadow.querySelector('.edge-target-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'edge-target-zone';
      lkui && lkui.appendChild(zone);
    }

    setPosition(host, storageKey, localStorage.getItem(storageKey) || 'top-right');

    edge.addEventListener('pointerdown', (event) => {
      if (!host.classList.contains('is-collapsed')) return;

      cancelAnimationFrame(raf);
      raf = 0;
      edge.classList.remove('is-snapping');
      edge.style.removeProperty('--lk-edge-snap-x');
      edge.style.removeProperty('--lk-edge-snap-y');
      hideTargetZone(zone);

      const rect = edge.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      drag = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: centerX,
        currentY: centerY,
        offsetX: event.clientX - centerX,
        offsetY: event.clientY - centerY,
        targetPosition: nearestPosition(event.clientX, event.clientY),
        moved: false
      };

      setDragPosition(edge, centerX, centerY);
      edge.setPointerCapture && edge.setPointerCapture(event.pointerId);
    }, true);

    edge.addEventListener('pointermove', (event) => {
      if (!drag) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;

      drag.moved = true;
      edge.dataset.suppressClick = 'true';
      edge.classList.add('is-dragging');

      const nextX = event.clientX - drag.offsetX;
      const nextY = event.clientY - drag.offsetY;
      drag.currentX = nextX;
      drag.currentY = nextY;
      setDragPosition(edge, nextX, nextY);

      const nextPosition = nearestPosition(event.clientX, event.clientY);
      if (nextPosition !== drag.targetPosition) drag.targetPosition = nextPosition;
      updateTargetZone(zone, edge, drag.targetPosition);

      event.preventDefault();
      event.stopPropagation();
    }, true);

    edge.addEventListener('pointerup', (event) => {
      if (!drag) return;

      const moved = drag.moved;
      const position = drag.targetPosition || nearestPosition(event.clientX, event.clientY);
      drag = null;
      cancelAnimationFrame(raf);
      raf = 0;

      if (moved) {
        const rect = edge.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;

        animateSnap(edge, host, storageKey, position, fromX, fromY, zone);

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setTimeout(() => { delete edge.dataset.suppressClick; }, 120);
      } else {
        hideTargetZone(zone);
        window.LoopKit && window.LoopKit.expand && window.LoopKit.expand();
      }
    }, true);

    edge.addEventListener('click', (event) => {
      if (!host.classList.contains('is-collapsed')) return;
      if (edge.dataset.suppressClick === 'true') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        delete edge.dataset.suppressClick;
      }
    }, true);
  }

  function setDragPosition(edge, x, y){
    edge.style.setProperty('--lk-edge-drag-x', x + 'px');
    edge.style.setProperty('--lk-edge-drag-y', y + 'px');
  }

  function animateSnap(edge, host, storageKey, position, fromX, fromY, zone){
    const target = positionPoint(edge, position);

    edge.style.setProperty('--lk-edge-snap-x', fromX + 'px');
    edge.style.setProperty('--lk-edge-snap-y', fromY + 'px');
    edge.classList.add('is-snapping');
    edge.classList.remove('is-dragging');
    edge.style.removeProperty('--lk-edge-drag-x');
    edge.style.removeProperty('--lk-edge-drag-y');

    updateTargetZone(zone, edge, position);

    requestAnimationFrame(() => {
      edge.style.setProperty('--lk-edge-snap-x', target.x + 'px');
      edge.style.setProperty('--lk-edge-snap-y', target.y + 'px');
    });

    setTimeout(() => {
      setPosition(host, storageKey, position);
      edge.classList.remove('is-snapping');
      edge.style.removeProperty('--lk-edge-snap-x');
      edge.style.removeProperty('--lk-edge-snap-y');
      hideTargetZone(zone);
    }, 240);
  }

  function updateTargetZone(zone, edge, position){
    if (!zone) return;
    const target = positionPoint(edge, position);
    const rect = edge.getBoundingClientRect();
    zone.style.width = Math.max(rect.width || 98, 98) + 'px';
    zone.style.height = Math.max(rect.height || 32, 32) + 'px';
    zone.style.left = target.x + 'px';
    zone.style.top = target.y + 'px';
    zone.dataset.position = position;
    zone.classList.add('is-visible');
  }

  function hideTargetZone(zone){
    if (!zone) return;
    zone.classList.remove('is-visible');
  }

  function setupFeedbackPanel(shadow, bar, lkui){
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-feedback';
    button.setAttribute('data-toolbar-feedback', 'true');
    button.title = 'Open feedback list';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span class="toolbar-feedback-label">Feedback</span><span class="toolbar-feedback-count">0</span>';

    const panel = document.createElement('div');
    panel.className = 'toolbar-feedback-panel';
    panel.innerHTML = '<div class="tf-head"><div><div class="tf-title">Feedback</div><div class="tf-sub">Одноразовый bundle для этой версии</div></div><button class="tf-close" type="button">×</button></div><div class="tf-list"></div><div class="tf-actions"><button class="tf-action" type="button" data-tf-clear>Clear</button><button class="tf-action primary" type="button" data-tf-copy>Copy for AI</button></div>';

    const copy = bar.querySelector('[data-copy]');
    bar.insertBefore(button, copy || null);
    lkui.appendChild(panel);

    function closePanel(){
      button.classList.remove('is-open');
      panel.classList.remove('is-open');
      pendingDeleteId = null;
      update();
    }

    function openPanel(){
      const activeMode = shadow.querySelector('[data-mode].is-active');
      if (activeMode) activeMode.click();
      button.classList.add('is-open');
      panel.classList.add('is-open');
      update();
    }

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (panel.classList.contains('is-open')) closePanel();
      else openPanel();
    });

    panel.querySelector('.tf-close').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    });

    panel.querySelector('[data-tf-copy]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.LoopKit && window.LoopKit.copyBundle && window.LoopKit.copyBundle();
    });

    panel.querySelector('[data-tf-clear]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingDeleteId = null;
      window.LoopKit && window.LoopKit.clearEvents && window.LoopKit.clearEvents();
      update();
    });

    bar.querySelectorAll('[data-mode], [data-copy], [data-collapse]').forEach((control) => {
      control.addEventListener('click', () => closePanel(), true);
    });

    function update(){
      const events = window.LoopKit && window.LoopKit.getEvents ? window.LoopKit.getEvents() : [];
      const count = events.length;
      button.classList.toggle('has-items', count > 0);
      button.querySelector('.toolbar-feedback-count').textContent = String(count);
      button.title = count ? `Open feedback list (${count})` : 'Open feedback list';

      const list = panel.querySelector('.tf-list');
      list.innerHTML = '';
      if (!events.length) {
        const empty = document.createElement('div');
        empty.className = 'tf-empty';
        empty.textContent = 'Пока нет фидбэка.';
        list.appendChild(empty);
        return;
      }

      events.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'tf-item';

        const meta = document.createElement('small');
        meta.className = 'tf-meta';
        meta.textContent = `${index + 1}. ${item.type}${item.target ? ' · ' + item.target.id : ''}`;

        const text = document.createElement('div');
        text.className = 'tf-text';
        text.textContent = item.message || '';

        const zone = document.createElement('div');
        zone.className = 'tf-delete-zone';

        if (pendingDeleteId === item.id) {
          zone.innerHTML = '<div class="tf-confirm"><span>Delete?</span><button type="button" class="yes">Yes</button><button type="button">No</button></div>';
          zone.querySelector('.yes').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            pendingDeleteId = null;
            window.LoopKit && window.LoopKit.deleteEvent && window.LoopKit.deleteEvent(item.id);
            update();
          });
          zone.querySelector('button:not(.yes)').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            pendingDeleteId = null;
            update();
          });
        } else {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'tf-icon';
          del.title = 'Delete feedback';
          del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
          del.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            pendingDeleteId = item.id;
            update();
          });
          zone.appendChild(del);
        }

        row.appendChild(meta);
        row.appendChild(text);
        row.appendChild(zone);
        list.appendChild(row);
      });
    }

    update();
    clearInterval(updater);
    updater = setInterval(update, 400);
  }

  function setPosition(host, key, position){
    const safe = POSITIONS.includes(position) ? position : 'top-right';
    host.setAttribute('data-lk-edge-position', safe);
    localStorage.setItem(key, safe);
  }

  function positionPoint(edge, position){
    const rect = edge.getBoundingClientRect();
    const width = rect.width || 98;
    const height = rect.height || 32;
    const pad = 14;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const notchTop = -20;
    const map = {
      'top-notch': { x: w / 2, y: notchTop + 34 / 2 },

      'top-left': { x: pad + width / 2, y: pad + height / 2 },
      'top-mid-left': { x: w * .25, y: pad + height / 2 },
      'top-center': { x: w / 2, y: pad + height / 2 },
      'top-mid-right': { x: w * .75, y: pad + height / 2 },
      'top-right': { x: w - pad - width / 2, y: pad + height / 2 },

      'right-top': { x: w - pad - width / 2, y: h * .25 },
      'right-center': { x: w - pad - width / 2, y: h / 2 },
      'right-bottom': { x: w - pad - width / 2, y: h * .75 },

      'bottom-right': { x: w - pad - width / 2, y: h - pad - height / 2 },
      'bottom-mid-right': { x: w * .75, y: h - pad - height / 2 },
      'bottom-center': { x: w / 2, y: h - pad - height / 2 },
      'bottom-mid-left': { x: w * .25, y: h - pad - height / 2 },
      'bottom-left': { x: pad + width / 2, y: h - pad - height / 2 },

      'left-bottom': { x: pad + width / 2, y: h * .75 },
      'left-center': { x: pad + width / 2, y: h / 2 },
      'left-top': { x: pad + width / 2, y: h * .25 }
    };
    return map[position] || map['top-right'];
  }

  function nearestPosition(x, y){
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;

    if (y <= 26 && x > w * .18 && x < w * .82) return 'top-notch';

    const dTop = y;
    const dRight = w - x;
    const dBottom = h - y;
    const dLeft = x;
    const nearest = Math.min(dTop, dRight, dBottom, dLeft);

    if (nearest === dTop) return horizontalBucket('top', x, w);
    if (nearest === dBottom) return horizontalBucket('bottom', x, w);
    if (nearest === dRight) return verticalBucket('right', y, h);
    return verticalBucket('left', y, h);
  }

  function horizontalBucket(edge, x, w){
    const p = x / (w || 1);
    if (edge === 'top') {
      if (p < .16) return 'top-left';
      if (p < .38) return 'top-mid-left';
      if (p < .62) return 'top-center';
      if (p < .84) return 'top-mid-right';
      return 'top-right';
    }
    if (p < .16) return 'bottom-left';
    if (p < .38) return 'bottom-mid-left';
    if (p < .62) return 'bottom-center';
    if (p < .84) return 'bottom-mid-right';
    return 'bottom-right';
  }

  function verticalBucket(edge, y, h){
    const p = y / (h || 1);
    if (edge === 'right') {
      if (p < .34) return 'right-top';
      if (p < .66) return 'right-center';
      return 'right-bottom';
    }
    if (p < .34) return 'left-top';
    if (p < .66) return 'left-center';
    return 'left-bottom';
  }

  if (!install()) {
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (install() || tries > 80) clearInterval(poll);
    }, 100);
  }
})();

(function(){
  'use strict';

  const VERSION = '0.2.0-portable';
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
        .item { border:1px solid rgba(23,23,23,.10); border-radius:14px; padding:10px; background:rgba(23,23,23,.025); }
        .item small { display:block; color:var(--muted); font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin-bottom:5px; font-size:11px; }
        .item-text { font-size:12px; line-height:1.35; white-space:pre-wrap; }
        .item button { margin-top:8px; height:26px; border-radius:999px; border:1px solid rgba(23,23,23,.12); background:#fff; padding:0 9px; font-size:11px; cursor:pointer; }
        .preview { position: fixed; display:none; width:min(340px, calc(100vw - 28px)); padding:12px; }
        .preview.is-visible { display:block; }
        .preview-target { color:var(--muted); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin:6px 0; }
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
    root.addEventListener('keydown', e => e.stopPropagation(), false);
    root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', e => {
      stop(e);
      setMode(mode === button.dataset.mode ? null : button.dataset.mode);
    }));
    root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', e => { stop(e); copyBundle(); }));
    root.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', e => { stop(e); closeComposer(); }));
    $('.composer [data-save]').addEventListener('click', e => { stop(e); saveDraft(); });
    $('[data-close]').addEventListener('click', e => { stop(e); $('.drawer').classList.remove('is-visible'); });
    $('[data-clear]').addEventListener('click', e => { stop(e); clearEvents(); });
    $('[data-collapse]').addEventListener('click', e => { stop(e); setCollapsed(true); });
    $('[data-expand]').addEventListener('click', e => { stop(e); setCollapsed(false); });
    $('.pill').addEventListener('click', e => { stop(e); $('.drawer').classList.toggle('is-visible'); renderList(); });
    $('textarea').addEventListener('input', e => { dirty = !!e.target.value.trim(); });
    $('textarea').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveDraft();
      }
    }, false);
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
    if (mode === 'tweaks') openComposer(null, window.innerWidth / 2 - 180, 64, 'tweak.request', 'Tweaks request', 'Опиши, какие интерактивные настройки нужно добавить в следующей версии.');
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
      targetEl = target || document.querySelector('[data-loop-id]');
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
    if (isLK(e)) return;
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'e') { stop(e); copyBundle(); return; }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'l') { stop(e); setCollapsed(!collapsed); return; }

    const active = !!mode || $('.composer')?.classList.contains('is-visible') || $('.drawer')?.classList.contains('is-visible');
    if (active) {
      e.stopPropagation();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
      if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) e.preventDefault();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      clearMode();
      closeComposer();
      hidePreview();
      $('.drawer').classList.remove('is-visible');
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
    if (!events.length) { list.innerHTML = '<div class="item">Пока нет фидбэка.</div>'; return; }
    list.innerHTML = '';
    events.forEach((ev, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `<small>${index + 1}. ${esc(ev.type)} ${ev.target ? '· ' + esc(ev.target.id) : ''}</small><div class="item-text">${esc(ev.message)}</div><button type="button" class="lk-delete" title="Удалить feedback">${ICONS.trash}<span>Delete</span></button>`;
      item.querySelector('.lk-delete').addEventListener('click', e => { stop(e); deleteEvent(ev.id); });
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
    preview.innerHTML = `<div class="head"><div><div class="title">${number}. ${esc(ev.type)}</div><div class="sub">${esc(ev.target?.id || 'artifact')}</div></div><button type="button" class="x" data-preview-close>${ICONS.close}</button></div><div class="body"><div class="preview-text">${esc(ev.message)}</div><div class="actions"><button type="button" class="action" data-preview-delete>${ICONS.trash}<span>Delete</span></button></div></div>`;
    preview.style.left = clamp(rect.left + 12, 14, window.innerWidth - 360) + 'px';
    preview.style.top = clamp(rect.top + 12, 54, window.innerHeight - 220) + 'px';
    preview.classList.add('is-visible');
    preview.querySelector('[data-preview-close]').addEventListener('click', e => { stop(e); hidePreview(); });
    preview.querySelector('[data-preview-delete]').addEventListener('click', e => { stop(e); deleteEvent(ev.id); });
  }
  function hidePreview(){ const preview = $('.preview'); if (!preview) return; preview.classList.remove('is-visible'); preview.innerHTML = ''; previewEventId = null; }
  function deleteEvent(id){ events = events.filter(ev => ev.id !== id); persist(); render(); toast('Deleted'); }

  function base(type, message){
    return { id: uid('fb'), type, artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, createdAt: new Date().toISOString(), message, url: location.href };
  }
  function info(target){
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { id: target.dataset.loopId, kind: target.dataset.loopKind || target.tagName.toLowerCase(), title: titleOf(target), selector: `[data-loop-id="${cssEsc(target.dataset.loopId)}"]`, text: compact(target.textContent, 700), rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } };
  }

  function exportBundle(){
    return {
      protocol: 'loopkit.feedback_bundle.v0',
      runtimeVersion: VERSION,
      artifact: { id: meta.artifactId, version: meta.artifactVersion, title: meta.title, description: meta.description || '', url: location.href, feedback_policy: 'single-use' },
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
  function clearEvents(){ events = []; persist(); render(); $('.drawer').classList.remove('is-visible'); hidePreview(); toast('Cleared'); }
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
      return { artifactId: raw.artifactId || raw.artifact_id || fallback.artifactId, artifactVersion: raw.artifactVersion || raw.artifact_version || fallback.artifactVersion, title: raw.title || fallback.title, description: raw.description || '' };
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

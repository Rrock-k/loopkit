(function(){
  'use strict';

  const VERSION = '0.1.9-portable';
  const ROOT_ID = 'loopkit-root';
  const META_SELECTOR = 'script[type="application/loopkit+json"],script[type="application/loopkit+meta"]';
  const DECISIONS_SELECTOR = '#loopkit-decisions';
  const ICONS = {
    markup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    comments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    tweaks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16"/><path d="M4 16h16"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  const meta = readMeta();
  const decisions = (document.querySelector(DECISIONS_SELECTOR)?.textContent || '').trim();
  const storageKey = `loopkit:v0:${meta.artifactId}:${meta.artifactVersion}`;

  let events = readEvents();
  let mode = null;
  let targetEl = null;
  let point = null;
  let dirty = false;
  let blockNext = false;
  let collapsed = false;
  let previewEventId = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init(){
    if (document.getElementById(ROOT_ID)) return;
    injectStyle();

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-loop-ignore', '');
    root.innerHTML = `
      <div class="lk-bar">
        <button type="button" data-mode="markup" title="Mark up">${ICONS.markup}<span>Mark up</span></button>
        <button type="button" data-mode="comments" title="Comments">${ICONS.comments}<span>Comments</span></button>
        <button type="button" data-mode="tweaks" title="Tweaks">${ICONS.tweaks}<span>Tweaks</span></button>
        <button type="button" data-copy title="Copy bundle">${ICONS.copy}<span>Copy</span></button>
        <button type="button" data-collapse title="Свернуть LoopKit">${ICONS.collapse}<span class="lk-sr">Collapse</span></button>
      </div>
      <button type="button" class="lk-edge" data-expand title="Показать LoopKit">${ICONS.expand}<span>LoopKit</span></button>
      <div class="lk-outline"><span></span></div>
      <div class="lk-composer">
        <div class="lk-title">Feedback</div>
        <textarea placeholder="Напиши фидбэк..."></textarea>
        <div class="lk-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-save>Save</button></div>
      </div>
      <button type="button" class="lk-pill"></button>
      <div class="lk-drawer">
        <div class="lk-drawer-head"><b>Feedback bundle</b><button type="button" data-close>${ICONS.close}</button></div>
        <div class="lk-list"></div>
        <div class="lk-actions"><button type="button" data-clear>Clear</button><button type="button" data-copy>Copy for AI</button></div>
      </div>
      <div class="lk-preview"></div>
      <div class="lk-pins"></div>
      <div class="lk-toast"></div>`;
    document.documentElement.appendChild(root);

    bindUi(root);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onMaybeBlock, true);
    document.addEventListener('click', onMaybeBlock, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', () => { renderPins(); hidePreview(); });

    render();
    window.LoopKit = Object.assign(window.LoopKit || {}, {
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

  function bindUi(root){
    root.addEventListener('pointerdown', e => e.stopPropagation(), false);
    root.addEventListener('click', e => e.stopPropagation(), false);
    root.addEventListener('keydown', e => e.stopPropagation(), false);

    root.querySelectorAll('[data-mode]').forEach(button => {
      button.addEventListener('click', e => {
        stop(e);
        setMode(mode === button.dataset.mode ? null : button.dataset.mode);
      });
    });
    root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', e => { stop(e); copyBundle(); }));
    root.querySelector('[data-save]').addEventListener('click', e => { stop(e); saveDraft(); });
    root.querySelector('[data-cancel]').addEventListener('click', e => { stop(e); closeComposer(); });
    root.querySelector('[data-close]').addEventListener('click', e => { stop(e); $('.lk-drawer').classList.remove('is-visible'); });
    root.querySelector('[data-clear]').addEventListener('click', e => { stop(e); clearEvents(); });
    root.querySelector('[data-collapse]').addEventListener('click', e => { stop(e); setCollapsed(true); });
    root.querySelector('[data-expand]').addEventListener('click', e => { stop(e); setCollapsed(false); });
    root.querySelector('.lk-pill').addEventListener('click', e => { stop(e); $('.lk-drawer').classList.toggle('is-visible'); renderList(); });
    root.querySelector('textarea').addEventListener('input', e => { dirty = !!e.target.value.trim(); });
    root.querySelector('textarea').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveDraft();
      }
    }, false);
  }

  function setCollapsed(next){
    collapsed = !!next;
    const root = document.getElementById(ROOT_ID);
    root.classList.toggle('is-collapsed', collapsed);
    if (collapsed) {
      clearMode();
      $('.lk-drawer').classList.remove('is-visible');
      closeComposer();
      hidePreview();
    }
  }

  function setMode(next){
    if (collapsed) setCollapsed(false);
    mode = next;
    closeComposer();
    hideOutline();
    hidePreview();
    document.querySelectorAll(`#${ROOT_ID} [data-mode]`).forEach(button => button.classList.toggle('is-active', button.dataset.mode === mode));
    document.documentElement.dataset.loopkitMode = mode || '';
    if (mode === 'tweaks') openComposer(null, window.innerWidth / 2 - 180, 64, 'tweak.request', 'Tweaks request');
  }

  function clearMode(){
    mode = null;
    hideOutline();
    document.querySelectorAll(`#${ROOT_ID} [data-mode]`).forEach(button => button.classList.remove('is-active'));
    document.documentElement.dataset.loopkitMode = '';
  }

  function onMove(e){
    if (mode !== 'markup' || isLK(e)) return;
    const target = targetAt(e.clientX, e.clientY);
    if (target) showOutline(target);
    else hideOutline();
  }

  function onDown(e){
    if (!mode || isLK(e)) return;
    stop(e);
    blockNext = true;
    const composer = $('.lk-composer');
    if (composer.classList.contains('is-visible') && dirty) {
      shake(composer);
      return;
    }
    const target = targetAt(e.clientX, e.clientY);
    if (mode === 'markup') {
      if (!target) {
        toast('Нет data-loop-id');
        return;
      }
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'e') {
      e.preventDefault();
      copyBundle();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'l') {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
    if (e.key === 'Escape') {
      clearMode();
      closeComposer();
      hidePreview();
      $('.lk-drawer').classList.remove('is-visible');
    }
  }

  function openComposer(target, x, y, type, title){
    const composer = $('.lk-composer');
    const textarea = composer.querySelector('textarea');
    composer.dataset.type = type;
    composer.querySelector('.lk-title').textContent = title || 'Feedback';
    composer.style.left = clamp(x, 14, window.innerWidth - 380) + 'px';
    composer.style.top = clamp(y, 54, window.innerHeight - 220) + 'px';
    textarea.value = '';
    dirty = false;
    composer.classList.add('is-visible');
    setTimeout(() => textarea.focus(), 0);
  }

  function closeComposer(){
    const composer = $('.lk-composer');
    if (!composer) return;
    composer.classList.remove('is-visible');
    composer.querySelector('textarea').value = '';
    dirty = false;
    targetEl = null;
    point = null;
  }

  function saveDraft(){
    const composer = $('.lk-composer');
    const textarea = composer.querySelector('textarea');
    const message = textarea.value.trim();
    if (!message) {
      shake(composer);
      return;
    }
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
    const root = document.getElementById(ROOT_ID);
    const old = root.style.display;
    root.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    root.style.display = old;
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
    const outline = $('.lk-outline');
    outline.style.display = 'block';
    outline.style.left = Math.round(rect.left) + 'px';
    outline.style.top = Math.round(rect.top) + 'px';
    outline.style.width = Math.round(rect.width) + 'px';
    outline.style.height = Math.round(rect.height) + 'px';
    outline.querySelector('span').textContent = titleOf(target);
  }

  function hideOutline(){
    const outline = $('.lk-outline');
    if (outline) outline.style.display = 'none';
  }

  function render(){
    renderPill();
    renderList();
    renderPins();
    if (previewEventId && !events.some(ev => ev.id === previewEventId)) hidePreview();
  }

  function renderPill(){
    const pill = $('.lk-pill');
    pill.textContent = 'Feedback ' + events.length;
    pill.classList.toggle('is-visible', events.length > 0);
  }

  function renderList(){
    const list = $('.lk-list');
    if (!list) return;
    if (!events.length) {
      list.innerHTML = '<div class="lk-item">Пока нет фидбэка.</div>';
      return;
    }
    list.innerHTML = '';
    events.forEach((ev, index) => {
      const item = document.createElement('div');
      item.className = 'lk-item';
      item.innerHTML = `<small>${index + 1}. ${esc(ev.type)} ${ev.target ? '· ' + esc(ev.target.id) : ''}</small><div class="lk-item-text">${esc(ev.message)}</div><button type="button" class="lk-delete" title="Удалить feedback">${ICONS.trash}<span>Delete</span></button>`;
      item.querySelector('.lk-delete').addEventListener('click', e => {
        stop(e);
        deleteEvent(ev.id);
      });
      list.appendChild(item);
    });
  }

  function renderPins(){
    const box = $('.lk-pins');
    if (!box) return;
    box.innerHTML = '';
    events.forEach((ev, index) => {
      const pos = pinPos(ev);
      if (!pos) return;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'lk-pin';
      pin.textContent = String(index + 1);
      pin.title = ev.message;
      pin.style.left = pos.x + 'px';
      pin.style.top = pos.y + 'px';
      pin.addEventListener('click', e => {
        stop(e);
        showPreview(ev, pin, index + 1);
      });
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
    const preview = $('.lk-preview');
    const rect = anchor.getBoundingClientRect();
    previewEventId = ev.id;
    preview.innerHTML = `<div class="lk-preview-head"><b>${number}. ${esc(ev.type)}</b><button type="button" data-preview-close>${ICONS.close}</button></div><div class="lk-preview-target">${esc(ev.target?.id || 'artifact')}</div><div class="lk-preview-text">${esc(ev.message)}</div><div class="lk-actions"><button type="button" data-preview-delete>${ICONS.trash}<span>Delete</span></button></div>`;
    preview.style.left = clamp(rect.left + 12, 14, window.innerWidth - 340) + 'px';
    preview.style.top = clamp(rect.top + 12, 54, window.innerHeight - 220) + 'px';
    preview.classList.add('is-visible');
    preview.querySelector('[data-preview-close]').addEventListener('click', e => { stop(e); hidePreview(); });
    preview.querySelector('[data-preview-delete]').addEventListener('click', e => { stop(e); deleteEvent(ev.id); });
  }

  function hidePreview(){
    const preview = $('.lk-preview');
    if (!preview) return;
    preview.classList.remove('is-visible');
    preview.innerHTML = '';
    previewEventId = null;
  }

  function deleteEvent(id){
    const before = events.length;
    events = events.filter(ev => ev.id !== id);
    if (events.length === before) return;
    persist();
    render();
    toast('Deleted');
  }

  function base(type, message){
    return { id: uid('fb'), type, artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, createdAt: new Date().toISOString(), message, url: location.href };
  }

  function info(target){
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { id: target.dataset.loopId, kind: target.dataset.loopKind || target.tagName.toLowerCase(), title: titleOf(target), selector: `[data-loop-id="${cssEsc(target.dataset.loopId)}"]`, text: compact(target.textContent, 700), rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } };
  }

  function exportBundle(){
    return { loopkit: 'feedback-bundle-v0', runtimeVersion: VERSION, artifact: { id: meta.artifactId, version: meta.artifactVersion, title: meta.title, description: meta.description || '', url: location.href }, decisions, rule: 'This feedback bundle is single-use and valid only for this artifact version. The next agent must respond to every item and must not carry this bundle forward automatically.', items: events.slice() };
  }

  function exportMarkdown(){
    const bundle = exportBundle();
    const lines = ['# LoopKit feedback bundle', '', `Artifact: ${bundle.artifact.title}`, `ID: ${bundle.artifact.id}`, `Version: ${bundle.artifact.version}`, ''];
    if (decisions) lines.push('## DECISIONS', decisions, '');
    lines.push('## Feedback items');
    if (!events.length) lines.push('No feedback items.');
    events.forEach((ev, index) => {
      lines.push(`${index + 1}. ${ev.type}`);
      if (ev.target) lines.push(`   Target: ${ev.target.id} — ${ev.target.title}`);
      if (ev.point) lines.push(`   Point: x=${ev.point.x}, y=${ev.point.y}`);
      lines.push(`   Message: ${ev.message}`, '');
    });
    lines.push('## Machine-readable JSON', '```json', JSON.stringify(bundle, null, 2), '```');
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
    persist();
    render();
    $('.lk-drawer').classList.remove('is-visible');
    hidePreview();
    toast('Cleared');
  }

  function readEvents(){
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
    catch { return []; }
  }
  function persist(){ localStorage.setItem(storageKey, JSON.stringify(events)); }

  function readMeta(){
    const fallback = { artifactId: document.title || 'artifact', artifactVersion: 'v1', title: document.title || 'Artifact', description: '' };
    const node = document.querySelector(META_SELECTOR);
    if (!node) return fallback;
    try {
      const raw = JSON.parse(node.textContent || '{}');
      return { artifactId: raw.artifactId || raw.artifact_id || fallback.artifactId, artifactVersion: raw.artifactVersion || raw.artifact_version || fallback.artifactVersion, title: raw.title || fallback.title, description: raw.description || '' };
    } catch { return fallback; }
  }

  function injectStyle(){
    const style = document.createElement('style');
    style.textContent = `
      #${ROOT_ID}{position:static!important;z-index:2147483647;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
      #${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} .lk-bar,#${ROOT_ID} .lk-composer,#${ROOT_ID} .lk-pill,#${ROOT_ID} .lk-drawer,#${ROOT_ID} .lk-pin,#${ROOT_ID} .lk-edge,#${ROOT_ID} .lk-preview{pointer-events:auto;z-index:2147483647}
      #${ROOT_ID} .lk-bar{position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:rgba(255,255,255,.94);border:1px solid rgba(24,24,27,.14);border-radius:16px;box-shadow:0 16px 45px rgba(0,0,0,.14);backdrop-filter:blur(14px)}#${ROOT_ID}.is-collapsed .lk-bar{display:none}
      #${ROOT_ID} .lk-edge{position:fixed;top:14px;right:14px;display:none;align-items:center;gap:6px;background:#fff;border:1px solid rgba(24,24,27,.14);box-shadow:0 12px 28px rgba(0,0,0,.12)}#${ROOT_ID}.is-collapsed .lk-edge{display:inline-flex}
      #${ROOT_ID} button{height:32px;border:0;border-radius:11px;background:transparent;color:#52525b;padding:0 10px;font:700 13px/1 inherit;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}#${ROOT_ID} button:hover{background:#f4f4f5;color:#18181b}#${ROOT_ID} button.is-active{background:#18181b;color:#fff}#${ROOT_ID} svg{width:15px;height:15px;flex:0 0 auto}#${ROOT_ID} .lk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
      #${ROOT_ID} .lk-outline{position:fixed;display:none;pointer-events:none;z-index:2147483646;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.12)}#${ROOT_ID} .lk-outline span{position:absolute;left:0;top:-26px;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:700 11px/1 inherit;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      #${ROOT_ID} .lk-composer,#${ROOT_ID} .lk-preview{position:fixed;display:none;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}#${ROOT_ID} .lk-composer.is-visible,#${ROOT_ID} .lk-preview.is-visible{display:block}#${ROOT_ID} .lk-title{font:800 12px/1.25 inherit;color:#18181b;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${ROOT_ID} textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px;font:14px/1.35 inherit;outline:none;color:#18181b;background:#fff}#${ROOT_ID} textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}#${ROOT_ID} .lk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}#${ROOT_ID} .lk-actions button{border:1px solid #e4e4e7;background:#fff;color:#18181b}#${ROOT_ID} .lk-actions button:last-child{background:#18181b;color:#fff;border-color:#18181b}
      #${ROOT_ID} .lk-pill{position:fixed;right:14px;bottom:14px;display:none;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;box-shadow:0 16px 36px rgba(0,0,0,.22)}#${ROOT_ID} .lk-pill.is-visible{display:inline-flex}#${ROOT_ID} .lk-drawer{position:fixed;right:14px;bottom:58px;width:min(400px,calc(100vw - 28px));max-height:min(560px,calc(100vh - 86px));overflow:auto;display:none;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}#${ROOT_ID} .lk-drawer.is-visible{display:block}#${ROOT_ID} .lk-drawer-head,#${ROOT_ID} .lk-preview-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}#${ROOT_ID} .lk-item{position:relative;border-top:1px solid #eee;padding:10px 86px 10px 0;font:13px/1.35 inherit}#${ROOT_ID} .lk-item small,#${ROOT_ID} .lk-preview-target{display:block;color:#71717a;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;font-size:11px}#${ROOT_ID} .lk-item-text,#${ROOT_ID} .lk-preview-text{white-space:pre-wrap;color:#18181b;font:13px/1.35 inherit}#${ROOT_ID} .lk-delete{position:absolute;right:0;top:10px;border:1px solid #e4e4e7;background:#fff;color:#b91c1c}
      #${ROOT_ID} .lk-pin{position:fixed;min-width:22px;height:22px;border-radius:999px;border:2px solid #fff;background:#18181b;color:#fff;font:800 11px/18px inherit;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25);transform:translate(-50%,-50%);display:inline-flex;justify-content:center}#${ROOT_ID} .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:16px;z-index:2147483647;transform:translateX(-50%) translateY(8px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;font:800 12px/1 inherit;box-shadow:0 14px 34px rgba(0,0,0,.22);transition:.16s ease}#${ROOT_ID} .lk-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}#${ROOT_ID} .lk-shake{animation:lkshake .22s ease-in-out 0s 2}@keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`;
    document.head.appendChild(style);
  }

  function $(selector){ return document.querySelector(`#${ROOT_ID} ${selector}`); }
  function isLK(e){ return e.target && e.target.closest && e.target.closest('#' + ROOT_ID); }
  function stop(e){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }
  function titleOf(target){ return target?.dataset.loopTitle || target?.getAttribute('aria-label') || compact(target?.textContent, 80) || target?.dataset.loopId || 'Feedback'; }
  function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`; }
  function compact(value, max){ return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }
  function esc(value){ return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function cssEsc(value){ return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function shake(el){ el.classList.remove('lk-shake'); void el.offsetWidth; el.classList.add('lk-shake'); }
  function toast(message){ const toastEl = $('.lk-toast'); toastEl.textContent = message; toastEl.classList.add('is-visible'); clearTimeout(toast._timer); toast._timer = setTimeout(() => toastEl.classList.remove('is-visible'), 1300); }
})();
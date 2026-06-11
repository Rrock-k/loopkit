(function () {
  'use strict';
  const VERSION = '0.1.4-portable';
  const rootId = 'loopkit-root';
  const meta = readMeta();
  const decisions = (document.querySelector('#loopkit-decisions')?.textContent || '').trim();
  const storeKey = `loopkit:feedback:${meta.artifactId}:${meta.artifactVersion}`;
  let events = readEvents();
  let mode = null;
  let draftOpen = false;
  let activeTarget = null;
  let activePoint = null;

  function start() {
    if (document.getElementById(rootId)) return;
    injectStyle();
    const root = document.createElement('div');
    root.id = rootId;
    root.setAttribute('data-loop-ignore', '');
    root.innerHTML = `
      <div class="lk-bar">
        <button data-lk-mode="markup" title="Кликни элемент и оставь фидбэк">Mark up</button>
        <button data-lk-mode="comments" title="Оставь свободный комментарий">Comments</button>
        <button data-lk-mode="tweaks" title="Опиши tweak request">Tweaks</button>
        <button data-lk-copy title="Скопировать feedback bundle">Copy bundle</button>
      </div>
      <div class="lk-outline"><span></span></div>
      <div class="lk-composer">
        <div class="lk-title"></div>
        <textarea placeholder="Напиши фидбэк..."></textarea>
        <div class="lk-actions"><button data-lk-cancel>Cancel</button><button data-lk-save>Save</button></div>
      </div>
      <button class="lk-pill"></button>
      <div class="lk-drawer"><div class="lk-drawer-head"><b>Feedback bundle</b><button data-lk-close>×</button></div><div class="lk-list"></div><div class="lk-actions"><button data-lk-clear>Clear</button><button data-lk-copy>Copy for AI</button></div></div>
      <div class="lk-pins"></div>
      <div class="lk-toast"></div>`;
    document.documentElement.appendChild(root);

    root.addEventListener('click', onRootClick);
    root.addEventListener('keydown', e => e.stopPropagation(), true);
    root.addEventListener('pointerdown', e => e.stopPropagation(), true);

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', renderPins, true);
    window.addEventListener('resize', renderPins);

    render();
    window.LoopKit = Object.assign(window.LoopKit || {}, { version: VERSION, meta, getEvents: () => events.slice(), exportBundle, exportMarkdown, copyBundle, clearEvents });
  }

  function readMeta() {
    const fallback = { artifactId: document.title || 'artifact', artifactVersion: 'v1', title: document.title || 'Artifact', description: '' };
    const node = document.querySelector('script[type="application/loopkit+json"],script[type="application/loopkit+meta"]');
    if (!node) return fallback;
    try {
      const raw = JSON.parse(node.textContent || '{}');
      return { artifactId: raw.artifactId || raw.artifact_id || fallback.artifactId, artifactVersion: raw.artifactVersion || raw.artifact_version || fallback.artifactVersion, title: raw.title || fallback.title, description: raw.description || '' };
    } catch { return fallback; }
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.id = 'loopkit-style';
    style.textContent = `
      #${rootId}{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
      #${rootId} *{box-sizing:border-box}
      #${rootId} .lk-bar{pointer-events:auto;position:fixed;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:4px;align-items:center;padding:5px;background:rgba(255,255,255,.94);border:1px solid rgba(24,24,27,.14);border-radius:16px;box-shadow:0 16px 45px rgba(0,0,0,.14);backdrop-filter:blur(14px)}
      #${rootId} button{height:32px;border:0;border-radius:11px;background:transparent;color:#52525b;padding:0 10px;font:700 13px/1 inherit;cursor:pointer}
      #${rootId} button:hover{background:#f4f4f5;color:#18181b}#${rootId} button.is-active{background:#18181b;color:#fff}
      #${rootId} .lk-outline{position:fixed;display:none;pointer-events:none;border:2px solid #2563eb;border-radius:10px;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
      #${rootId} .lk-outline span{position:absolute;left:0;top:-26px;background:#2563eb;color:#fff;border-radius:999px;padding:4px 8px;font:700 11px/1 inherit;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      #${rootId} .lk-composer{pointer-events:auto;position:fixed;display:none;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}
      #${rootId} .lk-composer.is-visible{display:block}#${rootId} .lk-title{font:800 12px/1.25 inherit;color:#18181b;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${rootId} textarea{width:100%;min-height:92px;resize:vertical;border:1px solid #e4e4e7;border-radius:13px;padding:10px;font:14px/1.35 inherit;outline:none;color:#18181b;background:#fff}
      #${rootId} textarea:focus{border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.08)}#${rootId} .lk-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #${rootId} .lk-actions button{border:1px solid #e4e4e7;background:#fff;color:#18181b}#${rootId} .lk-actions button:last-child{background:#18181b;color:#fff;border-color:#18181b}
      #${rootId} .lk-pill{pointer-events:auto;position:fixed;right:14px;bottom:14px;display:none;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;box-shadow:0 16px 36px rgba(0,0,0,.22)}
      #${rootId} .lk-pill.is-visible{display:block}#${rootId} .lk-drawer{pointer-events:auto;position:fixed;right:14px;bottom:58px;width:min(380px,calc(100vw - 28px));max-height:min(540px,calc(100vh - 86px));overflow:auto;display:none;background:#fff;border:1px solid rgba(24,24,27,.14);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);padding:12px}
      #${rootId} .lk-drawer.is-visible{display:block}#${rootId} .lk-drawer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}#${rootId} .lk-item{border-top:1px solid #eee;padding:10px 0;font:13px/1.35 inherit}#${rootId} .lk-item small{display:block;color:#71717a;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
      #${rootId} .lk-pin{pointer-events:auto;position:fixed;min-width:22px;height:22px;border-radius:999px;border:2px solid #fff;background:#18181b;color:#fff;font:800 11px/18px inherit;text-align:center;box-shadow:0 10px 24px rgba(0,0,0,.25);transform:translate(-50%,-50%)}
      #${rootId} .lk-toast{pointer-events:none;position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(8px);opacity:0;background:#18181b;color:#fff;border-radius:999px;padding:9px 12px;font:800 12px/1 inherit;box-shadow:0 14px 34px rgba(0,0,0,.22);transition:.16s ease}#${rootId} .lk-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}
      #${rootId} .lk-shake{animation:lkshake .22s ease-in-out 0s 2}@keyframes lkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`;
    document.head.appendChild(style);
  }

  function onRootClick(event) {
    const root = document.getElementById(rootId);
    const modeButton = event.target.closest('[data-lk-mode]');
    if (modeButton) return setMode(mode === modeButton.dataset.lkMode ? null : modeButton.dataset.lkMode);
    if (event.target.closest('[data-lk-copy]')) return copyBundle();
    if (event.target.closest('[data-lk-cancel]')) return closeComposer();
    if (event.target.closest('[data-lk-save]')) return saveDraft();
    if (event.target.closest('[data-lk-clear]')) return clearEvents();
    if (event.target.closest('[data-lk-close]')) return root.querySelector('.lk-drawer').classList.remove('is-visible');
    if (event.target.closest('.lk-pill')) { renderList(); return root.querySelector('.lk-drawer').classList.toggle('is-visible'); }
  }

  function setMode(next) {
    mode = next;
    closeComposer();
    hideOutline();
    document.querySelectorAll(`#${rootId} [data-lk-mode]`).forEach(b => b.classList.toggle('is-active', b.dataset.lkMode === mode));
    if (mode === 'tweaks') openComposer(null, window.innerWidth / 2 - 170, 70, 'tweak.request');
  }

  function onPointerMove(event) {
    if (mode !== 'markup' || isLoopKitEvent(event)) return;
    const target = targetAt(event.clientX, event.clientY);
    if (target) showOutline(target); else hideOutline();
  }

  function onPointerDown(event) {
    if (!mode || isLoopKitEvent(event)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const composer = document.querySelector(`#${rootId} .lk-composer`);
    if (composer.classList.contains('is-visible') && composer.querySelector('textarea').value.trim()) return shake(composer);
    if (mode === 'markup') {
      const target = targetAt(event.clientX, event.clientY);
      if (!target) return toast('Нет data-loop-id');
      openComposer(target, event.clientX + 12, event.clientY + 12, 'markup.comment');
    }
    if (mode === 'comments') {
      const target = targetAt(event.clientX, event.clientY) || document.querySelector('[data-loop-id]');
      const point = makePoint(target, event.clientX, event.clientY);
      openComposer(target, event.clientX + 12, event.clientY + 12, 'comment.pin', point);
    }
  }

  function onDocumentClick(event) {
    if (!mode || isLoopKitEvent(event)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); copyBundle(); }
    if (event.key === 'Escape') { setMode(null); document.querySelector(`#${rootId} .lk-drawer`).classList.remove('is-visible'); }
  }

  function isLoopKitEvent(event) { return event.target && event.target.closest && event.target.closest(`#${rootId}`); }

  function targetAt(x, y) {
    const root = document.getElementById(rootId);
    const prev = root.style.display;
    root.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    root.style.display = prev;
    const target = el && el.closest && el.closest('[data-loop-id]');
    if (!target || target.closest('[data-loop-ignore]')) return null;
    return target;
  }

  function targetInfo(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { id: el.dataset.loopId, kind: el.dataset.loopKind || el.tagName.toLowerCase(), title: el.dataset.loopTitle || el.getAttribute('aria-label') || compact(el.textContent, 80), selector: `[data-loop-id="${cssEscape(el.dataset.loopId)}"]`, text: compact(el.textContent, 700), rect: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } };
  }

  function makePoint(target, x, y) {
    const point = { x: Math.round(x), y: Math.round(y) };
    if (target) { const r = target.getBoundingClientRect(); point.relX = r.width ? (x - r.left) / r.width : 0; point.relY = r.height ? (y - r.top) / r.height : 0; }
    return point;
  }

  function openComposer(target, x, y, type, point) {
    activeTarget = target;
    const root = document.getElementById(rootId);
    const box = root.querySelector('.lk-composer');
    const title = root.querySelector('.lk-title');
    const textarea = root.querySelector('textarea');
    title.textContent = type === 'tweak.request' ? 'Tweaks request' : target ? `${target.dataset.loopTitle || target.dataset.loopId}` : 'Comment';
    textarea.value = '';
    box.dataset.type = type;
    box._point = point || null;
    box.style.left = clamp(x, 16, window.innerWidth - 380) + 'px';
    box.style.top = clamp(y, 58, window.innerHeight - 220) + 'px';
    box.classList.add('is-visible');
    setTimeout(() => textarea.focus(), 0);
  }

  function closeComposer() {
    const box = document.querySelector(`#${rootId} .lk-composer`);
    if (!box) return;
    box.classList.remove('is-visible');
    box.querySelector('textarea').value = '';
    activeTarget = null;
  }

  function saveDraft() {
    const root = document.getElementById(rootId);
    const box = root.querySelector('.lk-composer');
    const message = box.querySelector('textarea').value.trim();
    if (!message) return shake(box);
    const type = box.dataset.type || 'markup.comment';
    const ev = { id: uid('fb'), type, artifactId: meta.artifactId, artifactVersion: meta.artifactVersion, createdAt: new Date().toISOString(), message, url: location.href };
    if (type !== 'tweak.request') ev.target = targetInfo(activeTarget);
    if (type === 'comment.pin') ev.point = box._point;
    events.push(ev); saveEvents(); closeComposer(); render(); toast('Saved');
  }

  function readEvents() { try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); } catch { return []; } }
  function saveEvents() { localStorage.setItem(storeKey, JSON.stringify(events)); }
  function clearEvents() { events = []; saveEvents(); render(); toast('Cleared'); }

  function render() { renderPill(); renderList(); renderPins(); }
  function renderPill() { const p = document.querySelector(`#${rootId} .lk-pill`); p.textContent = `Feedback ${events.length}`; p.classList.toggle('is-visible', events.length > 0); }
  function renderList() { const list = document.querySelector(`#${rootId} .lk-list`); if (!list) return; list.innerHTML = events.length ? '' : '<div class="lk-item">Пока нет фидбэка.</div>'; events.forEach((ev, i) => { const div = document.createElement('div'); div.className = 'lk-item'; div.innerHTML = `<small>${i + 1}. ${escapeHtml(ev.type)} ${ev.target ? '· ' + escapeHtml(ev.target.id) : ''}</small>${escapeHtml(ev.message)}`; list.appendChild(div); }); }
  function renderPins() { const pins = document.querySelector(`#${rootId} .lk-pins`); if (!pins) return; pins.innerHTML = ''; events.forEach((ev, i) => { const pos = pinPosition(ev); if (!pos) return; const b = document.createElement('button'); b.className = 'lk-pin'; b.textContent = String(i + 1); b.title = ev.message; b.style.left = pos.x + 'px'; b.style.top = pos.y + 'px'; pins.appendChild(b); }); }
  function pinPosition(ev) { let target = null; if (ev.target?.id) target = document.querySelector(`[data-loop-id="${cssEscape(ev.target.id)}"]`); if (target && ev.point?.relX != null) { const r = target.getBoundingClientRect(); return { x: Math.round(r.left + r.width * ev.point.relX), y: Math.round(r.top + r.height * ev.point.relY) }; } if (ev.point) return { x: ev.point.x, y: ev.point.y }; if (target) { const r = target.getBoundingClientRect(); return { x: Math.round(r.right), y: Math.round(r.top) }; } return null; }

  function showOutline(el) { const r = el.getBoundingClientRect(); const o = document.querySelector(`#${rootId} .lk-outline`); o.style.display = 'block'; o.style.left = Math.round(r.left) + 'px'; o.style.top = Math.round(r.top) + 'px'; o.style.width = Math.round(r.width) + 'px'; o.style.height = Math.round(r.height) + 'px'; o.querySelector('span').textContent = el.dataset.loopTitle || el.dataset.loopId; }
  function hideOutline() { const o = document.querySelector(`#${rootId} .lk-outline`); if (o) o.style.display = 'none'; }
  function shake(el) { el.classList.remove('lk-shake'); void el.offsetWidth; el.classList.add('lk-shake'); }
  function toast(text) { const t = document.querySelector(`#${rootId} .lk-toast`); t.textContent = text; t.classList.add('is-visible'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('is-visible'), 1200); }

  function exportBundle() { return { loopkit: 'feedback-bundle-v0', runtimeVersion: VERSION, artifact: { id: meta.artifactId, version: meta.artifactVersion, title: meta.title, description: meta.description || '', url: location.href }, decisions, rule: 'This feedback bundle is single-use and valid only for this artifact version. The next agent must respond to every item and must not carry this bundle forward automatically.', items: events }; }
  function exportMarkdown() { const b = exportBundle(); const lines = ['# LoopKit feedback bundle', '', `Artifact: ${b.artifact.title}`, `ID: ${b.artifact.id}`, `Version: ${b.artifact.version}`, '']; if (decisions) lines.push('## DECISIONS', decisions, ''); lines.push('## Feedback items'); if (!events.length) lines.push('No feedback items.'); events.forEach((ev, i) => { lines.push(`${i + 1}. ${ev.type}`); if (ev.target) lines.push(`   Target: ${ev.target.id} — ${ev.target.title}`); if (ev.point) lines.push(`   Point: x=${ev.point.x}, y=${ev.point.y}`); lines.push(`   Message: ${ev.message}`, ''); }); lines.push('## Machine-readable JSON', '```json', JSON.stringify(b, null, 2), '```'); return lines.join('\n'); }
  async function copyBundle() { const txt = exportMarkdown(); try { await navigator.clipboard.writeText(txt); } catch { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } toast('Feedback bundle copied'); }

  function compact(v, n) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, n); }
  function cssEscape(v) { return window.CSS?.escape ? CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function escapeHtml(v) { return String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
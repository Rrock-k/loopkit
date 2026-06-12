(function(){
  'use strict';

  const STYLE_ID = 'loopkit-feedback-panel-style';
  let interval = 0;
  let pendingDeleteId = null;

  function install(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    if (!host || !shadow || !window.LoopKit) return false;

    const bar = shadow.querySelector('.bar');
    const pill = shadow.querySelector('.pill');
    const drawer = shadow.querySelector('.drawer');
    if (!bar || !pill || !drawer) return false;
    if (bar.querySelector('[data-toolbar-feedback]')) return true;

    const commentsButton = bar.querySelector('[data-mode="comments"]');
    if (commentsButton) {
      const label = commentsButton.querySelector('span:not(.sr)');
      if (label) label.textContent = '+ Comment';
      commentsButton.title = '+ Comment';
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pill,
      .drawer {
        display: none !important;
      }
      .bar {
        border-color: var(--overlay-border, rgba(56,189,248,.78)) !important;
      }
      .toolbar-feedback {
        height: 32px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--muted, #737373);
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
      }
      .toolbar-feedback:hover {
        background: var(--soft, rgba(23,23,23,.055));
        color: var(--text, #171717);
      }
      .toolbar-feedback.is-open {
        background: #111827;
        color: #fff;
      }
      .toolbar-feedback.has-items:not(.is-open) {
        background: rgba(56,189,248,.12);
        color: var(--text, #171717);
      }
      .toolbar-feedback svg {
        width: 15px;
        height: 15px;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .toolbar-feedback-count {
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #111827;
        color: #fff;
        font-size: 11px;
        line-height: 1;
        font-weight: 800;
      }
      .toolbar-feedback.is-open .toolbar-feedback-count {
        background: rgba(255,255,255,.18);
        color: #fff;
      }
      .toolbar-feedback:not(.has-items):not(.is-open) .toolbar-feedback-count {
        background: rgba(23,23,23,.10);
        color: var(--muted, #737373);
      }
      .toolbar-feedback-panel {
        position: fixed;
        top: 62px;
        left: 50%;
        width: min(430px, calc(100vw - 28px));
        max-height: min(560px, calc(100vh - 82px));
        border: 1px solid rgba(23,23,23,.13);
        border-radius: 20px;
        background: rgba(255,255,255,.96);
        color: #171717;
        backdrop-filter: blur(18px);
        box-shadow: 0 18px 60px rgba(0,0,0,.18);
        pointer-events: auto;
        overflow: hidden;
        opacity: 0;
        transform: translateX(-50%) translateY(-10px) scale(.985);
        visibility: hidden;
        transition: opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1), visibility .18s ease;
      }
      .toolbar-feedback-panel.is-open {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
        visibility: visible;
      }
      .tf-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 13px 14px;
        border-bottom: 1px solid rgba(23,23,23,.08);
      }
      .tf-title {
        font-size: 13px;
        font-weight: 800;
      }
      .tf-sub {
        margin-top: 2px;
        color: #737373;
        font-size: 11px;
      }
      .tf-close {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #737373;
        cursor: pointer;
      }
      .tf-close:hover {
        background: rgba(23,23,23,.055);
        color: #171717;
      }
      .tf-list {
        max-height: min(410px, calc(100vh - 190px));
        overflow: auto;
        padding: 10px;
        display: grid;
        gap: 8px;
      }
      .tf-empty,
      .tf-item {
        border: 1px solid rgba(23,23,23,.10);
        border-radius: 14px;
        background: rgba(23,23,23,.025);
        padding: 10px;
      }
      .tf-empty {
        color: #737373;
        font-size: 12px;
        text-align: center;
        padding: 18px;
      }
      .tf-item {
        position: relative;
        padding-right: 42px;
      }
      .tf-meta {
        display: block;
        margin-bottom: 5px;
        color: #737373;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .tf-text {
        white-space: pre-wrap;
        font-size: 12px;
        line-height: 1.35;
      }
      .tf-delete-zone {
        position: absolute;
        right: 7px;
        top: 7px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .tf-icon {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #737373;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .tf-icon:hover {
        background: rgba(23,23,23,.055);
        color: #dc2626;
      }
      .tf-icon svg {
        width: 15px;
        height: 15px;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tf-confirm {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 4px 3px 8px;
        border: 1px solid rgba(220,38,38,.16);
        border-radius: 999px;
        background: #fff;
        box-shadow: 0 8px 22px rgba(0,0,0,.08);
      }
      .tf-confirm span {
        color: #dc2626;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }
      .tf-confirm button {
        height: 24px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #737373;
        padding: 0 7px;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .tf-confirm .yes {
        background: #dc2626;
        color: #fff;
      }
      .tf-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 14px 14px;
        border-top: 1px solid rgba(23,23,23,.08);
      }
      .tf-action {
        height: 32px;
        border: 1px solid rgba(23,23,23,.14);
        border-radius: 999px;
        background: #fff;
        color: #171717;
        padding: 0 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
      }
      .tf-action.primary {
        background: #111827;
        border-color: #111827;
        color: #fff;
      }
      @media (max-width: 760px) {
        .bar {
          max-width: calc(100vw - 12px);
          gap: 2px !important;
        }
        .bar [data-mode="markup"] span,
        .bar [data-mode="comments"] span {
          display: inline !important;
        }
        .bar [data-mode="tweaks"] span,
        .toolbar-feedback-label {
          display: none !important;
        }
        .toolbar-feedback {
          width: 32px;
          padding: 0 !important;
          justify-content: center;
          position: relative;
        }
        .toolbar-feedback-count {
          position: absolute;
          right: -2px;
          top: -4px;
          min-width: 15px;
          height: 15px;
          padding: 0 4px;
          font-size: 10px;
        }
        .toolbar-feedback-panel {
          top: 58px;
          width: calc(100vw - 16px);
        }
      }
    `;
    if (!shadow.getElementById(STYLE_ID)) shadow.appendChild(style);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-feedback';
    button.setAttribute('data-toolbar-feedback', 'true');
    button.title = 'Open feedback list';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span class="toolbar-feedback-label">Feedback</span><span class="toolbar-feedback-count">0</span>';

    const panel = document.createElement('div');
    panel.className = 'toolbar-feedback-panel';
    panel.setAttribute('data-toolbar-feedback-panel', 'true');
    panel.innerHTML = '<div class="tf-head"><div><div class="tf-title">Feedback</div><div class="tf-sub">Одноразовый bundle для этой версии</div></div><button class="tf-close" type="button">×</button></div><div class="tf-list"></div><div class="tf-actions"><button class="tf-action" type="button" data-tf-clear>Clear</button><button class="tf-action primary" type="button" data-tf-copy>Copy for AI</button></div>';

    const copy = bar.querySelector('[data-copy]');
    bar.insertBefore(button, copy || null);
    shadow.querySelector('.lk-ui').appendChild(panel);

    function closePanel(){
      button.classList.remove('is-open');
      panel.classList.remove('is-open');
      pendingDeleteId = null;
      update();
    }

    function openPanel(){
      deactivateModes(shadow);
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
    clearInterval(interval);
    interval = setInterval(update, 400);

    return true;
  }

  function deactivateModes(shadow){
    const activeMode = shadow.querySelector('[data-mode].is-active');
    if (activeMode) activeMode.click();
  }

  if (!install()) {
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (install() || tries > 80) clearInterval(poll);
    }, 100);
  }
})();

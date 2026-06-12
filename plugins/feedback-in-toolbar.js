(function(){
  'use strict';

  const STYLE_ID = 'loopkit-feedback-in-toolbar-style';
  let interval = 0;

  function install(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    if (!host || !shadow || !window.LoopKit) return false;

    const bar = shadow.querySelector('.bar');
    const pill = shadow.querySelector('.pill');
    const drawer = shadow.querySelector('.drawer');
    if (!bar || !pill || !drawer) return false;
    if (bar.querySelector('[data-toolbar-feedback]')) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pill { display: none !important; }
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
      .toolbar-feedback.has-items {
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
      .toolbar-feedback:not(.has-items) .toolbar-feedback-count {
        background: rgba(23,23,23,.10);
        color: var(--muted, #737373);
      }
    `;
    if (!shadow.getElementById(STYLE_ID)) shadow.appendChild(style);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-feedback';
    button.setAttribute('data-toolbar-feedback', 'true');
    button.title = 'Open feedback list';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span>Feedback</span><span class="toolbar-feedback-count">0</span>';

    const copy = bar.querySelector('[data-copy]');
    bar.insertBefore(button, copy || null);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      drawer.classList.toggle('is-visible');
      update();
    });

    function update(){
      const count = window.LoopKit && window.LoopKit.getEvents ? window.LoopKit.getEvents().length : 0;
      button.classList.toggle('has-items', count > 0);
      button.querySelector('.toolbar-feedback-count').textContent = String(count);
      button.title = count ? `Open feedback list (${count})` : 'Open feedback list';
    }

    update();
    clearInterval(interval);
    interval = setInterval(update, 400);

    return true;
  }

  if (!install()) {
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (install() || tries > 80) clearInterval(poll);
    }, 100);
  }
})();

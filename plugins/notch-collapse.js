(function(){
  'use strict';

  const STYLE_ID = 'loopkit-notch-collapse-style';
  const READY_CLASS = 'is-edge-ready';
  let timer = null;
  let ready = false;

  function install(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    if (!host || !shadow) return false;

    const edge = shadow.querySelector('.edge,[data-expand]');
    const bar = shadow.querySelector('.bar');
    if (!edge || !bar) return false;
    if (edge.dataset.notchCollapseInstalled === 'true') return true;
    edge.dataset.notchCollapseInstalled = 'true';

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .lk-ui { --overlay-border: rgba(56, 189, 248, .78); }
      .bar { border-color: var(--overlay-border) !important; }
      .edge {
        position: fixed !important;
        top: 0 !important;
        left: 50% !important;
        right: auto !important;
        transform: translateX(-50%) translateY(-8px) !important;
        width: 132px !important;
        height: 14px !important;
        padding: 0 11px !important;
        justify-content: center !important;
        gap: 8px !important;
        border: 1px solid var(--overlay-border) !important;
        border-top: 0 !important;
        border-radius: 0 0 18px 18px !important;
        background: rgba(17,24,39,.82) !important;
        color: #fff !important;
        box-shadow: 0 8px 22px rgba(0,0,0,.16) !important;
        opacity: .82 !important;
        overflow: hidden !important;
        cursor: default !important;
        transition: width .22s ease, height .22s ease, transform .22s ease, background .22s ease, color .22s ease, opacity .22s ease !important;
      }
      :host(.${READY_CLASS}) .edge {
        width: 198px !important;
        height: 30px !important;
        transform: translateX(-50%) translateY(0) !important;
        background: rgba(255,255,255,.93) !important;
        color: #171717 !important;
        cursor: pointer !important;
        opacity: 1 !important;
      }
      .edge-dot {
        width: 34px;
        height: 4px;
        border-radius: 999px;
        background: currentColor;
        opacity: .78;
        flex: 0 0 auto;
      }
      :host(.${READY_CLASS}) .edge-dot { display: none; }
      .edge-label, .edge-shortcut {
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity .15s ease, transform .15s ease;
        white-space: nowrap;
        pointer-events: none;
      }
      .edge-label { font-size: 12px; font-weight: 800; }
      .edge-shortcut { font-size: 11px; color: #737373; }
      :host(.${READY_CLASS}) .edge-label,
      :host(.${READY_CLASS}) .edge-shortcut { opacity: 1; transform: translateY(0); }
    `;
    if (!shadow.getElementById(STYLE_ID)) shadow.appendChild(style);

    edge.innerHTML = '<span class="edge-dot"></span><span class="edge-label">LoopKit</span><span class="edge-shortcut">Ctrl/⌘⇧L</span>';
    edge.title = 'Hover to reveal · Ctrl/⌘+Shift+L';

    function setReady(next){
      ready = !!next;
      host.classList.toggle(READY_CLASS, ready);
    }
    function arm(){
      clearTimeout(timer);
      timer = setTimeout(() => setReady(true), 1200);
    }
    function disarm(){
      clearTimeout(timer);
      setReady(false);
    }

    edge.addEventListener('pointerenter', arm);
    edge.addEventListener('pointerleave', disarm);
    edge.addEventListener('focus', arm);
    edge.addEventListener('blur', disarm);
    edge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!ready) {
        arm();
        return;
      }
      window.LoopKit && window.LoopKit.expand && window.LoopKit.expand();
    }, true);

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

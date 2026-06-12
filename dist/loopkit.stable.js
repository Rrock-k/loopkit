(function(){
  'use strict';

  const VERSION = '0.3.3-stable-loader';
  const STYLE_ID = 'loopkit-stable-drag-override';

  const current = document.currentScript;
  const baseUrl = current && current.src ? new URL(current.src, location.href) : null;
  const runtimeUrl = baseUrl ? new URL('loopkit.js', baseUrl).href : 'https://cdn.jsdelivr.net/gh/Rrock-k/loopkit@main/dist/loopkit.js';

  function loadRuntime(){
    if (window.LoopKit && window.LoopKit.__installed) {
      installOverride();
      return;
    }
    const script = document.createElement('script');
    script.src = runtimeUrl;
    script.dataset.loopkitStableRuntime = VERSION;
    script.onload = installOverride;
    script.onerror = function(){ console.error('[LoopKit] failed to load runtime', runtimeUrl); };
    document.head.appendChild(script);
    waitForRuntime();
  }

  function waitForRuntime(){
    let tries = 0;
    const poll = setInterval(function(){
      tries += 1;
      if (installOverride() || tries > 100) clearInterval(poll);
    }, 50);
  }

  function installOverride(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    if (!host || !shadow) return false;
    if (shadow.getElementById(STYLE_ID)) return true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :host(.is-collapsed) .edge.is-dragging,
      :host([data-lk-edge-position]) .edge.is-dragging {
        left: var(--lk-edge-drag-x) !important;
        top: var(--lk-edge-drag-y) !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        cursor: grabbing !important;
        opacity: 1 !important;
        transition: none !important;
        z-index: 4 !important;
        will-change: left, top, transform;
      }

      :host(.is-collapsed) .edge.is-snapping,
      :host([data-lk-edge-position]) .edge.is-snapping {
        left: var(--lk-edge-snap-x) !important;
        top: var(--lk-edge-snap-y) !important;
        right: auto !important;
        bottom: auto !important;
        transform: translate(-50%, -50%) !important;
        opacity: 1 !important;
        z-index: 4 !important;
        transition: left .22s cubic-bezier(.2,.8,.2,1), top .22s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease !important;
      }

      .edge-target-zone {
        z-index: 3 !important;
      }
    `;
    shadow.appendChild(style);

    window.LoopKit = Object.assign(window.LoopKit || {}, {
      stableLoaderVersion: VERSION
    });
    console.info('[LoopKit] stable drag override installed', VERSION);
    return true;
  }

  loadRuntime();
})();

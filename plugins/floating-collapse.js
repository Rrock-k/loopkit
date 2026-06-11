(function(){
  'use strict';

  const STYLE_ID = 'loopkit-floating-collapse-style';
  const STORAGE_KEY_PREFIX = 'loopkit:floating-collapse-position:';
  const POSITIONS = [
    'top-left', 'top-center', 'top-right',
    'right-center',
    'bottom-right', 'bottom-center', 'bottom-left',
    'left-center'
  ];

  let drag = null;
  let suppressClick = false;

  function install(){
    const host = document.getElementById('loopkit-root');
    const shadow = host && host.shadowRoot;
    if (!host || !shadow || !window.LoopKit) return false;

    const edge = shadow.querySelector('.edge,[data-expand]');
    const bar = shadow.querySelector('.bar');
    if (!edge || !bar) return false;
    if (edge.dataset.floatingCollapseInstalled === 'true') return true;
    edge.dataset.floatingCollapseInstalled = 'true';

    const artifactId = window.LoopKit.meta && window.LoopKit.meta.artifactId || 'artifact';
    const storageKey = STORAGE_KEY_PREFIX + artifactId;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .lk-ui { --overlay-border: rgba(56, 189, 248, .78); }
      .bar { border-color: var(--overlay-border) !important; }
      .edge {
        position: fixed !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        bottom: auto !important;
        transform: none !important;
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
        transition: opacity .16s ease, transform .16s ease, box-shadow .16s ease !important;
      }
      :host(.is-collapsed) .edge { display: inline-flex !important; }
      .edge:hover, .edge:focus-visible {
        opacity: 1 !important;
        box-shadow: 0 14px 34px rgba(0,0,0,.18) !important;
      }
      .edge.is-dragging {
        cursor: grabbing !important;
        opacity: 1 !important;
        transition: none !important;
      }
      .edge-grip {
        width: 20px;
        height: 4px;
        border-radius: 999px;
        background: currentColor;
        opacity: .42;
        flex: 0 0 auto;
      }
      .edge-label {
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }
      .edge-shortcut {
        position: absolute;
        left: 50%;
        bottom: calc(100% + 8px);
        transform: translateX(-50%) translateY(3px);
        opacity: 0;
        pointer-events: none;
        white-space: nowrap;
        padding: 6px 9px;
        border-radius: 999px;
        border: 1px solid rgba(23,23,23,.13);
        background: rgba(255,255,255,.96);
        color: #171717;
        font-size: 11px;
        font-weight: 800;
        box-shadow: 0 10px 26px rgba(0,0,0,.14);
        transition: opacity .14s ease, transform .14s ease;
      }
      .edge:hover .edge-shortcut,
      .edge:focus-visible .edge-shortcut {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      :host([data-lk-edge-position="top-left"]) .edge { left: 14px !important; top: 14px !important; }
      :host([data-lk-edge-position="top-center"]) .edge { left: 50% !important; top: 14px !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="top-right"]) .edge { right: 14px !important; top: 14px !important; }
      :host([data-lk-edge-position="right-center"]) .edge { right: 14px !important; top: 50% !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position="bottom-right"]) .edge { right: 14px !important; bottom: 14px !important; }
      :host([data-lk-edge-position="bottom-center"]) .edge { left: 50% !important; bottom: 14px !important; transform: translateX(-50%) !important; }
      :host([data-lk-edge-position="bottom-left"]) .edge { left: 14px !important; bottom: 14px !important; }
      :host([data-lk-edge-position="left-center"]) .edge { left: 14px !important; top: 50% !important; transform: translateY(-50%) !important; }
      :host([data-lk-edge-position^="top-"]) .edge-shortcut {
        bottom: auto;
        top: calc(100% + 8px);
      }
    `;
    if (!shadow.getElementById(STYLE_ID)) shadow.appendChild(style);

    edge.innerHTML = '<span class="edge-grip"></span><span class="edge-label">LoopKit</span><span class="edge-shortcut">Ctrl/⌘⇧L</span>';
    edge.title = 'Drag to an edge position · Ctrl/⌘+Shift+L';

    function setPosition(position){
      const safe = POSITIONS.includes(position) ? position : 'top-right';
      host.setAttribute('data-lk-edge-position', safe);
      localStorage.setItem(storageKey, safe);
    }

    setPosition(localStorage.getItem(storageKey) || 'top-right');

    edge.addEventListener('pointerdown', (event) => {
      if (!host.classList.contains('is-collapsed')) return;
      drag = {
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
      suppressClick = false;
      edge.setPointerCapture && edge.setPointerCapture(event.pointerId);
    }, true);

    edge.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      suppressClick = true;
      edge.classList.add('is-dragging');
      edge.style.left = event.clientX + 'px';
      edge.style.top = event.clientY + 'px';
      edge.style.right = 'auto';
      edge.style.bottom = 'auto';
      edge.style.transform = 'translate(-50%, -50%)';
      event.preventDefault();
      event.stopPropagation();
    }, true);

    edge.addEventListener('pointerup', (event) => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      edge.classList.remove('is-dragging');
      edge.removeAttribute('style');
      if (moved) {
        setPosition(nearestPosition(event.clientX, event.clientY));
        event.preventDefault();
        event.stopPropagation();
        setTimeout(() => { suppressClick = false; }, 0);
      }
    }, true);

    edge.addEventListener('click', (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);

    return true;
  }

  function nearestPosition(x, y){
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const top = y < h * 0.25;
    const bottom = y > h * 0.75;

    if (top) {
      if (x < w * 0.33) return 'top-left';
      if (x > w * 0.67) return 'top-right';
      return 'top-center';
    }
    if (bottom) {
      if (x < w * 0.33) return 'bottom-left';
      if (x > w * 0.67) return 'bottom-right';
      return 'bottom-center';
    }
    return x < w / 2 ? 'left-center' : 'right-center';
  }

  if (!install()) {
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (install() || tries > 80) clearInterval(poll);
    }, 100);
  }
})();

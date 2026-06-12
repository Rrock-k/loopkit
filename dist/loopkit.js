(function(){
  'use strict';

  const VERSION = '0.4.1-loader';
  const CHUNKS = [
    'chunks/loopkit.0.4.0.0.txt',
    'chunks/loopkit.0.4.0.1.txt',
    'chunks/loopkit.0.4.0.2.txt',
    'chunks/loopkit.0.4.0.3.txt',
    'chunks/loopkit.0.4.0.4.txt',
    'chunks/loopkit.0.4.0.5.txt'
  ];

  const current = document.currentScript;
  const base = current && current.src ? new URL('.', current.src) : new URL('./', location.href);

  if (window.LoopKit && window.LoopKit.__installed) return;

  function decodeBase64Utf8(value) {
    const binary = atob(value.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function load() {
    const parts = await Promise.all(CHUNKS.map(async (path) => {
      const url = new URL(path, base).href;
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Failed to load ' + url + ': ' + response.status);
      return response.text();
    }));

    const script = document.createElement('script');
    script.dataset.loopkitRuntime = VERSION;
    script.textContent = decodeBase64Utf8(parts.join(''));
    document.head.appendChild(script);
    installVelocitySnap();
  }

  load().catch((error) => {
    console.error('[LoopKit] failed to load runtime chunks', error);
  });

  // LOOPKIT_STANDALONE_PATCH_START
  function installVelocitySnap() {
    let tries = 0;
    const timer = setInterval(() => {
      const host = document.getElementById('loopkit-root');
      const root = host && host.shadowRoot;
      const edge = root && root.querySelector('.edge');
      const zone = root && root.querySelector('.zone');
      const api = window.LoopKit;

      if (!host || !root || !edge || !zone || !api) {
        tries += 1;
        if (tries > 80) clearInterval(timer);
        return;
      }

      clearInterval(timer);
      patchVelocityEdge(host, root, edge, zone, api);
    }, 50);
  }

  function patchVelocityEdge(host, root, edge, zone, api) {
    if (edge.dataset.velocitySnap === '1') return;
    edge.dataset.velocitySnap = '1';

    let drag = null;

    root.addEventListener('pointerdown', (event) => {
      if (!event.composedPath().includes(edge)) return;
      if (!host.classList.contains('collapsed')) return;

      const rect = edge.getBoundingClientRect();
      const time = performance.now();
      drag = {
        sx: event.clientX,
        sy: event.clientY,
        px: event.clientX,
        py: event.clientY,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        ox: event.clientX - (rect.left + rect.width / 2),
        oy: event.clientY - (rect.top + rect.height / 2),
        vx: 0,
        vy: 0,
        time,
        pos: nearestPosition(event.clientX, event.clientY),
        moved: false
      };
      edge.setPointerCapture && edge.setPointerCapture(event.pointerId);
      stopVelocityEvent(event);
    }, true);

    root.addEventListener('pointermove', (event) => {
      if (!drag || !event.composedPath().includes(edge)) return;

      const now = performance.now();
      const dt = Math.max(8, now - drag.time);
      const vx = (event.clientX - drag.px) / dt;
      const vy = (event.clientY - drag.py) / dt;
      drag.vx = drag.vx * 0.55 + vx * 0.45;
      drag.vy = drag.vy * 0.55 + vy * 0.45;
      drag.px = event.clientX;
      drag.py = event.clientY;
      drag.time = now;

      if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 5) {
        stopVelocityEvent(event);
        return;
      }

      drag.moved = true;
      edge.dataset.suppress = '1';
      edge.classList.add('drag');

      const x = event.clientX - drag.ox;
      const y = event.clientY - drag.oy;
      edge.style.setProperty('--dx', x + 'px');
      edge.style.setProperty('--dy', y + 'px');
      drag.cx = x;
      drag.cy = y;

      const projected = projectedPoint(drag, event.clientX, event.clientY);
      drag.pos = nearestPosition(projected.x, projected.y);
      showZone(zone, edge, drag.pos);
      stopVelocityEvent(event);
    }, true);

    root.addEventListener('pointerup', (event) => {
      if (!drag || !event.composedPath().includes(edge)) return;

      const moved = drag.moved;
      const projected = projectedPoint(drag, event.clientX, event.clientY);
      const pos = nearestPosition(projected.x, projected.y);
      const fromX = drag.cx;
      const fromY = drag.cy;
      drag = null;
      edge.classList.remove('drag');

      if (moved) {
        snapEdge(host, zone, edge, api, pos, fromX, fromY);
        setTimeout(() => { delete edge.dataset.suppress; }, 120);
      } else if (api.expand) {
        api.expand();
      }
      stopVelocityEvent(event);
    }, true);

    root.addEventListener('click', (event) => {
      if (!event.composedPath().includes(edge)) return;
      if (edge.dataset.suppress === '1') {
        delete edge.dataset.suppress;
        stopVelocityEvent(event);
      }
    }, true);
  }

  function projectedPoint(drag, x, y) {
    const projectionMs = 220;
    const maxProjection = 380;
    const dx = clampVelocity(drag.vx * projectionMs, -maxProjection, maxProjection);
    const dy = clampVelocity(drag.vy * projectionMs, -maxProjection, maxProjection);
    return {
      x: clampVelocity(x + dx, 0, window.innerWidth || 1),
      y: clampVelocity(y + dy, 0, window.innerHeight || 1)
    };
  }

  function snapEdge(host, zone, edge, api, pos, fromX, fromY) {
    const point = positionPoint(edge, pos);
    edge.style.setProperty('--sx', fromX + 'px');
    edge.style.setProperty('--sy', fromY + 'px');
    edge.classList.add('snap');
    showZone(zone, edge, pos);

    requestAnimationFrame(() => {
      edge.style.setProperty('--sx', point.x + 'px');
      edge.style.setProperty('--sy', point.y + 'px');
    });

    setTimeout(() => {
      host.dataset.pos = pos;
      if (api.meta && api.meta.artifactId) {
        localStorage.setItem('loopkit:pos:' + api.meta.artifactId, pos);
      }
      edge.classList.remove('snap');
      edge.style.removeProperty('--sx');
      edge.style.removeProperty('--sy');
      hideZone(zone);
    }, 240);
  }

  function showZone(zone, edge, pos) {
    const point = positionPoint(edge, pos);
    zone.dataset.pos = pos;
    zone.style.left = point.x + 'px';
    zone.style.top = point.y + 'px';
    zone.classList.add('show');
  }

  function hideZone(zone) {
    zone.classList.remove('show');
  }

  function positionPoint(edge, pos) {
    const rect = edge.getBoundingClientRect();
    const width = rect.width || 98;
    const height = rect.height || 32;
    const pad = 14;
    const viewportWidth = window.innerWidth || 1;
    const viewportHeight = window.innerHeight || 1;
    const top = -14;
    const map = {
      'top-notch': { x: viewportWidth / 2, y: top + 15 },
      'top-left': { x: pad + width / 2, y: pad + height / 2 },
      'top-mid-left': { x: viewportWidth * 0.25, y: pad + height / 2 },
      'top-center': { x: viewportWidth / 2, y: pad + height / 2 },
      'top-mid-right': { x: viewportWidth * 0.75, y: pad + height / 2 },
      'top-right': { x: viewportWidth - pad - width / 2, y: pad + height / 2 },
      'right-top': { x: viewportWidth - pad - width / 2, y: viewportHeight * 0.25 },
      'right-center': { x: viewportWidth - pad - width / 2, y: viewportHeight / 2 },
      'right-bottom': { x: viewportWidth - pad - width / 2, y: viewportHeight * 0.75 },
      'bottom-right': { x: viewportWidth - pad - width / 2, y: viewportHeight - pad - height / 2 },
      'bottom-mid-right': { x: viewportWidth * 0.75, y: viewportHeight - pad - height / 2 },
      'bottom-center': { x: viewportWidth / 2, y: viewportHeight - pad - height / 2 },
      'bottom-mid-left': { x: viewportWidth * 0.25, y: viewportHeight - pad - height / 2 },
      'bottom-left': { x: pad + width / 2, y: viewportHeight - pad - height / 2 },
      'left-bottom': { x: pad + width / 2, y: viewportHeight * 0.75 },
      'left-center': { x: pad + width / 2, y: viewportHeight / 2 },
      'left-top': { x: pad + width / 2, y: viewportHeight * 0.25 }
    };
    return map[pos] || map['top-right'];
  }

  function nearestPosition(x, y) {
    const viewportWidth = window.innerWidth || 1;
    const viewportHeight = window.innerHeight || 1;

    if (y <= 34 && x > viewportWidth * 0.18 && x < viewportWidth * 0.82) return 'top-notch';

    const nearest = [
      ['top', y],
      ['right', viewportWidth - x],
      ['bottom', viewportHeight - y],
      ['left', x]
    ].sort((a, b) => a[1] - b[1])[0][0];

    if (nearest === 'top') return horizontalBucket('top', x, viewportWidth);
    if (nearest === 'bottom') return horizontalBucket('bottom', x, viewportWidth);
    return verticalBucket(nearest, y, viewportHeight);
  }

  function horizontalBucket(edge, x, viewportWidth) {
    const ratio = x / (viewportWidth || 1);
    if (edge === 'top') {
      if (ratio < 0.16) return 'top-left';
      if (ratio < 0.38) return 'top-mid-left';
      if (ratio < 0.62) return 'top-center';
      if (ratio < 0.84) return 'top-mid-right';
      return 'top-right';
    }
    if (ratio < 0.16) return 'bottom-left';
    if (ratio < 0.38) return 'bottom-mid-left';
    if (ratio < 0.62) return 'bottom-center';
    if (ratio < 0.84) return 'bottom-mid-right';
    return 'bottom-right';
  }

  function verticalBucket(edge, y, viewportHeight) {
    const ratio = y / (viewportHeight || 1);
    if (edge === 'right') {
      if (ratio < 0.34) return 'right-top';
      if (ratio < 0.66) return 'right-center';
      return 'right-bottom';
    }
    if (ratio < 0.34) return 'left-top';
    if (ratio < 0.66) return 'left-center';
    return 'left-bottom';
  }

  function clampVelocity(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function stopVelocityEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }
  // LOOPKIT_STANDALONE_PATCH_END
})();

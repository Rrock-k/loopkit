(function(){
  'use strict';

  const VERSION = '0.1.0-ui-state';
  if (window.LoopKitUiState && window.LoopKitUiState.__installed) return;

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  ready(() => waitForLoopKit(install));

  function waitForLoopKit(fn, tries = 80) {
    if (window.LoopKit && window.LoopKit.__installed) return fn();
    if (tries <= 0) return;
    setTimeout(() => waitForLoopKit(fn, tries - 1), 50);
  }

  function install() {
    const api = window.LoopKit;
    if (!api || api.__uiStatePatched) return;

    const originalExportBundle = api.exportBundle?.bind(api);
    const originalCopyBundle = api.copyBundle?.bind(api);

    api.getUiState = getUiState;
    api.ensureUiStateEvent = ensureUiStateEvent;

    if (originalExportBundle) {
      api.exportBundle = function exportBundleWithUiState() {
        ensureUiStateEvent();
        return originalExportBundle();
      };
    }

    if (originalCopyBundle) {
      api.copyBundle = async function copyBundleWithUiState() {
        ensureUiStateEvent();
        return originalCopyBundle();
      };
    }

    patchShadowCopyButtons();

    window.LoopKitUiState = {
      __installed: true,
      version: VERSION,
      get: getUiState,
      ensureEvent: ensureUiStateEvent
    };

    api.__uiStatePatched = true;
  }

  function patchShadowCopyButtons() {
    const root = document.getElementById('loopkit-root')?.shadowRoot;
    if (!root) return;
    root.querySelectorAll('[data-copy]').forEach((button) => {
      if (button.dataset.loopUiStatePatched === '1') return;
      button.dataset.loopUiStatePatched = '1';
      button.addEventListener('click', () => ensureUiStateEvent(), true);
    });
  }

  function ensureUiStateEvent() {
    const api = window.LoopKit;
    if (!api || !api.getEvents || !api.saveEvent) return null;

    const current = api.getEvents().filter((event) => event.type === 'ui.state' && event.source === 'loopkit-runtime');
    current.forEach((event) => {
      try { api.deleteEvent?.(event.id); } catch {}
    });

    const event = {
      type: 'ui.state',
      message: 'LoopKit UI state',
      source: 'loopkit-runtime',
      ui: getUiState()
    };

    api.saveEvent(event);
    return event;
  }

  function getUiState() {
    const api = window.LoopKit || {};
    const meta = api.meta || {};
    const artifactId = meta.artifactId || meta.artifact_id || document.title || 'artifact';
    const artifactVersion = meta.artifactVersion || meta.artifact_version || 'v1';
    const ui = read(`loopkit:ui:${artifactId}:${artifactVersion}`, {});
    const position = read(`loopkit:pos:${artifactId}`, 'top-right');

    return {
      schema: 'loopkit.ui_state.v0',
      capturedAt: new Date().toISOString(),
      artifactId,
      artifactVersion,
      loopkit: {
        collapsed: !!ui.collapsed,
        position
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
    catch { return fallback; }
  }
})();

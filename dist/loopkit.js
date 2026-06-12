(function(){
  'use strict';

  const VERSION = '0.4.7-dist-loader';
  const current = document.currentScript;
  const base = current && current.src ? new URL('.', current.src) : new URL('./', location.href);
  const runtimeUrl = new URL('../src/loopkit.js', base).href;

  if (window.LoopKit && window.LoopKit.__installed) return;

  const el = document.createElement('script');
  el.src = runtimeUrl;
  el.dataset.loopkitRuntime = VERSION;
  document.head.appendChild(el);
})();

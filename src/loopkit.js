(function(){
  'use strict';

  const VERSION = '0.3.6-loader';
  const current = document.currentScript;
  const runtimeUrl = current && current.src
    ? new URL('loopkit.0.3.6.js', new URL('.', current.src)).href
    : 'https://cdn.jsdelivr.net/gh/Rrock-k/loopkit@main/dist/loopkit.0.3.6.js';

  if (window.LoopKit && window.LoopKit.__installed) return;

  const script = document.createElement('script');
  script.src = runtimeUrl;
  script.dataset.loopkitRuntime = VERSION;
  script.onerror = function(){
    console.error('[LoopKit] failed to load runtime', runtimeUrl);
  };
  document.head.appendChild(script);
})();

(function(){
  'use strict';

  const VERSION = '0.4.0-loader';
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
  }

  load().catch((error) => {
    console.error('[LoopKit] failed to load runtime chunks', error);
  });
})();

#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'loopkit.js');
const output = join(root, 'dist', 'loopkit.js');

readFileSync(source, 'utf8');

const loader = `(function(){
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
`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, loader, 'utf8');

console.log(`Built ${output}`);

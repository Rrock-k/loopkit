#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/build-standalone.mjs <artifact.html> [output.html]');
  process.exit(1);
}

const output = process.argv[3] || join(dirname(input), `${basename(input, extname(input))}.standalone.html`);
const html = readFileSync(input, 'utf8');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distRuntime = join(root, 'dist', 'loopkit.js');
const legacyRuntime = join(root, 'loopkit.js');
const runtime = readStandaloneRuntime(distRuntime, legacyRuntime);

const externalScriptPattern = /<script\s+[^>]*src=["'][^"']*loopkit\.js["'][^>]*><\/script>/i;
if (!externalScriptPattern.test(html)) {
  console.error('Could not find external loopkit.js script tag.');
  process.exit(1);
}

const standalone = html.replace(
  externalScriptPattern,
  `<script id="loopkit-runtime">\n${runtime.replace(/<\/script>/gi, '<\\/script>')}\n</script>`
);

writeFileSync(output, standalone, 'utf8');
console.log(`Wrote ${output}`);

function readStandaloneRuntime(distPath, fallbackPath) {
  const dist = existsSync(distPath) ? readFileSync(distPath, 'utf8') : '';
  const chunkPaths = readChunkPaths(dist);

  if (chunkPaths.length) {
    const encoded = chunkPaths.map((chunkPath) => {
      const resolved = join(dirname(distPath), chunkPath);
      if (!existsSync(resolved)) throw new Error(`Missing runtime chunk: ${resolved}`);
      return readFileSync(resolved, 'utf8').replace(/\s+/g, '');
    }).join('');
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  const relativeRuntimeMatch = dist.match(/new URL\(['"]([^'"]+)['"],\s*new URL\(['"]\.['"],\s*current\.src\)\)/);

  if (relativeRuntimeMatch) {
    const resolved = join(dirname(distPath), relativeRuntimeMatch[1]);
    if (existsSync(resolved)) return readFileSync(resolved, 'utf8');
  }

  if (dist) return dist;
  return readFileSync(fallbackPath, 'utf8');
}

function readChunkPaths(runtime) {
  const match = runtime.match(/const\s+CHUNKS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

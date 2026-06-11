#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, basename, join } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/build-standalone.mjs <artifact.html> [output.html]');
  process.exit(1);
}

const output = process.argv[3] || join(dirname(input), `${basename(input, extname(input))}.standalone.html`);
const html = readFileSync(input, 'utf8');
const runtime = readFileSync(new URL('../loopkit.js', import.meta.url), 'utf8');

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

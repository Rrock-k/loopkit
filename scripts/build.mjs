#!/usr/bin/env node
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'loopkit.js');
const output = join(root, 'dist', 'loopkit.js');

function maybeUnpackCompressedLoader(sourceText) {
  if (!sourceText.includes("FORMAT = 'gzip+base64'") && !sourceText.includes('FORMAT = "gzip+base64"')) {
    return { runtime: sourceText, repairedSource: false };
  }

  const match = sourceText.match(/const\s+PAYLOAD\s*=\s*(['"])([\s\S]*?)\1\s*;/);
  if (!match) {
    throw new Error('Compressed LoopKit loader detected, but PAYLOAD was not found.');
  }

  const runtime = gunzipSync(Buffer.from(match[2].replace(/\s+/g, ''), 'base64')).toString('utf8');
  return { runtime, repairedSource: true };
}

const sourceText = readFileSync(source, 'utf8');
const { runtime, repairedSource } = maybeUnpackCompressedLoader(sourceText);

if (repairedSource) {
  writeFileSync(source, runtime, 'utf8');
  console.log('Repaired src/loopkit.js from compressed loader to readable runtime.');
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, runtime, 'utf8');

console.log(`Built self-contained ${output}`);

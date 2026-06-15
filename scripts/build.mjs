#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brotliDecompressSync, gunzipSync, inflateSync, unzipSync } from 'node:zlib';

const sourcePath = join(process.cwd(), 'src', 'loopkit.js');
const outputPath = join(process.cwd(), 'dist', 'loopkit.js');
const sourceText = readFileSync(sourcePath, 'utf8');
const runtimeText = decodeCompressedRuntime(sourceText) || sourceText;

if (runtimeText !== sourceText) {
  writeFileSync(sourcePath, runtimeText, 'utf8');
  console.log('Repaired src/loopkit.js into readable runtime source.');
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, runtimeText, 'utf8');

console.log(`Built ${outputPath}`);

function decodeCompressedRuntime(text) {
  if (!text.includes('gzip+base64') || !text.includes('PAYLOAD')) return null;

  const match = text.match(/PAYLOAD\s*=\s*(['"])([A-Za-z0-9+/=\s]+)\1/);
  if (!match) throw new Error('Found compressed runtime marker, but PAYLOAD was not readable.');

  const payload = match[2].replace(/\s+/g, '');
  const bytes = Buffer.from(payload, 'base64');
  const attempts = [unzipSync, gunzipSync, inflateSync, brotliDecompressSync];
  const errors = [];

  for (const fn of attempts) {
    try {
      const decoded = fn(bytes).toString('utf8');
      if (decoded.includes('LoopKit') || decoded.includes('data-loop-id')) return decoded;
      errors.push(`${fn.name}: decoded text did not look like LoopKit runtime`);
    } catch (error) {
      errors.push(`${fn.name}: ${error.message}`);
    }
  }

  throw new Error(`Could not decode compressed LoopKit runtime. ${errors.join(' | ')}`);
}

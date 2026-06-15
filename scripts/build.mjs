#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const sourcePath = join(root, 'src', 'loopkit.js');
const outputPath = join(root, 'dist', 'loopkit.js');
const chunkDir = join(root, 'scripts', 'runtime-source');

let runtime = readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');

if (runtime.includes("FORMAT = 'gzip+base64'") && existsSync(chunkDir)) {
  const encoded = readdirSync(chunkDir)
    .filter((name) => name.endsWith('.b64'))
    .sort()
    .map((name) => readFileSync(join(chunkDir, name), 'utf8').trim())
    .join('');

  runtime = Buffer.from(encoded, 'base64').toString('utf8').replace(/\r\n/g, '\n');
  writeFileSync(sourcePath, runtime, 'utf8');
  console.log('Restored readable src/loopkit.js from runtime-source chunks.');
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, runtime, 'utf8');

console.log(`Built ${outputPath}`);

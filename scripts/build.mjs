#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'loopkit.js');
const output = join(root, 'dist', 'loopkit.js');

const runtime = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, runtime, 'utf8');

console.log(`Built ${output}`);

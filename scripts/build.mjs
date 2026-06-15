#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sourcePath = join(process.cwd(), 'src', 'loopkit.js');
const outputPath = join(process.cwd(), 'dist', 'loopkit.js');
const sourceText = readFileSync(sourcePath, 'utf8');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sourceText, 'utf8');

console.log(`Built ${outputPath}`);

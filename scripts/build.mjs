#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sourcePath = join(process.cwd(), 'src', 'loopkit.js');
const formsPath = join(process.cwd(), 'src', 'loopkit.forms.js');
const outputPath = join(process.cwd(), 'dist', 'loopkit.js');

const parts = [readFileSync(sourcePath, 'utf8')];
if (existsSync(formsPath)) parts.push(readFileSync(formsPath, 'utf8'));

const runtime = parts.join('\n\n').replace(/\r\n/g, '\n');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, runtime, 'utf8');

console.log(`Built ${outputPath}`);

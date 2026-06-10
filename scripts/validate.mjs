#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run validate -- <artifact.html>');
  process.exit(2);
}

const abs = path.resolve(file);
const html = fs.readFileSync(abs, 'utf8');
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }

const metaMatch = html.match(/<script[^>]+type=["']application\/loopkit\+(?:json|meta)["'][^>]*>([\s\S]*?)<\/script>/i);
if (!metaMatch) {
  fail('Missing <script type="application/loopkit+json"> metadata.');
} else {
  try {
    const meta = JSON.parse(metaMatch[1]);
    if (!meta.artifact_id && !meta.artifactId) fail('Metadata missing artifact_id.');
    if (!meta.artifact_version && !meta.artifactVersion) fail('Metadata missing artifact_version.');
  } catch (error) {
    fail('LoopKit metadata is not valid JSON.');
  }
}

const ids = [...html.matchAll(/data-loop-id\s*=\s*["']([^"']+)["']/g)].map(match => match[1].trim());
if (!ids.length) fail('No data-loop-id anchors found.');

const empty = ids.filter(id => !id);
if (empty.length) fail('Found empty data-loop-id values.');

const seen = new Map();
for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
if (duplicates.length) fail('Duplicate data-loop-id values: ' + duplicates.slice(0, 12).join(', '));

if (!html.includes('loopkit.js') && !html.includes('window.LoopKit') && !html.includes('data-loopkit-root')) {
  fail('No LoopKit runtime reference found. Add <script src=".../loopkit.js"></script> or inline runtime.');
}

if (!/id=["']loopkit-decisions["']/.test(html)) {
  warn('No DECISIONS block found. This is allowed, but recommended.');
}

console.log(`LoopKit validation: ${path.basename(file)}`);
console.log(`Anchors: ${ids.length}`);

if (warnings.length) {
  console.log('\nWarnings:');
  for (const warning of warnings) console.log('  - ' + warning);
}

if (errors.length) {
  console.error('\nErrors:');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}

console.log('OK');

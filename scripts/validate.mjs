#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate.mjs <artifact.html>');
  process.exit(1);
}

const html = readFileSync(file, 'utf8');
const errors = [];
const warnings = [];

if (!html.includes('type="application/loopkit+json"') && !html.includes("type='application/loopkit+json'")) {
  errors.push('Missing LoopKit metadata: script[type="application/loopkit+json"]');
}
if (!/artifactId\s*['"]?\s*:/.test(html) && !/artifact_id\s*['"]?\s*:/.test(html)) {
  errors.push('Missing artifactId/artifact_id in metadata');
}
if (!/artifactVersion\s*['"]?\s*:/.test(html) && !/artifact_version\s*['"]?\s*:/.test(html)) {
  errors.push('Missing artifactVersion/artifact_version in metadata');
}
if (!html.includes('loopkit-decisions')) warnings.push('Missing #loopkit-decisions');
if (!html.includes('loopkit.js') && !html.includes('loopkit-runtime') && !html.includes('LoopKit runtime')) {
  errors.push('Missing LoopKit runtime: expected external loopkit.js or embedded runtime marker');
}

const ids = [...html.matchAll(/data-loop-id=["']([^"']+)["']/g)].map((m) => m[1]);
if (!ids.length) errors.push('No data-loop-id anchors found');
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (duplicates.length) errors.push(`Duplicate data-loop-id values: ${duplicates.slice(0, 12).join(', ')}${duplicates.length > 12 ? '...' : ''}`);

if (warnings.length) {
  console.warn('Warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error('LoopKit artifact validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK: ${file}`);
console.log(`Anchors: ${ids.length}`);

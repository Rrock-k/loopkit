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

const metaMatch = html.match(/<script\b(?=[^>]*type=["']application\/loopkit\+(?:json|meta)["'])[^>]*>([\s\S]*?)<\/script>/i);
if (!metaMatch) {
  errors.push('Missing LoopKit metadata: script[type="application/loopkit+json"]');
} else {
  try {
    const meta = JSON.parse(metaMatch[1].trim() || '{}');
    const artifactId = meta.artifactId || meta.artifact_id;
    const artifactVersion = meta.artifactVersion || meta.artifact_version;
    if (!artifactId || typeof artifactId !== 'string') errors.push('Missing non-empty artifactId/artifact_id in metadata');
    if (!artifactVersion || typeof artifactVersion !== 'string') errors.push('Missing non-empty artifactVersion/artifact_version in metadata');
  } catch (error) {
    errors.push(`Invalid LoopKit metadata JSON: ${error.message}`);
  }
}

if (!/<script\b(?=[^>]*id=["']loopkit-decisions["'])[^>]*>/i.test(html)) {
  warnings.push('Missing #loopkit-decisions');
}
if (!/<script\b(?=[^>]*id=["']loopkit-agent-instructions["'])[^>]*>/i.test(html)) {
  warnings.push('Missing #loopkit-agent-instructions for fully self-contained artifacts');
}

const hasExternalRuntime = /<script\b[^>]*src=["'][^"']*loopkit\.js[^"']*["'][^>]*><\/script>/i.test(html);
const hasInlineRuntime = /<script\b(?=[^>]*id=["']loopkit-runtime["'])[^>]*>/i.test(html) || /window\.LoopKit|\[LoopKit\]/.test(html);
if (!hasExternalRuntime && !hasInlineRuntime) {
  errors.push('Missing LoopKit runtime: expected external loopkit.js or embedded runtime marker');
}

const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
const ids = [...withoutScripts.matchAll(/\bdata-loop-id=["']([^"']+)["']/g)].map((m) => m[1].trim());
if (!ids.length) errors.push('No data-loop-id anchors found');
if (ids.some((id) => !id)) errors.push('Empty data-loop-id value found');

const seen = new Set();
const duplicates = [];
for (const id of ids) {
  if (seen.has(id) && !duplicates.includes(id)) duplicates.push(id);
  seen.add(id);
}
if (duplicates.length) {
  errors.push(`Duplicate data-loop-id values: ${duplicates.slice(0, 12).join(', ')}${duplicates.length > 12 ? '...' : ''}`);
}
if (ids.length < 3) {
  warnings.push(`Only ${ids.length} data-loop-id anchors found; useful artifacts usually mark key sections and controls.`);
}

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

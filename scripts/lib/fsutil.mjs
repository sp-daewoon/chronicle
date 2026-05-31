// scripts/lib/fsutil.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

export function writeFile(p, content) {
  ensureDir(p);
  writeFileSync(p, content);
}

// Replace the block between startMarker and endMarker with `replacement`.
// If markers are absent, append a fresh block at the end. Idempotent.
export function replaceAnchored(content, startMarker, endMarker, replacement) {
  const block = `${startMarker}\n${replacement}\n${endMarker}`;
  const re = new RegExp(
    escapeRe(startMarker) + '[\\s\\S]*?' + escapeRe(endMarker)
  );
  if (re.test(content)) return content.replace(re, block);
  const sep = content.endsWith('\n') ? '' : '\n';
  return content + sep + block + '\n';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

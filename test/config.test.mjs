// test/config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, loadConfig } from '../scripts/lib/config.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'chron-')); }

test('returns DEFAULTS when no config file and nothing to detect', () => {
  const dir = tmp();
  const cfg = loadConfig({ cwd: dir });
  assert.equal(cfg.adr.dir, DEFAULTS.adr.dir);
  assert.equal(cfg.changelog.path, 'CHANGELOG.md');
  rmSync(dir, { recursive: true, force: true });
});

test('explicit config file is deep-merged over defaults', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'chronicle.config.json'),
    JSON.stringify({ adr: { dir: 'decisions' } }));
  const cfg = loadConfig({ cwd: dir });
  assert.equal(cfg.adr.dir, 'decisions');
  // untouched default survives the merge
  assert.equal(cfg.adr.numberWidth, DEFAULTS.adr.numberWidth);
  rmSync(dir, { recursive: true, force: true });
});

test('auto-detects an existing adr directory when no config file', () => {
  const dir = tmp();
  mkdirSync(join(dir, 'adr'));
  const cfg = loadConfig({ cwd: dir });
  assert.equal(cfg.adr.dir, 'adr');
  assert.equal(cfg.detected.adr, true);
  rmSync(dir, { recursive: true, force: true });
});

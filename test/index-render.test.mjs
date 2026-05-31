// test/index-render.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndexModel, renderIndexMarkdown, renderIndexHtml } from '../scripts/index-render.mjs';

test('buildIndexModel collects adr count and changelog presence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idx-'));
  mkdirSync(join(dir, 'docs/adr'), { recursive: true });
  writeFileSync(join(dir, 'docs/adr/0001-x.md'), '# 1. X\n## Status\nAccepted\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n## [Unreleased]\n');
  const cfg = {
    adr: { dir: 'docs/adr', numberWidth: 4 },
    changelog: { path: 'CHANGELOG.md' },
    index: { output: 'docs/INDEX.md', sources: ['adr', 'changelog'] },
  };
  const model = buildIndexModel({ cwd: dir, cfg });
  assert.equal(model.adr.count, 1);
  assert.equal(model.changelog.exists, true);
  rmSync(dir, { recursive: true, force: true });
});

test('renderIndexMarkdown produces navigation links', () => {
  const md = renderIndexMarkdown({
    adr: { count: 2, dir: 'docs/adr' },
    changelog: { exists: true, path: 'CHANGELOG.md' },
    releases: null,
  });
  assert.match(md, /# Project Index/);
  assert.match(md, /\[Architecture Decision Records\]\(docs\/adr\)/);
  assert.match(md, /2 records/);
  assert.match(md, /\[Changelog\]\(CHANGELOG\.md\)/);
});

test('renderIndexHtml converts markdown links to HTML anchors', () => {
  const model = {
    adr: { count: 2, dir: 'docs/adr' },
    changelog: { exists: true, path: 'CHANGELOG.md' },
    releases: null,
  };
  const html = renderIndexHtml(model);
  assert.ok(html.includes('<a href="docs/adr">Architecture Decision Records</a>'), 'ADR anchor missing');
  assert.ok(html.includes('<a href="CHANGELOG.md">Changelog</a>'), 'Changelog anchor missing');
  assert.ok(!html.includes('[Architecture Decision Records]'), 'raw markdown link still present');
});

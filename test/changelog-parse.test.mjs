// test/changelog-parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, promote, EMPTY } from '../scripts/changelog-parse.mjs';

test('addEntry inserts under the correct Unreleased subsection', () => {
  const out = addEntry(EMPTY, 'Added', 'New ADR workflow');
  assert.match(out, /## \[Unreleased\][\s\S]*### Added\n- New ADR workflow/);
});

test('addEntry creates the subsection if missing', () => {
  const out = addEntry(EMPTY, 'Fixed', 'Crash on empty config');
  assert.match(out, /### Fixed\n- Crash on empty config/);
});

test('promote moves Unreleased content into a versioned section', () => {
  let c = addEntry(EMPTY, 'Added', 'feature x');
  c = promote(c, '1.0.0', '2026-05-31');
  assert.match(c, /## \[1\.0\.0\] - 2026-05-31/);
  assert.match(c, /### Added\n- feature x/);
  // fresh empty Unreleased remains on top
  assert.match(c, /## \[Unreleased\]\s*\n+## \[1\.0\.0\]/);
});

test('addEntry appends chronologically within an existing subsection', () => {
  let c = addEntry(EMPTY, 'Added', 'first');
  c = addEntry(c, 'Added', 'second');
  assert.match(c, /- first\n- second/, 'entries must appear in chronological (oldest-first) order');
});

test('addEntry adds blank line before a new subsection when prior content exists', () => {
  let c = addEntry(EMPTY, 'Added', 'feature');
  c = addEntry(c, 'Fixed', 'bug');
  assert.match(c, /- feature\n\n### Fixed\n- bug/, 'blank line must separate subsections');
});

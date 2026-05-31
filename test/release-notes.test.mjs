// test/release-notes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionFor, composeNotes } from '../scripts/release-notes.mjs';

const CL = `# Changelog
## [Unreleased]
## [1.2.0] - 2026-05-31
### Added
- thing one
## [1.1.0] - 2026-05-01
### Fixed
- old bug
`;

test('sectionFor extracts only the requested version block', () => {
  const s = sectionFor(CL, '1.2.0');
  assert.match(s, /thing one/);
  assert.doesNotMatch(s, /old bug/);
});

test('composeNotes assembles changelog + ADR + commit sections', () => {
  const notes = composeNotes({
    version: '1.2.0',
    changelogSection: '### Added\n- thing one',
    adrs: [{ number: 7, title: 'Adopt X', file: '0007-adopt-x.md' }],
    commits: ['feat: a', 'fix: b'],
  });
  assert.match(notes, /## What's Changed/);
  assert.match(notes, /thing one/);
  assert.match(notes, /New Architecture Decisions/);
  assert.match(notes, /0007-adopt-x\.md/);
  assert.match(notes, /feat: a/);
});

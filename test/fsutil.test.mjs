// test/fsutil.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceAnchored, readIfExists } from '../scripts/lib/fsutil.mjs';

const START = '<!-- chronicle:releases -->';
const END = '<!-- /chronicle:releases -->';

test('replaceAnchored inserts block when anchors absent (appends)', () => {
  const out = replaceAnchored('# Title\n', START, END, 'ROWS');
  assert.match(out, /<!-- chronicle:releases -->\nROWS\n<!-- \/chronicle:releases -->/);
});

test('replaceAnchored is idempotent — replaces existing block in place', () => {
  const first = replaceAnchored('# T\n', START, END, 'A');
  const second = replaceAnchored(first, START, END, 'B');
  assert.match(second, /releases -->\nB\n<!-- \//);
  assert.doesNotMatch(second, /\bA\b/);
  // only one anchor pair
  assert.equal(second.split(START).length - 1, 1);
});

test('readIfExists returns null for missing file', () => {
  assert.equal(readIfExists('/no/such/file/here.txt'), null);
});

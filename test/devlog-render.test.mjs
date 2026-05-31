// test/devlog-render.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDevlogPath, renderDevlogHtml } from '../scripts/devlog-render.mjs';

test('nextDevlogPath uses bare date when none exists', () => {
  assert.equal(nextDevlogPath([], '2026-05-31'), '2026-05-31.html');
});

test('nextDevlogPath sequences when same-day files exist', () => {
  const files = ['2026-05-31.html', '2026-05-31-2.html'];
  assert.equal(nextDevlogPath(files, '2026-05-31'), '2026-05-31-3.html');
});

test('renderDevlogHtml is self-contained (inline style, no external refs)', () => {
  const html = renderDevlogHtml({
    title: 'Session', date: '2026-05-31',
    sections: [{ heading: 'Summary', html: '<p>did things</p>' }],
  });
  assert.match(html, /<style>/);
  assert.doesNotMatch(html, /https?:\/\//); // no external resources
  assert.match(html, /did things/);
  assert.match(html, /Summary/);
});

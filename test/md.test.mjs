// test/md.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, extractAdrStatus, slugify } from '../scripts/lib/md.mjs';

test('parseFrontmatter splits yaml-ish frontmatter from body', () => {
  const txt = '---\nstatus: Accepted\ndate: 2026-05-31\n---\n# Title\nbody';
  const { data, body } = parseFrontmatter(txt);
  assert.equal(data.status, 'Accepted');
  assert.equal(data.date, '2026-05-31');
  assert.match(body, /# Title/);
});

test('parseFrontmatter with no frontmatter returns empty data', () => {
  const { data, body } = parseFrontmatter('# Just a title\ntext');
  assert.deepEqual(data, {});
  assert.match(body, /Just a title/);
});

test('extractAdrStatus prefers frontmatter, then ## Status section', () => {
  assert.equal(extractAdrStatus('---\nstatus: Proposed\n---\nx'), 'Proposed');
  assert.equal(extractAdrStatus('# ADR\n## Status\nAccepted\n## Context'), 'Accepted');
});

test('extractAdrStatus detects Superseded keyword as fallback', () => {
  assert.equal(extractAdrStatus('# ADR 5: foo (Superseded by ADR-9)'), 'Superseded');
});

test('slugify makes kebab-case ascii', () => {
  assert.equal(slugify('Use Kafka Event Backbone!'), 'use-kafka-event-backbone');
});

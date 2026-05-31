// test/adr-index.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAdrIndex } from '../scripts/adr-index.mjs';

test('buildAdrIndex lists ADRs sorted by number with parsed status', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adr-'));
  const adrDir = join(dir, 'docs/adr');
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(join(adrDir, '0002-use-kafka.md'), '---\nstatus: Accepted\ndate: 2026-05-02\n---\n# 2. Use Kafka\n');
  writeFileSync(join(adrDir, '0001-record-decisions.md'), '# 1. Record architecture decisions\n## Status\nProposed\n');
  const cfg = { adr: { dir: 'docs/adr', numberWidth: 4 } };
  const rows = buildAdrIndex({ cwd: dir, cfg });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].number, 1);
  assert.equal(rows[0].status, 'Proposed');
  assert.equal(rows[1].number, 2);
  assert.equal(rows[1].status, 'Accepted');
  assert.equal(rows[1].date, '2026-05-02');
  rmSync(dir, { recursive: true, force: true });
});

# chronicle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `chronicle`, a public Claude Code plugin that automates a project documentation lifecycle (ADR · CHANGELOG · release · devlog · index · CLAUDE.md) as 6 bundled skills backed by zero-dependency Node helper scripts.

**Architecture:** A single plugin repo that is also its own marketplace. Each workflow is a SKILL.md (LLM instructions) + a slash command, with deterministic work (parsing, rendering, version promotion) delegated to Node 18+ native helper scripts called via `${CLAUDE_PLUGIN_ROOT}/scripts/*.mjs`. All behavior adapts to any project via `chronicle.config.json` with auto-detection fallback — zero magicJar specifics.

**Tech Stack:** Node.js 18+ (native ESM, `node --test`, `node:fs`/`node:path` only — no npm deps), Markdown, JSON manifests, Claude Code plugin format.

**Working directory:** `~/chronicle` (git initialized, branch `main`, author `sp-daewoon <sp.daewoon@gmail.com>`). All paths below are relative to `~/chronicle`.

**Commit note:** This repo has NO git hooks. Use plain `git commit`. Author is already configured.

---

## File Structure

```
chronicle/
├── .claude-plugin/
│   ├── plugin.json              # Task 2
│   └── marketplace.json         # Task 2
├── package.json                 # Task 1 (deps:{}, "type":"module", test script)
├── scripts/
│   ├── lib/
│   │   ├── config.mjs           # Task 3  — load/detect/merge config
│   │   ├── md.mjs               # Task 4  — frontmatter + ADR status parsing
│   │   └── fsutil.mjs           # Task 5  — idempotent anchor replace, fs helpers
│   ├── adr-index.mjs            # Task 6
│   ├── changelog-parse.mjs      # Task 7
│   ├── release-notes.mjs        # Task 8
│   ├── devlog-render.mjs        # Task 9
│   └── index-render.mjs         # Task 10
├── test/
│   ├── config.test.mjs          # Task 3
│   ├── md.test.mjs              # Task 4
│   ├── fsutil.test.mjs          # Task 5
│   ├── adr-index.test.mjs       # Task 6
│   ├── changelog-parse.test.mjs # Task 7
│   ├── release-notes.test.mjs   # Task 8
│   ├── devlog-render.test.mjs   # Task 9
│   └── index-render.test.mjs    # Task 10
├── templates/
│   ├── chronicle.config.json    # Task 11
│   └── adr-template.md          # Task 11
├── skills/
│   ├── adr/SKILL.md             # Task 12
│   ├── changelog/SKILL.md       # Task 13
│   ├── release/SKILL.md         # Task 14
│   ├── devlog/SKILL.md          # Task 15
│   ├── index/SKILL.md           # Task 16
│   └── claude-md/SKILL.md       # Task 17
├── commands/
│   ├── adr.md  changelog.md  release.md  devlog.md  index.md  claude-md.md  # Tasks 12-17
├── LICENSE                      # Task 1
├── README.md                    # Task 18
├── CHANGELOG.md                 # Task 18 (dogfooding)
└── .gitignore                   # Task 1
```

**Decomposition rationale:** `scripts/lib/*` are pure, single-responsibility modules (config, markdown, fs) reused by all 5 CLI helpers. Each CLI helper owns exactly one workflow's deterministic logic and is testable in isolation via stdin/stdout/args. Skills are thin LLM-instruction wrappers that call helpers. This keeps every file small and independently reasoned about.

---

## Task 1: Repo scaffolding (package.json, LICENSE, .gitignore)

**Files:**
- Create: `package.json`
- Create: `LICENSE`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "chronicle",
  "version": "0.1.0",
  "description": "A Claude Code plugin that automates your project documentation lifecycle: ADR, CHANGELOG, releases, devlog, index, and CLAUDE.md.",
  "type": "module",
  "private": false,
  "license": "MIT",
  "scripts": {
    "test": "node --test test/"
  },
  "dependencies": {},
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 sp-daewoon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
*.log
.DS_Store
/tmp/
RELEASE_NOTES.md
```

- [ ] **Step 4: Commit**

```bash
cd ~/chronicle
git add package.json LICENSE .gitignore
git commit -m "chore: scaffold repo (package.json, MIT license, gitignore)"
```

---

## Task 2: Plugin & marketplace manifests

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Create .claude-plugin/plugin.json**

```json
{
  "name": "chronicle",
  "displayName": "chronicle",
  "version": "0.1.0",
  "description": "Automate your project's documentation lifecycle — ADR, CHANGELOG, releases, devlog, index, and CLAUDE.md — as 6 skills with zero-dependency helpers.",
  "author": {
    "name": "sp-daewoon",
    "url": "https://github.com/sp-daewoon"
  },
  "homepage": "https://github.com/sp-daewoon/chronicle",
  "repository": "https://github.com/sp-daewoon/chronicle",
  "license": "MIT",
  "keywords": ["adr", "changelog", "release", "devlog", "documentation", "docops", "skills"],
  "skills": "./skills/",
  "commands": ["./commands/"]
}
```

- [ ] **Step 2: Create .claude-plugin/marketplace.json**

```json
{
  "name": "chronicle",
  "owner": {
    "name": "sp-daewoon",
    "url": "https://github.com/sp-daewoon"
  },
  "description": "chronicle — project documentation lifecycle plugin for Claude Code.",
  "plugins": [
    {
      "name": "chronicle",
      "source": ".",
      "description": "ADR, CHANGELOG, release, devlog, index, and CLAUDE.md workflows in one plugin.",
      "license": "MIT",
      "keywords": ["adr", "changelog", "release", "devlog", "documentation"]
    }
  ]
}
```

- [ ] **Step 3: Verify manifests are valid JSON**

Run: `cd ~/chronicle && node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/chronicle
git add .claude-plugin/
git commit -m "feat: add plugin and marketplace manifests"
```

---

## Task 3: scripts/lib/config.mjs — load, auto-detect, merge config

**Files:**
- Create: `scripts/lib/config.mjs`
- Test: `test/config.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/config.test.mjs`
Expected: FAIL — cannot find module `../scripts/lib/config.mjs`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/lib/config.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = {
  adr: { dir: 'docs/adr', format: 'nygard', numberWidth: 4, indexFile: 'docs/adr/README.md' },
  changelog: { path: 'CHANGELOG.md', format: 'keepachangelog' },
  devlog: { dir: 'docs/devlog', format: 'html', sections: ['Summary', 'Changes', 'Decisions', 'Next'] },
  index: { output: 'docs/INDEX.html', sources: ['adr', 'changelog', 'releases'] },
  release: { provider: 'github', tagPrefix: 'v', readmeTable: true },
};

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

// Auto-detect well-known doc locations when no explicit config exists.
function detect(cwd) {
  const found = {};
  const over = {};
  for (const cand of ['docs/adr', 'doc/adr', 'adr']) {
    if (isDir(join(cwd, cand))) { over.adr = { dir: cand, indexFile: join(cand, 'README.md') }; found.adr = true; break; }
  }
  for (const cand of ['docs/devlog', 'devlog']) {
    if (isDir(join(cwd, cand))) { over.devlog = { dir: cand }; found.devlog = true; break; }
  }
  for (const cand of ['CHANGELOG.md', 'changelog.md']) {
    if (existsSync(join(cwd, cand))) { over.changelog = { path: cand }; found.changelog = true; break; }
  }
  return { over, found };
}

export function loadConfig({ cwd = process.cwd(), path } = {}) {
  const explicit = path || join(cwd, 'chronicle.config.json');
  if (existsSync(explicit)) {
    const user = JSON.parse(readFileSync(explicit, 'utf8'));
    const cfg = deepMerge(DEFAULTS, user);
    cfg.detected = {};
    cfg._source = explicit;
    return cfg;
  }
  const { over, found } = detect(cwd);
  const cfg = deepMerge(DEFAULTS, over);
  cfg.detected = found;
  cfg._source = null;
  return cfg;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/config.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/lib/config.mjs test/config.test.mjs
git commit -m "feat: config loader with auto-detect and deep-merge"
```

---

## Task 4: scripts/lib/md.mjs — frontmatter + ADR status parsing

**Files:**
- Create: `scripts/lib/md.mjs`
- Test: `test/md.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/md.test.mjs`
Expected: FAIL — cannot find module `../scripts/lib/md.mjs`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/lib/md.mjs

// Minimal frontmatter parser: supports `key: value` scalar lines only (no nesting).
export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

const STATUSES = ['Proposed', 'Accepted', 'Deprecated', 'Superseded', 'Rejected'];

export function extractAdrStatus(text) {
  const { data, body } = parseFrontmatter(text);
  if (data.status) return data.status;
  const sec = /^##\s*Status\s*\n+([^\n#]+)/im.exec(body);
  if (sec) {
    const line = sec[1].trim();
    const hit = STATUSES.find((s) => new RegExp(s, 'i').test(line));
    return hit || line;
  }
  const kw = STATUSES.find((s) => new RegExp(s, 'i').test(text));
  return kw || 'Unknown';
}

export function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/md.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/lib/md.mjs test/md.test.mjs
git commit -m "feat: markdown frontmatter and ADR status parser"
```

---

## Task 5: scripts/lib/fsutil.mjs — idempotent anchor replace + fs helpers

**Files:**
- Create: `scripts/lib/fsutil.mjs`
- Test: `test/fsutil.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/fsutil.test.mjs`
Expected: FAIL — cannot find module `../scripts/lib/fsutil.mjs`.

- [ ] **Step 3: Write minimal implementation**

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/fsutil.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/lib/fsutil.mjs test/fsutil.test.mjs
git commit -m "feat: fs helpers with idempotent anchored block replace"
```

---

## Task 6: scripts/adr-index.mjs — scan ADRs, emit index table

**Files:**
- Create: `scripts/adr-index.mjs`
- Test: `test/adr-index.test.mjs`

CLI contract: `node scripts/adr-index.mjs [--config <path>] [--write]`. Scans `config.adr.dir` for `NNNN-*.md`, parses number/title/status/date, prints a markdown table to stdout. With `--write`, replaces the anchored block in `config.adr.indexFile`. Exposes `buildAdrIndex(cfg)` for testing.

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/adr-index.test.mjs`
Expected: FAIL — cannot find module `../scripts/adr-index.mjs`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/adr-index.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { extractAdrStatus, parseFrontmatter } from './lib/md.mjs';
import { readIfExists, writeFile, replaceAnchored } from './lib/fsutil.mjs';

const START = '<!-- chronicle:adr-index -->';
const END = '<!-- /chronicle:adr-index -->';

export function buildAdrIndex({ cwd = process.cwd(), cfg }) {
  const dir = join(cwd, cfg.adr.dir);
  let files = [];
  try { files = readdirSync(dir); } catch { return []; }
  const rows = [];
  for (const f of files) {
    const m = /^(\d+)[-_](.+)\.md$/.exec(f);
    if (!m || /^readme$/i.test(m[2])) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const { data } = parseFrontmatter(text);
    const titleMatch = /^#\s*(.+)$/m.exec(text);
    rows.push({
      number: parseInt(m[1], 10),
      file: f,
      title: (titleMatch ? titleMatch[1] : m[2].replace(/[-_]/g, ' ')).trim(),
      status: extractAdrStatus(text),
      date: data.date || '',
    });
  }
  rows.sort((a, b) => a.number - b.number);
  return rows;
}

export function renderTable(rows, cfg) {
  const width = cfg.adr.numberWidth || 4;
  const head = '| No. | Title | Status | Date |\n| --- | --- | --- | --- |';
  const body = rows.map((r) =>
    `| ${String(r.number).padStart(width, '0')} | [${r.title}](${r.file}) | ${r.status} | ${r.date} |`
  ).join('\n');
  return rows.length ? `${head}\n${body}` : `${head}`;
}

function main(argv) {
  const args = parseArgs(argv);
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const rows = buildAdrIndex({ cwd: process.cwd(), cfg });
  const table = renderTable(rows, cfg);
  if (args.write) {
    const idxPath = join(process.cwd(), cfg.adr.indexFile);
    const existing = readIfExists(idxPath) ?? `# Architecture Decision Records\n\n${START}\n${END}\n`;
    writeFile(idxPath, replaceAnchored(existing, START, END, table));
    process.stderr.write(`wrote ${cfg.adr.indexFile} (${rows.length} ADRs)\n`);
  } else {
    process.stdout.write(table + '\n');
  }
}

function parseArgs(argv) {
  const a = { write: false, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--write') a.write = true;
    else if (argv[i] === '--config') a.config = argv[++i];
  }
  return a;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/adr-index.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/adr-index.mjs test/adr-index.test.mjs
git commit -m "feat: adr-index helper — scan ADRs and render index table"
```

---

## Task 7: scripts/changelog-parse.mjs — add entry + version promotion

**Files:**
- Create: `scripts/changelog-parse.mjs`
- Test: `test/changelog-parse.test.mjs`

CLI contract: `node scripts/changelog-parse.mjs add --type Added --text "..."` and `node scripts/changelog-parse.mjs release --version 1.2.0 --date 2026-05-31`. Operates on Keep a Changelog format. Exposes `addEntry(content, type, text)` and `promote(content, version, date)` for testing.

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/changelog-parse.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/changelog-parse.mjs
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile } from './lib/fsutil.mjs';

export const EMPTY = `# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
`;

const TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

function splitSections(content) {
  // Returns { head, sections: [{header, body}] } split on "## " headings.
  const idx = content.indexOf('\n## ');
  if (idx === -1) return { head: content, sections: [] };
  const head = content.slice(0, idx + 1);
  const rest = content.slice(idx + 1);
  const parts = rest.split(/\n(?=## )/);
  const sections = parts.map((p) => {
    const nl = p.indexOf('\n');
    return nl === -1
      ? { header: p, body: '' }
      : { header: p.slice(0, nl), body: p.slice(nl + 1) };
  });
  return { head, sections };
}

function rebuild(head, sections) {
  return head + sections.map((s) => s.header + '\n' + s.body).join('\n').replace(/\n+$/, '\n');
}

export function addEntry(content, type, text) {
  if (!TYPES.includes(type)) throw new Error(`invalid type: ${type}`);
  const { head, sections } = splitSections(content || EMPTY);
  let unrel = sections.find((s) => /## \[Unreleased\]/.test(s.header));
  if (!unrel) { unrel = { header: '## [Unreleased]', body: '' }; sections.unshift(unrel); }
  const subRe = new RegExp(`### ${type}\\n`);
  if (subRe.test(unrel.body)) {
    unrel.body = unrel.body.replace(subRe, `### ${type}\n- ${text}\n`);
  } else {
    unrel.body = unrel.body.replace(/\n*$/, '\n') + `### ${type}\n- ${text}\n`;
  }
  return rebuild(head, sections);
}

export function promote(content, version, date) {
  const { head, sections } = splitSections(content || EMPTY);
  const unrel = sections.find((s) => /## \[Unreleased\]/.test(s.header));
  const moved = unrel ? unrel.body.trimEnd() : '';
  const versioned = { header: `## [${version}] - ${date}`, body: moved + '\n' };
  const fresh = { header: '## [Unreleased]', body: '' };
  const others = sections.filter((s) => !/## \[Unreleased\]/.test(s.header));
  return rebuild(head, [fresh, versioned, ...others]);
}

function parseArgs(argv) {
  const a = { cmd: argv[0], type: undefined, text: undefined, version: undefined, date: undefined, config: undefined };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--type') a.type = argv[++i];
    else if (k === '--text') a.text = argv[++i];
    else if (k === '--version') a.version = argv[++i];
    else if (k === '--date') a.date = argv[++i];
    else if (k === '--config') a.config = argv[++i];
  }
  return a;
}

function main(argv) {
  const args = parseArgs(argv);
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const p = join(process.cwd(), cfg.changelog.path);
  const content = readIfExists(p) ?? EMPTY;
  let out;
  if (args.cmd === 'add') out = addEntry(content, args.type, args.text);
  else if (args.cmd === 'release') out = promote(content, args.version, args.date);
  else { process.stderr.write('usage: changelog-parse.mjs add|release ...\n'); process.exit(1); }
  writeFile(p, out);
  process.stderr.write(`updated ${cfg.changelog.path}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/changelog-parse.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/changelog-parse.mjs test/changelog-parse.test.mjs
git commit -m "feat: changelog-parse helper — add entries and promote versions"
```

---

## Task 8: scripts/release-notes.mjs — synthesize release notes

**Files:**
- Create: `scripts/release-notes.mjs`
- Test: `test/release-notes.test.mjs`

CLI contract: `node scripts/release-notes.mjs --version 1.2.0 [--config <path>]`. Pulls the matching CHANGELOG section and formats release notes markdown. Exposes `sectionFor(changelog, version)` and `composeNotes({version, changelogSection, adrs, commits})` for testing. (Git/gh interaction lives in the skill, not here — this module is pure string composition so it stays testable.)

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/release-notes.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/release-notes.mjs
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile } from './lib/fsutil.mjs';

export function sectionFor(changelog, version) {
  const re = new RegExp(
    `## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`
  );
  const m = re.exec(changelog);
  return m ? m[1].trim() : '';
}

export function composeNotes({ version, changelogSection, adrs = [], commits = [] }) {
  let out = `## What's Changed\n\n`;
  out += (changelogSection && changelogSection.length) ? changelogSection : '_No changelog entries._';
  out += '\n';
  if (adrs.length) {
    out += `\n### New Architecture Decisions\n`;
    for (const a of adrs) {
      out += `- ADR ${String(a.number).padStart(4, '0')}: ${a.title} (\`${a.file}\`)\n`;
    }
  }
  if (commits.length) {
    out += `\n<details>\n<summary>Commits</summary>\n\n`;
    for (const c of commits) out += `- ${c}\n`;
    out += `\n</details>\n`;
  }
  return out.trimEnd() + '\n';
}

function parseArgs(argv) {
  const a = { version: undefined, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') a.version = argv[++i];
    else if (argv[i] === '--config') a.config = argv[++i];
  }
  return a;
}

// CLI: reads CHANGELOG for the version section and writes RELEASE_NOTES.md.
// ADR list / commit list are passed in by the skill via stdin JSON (optional).
function main(argv) {
  const args = parseArgs(argv);
  if (!args.version) { process.stderr.write('--version required\n'); process.exit(1); }
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const cl = readIfExists(join(process.cwd(), cfg.changelog.path)) ?? '';
  let extra = { adrs: [], commits: [] };
  try {
    const stdin = readIfExists('/dev/stdin');
    if (stdin && stdin.trim()) extra = { ...extra, ...JSON.parse(stdin) };
  } catch { /* no stdin */ }
  const notes = composeNotes({
    version: args.version,
    changelogSection: sectionFor(cl, args.version),
    adrs: extra.adrs,
    commits: extra.commits,
  });
  writeFile(join(process.cwd(), 'RELEASE_NOTES.md'), notes);
  process.stdout.write(notes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/release-notes.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/release-notes.mjs test/release-notes.test.mjs
git commit -m "feat: release-notes helper — synthesize notes from changelog/ADR/commits"
```

---

## Task 9: scripts/devlog-render.mjs — session HTML + index

**Files:**
- Create: `scripts/devlog-render.mjs`
- Test: `test/devlog-render.test.mjs`

CLI contract: `echo '<json>' | node scripts/devlog-render.mjs [--config <path>] [--date YYYY-MM-DD]`. Input JSON: `{ title, sections: [{heading, html}] }`. Picks `devlog/YYYY-MM-DD[-N].html` (never overwrites — sequences `-2`, `-3`), writes it, updates `index.html`. Exposes `nextDevlogPath(existingFiles, date)` and `renderDevlogHtml({title, date, sections})` for testing.

- [ ] **Step 1: Write the failing test**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/devlog-render.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/devlog-render.mjs
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile, replaceAnchored } from './lib/fsutil.mjs';

const IDX_START = '<!-- chronicle:devlog-list -->';
const IDX_END = '<!-- /chronicle:devlog-list -->';

export function nextDevlogPath(existing, date) {
  if (!existing.includes(`${date}.html`)) return `${date}.html`;
  let n = 2;
  while (existing.includes(`${date}-${n}.html`)) n++;
  return `${date}-${n}.html`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDevlogHtml({ title, date, sections }) {
  const body = sections.map((s) =>
    `  <section>\n    <h2>${esc(s.heading)}</h2>\n    ${s.html}\n  </section>`
  ).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(date)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: .4rem; }
  section { margin: 1.5rem 0; }
  h2 { color: #444; font-size: 1.15rem; }
  code { background: #f4f4f4; padding: .1rem .3rem; border-radius: 3px; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p><em>${esc(date)}</em></p>
${body}
</body>
</html>
`;
}

function renderIndex(files) {
  const items = files.sort().reverse()
    .map((f) => `  <li><a href="${f}">${f.replace(/\.html$/, '')}</a></li>`).join('\n');
  const list = `<ul>\n${items}\n</ul>`;
  const shell = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Devlog Index</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem}</style>
</head><body>
<h1>Devlog</h1>
${IDX_START}
${IDX_END}
</body></html>
`;
  return replaceAnchored(shell, IDX_START, IDX_END, list);
}

function main(argv) {
  let config, date;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') config = argv[++i];
    else if (argv[i] === '--date') date = argv[++i];
  }
  if (!date) { process.stderr.write('--date YYYY-MM-DD required\n'); process.exit(1); }
  const cfg = loadConfig({ cwd: process.cwd(), path: config });
  const data = JSON.parse(readIfExists('/dev/stdin') || '{}');
  const dir = join(process.cwd(), cfg.devlog.dir);
  let existing = [];
  try { existing = readdirSync(dir).filter((f) => /\.html$/.test(f) && f !== 'index.html'); } catch {}
  const fname = nextDevlogPath(existing, date);
  writeFile(join(dir, fname), renderDevlogHtml({ title: data.title || 'Devlog', date, sections: data.sections || [] }));
  writeFile(join(dir, 'index.html'), renderIndex([...existing, fname]));
  process.stderr.write(`wrote ${cfg.devlog.dir}/${fname}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/devlog-render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/chronicle
git add scripts/devlog-render.mjs test/devlog-render.test.mjs
git commit -m "feat: devlog-render helper — sequenced session HTML + index"
```

---

## Task 10: scripts/index-render.mjs — single navigation hub

**Files:**
- Create: `scripts/index-render.mjs`
- Test: `test/index-render.test.mjs`

CLI contract: `node scripts/index-render.mjs [--config <path>]`. Builds a navigation index from configured sources (adr/changelog/releases) and writes `config.index.output`. Output format follows the file extension (`.md` → markdown, `.html` → html). Exposes `buildIndexModel({cwd, cfg})` and `renderIndexMarkdown(model)` for testing.

- [ ] **Step 1: Write the failing test**

```javascript
// test/index-render.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndexModel, renderIndexMarkdown } from '../scripts/index-render.mjs';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/chronicle && node --test test/index-render.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```javascript
// scripts/index-render.mjs
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { writeFile } from './lib/fsutil.mjs';
import { buildAdrIndex } from './adr-index.mjs';

export function buildIndexModel({ cwd = process.cwd(), cfg }) {
  const sources = cfg.index.sources || [];
  const model = { adr: null, changelog: null, releases: null };
  if (sources.includes('adr')) {
    const rows = buildAdrIndex({ cwd, cfg });
    model.adr = { count: rows.length, dir: cfg.adr.dir };
  }
  if (sources.includes('changelog')) {
    model.changelog = { exists: existsSync(join(cwd, cfg.changelog.path)), path: cfg.changelog.path };
  }
  if (sources.includes('releases')) {
    model.releases = { provider: cfg.release.provider };
  }
  return model;
}

export function renderIndexMarkdown(model) {
  let out = `# Project Index\n\n> Generated by chronicle.\n\n`;
  if (model.adr) {
    out += `- [Architecture Decision Records](${model.adr.dir}) — ${model.adr.count} records\n`;
  }
  if (model.changelog && model.changelog.exists) {
    out += `- [Changelog](${model.changelog.path})\n`;
  }
  if (model.releases) {
    out += `- Releases — ${model.releases.provider}\n`;
  }
  return out;
}

function renderIndexHtml(model) {
  const md = renderIndexMarkdown(model);
  const items = md.split('\n').filter((l) => l.startsWith('- '))
    .map((l) => `<li>${l.slice(2)}</li>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Project Index</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem}</style>
</head><body><h1>Project Index</h1><ul>\n${items}\n</ul></body></html>\n`;
}

function main(argv) {
  let config;
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--config') config = argv[++i];
  const cfg = loadConfig({ cwd: process.cwd(), path: config });
  const model = buildIndexModel({ cwd: process.cwd(), cfg });
  const out = cfg.index.output;
  const content = extname(out) === '.html' ? renderIndexHtml(model) : renderIndexMarkdown(model);
  writeFile(join(process.cwd(), out), content);
  process.stderr.write(`wrote ${out}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/chronicle && node --test test/index-render.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite to confirm everything is green**

Run: `cd ~/chronicle && npm test`
Expected: All test files pass (config, md, fsutil, adr-index, changelog-parse, release-notes, devlog-render, index-render).

- [ ] **Step 6: Commit**

```bash
cd ~/chronicle
git add scripts/index-render.mjs test/index-render.test.mjs
git commit -m "feat: index-render helper — single navigation hub (md/html)"
```

---

## Task 11: Templates

**Files:**
- Create: `templates/chronicle.config.json`
- Create: `templates/adr-template.md`

- [ ] **Step 1: Create templates/chronicle.config.json**

```json
{
  "adr": {
    "dir": "docs/adr",
    "format": "nygard",
    "numberWidth": 4,
    "indexFile": "docs/adr/README.md"
  },
  "changelog": {
    "path": "CHANGELOG.md",
    "format": "keepachangelog"
  },
  "devlog": {
    "dir": "docs/devlog",
    "format": "html",
    "sections": ["Summary", "Changes", "Decisions", "Next"]
  },
  "index": {
    "output": "docs/INDEX.html",
    "sources": ["adr", "changelog", "releases"]
  },
  "release": {
    "provider": "github",
    "tagPrefix": "v",
    "readmeTable": true
  }
}
```

- [ ] **Step 2: Create templates/adr-template.md**

```markdown
---
status: Proposed
date: {{DATE}}
---

# {{NUMBER}}. {{TITLE}}

## Status

Proposed

## Context

What is the issue we're addressing? What forces are at play?

## Decision

What is the change we're making?

## Consequences

What becomes easier or harder as a result?
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add templates/
git commit -m "feat: config and ADR templates"
```

---

## Task 12: adr skill + command

**Files:**
- Create: `skills/adr/SKILL.md`
- Create: `commands/adr.md`

- [ ] **Step 1: Create skills/adr/SKILL.md**

````markdown
---
name: adr
description: Use when recording, updating, or indexing an Architecture Decision Record (ADR) — creating a new decision, transitioning status (Proposed/Accepted/Deprecated/Superseded), or regenerating the ADR index. Adapts to any project via chronicle.config.json with auto-detection.
---

# ADR Workflow

Record and manage Architecture Decision Records.

## Resolve configuration first

Run the index helper in read mode to learn the ADR directory and current records:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/adr-index.mjs"
```

This prints the current index table (using `chronicle.config.json` if present, else auto-detected `docs/adr` / `adr/`). The next ADR number is `max(existing) + 1`.

## Create a new ADR

1. Determine the next number from the index output above.
2. Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/adr-template.md`.
3. Fill `{{NUMBER}}`, `{{TITLE}}`, `{{DATE}}` (today, from the user/environment — never guess a random date).
4. Write to `<adr.dir>/<NNNN>-<kebab-title>.md` (zero-padded to `numberWidth`).
5. Regenerate the index:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/adr-index.mjs" --write
```

## Transition status

Edit the ADR's frontmatter `status:` (and the `## Status` section) to one of: Proposed, Accepted, Deprecated, Superseded, Rejected. When superseding, add `Superseded by ADR-NNNN` and link both directions. Then re-run `adr-index.mjs --write`.

## Rules

- Numbers only increase; never reuse or renumber.
- One decision per ADR.
- Write the ADR *before* or *as* the decision is made, not long after.
- Always regenerate the index after any change.
````

- [ ] **Step 2: Create commands/adr.md**

```markdown
---
description: Create or update an Architecture Decision Record and regenerate the index.
---

Use the `adr` skill to handle this ADR task: $ARGUMENTS

If no argument is given, ask whether the user wants to (a) create a new ADR, (b) change an ADR's status, or (c) just regenerate the index.
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/adr/ commands/adr.md
git commit -m "feat: adr skill and slash command"
```

---

## Task 13: changelog skill + command

**Files:**
- Create: `skills/changelog/SKILL.md`
- Create: `commands/changelog.md`

- [ ] **Step 1: Create skills/changelog/SKILL.md**

````markdown
---
name: changelog
description: Use when adding a changelog entry or promoting unreleased changes into a version — manages a Keep a Changelog formatted CHANGELOG.md. Adapts to any project via chronicle.config.json with auto-detection.
---

# Changelog Workflow

Maintain a [Keep a Changelog](https://keepachangelog.com/) formatted file.

## Add an entry

Pick the correct type — one of: Added, Changed, Deprecated, Removed, Fixed, Security.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/changelog-parse.mjs" add --type Added --text "Describe the change in one line"
```

This inserts the line under `## [Unreleased] > ### <Type>`, creating the file or subsection if needed.

## Promote a version (at release time)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/changelog-parse.mjs" release --version 1.2.0 --date 2026-05-31
```

This moves everything under `[Unreleased]` into a new `## [1.2.0] - 2026-05-31` section and leaves a fresh empty `[Unreleased]` on top.

## Rules

- One entry = one user-facing line. Write for humans, not commit hashes.
- Use today's real date for `--date` (never guess).
- Run this *before* tagging a release so the `release` skill can read the new section.
````

- [ ] **Step 2: Create commands/changelog.md**

```markdown
---
description: Add a changelog entry or promote unreleased changes into a version.
---

Use the `changelog` skill for this request: $ARGUMENTS

If no argument is given, ask whether to add an entry (and of which type) or promote a version.
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/changelog/ commands/changelog.md
git commit -m "feat: changelog skill and slash command"
```

---

## Task 14: release skill + command

**Files:**
- Create: `skills/release/SKILL.md`
- Create: `commands/release.md`

- [ ] **Step 1: Create skills/release/SKILL.md**

````markdown
---
name: release
description: Use when cutting a release — promotes the changelog, synthesizes rich release notes from CHANGELOG/ADRs/commits, tags the release, and optionally publishes a GitHub release. Adapts to any project via chronicle.config.json.
---

# Release Workflow

Cut a release end to end.

## 1. Promote the changelog

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/changelog-parse.mjs" release --version <X.Y.Z> --date <today>
```

## 2. Gather context for notes

Find the previous tag and the commits/ADRs since then:

```bash
PREV=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
COMMITS=$( [ -n "$PREV" ] && git log "$PREV"..HEAD --pretty=format:'%s' || git log --pretty=format:'%s' )
```

Collect new ADRs by diffing the ADR directory since `$PREV` (use `git diff --name-only --diff-filter=A "$PREV"..HEAD -- <adr.dir>`). Build a JSON object `{ "adrs": [{number,title,file}], "commits": ["..."] }`.

## 3. Synthesize notes

Pipe the JSON into the helper:

```bash
echo "$JSON" | node "${CLAUDE_PLUGIN_ROOT}/scripts/release-notes.mjs" --version <X.Y.Z>
```

This writes `RELEASE_NOTES.md` and prints the notes. The notes combine the changelog section for this version, new ADRs, and a collapsed commit list.

## 4. Tag and publish

```bash
git tag <tagPrefix><X.Y.Z>     # tagPrefix from config, default "v"
```

If `gh` is installed and a remote exists, publish:

```bash
gh release create <tagPrefix><X.Y.Z> --notes-file RELEASE_NOTES.md
```

If `gh` is unavailable, stop here and tell the user the notes are in `RELEASE_NOTES.md` for manual upload.

## Rules

- Never tag before the changelog is promoted (step 1 must precede step 4).
- `gh` is optional — degrade gracefully to the notes file.
- Use the real version and date; confirm the version bump with the user if ambiguous.
````

- [ ] **Step 2: Create commands/release.md**

```markdown
---
description: Cut a release — promote changelog, synthesize notes, tag, and optionally publish.
---

Use the `release` skill to cut this release: $ARGUMENTS

If no version is given, infer the next semver from the latest tag and the unreleased changelog entries, then confirm with the user before tagging.
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/release/ commands/release.md
git commit -m "feat: release skill and slash command"
```

---

## Task 15: devlog skill + command

**Files:**
- Create: `skills/devlog/SKILL.md`
- Create: `commands/devlog.md`

- [ ] **Step 1: Create skills/devlog/SKILL.md**

````markdown
---
name: devlog
description: Use when writing a development session log — summarizes the current session into a dated, self-contained HTML page and updates the devlog index. Adapts to any project via chronicle.config.json.
---

# Devlog Workflow

Capture a development session as a dated HTML log.

## Gather the session

Summarize what happened this session into the configured sections (default: Summary, Changes, Decisions, Next). Each section's content must be a **fragment of valid HTML** (e.g. `<p>...</p>`, `<ul><li>...</li></ul>`).

Build a JSON object:

```json
{
  "title": "Short session title",
  "sections": [
    { "heading": "Summary", "html": "<p>...</p>" },
    { "heading": "Changes", "html": "<ul><li>...</li></ul>" }
  ]
}
```

## Render

Pipe the JSON into the helper with today's date:

```bash
echo "$JSON" | node "${CLAUDE_PLUGIN_ROOT}/scripts/devlog-render.mjs" --date <today>
```

The helper writes `<devlog.dir>/YYYY-MM-DD.html` (sequencing `-2`, `-3` on repeat calls the same day — it never overwrites) and rebuilds `index.html`.

## Rules

- Use today's real date (never guess).
- Repeat calls the same day create new sequenced files; do not overwrite prior logs.
- Keep HTML fragments self-contained — no external scripts or stylesheets.
````

- [ ] **Step 2: Create commands/devlog.md**

```markdown
---
description: Write a dated development session log as self-contained HTML.
---

Use the `devlog` skill to log this session: $ARGUMENTS

Summarize the work done in this session into the configured sections, then render it for today's date.
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/devlog/ commands/devlog.md
git commit -m "feat: devlog skill and slash command"
```

---

## Task 16: index skill + command

**Files:**
- Create: `skills/index/SKILL.md`
- Create: `commands/index.md`

- [ ] **Step 1: Create skills/index/SKILL.md**

````markdown
---
name: index
description: Use when generating or refreshing a project's single navigation hub — an INDEX that links ADRs, the changelog, and releases. Adapts to any project via chronicle.config.json.
---

# Index Workflow

Generate a single entry-point index for the project.

## Generate

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-render.mjs"
```

This reads the configured `index.sources` (default: adr, changelog, releases), counts ADRs, checks for the changelog, and writes `index.output`. The format follows the output file extension — `.md` produces markdown, `.html` produces a self-contained page.

## Rules

- Re-run after adding ADRs, cutting releases, or restructuring docs.
- Configure `index.sources` and `index.output` in `chronicle.config.json` to control scope and format.
````

- [ ] **Step 2: Create commands/index.md**

```markdown
---
description: Generate or refresh the project's single navigation index.
---

Use the `index` skill to regenerate the project index: $ARGUMENTS
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/index/ commands/index.md
git commit -m "feat: index skill and slash command"
```

---

## Task 17: claude-md skill + command

**Files:**
- Create: `skills/claude-md/SKILL.md`
- Create: `commands/claude-md.md`

- [ ] **Step 1: Create skills/claude-md/SKILL.md**

````markdown
---
name: claude-md
description: Use when maintaining (not initially creating) a CLAUDE.md — keeping it in sync with architecture, conventions, and commands as the project evolves, and pruning it so it stays focused. Complements the built-in /init.
---

# CLAUDE.md Maintenance Workflow

Keep an existing `CLAUDE.md` accurate and lean. This is for ongoing upkeep — use the built-in `/init` for first creation.

## Process

1. Read the current `CLAUDE.md`.
2. Compare against reality: recent commits, changed build commands, new/removed modules, updated conventions, new architecture decisions (check the ADR directory).
3. Update **only the affected sections**. Do not rewrite untouched sections.
4. Prune: remove stale instructions, merge duplicates, and keep each section tight. If a section has grown long, tighten it rather than letting it sprawl.
5. Preserve the user's voice and structure — you are maintaining their file, not replacing it.

## What to check for drift

- Build / test / lint commands that changed
- Module or directory structure changes
- New conventions or rules the team adopted
- Architecture decisions recorded as ADRs that belong in the high-level guidance
- Anything now contradicted by the actual codebase

## Rules

- Never blow away existing content wholesale — edit surgically.
- Keep it scannable; CLAUDE.md is loaded into every session, so brevity matters.
- If something is already obvious from the code or another doc, don't duplicate it here.
````

- [ ] **Step 2: Create commands/claude-md.md**

```markdown
---
description: Maintain and refresh CLAUDE.md to match the current project state.
---

Use the `claude-md` skill to update CLAUDE.md: $ARGUMENTS

Detect drift between CLAUDE.md and the current codebase, then surgically update the affected sections.
```

- [ ] **Step 3: Commit**

```bash
cd ~/chronicle
git add skills/claude-md/ commands/claude-md.md
git commit -m "feat: claude-md maintenance skill and slash command"
```

---

## Task 18: README, CHANGELOG (dogfooding), final validation

**Files:**
- Create: `README.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create CHANGELOG.md (chronicle dogfoods itself)**

```markdown
# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial release: 6 skills (adr, changelog, release, devlog, index, claude-md) with zero-dependency Node helpers.
- Plugin and marketplace manifests for `/plugin install`.
- `chronicle.config.json` with auto-detection fallback.
```

- [ ] **Step 2: Create README.md**

````markdown
# 📜 chronicle

> A Claude Code plugin that automates your project's **documentation lifecycle** — decisions, changes, releases, logs, and navigation — as six focused skills.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-7c3aed.svg)](https://code.claude.com/docs/en/plugins)

chronicle turns the documentation chores you keep forgetting — writing ADRs, updating the changelog, cutting releases, keeping a devlog, maintaining a project index and `CLAUDE.md` — into one-line workflows. Every workflow adapts to *your* project layout via a small optional config (with sensible auto-detection), and the deterministic parts run as zero-dependency Node scripts so they're fast and consistent.

## Install

```text
/plugin marketplace add sp-daewoon/chronicle
/plugin install chronicle@chronicle
```

Requires Node.js 18+ on your PATH. That's the only dependency.

## Skills

| Skill | Slash command | What it does |
| --- | --- | --- |
| **adr** | `/chronicle:adr` | Create/transition Architecture Decision Records, auto-number, regenerate the index |
| **changelog** | `/chronicle:changelog` | Add Keep a Changelog entries; promote `[Unreleased]` into a version |
| **release** | `/chronicle:release` | Promote changelog, synthesize notes from CHANGELOG/ADRs/commits, tag, optionally publish via `gh` |
| **devlog** | `/chronicle:devlog` | Write a dated, self-contained HTML session log + index |
| **index** | `/chronicle:index` | Generate a single navigation hub linking ADRs, changelog, releases |
| **claude-md** | `/chronicle:claude-md` | Keep `CLAUDE.md` in sync with the codebase and lean |

## Usage

Record a decision:

```text
/chronicle:adr Use PostgreSQL for the primary datastore
```

Log a change:

```text
/chronicle:changelog Added dark mode toggle
```

Cut a release:

```text
/chronicle:release 1.2.0
```

Each skill also works conversationally — just describe what you want ("write up today's devlog", "regenerate the project index").

## Configuration

chronicle works with **zero configuration** — it auto-detects common locations (`docs/adr`, `CHANGELOG.md`, `docs/devlog`). To customize, drop a `chronicle.config.json` in your project root:

```json
{
  "adr":       { "dir": "docs/adr", "numberWidth": 4, "indexFile": "docs/adr/README.md" },
  "changelog": { "path": "CHANGELOG.md", "format": "keepachangelog" },
  "devlog":    { "dir": "docs/devlog", "sections": ["Summary", "Changes", "Decisions", "Next"] },
  "index":     { "output": "docs/INDEX.html", "sources": ["adr", "changelog", "releases"] },
  "release":   { "provider": "github", "tagPrefix": "v", "readmeTable": true }
}
```

A starter template lives at `templates/chronicle.config.json`.

## How it's built

- **Skills** (`skills/*/SKILL.md`) are LLM instructions; deterministic work is delegated to **Node helpers** (`scripts/*.mjs`) called via `${CLAUDE_PLUGIN_ROOT}`.
- Helpers use only Node 18+ built-ins — **no npm dependencies**.
- The repo is also its own marketplace (`.claude-plugin/marketplace.json`).

Run the helper tests:

```bash
npm test
```

## Discoverability (skillsmp.com)

[skillsmp.com](https://skillsmp.com) indexes public skills automatically by scraping GitHub — there's no submission form. A repo appears once it's public, uses the standard `SKILL.md` format (which chronicle does), and has **at least 2 stars**. If chronicle is useful to you, a ⭐ helps others find it.

## Contributing

Issues and PRs welcome. Each skill is independent; helpers are pure and unit-tested. Please run `npm test` and `claude plugin validate .` before opening a PR.

## License

[MIT](LICENSE) © sp-daewoon
````

- [ ] **Step 3: Validate the plugin and run the full test suite**

Run: `cd ~/chronicle && npm test`
Expected: all suites PASS.

Run: `cd ~/chronicle && claude plugin validate . 2>&1 || echo "validate command unavailable — verify manifests manually"`
Expected: validation passes, or (if the CLI subcommand isn't available in this environment) the manifests parse as valid JSON (already checked in Task 2).

- [ ] **Step 4: Commit**

```bash
cd ~/chronicle
git add README.md CHANGELOG.md
git commit -m "docs: README and CHANGELOG (dogfooding)"
```

---

## Task 19: Local install smoke test

**Files:** none (verification only)

- [ ] **Step 1: Add the local marketplace**

In a Claude Code session (or note for the user to run):

```text
/plugin marketplace add ~/chronicle
/plugin install chronicle@chronicle
```

Expected: chronicle installs; `/chronicle:adr`, `/chronicle:changelog`, `/chronicle:release`, `/chronicle:devlog`, `/chronicle:index`, `/chronicle:claude-md` appear.

- [ ] **Step 2: Smoke each helper directly against a throwaway dir**

```bash
cd $(mktemp -d)
node ~/chronicle/scripts/adr-index.mjs          # prints empty index table header
node ~/chronicle/scripts/changelog-parse.mjs add --type Added --text "hello" && cat CHANGELOG.md
node ~/chronicle/scripts/index-render.mjs && cat docs/INDEX.html
echo '{"title":"t","sections":[{"heading":"Summary","html":"<p>hi</p>"}]}' | node ~/chronicle/scripts/devlog-render.mjs --date 2026-05-31 && ls docs/devlog
```

Expected: each command produces the documented output with no stack traces.

- [ ] **Step 3: Document the smoke result** in a final note to the user. No commit needed.

---

## Task 20: Publish to GitHub

**Files:** none (publishing)

- [ ] **Step 1: Create the public repo and push**

```bash
cd ~/chronicle
gh repo create sp-daewoon/chronicle --public --source=. --remote=origin \
  --description "Automate your project's documentation lifecycle in Claude Code — ADR, CHANGELOG, releases, devlog, index, and CLAUDE.md as 6 skills." --push
```

If `gh` is not authenticated, instruct the user to run `gh auth login` (via `! gh auth login` in the session) first.

- [ ] **Step 2: Verify**

```bash
cd ~/chronicle
git remote -v
gh repo view sp-daewoon/chronicle --web
```

Expected: repo exists, all commits pushed, README renders.

- [ ] **Step 3: Tell the user the install command and the skillsmp ⭐ requirement.**

---

## Self-Review

**Spec coverage:**
- §3 repo structure → Tasks 1–18 create every listed path. ✓
- §4 config injection + auto-detect → Task 3 (config.mjs). ✓
- §5 six skills → Tasks 12–17. ✓
- §6 helper principles (Node native, no deps, `${CLAUDE_PLUGIN_ROOT}`, `gh` optional) → package.json `dependencies:{}` (Task 1), helpers (Tasks 6–10), release `gh` fallback (Task 14). ✓
- §7 install/marketplace → Task 2 manifests + Task 19/20. ✓
- §8 skillsmp → README section (Task 18). ✓
- §9 README structure → Task 18. ✓
- §12 verification → `node --test` per helper + Task 19 smoke + `claude plugin validate`. ✓

**Placeholder scan:** No TBD/TODO. The only `{{...}}` tokens are inside `templates/adr-template.md`, which are intentional template placeholders filled at runtime by the adr skill — not plan gaps. ✓

**Type/name consistency:**
- `loadConfig({cwd, path})` defined in Task 3, called consistently in Tasks 6–10. ✓
- `buildAdrIndex({cwd, cfg})` defined in Task 6, reused in Task 10's `buildIndexModel`. ✓
- `replaceAnchored(content, start, end, replacement)` defined in Task 5, used in Tasks 6 and 9. ✓
- Anchor markers: `chronicle:adr-index`, `chronicle:devlog-list`, `chronicle:releases` — each used consistently within its file. ✓
- Config keys (`adr.dir`, `adr.numberWidth`, `adr.indexFile`, `changelog.path`, `devlog.dir`, `index.output`, `index.sources`, `release.tagPrefix`, `release.provider`) match between DEFAULTS (Task 3), templates (Task 11), helpers, and README. ✓
- `EMPTY`, `addEntry`, `promote` (Task 7); `sectionFor`, `composeNotes` (Task 8); `nextDevlogPath`, `renderDevlogHtml` (Task 9); `buildIndexModel`, `renderIndexMarkdown` (Task 10) — all exported names match their tests. ✓

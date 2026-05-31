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

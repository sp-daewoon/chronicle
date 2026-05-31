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
  let data = {};
  try {
    const stdin = readIfExists('/dev/stdin');
    if (stdin && stdin.trim()) data = JSON.parse(stdin);
  } catch { /* no stdin or invalid JSON — fall back to empty */ }
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

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

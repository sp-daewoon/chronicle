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

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

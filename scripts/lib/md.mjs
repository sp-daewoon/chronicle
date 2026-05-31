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

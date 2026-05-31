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

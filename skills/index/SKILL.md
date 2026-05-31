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

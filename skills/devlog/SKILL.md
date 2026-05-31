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

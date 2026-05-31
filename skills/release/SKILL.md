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

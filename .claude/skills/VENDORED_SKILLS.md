# Vendored skills

The following skill directories under `.claude/skills/` are **vendored
copies** of upstream third-party skills, not skills authored by the
Monitrax team. They are committed to this repo because Claude Code on
the web (cloud containers) scans `.claude/skills/` at session boot,
**before** any SessionStart hook completes — meaning skills installed
by a hook are invisible to the session that triggered the install
(verified 2026-05-25 in PR #888 follow-up). Vendoring puts the SKILL.md
files in the freshly cloned repo at scan time, eliminating the race.

## Vendored from `google-labs-code/stitch-skills`

Source: <https://github.com/google-labs-code/stitch-skills>
License: Apache License, Version 2.0
Vendored: 2026-05-25 (commit-pinning TBD by `skills-lock.json` upstream)

Directories:

- `design-md/`
- `enhance-prompt/`
- `react-components/`
- `remotion/`
- `shadcn-ui/`
- `stitch-code-to-design/`
- `stitch-extract-design-md/`
- `stitch-extract-static-html/`
- `stitch-generate-design/`
- `stitch-loop/`
- `stitch-manage-design-system/`
- `stitch-upload-to-stitch/`
- `taste-design/`

These directories are **unmodified copies** from upstream. Do not
edit them in-place. To update, run:

```bash
# Refresh upstream into ~/.agents/skills/
npx --yes skills add google-labs-code/stitch-skills --global --all

# Sync into project (overwrite vendored copies)
cp -rL ~/.agents/skills/{design-md,enhance-prompt,react-components,remotion,shadcn-ui,stitch-code-to-design,stitch-extract-design-md,stitch-extract-static-html,stitch-generate-design,stitch-loop,stitch-manage-design-system,stitch-upload-to-stitch,taste-design} .claude/skills/

# Commit the refresh
git add .claude/skills/ && git commit -m "chore(skills): refresh vendored stitch-skills from upstream"
```

## Monitrax-authored skills (not vendored)

The following directories under `.claude/skills/` are authored
specifically for this project and are NOT vendored from upstream:

- `architect-mode/`
- `pr-prep-checklist/`

These are governed by CLAUDE.md §0.4 and §16 respectively. Edit
in-place as normal Monitrax docs.

## Prerequisite

The Stitch-specific skills (`stitch-*`, `taste-design`, `design-md`,
`enhance-prompt`) require the Stitch MCP server to be registered.
The SessionStart hook at `.claude/hooks/session-start.sh` handles
this in cloud sessions when `$STITCH_API_KEY` is set.

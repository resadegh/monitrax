#!/bin/bash
# Session-start bootstrap for Claude Code on the web (cloud containers
# that are ephemeral and lose ~/.claude state on reclaim):
#   1. Registers the Stitch MCP server (needs $STITCH_API_KEY).
#   2. Installs google-labs-code/stitch-skills via `npx skills add` so
#      the cloud session sees /stitch-generate-design, /react-components,
#      /shadcn-ui, /remotion, /taste-design, etc. in its available-skills
#      list. The skills CLI symlinks SKILL.md files into ~/.claude/skills/,
#      which is the path the web sandbox scans for skill discovery (the
#      "plugins" CLI is for the local Claude Code CLI only and is ignored
#      in the web sandbox).
#
# All steps are idempotent and skip-on-failure: a missing API key or
# a network blip never blocks the session from starting.

set -euo pipefail

# Only run in remote environments. Locally, the user manages this themselves.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── 1. Stitch MCP registration ────────────────────────────────────────────
if [ -z "${STITCH_API_KEY:-}" ]; then
  echo "[session-start] STITCH_API_KEY not set — skipping Stitch MCP registration." >&2
  echo "  Set it in Claude Code on the web → environment variables to enable." >&2
elif claude mcp list 2>/dev/null | grep -q '^stitch:'; then
  : # already registered (session resume)
else
  claude mcp add stitch \
    --transport http \
    https://stitch.googleapis.com/mcp \
    --header "X-Goog-Api-Key: ${STITCH_API_KEY}" \
    >/dev/null 2>&1 \
    && echo "[session-start] Stitch MCP registered." >&2 \
    || echo "[session-start] Stitch MCP registration failed." >&2
fi

# ── 2. Stitch skills (google-labs-code/stitch-skills) ─────────────────────
# Uses `npx skills add` (NOT `npx plugins add`). The "skills" CLI writes
# real SKILL.md files to ~/.agents/skills/<name>/ and symlinks them into
# ~/.claude/skills/<name>/ — the path Claude Code on the web's
# skill-discovery actually scans. The earlier `plugins add` approach only
# populated ~/.claude/plugins/cache/ + the enabledPlugins registry, which
# the web sandbox does not read, so the /stitch-* commands never appeared.
# --global = user scope (works for all projects). --all = every skill,
# every agent target.
if [ ! -L "$HOME/.claude/skills/stitch-generate-design" ]; then
  npx --yes skills add google-labs-code/stitch-skills --global --all >/dev/null 2>&1 \
    && echo "[session-start] Stitch skills installed (user-global, all agents)." >&2 \
    || echo "[session-start] Stitch skills install failed (non-fatal)." >&2
fi

exit 0

#!/bin/bash
# Session-start bootstrap for Claude Code on the web (cloud containers
# that are ephemeral and lose ~/.claude state on reclaim).
#
# Single responsibility now: register the Stitch MCP server with
# the running session if $STITCH_API_KEY is provided.
#
# History note (skills): earlier revisions of this hook ran
# `npx skills add google-labs-code/stitch-skills --global --all` here
# to bootstrap the Stitch skill suite. That step has been removed
# because the cloud session's skill-discovery scan runs BEFORE the
# SessionStart hook completes — so the npx install (10-30s) finished
# too late to be visible to the session that triggered it, and the
# next session was a fresh cold container that hit the same race.
# Skills are now vendored under `.claude/skills/` directly so they
# are present at clone time. See `.claude/skills/VENDORED_SKILLS.md`.
#
# Step is idempotent and skip-on-failure: a missing API key or
# network blip never blocks the session from starting.

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

exit 0

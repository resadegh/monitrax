#!/bin/bash
# Session-start bootstrap for Claude Code on the web (cloud containers
# that are ephemeral and lose ~/.claude state on reclaim).
#
# Responsibilities:
#   1. Register the Stitch MCP server with the running session.
#   2. Continuity bootstrap: surface STATE.md + live HEAD so every session
#      starts oriented from the repo, not from memory.
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
# Every step is idempotent and skip-on-failure: a missing API key, a
# network blip, or a missing file never blocks the session from starting.

set -euo pipefail

# Only run in remote environments. Locally, the user manages this themselves.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── 1. Stitch MCP registration ───────────────────────────────────
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

# ── 2. Continuity bootstrap (read-first orientation) ──────────────────
# Skip-on-failure: must NEVER block the session (same contract as Stitch above).
# Prints the STATE.md cursor + live HEAD so the session starts from the repo,
# not from memory. STATE.md is the single read-first anchor (see project docs).
{
  REPO_ROOT="${CLAUDE_PROJECT_DIR:-.}"
  HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  echo "[session-start] HEAD: ${HEAD_SHA} · $(date -u +%Y-%m-%dT%H:%MZ)" >&2
  if [ -f "${REPO_ROOT}/STATE.md" ]; then
    echo "[session-start] ── STATE.md — read this before any work ──" >&2
    sed -n '1,60p' "${REPO_ROOT}/STATE.md" >&2
    echo "[session-start] ── (read full STATE.md, then CLAUDE.md, then the IMPLEMENTATION_PLAN section for your task) ──" >&2
  else
    echo "[session-start] STATE.md not found — read CLAUDE.md + docs/IMPLEMENTATION_PLAN.md directly and flag that the continuity anchor needs landing." >&2
  fi
} || true

exit 0

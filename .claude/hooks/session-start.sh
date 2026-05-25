#!/bin/bash
# Session-start bootstrap for Claude Code on the web (cloud containers
# that are ephemeral and lose ~/.claude state on reclaim):
#   1. Registers the Stitch MCP server (needs $STITCH_API_KEY).
#   2. Installs the google-labs-code/stitch-skills plugins so the
#      /stitch-design:*, /stitch-build:*, /stitch-utilities:* slash
#      commands are available. The repo's .claude/settings.json
#      already declares the marketplace + enabledPlugins, but the
#      plugin payload still has to land in ~/.claude/plugins/cache/
#      on each cold container — that's what step 2 does.
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

# ── 2. Stitch skills plugins (google-labs-code/stitch-skills) ─────────────
STITCH_PLUGIN_CACHE="$HOME/.claude/plugins/cache/google-labs-code-stitch-skills"
if [ ! -d "$STITCH_PLUGIN_CACHE" ]; then
  npx --yes plugins add google-labs-code/stitch-skills \
      --scope project --target claude-code >/dev/null 2>&1 \
    && echo "[session-start] Stitch skills installed." >&2 \
    || echo "[session-start] Stitch skills install failed (non-fatal)." >&2
fi

exit 0

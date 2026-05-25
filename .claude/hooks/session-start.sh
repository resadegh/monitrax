#!/bin/bash
# Registers the Stitch MCP server with Claude Code at session start.
# Only runs in remote (Claude Code on the web) containers, which are
# ephemeral and lose ~/.claude.json on reclaim.
#
# Reads the API key from $STITCH_API_KEY (configured via Claude Code on
# the web environment variables). The key is NEVER committed to git.
#
# Idempotent: skips registration if `stitch` is already in the MCP list.

set -euo pipefail

# Only run in remote environments. Locally, the user manages MCPs themselves.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if [ -z "${STITCH_API_KEY:-}" ]; then
  echo "[session-start] STITCH_API_KEY not set — skipping Stitch MCP registration." >&2
  echo "  Set it in Claude Code on the web → environment variables to enable." >&2
  exit 0
fi

# Skip if already registered (e.g. on session resume).
if claude mcp list 2>/dev/null | grep -q '^stitch:'; then
  exit 0
fi

claude mcp add stitch \
  --transport http \
  https://stitch.googleapis.com/mcp \
  --header "X-Goog-Api-Key: ${STITCH_API_KEY}" \
  >/dev/null 2>&1 \
  && echo "[session-start] Stitch MCP registered." >&2 \
  || echo "[session-start] Stitch MCP registration failed." >&2

exit 0

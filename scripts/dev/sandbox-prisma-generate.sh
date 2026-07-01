#!/usr/bin/env bash
#
# sandbox-prisma-generate.sh — generate the Prisma client inside a Claude Code
# Web cloud sandbox, where `npx prisma generate` fails on its own.
#
# WHY THIS EXISTS (2026-07-01):
#   `prisma generate` makes two outbound calls that the sandbox's agent proxy
#   resets, so a plain `prisma generate` dies with ECONNRESET and no client is
#   generated (every test importing a Prisma-touching module then fails to load
#   `.prisma/client/default`):
#     1. A telemetry "checkpoint" ping to checkpoint.prisma.io  → CHECKPOINT_DISABLE=1.
#     2. A download of the schema-engine binary from binaries.prisma.sh — and
#        Prisma's Node downloader (node-fetch) does NOT honor HTTPS_PROXY, so it
#        connects directly and the proxy resets it. `curl` DOES honor the proxy +
#        CA bundle, so we fetch the binary with curl and point Prisma at the
#        local file (PRISMA_SCHEMA_ENGINE_BINARY). The query engine is already
#        bundled in @prisma/engines (PRISMA_QUERY_ENGINE_LIBRARY).
#
# This is the real fix (not the vi.mock('@/lib/db') test workaround): after
# running it, `@prisma/client` resolves to a real generated client and the full
# vitest suite runs locally exactly as it does in CI.
#
# Usage:  bash scripts/dev/sandbox-prisma-generate.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

ENGINE_HASH="$(node -e 'console.log(require("@prisma/engines-version").enginesVersion)' 2>/dev/null || true)"
if [ -z "${ENGINE_HASH:-}" ]; then
  # Fall back to whatever hash the cache already has (the CLI pins one hash).
  ENGINE_HASH="$(ls ~/.cache/prisma/master 2>/dev/null | head -1 || true)"
fi
PLATFORM="debian-openssl-3.0.x"
CACHE_DIR="$HOME/.cache/prisma/master/$ENGINE_HASH/$PLATFORM"
SCHEMA_ENGINE="$CACHE_DIR/schema-engine"
QUERY_ENGINE="$(find node_modules -name 'libquery_engine-'"$PLATFORM"'.so.node' 2>/dev/null | head -1)"

if [ -z "${ENGINE_HASH:-}" ]; then
  echo "!! Could not determine the Prisma engine hash. Is @prisma/engines installed?" >&2
  exit 1
fi

# 1. Fetch the schema-engine via curl (proxy-aware) if it isn't already present.
if [ ! -x "$SCHEMA_ENGINE" ]; then
  echo ">> schema-engine missing — fetching via curl (proxy-aware) ..."
  mkdir -p "$CACHE_DIR"
  curl -fsSL "https://binaries.prisma.sh/all_commits/$ENGINE_HASH/$PLATFORM/schema-engine.gz" -o /tmp/prisma-schema-engine.gz
  gunzip -c /tmp/prisma-schema-engine.gz > "$SCHEMA_ENGINE"
  chmod +x "$SCHEMA_ENGINE"
  echo ">> placed $SCHEMA_ENGINE"
fi

# 2. Generate against the local binaries, telemetry disabled — no network.
echo ">> generating Prisma client (local engines, no download) ..."
CHECKPOINT_DISABLE=1 \
PRISMA_HIDE_UPDATE_MESSAGE=1 \
PRISMA_SCHEMA_ENGINE_BINARY="$SCHEMA_ENGINE" \
PRISMA_QUERY_ENGINE_LIBRARY="$QUERY_ENGINE" \
  npx prisma generate

echo ">> done — @prisma/client is generated; vitest can now load DB-touching modules."

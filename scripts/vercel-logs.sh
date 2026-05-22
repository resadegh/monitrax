#!/usr/bin/env bash
#
# scripts/vercel-logs.sh — read Vercel deployment + runtime logs from inside
# a Claude Code Web cloud sandbox session.
#
# Why this exists: the official Vercel MCP server (`https://mcp.vercel.com`)
# uses an OAuth flow that fails from Claude Code Web sandboxes because the
# sandbox host is not in Vercel's OAuth allowlist (returns 403 "Host not in
# allowlist"). Direct REST API access with a personal Bearer token has no
# such restriction — works from any host that can reach `api.vercel.com`.
#
# See: docs/operational/runbooks/12_CLAUDE_CODE_MCP_SETUP.md "REST API path"
#      docs/changelog/CHANGELOG_2026_05_20.md (the firefight that drove this)
#
# Requires:
#   - VERCEL_TOKEN env var (Bearer token, scoped to monitrax project, read-only)
#   - jq (for JSON parsing; available by default in the Claude Code sandbox)
#
# Optional:
#   - VERCEL_TEAM_ID env var (for team-scoped projects; auto-detected via
#     project lookup if unset)
#   - VERCEL_PROJECT env var (defaults to "monitrax")
#
# Usage:
#   ./scripts/vercel-logs.sh list                      List recent deployments
#   ./scripts/vercel-logs.sh build <deploymentIdOrUrl> Build events for a deployment
#   ./scripts/vercel-logs.sh runtime <deploymentId>    Runtime logs for a deployment
#   ./scripts/vercel-logs.sh latest-runtime            Runtime logs for the latest prod deploy
#   ./scripts/vercel-logs.sh project                   Project metadata (sanity-check token)

set -euo pipefail

PROJECT_NAME="${VERCEL_PROJECT:-monitrax}"
VERCEL_API="https://api.vercel.com"

cmd="${1:-}"

# Help works without the token — every other command needs it.
case "$cmd" in
  ""|help|--help|-h)
    grep -E '^# ' "$0" | sed 's/^# //' | head -40
    exit 0
    ;;
esac

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  cat >&2 <<EOF
Error: VERCEL_TOKEN env var not set.

For Claude Code Web sessions, provision via:
  claude.ai/code → Default (cloud env) → ⚙️ → Update cloud environment
  → Environment variables → VERCEL_TOKEN=vcp_...

See docs/operational/runbooks/12_CLAUDE_CODE_MCP_SETUP.md §REST API path.
EOF
  exit 1
fi

# Build full URL with optional team scoping. Vercel API endpoints under
# `?teamId=...` operate on team-scoped resources; personal-account
# endpoints don't need it.
#
# An optional leading `--max-time <seconds>` bounds the read — required
# for streaming endpoints (runtime-logs) that hold the connection open.
curl_api() {
  local max_time=""
  if [[ "${1:-}" == "--max-time" ]]; then
    max_time="$2"
    shift 2
  fi
  local path="$1"
  local full_url="$VERCEL_API$path"
  if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
    local sep="?"
    [[ "$path" == *"?"* ]] && sep="&"
    full_url="${full_url}${sep}teamId=${VERCEL_TEAM_ID}"
  fi
  if [[ -n "$max_time" ]]; then
    curl -sS --max-time "$max_time" -H "Authorization: Bearer $VERCEL_TOKEN" "$full_url"
  else
    curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" "$full_url"
  fi
}

# Aligns tab-separated stdin into padded columns. Portable replacement
# for `column -t` — the BSD/util-linux `column` binary is NOT present in
# the Claude Code Web sandbox (only `awk` is). Handles variable column
# counts per row (e.g. the runtime command's single-line "no logs"
# message) and never pads the final column, so long free-text fields
# like log messages don't get trailing whitespace.
align_tsv() {
  awk -F'\t' '
    {
      nf[NR] = NF
      for (i = 1; i <= NF; i++) {
        cell[NR, i] = $i
        if (length($i) > w[i]) w[i] = length($i)
      }
    }
    END {
      for (r = 1; r <= NR; r++) {
        line = ""
        for (i = 1; i <= nf[r]; i++) {
          if (i < nf[r]) line = line sprintf("%-*s  ", w[i], cell[r, i])
          else line = line cell[r, i]
        }
        print line
      }
    }'
}

case "$cmd" in
  list|list-deployments)
    # Most-recent 10 deployments for the project. Status column tells you
    # if a deploy is ERROR / BUILDING / READY / CANCELED.
    {
      printf 'ID\tSTATE\tTARGET\tURL\tCREATED\n'
      curl_api "/v6/deployments?app=${PROJECT_NAME}&limit=10" \
        | jq -r '
            .deployments[] |
            [
              (.uid // "-"),
              (.state // "-"),
              (.target // "preview"),
              (.url // "-"),
              ((.created // 0) | (./1000) | strftime("%Y-%m-%d %H:%M:%S"))
            ] | @tsv'
    } | align_tsv
    ;;

  build)
    deployment="${2:?Usage: $0 build <deploymentIdOrUrl>}"
    # Build/deployment events — most-recent first. The `?direction=backward`
    # gives newest-first; `limit=200` covers most build sizes.
    curl_api "/v3/deployments/${deployment}/events?limit=200&direction=backward" \
      | jq -r '
          .[] |
          select(.text or .info or .payload) |
          [
            ((.created // 0) | (./1000) | strftime("%H:%M:%S")),
            (.type // "?"),
            (.text // .info.text // (.payload.text // .payload | tostring))
          ] | @tsv' \
      | align_tsv
    ;;

  runtime)
    deployment="${2:?Usage: $0 runtime <deploymentId>}"
    # Runtime logs require the project ID (not name). Look it up.
    project_id=$(curl_api "/v9/projects/${PROJECT_NAME}" | jq -r '.id // empty')
    if [[ -z "$project_id" ]]; then
      echo "Error: could not resolve project ID for '${PROJECT_NAME}'. Token scope wrong?" >&2
      exit 2
    fi
    # The runtime-logs endpoint STREAMS NDJSON — one JSON object per line —
    # and holds the connection open waiting for new events; `?limit=200`
    # caps the event count but does NOT close an idle connection. So:
    #   - `--max-time` bounds the read (curl exit 28 on timeout is expected
    #     and benign — `|| true` keeps `set -e` happy; the partial body
    #     received so far is kept);
    #   - each line is one log object, processed DIRECTLY — NOT via `.[]`.
    #     `.[]` on a per-line object iterates its *values*, and the next
    #     `.timestampInMs` on a value-string throws "Cannot index string
    #     with string". The old code only ever returned because that crash
    #     killed the pipe early; on a real NDJSON stream it would hang.
    # Runtime-log retention: Hobby 1h, Pro 1d, Enterprise 3d. An empty
    # window (no recent traffic, or the deploy is too old) is EXPECTED,
    # not an error.
    runtime_raw=$(
      curl_api --max-time 25 \
        "/v1/projects/${project_id}/deployments/${deployment}/runtime-logs?limit=200" || true
    )
    if [[ -z "${runtime_raw//[[:space:]]/}" ]]; then
      echo "(no runtime logs in the retention window — no recent traffic, or the deploy is too old)"
    else
      printf '%s\n' "$runtime_raw" \
        | jq -r '
            select(type == "object") |
            [
              ((.timestampInMs // 0) | (./1000) | strftime("%H:%M:%S")),
              (.level // "?"),
              (.source // "?"),
              (.message // .requestPath // "")
            ] | @tsv' \
        | align_tsv
    fi
    ;;

  latest-runtime)
    # Convenience: jump straight to the latest production deployment's
    # runtime logs. Most common use case during a live firefight.
    latest=$(curl_api "/v6/deployments?app=${PROJECT_NAME}&target=production&limit=1" \
      | jq -r '.deployments[0].uid // empty')
    if [[ -z "$latest" ]]; then
      echo "Error: no production deployments found for '${PROJECT_NAME}'." >&2
      exit 2
    fi
    echo "# latest production deployment: $latest" >&2
    "$0" runtime "$latest"
    ;;

  project)
    # Sanity-check: confirm the token is valid and resolves the project.
    curl_api "/v9/projects/${PROJECT_NAME}" \
      | jq '{id, name, framework, createdAt, latestDeployments: (.latestDeployments // [] | .[0] | {url, state, target})}'
    ;;

  *)
    echo "Unknown command: '$cmd'. Run '$0 help' for usage." >&2
    exit 1
    ;;
esac

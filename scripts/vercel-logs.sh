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
curl_api() {
  local path="$1"
  local full_url="$VERCEL_API$path"
  if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
    local sep="?"
    [[ "$path" == *"?"* ]] && sep="&"
    full_url="${full_url}${sep}teamId=${VERCEL_TEAM_ID}"
  fi
  curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" "$full_url"
}

case "$cmd" in
  list|list-deployments)
    # Most-recent 10 deployments for the project. Status column tells you
    # if a deploy is ERROR / BUILDING / READY / CANCELED.
    curl_api "/v6/deployments?app=${PROJECT_NAME}&limit=10" \
      | jq -r '
          .deployments[] |
          [
            (.uid // "-"),
            (.state // "-"),
            (.target // "preview"),
            (.url // "-"),
            ((.created // 0) | (./1000) | strftime("%Y-%m-%d %H:%M:%S"))
          ] | @tsv' \
      | column -t -s $'\t' \
      | sed '1i\
ID\tSTATE\tTARGET\tURL\tCREATED'
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
      | column -t -s $'\t'
    ;;

  runtime)
    deployment="${2:?Usage: $0 runtime <deploymentId>}"
    # Runtime logs require the project ID (not name). Look it up.
    project_id=$(curl_api "/v9/projects/${PROJECT_NAME}" | jq -r '.id // empty')
    if [[ -z "$project_id" ]]; then
      echo "Error: could not resolve project ID for '${PROJECT_NAME}'. Token scope wrong?" >&2
      exit 2
    fi
    # Runtime-log retention: Hobby 1h, Pro 1d, Enterprise 3d (Observability
    # Plus → 30d). Empty results outside the retention window are EXPECTED,
    # not an error — see community thread linked in the runbook.
    curl_api "/v1/projects/${project_id}/deployments/${deployment}/runtime-logs?limit=200" \
      | jq -r '
          if length == 0 then
            "(no runtime logs in retention window — Pro plan = 1 day; check if the deploy is too old)"
          else
            .[] |
            [
              ((.timestampInMs // 0) | (./1000) | strftime("%H:%M:%S")),
              (.level // "?"),
              (.source // "?"),
              (.message // .requestPath // "")
            ] | @tsv
          end' \
      | column -t -s $'\t'
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

# 12 — Claude Code Vercel Log Access

**Owner:** Reza · **Last reviewed:** 2026-05-20

This runbook explains how Claude Code agent sessions read Vercel deployment + runtime logs during live debugging. Originally written 2026-05-20 to configure the official Vercel MCP server — discovered that flow is blocked in Claude Code Web sandboxes, so the **working path is now the Vercel REST API + helper script** (§REST API path below). The MCP setup is retained but currently dormant (§MCP path — currently blocked).

---

## ⚡ TL;DR — The working path (REST API)

1. Reza creates a Vercel personal token at `vercel.com/account/tokens`, scoped to `monitrax` project, read-only.
2. Reza adds the token to the Claude Code Web cloud environment: `claude.ai/code` → Default → ⚙️ → Environment variables → `VERCEL_TOKEN=vcp_...`.
3. Agent runs `./scripts/vercel-logs.sh <command>` via Bash to fetch logs:
   ```bash
   ./scripts/vercel-logs.sh list                       # recent deployments
   ./scripts/vercel-logs.sh latest-runtime             # latest prod runtime logs
   ./scripts/vercel-logs.sh runtime <deploymentId>    # specific deploy runtime logs
   ./scripts/vercel-logs.sh build <deploymentIdOrUrl>  # build events
   ./scripts/vercel-logs.sh project                    # sanity-check token
   ```
4. No OAuth, no MCP, no host restrictions — just curl-to-`api.vercel.com` with the Bearer token.

---

## REST API path (currently working)

### Why this instead of the MCP

Vercel's REST API authenticates with the same personal token (`vcp_...`) that the user creates at `vercel.com/account/tokens`. Direct HTTPS to `api.vercel.com` works from any host that can reach the public internet — including Claude Code Web sandboxes. **No OAuth callback, no host allowlist on Vercel's side.**

The official Vercel MCP server (`https://mcp.vercel.com`) uses an OAuth dance whose callback host is allowlisted only for approved hosts (e.g. `claude.ai` itself, for Claude.ai chat connectors). Claude Code Web sandboxes use a different host that's NOT on Vercel's allowlist — so the MCP flow returns `403 Host not in allowlist` and never completes (§MCP path — currently blocked).

### Endpoints used

| Endpoint | Purpose |
|---|---|
| `GET /v6/deployments?app={project}&limit=N` | List recent deployments |
| `GET /v9/projects/{name}` | Project metadata (used to resolve project ID for runtime-log calls) |
| `GET /v3/deployments/{id}/events` | Build/deployment events (build logs) |
| `GET /v1/projects/{projectId}/deployments/{id}/runtime-logs` | Runtime logs (function-level errors) |

All authenticate with `Authorization: Bearer ${VERCEL_TOKEN}`.

### Helper script

`scripts/vercel-logs.sh` wraps the four common operations with jq-based pretty-printing. Agent calls it via Bash; humans can call it interactively too. Source has inline docs and a `help` command.

### Token provisioning (Reza-side)

1. Open `vercel.com/account/tokens` → **Create Token**.
2. Token settings:
   - **Name:** `claude-code-web-monitrax-logs` (or similar — clear single purpose)
   - **Scope:** `monitrax` project ONLY (NOT account-wide — least-privilege)
   - **Permissions:** read-only on deployments + runtime logs (don't grant write)
   - **Expiry:** 90 days recommended (matches rotation cadence)
3. Copy the token (Vercel shows it once).
4. Open `claude.ai/code` → click the `Default` cloud-environment badge (bottom of page) → click the **⚙️ gear icon** next to Default → **Update cloud environment**.
5. In **Environment variables**, paste:
   ```
   VERCEL_TOKEN=vcp_<paste-the-token-value>
   ```
6. Click **Save changes**.
7. Start a **fresh Claude Code session** (existing sessions don't pick up env-var changes mid-flight).

### Token rotation (every 90 days)

1. Create a NEW token in Vercel, same settings.
2. Update the env var in the cloud environment.
3. Save changes.
4. Verify the new token works in a fresh session: `./scripts/vercel-logs.sh project`.
5. Revoke the OLD token at `vercel.com/account/tokens`.

If you accidentally leak the token (e.g. screenshot, paste in chat): rotate immediately. Treat any visible token as compromised.

### Plan-related retention caveats

Vercel runtime-log retention depends on plan:
- **Hobby:** 1 hour
- **Pro:** 1 day (Monitrax current)
- **Enterprise:** 3 days
- **Observability Plus add-on:** up to 30 days

The runtime-logs endpoint **streams** NDJSON (one JSON object per line) and holds the connection open waiting for new events — it does NOT return a finite array. The `runtime` / `latest-runtime` commands therefore bound the read with `curl --max-time` (~25 s): a deploy with recent traffic prints its log lines and returns; a quiet deploy, or one outside the retention window, waits the full ~25 s and then reports a friendly "no runtime logs" message. A `curl: (28) Operation timed out` notice on stderr in that case is **expected and benign** — it is how a bounded read of an idle stream ends. For older logs you need the GCP Cloud Logging path (§Long-term, below).

> **Fixed 2026-05-22.** The `runtime` command originally parsed the response as a JSON array (`jq '.[]'`) and had no `--max-time`. It only ever returned because `jq` crashed on the NDJSON shape and killed the pipe; against a real stream it would hang. Now: `curl --max-time` bounds the read and each NDJSON line is processed directly.

### What the agent gets

When the agent runs the helper script, it can answer questions like:
- "Show me runtime errors on the latest production deployment"
- "What did the build log say on the deploy that's currently in `ERROR` state?"
- "Is `/api/health` still throwing TLS errors in the last hour of logs?"
- "Which deployment was active when this error was reported?"

Without the screenshot middleman.

---

## MCP path (currently blocked)

### Status

The repo-root `.mcp.json` declares the Vercel MCP server. When a Claude Code session starts, it attempts to authenticate via OAuth with Vercel. **As of 2026-05-20 this fails** with `403 Host not in allowlist` because Vercel's OAuth host allowlist doesn't include Claude Code Web sandbox hosts. The MCP tools (`mcp__vercel__list_deployments`, etc.) are advertised but unreachable.

### Why we keep it anyway

Cheap to leave in place. If/when Anthropic and Vercel coordinate to add Claude Code Web sandbox hosts to Vercel's OAuth allowlist, the MCP will "just start working" without any action from us — at which point the MCP path becomes preferred over the REST API path (richer tool surface, structured types, better observability).

### File

`.mcp.json` at repo root:
```json
{
  "mcpServers": {
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com",
      "headers": {
        "Authorization": "Bearer ${VERCEL_TOKEN}"
      }
    }
  }
}
```

The `${VERCEL_TOKEN}` expansion is read from the same env var that powers the REST API path — so one credential serves both potential paths.

### When to remove `.mcp.json`

If after 6 months (≥ 2026-11-20) the MCP path is still blocked, remove `.mcp.json` and this section to reduce confusion for future operators. Track in `IMPLEMENTATION_PLAN.md` Open Questions.

---

## Long-term (queued) — GCP Cloud Logging log drain

The proper BAU-grade answer: configure a Vercel Log Drain to forward all logs to Google Cloud Logging via a small Cloud Functions relay. Then the agent queries GCL via `gcloud logging read` — which works from any sandbox + has unlimited retention (per the GCL retention policy).

**Trigger conditions to ship this:**
- First paying user on Monitrax, OR
- Pre-Basiq accreditation submission (CDR posture wants log retention in GCP per CLAUDE.md §13.9), OR
- The 1-day Pro retention starts biting (a week-old issue can't be diagnosed from logs)

**One-time setup (~10 min):**
1. Deploy `kym6464/vercel-google-cloud-logging` (Cloud Functions gen2, Python 3.12, MIT-licensed) to `monitrax-479700` project.
2. Generate a shared secret + register a Vercel log drain pointing at the function URL.
3. Verify ownership of the destination via Vercel's challenge response.
4. Logs start landing in Cloud Logging under `logName=projects/monitrax-479700/logs/vercel-monitrax`.

**Cost:** Pro plan log drain add-on (~$0.50/GB drain throughput) + standard Cloud Logging ingestion (free tier 50 GB/mo, then $0.50/GB).

**Tracked in:** `IMPLEMENTATION_PLAN.md` Up Next #15 (vercel-log-receiver Cloud Function shim).

---

## Security considerations

- **Token NEVER committed to repo** — always env-var expansion via `${VERCEL_TOKEN}`.
- **Least-privilege scope:** monitrax project only, read-only on deployments + logs.
- **Single-tenant environment caveat:** the cloud environment's Environment variables field warns "visible to anyone using this environment". For Monitrax today that's solo-user (Reza only), so the trade-off is acceptable. If collaborators join the same cloud environment, rotate to per-user tokens or use OAuth (when/if Anthropic + Vercel fix the allowlist).
- **Network egress** on the cloud env is set to `Full` (changed 2026-05-20 from `Trusted` during MCP debugging). `api.vercel.com` and `mcp.vercel.com` both reachable. If this is ever tightened, the REST API path still works as long as `api.vercel.com` stays allowlisted.

---

## References

- Vercel REST API reference: `https://vercel.com/docs/rest-api`
- Vercel runtime logs endpoint: `https://vercel.com/docs/rest-api/logs/get-logs-for-a-deployment`
- Claude Code MCP docs: `https://code.claude.com/docs/en/mcp.md`
- Helper script source: `scripts/vercel-logs.sh`
- Long-term log drain candidate: `https://github.com/kym6464/vercel-google-cloud-logging`
- Originating firefight: `docs/changelog/CHANGELOG_2026_05_20.md` (Cloud SQL TLS-handshake + connection-pool exhaustion debugging session)

---

## Prisma client generation in the sandbox (2026-07-01)

**Symptom:** `npx prisma generate` in a Claude Code Web session dies with
`Error: aborted … code: 'ECONNRESET'` and no client is generated. Every vitest
file that imports a Prisma-touching module then fails to load with
`Cannot find module '.prisma/client/default'`.

**Root cause (two proxy-reset network calls):**
1. Prisma CLI pings `checkpoint.prisma.io` (telemetry) on every command.
2. `generate` downloads the **schema-engine** from `binaries.prisma.sh` — and
   Prisma's Node downloader (node-fetch) does **not** honor `HTTPS_PROXY`, so it
   connects directly and the agent proxy resets it. (The query engine is already
   bundled in `@prisma/engines`; only the schema-engine is fetched.) `curl`
   **does** honor the proxy + CA bundle, so the binary can be fetched manually.

**Fix:** run `bash scripts/dev/sandbox-prisma-generate.sh`. It curls the
schema-engine via the proxy into `~/.cache/prisma/…`, then runs
`prisma generate` with `CHECKPOINT_DISABLE=1` and
`PRISMA_SCHEMA_ENGINE_BINARY` / `PRISMA_QUERY_ENGINE_LIBRARY` pointed at the
local binaries — so no download happens. After it runs, `@prisma/client`
resolves to a real generated client and the full vitest suite (plus local
`tsc --noEmit`) runs exactly as in CI. This is the real fix — do NOT
`vi.mock('@/lib/db')` in tests to dodge a missing client.

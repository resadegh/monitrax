# 12 — Claude Code MCP Setup

**Owner:** Reza · **Last reviewed:** 2026-05-20

This runbook explains how the project's `.mcp.json` file wires Claude Code sessions to external Model Context Protocol (MCP) servers — and how to add, audit, or revoke server access.

---

## What is `.mcp.json`?

A repo-root config file read automatically by every Claude Code session (Web cloud environment, Desktop, CLI). It declares which remote/HTTP MCP servers the agent is allowed to talk to, along with how to authenticate.

Source of truth: `https://code.claude.com/docs/en/mcp.md`.

---

## Currently configured servers

### `vercel` — Vercel platform read access

- **Type:** HTTP
- **URL:** `https://mcp.vercel.com`
- **Auth:** `Authorization: Bearer ${VERCEL_TOKEN}` (env-var expansion)
- **Added:** 2026-05-20 — Reza wanted the agent to read Vercel deployment logs + runtime logs directly during live debugging (e.g. Cloud SQL TLS handshake intermittents, connection-pool exhaustion 53300 errors) instead of relying on screenshots back-and-forth.

**Tools the agent can call once connected:**
- `mcp__vercel__list_deployments` — find latest/failed/successful builds
- `mcp__vercel__get_deployment` — single deployment detail
- `mcp__vercel__get_deployment_build_logs` — Vercel build-time logs
- `mcp__vercel__get_runtime_logs` — Vercel function runtime logs (the most useful for live debugging)
- `mcp__vercel__list_projects` — list projects
- `mcp__vercel__get_project` — project metadata

The agent does **not** have write access via the token's scope — read-only on deployments + logs.

---

## How `VERCEL_TOKEN` is provisioned

1. **Create the token at Vercel:** `vercel.com/account/tokens` → **Create Token**. Scope to the `monitrax` project only (least-privilege). No expiry vs short expiry is operator preference — short expiry is safer but requires periodic rotation.
2. **Store the token in the Claude Code Web cloud environment:**
   - Open `claude.ai/code` → click `Default` (cloud environment) badge → **gear icon ⚙️** next to Default → **Update cloud environment**.
   - **Environment variables** field → paste:
     ```
     VERCEL_TOKEN=<the-token-value>
     ```
   - Save. The variable becomes available as `${VERCEL_TOKEN}` to every new Claude Code session that uses the `Default` environment.
3. **Verify in a new session:** start a fresh session → ask the agent to list its Vercel tools. Expected: `mcp__vercel__*` tools enumerated.

---

## Why the token lives in env vars despite the warning

The cloud environment dialog warns: *"Environment variables are visible to anyone using this environment — don't add secrets or credentials."*

For Monitrax today, **the cloud environment is solo-user (Reza only)** — so "visible to anyone using this environment" reduces to "visible to me". The trade-off is acceptable.

**When this changes:**
- If Monitrax adds collaborators with shared access to the same Claude Code cloud environment → migrate to per-user OAuth (Option 1 in this PR's context) OR rotate the token.
- If the Vercel token is ever compromised → rotate immediately at `vercel.com/account/tokens` and re-paste into the cloud env var.

---

## Rotation procedure (every 90 days recommended)

1. `vercel.com/account/tokens` → revoke existing `claude-code-web` token.
2. Create a new token, same scope.
3. Update `VERCEL_TOKEN` in the Claude Code cloud environment.
4. Start a fresh session to confirm the new token works (no Vercel API 401s).

---

## Adding a new MCP server

1. Determine if the server is HTTP/remote or stdio/local.
2. For HTTP, append to `mcpServers` in `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "vercel": { ... },
       "newserver": {
         "type": "http",
         "url": "https://example.com/mcp",
         "headers": {
           "Authorization": "Bearer ${NEW_SERVER_TOKEN}"
         }
       }
     }
   }
   ```
3. Provision the token in the cloud env var.
4. Commit `.mcp.json`, redeploy not needed (config is read by Claude Code, not by the app build).
5. Append a section to this runbook documenting the new server.

---

## Revoking access

1. **For everyone, immediately:** delete the relevant block from `.mcp.json` → commit → push. Existing live sessions may still have the tool until they end; new sessions won't see it.
2. **For the credential separately:** revoke the token at the provider's dashboard. This kills the connection even for in-flight sessions.

---

## Security considerations

- **Never commit raw tokens** in `.mcp.json` — always use `${VAR}` expansion. The repo is a public-or-organization artifact; tokens belong in environment configuration only.
- **Least-privilege every token.** Vercel tokens default to broad scope; explicitly scope them to the `monitrax` project.
- **Audit periodically.** Quarterly review: list active tokens at `vercel.com/account/tokens`, confirm each is still in use, revoke stale ones.
- **Network access on the cloud environment** is set to `Trusted` — meaning the environment can reach external URLs like `mcp.vercel.com`. If this is ever tightened to a restricted egress list, `mcp.vercel.com` would need to be allowlisted.

---

## References

- Claude Code MCP docs: `https://code.claude.com/docs/en/mcp.md`
- Vercel MCP docs: `https://vercel.com/docs/mcp` (provider-side, lists available tools + auth)
- `04_WIF_TROUBLESHOOTING.md` — the originating use case (TLS-handshake + connection-pool live debugging that drove the request to wire this up).

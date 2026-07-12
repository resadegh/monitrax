---
name: pr-prep-checklist
description: Pre-PR doc-sync checklist enforcement for Monitrax. Auto-activate when the user says "create a PR", "open a PR", "let's merge this", "push this branch", "ready to ship", "submit the PR", or any equivalent PR-preparation cue, AND BEFORE calling mcp__github__create_pull_request. Walks through CLAUDE.md §16.5 doc-sync block step-by-step — identifies surfaces touched (§16.2), checks each matching doc was updated (§16.3 matrix), verifies IMPLEMENTATION_PLAN.md (§15), CHANGELOG (§11), destructive-write checklist (§12.11) if applicable, schema migration (§12.12) if applicable. Refuses to open the PR until every required doc is updated in the same PR. Skips the full walk for trivial PRs (chore:, docs:typo, style:formatting-only) but still emits the unchecked §16.5 block in the PR body. Points at CLAUDE.md as the single source of truth — never duplicates rules. Project-scoped to Monitrax.
---

# PR Prep Checklist (Monitrax)

> This skill is the **operational enforcement** of CLAUDE.md §3, §11, §15, §16. It does not duplicate the rules — it walks them. CLAUDE.md is the source of truth; this skill ensures the protocol actually runs at PR time.

## Trigger surface

Activate when:
- The user uses any PR-preparation cue: *"create a PR"*, *"open a PR"*, *"let's merge this"*, *"push this branch"*, *"ready to ship"*, *"submit the PR"*, *"PR for X"*, *"merge this in"*, etc.
- You are about to call `mcp__github__create_pull_request`, `gh pr create`, or any equivalent.

When triggered: **stop.** Do not call the create-PR tool yet. Walk the checklist below, then proceed only when every required row is satisfied.

## Step 1 — Classify the PR

From the diff and the user's intent, classify:

| Type | Examples | Path |
|---|---|---|
| **Trivial** | `chore:` (deps, lockfile), `docs:` typo only, `style:` formatting only, single-line comment | Light path (Step 2 only) |
| **Substantive** | `feat:`, `fix:`, `refactor:`, schema change, infra change, any change touching a §16.2 surface | Full path (Steps 2–6) |

If unsure, treat as substantive.

## Step 2 — Mandatory PR-body §16.5 block (every PR, no exceptions)

Every PR description MUST include the §16.5 block, even if all rows are unchecked. Build it from the actual diff, never from memory:

```markdown
## Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [ ] strategic decision (Open Question resolved / workstream parked or revived)

Docs updated in this PR:
- [path/to/doc:section] — what was updated
- ...
```

For trivial PRs: leave all rows unchecked, include the block as positive confirmation. STOP HERE — proceed to PR creation.

For substantive PRs: continue to Step 3.

## Step 3 — Map surfaces to required docs (CLAUDE.md §16.2 → §16.3)

Run this against the diff (`git diff main --stat`, `git diff main --name-only`):

| If the diff touches… | …then this doc MUST be updated in the same PR |
|---|---|
| `prisma/schema.prisma` | A matching migration in `prisma/migrations/<name>/migration.sql` (CLAUDE.md §12.12) — NON-NEGOTIABLE |
| `prisma/migrations/*` with `DROP`, `ALTER...DROP`, `TRUNCATE`, or `NOT NULL` without default backfill | §12.11 destructive-write checklist in PR body |
| `lib/calculations/*`, `lib/services/masterFinancialService.ts`, any new engine | `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` + Phase doc |
| Cloud SQL settings (tier, edition, flags, authorized networks, maintenance) | `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` (Instances table + relevant section) |
| Backup / restore behaviour | `docs/operational/database/02_BACKUP_AND_RESTORE.md` |
| DB monitoring / alerting | `docs/operational/database/03_MONITORING_AND_ALERTS.md` |
| Auth, Firebase, GCP Identity Platform | `docs/operational/security/01_AUTHENTICATION.md` + CLAUDE.md §13.6 if posture changes |
| IAM principal / role / SA changes | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` |
| WIF / Cloud SQL Connector — new failure mode encountered | `docs/operational/security/04_WIF_TROUBLESHOOTING.md` (append a new §3.X) |
| CDR posture (consent, sanitisation, retention) | `docs/operational/security/03_CDR_COMPLIANCE.md` + `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` + CLAUDE.md Part 13 |
| Vercel project settings (region, plan, env vars, OIDC) | `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` + relevant runbook in `docs/operational/deployment/` |
| Data model | `docs/architecture/03_DATA_MODEL.md` + matching Prisma migration |
| API contract | `docs/architecture/07_API_STANDARDS.md` |
| UI / design system / new visual primitive (token, palette, glyph, tile, hero pattern) | `docs/architecture/06_UI_UX_FOUNDATION.md` + `08_BRAND_UI_DESIGN.md` + relevant Phase doc + inline JSDoc on the canonical component file (CLAUDE.md §16.4) |
| TRAIL framework interpretation | `docs/blueprint/TRAIL_FRAMEWORK.md` + `docs/blueprint/MASTER_BLUEPRINT.md` |
| Phase scope / progress | the relevant `docs/blueprint/PHASE_*.md` |
| Strategic decision (Open Question resolved, workstream parked or revived) | `docs/IMPLEMENTATION_PLAN.md` Open Questions row → mark closed with date + rationale |
| Policy change (incident response, retention, dependency, device) | the relevant file under `docs/policy/` |
| New operational failure mode / diagnostic / "I tried X and it didn't work" lesson | the matching runbook under `docs/operational/security/` or `docs/operational/database/` |

For each surface in the diff, if the matching doc is **not** updated in the same PR → **STOP**. Surface this to the user, propose the fix, do not open the PR.

## Step 4 — IMPLEMENTATION_PLAN.md (CLAUDE.md §15)

Verify `docs/IMPLEMENTATION_PLAN.md` is updated in the same PR if the work:

- Started a new workstream → `🟡 Active Workstreams` entry created
- Advanced an existing workstream → checkbox ticked + `Last touched` updated
- Completed a workstream → moved to `✅ Recently Completed` with date + PR number
- Discovered dead code / tech debt → `🗑️ Dead Code / Tech Debt Backlog` entry
- Reverted a previous attempt → `↩️ Reversed Decisions` entry with lesson
- Surfaced a new strategic question → `❓ Open Questions` entry
- Blocked on user decision or external dependency → moved to `🚧 Blocked` with blocker named

If yes to any of the above and IMPL_PLAN is not in the diff → **STOP**.

## Step 5 — CHANGELOG (CLAUDE.md §11, §3.2)

Verify `docs/changelog/CHANGELOG_YYYY_MM_DD.md` for today exists and contains:

- Session ID
- Type / Scope / Root cause (for fixes) / Solution
- Files modified list
- Build status (TypeScript / lint / tests)
- Commit history table

If missing → **STOP**, create or append.

For substantive PRs (multi-day work or significant refactors), also confirm `docs/changelog/IMPLEMENTATION_CHANGELOG.md` is appended to.

## Step 6 — Destructive-write + schema-migration checks (CLAUDE.md §12.11, §12.12)

Run:

```bash
git diff main --unified=0 | grep -E "prisma\.[a-zA-Z]+\.(update|upsert|delete|updateMany|deleteMany)\(|\\\$executeRaw"
```

If matches → **§12.11 checklist must appear in PR body**, with the three answers filled in (where-clause matches / columns overwritten / guard rails). If checklist missing or any answer unsatisfactory → **STOP** and confirm with user before proceeding.

Run:

```bash
git diff main --name-only | grep -E "^prisma/(schema\.prisma|migrations/)"
```

If `schema.prisma` appears without a new folder under `prisma/migrations/` → **STOP**. Generate the migration locally before opening the PR (CLAUDE.md §12.12 — non-negotiable).

## Step 7 — Build / lint verification (CLAUDE.md §11.2, §4.2)

Verify in the changelog or PR body:
- [ ] `npm run build` passes (or pre-existing failure documented)
- [ ] `npm run lint` passes (or pre-existing failure documented)
- [ ] Tests pass where applicable

## Step 8 — Build the PR body

Use the standard CLAUDE.md §4.3 template + the §16.5 doc-sync block from Step 2 + (if applicable) the §12.11 destructive-write checklist:

```markdown
## Summary
{1–3 sentences}

## Changes Made
- {bullet}

## Documentation Updated
- [x] Changelog entry created
- [x] Phase document updated (if applicable)
- [x] IMPLEMENTATION_PLAN.md updated (if applicable)
- [x] Master Blueprint updated (if applicable)

## Doc-sync (CLAUDE.md §16)
{block from Step 2}

## Destructive write checklist (CLAUDE.md §12.11)
{only if Step 6 matched}

## Testing
- [x] Build passes
- [x] Lint passes
- [x] Manual testing completed (or N/A)

## Blueprint Alignment
- Follows: docs/blueprint/PHASE_XX.md (if applicable)
- Architecture: docs/architecture/01_ARCHITECTURE_OVERVIEW.md

https://claude.ai/code/{session-url}
```

## Step 8.5 — THE §20.6 PRE-PR GATE (10/10 vs Document + Requirements + Logic) — HARD BLOCK

> This is the enforcement of **CLAUDE.md §20.6** (do not duplicate the rule — read it there). It is the last gate before the PR is allowed to move, and it is why Reza should never have to repeat "consult Neomatrix / follow the doc / strict SSOT / don't over-claim" again.

Self-score the change /10 on THREE axes; **ALL THREE must be an honest 10/10** or you do NOT open the PR:

1. **DOCUMENT /10** — did you RE-READ the design/blueprint/NEOAUDIT/phase doc this change touches (not from memory), and does the change conform to its documented plan AND sequence (no jumping ahead without surfacing it)? For any financial number/engine, was the **Neomatrix consulted** (§21.5)?
2. **REQUIREMENTS /10** — exactly what was asked, no gold-plating / no silent scope-cut, every load-bearing claim verified to source (§19.2)?
3. **LOGIC /10** — correct, edge cases handled, **strict SSOT (one producer per number/calc, no second source alive, §12.2.1)**, financial changes carry §19.2 worked example + §19.4 sweep?

Then confirm the **coverage boundary is stated precisely** — NOT "tested / green / complete", but "verifies X, does NOT verify Y" (§22.2.4).

**Put the recorded result in the PR body verbatim:**
`Gate (§20.6): Document X/10 (doc: <name+section>) · Requirements X/10 · Logic X/10` + one line on what the review changed + the coverage boundary.

If any axis is < 10/10: **STOP.** Fix to an honest 10/10, or surface the specific gap to Reza. Do not open the PR.

## Step 9 — Open the PR

Only now — with the §20.6 gate recorded at 10/10/10 — is it safe to call `mcp__github__create_pull_request`. After creation:

1. Provide the PR URL to the user
2. Summarise the surfaces touched + docs updated
3. List any follow-up actions

## Stop conditions (non-negotiable)

Do NOT call `mcp__github__create_pull_request` if:

- Any surface from §16.2 is touched but the matching §16.3 doc is not updated in the same PR
- IMPLEMENTATION_PLAN.md should have been updated and wasn't
- CHANGELOG entry is missing
- Destructive Prisma operations exist without the §12.11 checklist filled in
- `prisma/schema.prisma` changed without a matching migration file
- The §16.5 doc-sync block is missing from the PR body
- **The §20.6 tri-axis gate is not recorded at an honest 10/10 on Document + Requirements + Logic (Step 8.5) — HARD BLOCK, applies to EVERY PR including trivial ones**
- The change **deviated from a documented plan/sequence** (e.g. NEOAUDIT §8 order) without that deviation being surfaced to Reza first
- Coverage is claimed as prose ("tested / all green / complete") instead of "verifies X, does NOT verify Y" (§22.2.4)

For each stop, surface to the user with the exact gap + the fix, then resume from the failed step.

## Trivial-PR shortcut

For PRs that are unambiguously trivial (single-file typo, dependency bump with no behavioural impact, formatting-only):

1. Build the §16.5 block with all rows unchecked.
2. Skip Steps 3–7.
3. **Step 8.5 (the §20.6 gate) is NOT skippable** — even a trivial PR records `Gate (§20.6): Document X/10 · Requirements X/10 · Logic X/10` (for a typo it's a 10-second honest check, but it still runs).
4. Build the PR body with the standard template + unchecked §16.5 block + the §20.6 line.
5. Confirm with the user *once* before opening: "This is a `<type>:` PR — skipping full doc-sync walk. Proceed?"
6. On confirmation, proceed.

The goal of the shortcut is to avoid bureaucratic friction on truly trivial work, not to bypass real protocol violations. If in doubt, treat as substantive.

## Relationship to other governance

This skill complements:

- **CLAUDE.md §3** (what must be documented — the matrix)
- **CLAUDE.md §11** (changelog + build tracking)
- **CLAUDE.md §15** (IMPLEMENTATION_PLAN protocol)
- **CLAUDE.md §16** (doc-sync protocol — this skill operationalises the §16.5 PR-body block enforcement)
- **architect-mode skill** (`.claude/skills/architect-mode/`) — for the *content* of substantive recommendations
- **skill-security-review** (`~/.claude/skills/`, user-level) — for *third-party content* review, not PRs of internal work

When this skill and CLAUDE.md disagree, **CLAUDE.md wins**. This skill never weakens CLAUDE.md rules; it only enforces them more reliably.

When this skill and the user's explicit instructions disagree, **the user wins** — but surface the rule being relaxed and confirm scope ("you've asked me to skip the §16.5 block on this PR — confirming once, will not skip on the next PR").

## When NOT to use this skill

- Any work that is not preparing a PR (regular development, debugging, exploration).
- Skill installs into `~/.claude/skills/` (user-level) — those don't touch the Monitrax repo and don't trigger §16 doc-sync.
- Reviewing third-party content (use `skill-security-review` instead).

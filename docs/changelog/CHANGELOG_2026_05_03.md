# Changelog — 2026-05-03

## Session: install-claude-skills-g5tYW

### Changes Made
- **Type:** Feature (governance / dev-experience)
- **Scope:** `.claude/skills/architect-mode/` (new project-level skill)
- **Description:** Codified Monitrax's multi-disciplinary advisory mode as a project-level Agent Skill so future sessions auto-load the six-lens framing without re-prompting. Extends CLAUDE.md §0 (which had four lenses) by adding **Visual Designer** + **Growth & Marketing Strategist**, plus the **One Clear Action principle** and **stage-gated feature exposure** language. Defines a structured `Problem → Why → Solution → Implementation → Risks` output for substantive recommendations and explicitly defers to CLAUDE.md §0.3 ("tight, opinionated answers > sprawling justifications") for trivial / exploratory questions.

### Rationale
Reza supplied a 6-lens "Architect Mode" prompt to be installed as a recurring instruction. Two collisions had to be resolved before install:

1. **Original prompt mandated a "REACH" framework** (Reveal → Establish → Act → Compound → Harvest). CLAUDE.md Part 14 already mandates the **TRAIL** framework (Track → Reduce → Anchor → Invest → Live), which is wired into the sidebar IA, `docs/blueprint/TRAIL_FRAMEWORK.md`, the MASTER_BLUEPRINT, and several Phase docs. Installing REACH as-written would have produced answers that don't match the live product. **Resolution:** the skill uses TRAIL (Reza's choice — Option B in the audit summary).
2. **Original prompt mandated a five-section template for every recommendation.** This collides with CLAUDE.md §0.3 (tight answers for exploratory questions). **Resolution:** the template applies to **substantive recommendations** (new features, architectural choices, UX overhauls, growth strategy, scope decisions); trivial / exploratory questions defer to §0.3.

The skill is **explicitly subordinated to CLAUDE.md** — when this skill and CLAUDE.md disagree, CLAUDE.md wins; when this skill and the user's explicit instructions disagree, the user wins.

### Files Modified
- `.claude/skills/architect-mode/SKILL.md` — NEW (183 lines, ~11.2 KB). YAML frontmatter (`name`, 787-char `description` within the 1024 spec limit) + body covering: core objective, six lenses (with per-lens "asks"), critical operating principles, TRAIL framework integration, financial-advisor mode strict rules, behavioural-psychology mode, UX/UI design mode, visual design principles, marketing & growth mode, output structure rule, constraints, success criteria, relationship to existing CLAUDE.md governance, when NOT to use.
- `docs/IMPLEMENTATION_PLAN.md` — entry added under `✅ Recently Completed` for 2026-05-03 (this file's session).
- `docs/changelog/CHANGELOG_2026_05_03.md` — NEW (this file).

### Documentation Updated
- `docs/IMPLEMENTATION_PLAN.md` ✅ (CLAUDE.md §15 SSOT updated)
- `docs/changelog/CHANGELOG_2026_05_03.md` ✅ (CLAUDE.md §11 daily changelog created)
- `CLAUDE.md` — **NOT modified** at user's explicit request (existing four-lens content in §0 stands; new skill complements rather than rewrites). Future enhancement: add a single-line cross-reference in §0 pointing to `.claude/skills/architect-mode/` for explicit discoverability — deferred until user requests.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — *No (skill is governance-level, not a visual primitive)*
- [x] application config (env vars, Vercel, OIDC, etc.) — *No*
- [x] GCP infrastructure (Cloud SQL, IAM, etc.) — *No*
- [x] identity / auth — *No*
- [x] deployment / build — *No*
- [x] security / CDR posture — *No*
- [x] operational procedure — *No*
- [x] strategic decision (Open Question resolved / workstream parked or revived) — *Partial: "REACH vs TRAIL" was a latent open question surfaced and resolved in favour of TRAIL during this session. Documented in IMPLEMENTATION_PLAN.md entry above. No formal Open Question row to flip — the conflict was caught before it shipped.*

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:✅ Recently Completed` — session-level entry for the skill install + the broader skill audit work
- `docs/changelog/CHANGELOG_2026_05_03.md` — full session changelog (this file)

### Testing
- [x] YAML frontmatter validates (`name` is lowercase + hyphens, matches dir; `description` is 787 chars, within 1024 limit)
- [x] SKILL.md is under the 500-line guideline (183 lines)
- [x] No bundled scripts, no executable surface, no network calls — pure-instruction skill (LOW per skill-security-review methodology)
- [x] No conflicts with existing skills in `~/.claude/skills/` (no name collision: `architect-mode` is unique)
- [ ] Trigger evaluation under real Monitrax sessions — pending production use (skills evaluation is observational, not synchronous)

### PR
- Branch: `claude/install-claude-skills-g5tYW`
- PR URL: TBD on push
- Status: Untracked → committed → pushed in this session

### Out-of-scope (this session, not this PR)

Earlier in the same session, ~60 skills were vetted and installed at **user level** (`~/.claude/skills/`), governed by the `skill-security-review` skill (also user-level) authored at the start of the session. None of those changes touched the Monitrax repo. Pin records at:
- `~/.claude/skills/.anthropic-skills-pin` — 16 official Anthropic skills @ `5128e186`
- `~/.claude/skills/.composio-third-party-pin` — 7 LOW-risk skills @ `48ffe0c6` (vetted via parallel subagent audit; `connect-apps-plugin` rejected for instruction-suppression payload + remote MCP routing through Composio infrastructure)
- `~/.claude/skills/.marketingskills-pin` — 37 marketing skills @ `1bcff9fc` (vetted via parallel subagent audit; `popup-cro`, `paywall-upgrade-cro`, `marketing-psychology` excluded as brand-incompatible with Monitrax's anti-shame financial-product positioning per CLAUDE.md §0)

Audit reports for `composiohq/awesome-claude-skills`, `obra/superpowers` (declined — philosophical collision with §0), `coreyhaines31/marketingskills` are in session transcript only — not duplicated as standalone reports per CLAUDE.md §3 (no documentation files unless explicitly requested).

---

## Session: claude/snapshot-route-cleanup-lS5cs — Snapshot SSOT cleanup (Tech-Debt #1b closed, #1a reclassified)

### Context

Reza approved Up Next #5 — "Snapshot-route cleanup". The original tech-debt classification claimed `/api/portfolio/snapshot`, `/api/financial-snapshot`, and `lib/services/financialSnapshot.ts` were all duplicates of `/api/master-snapshot` + `getMasterFinancialSnapshot()`.

I committed to a pre-flight check before any code changes. The pre-flight discovered the premise of half the cleanup was wrong:

- `/api/portfolio/snapshot` is NOT a duplicate. It returns `SnapshotV2` (GRDCS-aware "Snapshot 2.0") — a different shape with a different scope (per-entity `_links` / `_meta`, `linkageHealth`, `moduleCompleteness`, `relationalInsights`). Its callers (`/api/linkage/health`, `useUISyncEngine`, dashboard home page) consume the GRDCS layer that master does not expose. Migrating them to master would silently lose information.
- `/api/financial-snapshot` + `lib/services/financialSnapshot.ts` ARE genuinely duplicates of master. Same shape category (counts / expenses / income / accounts / loans / cashflow / emergencyFund / healthScore), same SSOT scope. Phase 28 introduced `masterFinancialService.ts` and the older service was never retired.

Surfaced the misclassification to Reza; he approved a revised path: ship #5a (real duplicate cleanup) and #5b (re-classify the GRDCS one in the docs).

### Changes shipped

#### Code

- `app/api/dashboard/insights/route.ts` — migrated from `getFinancialSnapshot()` (legacy) → `getMasterFinancialSnapshot()` (canonical). Field-path remapping required because master uses a different shape:
  - `snapshot.loans.monthlyRepayments` → `snapshot.quickMetrics.monthlyLoanRepayments`
  - `snapshot.accounts.liquidCash` → `snapshot.quickMetrics.liquidCash`
  - `snapshot.healthScore.savingsRate` → `snapshot.quickMetrics.savingsRate`
  - `snapshot.healthScore.debtToIncome` → `snapshot.healthScore.components.debtToIncome.value`
  - The other field paths (`expenses.monthly.all.total`, `expenses.monthly.essential.total`, `expenses.monthly.discretionary.total`, `income.monthly.all.netTotal`, `emergencyFund.*`, `cashflow.monthlyCashflow`, `counts.accounts`) are identical between the two shapes — no remap needed.
  - File header doc updated to reflect the new SSOT.
- `app/api/financial-snapshot/route.ts` — DELETED. Already had zero callers per the 2026-05-01 dead-code audit.
- `lib/services/financialSnapshot.ts` — DELETED. After insights migration, zero callers anywhere.
- `lib/services/index.ts` — removed the legacy re-export block (`getFinancialSnapshot`, `FinancialSnapshot` type, etc.) that pointed at the deleted file.
- `lib/types/prisma-enums.ts` — removed the stale `lib/services/financialSnapshot.ts` reference from the `LIQUID_ACCOUNT_TYPES` consumer list.

#### Documentation

- `CLAUDE.md` §12.2 (SSOT table) — replaced the single "Financial snapshot" row with two explicit rows: master (financial scope) and portfolio/snapshot (GRDCS / relational scope). Added a paragraph below the table explicitly clarifying that the two are NOT duplicates and that future sessions must NOT delete `/api/portfolio/snapshot` under that assumption — references this PR's findings as the test case.
- `docs/IMPLEMENTATION_PLAN.md`:
  - Tech-Debt #1a — RECLASSIFIED ~~struck through~~ with full explanation (NOT a duplicate; GRDCS-aware Snapshot 2.0; classification corrected in CLAUDE.md §12.2).
  - Tech-Debt #1b — CLOSED ~~struck through~~ pointing at this PR.
  - Up Next #5 — REMOVED (work landed in this PR); subsequent items renumbered #6→5 through #13→12.
  - Up Next cross-references re-aligned: Tax fold-in #10→#9, Phase 37 PR 7 #11→#10, connection_limit #8→#7. Phase 40 + Phase 37 inline references in Active Workstreams updated to match.

### Build status

- [x] `npm run build` — PASS (Prisma generate + Next.js build clean).
- No TypeScript errors after the field-path remap.

### Risk

Low. Single API route changed (insights), with field-path remap that resolves to identical numbers via the canonical engine. Two files deleted (no callers). One barrel export pruned. No financial calculations touched (CLAUDE.md §6.1). No DB queries. No schema. No destructive Prisma writes (§12.11 N/A). No migrations (§12.12 N/A).

### What this PR does NOT do (intentional scope cap)

- Does NOT touch `/api/portfolio/snapshot` or its callers. That endpoint is the canonical GRDCS / relational SSOT — different scope from master, kept as-is.
- Does NOT consolidate the two snapshot SSOTs. That would mean promoting GRDCS layers into master and deprecating portfolio/snapshot — a design call worth ~1 day of refactor, not a cleanup. Captured for future consideration.
- Does NOT rename or reorganise anything beyond the deletions. Minimal-surface change.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] strategic decision (SSOT classification corrected; CLAUDE.md §12.2 + IMPLEMENTATION_PLAN reclassified)

Docs updated in this PR:
- `CLAUDE.md` §12.2 — two SSOTs documented + clarification paragraph
- `docs/IMPLEMENTATION_PLAN.md` — Tech-Debt #1a/#1b updated, Up Next #5 removed, cross-refs renumbered, Last-updated header refreshed
- `docs/changelog/CHANGELOG_2026_05_03.md` (this entry)

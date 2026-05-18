# Changelog — 2026-05-18

## Session: Post-41E quick wins — PR A (hard-deletes + Create-Flag modal)

Branch: `claude/post-41e-quick-wins-MG8mr`

### Scope

- **Type:** Chore / fix (tech-debt closure + small admin polish)
- **Scope:** Three tech-debt rows closed in one PR — Tech Debt #2 (auth routes), #10 (linear-wizard dir), #19 (admin Create-Flag modal).
- **CDR scope:** N/A — removing dead routes (auth routes were 410 Gone), dead UI primitives (zero importers), and adding an admin-only flag-creation modal.

### What was done

#### Hard-deletes (Tech Debt #2 + #10)

Both targets were soft-deleted 2026-05-01 with a "≥ 2026-05-15" hard-delete trigger conditional on zero `[deprecated-route]` warnings in prod logs. Trigger satisfied — 16-day soft-delete window observed clean.

- **`app/api/auth/login/route.ts`** — DELETED. Firebase Auth SDK is the canonical client-side path per CLAUDE.md §12.4.
- **`app/api/auth/register/route.ts`** — DELETED. Same.
- **`components/onboarding/linear/`** — DELETED (full directory: `LinearWizardContainer.tsx` + `primitives/` + `hooks/` + `design/` + `steps/`). Replaced by Phase 12 v2.0 `components/onboarding/wizard/` (grid-based `WizardContainer`) + 2026-05-17 Phase 12 Track E conversational variant. Dead-code audit re-verified ZERO importers immediately prior to deletion (only references were within the directory itself + historical doc mentions).

#### Admin Create-Flag modal (Tech Debt #19)

The `+Create Flag` button in `app/admin/feature-flags/page.tsx` toggled `showModal` state but no modal was rendered. Discovered 2026-05-17 when Reza tried to manually create the `CONVERSATIONAL_ONBOARDING` flag. Auto-seed via `vercel-build` (PR #780) covers the canonical case; this PR closes the ad-hoc escape hatch.

- **New `components/admin/feature-flags/CreateFlagModal.tsx`** — focused inline modal with key + name + description inputs. Validates `^[A-Z][A-Z0-9_]*$` key format client-side. Auto-uppercases key on input. ESC-to-close + click-outside-to-close + state reset on re-open. New flag defaults to `enabled: false`.
- **`app/admin/feature-flags/page.tsx`** — imports + mounts the modal. `onCreated` refetches the flag list.
- **No new API endpoint needed** — `POST /api/admin/feature-flags` already shipped (Phase 33).

### Files modified

| File | Change |
|---|---|
| `app/api/auth/login/route.ts` | DELETED |
| `app/api/auth/register/route.ts` | DELETED |
| `components/onboarding/linear/**` (full dir) | DELETED (~18 files) |
| `components/admin/feature-flags/CreateFlagModal.tsx` | NEW |
| `app/admin/feature-flags/page.tsx` | +2 imports + ~10 lines (modal mount) |
| `docs/IMPLEMENTATION_PLAN.md` | Tech Debt #2 + #10 + #19 closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | NEW — this file |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

This is a chore-class PR (dead-code removal + admin-only modal). No §16.2 surface materially changed.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — three tech-debt rows closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — this file.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes added by this PR. The new modal calls existing `POST /api/admin/feature-flags` which uses `prisma.globalFeatureFlag.create` (already shipped Phase 33). No schema change, no migration.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** No tax-engine, schema, or AI tool changes.

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [ ] Manual verification queued for Vercel preview: (1) `/admin/feature-flags` "+Create Flag" opens modal; (2) creating a flag persists + appears in list; (3) ESC + click-outside dismiss; (4) /api/auth/login + /api/auth/register routes return 404 (no longer 410).

### PR

- Branch: `claude/post-41e-quick-wins-MG8mr`
- Status: **Merged 2026-05-18 (PR #783)**.

---

## Session 2: PR B1 — Phase 42 PR 6.5d Gemini anomaly narrative

Branch: `claude/phase-42-ui-plumbing-MG8mr`

### Scope

- **Type:** Feature (Phase 42 PR 6.5d — deferred from PR6.5).
- **Scope:** Replaces the hardcoded flag→English mapper in `dailyPulse.ts` with a Claude Haiku 4.5 narration via the existing Phase 33g.2 client. CDR-safe input shape. Falls back to the deterministic mapper when AI isn't configured or fails.
- **CDR scope:** Reform-safe per CLAUDE.md §13.3 — only merchant name + flag code + amount + relative date label leave the engine. NO transaction descriptions, NO account ids, NO payee details.
- **Decision re-scope:** Originally PR B was meant to cover 4 Phase 42 items (6.5d + 5.6 + 4.5 + 2.5) in one PR. Re-scoped mid-session to one focused PR per item — B1 ships 6.5d only, then B2/B3/B4 follow. Cleaner review, smaller blast radius per merge.

### What was done

#### New file

- **`lib/bookkeeping/engagement/anomalyNarrator.ts`** — `buildAnomalyNarrative(userId)` is the new public entry. Fetches the top 5 most-recent flagged anomalies, builds a CDR-safe `AnomalyForNarration[]` (merchant + flag + amount + `formatRelativeDate(date)` — never ISO timestamp), passes to `generateAnthropicCompletion()` with a strict system prompt: ONE sentence, max 90 chars, no advice verbs, no manufactured urgency. Falls back to `renderDeterministicNarrative()` (exported for tests) when `isAnthropicConfigured()` returns false OR the LLM call throws. Surface is never empty.

#### Extended file

- **`lib/bookkeeping/engagement/dailyPulse.ts`** — calls `buildAnomalyNarrative` instead of the inline `buildSimpleAnomalyNarrative`. Legacy function deleted. JSDoc updated to reflect the LLM upgrade.

#### New tests

- **`tests/bookkeeping/anomalyNarrator.test.ts`** — 13 tests covering each of the 6 flag types in the deterministic fallback + a D-2 wall test (`it.each(flags)`) asserting no advice verbs / no manufactured urgency in any deterministic narrative. The LLM-narrated path is integration-tested via Vercel preview (cost-controlled).

### Files modified

| File | Change |
|---|---|
| `lib/bookkeeping/engagement/anomalyNarrator.ts` | NEW — 154 lines |
| `lib/bookkeeping/engagement/dailyPulse.ts` | −40 lines (legacy fn removed) + 1 import + 3-line comment block |
| `tests/bookkeeping/anomalyNarrator.test.ts` | NEW — 13 tests |
| `docs/IMPLEMENTATION_PLAN.md` | Up Next row 51 (PR 6.5d) closed |
| `docs/changelog/CHANGELOG_2026_05_18.md` | Session 2 entry (this) |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Engine-side narrator upgrade — no §16.2 surface changed. Anthropic dep already shipped in Phase 33g.2 (`lib/ai/anthropic.ts`); this PR adds a new consumer with the existing US$50/mo cap protecting cost.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 51 closed.
- `docs/changelog/CHANGELOG_2026_05_18.md` — Session 2 entry.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes; module reads from `unifiedTransaction.findMany` only.

### Schema migration checklist (CLAUDE.md §12.12)

**N/A.** No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)

**N/A.** Bookkeeping anomaly narrative — not a tax-engine surface.

### Testing

- [x] Tests written — 13 new in `tests/bookkeeping/anomalyNarrator.test.ts`.
- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.

### PR

- Branch: `claude/phase-42-ui-plumbing-MG8mr`
- Status: Open

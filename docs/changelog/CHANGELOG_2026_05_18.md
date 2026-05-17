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
- Status: Open

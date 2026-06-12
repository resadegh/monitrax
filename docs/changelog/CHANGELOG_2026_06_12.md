# Changelog - 2026-06-12

## Session: gallant-gates-kb264m (continued)

### Changes Made — Phase 47 Stage F planned: Structure Capture Completion
- **Type**: Planning / documentation (no code)
- **Scope**: `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` (new §4 Stage F), `docs/IMPLEMENTATION_PLAN.md`
- **Driver**: Reza compared his advisor-drawn **Renew Group structure chart** against Monitrax (2026-06-12) and asked whether everything is capturable — bare trusts/bare trustee companies, directors, secretaries, members, shareholders with share classes/counts. Then: *"plan the build to add all possible entities and their relationship not just this example. The onboarding wizard should be able to capture most of this but fine tuning and further details should be also available through my structure page."*
- **Audit findings (verified in code this session)**:
  - The Phase 44 schema represents EVERY chart element (19 `LegalEntityType`s incl. `BARE_TRUST` built for the SMSF LRBA case, 19 `EntityRelationshipType`s incl. `SECRETARY_OF`, `ShareParcel` with class/quantity/paid/CGT-date, `BeneficialOwnershipBasis.BARE_TRUST`).
  - The capture surfaces don't: API whitelist (`app/api/entities/route.ts`) + create dialog stop at the original 7 types and 5 roles; the only relationship-creation UI is the onboarding wizard skeleton (5 edge types); `ShareParcel` has **no writer anywhere**.
  - **Capability-regression discovery**: Phase 44 1c HAD a full relationship editor (`EntityDetailDialog` — add/end/delete + live `classifyEdge` validity preview); it was deleted 2026-05-31 with the legacy `EntityCanvas` retirement and the Wealth Universe's `EntityDetailPanel` never inherited it. Stage F is restoration + completion in the universe's design language, not greenfield — the rules engine, only-writer service, and API routes are all live.
- **The plan (4 PRs, one per sub-stage)**: F1 unlock the full entity-type grammar (API whitelist + two-tier "Common / More structures" picker + universe classification) → F2 "Roles & People" editor on My Structure (full 19-type grammar, end-dating, beneficial-ownership "actually held for…" row, live validity preview; Stitch-first) → F3 ShareParcel writer (nested route + parcel rows under shareholder/unitholder edges; dispose-never-delete for CGT history) → F4 onboarding-wizard fine-tune (same two-tier picker + optional per-entity "More detail" disclosure; D2 unchanged). Golden acceptance test `renewStructure.golden.test.ts` reproduces the Renew chart node-for-node.

### Files Modified
- `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` — §4 Stage F spec (gap matrix, F1–F4, F-G golden test, sequencing rationale, TRAIL mapping)
- `docs/IMPLEMENTATION_PLAN.md` — Stage F row added to the Phase 47 workstream checklist; Last touched updated

### Build Status
- Docs-only PR — no build-affecting changes (build verified green this session at WX.5.4).

### §17.2 post-merge verification — PR #1060 (WX.5.4)
- Prod deploy `dpl_6MLy28ed4rwHVbW1RaNMcdWMp1xJ` reached `READY` (2026-06-11 02:52:45), runtime logs clean — reported to Reza in session.

# Changelog — 2026-05-17

## Session: Phase 12 Track E — Conversational onboarding (plan only, no code)

Branch: `claude/ai-agent-setup-wizard-NL4XV`

### Scope

- **Type:** Design / plan (doc-only — no code, no schema, no migration, no runtime change in this PR)
- **Scope:** Onboarding — design for a parallel AI-agent + voice conversational input modality alongside the existing form-based wizard. Existing form wizard is NOT touched.
- **CDR scope:** N/A in this PR — design only. Future Track E implementation will inherit existing CDR sanitisation (`lib/security/cdrAuditCompliance.ts`), the existing audit-write pattern, and the existing `OnboardingState` security envelope. No new vendor or new data egress in v1 (Web Speech API only — no audio leaves the browser).

### Trigger

Reza directive 2026-05-17 (voice): build a parallel conversational + voice input mode alongside the existing form-based onboarding wizard; the agent asks the user in plain English, the user replies by text or mic; the agent extracts the structured answer, types on the user's behalf, and asks for confirmation; never hallucinate / never generate numbers; do not change or delete the existing wizard.

### Architect-mode synthesis

Converged on **"two front doors, one house"**: chat-mode is a parallel input modality over Track B's existing data contract — same `OnboardingState`, same `ReviewStep`, same `/api/onboarding/bulk-create`. Form-mode is unchanged. The agent has ONE tool (`extractWizardStepDelta`) and ONE write boundary (the existing `ReviewStep`). Per-topic recap confirmation (not per-field — feels less robotic). Voice via the browser-native Web Speech API for v1 — no audio leaves the device, no new CDR vendor.

### Changes Made

#### 1. `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (NEW — 12 sections)

Master plan doc for Track E. Twelve sections:

1. Why this exists (form abandonment, terminology friction, cognitive tax)
2. Hard rules (seven non-negotiable constraints: two-front-doors, no autonomous writes, no hallucinated numbers, per-topic confirmation cadence, Web Speech API only in v1, ReviewStep as the only write boundary, agent ≠ CFO)
3. What this is NOT (replacement / CFO / advice surface / new SSOT)
4. Phase breakdown E.0–E.6 (feature flag + toggle → gateway + extractor tool → conversational shell → per-topic recap cards → convergence on ReviewStep → audit + cost control → doc-sync)
5. Data contract (`WizardStateDelta` Zod schema + `OnboardingState.chatTranscript` server mirror + `source` tagging on bulk-create)
6. Voice I/O strategy (Web Speech API STT + optional Web Speech Synthesis TTS; text-only fallback; opt-in per turn)
7. Security, CDR, and AFSL boundary (full table of concerns and mitigations)
8. Risk register (10 items E-R1 to E-R10)
9. Open question for Reza (`Q-CONV-1` — STT v2 strategy, deferred)
10. Validation checklist (15 Track-E-specific items + parent doc's Track B items)
11. Files: stay / new / never-touched (canonical SSOT for which files Track E may touch)
12. Changelog

Sibling to existing `PHASE_12_SETUP_AND_ONBOARDING.md` (the form-wizard SSOT) — same pattern as the other Phase 12 docs (`PHASE_12_WIZARD_REDESIGN_PLAN.md`, `PHASE_12_ONBOARDING_TOUR.md`).

#### 2. `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` (parent — Related line added)

Adds a "Related" pointer to the new sibling doc with a one-paragraph explanation of the relationship: form-mode (Track B) is unchanged; chat-mode (Track E) is a parallel front door over the same data contract; this parent doc remains the SSOT for the form surface + data contract; the new doc is the SSOT for the chat surface.

#### 3. `docs/IMPLEMENTATION_PLAN.md`

- Header `Last updated:` flipped to 2026-05-17 with a paragraph summarising the architect-mode synthesis + the "two front doors, one house" model + the doc-only nature of this PR.
- New row 53 in `📋 Up Next` — Track E queued, trigger = "After CLAUDE.md §16 doc-sync block lands + Reza green-light to start E.0".
- New open question `Q-CONV-1` (STT provider for v2 of the conversational onboarding agent) — Claude recommendation = stay on Web Speech API until v1 feedback shows quality is the blocker; not blocking v1.
- Open-questions summary line refreshed to include Q-CONV-1.

### Files Modified

- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — NEW (~700 lines)
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` — Related line added (no other changes)
- `docs/IMPLEMENTATION_PLAN.md` — header updated, Up Next row added, Open Question added, summary refreshed
- `docs/changelog/CHANGELOG_2026_05_17.md` — NEW (this file)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] strategic decision (new workstream queued, new Open Question opened)

Docs updated in this PR:
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — NEW master plan for Track E
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` — Related line added
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 53 + Open Question Q-CONV-1 + header
- `docs/changelog/CHANGELOG_2026_05_17.md` — this file

### Build Status

- N/A — doc-only PR, no code touched, no build implications.

### Validation

- [x] No code changes — verified by `git diff --stat` (docs/ only).
- [x] No schema changes — `prisma/schema.prisma` not touched.
- [x] No migration files added — `prisma/migrations/` not touched.
- [x] No CDR data flow changes — design only.
- [x] §12.11 destructive-write checklist — N/A by structural argument (no Prisma write in this PR).
- [x] §12.12 schema-deploy protocol — N/A (no schema change in this PR).
- [x] §16.5 doc-sync block — included in PR description (above).

### What's NOT in this PR

- No code. No schema. No migration. No runtime change.
- Existing `/onboarding` form wizard is byte-for-byte unchanged.
- Track E build (E.0–E.6) does not start until Reza explicitly green-lights.
- Q-CONV-1 (cloud STT for v2) deferred until v1 user feedback signals quality is the blocker.

### Why this matters (4-lens synthesis)

- **Architect lens:** Track E reuses Track B's data contract, write endpoint, and review surface. Zero new SSOT. The "two front doors, one house" pattern keeps CLAUDE.md §12.2 honest — no duplicate wizard, no duplicate bulk-create, no parallel calc engine.
- **Behavioural-psychologist lens:** form-based wizards punish users who don't know terminology or feel overwhelmed by field count (the two largest abandonment triggers in fintech onboarding). A conversational agent translates between user-language and system-fields without forcing the user to learn the vocabulary. Per-topic recap (not per-field) avoids the robot-reading-back-a-survey feel.
- **Financial-adviser lens:** strict no-hallucination rule + ReviewStep as the second checkpoint = no false-precision risk in the data the user starts with. The agent records what the user said; it never volunteers numbers.
- **Security / compliance lens:** Web Speech API only in v1 = no audio leaves the device, no new vendor, no new credential surface, no new CDR egress audit. AFSL boundary preserved structurally (no advice tool registered). Chat transcript persists in the same security envelope as the existing onboarding data and is deleted by the existing CDR data-lifecycle sweep.

### PR

- Branch: `claude/ai-agent-setup-wizard-NL4XV`
- PR: to be created after Reza's review of the plan.

https://claude.ai/code/session_01LpdUbW5rvNZc67oJ1us4Wo

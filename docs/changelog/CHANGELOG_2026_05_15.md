# Changelog — 2026-05-15

## Session 1: Step 1.6 first scheduled morning run successful (Day 1 of 3)

Branch: standalone observation, no commits (until Day 3 / DONE).

The cron published last night fired automatically at 06:45 Sydney. Digest landed in `admin@monitrax.com.au` Primary inbox (Gmail filter caught the self-send routing). Quality reviewed through the four lenses — **both prompt-improvement candidates from yesterday self-resolved in the wild without intervention:**

| Yesterday's gap | This morning's output |
|---|---|
| Self-referential — Claude told Reza to "fix the failing workflow" not knowing it's the digest | ✅ *"Both errors are from this digest workflow itself (jQWmSbqEvY3vkAy2)... I should self-diagnose"* |
| TZ confusion — said "yesterday morning" for same-day errors | ✅ *"triggered manually at 21:06 and 21:09 Sydney time last night (Thu 14 May)"* |

ONE PATTERN today: *"Both workflow failures were manual runs at night — suggests you were testing, not a scheduled breakage."* Genuinely insightful.

**Day 1 of 3 toward Step 1.6 ✅ DONE.** Days 2 + 3 are Sat 16 May + Sun 17 May.

---

## Session 2: GTM Step 1.2 — Airtable CRM DONE

Branch: `claude/gtm-step-1-2-airtable-crm`

### Scope
- **Type:** Feature (operational tooling, not product code)
- **Scope:** GTM CRM SSOT — first production consumer is the Founder Daily Digest CRM ACTIVITY section
- **CDR scope:** Out of scope — Airtable holds operator/CRM data only, no CDR data

### What was done

**Airtable CRM live.** Base `Monitrax CRM` at `airtable.com/appEDHNU0mtbWznHp` — system of record for every later GTM workflow.

- **7 tables built** (one extra beyond v1 spec):
  - `Leads` — raw imports, unverified
  - `Contacts` — verified humans
  - `Companies` — generic
  - `Brokerages & Employer Orgs` — extra table, decision deferred to first real broker contact
  - `Deals` — 8-stage pipeline
  - `Reviews` — paid Financial Health Reviews (AU$197 default per Q-GTM-1)
  - `Activities` — every touch logged; queried by the digest
- **Linked records** properly single-link except `Activities.Contact` (multi-link for meeting-style entries)
- **PAT** `n8n-monitrax-crm` — least-privilege (3 scopes, base-restricted)
- **n8n credential** `Airtable - Monitrax CRM` (Airtable Personal Access Token API type)
- **Digest workflow updated via Chat-Claude** (MCP):
  - `[STUB] Airtable Activities` HTTP node replaced with real Airtable Search-Records node
  - Filter formula: `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))`
  - Connected: Schedule Trigger → Airtable node → Merge (numberInputs bumped 2 → 3)
  - Compose Context extended with `airtable_activities_json`
  - Claude system prompt extended with **CRM ACTIVITY** section between WORKFLOW HEALTH and AWAITING DATA — groups by Direction (Inbound first), orders by Created desc, caps at 8 items with "+N more in CRM" overflow, skips pure Status Change entries unless they advance a deal stage. "Airtable Activities (Step 1.2 - CRM)" removed from pending-sources list.

### End-to-end production test
- Sonnet 4.6, 1,232 input / 411 output tokens
- Cost: ~AU$0.005 per run
- Email landed in `admin@monitrax.com.au`
- CRM ACTIVITY rendered "No CRM activity in the last 24h" — the one real Activity record was a pure Status Change, correctly filtered by the prompt rule. Empty-state path verified.

### Side cleanup
- **Airtable AI augmentation fields deleted** — `Summary (AI)` / `Next Suggested Action (AI)` / `Sentiment (AI)` were throwing `emptyDependency` errors on records with empty `Body`. Not in v1 spec, not used by the digest, removed for cleanliness. Re-add later if needed when real Body content flows in.

### Architectural decisions
1. **PAT scoped to ONE base, never "all current and future bases"** — least-privilege principle. If the PAT leaks, blast radius is the CRM only, not every future Airtable base.
2. **Single-link by default on Linked Record fields** — Airtable's default is multi-link; we explicitly turned it OFF for join fields (Leads.Company, Contacts.Company, Deals.Company, Reviews.Contact). Multi-link kept only for `Activities.Contact` (meetings can have multiple attendees).
3. **Filter at the Airtable query, not the Claude prompt** — `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))` filter formula runs on Airtable's side, returning only last-24h records. Cheaper than pulling everything and filtering in n8n / Claude. Same pattern as the Gmail noise filter from Step 1.6.
4. **CRM ACTIVITY positioned BEFORE TOP 3 ACTIONS in the digest** — the prompt section order is psychologically deliberate: things-that-changed (Inbox, Workflow, AWAITING DATA, CRM) come first, THEN top actions. Reza reads context → decides → doesn't read action without context. Don't reorder without thinking.

### Files modified in this PR

- `docs/marketing/GTM_EXECUTION_PLAN.md` — Step 1.2 fully expanded with build details, credentials inventory, gotchas, deferred scope
- `docs/marketing/GTM_TOOL_STACK.md` — Airtable 🟡 → 🟢 Active 2026-05-15; **new "What's live RIGHT NOW" at-a-glance section** added at top (per Reza directive: "the number of apps is getting overwhelming")
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed; workstream 0d Phase 1 checkbox annotation updated
- `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — Airtable Activities branch added to architecture diagram + credentials inventory + common-failure-modes
- This file — two sessions captured

### Build status
- Doc-only. No app code, no schema, no migration.

### Painful lessons memorialised
1. **Airtable renamed "bases" to "apps"** in the UI. Same concept, new word. "Build an app on your own" creates a new blank base.
2. **Default Linked Record allows MULTIPLE records.** For most join fields you want single-link — flip the toggle OFF on creation.
3. **Personal Access Tokens replaced API keys** in Airtable. Old API-key URLs throw 404. Use `airtable.com/create/tokens`.
4. **Airtable AI augmentation fields are eager** — they error when their dependency field is empty. Don't add them until real content is flowing.
5. **The "What's live right now" section in GTM_TOOL_STACK.md** exists specifically because the long table of planned-vs-active tools was hard to scan. Future-Reza thanks current-Reza.

### Next Steps
1. Saturday + Sunday: cron runs automatically; observe 2 more mornings → Step 1.6 ✅ DONE
2. Optional now: Step 0.1 (AFSL boundary doc) — 30 min draft + park for lawyer
3. Optional weekend prep: Step 2.1 (lock broker ICP) + Step 2.2 (Apollo lead-list scope) — both pure-thinking work, no tools needed

---

## Session 3: GTM Step 0.1 — AFSL boundary doc DRAFT shipped

Branch: `claude/gtm-step-0-1-afsl-boundary`

### Scope
- **Type:** Compliance / operational documentation
- **Scope:** GTM Phase 0 prerequisite — defines the legal boundary for the paid Financial Health Review service
- **CDR scope:** Out of scope — this document defines what the Review can/can't SAY, not how data flows. CDR rules (Part 13) still apply orthogonally to any data the Review uses.

### What was done

**Document drafted:** `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` — 11 sections, ~400 lines.

Coverage:
1. The legal premise in one paragraph (Corporations Act §766B; the general advice / personal advice / personal advice's "reasonable person" test trap)
2. What the Review IS — factual analysis, benchmark comparison, gap identification, TRAIL-stage observation, generic class-level information, questions for customer to consider, pointer to licensed advice
3. What the Review IS NOT — no specific product recommendations, no personal investment / tax / insurance / property / debt / estate / legal advice, no predictive product-performance claims, no language implying personal advice
4. DO say / DON'T say cheat-sheet — 9 financial topics, side-by-side patterns
5. Verbatim top + bottom disclaimer blocks + customer acknowledgment for the intake form
6. Operator (Reza or VA) pre-delivery checklist — 11 boxes, gates every Review
7. Escalation guidance — when to remove a statement, when to ask a lawyer, when NOT to ship
8. What changes when the AFSL-partner upsell goes live (nothing in this doc; the partnership is a separate service)
9. Primary-source references — Corporations Act §766B, ASIC RG 244 / 175 / 36, MoneySmart, TPB, Barefoot Investor as tone model
10. Status / ownership / annual review cadence
11. Explicit "this document is NOT legal advice" disclaimer about itself

### Validity matrix
- ✅ **Reviews #1–5 to friendlies** — OK to ship against this draft (they sign §5.3 acknowledgment, understand it's friend-rate + draft-policy)
- 🚫 **Reviews to non-friendly strangers** — NOT VALID until lawyer review (Q-GTM-5 must close)

### Reza-side lawyer review action item
- Budget: ~AU$2–5k one-off
- Candidate firms: Sophie Grace (fintech specialist), Holding Redlich, Gilbert + Tobin's fintech team
- Brief: (a) review this document; (b) review one sample Review draft; (c) sign off on disclaimer wording; (d) recommend structural changes
- Ongoing: ~AU$500–1k/yr re-review when framework changes

### Architectural decisions
1. **Conservative-side framing throughout.** Default to factual statements + benchmark references + "speak to a licensed adviser" pointers, never personal recommendations. The lawyer's job is to confirm or tighten, never to loosen.
2. **TRAIL framework as the educational scaffold.** TRAIL is a non-product, non-personal-recommendation framework — using it as the Review's structural backbone keeps the doc cleanly on the general-information side.
3. **Disclaimers verbatim, never paraphrased.** §5.1 + §5.2 give exact wording. Operators don't get to rewrite the legal-safety-net text.
4. **Doc is referenced by downstream Step 3 sub-steps** (intake form, Claude-drafted report system prompt, QA + deliver checklist) so they inherit the boundary discipline by reference rather than re-defining it.

### Files modified in this PR
- `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` — **new file** (~400 lines)
- `docs/marketing/GTM_EXECUTION_PLAN.md` — Step 0.1 expanded to full 🟡 DRAFT SHIPPED entry with validity matrix + lawyer-review action item
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed for evening doc-PR
- This file — Session 3 entry

### Build status
- Doc-only. No app code, no schema, no migration.

### Painful lessons memorialised
1. **The "reasonable person" test is the trap.** Even when you think you're giving general advice, if a reasonable person would expect you to have considered the customer's specific circumstances (and the Review literally has their data!), the statement may be construed as personal advice. Hence the discipline: state facts, point at education, NEVER prescribe.
2. **Specific product names are the bright line.** ING, AustralianSuper, VAS, your-bank-by-name — the moment any of these appear in a Review, you've crossed into personal advice. Class-level mentions ("high-interest savings accounts", "diversified Australian equity ETFs") are fine.
3. **Personal tax advice requires SEPARATE registration (TPB) — AFSL doesn't cover it.** Even with an AFSL, telling a customer to claim a specific deduction or salary-sacrifice $X is tax agent territory.
4. **The Barefoot Investor model is the tone reference.** Scott Pape operates at massive scale in this exact safe zone — principle-driven, never named-product (except his disclosed ones), always points readers at licensed advisers for personal decisions. Read his disclaimers + follow the model.

### Next Steps after parking
1. Reza reads `REVIEW_SCOPE_AND_BOUNDARIES.md` end-to-end (twice, per the original spec)
2. Reza schedules an initial chat with an AU fintech lawyer (low priority — only blocks Review #6+ to strangers, ~weeks away)
3. Saturday + Sunday: digest cron runs on autopilot
4. Monday: Step 1.6 → ✅ DONE in a small follow-up commit; choose next active work (Step 2.1 broker ICP, or revisit lawyer scheduling)

---

## Session 4: GTM workstream 0f — Friendlies private beta playbook shipped

Branch: `claude/gtm-0f-friendlies-playbook`

### Scope
- **Type:** Operational playbook / growth ops
- **Scope:** GTM workstream `0f` (Friendlies private beta) — drafts the operational doc Reza will use to onboard 5–10 friendlies to the demo-ready Monitrax app for feedback, ahead of broader launch
- **CDR scope:** Out of scope — friendlies use the app's existing pre-Basiq manual flow (no live CDR data feeds today; CDR Part 13 applies orthogonally once Basiq is live)

### What was done

**New file:** `docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md` — ~14 sections covering:

1. Why this exists + the 3 sequenced purposes (feedback → testimonials → referrals)
2. The stack (Reza's personal Gmail + Airtable + app's built-in Feedback system — NOT Smartlead, NOT Loops, NOT n8n; explicit "automation is the enemy at 5–10 humans")
3. The new `Friendly stage` single-select field to add to Airtable Contacts (8 lifecycle stages: Invited → Signed up → Active → Feedback given → Testimonial received → Referred someone → Lapsed → Declined) + `🤝 Friendlies pipeline` view spec
4. The 6-step playbook (pick → add to Airtable → personalised 1:1 invite → log → manage replies → sequenced asks)
5. What "feedback" actually means — listening for stories, not running surveys; 3-line take-aways per call
6. **The invitation email template** (verbatim, with personalisation guidance + a "why each line is there" annotation)
7. **The 2-week follow-up email template** (proposes 3 concrete time slots — Cal.com overkill at this volume)
8. **The re-engage email template** (send once, then move to Lapsed; protects the friendship)
9. **The testimonial-ask template** (week 4–6, only if positive engagement)
10. **The referral-ask template** (week 8–12, only if still actively using)
11. **The failure-modes catalogue** (sign-up-no-engagement, negative feedback, AFSL boundary crossing, "how much will this cost?", "can I refer someone?", ASIC-tangent feedback) — 7 scenarios with handling guidance
12. The weekly 15-min ops rhythm (Sunday/Monday review of the Airtable pipeline view)
13. What this means for the broader GTM plan (friendly testimonials → Phase 4 broker pitches; friendly feedback → product priorities; friendly referrals → D2C top-of-funnel pre-Phase-6)
14. References to all related docs (workstream `0f`, AFSL boundary doc §7, GTM tool stack confirming what NOT to use, etc.)

**`IMPLEMENTATION_PLAN.md` workstream `0f` expanded** — flipped from 📋 QUEUED to 🟡 PLAYBOOK SHIPPED; added canonical-doc reference; added stack-summary (no new tools); added 6-step playbook summary; updated Scope checklist (ticked off the 3 drafting tasks completed in this session, kept open the Reza-side tasks of picking the friendlies + verifying new-user flow + sending invite #1); added AFSL boundary cross-reference; added four-lens "why-this-matters" block.

### Architectural decisions
1. **Manual stack only at this volume.** Per CLAUDE.md §0.4 restraint principle: 5–10 humans = automation is more cost than benefit. Reuse what exists: Airtable + Gmail + app's Feedback system.
2. **Personal email, not automation.** Even though Smartlead is wired and Loops is queued, friendlies need 1:1 personal voice. Sending warmth via cold-outbound infrastructure breaks the relational frame.
3. **In-app Feedback system as the feedback channel** (NOT a separate form). Less context-switching for the friendly; one feedback inbox for Reza at `/admin/feedback`; channels through the Phase 33g surface that already exists.
4. **Sequenced asks across 12 weeks.** Feedback (week 0–2) → Testimonial (week 4–6) → Referral (week 8–12). Asking for all three on day one would feel transactional and burn trust.
5. **Verbatim email templates with annotations** so future-Reza (or a VA) can use them confidently AND know which lines to NOT change.
6. **AFSL boundary cross-reference baked in.** If a friendly asks for personal financial advice in the feedback call, the same discipline from `REVIEW_SCOPE_AND_BOUNDARIES.md` §7 applies — "speak to a licensed adviser". The friendlies cohort is a LOWER-risk surface than the paid Review service (they're using the app, not buying advice) but the operator habit is the same.

### Files modified in this PR
- `docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md` — **new file** (~14 sections, ~600 lines including all 5 email templates)
- `docs/IMPLEMENTATION_PLAN.md` workstream `0f` — expanded to 🟡 PLAYBOOK SHIPPED with stack summary, 6-step playbook, AFSL cross-reference, four-lens why-this-matters
- This file — Session 4 entry appended

### Build status
- Doc-only. No app code, no schema, no migration.

### Painful lessons memorialised
1. **At 5–10 humans, automation is the enemy.** The temptation to wire an n8n workflow / Loops sequence / Smartlead campaign for the friendlies is real and wrong. Personal Gmail + manual Airtable entries is the correct level of infrastructure. The cost is 15 min/week of operator time; the value is friendlies feel personally selected.
2. **Sending friendlies an email from `admin@monitrax.com.au` via Smartlead would FEEL cold.** Even though the email content could be identical, the relational frame breaks when the infrastructure is the cold-outbound stack. Use Reza's personal Gmail (or `admin@` directly, as long as it's manually composed 1:1, not blast).
3. **Give people a free out.** The line *"If you're not interested, just say so — no awkwardness"* counterintuitively raises the yes-rate by removing social pressure. Cialdini-friendly. Protects the friendship.
4. **Sequenced asks > combined asks.** Asking for feedback + testimonial + referral on day one signals transactional intent and burns trust. Spreading across 12 weeks signals authentic interest.
5. **In-app Feedback system was waiting all along** (Phase 33g already shipped). Re-using existing infrastructure beats inventing a new feedback surface every time.

### Next Steps (Reza-side, no rush)
1. Add the `Friendly stage` single-select field to Airtable Contacts (30 sec) + create the `🤝 Friendlies pipeline` view
2. Verify the new-user flow on `monitrax.com.au` end-to-end (sign up → onboarding wizard → first TRAIL "Track" win → add accounts/income/spending manually → Feedback affordance works) — fix anything broken before sending invite #1
3. Pick the 5–10 friendlies (Q-GTM-7 — quality > headcount; spread across TRAIL stages)
4. Send invite #1 (template in playbook §6 — personalise first line)
5. Log every touch in Airtable Activities (the Founder Daily Digest's CRM ACTIVITY section will surface friendly engagement automatically once Activities start populating)
6. Weekly 15-min ops review (playbook §12)

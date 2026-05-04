# Lighthouse Adviser Pitch — Demo Playbook

> **Status:** SCAFFOLD — populated incrementally as the demo-complete build progresses (Up Next #34). Each section gets filled in by the engineer who ships the corresponding feature, so the playbook stays in lockstep with what actually works in the demo environment.
>
> **Audience:** Reza (or future Monitrax founder/sales person) walking a single Australian financial adviser through a 25–30 minute screen-share demo, with the goal of converting them into Monitrax's first design partner.
>
> **Last updated:** 2026-05-04 — Steps 2 + 3 populated as Phase 32B PR3 (drill-in canonical client view + adviser overlay) ships. Step 3 still gates on Phase 41a–c (entity schema + tree); Step 2 is fully demonstrable today.

---

## Why this document exists

The lighthouse adviser pitch is the single highest-stakes meeting in Monitrax's commercial life. It happens once per adviser. Either they leave the meeting saying *"this is the most thoughtful thing I've seen — when can my clients use it?"*, or they leave saying *"nice, but I have XPLAN."* The difference is preparation.

This playbook codifies the demo into a runnable script so:

1. **Every pitch lands consistently** regardless of who runs it
2. **The narrative is sequenced for maximum emotional impact** (not feature order)
3. **Common objections have pre-prepared responses** that don't break flow
4. **Post-pitch follow-up is structured** so adviser interest converts to commitment

---

## 1. Pre-pitch checklist (30 min before the meeting)

- [ ] **Demo environment status verified** — `monitrax-db-pitch` instance is up, OR the seeded users on dev are accessible and unmodified since last seed run
- [ ] **Three archetype users seeded and verified** (per `lib/portal/practice/lighthousePitchArchetypes.ts` — to be created in Phase 41 PR3 / pitch fixture seed PR):
  - [ ] **Sarah Kim** (sole-trader investor) — 1 property + Sarah Kim Pty Ltd; TRACK stage; cashflow turning negative; emergency fund <1mo
  - [ ] **David Mei + Emma Liu** (family with trust + SMSF) — 3 properties (1 PPR + 2 investment via Family Trust + 1 in SMSF); REDUCE stage; refinance window opening on PPR; SMSF contribution headroom remaining
  - [ ] **Olivia Novak** (multi-entity HNW) — 4 properties across personal + Discretionary Trust + Unit Trust + Pty Ltd + SMSF; INVEST stage; tax position -$38,900 YTD; 11 months emergency fund; entity tree shows the full complexity
- [ ] **Adviser org seeded** — "Smithfield Wealth Advisers" Practice tier, Reza as PORTAL_OWNER, marketplace listing approved, profession = `FINANCIAL_ADVISOR`
- [ ] **Adviser-side credentials ready** — login as Reza @ Smithfield, `/portal/dashboard` loads with all 3 archetype clients linked + alerts populated
- [ ] **Consumer-side credentials ready** — login as Sarah, dashboard loads, AI Guide returns advice, Ask-a-Pro button is wired
- [ ] **Screen-share rehearsed** — 25-min flow run end-to-end at least once today, no surprises
- [ ] **Pricing sheet open in a tab** — Studio AU$199/mo + add-ons + lead-fee tiers (in case adviser asks)
- [ ] **Recording consent confirmed with adviser** if the meeting is being recorded
- [ ] **Browser tabs cleaned** — only Monitrax + pricing tab visible; close personal tabs, Slack, email
- [ ] **Notifications silenced** — DND mode on Mac/Windows; no Slack pings during demo
- [ ] **Backup plan if WIF / DB hiccups** — second browser logged in to the seed; mobile hotspot ready if home wifi flaps
- [ ] **In-app `?` help drawer reachable from every page** — Phase 33b shipped 2026-05-04. The drawer sits at top-right of every consumer + portal page, opens with the article most relevant to the current route, and surfaces audience-scoped search + "Open full Help Center →" link. If the adviser asks "what does TRAIL mean again?" mid-demo, hit `?` on `/dashboard/cfo` and the TRAIL explainer opens inline — no tab-switching, no narrative break. Verify the `?` button renders on `/portal/dashboard` and `/dashboard` before the call.

---

## 2. The 25-minute demo flow

> *Sequence is emotional, not feature-ordered. Each step opens a feeling: relief → recognition → revelation → resolve.*

### Step 0 — Open with the adviser's pain (2 min)
- Don't show the product yet
- Ask: *"Walk me through how you keep track of your client book today."*
- Listen. Note their words. They will name 2–3 of: *spreadsheets / XPLAN / email / "in my head" / "I know I'm losing things"*
- Affirm without selling: *"That's what every adviser I've spoken to says. Let me show you what I've been building."*
- **TO BE WRITTEN AS BUILD COMPLETES:** specific opening lines + adviser objection categories observed in pre-launch conversations

### Step 1 — Practice dashboard (3 min)
- Open `/portal/dashboard` logged in as Reza @ Smithfield Wealth
- Frame: *"This is what you'd see at 8am Monday morning. 50 clients on your book, 8 needing your attention today, 3 advanced a TRAIL stage this week."*
- Walk the KPI strip top-to-bottom. Pause on `Needs attention: 8` — *"This number is your day. Reactive becomes proactive."*
- Scroll to the alert stream. Read out the first 2 alerts in plain language: *"Sarah Kim — emergency fund below 1 month. David Mei — TRAIL stage advanced TRACK to REDUCE. We caught these before you needed to."*
- **TO BE WRITTEN AS BUILD COMPLETES:** screenshot reference + verbatim narration script + adviser-observed reactions to populate

### Step 2 — Drill into a client (4 min)
- From the Practice dashboard, click **Sarah Kim's** row in the alert stream (or her row in the client book table)
- The route flips to `/portal/clients/[id]/view`. The canonical consumer dashboard renders left, with the **adviser overlay** docked right on desktop / collapsed to a bottom-sheet "Adviser view" peek bar on mobile (tap to expand)
- **Frame the parity moment first:** *"This is exactly what Sarah sees when she logs in. You're looking at the same thing, side-by-side. That's why I built it this way — when you're on a Zoom with her, you both have the same picture, the same numbers, the same recommendations. There is no second admin app for you."*
- **Walk the canonical primitives in this order, narrating as you go (90 seconds total):**
  1. **KPI strip** (Net worth / Cashflow / Liquid cash / Savings rate) — *"Headline numbers. Colour-coded by tone — emerald positive, rose negative."* Pause briefly on cashflow if it's negative.
  2. **Health card** — *"Composite 0–100 with a letter grade. Four drivers underneath."* Read the lowest driver out loud.
  3. **Cashflow tile** — *"Income / Expenses / Cashflow at a glance. Net inside gross. Same engine that runs her dashboard."*
  4. **Property portfolio list** — *"Each property with current value, LVR, yield, and monthly cashflow on the right. Click-through opens the property detail."*
  5. **Debt card** — *"DTI prominent in the badge. Total debt, monthly repayments, weighted rate."*
  6. **Investments / Tax / Emergency fund** — scroll past quickly unless the adviser is leaning in
- **Then turn to the adviser overlay (right rail / bottom sheet):**
  - **Scope panel** — *"Sarah granted us six scopes. The ones missing — say, INVESTMENTS — render as locked tiles in the dashboard so I can see what to ask her to extend next, without leaking anything she didn't share."*
  - **Last review** — *"Timestamp of the last time anyone in your firm opened her view. Audit-grade. Compliance trail starts here, not in a spreadsheet."*
  - **Notes panel** — *"Five most recent notes. Pinned ones first. Click-through to her full notes thread."*
  - **Tasks panel** — *"Open tasks first, colour dot for priority. Due dates inline."*
  - **Compliance footer** — read it out loud verbatim: *"Acting under AFSL authorisation. This view supports analysis and advice; product recommendations remain a Statement of Advice deliverable."* — *"That's not boilerplate I added. That sentence is profession-aware — it changes if you're a broker or an accountant. The AFSL line is enforced architecturally, not editorially."*
- **The architectural moment to plant:** *"I want to flag one thing for your CTO if you have one. The data filtering for what you can see is enforced in the financial engine, not in the UI. So even if I had a bug in this overlay that tried to render LOAN data Sarah didn't grant, the snapshot service would have stripped it before it left the database. That's the kind of plumbing your compliance team will ask about — and the answer is in our docs at `/help/compliance/cdr-consent-walkthrough`."*
- **Backup if a tile renders empty:** the demo dataset has Sarah Kim with FULL scope — if anything is empty, switch to David Mei or open her dashboard as the consumer (second browser) to verify, then resume.

### Step 3 — Open the entity tree (THE moment) (3 min)
- **Pre-condition:** Step 3 lights up properly only after Phase 41a–c lands (entity schema + tree + per-entity snapshot wiring). Until then, the drill-in surface from Step 2 is the closer for the dashboard portion of the pitch — Step 3's entity-structure narrative belongs in the second meeting.
- Click **"My Structure"** in Sarah's sidebar (Phase 41 ships this nav item)
- Entity Tree renders: Sarah Kim (person) → Sarah Kim (personal name entity) → Sarah Kim Pty Ltd → 1 property
- Frame: *"Sarah's structure is simple. Watch this."*
- **Switch advisers** by clicking "Back to clients" in the page header (top-left), then click **Olivia Novak's** row from the alert stream — this round-trips through `/portal/clients/[id]/view` cleanly, so the adviser sees that drilling between clients is one click, not a re-navigation
- Open Olivia's Entity Tree: Olivia → personal name → Discretionary Trust → Unit Trust → Pty Ltd → SMSF → 4 properties spread across them
- *"This is what your high-net-worth clients look like in real life. No platform you're using today shows this. None."*
- **WAIT for the lean-forward moment.** This is where the adviser commits emotionally.
- **Entity tree visual reference (post-Phase-41c).** Top-down `react-flow` hierarchy on a warm-ivory canvas: People (household members, top row) → Entities (stage-coloured Apple-glass tiles per `LegalEntityRole` — PERSONAL warm sand, HOLDING indigo, OPERATING emerald, SUPERANNUATION amber, INVESTMENT plum) → Assets attached below each entity. Edges show ownership %; trustee→trust corporate links rendered as dashed lines (the `parentEntityId` self-FK from `LegalEntity` powers this). Click a node → entity drill-in dialog with assets / income / expenses / per-entity tax position. The full-screen visual is the screenshot Reza pulls into the deck for slide 2 of the pitch — the *moat* image. Tile language: warm AU real-language ("Smith Family Trust", not "Trust 1"; "Olivia & Co Pty Ltd as trustee", not "Corporate Trustee Entity").
- **Best 3-archetype users for the demo (per Up Next #33):**
  - **Sarah Kim (sole trader)** — minimal tree (Sarah → Personal → Sarah Kim Pty Ltd → 1 IP). The "before" picture. Use this to set the bar low so Olivia lands harder.
  - **David Mei + Emma Liu (family with trust + SMSF)** — mid-complexity tree (David + Emma → Personal × 2 → Mei Family Trust [trustee: Mei Family Holdings Pty Ltd] → 3 IPs + Mei SMSF → super contributions). The "most of your clients look like this" picture.
  - **Olivia Novak (multi-entity HNW)** — full tree (Olivia → Personal → Discretionary Trust + Unit Trust + Olivia Investments Pty Ltd + Novak SMSF → 4 IPs spread across them with cross-ownership %). The "category-creating" picture — this is the slide that wins the meeting.
- **Demo sequencing rule:** Sarah first (warm-up — adviser sees "OK, neat"), David+Emma second (recognition — *"yeah this is most of my book"*), Olivia third (emotional commit — *"I have been needing this for ten years"*). Don't reverse the order; complexity-first kills the build.
- **The bridge back to Step 2:** even before "My Structure" lights up, the Step 2 drill-in already shows the adviser the parity moment + scope filter + compliance footer + audit trail. The entity tree is the *visual* climax; the drill-in is the *operational* foundation that makes the entity tree consumable to a working adviser. Don't skip Step 2 to get to Step 3 — Step 2 is the *"I trust this product"* moment, Step 3 is the *"I need this product"* moment.
- **TO BE WRITTEN AS BUILD COMPLETES (post-41c):** verbatim adviser quote bank captured during the first 3 lighthouse pitches — both the visceral reactions (*"oh wow"*, *"how do you have this"*, *"can my whole firm see this?"*) and the AFSL-edge anxiety (*"is the AI giving advice from this?"* — answer in Step 5).

### Step 4 — Money flow Sankey (2 min)
- Stay on Olivia
- Click "Money Flow" tab
- Sankey lights up: salary + rent + dividends + distributions on the left → flowing through Trust + SMSF + personal → out to consumption + tax + savings + investment on the right
- *"This is where Olivia's money actually goes. Right now this conversation happens on a whiteboard with you and her every six months. Now it's live."*
- **TO BE WRITTEN AS BUILD COMPLETES:** Sankey storytelling script + which flow to highlight to adviser-of-each-discipline

### Step 5 — AI advice with entity awareness (3 min)
- Open AI Guide on Olivia's view
- AI says (paraphrased): *"Your trust holds property X with $300k unrealised CGT. Div 115 50% applies after 12 months. General information only — recommendations are your adviser's call."*
- Frame: *"The AI is licensed to give general information, not personal advice. Personal advice is yours. The AI does the diagnostic work; you do the strategic work."*
- **The AFSL story lands here.** If the adviser is going to push back on AI, this is where they say it. Be ready.
- **TO BE WRITTEN AS BUILD COMPLETES:** AFSL objection-handling flowchart + scripted responses

### Step 6 — Ask-a-Professional in action (3 min)
- Switch to a SECOND screen / browser logged in as Sarah Kim
- Show Sarah's AI Guide page on her dashboard
- Click "Ask a Professional" → marketplace picker shows 3 best-fit (Smithfield Wealth featured)
- Sarah picks Smithfield, composes a question (e.g. *"Should I refinance my offset?"*), submits
- Switch BACK to Reza @ Smithfield's screen
- Practice → Inbox tab — the request lands instantly with Sarah's snapshot context attached
- *"This is your acquisition channel. Pre-qualified, financially-engaged user who has already done the data entry. Your CAC just dropped from AU$2,000 to AU$150."*
- **The CAC story lands here.** Watch for the second lean-forward.
- **TO BE WRITTEN AS BUILD COMPLETES:** lead-fee pricing tier breakdown + how to handle "what if I don't accept the lead?" objection

### Step 7 — Conversation thread (2 min)
- In the Practice inbox, click Sarah's request
- Thread opens. Type a reply. Hit send.
- Switch back to Sarah's screen. She has the message in-app + an email arrived
- Reply from her email client (don't switch back to in-app)
- Switch to Reza's Practice inbox — the reply landed in the thread, marked `EMAIL_REPLY_IN`
- *"Your client communicates the way they're comfortable. You communicate from your normal email. Both happen in one thread, archived for compliance for 7 years."*
- **TO BE WRITTEN AS BUILD COMPLETES:** SendGrid setup screenshot + retention policy explanation if asked

### Step 8 — Compliance pack (2 min)
- Open `/help` (or `help.monitrax.com.au` once subdomain ships) → scroll to "Compliance & regulators" section
- Click into the **CDR Consent Walkthrough** article
- Walk the adviser through the three sections that matter most for their compliance team:
  - **"Three layers of consent — never collapsed"** table (CDR consent / Professional consent / Per-view access event) — frame: *"Your compliance team will ask exactly this question. The answer is right here, dated, reviewed."*
  - **"User-initiated revocation"** flow — frame: *"This is the OAIC NDB question. We delete within 24 hours, no soft-delete, audit log written. Done."*
  - **"Database access"** section (WIF + Cloud SQL Connector + IAM auth, no static credential) — frame: *"This is what closes CDR §3.2. Your compliance team won't have heard another fintech describe this with this much specificity."*
- Frame the broader pack: *"Send this URL to your compliance team — `[your-monitrax-instance]/help`. Every concern they will raise is documented here, dated, with the source-of-truth doc cross-referenced. It saves the back-and-forth that usually kills a vendor evaluation."*
- Note that PDF export per article + ZIP bundle export ("CDR Compliance Pack" all-in-one) ships in Phase 33c — single-click compliance pack download for the auditor's evidence file. Currently article links work; downloadable pack is the next slice.

**Compliance pack table of contents (Phase 33a SHIPPED 2026-05-04 + Phase 33d SHIPPED 2026-05-04):**
| Article | Status | Audience | Compliance class |
|---|---|---|---|
| CDR Consent Walkthrough | ✅ Live | compliance | cdr |
| Data Retention Schedule | ✅ Live | compliance | cdr |
| Incident Response Plan summary | ✅ Live | compliance | general |
| Architecture Overview for Compliance Officers | ✅ Live | compliance | general |
| ASIC RG 244 / RG 36 boundary statement (AI is general-info-only) | ✅ Live | compliance | afsl |
| Data Handling Policy summary | ✅ Live | compliance | privacy |
| Inviting your first client | ✅ Live | org-admin | general |
| What is the TRAIL framework? | ✅ Live | consumer | general |

**Common regulator-side questions and where to point them:**
- *"How is consent obtained?"* → CDR Consent Walkthrough §"The consent grant flow"
- *"What happens when consent is revoked?"* → CDR Consent Walkthrough §"User-initiated revocation"
- *"How long is data retained?"* → Data Retention Schedule §"Retention table — by data category"
- *"Where is the data stored, and who can access it?"* → Architecture Overview for Compliance Officers §"Database access — no static credential" + CDR Consent Walkthrough §"Encryption"
- *"What's the breach notification process?"* → Incident Response Plan Summary §"Breach notification timelines" (auditor-facing summary; full policy at `docs/policy/INCIDENT_RESPONSE_PLAN.md`)
- *"How does the AI advisor stay on the right side of AFSL?"* → ASIC RG 244 / RG 36 boundary statement §"The single-voice AI architecture"
- *"How do you control staff access to consumer data?"* → Data Handling Policy Summary §"Staff access to consumer data — controls in force" + §"Segregation of duties"

### Step 9 — Pricing + the ask (2 min)
- Open the pricing tab
- Walk Studio (AU$199/mo + 50 clients bundled) → Practice (AU$599 + 250 clients) → Enterprise
- Explain marketplace lead fees: *"Tiered by client net worth, AU$80 for sub-AU$500k, $150 for AU$500k–$2M, $250 for AU$2M+. Only when you accept the lead. No monthly fee for inclusion."*
- **The ask:** *"I'm taking 5 design-partner advisers. You'd get Practice tier free for 12 months in exchange for weekly feedback and the right to share your name as a launch partner. Want in?"*
- **TO BE WRITTEN AS BUILD COMPLETES:** counter-offer scripts + handling "let me think about it" + closing techniques specific to the AFSL profession (relationship-driven, slow yes)

---

## 3. Common objections + responses

> *To be populated as objections arrive in pre-launch conversations. Initial seeds:*

| Objection | Response strategy |
|---|---|
| "I already use XPLAN / AdviceOS / Practifi" | *"Those are your CRM. Monitrax is your client's experience that gives you the diagnostic. They're complementary, not competitive. XPLAN doesn't show your client a TRAIL stage at 11pm when they can't sleep about money."* |
| "AI giving financial advice is dangerous" | *"You're right, which is why ours doesn't. The AI gives general information only — it tells you what's happening, you tell the client what to do. The AFSL line is enforced architecturally, not editorially."* |
| "How do I know my clients won't see other advisers?" | *"They won't. Org-attached users only see your firm's professionals. The marketplace is closed to your client base. They came to Monitrax through you, they stay with you."* |
| "What if a client revokes consent?" | *"Their data leaves your view immediately. You retain a 7-year compliance archive of past conversations as the AFSL holder, and the client knows that at consent time."* |
| "How does the lead fee work if I don't accept?" | *"You don't pay. Lead fee is only charged on accepted requests. Decline costs nothing."* |
| "What about Basiq accreditation?" | *"In progress, ~8–12 weeks out. Until then your clients can connect via manual import. After Basiq goes live they flip a switch."* |
| **TO BE WRITTEN AS BUILD COMPLETES:** | objections #7+ as observed in real conversations |

---

## 4. Post-pitch follow-up

### Within 1 hour
- [ ] Thank-you email with a short summary of what was discussed
- [ ] Calendar invite for follow-up call (proposed date 7 days out)
- [ ] If they were enthusiastic: send the design-partner agreement template

### Within 24 hours
- [ ] Send compliance pack URL to their compliance contact (if they named one)
- [ ] Send pricing sheet PDF for their reference
- [ ] Personal note referencing something specific they said in the meeting

### Within 7 days
- [ ] Follow-up call to answer questions that came up post-meeting
- [ ] If converting: share onboarding checklist + provision their org seat
- [ ] If not converting: ask for the *one* thing that would have changed their mind

---

## 5. Design-partner conversion path (if YES)

**To be written when first design partner converts.** Capture the full contract, the onboarding sequence, the feedback cadence, and the launch-partner publicity arrangement in a separate doc and link from here.

---

## 6. Maintenance

This document is the operational playbook. Update it after every pitch with:
- New objections encountered + the response that worked
- Demo flow steps that ran long / short
- Adviser quotes that captured an emotional reaction (use these as future opening lines)
- Anything that broke in the demo environment that needs hardening before the next pitch

---

*Last updated: 2026-05-04 (scaffold). Sections marked "TO BE WRITTEN AS BUILD COMPLETES" populate during the corresponding feature PR.*

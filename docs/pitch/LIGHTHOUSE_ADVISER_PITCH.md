# Lighthouse Adviser Pitch — Demo Playbook

> **Status:** SCAFFOLD — populated incrementally as the demo-complete build progresses (Up Next #34). Each section gets filled in by the engineer who ships the corresponding feature, so the playbook stays in lockstep with what actually works in the demo environment.
>
> **Audience:** Reza (or future Monitrax founder/sales person) walking a single Australian financial adviser through a 25–30 minute screen-share demo, with the goal of converting them into Monitrax's first design partner.
>
> **Last updated:** 2026-05-04 (initial scaffold, no feature sections populated yet).

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
- Click Sarah Kim's row
- The canonical consumer dashboard renders with the adviser overlay docked right
- Frame: *"This is exactly what Sarah sees when she logs in. You're looking at the same thing, side-by-side. That's why I built it this way — when you're on a Zoom with her, you both have the same picture."*
- Walk the TRAIL banner → Health hero → My Wealth tiles → AI Guide output
- Highlight the adviser overlay strip (notes, scope, ROA prep)
- Highlight the AFSL disclaimer at the bottom: *"The AI doesn't give advice. It gives you context. Recommendations are yours."*
- **TO BE WRITTEN AS BUILD COMPLETES:** specific overlay walkthrough + which features to highlight first / second

### Step 3 — Open the entity tree (THE moment) (3 min)
- Click "My Structure" in Sarah's sidebar
- Entity Tree renders: Sarah Kim (person) → Sarah Kim (personal name entity) → Sarah Kim Pty Ltd → 1 property
- Frame: *"Sarah's structure is simple. Watch this."*
- Switch to Olivia Novak's drill-in
- Open her Entity Tree: Olivia → personal name → Discretionary Trust → Unit Trust → Pty Ltd → SMSF → 4 properties spread across them
- *"This is what your high-net-worth clients look like in real life. No platform you're using today shows this. None."*
- **WAIT for the lean-forward moment.** This is where the adviser commits emotionally.
- **TO BE WRITTEN AS BUILD COMPLETES:** confirmation that the entity tree visual is genuinely "lean-forward" worthy + adviser quote bank

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
- Open `help.monitrax.com.au` → Compliance section
- Show the CDR Consent Walkthrough article + the downloadable PDF
- Frame: *"Every concern your compliance team will raise is documented here. Send them this URL. Saves you the back-and-forth."*
- **TO BE WRITTEN AS BUILD COMPLETES:** compliance pack table of contents + which docs to reference for which regulator question

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

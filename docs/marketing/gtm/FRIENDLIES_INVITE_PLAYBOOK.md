# Monitrax Friendlies Private Beta — Playbook + Invite Template

> **AUDIENCE:** Reza (operator) — for sending 5–10 personally-invited friendlies to try Monitrax before broader launch.
> **PURPOSE:** This is the operational playbook for **IMPLEMENTATION_PLAN.md workstream `0f`** (Friendlies private beta). Includes the invitation email template, the lifecycle stages, where to log what, and what NOT to do.
> **Last updated:** 2026-05-15 evening, Reza + Claude
> **Operating principle:** At 5–10 friendlies, **automation is the enemy**. Use Reza's personal Gmail + Airtable for tracking + the app's built-in Feedback system. Don't reach for n8n / Smartlead / Loops.

---

## 1. Why this exists

Per Reza directive 2026-05-12: *"at the end of this build I need to be able to send an email to friendlies with a workable app to start testing and providing feedback while I work on Basiq onboarding."*

The Monitrax app is demo-ready. CDR / Basiq is months away (Phase 5 gate). The bridge between "the app works" and "paying users via brokers" is a **small cohort of trusted humans who use the thing and tell Reza the truth**. That cohort exists for three sequenced purposes (don't ask for all three on day one):

| Week | Purpose | What to ask for |
|---|---|---|
| 0–2 | **Product feedback** | "Use it for ~2 weeks, then 30 min call" |
| 4–6 | **Testimonials** | "Two sentences I can use if you found it valuable" |
| 8–12 | **Referrals** | "Anyone in your circle who might benefit?" |

---

## 2. What you're using (the stack — all existing)

| Capability | Tool | Why this one |
|---|---|---|
| Outreach (invite + follow-up) | **Reza's personal Gmail** OR `admin@monitrax.com.au` (whichever feels more personal) | NOT Smartlead — that's cold outbound on `try-monitrax.com`; wrong vibe. NOT Loops — that's lifecycle email for hundreds. Friendlies need 1:1 personal voice. |
| Contact tracking | **Airtable `Contacts` table** (Tags: `friendly` + new `Friendly stage` field — see §3) | Already exists per Step 1.2. CRM SSOT. |
| Touch logging | **Airtable `Activities` table** | Each email / call / event = one row. Manual at this volume. |
| Feedback content | **App's built-in `/dashboard` → "Send feedback"** (Phase 33g), triaged at **`/admin/feedback`** | Friendlies already see this in-app — no separate form needed. One feedback inbox, less context-switching. |
| Scheduling | **For the 30-min call: just propose 2-3 time slots in the follow-up email.** Cal.com (queued for Step 2.6) is overkill at 5–10 calls. | Reduce dependencies; friendlies often want to reply with their own time anyway. |

**What you are NOT building:**
- ❌ A new n8n workflow for friendly invites
- ❌ Smartlead campaign for friendlies (wrong tool, wrong domain)
- ❌ Loops lifecycle sequences (premature at 10 users)
- ❌ A separate feedback form (use the app's built-in)
- ❌ A CRM "friendlies pipeline" Kanban (just an Airtable view is enough)

---

## 3. Add a `Friendly stage` field to Airtable Contacts (one-time, ~30 sec)

The `Tags` field (multi-select including `friendly`) marks WHO is a friendly. A new **`Friendly stage`** single-select field tracks WHERE each friendly is in the lifecycle:

| Stage | Meaning | Trigger to advance |
|---|---|---|
| `Invited` | Email sent, no reply yet | They sign up at monitrax.com.au |
| `Signed up` | Account exists, but minimal usage | They've logged in ≥3 times over ≥3 different days |
| `Active` | Real engagement | They've submitted feedback OR taken the 30-min call |
| `Feedback given` | Has provided substantive feedback (call done, or in-app feedback ≥1) | — |
| `Testimonial received` | Has provided a usable testimonial | — |
| `Referred someone` | Has introduced someone to Monitrax | — |
| `Lapsed` | No usage for >30 days after invite, no reply | Re-engage once, then drop |
| `Declined` | Said "no thanks" or "not the right time" | — |

**Add the field in Airtable:**
1. Open `Contacts` table → click `+` to add a new field
2. Name: `Friendly stage`
3. Type: **Single select**
4. Options: paste the 8 values above (one per line in Airtable's option input)
5. Save

**Add a filtered view:**
- View: `🤝 Friendlies pipeline`
- Filter: `Tags contains "friendly"`
- Group by: `Friendly stage`
- Sort by: `Created` desc

That view becomes your weekend-coffee dashboard for the cohort.

---

## 4. The 6-step playbook

### Step 1 — Pick the friendlies (~30 min thinking, your decision)

Quality > headcount. Aim for **5–10 people**, spread across TRAIL stages so feedback covers the whole product surface:

- Someone with credit-card debt (Track / Reduce stage)
- Someone with mortgage + investment property (Invest stage)
- Someone close to retirement (Live stage)
- A small-business owner / contractor (different cashflow shape)
- Someone just-starting financially (pre-everything)
- Wild-card: someone you know who's *brutally honest* and not afraid to tell you it sucks

**Avoid:**
- People who'll be politely supportive but not use it (no real feedback)
- People who are clients-of-other-things (potential AFSL boundary confusion)
- Anyone in active financial crisis (they need real advice, not a beta)

### Step 2 — Add each friendly to Airtable (~5 min total)

For each:
- `Name` — actual name
- `Email` — personal email (where you'd email them about anything)
- `Tags` — tick `friendly`
- `TRAIL stage` — your guess (you can confirm with them later)
- `Friendly stage` — `Invited` (default — set after you send Step 3)
- `Notes` — one line: who they are + why you picked them

### Step 3 — Send the invite (1:1, your Gmail, personalised first line)

Use the template in §6. **Personalise the first sentence for each friendly** — don't blast. The whole point is "I picked you specifically".

### Step 4 — Log the send in Airtable Activities (~1 min per friendly)

For each invite sent, create one `Activities` row:
- `Name` — "Invite email sent to {friend}"
- `Type` — `Outbound Email`
- `Direction` — `Outbound`
- `Contact` — link to their `Contacts` row
- `Source workflow` — `Manual`
- `Body` — paste the email body (so future-Reza can see what was sent — also: the Founder Daily Digest reads this table and might surface it in the CRM ACTIVITY section)

Update their `Friendly stage` from blank → `Invited`.

### Step 5 — When they reply or sign up

- **They reply with "yes, signed up":** log Activity (`Inbound Email`), update Stage → `Signed up`
- **They sign up but you don't see a reply:** check `/admin` for the new user; log it as Activity (`Other` source); update Stage → `Signed up`
- **2 weeks after signup:** send a "how's it going?" email proposing the 30-min call. Template in §7.
- **They take the call:** update Stage → `Active` then → `Feedback given` after the call. Log the call as an Activity (`Call`, `Body` = your notes from the call).
- **They go silent:** wait 2 weeks, send one re-engage email (§8), then move to `Lapsed` if no reply.

### Step 6 — Sequenced asks (don't do on day one)

| When | Ask | Template |
|---|---|---|
| Week 4–6 (if positive feedback) | "Two-sentence testimonial?" | §9 |
| Week 8–12 (if testimonial given + still using) | "Anyone in your circle?" | §10 |

---

## 5. What "feedback" actually means here

You're not running a structured user-testing study. You're listening for signal in conversation. Specifically:

- **What did they find confusing?** (UX gaps that auto-fix at scale-zero)
- **What did they expect that wasn't there?** (feature gaps)
- **What did they wish was different?** (preference signals)
- **What did they show their partner / friend / accountant?** (sticky-moment signal — strongest indicator of product-market fit)
- **What would they pay for?** (pricing-tier signal for Phase 6)
- **What's the ONE thing that would make them stop using it tomorrow?** (retention gap)

**You're NOT asking:** "rate Monitrax 1–10 across these 14 dimensions". That's survey-thinking. You want stories.

After each feedback call, write 3 lines in the `Activities.Body` field:
- One thing they loved
- One thing they hated
- One thing they expected but couldn't find

Three lines × 8 friendlies × 2 calls each = 48 atomic signals. That's a product backlog.

---

## 6. The invitation email — TEMPLATE (personalise line 1)

```
Subject: Want to be one of the first to try Monitrax?

Hey [Name],

[PERSONALISE THIS FIRST LINE — say something specific to your relationship
with this person. Examples: "I know you've been wrestling with the
property/investment trade-off lately — wanted to ask you something specific."
/ "Remember last year when we talked about how messy keeping track of money
across accounts is? Wanted to ask you something specific."]

I'm building Monitrax — a financial-life app for Australians who don't want
a financial adviser yet but want a clearer picture of their own money. I've
been heads-down on it for [X] months, and it's at the point where it works
end-to-end but only people I trust have seen it.

You're on a short list of about [N] people I want feedback from before I open
it up more broadly. Not because I'm asking for favours — because you'd actually
use a thing like this and you'll tell me the truth.

The deal:
- You sign up and use it for ~2 weeks, however much makes sense for your
  real situation (manual entry for now — live bank connections come later
  this year).
- After 2 weeks, we hop on a 30-min call — what worked, what felt wrong,
  what's missing, what you'd never use.
- You get the app at no charge, indefinitely. (When the paid plans launch
  later this year, friendlies stay on the full-feature plan for free for
  at least 6 months — longer if you're still using it.)

If you're in:
- Sign up at https://monitrax.com.au
- Reply to this email and tell me you've signed up
- Use it like you'd use it for real

If you're not interested or it's not the right time, just say so — no
awkwardness. I'd rather know now.

Cheers,
Reza
```

**Why each line is there (don't change unless you understand why):**

- *"I wanted to ask you something specific"* — opens with intent, not pitch
- *"You're on a short list of about [N] people"* — selection, not enrolment (psychology: scarcity + chosen-by-name)
- *"You'd actually use a thing like this and you'll tell me the truth"* — sets the feedback tone, gives permission to be honest
- *"The deal:"* + concrete bullets (2 weeks / 30 min / free indefinitely) — clear ask, no ambiguity
- *"If you're not interested, just say so — no awkwardness"* — removes social pressure; protects the friendship; counterintuitively *raises* yes-rate (people respond to being given a free out)
- Plain text, no HTML, no logos — reads like a friend writing a friend, not a marketing email
- No "click here for more info" link — the only links are the signup page and the email reply

---

## 7. The 2-week follow-up email — TEMPLATE

Sent ~14 days after they signed up (Stage = `Signed up` for ≥14 days and no in-app feedback yet).

```
Subject: How's Monitrax going?

Hey [Name],

It's been about 2 weeks since you signed up — wanted to check in. No pressure
either way, just curious how you're finding it.

If you've had a chance to use it, I'd love a 30-min call to hear what's
working and what isn't. I'd genuinely rather hear the brutal version — the
polite version doesn't help me build it better.

Three times that work for me this week (Sydney time):
- Tuesday 3:00 PM
- Wednesday 11:00 AM
- Thursday 4:30 PM

Reply with whichever works (or another time entirely). We can do it on
Google Meet, Zoom, or just a phone call — whatever's easiest.

If you haven't gotten around to using it yet — totally fine, no judgement.
Just say so and I'll either bump the timeline or take you off the list,
whichever you prefer.

Cheers,
Reza
```

---

## 8. The re-engage email — TEMPLATE

Sent if they went silent (no activity, no reply to the 2-week follow-up). Send once. If no response, move to `Lapsed` and stop emailing.

```
Subject: One last check on Monitrax — no pressure

Hey [Name],

I noticed you signed up for Monitrax a few weeks ago but it might not have
clicked for you yet — totally understand, the timing has to be right and
this kind of thing isn't urgent for most people.

If you want to give it another go: it's still there at monitrax.com.au,
same login.

If it's not for you, or now isn't the right time, just reply with a one-line
"not for me right now" or even just a thumbs-down — I'll take you off the
list and we'll never speak of it again 😄

No hard feelings either way. Thanks for being open to it in the first place.

Cheers,
Reza
```

---

## 9. The testimonial ask — TEMPLATE (Week 4–6, if positive)

Only send after a positive feedback call OR substantive positive in-app feedback. Don't send to anyone who hasn't actively engaged.

```
Subject: Small ask — testimonial?

Hey [Name],

Thanks again for the feedback on Monitrax — it's been genuinely useful and
some of what you said has already shaped what I'm working on next.

Quick ask, no pressure: would you be willing to give me a 2-sentence
testimonial I can use? Something like "Monitrax helped me [X] / I'd
recommend it to [Y]" — whatever's honest from your experience.

Happy to either:
- Have you type it in your own words (best), or
- Draft something based on what you said in our call, and you edit it
  to be true

It'd go on the Monitrax website / brochure for brokers / etc. — basic
social proof stuff. Of course you'd see the final version before it's
published anywhere.

If it's a no, no worries at all — just let me know.

Cheers,
Reza
```

---

## 10. The referral ask — TEMPLATE (Week 8–12, only if still actively using)

```
Subject: Random thought — anyone in your circle?

Hey [Name],

Hope you're still finding Monitrax useful. Quick thought, no obligation:

I'm starting to think about people beyond the immediate beta cohort —
specifically [target description: "people who'd be a good fit for the
broker side of the business" / "people running their finances solo with
no adviser" / etc.].

Anyone come to mind in your circle who might be a good fit? Happy to
either:
- Reach out to them directly if you give me their email (and they're OK
  with that), OR
- You forward them a sentence or two about Monitrax — I'll send you a
  short blurb you can copy-paste if it'd help.

Genuinely no pressure — if no one comes to mind, no big deal at all.
The fact you've stuck with it for a couple months is the more important
signal anyway.

Cheers,
Reza
```

---

## 11. What goes WRONG (and how to handle it)

| Failure mode | What it looks like | What to do |
|---|---|---|
| They sign up but never log in again | Activity in Airtable shows `Signed up` but no Active state after 2 weeks | Send §7 (2-week follow-up); if no reply, send §8 (re-engage); if still no reply, mark Stage = `Lapsed`. Don't take it personally — most beta sign-ups never engage. That's a known UX gap to investigate (onboarding friction). |
| They reply with "I tried it but it's not for me" | Email reply, no negative feedback specifics | Reply with: *"Totally understood — would love to know in one sentence what was off so I can use that. No need to explain or be diplomatic."* Mark Stage = `Declined`. Log the response in Activities. |
| They reply with a long detailed complaint | Substantive negative feedback | **GOLD.** Reply within 24h, thanking them. Ask if you can hop on a 15-min call to understand more. This is the most valuable feedback you'll get — protect it. |
| They ask for personal financial advice in the feedback call | "So should I invest in X instead of Y?" type questions | Stick to the AFSL boundary (`docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` §7): *"That's a question for a licensed adviser — the app can show you the picture but on whether you should specifically X, you'd need someone with an AFSL."* |
| They want to pay for it | "How much will this cost when it's not free anymore?" | Honest answer: *"Pricing is being designed now, will be in the AU$9–14/mo range when it launches later this year. As a friendly you stay on the full plan free for at least 6 months."* (per workstream `0e` design.) |
| They ask if they can refer someone | "My partner / friend would love this" | Yes, but: take their friend's name and email, you reach out to the friend personally with the §6 invite (lightly adjusted for warm-referral context). Don't let them blindly forward a marketing-style email. |
| Negative ASIC-tangent feedback | "Should you really be storing my data?" / "Is this even legal?" | Calm, factual: point them at `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` (if it exists) or just explain in plain language: app uses manual entry only right now (no Basiq), CDR will be opt-in with consent flows when it launches, you're working with [lawyer name TBD] on the AFSL boundary, etc. |

---

## 12. Weekly cadence (the ops rhythm)

**Sunday evening or Monday morning, ~15 min:**

1. Open the Airtable `🤝 Friendlies pipeline` view
2. For each friendly in `Invited` for >7 days with no reply: do NOTHING yet (give them space)
3. For each friendly in `Signed up` for >14 days with no in-app feedback: send §7 (2-week follow-up)
4. For each friendly in `Active` who hasn't had the 30-min call: chase the call
5. For each friendly in `Feedback given` for >4 weeks: consider sending §9 (testimonial ask)
6. For each friendly in `Lapsed`: do nothing — they're parked

This is the ONLY recurring ops work this playbook generates. ~15 min/week. Doesn't need automation until you're tracking 30+ friendlies (which won't happen — this list stays at 5–10 by design).

---

## 13. What this means for the GTM plan

This playbook is the operational expression of `IMPLEMENTATION_PLAN.md` workstream `0f`. It does NOT advance Phase 1, 2, 3 of the GTM execution plan directly — but:

- Friendly testimonials become **social proof for Phase 4 broker pitches** ("here's what real users say")
- Friendly feedback shapes **product priorities** (which features actually get used vs which fall flat)
- Friendly referrals seed the **D2C top-of-funnel pre-Phase-6**
- Friendly use generates **CRM ACTIVITY entries** that show up in the Founder Daily Digest, giving Reza a daily pulse on the beta cohort

The friendlies cohort is the **lowest-cost, highest-signal-per-dollar growth investment** available pre-Phase-6.

---

## 14. References

- `IMPLEMENTATION_PLAN.md` workstream `0f` — Friendlies private beta
- `docs/marketing/GTM_EXECUTION_PLAN.md` — overall GTM plan
- `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` §7 — AFSL boundary escalation guidance for any friendly who crosses into asking for personal advice
- `docs/marketing/GTM_TOOL_STACK.md` — confirms Airtable + Gmail + app's Feedback system are the tools to use; confirms Smartlead / Loops are NOT
- `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — how Activities you log here surface in the morning brief
- App's `/admin/feedback` — where in-app feedback from friendlies lands (Phase 33g)

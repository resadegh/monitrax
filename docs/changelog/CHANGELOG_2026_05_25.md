# Changelog — 2026-05-25

> Phase 47.66 Friendlies-tracker automation: end-to-end verification + Vercel fire-and-forget bug fix + post-merge cleanup. Three PRs merged in sequence (#882 → #883 → cleanup commit on branch), one outstanding cleanup commit, two outstanding n8n UI fixes.

---

## Session: friendlies-tracker debug + verification

### Changes Made

- **Type:** Bug fix + verification + cleanup
- **Scope:** `lib/webhooks/n8n.ts`, `app/api/auth/consent/route.ts`, `lib/services/feedbackService.ts`, n8n workflow `caJUA8f61GHsKEUj`
- **Root Cause (the Vercel bug):** the original PR #881 `emitFriendliesEvent` helper was fire-and-forget — it called `fetch()` but didn't await. On Vercel serverless, the function returns its API response → the underlying Node process is killed → the in-flight `fetch` promise is silently dropped. Result: the webhook never actually reached n8n in production. The debug log shipped in PR #882 surfaced this — the "invoked" line appeared but no follow-up "→ 200" line ever did, confirming the fetch was being killed mid-flight.
- **Solution:**
  - **PR #882 (diagnostic):** added an `[n8n-webhook]` `console.log` line surfacing whether env vars reached the running build (truthy "set" / length only — never the secret value). This was the diagnostic that revealed the fetch-drop pattern.
  - **PR #883 (the actual fix):** converted `emitFriendliesEvent` from sync fire-and-forget to `async/await` with a 4-second hard timeout (`AbortController`). Both call sites (`app/api/auth/consent/route.ts:230` + `lib/services/feedbackService.ts:180`) now `await` the helper. Vercel's serverless function lifetime extends to cover the awaited fetch, so the in-flight call completes. Trade-off: signup endpoint blocks up to 4s worst-case (n8n unreachable), typical sub-second (n8n's `responseMode: 'onReceived'` returns 200 instantly + processes async).
  - **Cleanup commit `dfee7e40` (pushed today, not yet merged):** removed the PR #882 diagnostic `console.log` now that the automation is confirmed stable. Operational logs (success `→ 200 OK` + warn/error branches in `lib/webhooks/n8n.ts:101-115`) retained for ongoing visibility.

### Files Modified

- `lib/webhooks/n8n.ts` — converted to async/await pattern (PR #883); removed diagnostic debug log (cleanup commit).
- `app/api/auth/consent/route.ts:230` — added `await` keyword on `emitFriendliesEvent()` call.
- `lib/services/feedbackService.ts:180` — removed void IIFE wrapper, awaits inline with try/catch.

### Verification (per CLAUDE.md §17.2 post-merge protocol)

- PR #882 prod deploy `dpl_5k6up7zB8CVkuBFcfFz36uRcrP7K` → READY 2026-05-25 ~08:58 AEST.
- Runtime logs scanned at `./scripts/vercel-logs.sh latest-runtime | grep "n8n-webhook"` — pre-fix log line "user.signup invoked" surfaced (proving env vars reached the build); no follow-up line (proving fetch was being killed).
- PR #883 prod deploy → READY ~09:03 AEST.
- Reza ran fresh signup as `Test9@test.com` → Airtable Contacts row `Test 9` moved from `Invited` → `Signed up` ✅ end-to-end verification successful.
- Cleanup commit `dfee7e40` preview deploy `dpl_DFqr4HmVLo18bi3D7gzwwYyBBfAV` → READY.

### Build Status

- [x] PR #882 build: PASS
- [x] PR #883 build: PASS
- [x] Cleanup commit build: PASS (preview READY)

### Discovered During Session — Outstanding Items

Two cosmetic / silent-failure bugs in the n8n workflow were discovered during verification but cannot be safely fixed via the n8n MCP SDK (the resourceMapper field config gets wiped on every SDK update — exact regression hit twice in this session). These are tracked as Tech Debt #24 in `IMPLEMENTATION_PLAN.md` and require a ~1-minute manual n8n UI fix by Reza:

1. **Update Friendly Stage node** has `"Email": "="` in its field mapping — an empty expression that wipes the Email field on every Airtable update. This caused Test 9 to land in `Signed up` column with no email visible. Reza-side fix: open the node, remove the Email row from field mapping; leave only `id` (match column) + `Friendly stage`. Future signups affected until fixed.
2. **Verify HMAC + Enrich Code node** uses `'Feedback given'` (lowercase g) but the Airtable `Friendly stage` enum is `Feedback Given` (capital G). Won't bite until a friendly submits their first feedback thread.

A third item is also tracked: **HMAC verification disabled** in the workflow's Code node because the n8n sandbox blocks both `require('crypto')` AND the Web Crypto `crypto.subtle` global. Re-enable requires SSH access to the Hetzner box (set `NODE_FUNCTION_ALLOW_BUILTIN=crypto` env var on the docker-compose stack). Risk acceptably low: URL is obscure, HTTPS-only, worst-case impact is incorrect Airtable updates.

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` — rewrote 2026-05-25 entry to reflect the full debug arc (PR #881 → #882 → #883 → cleanup); added rows 70 + 71 to Up Next for Phase 47.66 Phase B (Gmail inbound trigger) + Phase C (Founder Daily Digest friendlies-state section); added Tech Debt #24 for the three outstanding n8n issues.
- `docs/changelog/CHANGELOG_2026_05_25.md` — this file (NEW).

### Commit History

| Hash | Message | Branch |
|---|---|---|
| `4b388df2` | debug(n8n): log whether env vars reach the running Vercel build | PR #882 → main |
| `1667f390` | fix(n8n-webhook): await fetch so Vercel serverless doesn't kill it mid-flight | PR #883 → main |
| `dfee7e40` | chore(webhooks): remove n8n diagnostic debug log | on branch — not yet merged |

### PR Summary

| PR | Status | Outcome |
|---|---|---|
| #882 | ✅ MERGED | Diagnostic surfaced the Vercel fire-and-forget bug |
| #883 | ✅ MERGED | Async/await fix; verified end-to-end via fresh signup |
| (cleanup commit, no PR yet) | PUSHED | Debug log removed from `lib/webhooks/n8n.ts` |

### What's Left

1. **Reza-side n8n UI fixes (~1 min):** remove Email row from Update Friendly Stage field mapping; change `'Feedback given'` → `'Feedback Given'` in Code node.
2. **Reza-side Airtable cleanup:** put `Test9@test.com` back on the Test 9 row (one-time fix from the bug — future signups unaffected once #1 lands).
3. **Reza-side backfill:** manually move any pre-PR-#881 friendlies who already signed up from `Invited` → `Signed up` in Airtable (no automation; webhook only catches new signups from #881 onward).
4. **Phase B (queued ~1h):** n8n Gmail trigger watching `admin@monitrax.com.au` for inbound replies from friendly-tagged contacts → writes Activity row.
5. **Phase C (queued ~1h):** Founder Daily Digest extended with "friendlies state" section ("3 stuck at Invited >7 days", "2 new feedback threads", etc.).
6. **Future hardening:** re-enable HMAC verification when SSH access to Hetzner is acquired.

https://claude.ai/code/session_01Hg6AjgrLHPuKEQGbfmEqBw

---

## Session: Phase 46 PR 1 — /wealth-check pre-signup hook

### Changes Made

- **Type:** Feature (new public-facing surface — anonymous + traffic-OFF until gates)
- **Scope:** New route `app/wealth-check/*`, new `lib/wealthCheck/*` engine module, new `lib/marketing/benchmarks.ts` SSOT, new Phase 46 design doc.
- **Why:** Reza directive (2026-05-24, Up Next #68) — `/wealth-check` is the "make or break" public funnel surface. Three-input estimator (age + household income + net-worth band) returns dollar-specific retirement-gap + ABS percentile + one named lever, in under 30 seconds.

### Files Created

- `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md` — full 14-section design spec covering purpose, calc algorithm, benchmark SSOT, lever logic, AFSL boundary, traffic-on gates, and the 4-PR sequence.
- `lib/marketing/benchmarks.ts` — public-benchmark SSOT. Four canonical sources (ASFA, ABS, ATO, APRA) with citations + last-refresh dates + next-refresh triggers. Yearly minimum refresh trigger: new ASFA Q2 release.
- `lib/wealthCheck/types.ts` — shared types for the calc + lever + page.
- `lib/wealthCheck/calculator.ts` — pure-function calc engine. 12-step algorithm: bucket age → estimate current super (ATO median, clamped) → project both super + non-super to 67 → compare against ASFA baseline AND 70%-income-replacement lifestyle target → return gap + percentile + surfaced assumptions.
- `lib/wealthCheck/lever.ts` — age-band branched lever selector with AFSL discipline (no product names, mechanism-only framing, "speak to your accountant" handoff for catch-up).
- `app/wealth-check/page.tsx` — client component, 3-input form ↔ result page with `AnimatePresence` transition. Form uses sliders for age/income + radio-band picker for net worth. Result shows hero gap → percentile context → ONE lever → assumptions panel (collapsed) → CTA → AFSL boundary footer.
- `app/wealth-check/layout.tsx` — `robots: noindex, nofollow` metadata until traffic-on gates land (PHASE_46 §10).

### Key Architectural Decisions (captured in PHASE_46 doc)

1. **Lever logic = branch by age band** (Reza pick): <40 salary-sacrifice; 40-54 super+debt; 55+ catch-up with eligibility check against $500k TSB threshold + s292-85.
2. **Benchmark SSOT = JSON-in-TS file** (Reza pick): yearly refresh trigger documented inline; same pattern as `lib/tax-engine/config/taxYearConfig.ts`.
3. **Email capture deferred to PR 3** (Reza pick): PR 1 ships scaffold + calc only.
4. **PR scope = full PR 1** (Reza pick): doc + page + calc + lever + benchmarks in one PR.

### Calc Sanity-Check (5 archetype cases run via tsx)

| Case | Projected at 67 | Lifestyle target | Gap | Lever |
|---|---|---|---|---|
| 38yo, $145k single, $200-500k NW | $3.25m | $2.54m | $0 (on track) | "Set your own target" frame |
| 28yo, $80k single, <$50k NW | $1.99m | $1.40m | $0 (SG-only is enough) | "Set your own target" frame |
| 48yo, $200k couple, $500k-1m NW | $2.78m | $3.50m | **$725k** | Super top-up + debt paydown |
| 58yo, $180k couple, $1m-2m NW | $2.61m | $3.15m | **$537k** | Catch-up contributions (~$30k FY) |
| 45yo, $300k couple, $2m+ NW | $10.65m | $5.25m | $0 (way past) | "Set your own target" frame |

**Key insight surfaced by the sanity check:** ASFA "comfortable" ($595k single / $690k couple) is so easily met by the AU compulsory super system over 30+ year horizons that the wealth-builder ICP sails past it. The meaningful gap for this audience is against **70% income-replacement × 25** (4% safe-withdrawal rule). ASFA is shown as context only ("comfortable is in the bag"). This is the honest product wedge: "what does it take to MAINTAIN your lifestyle, not just be 'comfortable'?"

### Build Status

- [x] TypeScript: PASS (only pre-existing TS6 baseUrl deprecation warning)
- [x] Spot-check via 5 archetype cases: PASS

### Traffic-On Gates (PHASE_46 §10) — Still OFF

- ✅ Gate A — PR 1 lands (this PR)
- ⏳ Gate B — Friendlies cohort retention signal (workstream 0f) — ~2–4 weeks
- ⏳ Gate C — Lawyer pass on result-page copy (Q-HOOK-AFSL) — ~2 weeks lead, runs in parallel with B
- ⏳ Gate D — Q-DEC resolution if Phase 45 What If? composes same engines
- ⏳ Gate E — PR 2 (analytics + sitemap) + PR 3 (email capture) + PR 4 (flip `robots` to index,follow)

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` — row #68 marked PR 1 SHIPPING with PR 2/3/4 sequence + traffic-on gates.
- `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md` — new (this PR is the canonical spec).
- `docs/changelog/CHANGELOG_2026_05_25.md` — this session entry (append).

### What's Left After This Session

1. **PR 2 (Phase 46) — analytics + shareable URL + SEO** (~1 day). 5 metrics from PHASE_46 §11; `?ref=<name>` personalisation; meta tags.
2. **PR 3 (Phase 46) — email capture + Resend + PDF** (~1-2 days). Requires Q-HOOK-EMAIL resolved (Resend key live).
3. **PR 4 (Phase 46) — traffic-on** (~1 day). Gated on Gate B + Gate C.
4. **n8n UI fixes (Reza-side, ~1 min):** Email-wipe + Feedback Given casing — see Tech Debt #24.

https://claude.ai/code/session_01Hg6AjgrLHPuKEQGbfmEqBw

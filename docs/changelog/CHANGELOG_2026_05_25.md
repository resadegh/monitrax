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

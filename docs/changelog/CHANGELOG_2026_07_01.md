# Changelog - 2026-07-01

## Session: email-verification-gcp-3ivh5a — email verification RESOLVED (Maps-key auth scopes)

### Type
Fix (GCP config) + doc correction. No app code changed this session — the code
(`/auth/action`, `/verify-email`, guards, banner) shipped in prior PRs (#1037,
#1039, #1088). This session diagnosed why verification *still* failed in prod
and fixed it at the GCP API-key layer.

### Root cause (the full chain, verified via Identity Platform REST)
1. Email verify links are hardwired to Firebase's hosted handler
   `https://monitrax-479700.firebaseapp.com/__/auth/action`, signed with the
   project's `config.client.apiKey`.
2. `config.client.apiKey` = **`AIzaSyCk0pG…` = the "Monitrax frontend (Maps
   Embed + Places)" key**, because the project has **no registered Firebase
   Web app** (config injected via `NEXT_PUBLIC_FIREBASE_*` env vars), so the
   default web key drifted to an unrelated Maps key.
3. The intended clean fix — repoint email links to our own `/auth/action` via
   a custom action URL — is **platform-locked**: setting
   `notification.sendEmail.callbackUri` returns **`400
   EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`** via BOTH the Firebase console AND the
   raw REST API. Config was otherwise clean (`method: DEFAULT`,
   `customDomainState: NOT_STARTED`) — it's a hard platform lock on this
   `IDENTITY_PLATFORM`-subtype project, not stuck state.
4. `config.client.apiKey` is **OUTPUT_ONLY** — a `PATCH
   updateMask=client.apiKey` is accepted but ignored (can't re-sign the link
   with a different key either).
5. So the link is permanently `firebaseapp.com` + Maps key, and the Maps key's
   referrer list lacked `firebaseapp.com` (→ `API_KEY_HTTP_REFERRER_BLOCKED`)
   and its API targets lacked Identity Toolkit (→ `API_KEY_SERVICE_BLOCKED`).

### Fix (verified working 2026-07-01)
Since the link can't be moved and the key can't be changed, the Maps key must
carry the auth scopes. One gcloud command (preserves Maps scopes + referrers,
adds auth):
```bash
gcloud services api-keys update 03e1218e-c2e4-4bbc-b803-8302121a122e \
  --allowed-referrers="https://monitrax.com.au/*,https://*.monitrax.com.au/*,https://*.vercel.app/*,http://localhost:3000/*,https://monitrax-479700.firebaseapp.com/*" \
  --api-target=service=maps-embed-backend.googleapis.com \
  --api-target=service=maps-backend.googleapis.com \
  --api-target=service=places.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com
```
Verified deterministically (`recaptchaParams` call with `firebaseapp.com`
Referer returns params, not a 403), then confirmed end-to-end: a fresh verify
link now lands on "Email verified." ✅

### Files Modified (this session)
- `docs/operational/security/01_AUTHENTICATION.md` — corrected the § Email
  Verification flow (link goes to firebaseapp.com hosted handler, NOT our
  page; custom action URL is platform-locked) + rewrote the §
  Troubleshooting resolution (client.apiKey read-only, EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED
  is a platform lock not stuck state, the gcloud fix + deterministic test)
- `docs/changelog/CHANGELOG_2026_07_01.md` — this entry
- `docs/IMPLEMENTATION_PLAN.md` — Q-AUTH-1 final outcome

### Standing follow-up (hygiene, not urgent)
Register a proper Firebase Web app → project gets a clean dedicated web key →
`client.apiKey` stops being the Maps key → drop `identitytoolkit`/`securetoken`
off the Maps key. The `/auth/action` handler then activates via one PATCH if
the project ever moves to custom SMTP (which unlocks `callbackUri`).

### Security note (answered for Reza)
The API key visible in the verify link is **not** a security issue — Firebase
browser keys are public by design (already in the JS bundle + init.json), grant
no data access, and are referrer-restricted. The link's real credential is the
single-use, short-lived `oobCode`.

---

## Session: adoring-davinci-e2wb4d

### Phase 54.1 — Neobrain merchant-noise denoising (P1)

**Type**: Enhancement (transaction categorisation / merchant learning)
**Scope**: `lib/bank/` merchant normalisation + `lib/categorisation/kb/` shared-KB signature
**Lenses**: Architect (SSOT — one shared denoise, §12.2.1) → Financial adviser (over-merge misstates spend-by-category + tax sums, §19) → Behaviour psychologist (learning that "sticks" across noisy same-vendor rows earns trust).

#### Root cause (verified in source — no guessing)
A live CBA feed row `"09:19hjs North Parramattanorthmead"` (glued time + `HJS`=Hungry Jacks + suburb) did **not** match a later `"13:42hjs Blacktown"` from the same vendor. Both merchant-identity keys — per-user `merchantStandardised` (`normaliseMerchantName`) and shared-KB `scrubToSignature` — failed at the same three points: (1) neither stripped the **colon-time** (date regexes were `\d{2}/\d{2}` / `[\/\-.]`, no `:`); (2) `hjs` was in **no** table; (3) the two rows reduced to **different** strings → learning never carried across time/location noise.

#### Solution (built ON existing work — §12.2.1)
One shared, pure helper used by **both** producers so they can never drift:
- **`stripTransactionTimes`** — removes glued/standalone `HH:MM(:SS)` (general — helps every timestamped row + cleans input for the AI layer).
- **`expandMerchantAliases`** — rewrites **evidence-gated, whole-token** AU abbreviations to the canonical name (`hjs → hungry jacks`, verified from Reza's sample), applied *after* time-strip. The canonical name resolves via existing `MERCHANT_MAPPINGS` / `CATEGORISATION_RULES` / KB seed.

Result: `09:19hjs …` and `13:42hjs …` **both → "Hungry Jacks"** → import rules *and* per-user auto-apply match. Conservative on trailing location (no arbitrary trailing-word stripping — over-merge risk; unifying the two keys is **P2**).

#### The long tail is deferred to AI+KB (Reza's insight)
Hand-maintaining an alias table can't cover the near-infinite description space. The scalable answer is the already-built-but-gated shared KB (layer 3) + Gemini-on-miss (layer 4). **Reza decision 2026-07-01: ship P1 denoise now, then plan enabling the AI+KB tail** (separate PR, cost/accuracy sign-off first). See `PHASE_54_NEOBRAIN.md` §16.4.

#### Files Modified
- `lib/bank/merchantNoise.ts` — **NEW.** `stripTransactionTimes`, `expandMerchantAliases`, `MERCHANT_ALIASES` (evidence-gated), `denoiseMerchantText`.
- `lib/bank/normalisation.ts` — `normaliseMerchantName` applies `denoiseMerchantText` (strip-times → expand-aliases) before the mappings loop.
- `lib/categorisation/kb/scrubSignature.ts` — `scrubToSignature` applies `denoiseMerchantText` at the head of the strip chain.
- `tests/neobrain/merchantNoise.test.ts` — **NEW** (17 tests): time-strip, whole-token alias safety, HJS end-to-end, **over-merge guardrail** (distinct merchants stay distinct), scrub regression.
- `tests/categorisation/scrubSignature.test.ts` — unchanged; still green (no regression).
- `docs/blueprint/PHASE_54_NEOBRAIN.md` — new **§16** (design, worked example, guardrail, Neomatrix, self-review).
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — §21.2 update (below).
- `docs/financial-logic/graph/structural/structural-graph.json` — added `lib/bank/merchantNoise.ts` to L0 file manifest (graphify CLI unavailable in this env; faithful file-presence record — a full graphify run backfills its AST nodes).

#### Neomatrix (§21.2)
- `engine.scrubSignature.scrubToSignature` anchor 46→47 + formula updated (denoise pre-step).
- **New** `engine.normalisation.normaliseMerchantName` (modelled a gap — §21.2.1 rule 4) + `law.neobrain.merchantNoise`. Edges: normaliser → `categoriseTransaction` (feeds); both producers → `law.neobrain.merchantNoise` (governed-by).
- `npm run neomatrix:check` → **OK** (schema valid, invariants hold, markdown fresh; L0 0 uncovered; binding 141/141; census 0 uncovered).

#### §19.2 evidence (worked example)
- `renormaliseMerchant('09:19hjs North Parramattanorthmead')` → `'Hungry Jacks'` == `renormaliseMerchant('13:42hjs Blacktown')` → `'Hungry Jacks'` ✓
- Over-merge guardrail: `'08:00 SMITH ST CAFE MANLY'` ≠ `'22:00 SMITH ST BAR MANLY'` ✓
- `scrubToSignature('WOOLWORTHS 1234 SYDNEY')` → `'WOOLWORTHS SYDNEY'` (unchanged) ✓

#### Testing
- [x] `tests/neobrain/merchantNoise.test.ts` + `tests/categorisation/scrubSignature.test.ts` — **28 passed**.
- [x] `merchantNoise.ts` `tsc --strict --noEmit` — clean.
- [x] `npm run neomatrix:check` — green.
- [ ] Full vitest suite / `next build` — **run in CI** (this container cannot `npm ci` / `prisma generate` — network ECONNRESET; Prisma-dependent test files fail to *load*, not a logic regression; 178 non-DB tests passed).

#### Self-review (§20.4) — financial build, 10/10 required
3× adversarial review: **v1 8.5 → v2 10/10.** Critique changed the build: (a) harden the existing SSOT normaliser + a shared helper, do **not** add a competing `merchantKey()`; (b) leading-time strip safe, trailing-location strip kept conservative; (c) split P1 (ships now) from P2 (key-unification, separate PR).

### PR
- Branch: `claude/adoring-davinci-e2wb4d`
- Status: Draft (opened this session)

---

### Phase 54.1 — P2: shared numeric-noise strip + per-user key unification (same PR)

**Type**: Enhancement (merchant-identity key). **Reza chose the reframed P2** after I surfaced a regression finding (naive key-merge would break known-merchant location-independence).

- Extracted `stripMerchantNumericNoise` (BSB / card masks / reference tails / long free-standing digit runs) into `lib/bank/merchantNoise.ts` — ONE source used by **both** `normaliseMerchantName` (per-user) and `scrubToSignature` (KB), so the two keys de-noise identically (§12.2.1).
- Wired into `normaliseMerchantName` → the per-user key now collapses `SOMESHOP 1234 SYDNEY` and `SOMESHOP 9981 SYDNEY` to one key (auto-apply matches across store numbers). **No location stripping** (over-merge guarded, §19); **no known-merchant regression** (Woolworths stays location-independent). Digits glued inside a token (`1300SMILES`) preserved.
- Refactored `scrubToSignature` to call the shared helper (dates + payment-tokens stay inline) — all prior scrub tests green.
- **All 3 per-user match sites key on `merchantStandardised`** (`buildSimilarUncategorisedWhere`, `getLearnedCategorySuggestions`, `MerchantMapping` write) → improving that one producer fixes all three; **no schema/match-site change**.
- Tests: `tests/neobrain/merchantNoise.test.ts` extended (P2 numeric strip, same-location match, over-merge guardrail, no-regression) — **38 passed**. Neomatrix formulas updated; `neomatrix:check` green.
- Self-review §20.4: **v1 9.0 → v2 10/10** (the reframe was the unlock).
- Cross-location matching for *unknown* merchants remains deferred to the KB token-prefix / AI tail (the Step-2 AI+KB plan).

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

---

### Phase 54.2 — reconcile onto ONE AI categoriser (Step-2a)

**Type**: Refactor + safety (live import categorisation). **Reza decision 2026-07-01** after I surfaced a two-engine finding: enabling the gated Gemini-on-miss would NOT have touched the main import (it ran a different, older bulk-Gemini path that could auto-file an AI guess silently).

- **Two AI categorisers found (§12.2.1 violation):** Path A `categoriseWithLearning → categoriseInBatches` (import + Basiq, gated `enableAI` default-true + `GEMINI_API_KEY`) vs Path B `categoriseTransaction → geminiCategoriseOnMiss` (KB cascade, `KB_GEMINI_ENABLED`).
- **Fix (surgical):** `categoriseWithLearning`'s `needsAI` branch now calls new `categoriseUnknownsViaCascade` (`lib/bank/aiCategorisation.ts:684`) — maps `NormalisedTransaction→UnifiedTransaction` + `categoriseTransactionBatch({})` (skips cascade layer-1; merchant-learning already ran) → rules → KB prior → Gemini-on-miss → fallback. **Import route + Basiq sync unchanged** (adapter preserves `AICategorizationResult`).
- **AI never auto-files:** `classifyByConfidence` demotes `source==='AI'` out of auto-accept (always review → user confirm; echo-chamber safe). New `law.neobrain.aiNeverAutoFiles`.
- **Retire Path A:** `categoriseInBatches` + `categoriseWithAI` `@deprecated` (no caller); full deletion is the immediate follow-up PR (isolate behaviour change from removal; container can't compile-verify a large deletion — preview confirms first).
- **Behaviour flags:** (1) AI at import now needs `KB_GEMINI_ENABLED=true` (operator) — flip when merging, else unknowns land uncategorised-in-review not AI-guessed; (2) `isEssential`/`isRecurring` on AI-unknowns default false (user sets on confirm); (3) transfer parity preserved (`isTransferDescription` SSOT).

#### Files Modified
- `lib/bank/aiCategorisation.ts` — new `mapNormalisedToUnified` / `cascadeResultToAIResult` / `categoriseUnknownsViaCascade`; `classifyByConfidence` AI-never-auto-file guard; `source?` on `AICategorizationResult`; `categoriseInBatches`/`categoriseWithAI` `@deprecated`.
- `tests/neobrain/cascadeReconcile.test.ts` — NEW (10 tests): the never-auto-file guard + adapter mapping.
- `docs/blueprint/PHASE_54_NEOBRAIN.md` §17; `docs/financial-logic/graph/*` (anchors fixed + new cascade-adapter engine + aiNeverAutoFiles law).

#### Testing
- [x] `tests/neobrain/{merchantNoise,cascadeReconcile}.test.ts` + `scrubSignature` — **48 passed** (pure-logic; DB siblings mocked so they run without a generated Prisma client).
- [x] `npm run neomatrix:check` — green (anchors resolve 146/146; census 0).
- [ ] Full vitest + `next build` — **Vercel preview** (container can't `npm ci`/`prisma generate` — network).

#### Self-review (§20.4 — financial build, 10/10)
v1 8.5 → v2 10/10: scope tightened to surgical (swap one call, keep import structure), risky deletion split to a follow-up, source-guard proven exclusive/exhaustive across the three bands.

---

### Phase 54.2b — grounded merchant identification ("compare online") + Prisma sandbox fix

**Type**: Feature (gated off) + dev-tooling fix. **Reza decision 2026-07-01**: build the "compare online → this looks like Hungry Jacks" grounding now on the current SDK, gated off; verify on prod when enabled.

**54.2b — grounded identify (gated `KB_GEMINI_GROUNDING_ENABLED`, default off):**
- Last-resort step in `geminiCategoriseOnMiss`: when the ungrounded pass missed / scored `<0.6`, a single Gemini 2.x `google_search`-grounded call proposes a merchant NAME + category (`merchantGuess`). De-identified token ONLY (scrubToSignature runs once at the top — CDR §13.3). Never auto-files (`source:'AI'`, §54.2). Any grounding error → keep the ungrounded result (never breaks categorisation).
- `lib/ai/google/geminiClient.ts` — new `generateGeminiGroundedText` (google_search tool + grounding metadata + usage telemetry). SDK 0.24.1 under-types the 2.x tool → `googleSearch` passed via a narrow cast (forwarded to REST); grounding is text-mode (JSON-incompatible) → parsed by pure `parseGroundedMerchantResult`.
- Data residency: global Gemini pre-Basiq (Reza's standing decision); re-points to Vertex-AU at Basiq go-live (§15.6.1).
- Tests: `tests/neobrain/groundedIdentify.test.ts` (9) — parser + gating. Neomatrix: new `engine.kbGrounding.geminiIdentifyMerchantGrounded` + de-id edges; `neomatrix:check` green. §20.4 v1 8.5 → **10/10**.

**Prisma sandbox fix (Reza directive "fix that rather than workaround"):**
- Root cause: `prisma generate` in the Claude Code Web sandbox dies on (1) a telemetry ping to checkpoint.prisma.io and (2) a schema-engine download from binaries.prisma.sh — and Prisma's Node downloader does NOT honor the agent proxy (curl does), so the direct connection is reset (ECONNRESET). No client generated → every DB-touching test failed to load.
- Fix: `scripts/dev/sandbox-prisma-generate.sh` — curls the schema-engine via the proxy, points `PRISMA_SCHEMA_ENGINE_BINARY`/`PRISMA_QUERY_ENGINE_LIBRARY` at local binaries, `CHECKPOINT_DISABLE=1`. Real client now generates; full vitest suite runs locally as in CI.
- Removed the `vi.mock('@/lib/db')` workaround from `cascadeReconcile.test.ts` + `groundedIdentify.test.ts` — they now run against the real generated client (46 tests green). Local `tsc` confirmed 54.2b files type-clean (the pre-push check that would have caught the #1318 import error).

#### Files Modified
- `lib/categorisation/kb/geminiOnMiss.ts` — grounded last-resort + `KB_GEMINI_GROUNDING_ENABLED` + `parseGroundedMerchantResult` + `geminiIdentifyMerchantGrounded`; `GeminiCategoryResult.merchantGuess/grounded`.
- `lib/ai/google/geminiClient.ts` — `generateGeminiGroundedText` + `GeminiGroundedResult`.
- `tests/neobrain/groundedIdentify.test.ts` (NEW); mocks removed from `cascadeReconcile.test.ts`.
- `scripts/dev/sandbox-prisma-generate.sh` (NEW); `docs/blueprint/PHASE_54_NEOBRAIN.md` §18; `docs/financial-logic/graph/*`.

#### Testing
- [x] `tests/neobrain/*` — **98 passed** (against the REAL generated client).
- [x] `tsc --noEmit` — 54.2b files clean (pre-existing `@vercel/oidc`/recharts env-only errors unrelated).
- [x] `npm run neomatrix:check` — green.

---

### Phase 54.2c — delete the retired bulk-Gemini categoriser (dead-code cleanup)

**Type**: Cleanup (§12.1). The follow-up promised in 54.2, now that Prisma generates locally so a large deletion is `tsc`-verifiable.

- Deleted `categoriseWithAI` + `categoriseInBatches` (the retired Path A bulk-Gemini categoriser, no runtime caller since 54.2) and their exclusively-used dead code: `TRANSACTION_CATEGORIZATION_SYSTEM_PROMPT`, `buildUserPrompt`, `calculateAdjustedConfidence`, and the now-unused `AIBatchCategorizationResult` + `MerchantLearning` interfaces. Removed the now-unused imports (`generateGeminiJSONCompletion`, `isGeminiConfigured`, `GEMINI_MODELS`). Kept `buildUncategorisedResults` (still used by `categoriseUnknownsViaCascade`) + `GeminiUsageMetrics` (still used by `categoriseWithLearning`).
- No behaviour change — the one AI categoriser (KB cascade + `geminiCategoriseOnMiss`) is unaffected. `lib/bank/aiCategorisation.ts` −~390 lines.
- Verified: `tsc --noEmit` clean for the file; `tests/neobrain/cascadeReconcile.test.ts` (10) green; Neomatrix anchors re-pointed (`classifyByConfidence:134`, `categoriseUnknownsViaCascade:269`, `categoriseWithLearning:303`, `processUserConfirmation:436`), `neomatrix:check` green.

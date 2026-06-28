# CDR / Basiq Go-Live Cutover — AI Data-Residency Playbook

> **Status: PARKED. Trigger: a decision to pursue Basiq CDR accreditation (or any go-live that claims AU data residency for the AI path).**
>
> **What this is:** the single, self-contained playbook for closing CDR compliance **Finding F-AI-1** (AI model-provider data residency) at go-live. It exists so that when Basiq becomes real, nobody re-discovers the model-availability constraints or re-derives the cutover steps — they're written down, with the verified evidence.
>
> **Owner doc:** `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` → Finding F-AI-1. **Phase tracking:** `docs/blueprint/PHASE_54_NEOBRAIN.md` §15.6 / §15.6.1 (Phase 0.5, PARKED). **Last updated:** 2026-06-28.

---

## 1. Why this exists (the finding, in one paragraph)

Monitrax sends AI prompts (some already containing real financial figures — cashflow summary, debt analysis) through the **consumer Gemini Developer API** (`@google/generative-ai` + `GEMINI_API_KEY`). The account is on the **paid tier**, so Google **does not train on the data and does not human-review it** (the Cloud Data Processing Addendum applies). However, the paid consumer tier only guarantees *no-training* — **not data residency**: Google's terms allow storage/processing *"in any country"*. CDR compliance matrix **row 2.3** requires CDR data to **stay in Australia**. That residency gap is the finding.

**"No-train" vs "residency" — keep these separate:**

| Guarantee | Question it answers | Paid consumer Gemini | Vertex AI (AU region) |
|---|---|---|---|
| **No-training** | *Will Google learn from my data?* | ✅ No | ✅ No |
| **No human review** | *Will a person read it?* | ✅ No | ✅ No |
| **AU data residency** | *Where is it stored/processed?* | ❌ "any country" | ✅ `australia-southeast1`, contractual |
| **DPA / enterprise terms** | *Is there a data-processing agreement?* | Partial (CDPA) | ✅ Full |

The fix that closes the residency gap is **migrating the AI gateway to Vertex AI** pinned to `australia-southeast1`, authenticated with the **existing** Workload Identity Federation identity (no new credential).

## 2. Current decision (2026-06-28) — DEFERRED, and why

**Reza decision (2026-06-28): keep the most-capable models now; defer the Vertex AU cutover to Basiq go-live.**

The reason is empirical, not preference. A **live probe** of Vertex's `australia-southeast1` regional endpoint (run in Cloud Shell as Owner, 2026-06-28) returned:

| Model | `australia-southeast1` regional | Role in app |
|---|---|---|
| **`gemini-2.5-flash`** | **HTTP 200 — served ✅** | (would become flash primary on Vertex) |
| `gemini-3.5-flash` | HTTP 404 — not in region | **current flash primary** |
| `gemini-2.5-pro` | HTTP 404 — not in region | (pro tier) |
| `gemini-3.1-pro-preview` | HTTP 404 — not in region | **current pro primary** |
| `gemini-2.0-flash-001` | HTTP 404 — not in region | — |
| `gemini-flash-latest` | HTTP 404 — not in region | — |

So an AU-resident Vertex cutover **today** would force:
- a **one-tier flash downgrade**: `gemini-3.5-flash` → `gemini-2.5-flash`, **and**
- **loss of the pro tier** entirely (pro surfaces would run on `gemini-2.5-flash`).

Because Monitrax is **not live with Basiq and has no current plan to pursue accreditation**, that capability cost is not justified yet. The residency gap is tolerable in the interim because **no CDR data is flowing, no accreditation is being claimed**, and the **Neobrain grounding layer — not the model — is the financial-correctness guarantee** (the validator rejects any figure the model invents; the model narrates verified facts, it does not compute them). The *no-training* guarantee already protects against the worst case (data training Google's models).

**This gap is documented and deferred — NOT closed.** Closing it is a hard pre-condition of go-live (§4).

> ⚠️ **Probe staleness.** Vertex's Sydney model roster changes over time. The table above is a **2026-06-28 snapshot**. **Re-run the probe (§3) at cutover** — by then `gemini-3.5-flash` and/or a pro model may be AU-resident, removing the downgrade entirely.

## 3. The probe — re-verify Sydney model availability at cutover

Run in **GCP Cloud Shell** (pre-authenticated; no local `gcloud` needed):

```bash
PROJECT=monitrax-479700; REGION=australia-southeast1; TOKEN=$(gcloud auth print-access-token)
for M in gemini-3.5-flash gemini-2.5-flash gemini-2.5-pro gemini-3.1-pro-preview gemini-2.0-flash-001 gemini-flash-latest; do
  R=$(curl -s -w "\n%{http_code}" -X POST \
    "https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${M}:generateContent" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d '{"contents":[{"role":"user","parts":[{"text":"ping"}]}]}')
  CODE=$(echo "$R" | tail -1); MSG=$(echo "$R" | head -n -1 | tr -d '\n' | cut -c1-120)
  echo "$M -> $CODE ${MSG:+| $MSG}"
done
```

- **200** = served regionally in Sydney → pin the gateway to that exact model ID.
- **404 "Publisher model … not found"** = not AU-resident → do **not** use it (never fall back to `global`/US — that re-breaks row 2.3).
- **401** = no/empty token (you ran it where `gcloud` isn't installed/authed — use Cloud Shell).

Append the fresh result to the §2 table with the cutover date when you run it.

## 4. The cutover checklist (when the Basiq trigger fires)

### 4.1 Already pre-staged (inert today — verify still present, don't redo)

| # | Item | State | Verify |
|---|---|---|---|
| 1 | Vertex AI API enabled | ✅ done 2026-06-28 | `gcloud services list --enabled --filter=aiplatform` |
| 2 | `roles/aiplatform.user` on runtime SA `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` | ✅ done 2026-06-28 | `gcloud projects get-iam-policy monitrax-479700 --flatten="bindings[].members" --filter="bindings.members:serviceAccount:vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com AND bindings.role:roles/aiplatform.user"` |
| 3 | `VERTEX_PROJECT=monitrax-479700`, `VERTEX_LOCATION=australia-southeast1` on Vercel (Prod+Preview) | ✅ set 2026-06-28 | Vercel → Settings → Environment Variables |
| 4 | `USE_VERTEX` | ❌ deliberately **unset** (Gemini path active) | flipping this is the LAST step (§4.3) |

> These are non-secret identifiers — none grants access on its own (auth is the runtime OIDC/WIF token). Pre-staging them was free; they remain dormant until the gateway code exists.

### 4.2 Build the gateway (code PR — does NOT flip the flag)

1. **Re-run the §3 probe**; pin `VERTEX_MODEL_FLASH` / `VERTEX_MODEL_PRO` env vars to the AU-resident models found. (2026-06-28 fallback if nothing newer: both = `gemini-2.5-flash`.)
2. **Add `@google-cloud/vertexai`** to `package.json` + an entry in `docs/policy/APPROVED_DEPENDENCIES.md` (§13.8).
3. **Build `lib/ai/google/vertexGateway.ts`** — same `generateGemini{JSON,Text}Completion` contract as `lib/ai/google/geminiClient.ts`, but routed through `@google-cloud/vertexai`, **region-pinned to `australia-southeast1`**, authenticated by passing the existing `buildGcpWifAuthClient()` (`lib/gcp/wifAuthClient.ts`) as `googleAuthOptions.authClient` — **no new credential**. Model IDs from the configurable env vars (not hardcoded).
4. **Provider switch** behind `USE_VERTEX`: when `true` + project/location present → Vertex; else the current paid Gemini path (unchanged fallback). Flag-off = byte-identical to today.
5. **Fold in the SSOT cleanup** (old Phase D): repoint/remove the duplicate `lib/ai/gemini.ts` (4 callers: `geminiOnMiss`, `trust-deed/geminiExtractor`, `analyze-for-form`, `entities/[id]/trust-deed`).
6. **Deterministic adapter tests** (mapping/format/fallback logic — not live model calls).
7. **Docs in the same PR (§16.3):** `09_INFRASTRUCTURE_AND_DEPLOYMENT.md` (env vars), `docs/operational/security/02_IAM_AND_PERMISSIONS.md` (the SA role), this file (mark cutover in progress), and flip CDR matrix Finding F-AI-1 toward closure.
8. Merge with `USE_VERTEX` still unset → **zero behaviour change** in production.

### 4.3 Flip + verify (the actual cutover)

1. Set `USE_VERTEX=true` on Vercel (Preview first).
2. On a preview deploy, exercise each AI surface (categorisation, CFO advisor, tax advisor, debt analysis, document intelligence, cashflow summary) and confirm responses return from Vertex `australia-southeast1` (check runtime logs for the Vertex endpoint + no 404s).
3. Promote to Production; flip `USE_VERTEX=true` in Prod scope.
4. **Close the loop in compliance docs:** flip CDR matrix row 2.3's AI exception to **resolved**; mark Finding F-AI-1 **closed** with the cutover date + the model the gateway is pinned to; update `docs/operational/security/03_CDR_COMPLIANCE.md`.

### 4.4 Acceptance criteria (go-live is not done until ALL true)

- [ ] §3 probe re-run at cutover; gateway pinned only to AU-resident model IDs.
- [ ] No AI surface can reach a non-AU region (no `global` endpoint, no US fallback in code).
- [ ] `USE_VERTEX=true` in Production; runtime logs show `australia-southeast1` Vertex calls, zero 404s across all AI surfaces.
- [ ] CDR matrix Finding F-AI-1 marked **closed**; row 2.3 AI exception removed.
- [ ] The model downgrade (if any remains) is acknowledged in the go-live record with sign-off.

## 5. The capability trade-off to brief at go-live (financial-adviser lens)

If, at cutover, Sydney still serves only `gemini-2.5-flash`, the AI agents step down one flash tier and lose the pro tier **for the AU-resident path**. This is **low-risk for correctness** because of Neobrain's grounding architecture: the figures the user sees are **verified facts** supplied by the FactPack and enforced by the grounding validator — the model phrases them, it does not compute them, and an invented number is rejected before it reaches the user. The downgrade affects *tone/phrasing*, not *financial accuracy*. The configurable `VERTEX_MODEL_*` env vars mean any later Sydney model upgrade is a **one-line config change, no code deploy**.

**Cost moves the *right* way at cutover.** The AU-resident `gemini-2.5-flash` is **materially cheaper** than the current `gemini-3.5-flash`, so the residency migration also *reduces* AI spend — cost is a point in favour of the cutover, not against it. Per 1M tokens (USD, consumer list price as of 2026-06-10; Vertex bills the same Gemini models at/near per-token parity — **re-confirm at go-live**):

| Model | Input /1M | Output /1M | vs current `3.5-flash` |
|---|---|---|---|
| **`gemini-2.5-flash`** (AU-resident) | **$0.30** | **$2.50** | **~5× cheaper in · ~3.6× cheaper out** |
| `gemini-3.5-flash` (current flash primary) | $1.50 | $9.00 | — |
| `gemini-2.5-pro` | $1.25 | $10.00 | — |
| `gemini-3.1-pro-preview` (current pro primary) | $2.00 | $12.00 | — |

Honest framing for the go-live decision: today Monitrax pays a **capability premium** (`3.5-flash`/pro) while it is *not* residency-constrained; at Basiq go-live it trades some capability for **both AU residency and a lower bill**. The only thing the grounding layer cannot absorb is a surface that genuinely needs pro-tier *reasoning* (not numbers) and finds no AU-resident pro — that single decision is Reza's (§5, last paragraph).

If a richer model is genuinely required for a specific surface at go-live and isn't AU-resident, the decision is Reza's: accept the AU model, or keep that *one* surface on the paid consumer tier with a documented, scoped row-2.3 exception (only acceptable if that surface sends no CDR data).

## 6. References

- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Finding F-AI-1, row 2.3.
- `docs/blueprint/PHASE_54_NEOBRAIN.md` §15 (grounding), §15.6 / §15.6.1 (Phase 0.5).
- `lib/gcp/wifAuthClient.ts` — the keyless WIF auth client the gateway reuses.
- `lib/ai/google/geminiClient.ts`, `lib/ai/google/modelConfig.ts` — current Gemini path + model IDs.
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) · [Vertex AI data governance](https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance) · [Vertex AI locations](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations) · [GCP gen-AI data-residency guarantees](https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-generative-ai-data-residency-guarantees-for-data-stored-at-rest).

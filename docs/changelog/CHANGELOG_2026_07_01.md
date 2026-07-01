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

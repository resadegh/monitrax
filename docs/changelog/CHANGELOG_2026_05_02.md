
---

## Late-morning addendum — Google Maps key audit completed

### Outcome

End-to-end Maps setup landed on production:
- ✅ Maps Embed API + Geocoding API + Places API (New) enabled in GCP project `monitrax-479700`
- ✅ Frontend key (`Monitrax Maps Frontend`, value already wired to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) confirmed scoped: HTTP-referrer restrictions for prod + preview + localhost, API restrictions to 4 Maps APIs (Maps Embed + Maps JavaScript + Places + Places New)
- ✅ Backend key (`Monitrax Maps Backend (Geocoding only)`) created and added to Vercel as `GOOGLE_MAPS_API_KEY` (no `NEXT_PUBLIC_` prefix), all environments. Closes a silent breakage where `/api/geocode` had been logging `"GOOGLE_MAPS_API_KEY not configured"` since the GCP migration.
- ✅ Property iframe loading correctly on `/dashboard/properties` detail dialog
- ✅ Address autocomplete on the property add/edit form working
- ✅ Backend geocoding restored

### Legacy "Maps Platform API Key" — soft-disabled, 24-hour observation window

GCP audit surfaced a fifth pre-existing key, `Maps Platform API Key`, auto-created 10 Dec 2025 with **no restrictions across 32 APIs** — a wide-blast-radius security issue if it were ever leaked.

Three independent checks all returned negative for active usage:
1. Vercel env-var scan — no env var holds this key's value
2. Codebase grep (`grep -rln "AIza..." . --exclude-dir=node_modules`) — zero matches
3. Maps Platform Metrics dashboard — zero traffic on Maps Embed / Geocoding / etc; Places API has 256/month traffic but consistent with normal frontend-key autocomplete usage

Decision: **soft-disable** rather than hard-delete, in case a non-obvious caller surfaces during the observation window. Disable mechanism = the "nuclear-restriction" trick:

> API restrictions reset to **Restrict key** with **only "Cloud Resource Manager API"** ticked. CRM is a service Maps doesn't use, so the key becomes unable to serve any Maps request, but the key row is intact and one-click reversible.

**Trigger to permanently delete:** ≥ 2026-05-03 if no Maps regressions observed, or ≥ 2026-05-15 if extra caution preferred.

**If anything breaks during the 24-hour wait:** rollback procedure documented in `docs/operational/runbooks/04_GOOGLE_MAPS_SETUP.md` §8 Troubleshooting → "Maps Platform API Key reactivation". Either toggle to "Don't restrict key" (full reversal) or tick the specific API the failure points to (preferred — narrower restoration).

### Open follow-ups

- **`MonitraxGemini` key (separate concern).** Same screenshot revealed another unrestricted key with a warning icon. Tracked as `IMPLEMENTATION_PLAN.md` Tech Debt row #14. Same audit pattern: check Gemini API metrics, soft-disable if unused, narrow restrictions to "Generative Language API" only if used. Run during the next housekeeping pass.
- **Frontend key rotation (low risk while pre-launch).** The Monitrax Maps Frontend key value was momentarily visible in a Vercel env-var screenshot during this session — it's now in conversation logs. While restrictions (HTTP referrer + API allowlist) prevent abuse, best practice is to rotate before any paying users. Captured in `docs/operational/runbooks/04_GOOGLE_MAPS_SETUP.md` §11 Review history.

### Files modified (added to PR #581)

- `docs/operational/runbooks/04_GOOGLE_MAPS_SETUP.md` — new §8 Troubleshooting entry "Maps Platform API Key reactivation", new §11 Review history with full incident record (initial creation + frontend confirmation + backend creation + soft-disable + open follow-ups).
- `docs/IMPLEMENTATION_PLAN.md` — Tech Debt rows #13 (Maps Platform API Key delete-after-observation) and #14 (`MonitraxGemini` audit pending).
- `docs/changelog/CHANGELOG_2026_05_02.md` — this addendum.

### Risk

Zero (docs only). The actual key disable was performed by Reza in the GCP Console — code/infra side has no commit. This addendum documents the change so future-Reza, future-Claude, and future-ops can troubleshoot or roll back.

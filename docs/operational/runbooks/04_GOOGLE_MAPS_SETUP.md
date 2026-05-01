# Google Maps Platform — Setup & Operations Runbook

**Audience:** Reza (operator) + future Monitrax operations team
**Last updated:** 2026-05-02
**Related spec:** `docs/blueprint/PHASE_20_GOOGLE_MAPS_INTEGRATION.md` (architecture, cost, design rationale)
**Trigger to read this:** error *"Google Maps Platform rejected your request. This API is not activated on your API project"* on `/dashboard/properties` · or new GCP project setup · or quarterly key-restriction audit.

---

## Table of contents

1. [What Monitrax uses Google Maps for](#1-what-monitrax-uses-google-maps-for)
2. [APIs that must be enabled](#2-apis-that-must-be-enabled)
3. [API keys — frontend vs backend](#3-api-keys--frontend-vs-backend)
4. [Step-by-step: enabling the APIs](#4-step-by-step-enabling-the-apis)
5. [Step-by-step: verifying API key scoping](#5-step-by-step-verifying-api-key-scoping)
6. [Environment variables](#6-environment-variables)
7. [Verifying it works end-to-end](#7-verifying-it-works-end-to-end)
8. [Troubleshooting](#8-troubleshooting)
9. [Cost monitoring + budget alerts](#9-cost-monitoring--budget-alerts)
10. [Quarterly review checklist](#10-quarterly-review-checklist)

---

## 1. What Monitrax uses Google Maps for

| Surface | Code path | Purpose |
|---|---|---|
| Property detail dialog → Location map | `components/google-maps/PropertyMap.tsx` | Embedded iframe map at the property's lat/lng |
| Property add/edit form → Address autocomplete | `components/google-maps/AddressAutocomplete.tsx` → `/api/places` | Predictive autocomplete as the user types an address |
| Backend address → coordinates resolution | `app/api/geocode/route.ts` → `lib/google/maps.ts` | Convert "903 Boree Valley Rd, Laguna NSW 2325" into lat/lng + place ID for storage |
| Property summary tile (static fallback) | `components/google-maps/PropertyMap.tsx` `<StaticPropertyMap>` | Static image map for low-bandwidth / print contexts |

---

## 2. APIs that must be enabled

In GCP Console, three Maps APIs must be **ENABLED** on the Monitrax project:

| API | Used by | Library link |
|---|---|---|
| **Maps Embed API** | `<PropertyMap>` iframe | https://console.cloud.google.com/apis/library/maps-embed-backend.googleapis.com |
| **Geocoding API** | `/api/geocode` + `lib/google/maps.ts` | https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com |
| **Places API (New)** | `/api/places` (address autocomplete) | https://console.cloud.google.com/apis/library/places-backend.googleapis.com |

Note: "Places API (New)" is the current generation. The legacy "Places API" is being deprecated by Google — if you see both, enable **Places API (New)**.

> **Billing must be enabled on the project for Maps APIs to work.** Google offers a $200/month free credit which covers Monitrax's expected scale (see §9). Without billing enabled, even free-tier requests get rejected with the same "API not activated" error.

---

## 3. API keys — frontend vs backend

Monitrax uses **two separate API keys** to enforce least-privilege:

| Key | Env var name | Used by | Restrictions |
|---|---|---|---|
| **Frontend key** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser — `<PropertyMap>` iframe URL, `<StaticPropertyMap>` image URL, address autocomplete on the client | **HTTP referrer** allowlist (see §5). API restrictions: Maps Embed API + Places API only. |
| **Backend key** | `GOOGLE_MAPS_API_KEY` | Server — `/api/geocode`, `/api/places`, any internal call from `lib/google/maps.ts` | **No referrer restrictions** (it's server-side; referrers are not sent). API restrictions: Geocoding API only. Optional: IP allowlist for Vercel egress (skip until paying users — Vercel doesn't publish a stable IP range). |

**Why two keys:** if either leaks, the blast radius is contained:
- Frontend leak → attacker can only abuse Maps Embed + Places under YOUR domain (the referrer restriction blocks everyone else)
- Backend leak → attacker can only call Geocoding (no map embeds, no autocomplete UI)

---

## 4. Step-by-step: enabling the APIs

This takes ~3 minutes assuming billing is already enabled.

1. **Open the GCP Console** and select the Monitrax project: https://console.cloud.google.com/?project=monitrax-479700 (replace project ID if different).

2. **Confirm billing is enabled** — left nav → **Billing**. If you see "This project has no billing account" or similar, link a billing account before continuing. Google's $200/month free credit applies automatically once billing is linked.

3. **Open the API Library filtered to Maps**:
   https://console.cloud.google.com/apis/library?filter=category:maps

4. **Enable each of the three APIs**:
   - Click into **Maps Embed API** → click **ENABLE** (green button). Wait for the spinner; the page will redirect to the API's overview when done.
   - Repeat for **Geocoding API**.
   - Repeat for **Places API (New)** (NOT the legacy "Places API").

5. **Wait ~1 minute for propagation.** Google's edge cache can serve a stale "API not activated" response briefly after enabling. Hard-refresh the failing page (`Cmd+Shift+R` on Mac) after the wait.

> ✅ At this point the property map should load. If it still shows the same error after 5 minutes, see [§8 Troubleshooting](#8-troubleshooting).

---

## 5. Step-by-step: verifying API key scoping

Run this **once after enabling APIs** (to lock down keys per the principle of least-privilege), then **quarterly** as part of the §10 review.

### A) Find your existing keys

1. GCP Console → **APIs & Services → Credentials**: https://console.cloud.google.com/apis/credentials
2. You should see at least two keys (or more if older keys still exist):
   - One labelled for frontend use (e.g. *"Monitrax frontend Maps key"*)
   - One labelled for backend use (e.g. *"Monitrax server-side Geocoding"*)
3. If you see ONE key being used for everything, **create a second key now** so frontend and backend can have different restrictions:
   - Click **+ CREATE CREDENTIALS → API key**
   - Rename via the pencil icon — clear naming saves future-you (e.g. *"Monitrax frontend (Maps Embed + Places)"*).

### B) Frontend key — restrict to your domain

1. Click the frontend key's **edit** icon (pencil).
2. **Application restrictions** section → select **HTTP referrers (web sites)**.
3. Click **ADD AN ITEM** for each domain Monitrax serves from:
   ```
   https://monitrax.com.au/*
   https://*.monitrax.com.au/*
   https://*.vercel.app/*           ← Vercel preview deployments
   http://localhost:3000/*          ← local dev (only if needed)
   ```
   The trailing `/*` is critical — without it, only the bare host `https://monitrax.com.au` (no path) will be accepted.
4. **API restrictions** section → select **Restrict key**.
5. Tick **only**:
   - ✅ Maps Embed API
   - ✅ Places API (New)
6. (Optional but recommended) Tick **Maps JavaScript API** as well — Google's autocomplete library sometimes calls it under the hood. Untick everything else.
7. Click **SAVE**. Changes take ~5 minutes to propagate.

### C) Backend key — restrict to Geocoding only

1. Click the backend key's **edit** icon.
2. **Application restrictions** section:
   - **Recommended for now:** select **None**. Vercel doesn't publish a stable egress IP range, so an IP allowlist is impractical.
   - **Future hardening (post-launch):** when you upgrade to **Vercel Static IP** (~AU$30-50/mo, justifies itself once paying users exist), come back here and set **IP addresses** with the Vercel-issued static IPs. Documented in `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 alongside the Cloud SQL `0.0.0.0/0` migration plan — same trigger.
3. **API restrictions** section → select **Restrict key**.
4. Tick **only**:
   - ✅ Geocoding API
5. Untick everything else (especially Maps Embed API and Places API — those should NOT be reachable from the backend key).
6. Click **SAVE**.

### D) Sanity check — try to misuse each key

After ~5 minutes for propagation:

```bash
# Backend key on a frontend-only API → should FAIL (request denied)
curl "https://www.google.com/maps/embed/v1/place?key=$GOOGLE_MAPS_API_KEY&q=Sydney"
# Expected: HTML error or 403

# Frontend key from terminal (no referrer header) → should FAIL
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Sydney&key=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
# Expected JSON: { "error_message": "API keys with referer restrictions...", "status": "REQUEST_DENIED" }
```

If either succeeds, your restrictions aren't applied — re-check the key's Application restrictions panel.

---

## 6. Environment variables

These must be set on **Vercel** (Production + Preview + Development scopes) and in `.env.local` for local dev:

| Var | Scope | Source key | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Production · Preview · Development | Frontend key from §5B | Bundled into client JS — `NEXT_PUBLIC_` prefix is intentional. Domain-restricted. |
| `GOOGLE_MAPS_API_KEY` | Production · Preview · Development | Backend key from §5C | Server-only — never bundled. |

To set on Vercel:
1. https://vercel.com/[your-team]/[your-project]/settings/environment-variables
2. Add each var with the right Environment scope ticked.
3. Redeploy the latest production commit so the new vars take effect (Settings → Deployments → ⋯ → Redeploy).

To set locally:
```bash
# Append to .env.local (gitignored)
echo 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="<frontend-key-value>"' >> .env.local
echo 'GOOGLE_MAPS_API_KEY="<backend-key-value>"' >> .env.local
```

---

## 7. Verifying it works end-to-end

After enabling APIs (§4) + restricting keys (§5) + setting env vars (§6):

1. **Map embed** — `/dashboard/properties` → expand a property → **Details** tab. The Location section should show an interactive Google map at the property's address. No error banner.
2. **Address autocomplete** — `/dashboard/properties` → **Add Property** → start typing in the address field. Suggestions should appear within 1-2 keystrokes.
3. **Backend geocoding** — Add a new property with a real address. After save, the property should have populated `latitude` / `longitude` columns (visible via the Property dialog → Edit → location debug panel, OR via `prisma studio` on the dev DB). If lat/lng are null, Geocoding API isn't being called from the server.
4. **GCP Console metrics** — https://console.cloud.google.com/google/maps-apis/metrics. Within ~5 minutes of a successful test you should see request counts climb on the relevant API.

---

## 8. Troubleshooting

### "API not activated" still appears 5+ minutes after enabling

- Hard-refresh the page (`Cmd+Shift+R` on Mac, `Ctrl+Shift+R` on others) — Next.js may be serving cached HTML referencing a previous failed iframe load.
- Check you enabled the API on the **correct project**. Top-left of GCP Console shows the project name; click it to switch. Easy to enable on a personal project by accident.
- Check billing — even with the API enabled, Maps APIs require billing to be linked.

### "RefererNotAllowedMapError" in browser console

Frontend key's referrer allowlist is missing your current domain. Add the exact origin to §5B's referrer list. Note that `*.vercel.app/*` covers preview deployments but NOT the production custom domain — both must be listed.

### Backend `/api/geocode` returns `REQUEST_DENIED`

- Backend key's API restrictions are wrong — should include Geocoding API.
- OR backend key has referrer restrictions set — should be **None** (server-to-server has no referrer header). See §5C step 2.

### Cost suddenly spiked

- Check whose code is hitting the APIs — `console.cloud.google.com/google/maps-apis/metrics` filters by API. If autocomplete (Places) is the spike, it's likely a hot loop in a form (every keystroke fires a session). Audit recent property/address-form changes.
- Set a budget alert (§9) so this surfaces before the bill arrives.

### Local dev shows the map but production doesn't

`localhost:3000/*` is in the frontend key's referrer list, but production isn't. Check Vercel env vars are set + the production custom domain (`monitrax.com.au`) is in the referrer allowlist.

### `/dashboard/properties` map shows but autocomplete doesn't

Frontend key has Maps Embed enabled but Places API is missing from API restrictions, OR Places API isn't enabled on the project. Both must be in place.

---

## 9. Cost monitoring + budget alerts

Google's pricing as of 2026:

| API | Free tier (per month) | Cost beyond free |
|---|---|---|
| Maps Embed API | Unlimited (free always) | $0 |
| Geocoding API | 10,000 requests | $5 / 1,000 requests |
| Places API (Autocomplete sessions) | ~11,000 sessions | $2.83 / 1,000 sessions |

The **$200/month free credit** covers everything except runaway autocomplete bugs.

Set a budget alert so accidental spikes surface immediately:

1. https://console.cloud.google.com/billing/budgets → **CREATE BUDGET**
2. Scope: the Monitrax project + the three Maps APIs.
3. Amount: AU$50/month (well under free tier).
4. Alerts: email at 50% / 90% / 100% of the budget. **Tick the "Send alert email to billing administrators" box.**

---

## 10. Quarterly review checklist

Run this every 90 days (or when adding a new domain / changing the deployment topology):

- [ ] Frontend key's referrer list still matches all current Monitrax origins (no extra entries from old preview environments)
- [ ] Backend key's API restrictions are still **only Geocoding** (no creep to other APIs)
- [ ] Budget alert (§9) has fired ≥ 0 times — if it has, investigate cause
- [ ] No unused API keys in Credentials (delete orphans)
- [ ] If we've upgraded to **Vercel Static IP** since last review → migrate backend key from "no application restrictions" to IP-allowlisted (per §5C step 2 future hardening)
- [ ] No Maps APIs are enabled that we don't actually use (each enabled API is a potential abuse surface)

Document the review by adding a dated line to this file under a **Review history** section at the bottom (create the section if it doesn't exist yet).

---

## Reference

- **Spec:** `docs/blueprint/PHASE_20_GOOGLE_MAPS_INTEGRATION.md` (cost model, design rationale, why two keys)
- **Architecture:** `docs/operational/architecture/03_TECHNOLOGY_STACK.md` (lists Maps APIs as external services)
- **Component code:**
  - `components/google-maps/PropertyMap.tsx`
  - `components/google-maps/AddressAutocomplete.tsx`
  - `app/api/geocode/route.ts`
  - `app/api/places/route.ts`
  - `lib/google/maps.ts`

---

## Review history

*(Add dated entries here after each quarterly review. Format: `2026-MM-DD — [name] — findings`.)*

- *2026-05-02 — Claude — initial runbook created (Phase 38 follow-up after user reported "API not activated" error on property detail page).*

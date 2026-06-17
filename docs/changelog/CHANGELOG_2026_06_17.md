# Changelog - 2026-06-17

## Session: vision-key-first-restore-shk180

### Changes Made
- **Type**: Fix
- **Scope**: GCP auth — Vision OCR credential order
- **Root Cause**: The keyless GCS/Vision cutover was shipped before keyless was
  proven in prod, and the working `GCS_SERVICE_ACCOUNT_KEY` was deleted. Prod
  logs from a live receipt upload showed keyless GCS failing with
  `Anonymous caller does not have storage.buckets.get access` (401) — the
  keyless `authClient` is not honoured by `@google-cloud/storage` at runtime
  (cross-package google-auth-library instance). Storage + telemetry are
  key-first, so restoring the key fixes them; but `visionService.ts` was made
  **keyless-first** in #1131, so it would keep using the broken keyless path
  even after the key is restored.
- **Solution**: Flip `visionService.initialize()` back to **key-first**
  (service-account key → keyless WIF → ADC), matching the storage provider and
  the telemetry sinks. A single `GCS_SERVICE_ACCOUNT_KEY` now governs all GCP
  clients consistently. Keyless remains the fallback when no key is set, to be
  re-enabled only once it is verified end-to-end in prod.

### Files Modified
- `lib/documents/intelligence/services/visionService.ts` — key-first auth order + JSDoc

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Operator action (Reza)
- Restore `GCS_SERVICE_ACCOUNT_KEY` (Production scope) in Vercel. Merging this PR
  triggers the deploy that picks up the key + the Vision fix together.

### Follow-ups
- "AI didn't recognise my photo" — the per-expense camera/attach button uploads
  with `analyze:false` (files the doc, no OCR by design). AI recognition runs via
  the global **Scan a receipt** flow (`/api/documents/analyze*`). Optional
  follow-up: wire analyze+prefill into the per-item camera path.
- Proper keyless: solve the cross-package `authClient` wiring (pass external_account
  config so the SDK's own google-auth-library builds the client), verify in prod
  with the key still present as fallback, then remove the key.

## Session: vision-grpc-rest-fallback-shk180

### Changes Made
- **Type**: Fix (root cause)
- **Scope**: Vision OCR transport
- **Root Cause**: Live prod logs of a receipt scan showed Vision authenticating
  fine with the key (`[Vision] Using service account: monitrax-backend@...`) but
  the OCR call then threw `Error: undefined undefined: undefined` (`code: undefined`,
  gax `note: 'Exception occurred in retry method that was not classified as
  transient'`, stack in gRPC `onReceiveStatus`/`callErrorFromStatus`). This is the
  **gRPC (HTTP/2) transport failing in Vercel's bundled serverless runtime** — the
  request dies before reaching Google. It explains the long-standing "Vision API
  enabled but ZERO traffic" symptom: every call failed at the transport layer
  regardless of key vs keyless auth. NOT an auth/permission/billing problem.
- **Solution**: Construct `ImageAnnotatorClient` with `fallback: true` (REST/HTTP
  transport instead of gRPC) on all three auth branches. Standard fix for Google
  client libraries on serverless.

### Files Modified
- `lib/documents/intelligence/services/visionService.ts` — `fallback: true` on all
  three `new ImageAnnotatorClient(...)` calls + header/inline docs

### Build Status
- [x] tsc clean
- [x] `npm run build` passes

### Follow-up (telemetry — issue #2 "fix properly")
- The GCP **telemetry sinks** (Cloud Logging / Monitoring / Error Reporting /
  Security Command Center / Cloud Scheduler) are ALSO gRPC clients, so they likely
  fail the same way on Vercel even with the key restored. Restoring the key stopped
  the crash/no-op; making them actually FUNCTION needs the same REST transport
  (`fallback: true` / REST client) — tracked as the proper telemetry fix.

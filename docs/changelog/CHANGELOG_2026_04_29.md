# Changelog — 2026-04-29

## Session: claude/onboarding-bulk-create-error-details-2hNSa — surface real bulk-create errors

### Changes Made

#### Symptom

User clicked Launch dashboard on the Review step and got:

> Couldn't finish setup. Failed to save onboarding data. Please try
> again — your answers are still saved.

This is the generic 500 fallback. The actual server-side error
message was hidden in the response's `details` field, which the
client wasn't reading. Net result: user can't act on the error,
and we can't easily tell from the screenshot what the underlying
cause was.

#### Root cause

Two issues working together:

1. **Client (`app/onboarding/page.tsx`)** — the `handleComplete`
   error path only read `errorData.error` and ignored
   `errorData.details`. The server's `bulk-create` route puts the
   *generic* string in `error` for 500s and the *actual* failure
   message in `details`, so the wizard footer banner only ever
   showed "Failed to save onboarding data."

2. **Server (`app/api/onboarding/bulk-create/route.ts`)** —
   - The structured log at the catch block only included
     `error: <object>`. No payload context (entity counts,
     profile type, housing path) so we can't correlate failures
     with the user's wizard state from the logs alone.
   - All Prisma-level failures (unique constraint, FK violation,
     transaction timeout) were lumped into the generic 500 with no
     translation to a user-friendly message.

#### Solution

**Client (`app/onboarding/page.tsx`):**

- After a non-OK response, parse `{ error, details }` and assemble
  a single human-readable message: when both are present and
  different, format as `"${error}: ${details}"`. Otherwise fall
  back to whichever is available.
- The wizard footer banner (added in PR #546) now shows the *real*
  cause, not the generic fallback.

**Server (`app/api/onboarding/bulk-create/route.ts`):**

- Hoisted `userId` and the parsed payload (now `parsedPayload:
  WizardData | undefined`) out of the try block so the catch
  handler can include them in the error log without scope errors.
  The `data` reference inside the try body is a local const
  copy of `parsedPayload`, narrowed to non-undefined, so the
  rest of the body type-checks unchanged.
- Added a structured log snapshot in the catch block:
  `{ userId, profileType, housing, counts: { properties,
  propertiesWithLoan, accounts, accountsByType, investments,
  superAccounts, debts, assets, income, expenses,
  householdMembers, householdPets } }`. Counts only — no
  balances, names, addresses, or other CDR-classified data
  enters the log (CLAUDE.md §13.3).
- Translated common Prisma error codes into actionable responses:
  - `P2028` (transaction timeout) → 504 with "Saving took too
    long. Please try again — your answers are still saved."
  - `P2002` (unique constraint) → 409 with the offending
    `target` field name.
  - `P2003` (foreign key violation) → 400 with the offending
    `field_name`/`constraint`.
- For everything else, the generic 500 still ships but now with
  the raw `message` in `details` — which the client now surfaces.

### Files Modified

- `app/onboarding/page.tsx` — client now reads `errorData.details`
  in addition to `errorData.error` and concatenates them when
  both are present.
- `app/api/onboarding/bulk-create/route.ts` — hoisted
  `userId`/`parsedPayload`, added payload-summary log, translated
  common Prisma error codes.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### CDR compliance

The new error log captures **count-only** payload metadata
(profileType, housing path, entity counts). No financial values,
account names, addresses, BSBs, or transaction data is logged.
Compliant with CLAUDE.md §13.3 ("Never log CDR data").

### Destructive write checklist (CLAUDE.md §12.11)

No Prisma writes added or modified in this PR — pure error-path
changes. Checklist not required.

### Outstanding

- Once a real user hits the next bulk-create failure, the new
  banner will show the actual cause. If it's a recurring class
  of failure we'll add a targeted fix.

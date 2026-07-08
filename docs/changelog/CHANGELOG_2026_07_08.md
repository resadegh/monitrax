# Changelog — 2026-07-08

## Session: eloquent-archimedes — MON-025 frequency/recurring logic investigation + plan

### Investigation (agent-verified, file:line)
- Annual QBE car insurance shows $216/mo (should ~$18/mo). Root causes:
  - Reconcile defaults `frequency = body.frequency || 'MONTHLY'` (`link/route.ts:345`); "Where your money goes" trusts the stored declared frequency verbatim (`insights/route.ts:245`). Cadence is NEVER read from the transaction dates.
  - AI/bulk mass-categorisation sets CATEGORY only — hard-codes `isRecurring:false`, `suggestedFrequency:null` (`aiCategorisation.ts:248-250`). No recurring/frequency classification exists.
  - A good cadence detector (`recurringExpenseDetection.ts` — buckets to weekly…annual) is DEAD CODE (no importers).
  - Exact-name dedup misses spelling variants (`link/route.ts:596-607`) → same insurer split into two records with two frequencies.
- Reza requirements (2026-07-08): (a) frequency picker at reconcile; (b) confirm/correct the auto-detected recurring frequency (suggest-and-confirm, never silent).

### Plan (MON-025 — multi-PR workstream)
- Code-first: wire the MON-009 monthly resolver into "Where your money goes"/monthly totals (≥2-payment expenses auto-correct cadence from dates); wire the detector to PROPOSE frequency at reconcile; fuzzy merchant dedup.
- Stitch-first (§18.2.1): frequency picker in the reconcile dialog + a "confirm/change detected frequency" control on auto-detected recurring transactions. Design + ≥9/10 gate + Reza sign-off before build.

No code changes yet — diagnosis + plan only. Registry entry MON-025 (DIAGNOSED).

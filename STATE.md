# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `654bc55` · **on:** 2026-06-16 · **by:** Code session (AI Document Router Phase A+B shipped; cursor refresh)
**Freshness gate:** on session start, compare this HEAD to live `git rev-parse HEAD`. If they differ,
the repo moved — re-verify the cursor below against the live plan BEFORE acting. Do not trust a stale cursor.

---

## A. WHAT MONITRAX IS  (north-star — for detail, see `docs/blueprint/MASTER_BLUEPRINT.md`)

- **Product:** Monitrax (monitrax.com.au) — an Australian Wealth Operating System. Brings property, loans,
  super, investments, cashflow, tax position and entity structures into one picture so users can model the next move.
- **Built by:** Reza, under ReNew Holding Company Pty Ltd (ACN 675 267 311).
- **Regulatory boundary (HARD):** a financial *information* service, NOT a licensed adviser. Surfaces maths and
  mechanisms; never gives personal financial advice, recommends products, or implies licensing not held.
  Respects the AFSL/Credit/Tax boundary + CDR. *(Confirm current ICP/positioning live — see cursor SEC C.)*

## B. THE MAP  (authority order — full registry in `docs/00_INDEX.md`)

0. `SYSTEM_MAP.md` (repo root) — **orientation pointer-map.** What Monitrax is, every authoritative doc +
   what it owns, architecture overview, calc-engine inventory, tool stack. Start here after this STATE.md.
1. `CLAUDE.md` (repo root) — **law.** Governance, four-lens mindset, SSOT + single-calc-engine rule, warm-words,
   session protocol (Parts 1/7/10). When anything conflicts with CLAUDE.md, CLAUDE.md wins.
2. `docs/IMPLEMENTATION_PLAN.md` (hub) + `docs/implementation/*` (spokes) — **status SSOT.** Shipped / active /
   queued / blocked / reversed. Split from one 884 KB file into a thin hub + spokes (F-8, 2026-06-15) so each
   stays connector-writable: `01_ACTIVE_WORKSTREAMS` / `02_UP_NEXT` / `03_OPEN_QUESTIONS_AND_BACKLOG` /
   `04_RECENTLY_COMPLETED`. Start at the hub; read the relevant spoke. STATE.md holds the *cursor*; the spokes hold the *detail*.
3. `docs/00_INDEX.md` — **the map** of every doc. Start here to locate anything.
4. Topic authorities: architecture -> `docs/architecture/`; phases -> `docs/blueprint/MASTER_BLUEPRINT.md`;
   compliance -> `docs/compliance/`; GTM -> `docs/marketing/` (+ `docs/marketing/gtm/`); design -> Stitch system
   (`docs/design/`); calc engines -> `lib/calculations/*` + `lib/services/masterFinancialService.ts`.

## C. RESUME CURSOR  (regenerated at every session END — the live "where we are")

> Re-pinned 2026-06-16 (Code) at HEAD `654bc55` = merge of #1124.
> **AI Document Router (workstream `0·DOC`) is the active line of work.** Three PRs merged & prod-verified this
> session: **#1122** (HALF_YEARLY frequency everywhere) · **#1123** (Doc Router Phase A — scan recognition fix +
> `ASSET` linkable type) · **#1124** (Doc Router Phase B — per-user storage quota). Spec: `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md`.

- **Current focus:** **AI Document Router — Phase B in progress.** Vision (Reza): every receipt → AI recognises →
  attaches to the correct item/asset OR creates a new expense → filed in the Vault for tax-time. Phase A ✅ shipped
  (the scan now identifies receipts via `/api/documents/analyze-for-form`; assets are linkable). Phase B has two
  tracks: **B-storage** (storage = GCS + per-user quota) and **B-intelligence** (attach-to-existing, not just create).
  Phase B slice 1 ✅ = the **per-user storage quota** (`lib/documents/storage/storageQuota.ts`, SSOT — drift-free,
  computed from `SUM(Document.size)`, default 2 GiB, backend-independent; enforced at the DME `processUpload`
  chokepoint + the legacy scan path; `/api/documents/upload` → 413 on breach).
- **Active task + stop-point:** doc-sync sweep (this PR) — STATE.md + 00_INDEX + MASTER_BLUEPRINT + infra doc brought
  current for Phase 50, per Reza's "keep all relevant docs updated as you go." No code in this PR.
- **Immediate next action:**
  (1) **GCS provisioning — REZA/operator only** (the GCS cut-over is blocked on this): create bucket
  `monitrax-documents` (`australia-southeast1`, uniform access, CMEK), grant the WIF-impersonated runtime SA
  `roles/storage.objectAdmin` (prefer ADC, no key file per §13.6), set `GCS_PROJECT_ID` + `GCS_BUCKET_NAME` in Vercel
  Production. The storage factory auto-switches once set; **likely also clears the residual `/api/documents/analyze` 500.**
  (2) **Next code slice (unblocked, no Stitch):** GCS-aware `/api/documents/download` (DB-only today — breaks once GCS is active).
  (3) **B-intelligence (needs Stitch per §18.2.1):** `ATTACH_TO_*` confirm actions + entity picker + scan-UI "attach vs create" branch.
- **Open decisions / blockers:**
  - **GCS provisioning — pending Reza** (blocks the GCS cut-over; the quota + DB fallback work today regardless).
  - **DECIDED 2026-06-16:** storage = GCS with per-user quota; household = shared finances incl. documents (if/when multi-user accounts exist). See PHASE_50 decisions log.
  - **E2E UAT gate — pending Reza** (E2E_ENABLED + secret). Not blocking anything.
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** Claude rec = Finsure first, Connective second (a rec, not a ruling).
- **Verified-live this session:** #1122/#1123/#1124 each built + merged; prod deploys reached READY on monitrax.com.au
  (iad1+syd1) — half-yearly live, scan-recognition fix live, storage quota enforcing in prod. main advanced to `654bc55`.

## D. THE SESSION RITUAL  (all surfaces; Code ALSO follows CLAUDE.md Parts 1/7/10)

**START (before any work):**
0. RESUME CHECK. List open + recently-merged PRs on `resadegh/monitrax` (GitHub connector). If a tracked PR
   (continuity / plan / workstream) merged since this cursor's HEAD, pull the new HEAD, read what changed, and
   continue from the updated next action. There is NO notification — this pull is how a session learns a PR merged.
1. Pull live HEAD. Run freshness gate (above).
2. Read this STATE.md -> then CLAUDE.md -> then the relevant `IMPLEMENTATION_PLAN.md` section for the active task.
3. Print a <=5-line orientation: what Monitrax is (1 line) - current task (1) - next action (1) - blockers (1) - HEAD (1).
4. Open a session ledger (verified-vs-unverified, pinned to HEAD).

**DURING (every response):**
- **Cite or stop.** No state claim without a this-session source (`file:line` / tool result / HEAD). Can't cite -> flag unverified + re-pull.
- **Re-pull, don't recall.** Uncertain = read it again. Recollection is the silently-wrong option.
- **One unit at a time.** Close + write the finding before opening the next. Never hold "the whole app" in context.
- **Standing compliance check.** Anything touching user-facing money language -> AFSL/CDR boundary check before it ships.

**END (before closing):**
1. Update the RESUME CURSOR (Section C) — new HEAD, what changed, exact stop-point, next action, blockers.
2. Update `IMPLEMENTATION_PLAN.md` + changelog in the SAME PR (CLAUDE.md Sections 15/16.5).
3. Leave the next action explicit enough that a cold session resumes in <1 min.

## E. HOW THIS STAYS TRUE  (integration + enforcement)

- **Owns:** current position (cursor) + the universal session ritual. **Defers to:** CLAUDE.md (law),
  IMPLEMENTATION_PLAN (detail), 00_INDEX (map), SYSTEM_MAP (what-owns-what). No content is duplicated from
  those here — only pointers + position.
- **Enforced by:** (a) `.claude/hooks/session-start.sh` prints this cursor + HEAD at the start of every Code session
  (skip-on-failure, never blocks the session); (b) `.github/workflows/continuity-gate.yml` fails a PR that changes
  workstream files without updating STATE.md + IMPLEMENTATION_PLAN in the same PR (soft-launch first, then required;
  workflow scope GRANTED 2026-06-15 — arming is a repo-admin step); (c) chat/Cowork: read-STATE-first is the hard first instruction (project instructions Section 0).
- **Update cadence:** cursor every session end; Section A/Section B only on a real change, via PR, never ad hoc.

# NeoAudit Orchestration — Claude Chat as the audit conductor

> **Status: CANONICAL operating manual for the automated NeoAudit relay.**
> Law: `CLAUDE.md` Part 23 (four rings) + Part 24 (fix pipeline). Platform: `docs/blueprint/NEOAUDIT.md`.
> Manual procedure this automates: `docs/verification/VERIFICATION_PLAYBOOK.md` §3 (the relay protocol).
> When this doc and CLAUDE.md disagree, CLAUDE.md wins.
>
> **Why this exists (Reza directive 2026-07-14):** *"I want NeoAudit's full process documented and published so I can give it to Claude Chat, and it can orchestrate between Claude Code and Claude Chrome and automate the audit testing — so I don't need to copy and paste the briefs and results."* Until now Reza was the relay (playbook §3.2): paste the brief into Claude-in-Chrome, paste the report back to Claude Code. This document makes **Claude Chat the conductor** so the ferrying is automated and Reza's role shrinks to approvals and final review.

---

## 1. The three agents and their sole responsibilities

| Agent | Role | What it alone does | What it must NEVER do |
|---|---|---|---|
| **Claude Chat** (you, if this doc was pasted to you) | **Conductor** | Routes messages VERBATIM between Code and Chrome; tracks run state; escalates forks to Reza | Author or edit a brief; summarise/truncate a brief or a machine report; answer a financial/fork question itself; let Chrome write |
| **Claude Code** (a session on the `monitrax` repo) | **Brain** | Emits the canonical brief (playbook §3.3, verbatim from the repo); runs Phase-2 analysis (§3.5); files/updates `MON-###` issues; builds fixes; requests targeted re-checks; owns baselines + run records | Rely on Chat's summary instead of the raw JSON |
| **Claude for Chrome** (in Reza's logged-in browser) | **Eyes** | Executes the brief READ-ONLY on Reza's real data; returns the HUMAN SUMMARY + the fenced MACHINE REPORT JSON | Add/edit/save/delete anything (except an `[ACTION]` step Reza explicitly approves in the moment); guess a number ("not found", never invented) |

**The SSOT rule that shapes everything (CLAUDE.md §12.2.1 / §23.2.4):** the brief lives in exactly ONE place — `docs/verification/VERIFICATION_PLAYBOOK.md` §3.3 in the repo. Claude Chat never stores, caches, edits, or "improves" a brief; it always obtains the current one from Claude Code at run start and relays it verbatim. Brief improvements happen only as repo PRs (the living-brief growth loop, NEOAUDIT.md §10 step 5).

## 2. Non-negotiable rules for the conductor

1. **Verbatim ferrying.** The brief travels Code → Chrome unmodified (code-fenced, complete). The machine report travels Chrome → Code unmodified (the complete fenced JSON plus the human summary). If a message is too long, split it into sequential parts labelled `part i/N` — never summarise.
2. **Read-only enforcement.** Remind Chrome at hand-off: read-only; `[ACTION]`-labelled steps require Reza's explicit in-the-moment approval; deny writes otherwise.
3. **Completeness gate.** A Chrome report whose `coverage` object has any `false` or a non-empty `skipped` is an INCOMPLETE run — relay it to Code anyway (Code decides whether to accept, re-run a section, or record the gap), and flag the incompleteness explicitly.
4. **Forks go to Reza.** If Code surfaces a decision fork (basis choice, product semantics, destructive write, anything §20.5), present it to Reza with Code's recommendation and WAIT. The conductor never decides.
5. **No third parties, no data leakage.** Real financial numbers flow only between these three agents and Reza. Never to any other tool, search, or service (NEOAUDIT.md §9(d)).
6. **State tracking.** Keep a compact run ledger in the conversation: run ID (`VR-NNN`, assigned by Code), phase, briefs issued, reports returned, re-checks pending, forks awaiting Reza. Restate it briefly at each step so Reza can glance at progress.
7. **Termination.** A run ends only when Code declares it closed (run file stored, issues filed/advanced, baseline decision made) — or Reza stops it. Then report Code's closing summary to Reza verbatim.

## 3. Loop A — the full audit run (the comprehensive sweep)

```
Reza          Claude Chat (conductor)         Claude Code (brain)          Claude Chrome (eyes)
 │  "run an audit"  │                              │                            │
 │─────────────────>│  1. request brief            │                            │
 │                  │─────────────────────────────>│ emits §3.3 brief verbatim  │
 │                  │  2. brief (verbatim)         │ + assigns VR-NNN           │
 │                  │──────────────────────────────────────────────────────────>│
 │                  │                              │        executes read-only  │
 │                  │  3. report (summary + JSON)  │                            │
 │                  │<──────────────────────────────────────────────────────────│
 │                  │  4. report (verbatim)        │                            │
 │                  │─────────────────────────────>│ Phase-2 analysis (§3.5):   │
 │                  │                              │ PASS/FAIL, MON-### filed,  │
 │                  │  5. verdicts + fix plan      │ baseline diff, fixes queued│
 │  6. review +     │<─────────────────────────────│                            │
 │  approve forks   │         (loop B per fix, then targeted re-checks)         │
```

**Step 1 — kickoff.** Reza tells Chat to run an audit. Chat messages the Claude Code session:

> *"NeoAudit orchestrated run: please emit the canonical Ring-3 run brief (VERIFICATION_PLAYBOOK.md §3.3, verbatim, complete) and assign the next VR-NNN run ID. I will relay it unmodified to Claude-in-Chrome on Reza's logged-in session and return the machine report verbatim."*

**Step 2 — brief hand-off to Chrome.** Chat passes the brief to the Chrome agent, prefixed only with:

> *"Execute this verification brief on the currently logged-in Monitrax session. READ-ONLY — do not add, edit, save, or delete anything; any step labelled [ACTION] requires Reza's explicit approval first. Produce BOTH outputs the brief specifies, the machine report as one complete fenced JSON block."*

**Step 3–4 — report return.** Chat relays Chrome's complete output back to the Code session verbatim (split into parts if long, never summarised), noting any coverage gaps per rule 3.

**Step 5 — Phase 2.** Code compares (playbook §3.5), stores `docs/verification/runs/VR-NNN.md`, diffs `partF` against `baselines/BASELINE.md`, files/advances `MON-###` issues, and replies with: the PASS/FAIL table, new/advanced issues, fixes it will build (each per FIX_PROTOCOL, its own PR), any forks for Reza, and which targeted re-checks it will need.

**Step 6 — Reza's touchpoints.** Chat presents Code's verdicts, relays fork questions, and (when fixes are merged) runs Loop B. Reza's remaining jobs: approve forks, merge/approve PRs as usual, and glance at the ledger.

## 4. Loop B — the per-fix targeted re-check (FIX_PROTOCOL §4)

After a fix PR merges, the issue may move FIXING → VERIFIED **only** on a real-data re-check of its exact numbers (CLAUDE.md §23.2.3 — CI green is never verification).

1. Chat asks Code: *"Emit the targeted per-fix Chrome brief for MON-### (FIX_PROTOCOL §4 template) for the merged fix — include the exact numbers expected and the regression-guard surfaces."*
2. Code emits a SHORT targeted brief (symptom-gone checks + named guard surfaces). Chat relays it to Chrome with the same read-only preface.
3. Chrome returns the targeted capture; Chat relays verbatim to Code.
4. Code declares **PASS** (symptom gone + guards undisturbed → VERIFIED, promotion queued) or **FAIL** (stays FIXING → Stage-4 retro → re-diagnosis; a new fix cycle begins).
5. Chat updates the ledger and tells Reza the outcome in one line per issue.

Multiple targeted re-checks may be batched into one Chrome pass when Code says they're independent — Code decides the batching, not Chat.

## 5. Failure & edge handling

| Situation | Conductor's action |
|---|---|
| Chrome can't find a surface/number | Relay the "not found" verbatim; Code decides (data gap vs defect vs brief error) |
| Chrome output missing the fenced JSON | Ask Chrome once to re-emit the machine report as a single fenced JSON block; if still missing, relay what exists + flag it |
| Code session context is fresh/new | Point it here: *"Read docs/verification/NEOAUDIT_ORCHESTRATION.md + VERIFICATION_PLAYBOOK.md §3, then resume run VR-NNN at step X"* — every rule it needs is in the repo |
| A brief seems outdated/wrong to Chat | Relay it anyway VERBATIM and tell Code the concern — brief edits happen only via repo PR (growth loop step 5), never in flight |
| Reza is away and a fork blocks | Park that thread, continue non-blocked work, restate the pending fork in the ledger |
| Anything asks Chrome to write | Refuse unless it is an `[ACTION]` step AND Reza approves in the moment |

## 6. The kickoff message (Reza: paste this doc + the lines below into Claude Chat)

> **You are the NeoAudit conductor.** Operate exactly per the attached `NEOAUDIT_ORCHESTRATION.md`. Your agents: a Claude Code session on the `monitrax` repo (the brain) and Claude-in-Chrome on my logged-in Monitrax session (the eyes). Start Loop A now: request the canonical brief + a VR-NNN from Claude Code, relay it verbatim to Chrome, return the report verbatim to Code, present me the verdicts, then drive Loop B re-checks for merged fixes until Code closes the run. Ferry verbatim, keep the run ledger visible, escalate every fork to me, never let Chrome write.

## 7. What this changes — and what it doesn't

- **Changes:** Reza's manual copy-paste relay (playbook §3.2 steps 1–2, NEOAUDIT.md §0 "Tool" layer) is now performed by Claude Chat. Reza's role shrinks to: approve forks, merge PRs, review outcomes.
- **Does NOT change:** the brief's single home (§3.3), Phase-2 ownership (Code), the fix pipeline (Part 24), VERIFIED-requires-Ring-3 (§23.2.3), read-only discipline, or the growth loop (§10) — every Chrome finding still ratchets into permanent lower-ring tests and brief-class broadenings via repo PRs.
- **Failure mode this was designed against:** a conductor that "helpfully" summarises. A summarised brief loses checks; a summarised report loses evidence. Verbatim or split-into-parts — never compressed.

*Created 2026-07-14 (Reza directive). Maintained alongside the playbook; update via PR in the same change that alters the relay protocol.*

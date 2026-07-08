<!-- INSTALL: copy or symlink this file to ~/.claude/CLAUDE.md on every machine.
     Claude Code loads it globally; any repo's own CLAUDE.md overrides it on conflict.
     Canonical home is this path until a dedicated resadegh/claude-config repo exists.
     Raw URL (after merge): https://raw.githubusercontent.com/resadegh/monitrax/main/.claude/CLAUDE_GLOBAL.md -->

# CLAUDE.md — Global Working Protocol (all projects)

> Lives at `~/.claude/CLAUDE.md`. Applies to every project. A repo's own `CLAUDE.md`
> is law for that repo and **wins on any conflict** — this file only fills the gaps.
> Three tiers of emphasis are used here: **LAW** (never break), RULE (break only with
> explicit user approval), guidance (default, use judgement).

---

## 1. SESSION BOOT

1. **Read the repo's continuity anchor first** — `STATE.md` at repo root if it exists,
   else `CLAUDE.md`, else `README.md`. If none exist, say so and propose creating `STATE.md`.
2. **Pin HEAD.** State the commit SHA and date you read. That is ground truth for the
   session. If HEAD moves mid-session, re-verify before acting — never assume.
3. **Orient in ≤5 lines** before substantive work: what the project is · current task +
   stop-point · next action · open blockers · HEAD.
4. If the plan/state file is stale relative to HEAD, flag it and reconcile before working.

## 2. GROUND TRUTH — **LAW**

- **Cite or flag.** No claim about the project ships without a this-session source
  (`file:line`, tool result, or HEAD). Can't cite it → label UNVERIFIED and go read it.
- **Re-pull, don't recall.** Memory, caches, and prior-session summaries are never ground
  truth — only the live repo/system is. Uncertain = read it again.
- **Never guess.** Before changing anything: read the affected files, the schema/contract
  they implement, and recent history. A gap in documentation is a signal to fetch or ask —
  never to invent.
- **One unit at a time.** Close and record a finding before opening the next.

## 3. SSOT & SINGLE ENGINE — **LAW**

- One authoritative source per topic. Never duplicate content across files, docs, or
  configs — cross-reference the canonical source instead.
- **Search first.** Before creating any function, constant, doc, or config: search for an
  existing implementation. Extend the canonical one; never create a competitor.
- Domain-critical computations live in one engine. Never re-derive, approximate, or
  hand-calculate a number the engine produces — anywhere, including copy and docs.
- If two sources conflict, stop, identify the canonical one, fix the drift in the same
  change. Don't paper over it.

## 4. CHANGE MANAGEMENT

- RULE: every change to a shared branch goes through a PR/branch — no direct commits to main.
- Small, reversible changes over big-bang rewrites. Know the rollback path before merging.
- Commit messages: `type(scope): what and why`. The why matters more than the what.
- RULE: documentation updates ship **in the same PR** as the change they describe —
  plan/status files, changelogs, and any doc whose content the change invalidates.
  Knowledge compounds in the repo, never only in the conversation.
- Destructive writes (deletes, migrations dropping data, irreversible ops) require an
  explicit answer to three questions in the PR body: what is destroyed · why it's safe ·
  how to roll back.

## 5. RESEARCH BEFORE ACTION

Before every change: read the entry points and contracts you'll touch; check recent
changelog/history for the area; verify the current behaviour (run it, don't assume it);
write a short build plan for anything non-trivial. Re-attempting a previously reverted
approach without acknowledging the reversal is the most expensive failure mode — check
the plan/decision log first.

## 6. SELF-REVIEW GATE

- Start every task by scoring your understanding of the requirement. If you can state the
  requirement, constraints, and acceptance criteria at 10/10 confidence → proceed
  autonomously through build + verification and present the result. Below that → stop and
  surface the specific gap or blocker; don't build on a guess.
- Before sign-off on substantive work: review the output at least twice against the
  requirement and the applicable rules. Never present intermediate quality as final.
- A fix is not done until every downstream surface it affects is verified — trace the
  full flow, not just the changed file.

## 7. QUALITY DEFAULTS

- Clean over clever. Zero tolerance for dead code, commented-out blocks, and speculative
  abstractions.
- Prefer platform/managed services over custom code when both solve the problem.
- Secure by design: no secrets in code or logs; least privilege; validate at boundaries.
- Elegance and restraint over richness and density — in code, docs, and design alike.
- Push back plainly when a request conflicts with these principles or with the user's
  stated goals; flag consequences once, then execute the user's call.

## 8. EXTERNAL ACTIONS — **LAW**

Anything that leaves the machine — sending email/messages, publishing, posting, spending
money, activating automations, deleting data, granting access — requires the user's
explicit confirmation first, every time. Drafting, reading, auditing, and opening PRs do not.

## 9. SESSION END

1. Update the repo's state/cursor file: new HEAD, what changed, exact stop-point, next
   action, blockers.
2. Update the plan/status doc and changelog **in the same PR**.
3. Leave the next action explicit enough that a cold session resumes in under a minute.

---

*If a project needs more than this, it gets its own `CLAUDE.md` — this file never grows
project-specific content.*

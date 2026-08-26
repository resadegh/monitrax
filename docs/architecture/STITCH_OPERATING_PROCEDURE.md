# STITCH — THE OPERATING PROCEDURE (how UI design actually gets made in Monitrax)

**Status:** 🟢 CANONICAL · **Raised:** 2026-08-26 by Matrix HQ, at Reza's direction: *"whatever decision you make should be in claude.md as a critical ways of working and the design standard document to reflect the same. I don't want to keep repeating myself as I have been doing for the last 9 months."*

**Why this file exists.** The Stitch *rules* were already written (CLAUDE.md §18.1–§18.8). What was never written down is the **mechanics** — how a session actually drives the tool, what a timeout means, and where screen IDs live. That gap cost a full working day: on 2026-08-25 a Matrix session hit the expected 60s timeout, concluded *"Stitch tooling is BLOCKED"*, and propagated that false claim into three committed documents. This file is the SSOT for the method so no session repeats it.

**Binding rule lives in CLAUDE.md §18.3.1** (carry text in §6 below). **Design vocabulary** stays CLAUDE.md §18.7.2. **This file owns the mechanics only** — one fact, one home.

---

## 1. THE CORRECTION — what 2026-08-25 got wrong, on the record

| Claim made 2026-08-25 | Verified 2026-08-26 | Verdict |
|---|---|---|
| "`generate_screen_from_text` times out at 60s → the tooling is broken" | The tool's **own documentation** says: *"This action can take a few minutes to complete. Please be patient. DO NOT RETRY. If the tool fails with a timeout, don't retry. Instead, try to get the screen with `get_screen` every 30 seconds."* | ❌ **WRONG.** The timeout is documented, expected behaviour. It is not a failure and never was. |
| "`list_screens` returns EMPTY → the project is broken/empty" | `get_screen` on a known in-app screen ID returns full `htmlCode` + `screenshot` download URLs. The project is **fully alive**. | ❌ **WRONG.** Only the *listing* is unavailable for this project. |
| "No Stitch project covers the kept v1 surfaces" | True as stated, but irrelevant to the conclusion drawn — the in-app project accepts new screens for **any** in-app surface. Its title says "Superannuation" because that was the first screen, not because it is scoped to it. | ⚠️ **MISLEADING.** Corrected. |
| "G7/G2 cannot start" | A vault-page screen was generated into the in-app project on 2026-08-26 at 04:13:03Z (`updateTime` confirms the write). | ❌ **WRONG.** Generation works. |

**The one real constraint** (see §4): a screen generated from a Cowork session whose MCP ceiling is 60s cannot have its **new ID** discovered from inside that session, because `list_screens` does not enumerate this project. The screen exists; the pointer to it does not come back. That is a narrow, recoverable gap — not a broken tool.

**The lesson, generalised:** a tool that says *"this takes minutes, do not retry"* is not broken when it takes minutes. Read the tool's own contract before declaring a blocker, and re-test a recorded blocker before repeating it — §0's "read live, never recall" applies to tooling state, not just to Monitrax state.

---

## 2. THE VERIFIED MECHANISM — how the design pipeline really works

```
  generate_screen_from_text ─┐
  (or edit_screens on a      │   Stitch renders server-side (minutes)
   known screen ID)          │   ↓
                             └─→ SCREEN EXISTS in the project
                                 ↓
   get_screen(projectId, screenId) ──→ { htmlCode.downloadUrl, screenshot.downloadUrl }
                                 ↓
   HTML + PNG committed to  .stitch/designs/<name>.{html,png}
                                 ↓
   ID + metadata recorded in  .stitch/metadata.<project>.json   ← THE REGISTRY OF RECORD
                                 ↓
   🧑 Reza previews the PNG  →  nod
                                 ↓
   🟦 Code ports to React, screen ID in the component's JSDoc
```

**`.stitch/metadata.<project>.json` is the SSOT for screen IDs — never `list_screens`.** This is precisely why the file exists and why the workflow survived nine months of `list_screens` being useless on the in-app project. Each entry carries `id`, `deviceType`, `title`, `generatedAt`, `artifacts`, `reactPort`, and a `scope` note. Verified live 2026-08-26: `get_screen` on `1c01d0c1e990458899afbf2f68d5a615` (recorded in that file on 2026-06-01) still returns the live HTML and PNG.

**Projects (read live 2026-08-26):**

| Project ID | Title | `list_screens` | Use for |
|---|---|---|---|
| `5991501424852019479` | Monitrax — In-App My Wealth | ❌ returns `{}` | **ALL `/dashboard/*` in-app surfaces.** Registry: `.stitch/metadata.inapp-wealth.json` |
| `1859462351962811110` | Monitrax — Public Website Redesign | ✅ 82 screens | Public marketing site only |
| `4167588157712714472` | Monitrax Mobile | — | Mobile app |
| `6907302336968095589` | iRoom Design & Drafting | — | Unrelated — never touch |

The in-app project's **title** says Superannuation because that was its first screen. It is **not scoped** to super — every in-app surface belongs in it, under the §18.7.2 glass vocabulary.

---

## 3. THE PROCEDURE — follow exactly

1. **Never design UI in code.** §18.2.1 STRICT: every in-app section-level composition goes through Stitch first. This includes *repositioning* an existing section — layout order is composition.
2. **Seed the prompt with §18.7.2** — the My Wealth glass vocabulary, verbatim in substance: navy `#050913` ground, `#0E1424/70` glass + backdrop-blur, 28/22/12/14px radii, Inter + `tabular-nums`, emerald `#22C55E` for positive only, gradient icon badges, 3px top-accent strips. A prompt that omits the vocabulary produces off-brand output and wastes a generation.
3. **State the scope fence (D-22).** If the screen records or repairs something that already ships, say so in the prompt: *"reproduces an EXISTING shipped screen with ONE composition change — do not invent new features, tiles, or data."* Any delta the render suggests is a **finding for Reza**, never work Code starts on its own.
4. **Call the tool once. It will take minutes and may time out. THIS IS NORMAL. NEVER RETRY** — a retry produces a duplicate screen and doubles the wait.
5. **Recover the screen, do not regenerate it:**
   - Known ID → `get_screen` immediately, then every ~30s, up to 10 times.
   - New screen in an **enumerating** project → `list_screens`.
   - New screen in the **in-app** project → see §4. Do not conclude the generation failed.
6. **Both modes, both devices.** §18.7.2 requires a light AND a dark variant per device. The app ships dark; dark is not optional.
7. **Self-review to ≥9/10 (§18.8) BEFORE Reza sees it.** A design you could not retrieve has **not** been reviewed and must not be presented as approved — say so plainly instead.
8. **Commit the artefacts** to `.stitch/designs/`, **record the ID** in `.stitch/metadata.<project>.json` in the same PR.
9. **Reza previews the PNG and nods.** Only then does Code port to React, with the screen ID in the component JSDoc (§18.4 step 2).

---

## 4. THE ONE REAL GAP — new-screen ID discovery in the in-app project

**Symptom.** Generation into `5991501424852019479` succeeds (confirmed by `updateTime` moving), but the session cannot learn the new screen's ID: the 60s MCP ceiling cuts the response, and `list_screens` returns `{}` for this project.

**This does NOT block design work.** It blocks one step: *automatically* learning the ID of a screen you just created.

**Three recoveries, in order of preference:**

- **(a) `edit_screens` on a known ID instead of generating a new screen.** The ID is preserved and already in the registry, so nothing has to be discovered. **This is the preferred route for any surface already in the registry** and should become the default.
- **(b) Reza reads the ID once from the Stitch UI** (he can already see previews there) and it is recorded in `.stitch/metadata.inapp-wealth.json`. One-time cost per NEW surface; permanent thereafter.
- **(c) 🟦 Code runs the generation.** Code sessions have different tool-timeout characteristics and have historically received the screen back directly — which is exactly how the last nine months of tiles were designed.

**Standing recommendation (needs Reza's ruling):** make **(c)** the default for NEW surfaces and **(a)** the default for existing ones. Matrix keeps prompt authorship, the §18.7.2 seeding and the §18.8 review; Code executes the generation call. That splits the work along each session's actual capability instead of pretending the Cowork session can do everything.

---

## 5. WHAT A HONEST BLOCKER REPORT LOOKS LIKE

Before recording *any* tooling blocker — Stitch or otherwise:

1. **Read the tool's own description.** Timeouts, retry guidance and async behaviour are usually documented. The 2026-08-25 failure was entirely avoidable at this step.
2. **Re-test, never recall.** A blocker written yesterday is a claim, not a fact. §0's read-live rule covers tooling.
3. **Separate "the tool failed" from "I could not read the result."** They have different fixes and only one is a blocker.
4. **State the narrowest true version.** "New-screen IDs are not discoverable in this project from a 60s-ceiling session" is actionable. "Stitch is blocked" stopped a day of work and was false.

---

## 6. CARRY TEXT — for 🟦 Code to insert into CLAUDE.md as §18.3.1

> `CLAUDE.md` is 238 KB and exceeds the Cowork GitHub connector's safe carry size (the P0.1 / M1.3 precedent — same reason STATE.md is carried by Code). Matrix authors the text; **Code lands it verbatim** in the next PR, directly after §18.3 "The Stitch toolset".

```markdown
#### 18.3.1 Stitch mechanics — timeouts, IDs and the registry (CRITICAL, ALWAYS FOLLOW)

> **Reza directive 2026-08-26:** *"I want stitch to be the UI designer as it is much nicer than code
> designs … whatever decision you make should be in claude.md as a critical ways of working and the
> design standard document to reflect the same. I don't want to keep repeating myself."*
> Raised after a Matrix session mistook a documented timeout for a broken tool and recorded
> "Stitch is BLOCKED" into three documents, stalling UI work for a day.

**Full mechanics: `docs/architecture/STITCH_OPERATING_PROCEDURE.md`.** The binding rules:

1. **Stitch is THE UI designer.** No in-app UI is designed in code — including repositioning an
   existing section, which is a composition change (§18.2.1 STRICT).
2. **A generation taking minutes, or timing out, is EXPECTED — never a blocker.** The tool's own
   contract says so. **NEVER RETRY a generation**; retrying duplicates the screen. Recover with
   `get_screen` (poll ~30s, up to 10×).
3. **`.stitch/metadata.<project>.json` is the SSOT for screen IDs — never `list_screens`,** which
   does not enumerate the in-app project `5991501424852019479`. Every generated screen is recorded
   there with its id, deviceType, title, artifacts path and reactPort, in the same PR as its
   artefacts under `.stitch/designs/`.
4. **The in-app project is `5991501424852019479` for EVERY `/dashboard/*` surface.** Its title names
   Superannuation only because that was its first screen; it is not scoped to it.
5. **Prefer `edit_screens` on a registered ID over generating a new screen** — the ID is already
   known, so nothing has to be discovered.
6. **Before recording any tooling blocker: read the tool's own description, then re-test it.**
   §0's "read live, never recall" governs tooling state, not just Monitrax state. Distinguish
   "the tool failed" from "I could not read the result" — only one is a blocker, and state the
   narrowest true version of it.

**Reviewer enforcement.** Reject any PR that ships in-app UI without a Stitch screen ID in the
component JSDoc and a matching entry in `.stitch/metadata.<project>.json`; and reject any blocker
claim about Stitch that does not cite a re-test on the day it was recorded.
```

---

## 7. Change log

- **2026-08-26** — Raised. Corrects the false 2026-08-25 blocker; records the verified mechanism, the registry-as-SSOT rule, the real ID-discovery gap and its three recoveries, and the CLAUDE.md §18.3.1 carry text. Verified live this day: `get_screen` returns HTML+PNG for a 2026-06-01 registry ID; `list_screens` returns 82 screens for the public project and `{}` for the in-app one; a vault-page generation landed at 04:13:03Z.

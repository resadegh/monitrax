---
title: ASIC RG 244 / RG 36 boundary statement
audience: compliance
slug: asic-rg244-rg36-boundary-statement
category: AFSL & Advice Boundary
lastReviewed: 2026-05-04
complianceClass: afsl
order: 5
summary: How Monitrax stays on the general-information side of ASIC RG 244 and RG 36 — and why the single-voice AI plus Ask-a-Professional architecture is the load-bearing reason it does.
tags: [asic, rg244, rg36, afsl, general-advice, personal-advice]
---

# ASIC RG 244 / RG 36 — Advice Boundary Statement

This document is for AFSL holders, AFSL compliance officers, ASIC reviewers, and the in-house legal team at any organisation evaluating Monitrax. It states explicitly where Monitrax sits on the general-information / personal-advice spectrum under Australian financial services law, and why the platform's architecture makes that boundary load-bearing rather than aspirational.

The reference frameworks are:

- **Corporations Act 2001** — particularly §766B (definition of *financial product advice*) and §911A (requirement to hold an AFSL to provide financial product advice)
- **ASIC RG 244** — *Giving information, general advice and scaled advice* — the regulator's guidance on the boundary between information, general advice, and personal advice
- **ASIC RG 36** — *Licensing: Financial product advice and dealing* — the operational guidance for AFSL holders, including record-keeping (§36.81)
- **ASIC RG 175** — *Licensing: Financial product advisers — Conduct and disclosure* — for personal advice obligations (best-interests duty, statement of advice)
- **ASIC INFO 269** — *Algorithmic trading, AI, and electronic services* — the regulator's contemporary guidance on AI in financial services

This article and the canonical product-positioning sources stay in sync per CLAUDE.md §16.3.

## The position in one sentence

**Monitrax provides general information and general advice only. Monitrax does not provide personal advice. Where a user requires personal advice, Monitrax routes them — through the Ask-a-Professional surface — to a human AFSL holder who provides personal advice under their own licence and their own obligations.**

This is a structural commitment, not a disclaimer. The architecture below makes it impossible for the platform itself to drift into personal advice territory.

## What Australian law says about the boundary

Under §766B of the Corporations Act, *financial product advice* is a recommendation or statement of opinion intended to influence a person's decision about a financial product. There are two sub-categories:

| Category | Definition (§766B) | Licence required | Obligations |
|---|---|---|---|
| **General advice** | Advice not tailored to the client's personal objectives, financial situation, or needs | AFSL with general advice authorisation | General advice warning (§949A) |
| **Personal advice** | Advice that has considered, or a reasonable person would expect has considered, the client's objectives, financial situation, or needs | AFSL with personal advice authorisation | Best-interests duty (§961B), Statement of Advice (§946A), record-keeping (§912F, §946F) |

ASIC RG 244 §244.10 frames the practical question: *would a reasonable person believe the provider has considered the client's objectives, financial situation, or needs?* If yes, it's personal advice. If no, it's general advice or information.

The architectural challenge for any AI-driven platform is that AI naturally personalises. An LLM that "knows" a user's full position can drift into personal advice territory simply by being helpful. RG 244 §244.118 and ASIC INFO 269 explicitly warn against this. The architecture below is Monitrax's answer.

## The single-voice AI architecture

Monitrax's AI advisor — branded internally as the **Guide** and surfaced at `/dashboard/cfo` — is a *single* AI voice that operates under three structural constraints. These are not disclaimers; they are enforced at the platform layer.

### Constraint 1 — General-information output only, by prompt construction

The AI's system prompt explicitly forbids personal-advice output. It is instructed to:

- State principles, frameworks, and rules of general application (Barefoot Investor's plant/grow/harvest, the 50/30/20 rule, Div 115 CGT 50% discount, the concessional super contribution cap)
- Surface the user's current numbers and how they relate to those principles (*"your savings rate is 7%, the Barefoot recommendation for your TRAIL stage is 20%"*)
- **Never** make a product recommendation (*"you should buy this fund"*, *"you should refinance with this lender"*, *"you should set up a trust"*)
- **Never** state that a course of action is right *for the user specifically*, only that it is consistent with a general principle

When the user asks for a product recommendation, the AI is instructed to redirect them to the Ask-a-Professional surface. The redirect is automatic, deterministic, and the same response every time. Phase 41h (queued) extends this by feeding entity-aware context to the AI while keeping the same boundary — *"your trust holds property X with $300k unrealised CGT — Div 115 50% discount applies after 12 months"* is general information; *"you should transfer this property out of the trust"* would be personal advice and is structurally blocked.

### Constraint 2 — Single voice, no parallel conversations

There is exactly one AI advisor surface per user. It does not branch into multiple agents, multiple personas, or multiple parallel conversations. This is deliberate: a multi-agent system can produce inconsistent outputs across agents that sum to personal advice even when no single agent provides it. A single voice cannot.

The AI conversation is also stateless across high-stakes interventions — the AI does not remember a prior session's recommendation in a way that could be reconstructed as advice given over time. Ongoing personalised guidance over time is a hallmark of personal advice (RG 244 §244.36) and is structurally avoided.

### Constraint 3 — Ask-a-Professional is the relief valve

Every personal-advice question routes to a human via the **Ask-a-Professional** surface. The user picks a professional from the marketplace (or is auto-routed to their existing professional if they have one), composes a question, and the professional accepts the engagement. From that moment:

- The professional is the AFSL holder — they engage under their own licence, their own best-interests duty (§961B), their own SOA obligation (§946A), and their own record-keeping obligation (§912F)
- Monitrax provides the venue (chat thread, document exchange, conversation archive) but does not author advice
- Monitrax retains the conversation transcript for **7 years** (§912F record-keeping) on behalf of the AFSL holder; access is gated to the professional's compliance team via `withPermission('compliance.read')`

This is the same architectural pattern used by Xero (provides the bookkeeping platform but does not provide tax advice — that is the user's accountant's role), Property Vault (provides the data platform but does not give property recommendations — that is the buyer's agent's role). Monitrax sits in the same shape.

## Why the architecture is the argument, not the disclaimer

Many AI-driven fintech platforms address the personal-advice boundary with disclaimers — a banner that says *"this is general advice only, consult a financial professional"*. ASIC RG 244 §244.118 is explicit that **a disclaimer is not sufficient** if the substance of the advice is personal. The reasonable-person test applies to the actual interaction, not the fine print.

Monitrax's position is structural:

| Architectural feature | Why it forces general-information output |
|---|---|
| Single AI voice with general-information-only system prompt | The platform cannot drift into personal advice via prompt — the prompt forbids it |
| Automatic redirect to Ask-a-Pro on product-recommendation queries | The user gets routed to a human AFSL holder before the AI can produce personal advice |
| No multi-agent / no persistent recommendation memory | The platform cannot accumulate into personal advice across sessions |
| Ask-a-Pro architecture explicitly engages a separate AFSL holder | The personal-advice obligations sit with the human professional, under their own licence |
| Conversation transcripts retained 7 years for the AFSL holder | The professional's record-keeping obligation (§912F) is supported, not transferred |

The disclaimer is still present — every AI response includes a general-advice warning per §949A — but it is the floor, not the ceiling. The architecture is the ceiling.

## What this means for an AFSL holder using Monitrax

If you hold an AFSL and are evaluating Monitrax for your practice, the boundary is:

| You (the AFSL holder) | Monitrax (the platform) |
|---|---|
| Provide personal advice to your clients | Provides general information and general advice to consumers |
| Hold the §961B best-interests duty | Does not provide personal advice; no best-interests duty applies to the platform |
| Author and deliver Statements of Advice (§946A) | Provides the venue for SOA delivery (document upload + signed-URL share); does not author |
| Retain records 7 years (§912F) | Retains conversation transcripts 7 years on your behalf; you control access via your team's `compliance.read` permission |
| Engage under your AFSL | Operates under its own AFS Representative authorisation (currently in process; AR status is held by Renew Group Holding Pty Ltd) |
| Take responsibility for the personal advice you give | Takes responsibility for the platform; does not take responsibility for your advice |

The Ask-a-Professional surface is where these two columns meet. When a consumer asks a personal-advice question, they are routed to you. From that moment, your AFSL — and your compliance obligations — apply. Monitrax provides the venue and the records; you provide the advice.

## The AI advisor and AFSL — operational detail

The Guide (`/dashboard/cfo`) is general advice under RG 244. Its scope:

- TRAIL framework explanation (general financial-journey framework, not personalised)
- Numbers from the user's own data, framed against published principles (Barefoot Investor, government guidance, ATO published rates)
- Identification of *what is* in the user's data (your savings rate is 7%, your debt-to-income is 4.2x, your emergency fund is 0.8 months) — descriptive, not prescriptive
- Pointers to Ask-a-Professional when the next question requires personal advice

The Guide will not:

- Recommend buying or selling a specific financial product
- Recommend a specific structural change (transfer to a trust, set up an SMSF, refinance with a specific lender)
- Make a tax-position assertion that requires personal circumstances assessment (this is TPB territory; routed to a TPB-registered tax professional via Ask-a-Pro)
- State that a course of action *is* in the user's interests — only that it *is consistent with* a general principle

## ASIC INFO 269 — algorithmic and AI considerations

ASIC INFO 269 (April 2024) sets the contemporary expectation for AI in financial services: explainability, robustness, governance, and a clear line between automated tools and licensed advice. Monitrax's posture against each pillar:

| INFO 269 pillar | Monitrax response |
|---|---|
| Explainability | Every AI response includes its reasoning chain — the user can see what data the AI looked at and why it concluded what it did |
| Robustness | The single-voice architecture + general-information-only prompt + deterministic redirect to Ask-a-Pro reduces failure modes to a single audited surface |
| Governance | AI prompt is version-controlled; prompt changes go through the standard PR process (CLAUDE.md Part 4); changes that affect the boundary are reviewed against this article |
| Boundary clarity | This document, surfaced in the Help Center, sets the boundary for users, regulators, and AFSL partners |

## What an auditor can independently verify

If you are reviewing Monitrax for an organisation considering adoption, you can independently verify this boundary statement by:

1. **Reading the AI system prompt** — request a redacted copy from your Monitrax account manager (the prompt itself is treated as a trade secret; the boundary clauses are extractable for compliance review)
2. **Walking the Ask-a-Professional flow** — request a sandboxed walkthrough showing the automatic redirect on a product-recommendation query
3. **Inspecting the AI conversation log retention** — `ProfessionalConversation` + `ConversationMessage` tables, retained 7 years per §912F
4. **Reading the canonical product-positioning docs** — particularly `docs/blueprint/MASTER_BLUEPRINT.md` and `docs/blueprint/TRAIL_FRAMEWORK.md`
5. **Inspecting the §949A general-advice warning** — present on every AI response surface

The Phase 41h work (entity-aware AI) is queued and will extend the AI's general-information output to include entity-structure awareness; the boundary stays exactly where this article sets it.

## Open hardening items

Items in the regulatory-readiness backlog that strengthen the boundary without changing the position:

- **AFS Representative authorisation finalisation** for Renew Group Holding Pty Ltd (in progress)
- **Real ASIC / TPB API automated cross-check** for marketplace professionals (currently manual verification at onboarding; queued for PROD)
- **Adviser certification program** — 8 modules including TRAIL framework, AFSL boundary, alert stream, Ask-a-Pro lifecycle, conversation comms, ROA-SOA prep, Practice analytics, and edge cases (Phase 33e)
- **Annual independent advice-line audit** (commissioned; queued post-AR finalisation)

## For your AFSL compliance team

For specific questions about the boundary as it applies to a particular use case, contact `compliance@monitrax.com.au`. For the canonical product-positioning docs, see `docs/blueprint/MASTER_BLUEPRINT.md` and `docs/blueprint/TRAIL_FRAMEWORK.md`. For the AI advisor architecture, see the *Architecture Overview for Compliance Officers* article in this Help Center.

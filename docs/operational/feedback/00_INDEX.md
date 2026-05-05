# Adviser Feedback Inbox — Operational Docs

Operational documentation for the in-app adviser feedback channel shipped in Phase 33g.

| Need | Document |
|---|---|
| How to triage daily + run the weekly Claude Code synthesis ritual | [Triage and Synthesis](01_TRIAGE_AND_SYNTHESIS.md) |
| What advisers see / how to send feedback (their side) | `docs/help/org-professional/sending-feedback.md` |
| Why this surface exists + the §9 design decisions | `docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md` |

## Quick links

- **Inbox URL (Reza):** `/admin/feedback`
- **Adviser surface:** `/portal/feedback`
- **Markdown export:** `/api/admin/feedback/export?taggedOnly=true`
- **SLA target:** First admin reply within **48 hours** of `OPEN`

## When things go wrong

| Symptom | Where to look |
|---|---|
| Adviser submitted CDR data into a thread | [Triage and Synthesis §4 — Handling client / CDR data leaks](01_TRIAGE_AND_SYNTHESIS.md#4-handling-client--cdr-data-leaks) |
| Suspect breach: real consumer data + no consent recorded | [Incident Response Plan](../../policy/INCIDENT_RESPONSE_PLAN.md) §3 onwards |
| Need to delete a thread | [Triage and Synthesis §6 — How do I delete a thread?](01_TRIAGE_AND_SYNTHESIS.md#6-common-operational-questions) |
| Audit-log query — who edited what | [Triage and Synthesis §5 — Audit log questions](01_TRIAGE_AND_SYNTHESIS.md#5-audit-log-questions) |

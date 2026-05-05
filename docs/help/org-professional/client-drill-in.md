---
title: Client drill-in view
audience: org-professional
slug: client-drill-in
category: Client book
routeContext: [/portal/clients/[id]/view, /portal/clients/[id]/*]
lastReviewed: 2026-05-09
order: 3
summary: How to navigate the client view — the three main tabs (Structure / Money Flow / Dashboard), the AdviserOverlay, scope-locked tiles, and the per-view audit trail.
tags: [client, drill-in, navigation]
---

# Client drill-in view

`/portal/clients/[id]/view` is your view of a single client. This article walks the page.

## How to get here

- From the Practice dashboard: click an alert OR a client row in the client book table.
- From the Clients page: Sidebar → **Clients** → click any client row.

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Tab toggle** | Top of page | **Structure** (default — entity tree) · **Money Flow** (Sankey) · **Dashboard** (canonical consumer view) |
| **Main canvas** | Centre | Whichever tab is active |
| **AdviserOverlay** | Right rail (≥md) / bottom-sheet (<md) | Scope summary · Last reviewed · Notes · Tasks · Compliance footer |
| **Locked-tile placeholders** | Within Dashboard tab | Tiles outside the granted scope render as locked, with a "Request scope" CTA |

## Common tasks

**To switch tabs:**
1. Click **Structure** / **Money Flow** / **Dashboard** at the top.
2. The canvas updates. Default is Structure (the entity tree is the primary diagnostic).

**To request a wider scope from the client:**
1. A locked tile shows the missing scope (e.g. "Tax data not in granted scope").
2. Click **Request scope** on the locked tile.
3. The client receives a consent extension request via the conversations channel (Phase 32C PR4d).

**To add a note about this client (adviser-only):**
1. AdviserOverlay → **Notes** section.
2. Click **+ Add note** → write → Save.
3. Notes are private to your org's seats; the client never sees them.

**To add a follow-up task:**
1. AdviserOverlay → **Tasks** section.
2. Click **+ Add task** → set title, due date, assignee.
3. Task appears in your Sidebar → **Tasks** list.

**To see when this client was last reviewed:**
1. AdviserOverlay top → **Last reviewed** timestamp.
2. The timestamp updates every time you open this view (logged via `PRO_DASHBOARD_VIEW` audit row + `ClientAccessLog` row).

**To open a conversation with the client:**
1. AdviserOverlay → **Conversations** section.
2. Click an existing thread, or **+ New thread**.

## Common navigation questions

**Q: Why are some dashboard tiles greyed out / locked?**
The client granted you a specific scope (LOANS / PROPERTIES / INVESTMENTS / TAX / FINANCIAL / FULL). Tiles outside the scope are locked. Click **Request scope** to ask for an extension.

**Q: Where do I see the client's recent activity?**
AdviserOverlay → **Activity** (recent transactions, account changes — sourced from the same audit trail).

**Q: Can I edit the client's data?**
No — read-only by design. Editing client data is the client's responsibility; you can suggest changes via a conversation thread.

**Q: How is this view different from what the client sees?**
- The **Dashboard** tab is the canonical consumer view, identical to what the client sees.
- The **Structure** + **Money Flow** tabs are the same data but in the adviser's preferred analytic view.
- The **AdviserOverlay** is exclusive to this view — the client doesn't see your notes / tasks.

**Q: Where's the per-view audit trail?**
Every drill-in writes a `PRO_DASHBOARD_VIEW` row (your AuditLog) AND a `ClientAccessLog` row (the client's record). The client can see when you accessed their data via Sidebar → **Settings** → **Security** → **Access log**.

## What's next

- See [Practice dashboard overview](/help/org-professional/practice-overview) to navigate back to the alert stream.
- See [Sending feedback](/help/org-professional/sending-feedback) to tell Monitrax what's missing in this view.

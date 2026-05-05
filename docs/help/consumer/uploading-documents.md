---
title: My Vault page
audience: consumer
slug: uploading-documents
category: My Vault
routeContext: [/dashboard/documents, /dashboard/vault]
lastReviewed: 2026-05-09
order: 12
summary: How to navigate the My Vault page — uploading files, viewing AI extractions, tagging, sharing, and deleting.
tags: [documents, vault, upload, navigation]
---

# My Vault page

`/dashboard/documents` (My Vault) is where every paper trail of your money goes. This article walks the page.

## How to get here

Sidebar → **My Vault**. (Between **My Guide** and **Reports**.)

## What's on the page

| Section | Where it is | What it shows |
|---|---|---|
| **Header** | Top | Page title + **+ Upload** button + filter chips |
| **Filter chips** | Below header | Filter by Type (Statement / Payslip / Receipt / Invoice / Contract / Deed / Tax / Other) |
| **Search bar** | Top right | Free-text search by filename or extracted content |
| **Document grid** | Main body | Tile per document with type badge, date, linked-to (property / loan / tax year) |
| **Document detail dialog** | Click any tile | Tabs: Preview · Extracted data · Linked · Share · Settings |

## Common tasks

**To upload a document:**
1. Click **+ Upload** at the top, OR drag-and-drop a file onto the page.
2. Pick the file (PDF / JPG / PNG / HEIC / CSV; ≤25 MB).
3. The file uploads + the AI starts extraction.
4. Wait 5–30 seconds for extraction (longer for multi-page PDFs).
5. The **Extracted data** tab shows the rows the AI found.

**To confirm AI-extracted rows:**
1. Open the document → **Extracted data** tab.
2. Review each extracted row (income / expense / transaction).
3. Edit any wrong values inline.
4. Click **Confirm + save** at the bottom.
5. The rows land in your data (visible on `/dashboard/balances` / `/cashflow` / etc.).

**To link a document to a property / loan / tax year:**
1. Open the document → **Linked** tab.
2. Click **+ Link** → pick the entity.
3. Save. The document now appears in that entity's documents tab.

**To share a document with your accountant:**
1. Open the document → **Share** tab.
2. Click **+ New share link**.
3. Set expiry (24h / 7d / 30d) + optional password.
4. Copy the link → send to your accountant.

**To delete a document:**
1. Open the document → **Settings** tab.
2. Click **Delete document**.
3. Optionally tick **Also remove extracted data**.
4. Confirm.

## Common navigation questions

**Q: My uploaded statement didn't extract any rows.**
Open the document → **Extracted data** tab → check the status banner. Common reasons: low-quality scan, password-protected PDF, statement format the classifier doesn't recognise. Either manually add the transactions or try the live bank import (Sidebar → My Accounts → Balances → + Add → Connect bank).

**Q: How do I see all documents linked to a specific property?**
Open the property on `/dashboard/properties` → **Documents** tab. Or filter the Vault by **Linked-to: <property name>**.

**Q: Where is the Reports page (the inverse — exporting data OUT)?**
Sidebar → **Reports**. Reports = exports for accountants / banks / you. Vault = inputs.

**Q: Can I bulk-upload?**
Drag-and-drop multiple files at once. Each processes independently.

**Q: My trust deed is 80 pages — will the AI extract beneficiary clauses?**
Trust-deed parsing ships with Phase 41f. v1 stores the file; you'll need to enter beneficiaries manually in `/dashboard/entities`.

## What's next

- See [Reports](/help/consumer/uploading-documents) — actually, Reports help is queued (Phase 33i+1).
- For bank-side data via CDR (alternative to manual upload), see [Managing accounts and loans](/help/consumer/managing-accounts-and-loans).

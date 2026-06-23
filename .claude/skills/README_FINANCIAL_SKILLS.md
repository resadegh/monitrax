# Financial report skills (installed 2026-06-23)

Reza requested installing the financial skills from `anthropics/financial-services`
(and the `anthropics/claude-cookbooks` financial-applications notebook).

## What was installed — and what was deliberately NOT
Installed only the **report/spreadsheet output** subset (genuinely reusable for
delivering audits and Monitrax financial reports as files):
- `xlsx-author/` — produce a `.xlsx` on disk via openpyxl (headless).
- `audit-xls/` — audit/inspect an Excel workbook's formulas + structure.
- `pptx-author/` — produce a `.pptx` deck on disk.

**Deliberately excluded (~110 of the 117 skills in that repo):** the institutional
investment-banking / equity-research / PE valuation skills (`dcf-model`, `lbo-model`,
`comps-analysis`, `3-statement-model`, `pitch-deck`, `earnings-analysis`, `gl-recon`,
etc.). They target corporate valuation + analyst work product and have **no relevance
to a personal-finance app or to verifying Monitrax's calculation correctness**.
Installing all 117 would violate CLAUDE.md §12.1 (no bloat). Source remains available
at https://github.com/anthropics/financial-services if a specific one is ever needed.

## Important: these do NOT verify calculation correctness
These are **document-generation** skills. The financial-correctness audit (tax, debt,
cashflow, SSOT, actuals-vs-declared) is performed by **code verification + worked
examples + unit tests + ATO-source checks**, not by these skills. They are for
producing the audit/report as polished Excel/PDF if desired.

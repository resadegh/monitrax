# Property Expenses — Stitch design pass (MON-005 + MON-008)

Stitch-first design (CLAUDE.md §18.2.1) for a per-property **Expenses** section that both
SHOWS a property's expenses (fixes MON-005) and lets the user ADD them inline, actuals-first
(fixes MON-008).

- Project: `1859462351962811110` (canonical Monitrax Stitch project)
- Model: `GEMINI_3_FLASH`

## Screens

| File | Screen ID | Notes |
|---|---|---|
| `property-expenses-v1.{png,html}` | `eb3b9b5112004caaa59caa7e0101acef` | First pass — populated card + inline add form only. |
| `property-expenses-v2.{png,html}` | `e316a4811e364fbb93234d7c96f9df5d` | **Passing version** — populated + empty-state frames. |

## §18.8 quality gate

Self-reviewed against the 7-lens rubric before presenting (CLAUDE.md §18.8, present only if > 9/10):

- **v1 = 8.3/10** — below bar. Deficiencies: no empty state (the primary MON-008
  first-entry case), headline total not in sky→indigo gradient, `$9,400` estimate amount
  mis-coloured amber (§18.7.2 reserves amber for genuine caution), no row edit/delete affordance.
- **v2 = 9.3/10** — passes. Per-lens: brand-glass 9.5 · hierarchy 9 · behaviour-psych 9.5 ·
  typography 9 · premium 9 · completeness 9 · polish 9. Fixes: empty state added (leads with
  the form, celebrates the next action), gradient total, all amounts neutral ink, status shown
  only by the Actual/Estimate pill, hover edit/delete icons.

## Pending (do NOT convert to React until Reza approves — §18)

- Reza's nod on the direction.
- Category dropdown: fixed property-expense list vs free-text (product decision).
- Full 4-variant matrix (desktop-light/dark + mobile-light/dark) per §18.7.2 before React conversion.

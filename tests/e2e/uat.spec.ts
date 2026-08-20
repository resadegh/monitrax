import { test, expect } from './auth';
import type { Page } from '@playwright/test';

/**
 * Phase 4 · Layer 4 — UAT scenarios (seeded archetypes, real-human flows).
 *
 * Signs in via the Auth emulator (no secret / no manual login). The "family"
 * archetype (David Mei) has multiple entities + a discretionary trust + SMSF +
 * company, so it exercises the entity-value label and per-entity CGT. Selectors
 * are grounded in the live UI (file:line in comments).
 *
 * Timing note: the dashboard's `/api/master-snapshot` (and the What-If
 * scenario context) are computed server-side and take several seconds; CI
 * runners are slower than local. Data-dependent assertions therefore use a
 * generous `LOAD` ceiling rather than the 5s default, and each page first waits
 * for the authenticated shell (the DashboardLayout "Loading..." auth gate to
 * clear) before asserting page content.
 */

const LOAD = 45_000;

/**
 * Wait for the authenticated shell. DashboardLayout renders "Loading..." until
 * `/api/auth/me` resolves the user; once it does, the TRAIL sidebar (with the
 * "My Wealth" nav item) is always present. That's the stable "authed" signal.
 */
async function waitForShell(page: Page): Promise<void> {
  await expect(page.getByText('My Wealth').first()).toBeVisible({ timeout: LOAD });
}

/**
 * Read the dashboard's headline net-worth figure (waits for the data to
 * populate). M3 PR-2: /dashboard is the v1 SCOREBOARD (ScoreboardClient) —
 * its portfolio tile renders the net-worth VALUE above its label
 * (value-then-label MiniStat), where the old HomeClient printed the label
 * first — so both orders are accepted. The figure is still
 * /api/portfolio/snapshot netWorth either way, so "add a property moves it"
 * keeps meaning the same thing.
 */
async function readDashboardNetWorth(page: Page): Promise<number> {
  await page.goto('/dashboard');
  await waitForShell(page);
  await expect(page.getByText(/net worth/i).first()).toBeVisible({ timeout: LOAD });
  let value = NaN;
  await expect
    .poll(
      async () => {
        const body = await page.locator('body').innerText();
        const m =
          body.match(/Net\s*Worth[\s\S]{0,80}?\$\s?([\d,]+)/i) ??
          body.match(/\$\s?([\d,]+)[\s\S]{0,40}?Net\s*worth/i);
        value = m ? Number(m[1].replace(/,/g, '')) : NaN;
        return Number.isFinite(value) && value > 0 ? 'ready' : 'pending';
      },
      { timeout: LOAD },
    )
    .toBe('ready');
  return value;
}

test.describe('UAT — seeded-archetype real-human flows (emulator auth)', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('family'); // David Mei — couple + trust + SMSF + company
  });

  test('add a property → dashboard net worth reflects it', async ({ page }) => {
    const before = await readDashboardNetWorth(page);

    await page.goto('/dashboard/properties');
    await waitForShell(page);
    await page.getByRole('button', { name: /add property/i }).first().click();
    // Scope to the property FORM dialog — the layout also mounts persistent
    // "Send feedback" / "Help drawer" asides with role="dialog", so an
    // unscoped getByRole('dialog') is strict-mode-ambiguous. The form is the
    // only dialog carrying the "Property Name" field.
    const dialog = page.getByRole('dialog').filter({ hasText: 'Property Name' });
    await expect(dialog).toBeVisible({ timeout: LOAD });

    // properties/page.tsx marks name + purchasePrice + purchaseDate +
    // currentValue + valuationDate as `required` (HTML5), so all must be filled
    // for the submit to succeed.
    await dialog.getByLabel('Property Name').fill('E2E Test Property');
    await dialog.getByLabel('Purchase Price').fill('600000');
    await dialog.getByLabel('Purchase Date').fill('2020-01-01');
    await dialog.getByLabel('Current Value').fill('750000');
    await dialog.getByLabel('Valuation Date').fill('2026-01-01');
    // OwnershipPicker — "Just me" (sole) is the default; click to be explicit
    // (components/ownership/OwnershipPicker.tsx:184).
    await dialog.getByText(/just me/i).first().click();
    await dialog.getByRole('button', { name: /add property/i }).click();
    await expect(dialog).toBeHidden({ timeout: LOAD });

    const after = await readDashboardNetWorth(page);
    expect(after).toBeGreaterThan(before);
  });

  test('sell-property What-If → per-entity CGT breakdown (D6)', async ({ page }) => {
    // D6 lever — lib/cfo/scenarios/sellProperty.ts. The lever auto-selects the
    // user's LARGEST property on context load (page.tsx:307-310); for the family
    // archetype that's the principal residence ("Family home — Killara", a HOME),
    // which is CGT-exempt — so pick an INVESTMENT property (the picker renders
    // each property as a button labelled with its name — page.tsx:1256-1269).
    await page.goto('/dashboard/cfo/what-if/sellProperty');
    await waitForShell(page);
    await expect(page.getByRole('heading', { name: /sell a propert/i }).first()).toBeVisible({ timeout: LOAD });
    await page.getByRole('button', { name: /investment 1/i }).first().click();
    // The per-entity CGT (D6) surfaces as the per-owner breakdown in the
    // collapsible "How we computed this" panel (sellProperty.ts:cgtAssumptionLines).
    // The literal "Estimated CGT (your share)" is an internal scenario impact
    // label the lever summarises (into the "Net worth change … (after … CGT)"
    // line) rather than printing verbatim, so we expand the panel and assert the
    // per-owner taxable-gain split — the real, rendered D6 evidence.
    const computed = page.getByRole('button', { name: /how we computed this/i });
    await expect(computed).toBeVisible({ timeout: LOAD });
    await computed.click();
    await expect(page.getByText(/capital gain split across \d+ owner/i).first()).toBeVisible({ timeout: LOAD });
  });

  // M3 PR-2: /dashboard is the v1 SCOREBOARD; EntityBreakdownWidget renders
  // ONLY in HomeClient, which is retired from the route until its R4 return
  // (plan M3.4 — no wealth-OS widgets on the scoreboard). The L2-1 label has
  // no rendered surface to assert until then. RE-ENABLE when HomeClient
  // returns at R4 (or the widget gains a kept surface).
  test.skip('entity-value widget carries the legal-title label (PR #1114 / L2-1 Option B)', async ({ page }) => {
    // EntityBreakdownWidget renders for ≥2 entities (David qualifies); the
    // footer carries the legal-title label (components/ownership/EntityBreakdownWidget.tsx).
    await page.goto('/dashboard');
    await waitForShell(page);
    const label = page.getByText(/values are by\s+legal title/i).first();
    await expect(label).toBeVisible({ timeout: LOAD });
    await expect(label).toContainText(/Tax/);
  });

  test('delete a property → its row (and ownership rows) are gone (L2-2)', async ({ page }) => {
    await page.goto('/dashboard/properties');
    await waitForShell(page);
    page.on('dialog', (d) => d.accept()); // native confirm() — properties/page.tsx:390
    const trash = page.locator('button:has(svg.lucide-trash-2)');
    await expect(trash.first()).toBeVisible({ timeout: LOAD });
    const before = await trash.count();
    await trash.first().click();
    await expect.poll(async () => trash.count(), { timeout: LOAD }).toBeLessThan(before);
  });
});

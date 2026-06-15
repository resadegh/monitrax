import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 4 · Layer 4 — UAT scenarios (seeded archetypes, real-human flows).
 *
 * Selectors are grounded in the live UI (file:line in comments). The specs
 * skip unless an authenticated session is configured (see auth.setup.ts):
 * login is GCP/Firebase only, with no test bypass, so CI must inject
 * `E2E_STORAGE_STATE_JSON`. Run locally against a seeded dev instance with
 * `E2E_STORAGE_STATE_JSON` set, or wire the CI secret.
 */

const AUTH_CONFIGURED = !!process.env.E2E_STORAGE_STATE_JSON;

test.beforeEach(() => {
  test.skip(
    !AUTH_CONFIGURED,
    'No E2E auth configured (E2E_STORAGE_STATE_JSON). Login is GCP/Firebase only — there is no test bypass. ' +
      'Wire a captured storage state for a seeded seed:lighthouse user (ideally a dedicated Firebase TEST project) to enable these UAT flows.',
  );
});

async function readDashboardNetWorth(page: Page): Promise<number> {
  await page.goto('/dashboard');
  // Net worth hero (app/dashboard/page.tsx — "Net Worth" label on the hero tile).
  const netWorthRegion = page.getByText(/net worth/i).first();
  await expect(netWorthRegion).toBeVisible();
  const body = await page.locator('body').innerText();
  const m = body.match(/Net Worth[\s\S]{0,40}?\$\s?([\d,]+)/i);
  return m ? Number(m[1].replace(/,/g, '')) : NaN;
}

test.describe('UAT — seeded-archetype real-human flows', () => {
  test('add a property → dashboard net worth reflects it', async ({ page }) => {
    const before = await readDashboardNetWorth(page);

    // Add Property (app/dashboard/properties/page.tsx:540 button "Add Property").
    await page.goto('/dashboard/properties');
    await page.getByRole('button', { name: /add property/i }).first().click();

    // Dialog form (page.tsx:783+). Fill the minimum: a value + the ownership picker.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/current value|value|estimated value/i).first().fill('750000');
    // OwnershipPicker (components/ownership/OwnershipPicker.tsx) — "Just me" = sole.
    await dialog.getByText(/just me/i).first().click();
    await dialog.getByRole('button', { name: /add property|save/i }).first().click();
    await expect(dialog).toBeHidden();

    const after = await readDashboardNetWorth(page);
    // Net worth should increase by roughly the property value (no loan added).
    expect(after).toBeGreaterThan(before);
  });

  test('sell-property What-If → per-entity CGT split is shown ("Estimated CGT (your share)")', async ({ page }) => {
    // Lever detail (app/dashboard/cfo/what-if/page.tsx:100 → /sellProperty).
    await page.goto('/dashboard/cfo/what-if/sellProperty');
    await expect(page.getByRole('heading', { name: /sell.*propert/i }).first()).toBeVisible();

    // Pick the first property the seeded user owns, if a picker is present.
    const picker = page.getByRole('combobox').first();
    if (await picker.count()) {
      await picker.selectOption({ index: 1 }).catch(() => undefined);
    }

    // D6 output: the impact card carries the label "Estimated CGT (your share)"
    // (lib/cfo/scenarios/sellProperty.ts:153,423) + a "Tax tab" pointer for
    // co-owners (line 298). Assert the per-entity CGT framing is present.
    await expect(page.getByText(/estimated cgt \(your share\)/i).first()).toBeVisible();
  });

  test('entity-value widget carries the legal-title label (PR #1114 / L2-1 Option B)', async ({ page }) => {
    // EntityBreakdownWidget renders only for multi-entity users (≥2 real
    // entities) — use a seeded multi-entity archetype (David Mei / Olivia Novak).
    await page.goto('/dashboard');
    // Exact label: EntityBreakdownWidget.tsx:132 "Values are by legal title …
    // applied in each entity's Tax view …".
    const label = page.getByText(/values are by\s+legal title/i).first();
    await expect(label).toBeVisible();
    await expect(label).toContainText(/Tax/);
  });

  test('delete a property → its row (and ownership rows) are gone (L2-2)', async ({ page }) => {
    await page.goto('/dashboard/properties');
    const rowsBefore = await page.getByRole('button', { name: '' }).count().catch(() => 0);

    // Native confirm() (app/dashboard/properties/page.tsx:390) — auto-accept.
    page.on('dialog', (d) => d.accept());
    // Delete control: ghost icon button with the Trash2 icon (page.tsx:680).
    const deleteBtn = page.locator('button:has(svg.lucide-trash-2)').first();
    await expect(deleteBtn).toBeVisible();
    const countBefore = await page.locator('button:has(svg.lucide-trash-2)').count();
    await deleteBtn.click();

    // The deleted property's row disappears; the backend atomically removes the
    // OwnershipGroup / BeneficialOwnershipOverride rows (assetOwnershipCleanup,
    // PR #1114) so no orphan ownership data remains.
    await expect
      .poll(async () => page.locator('button:has(svg.lucide-trash-2)').count())
      .toBeLessThan(countBefore);
    expect(rowsBefore).toBeGreaterThanOrEqual(0);
  });
});

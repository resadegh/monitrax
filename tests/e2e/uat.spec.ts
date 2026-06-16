import { test, expect } from './auth';
import type { Page } from '@playwright/test';

/**
 * Phase 4 · Layer 4 — UAT scenarios (seeded archetypes, real-human flows).
 *
 * Signs in via the Auth emulator (no secret / no manual login). The "family"
 * archetype (David Mei) has multiple entities + a discretionary trust + SMSF +
 * company, so it exercises the entity-value label and per-entity CGT. Selectors
 * are grounded in the live UI (file:line in comments).
 */

async function readDashboardNetWorth(page: Page): Promise<number> {
  await page.goto('/dashboard');
  await expect(page.getByText(/net worth/i).first()).toBeVisible();
  const body = await page.locator('body').innerText();
  const m = body.match(/Net Worth[\s\S]{0,40}?\$\s?([\d,]+)/i);
  return m ? Number(m[1].replace(/,/g, '')) : NaN;
}

test.describe('UAT — seeded-archetype real-human flows (emulator auth)', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('family'); // David Mei — couple + trust + SMSF + company
  });

  test('add a property → dashboard net worth reflects it', async ({ page }) => {
    const before = await readDashboardNetWorth(page);

    await page.goto('/dashboard/properties');
    await page.getByRole('button', { name: /add property/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/current value|value|estimated value/i).first().fill('750000');
    await dialog.getByText(/just me/i).first().click(); // OwnershipPicker — sole
    await dialog.getByRole('button', { name: /add property|save/i }).first().click();
    await expect(dialog).toBeHidden();

    const after = await readDashboardNetWorth(page);
    expect(after).toBeGreaterThan(before);
  });

  test('sell-property What-If → per-entity CGT split ("Estimated CGT (your share)")', async ({ page }) => {
    // D6 lever — lib/cfo/scenarios/sellProperty.ts:153,423.
    await page.goto('/dashboard/cfo/what-if/sellProperty');
    await expect(page.getByRole('heading', { name: /sell.*propert/i }).first()).toBeVisible();
    const picker = page.getByRole('combobox').first();
    if (await picker.count()) await picker.selectOption({ index: 1 }).catch(() => undefined);
    await expect(page.getByText(/estimated cgt \(your share\)/i).first()).toBeVisible();
  });

  test('entity-value widget carries the legal-title label (PR #1114 / L2-1 Option B)', async ({ page }) => {
    // EntityBreakdownWidget.tsx:132 — renders for ≥2 entities (David qualifies).
    await page.goto('/dashboard');
    const label = page.getByText(/values are by\s+legal title/i).first();
    await expect(label).toBeVisible();
    await expect(label).toContainText(/Tax/);
  });

  test('delete a property → its row (and ownership rows) are gone (L2-2)', async ({ page }) => {
    await page.goto('/dashboard/properties');
    page.on('dialog', (d) => d.accept()); // native confirm() — properties/page.tsx:390
    const trash = page.locator('button:has(svg.lucide-trash-2)');
    await expect(trash.first()).toBeVisible();
    const before = await trash.count();
    await trash.first().click();
    await expect.poll(async () => trash.count()).toBeLessThan(before);
  });
});

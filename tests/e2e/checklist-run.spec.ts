import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Checklist Verification E2E Audit', () => {
  test('Run Comprehensive Audit', async ({ page }) => {
    test.setTimeout(60000);

    // ─── 1. PWA & Navigation ───
    await page.goto(BASE_URL);
    await page.waitForLoadState('load');

    // Check manifest link in index.html
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href', { timeout: 2000 }).catch(() => null);
    expect(manifestLink).toBe('/manifest.webmanifest');

    // Check empty state message
    const emptyState = page.getByText('No items yet!');
    await expect(emptyState).toBeVisible();

    // Check logo branding
    const headerText = await page.locator('header').innerText();
    expect(headerText.includes('Stor') && headerText.includes('agent')).toBe(true);

    // Navigate to Add using nav
    await page.locator('nav').getByText('Add', { exact: true }).click();
    await page.waitForTimeout(500);

    // Title is Add to Ingestion -> Add to Inventory
    await expect(page.getByText('Add to Inventory')).toBeVisible();

    // Camera button is compact
    await expect(page.getByText('Open Camera')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);

    // Text input placeholder
    const addInput = page.locator('input[placeholder*="add 5 tubes"]');
    await expect(addInput).toBeVisible();

    // Mic button
    await expect(page.locator('.lucide-mic').first()).toBeVisible();

    // Ingest item
    await addInput.fill('add 2 hammers');
    await addInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify Action buttons in row
    await expect(page.locator('button[title="Confirm"]').first()).toBeVisible();
    await expect(page.locator('button[title="Edit"]').first()).toBeVisible();
    await expect(page.locator('button[title="Discard"]').first()).toBeVisible();

    // Verify Cancel button
    const cancelBtn = page.getByText('Cancel (1)');
    await expect(cancelBtn).toBeVisible();

    // Cancel flow dialog
    await cancelBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Discard 1 queued item?')).toBeVisible();
    
    // Go Back
    await page.getByRole('button', { name: 'Go Back' }).click();
    await page.waitForTimeout(300);

    // Confirm the item so we can click Review & Continue
    await page.locator('button[title="Confirm"]').first().click();
    await page.waitForTimeout(300);

    // Submit items to inventory
    await page.getByText('Review & Continue →').click();
    await page.waitForTimeout(500);

    // Browse Page using nav link
    await page.locator('nav').getByText('Browse', { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('hammers')).toBeVisible();

    // Add to cart
    await page.locator('.lucide-plus').last().click();
    
    // Cart details
    await page.locator('nav').getByText('Cart', { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('hammers')).toBeVisible();
    await expect(page.locator('input[placeholder*="Job Site"]')).toBeVisible();
    await expect(page.getByText('Comments')).toBeVisible();

    // Ledger History
    await page.locator('nav').getByText('History', { exact: true }).click();
    await page.waitForTimeout(500);

    // Finances View
    await page.locator('nav').getByText('Finance', { exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('By Date')).toBeVisible();
    await expect(page.getByText('By Project')).toBeVisible();
  });
});

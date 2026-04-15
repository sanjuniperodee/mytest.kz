import { expect, test } from '@playwright/test';

test.describe('Landing — grant calculator', () => {
  test('grant section and score panel are visible', async ({ page }) => {
    await page.goto('/');
    const grant = page.locator('#grant');
    await expect(grant).toBeVisible();
    await grant.scrollIntoViewIfNeeded();
    await expect(grant.locator('.ld-grant-panel')).toBeVisible();
  });
});

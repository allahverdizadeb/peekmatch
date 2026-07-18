import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads with hero, nav, and legal links; no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('a[href="/privacy"], a[href*="/privacy"]').first()).toBeAttached();
    await expect(page.locator('a[href="/terms"], a[href*="/terms"]').first()).toBeAttached();
    await expect(page.locator('a[href="/deletion"], a[href*="/deletion"]').first()).toBeAttached();

    expect(errors, `console/page errors on landing: ${errors.join('; ')}`).toEqual([]);
  });

  test('language switcher changes the hero title live, from Azerbaijani to English', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    const azText = await h1.textContent();

    await page.click('header button:has-text("AZ"), header button:has-text("EN")');
    await page.click('text=English');
    await page.waitForTimeout(150);
    const text = await h1.textContent();
    expect(text, 'hero title did not change after switching to English').not.toBe(azText);
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('privacy, terms, and deletion legal pages render real content on a cold direct visit (not a blank Suspense fallback)', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/deletion']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should load`).toBeLessThan(400);
      // The lazy chunk needs a moment to fetch on a cold visit — wait for real heading content
      // rather than reading body text immediately, which would just catch the loading fallback.
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
      const bodyText = await page.textContent('body');
      expect(bodyText?.trim().length ?? 0, `${path} should have real content, not a blank page`).toBeGreaterThan(200);
    }
  });
});

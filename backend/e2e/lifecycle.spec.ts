import { test, expect } from '@playwright/test';

/** Fast (no AI call) coverage of the 410/404 lifecycle-state UI, which the funnel test doesn't
 * reach for the "never existed" case. */
test.describe('Analysis lifecycle states', () => {
  test('a random, never-created analysis id shows a not-found/lifecycle state, not a crash', async ({ page }) => {
    const fakeId = '11111111-1111-1111-1111-111111111111';
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(`/results/${fakeId}`);
    await expect(page.getByText(/tapılmadı|not found|silin|delet/i).first()).toBeVisible({ timeout: 10_000 });
    expect(errors, `unhandled page errors on a not-found analysis: ${errors.join('; ')}`).toEqual([]);
  });

  test('checkout page for a never-created analysis id does not silently proceed to payment', async ({ page }) => {
    const fakeId = '22222222-2222-2222-2222-222222222222';
    await page.goto(`/checkout/${fakeId}/1`);
    await expect(page.getByText(/tapılmadı|not found/i).first()).toBeVisible({ timeout: 10_000 });
    // The pay button must not be present/actionable for an analysis that doesn't exist.
    await expect(page.getByRole('button', { name: /Ödənişə keç|Proceed to payment/i })).toHaveCount(0);
  });
});

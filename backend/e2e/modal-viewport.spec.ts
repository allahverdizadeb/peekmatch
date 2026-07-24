import { test, expect, type Page } from '@playwright/test';

/** Regression coverage for the "Yeni analiz" confirmation modal's viewport/overflow bug: the
 * dialog used to render with `flex items-center justify-center` inside a non-scrolling `fixed
 * inset-0` overlay, and a route-transition wrapper's animation broke `position: fixed`'s
 * containing-block entirely (see components/Dialog.tsx's doc comment for the full root-cause
 * writeup and frontend/src/lib/bodyScrollLock.ts / backgroundInert.ts for the supporting fixes).
 * Both bugs together meant the dialog's title could render entirely above `y: 0` with no way to
 * scroll to it. These tests exercise the real rendered layout, not just DOM structure, so they
 * catch a regression neither jsdom-based component tests nor a raw containing-block fix alone
 * would necessarily catch.
 *
 * Uses `/start` without waiting for completion (status flips to 'processing' synchronously,
 * before the background AI call even begins) so this suite never depends on a real AI call
 * succeeding or how long it takes — the modal only cares that the analysis isn't still 'draft'.
 *
 * `page.waitForLoadState('networkidle')` after the first navigation is load-bearing, not
 * decorative: every page in this app calls `GET /session/current` on mount (via
 * useCurrentSession), which is also what creates the anonymous session cookie on a caller's very
 * first request. Firing this test's own setup `fetch()` immediately after `goto()` can race that
 * mount-effect call — if both go out before either's `Set-Cookie` has landed, the backend (with no
 * cookie on either request) creates two *different* sessions, and whichever `Set-Cookie` the
 * browser applies last "wins" the cookie jar while the analysis this test cares about was created
 * under the other one — so every following call 404s as an unrelated session. This never happens
 * to a real user (nothing else is racing to hit the API in their first few milliseconds on the
 * page); it's purely a test-setup ordering hazard, and letting the page's own bootstrap request
 * settle before this test issues any of its own avoids it entirely. */
async function createProcessingAnalysis(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const created = await page.evaluate(async () => {
    const form = new FormData();
    form.append('cvMode', 'text');
    form.append('cvText', 'x'.repeat(2100));
    const res = await fetch('/api/analyses', { method: 'POST', body: form, credentials: 'include' });
    return res.json();
  });
  const id = (created as { id: string }).id;

  await page.evaluate(
    async (id) => {
      await fetch(`/api/analyses/${id}/vacancy/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'y'.repeat(3100) }),
        credentials: 'include',
      });
      await fetch(`/api/analyses/${id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputLanguage: 'az', consent: true }),
        credentials: 'include',
      });
      await fetch(`/api/analyses/${id}/start`, { method: 'POST', credentials: 'include' });
    },
    id,
  );
  return id;
}

test.describe('New-analysis confirmation modal — viewport safety', () => {
  test('on a short 1280x600 viewport, the title and both actions are reachable and there is no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await createProcessingAnalysis(page);

    await page.goto('/analyze');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const title = page.locator('#new-analysis-confirm-title');
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();
    const titleBox = await title.boundingBox();
    expect(titleBox, 'title must have a real box').not.toBeNull();
    expect(titleBox!.y).toBeGreaterThanOrEqual(-1);
    expect(titleBox!.y).toBeLessThan(600);

    const confirmBtn = page.getByRole('button', { name: 'Yeni analizə başla' });
    await confirmBtn.scrollIntoViewIfNeeded();
    await expect(confirmBtn).toBeVisible();

    const cancelBtn = page.getByRole('button', { name: 'Ləğv et' });
    await cancelBtn.scrollIntoViewIfNeeded();
    await expect(cancelBtn).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('Escape closes the modal, restores body scroll, and preserves the existing analysis', async ({ page }) => {
    const id = await createProcessingAnalysis(page);
    await page.goto('/analyze');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    const status = await page.evaluate(
      async (analysisId) => (await fetch(`/api/analyses/${analysisId}`, { credentials: 'include' })).status,
      id,
    );
    expect(status, 'cancel path must not delete the analysis').toBe(200);
  });

  test('confirming replaces the analysis: old one is invalidated, no business-logic change beyond that', async ({
    page,
  }) => {
    const id = await createProcessingAnalysis(page);
    await page.goto('/analyze');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Yeni analizə başla' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 5000 });

    const after = await page.evaluate(async (analysisId) => {
      const res = await fetch(`/api/analyses/${analysisId}`, { credentials: 'include' });
      return { status: res.status, body: await res.json() };
    }, id);
    expect(after.status).toBe(410);
    expect(after.body.code).toBe('deleted');
  });

  test('route change while the modal is open cleans up scroll lock (browser back navigation)', async ({ page }) => {
    await createProcessingAnalysis(page);
    await page.goto('/');
    await page.goto('/analyze');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});

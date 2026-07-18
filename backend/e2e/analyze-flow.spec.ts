import { test, expect } from '@playwright/test';

/** Covers the platform's single most critical path end-to-end through the real UI: paste CV text
 * -> vacancy URL fails -> manual vacancy fallback -> submit -> processing -> results render with
 * real evidence-backed content -> delete-my-data makes the analysis immediately inaccessible.
 * This is intentionally one long test rather than several: each step depends on state (an
 * analysisId, a submitted CV, a completed analysis) created by the previous one, matching how a
 * real user actually moves through the funnel. */

test.describe('Critical journey: analyze -> results -> delete', () => {
  test('full funnel from CV paste to data deletion', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/analyze');

    // Step 1: CV as pasted text (avoids needing a real file fixture; exercises the same
    // MIN_CV_TEXT_CHARS validation + createAnalysisFromText path as file upload).
    await page.click('button:has-text("Mətn kimi daxil et")');
    await page.click('button:has-text("Nümunə mətni doldur")');
    await page.click('button:has-text("CV mətnini təsdiqlə")');
    await expect(page.getByText('Uğurla yükləndi')).toBeVisible({ timeout: 15_000 });

    // Step 2: vacancy URL that will fail extraction, forcing the manual-paste fallback — this
    // fallback is a first-class, tested path, not just an edge case (see CLAUDE.md).
    await page.fill('input[placeholder="https://..."]', 'https://example.com/this-is-not-a-real-job-posting');
    await page.click('button:has-text("Vakansiyanı yoxla")');
    // The manual-fallback textarea + "fill sample" button appear once the URL check reports
    // failure; the "submit manual text" button only appears once the sample fills it past the
    // 3000-char minimum, so it must not be waited on until after clicking fill-sample.
    await expect(page.getByText('Vakansiyanın mətnini daxil edin')).toBeVisible({ timeout: 20_000 });
    await page.click('button:has-text("Nümunə mətni doldur")');
    await page.click('button:has-text("Vakansiya mətnini təsdiqlə")');

    // Step 3: consent + submit.
    await page.click('input[type="checkbox"]');
    const submitBtn = page.locator('button:has-text("Uyğunluğu analiz et")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Step 4: processing page, then results.
    await page.waitForURL(/\/processing\//, { timeout: 15_000 });
    await page.waitForURL(/\/results\//, { timeout: 150_000 });

    // Step 5: results must show real, evidence-backed content — not an empty/error shell.
    const analysisId = page.url().split('/results/')[1];
    expect(analysisId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page.getByText(/\d+%/).first()).toBeVisible();
    await expect(page.getByText(/Güclü|Strength/i).first()).toBeVisible();

    // Step 6: delete my data — must be immediate (per product rules, not eventual). Confirming
    // navigates to home (DeleteConfirmDialog.tsx: confirmDelete() -> navigate('/')).
    await page.click('button:has-text("Məlumatlarımı sil")');
    await page.locator('button:has-text("Məlumatlarımı sil")').last().click();
    await page.waitForURL('/', { timeout: 10_000 });

    // Step 7: re-fetching the same analysis id must now show the deleted-lifecycle state, not
    // stale cached content — proves deletion is real and immediate, not just a client-side hide.
    await page.goto(`/results/${analysisId}`);
    await expect(page.getByText(/silin|delet|sildi/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

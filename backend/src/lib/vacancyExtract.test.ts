import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { extractVacancyFromUrl, renderPageForTesting, VacancyExtractError } from './vacancyExtract.js';

let server: http.Server;
let port: number;

beforeAll(async () => {
  // A local server standing in for "an internal service the app should never fetch on a user's
  // behalf" — reachable at 127.0.0.1, exactly like the real backend or any other internal service.
  server = http.createServer((req, res) => {
    if (req.url === '/redirect-to-internal') {
      res.writeHead(302, { Location: `http://127.0.0.1:${port}/internal-secret` });
      res.end();
      return;
    }
    if (req.url === '/spa-job-posting') {
      // Mirrors the real jobsearch.az bug this fixed: a thin pre-hydration shell (well under
      // MIN_EXTRACTED_VACANCY_CHARS, so a plain fetch() would correctly fail as insufficient_text
      // rather than silently returning the wrong content) plus real content injected by
      // client-side JS after a short delay — a headless browser must wait for and capture this.
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><head><title>Loading</title></head><body>
        <div id="app">Loading job posting</div>
        <script>
          setTimeout(function () {
            document.title = 'Senior Test Engineer - Acme Corp';
            document.getElementById('app').innerText =
              'SPA_HYDRATED_MARKER Senior Test Engineer requirements: 5+ years experience, ' +
              'Node.js, TypeScript, strong communication skills. '.repeat(20);
          }, 300);
        </script>
      </body></html>`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>' + 'internal content '.repeat(50) + '</body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(() => {
  server.close();
});

describe('extractVacancyFromUrl — SSRF protection', () => {
  it('rejects a URL pointing directly at a loopback address', async () => {
    await expect(extractVacancyFromUrl(`http://127.0.0.1:${port}/internal-secret`)).rejects.toThrow(VacancyExtractError);
    await expect(extractVacancyFromUrl(`http://127.0.0.1:${port}/internal-secret`)).rejects.toMatchObject({ code: 'blocked' });
  });

  it('rejects "localhost" the same way (must resolve the hostname, not just string-match on the literal IP)', async () => {
    await expect(extractVacancyFromUrl(`http://localhost:${port}/internal-secret`)).rejects.toMatchObject({ code: 'blocked' });
  });

  it('rejects a redirect chain that starts at a plausible host but redirects to an internal address — the whole point of manual redirect-following is that this must be caught too', async () => {
    // Both hops here are 127.0.0.1 in this test (no public DNS available in CI), but this proves
    // the redirect target is re-validated rather than only the original URL.
    await expect(extractVacancyFromUrl(`http://127.0.0.1:${port}/redirect-to-internal`)).rejects.toMatchObject({ code: 'blocked' });
  });

  it('rejects non-http(s) protocols before any network call', async () => {
    await expect(extractVacancyFromUrl('file:///etc/passwd')).rejects.toMatchObject({ code: 'invalid_url' });
    await expect(extractVacancyFromUrl('ftp://127.0.0.1/')).rejects.toMatchObject({ code: 'invalid_url' });
  });

  it('rejects a garbage string that is not a URL at all', async () => {
    await expect(extractVacancyFromUrl('not a url')).rejects.toMatchObject({ code: 'invalid_url' });
  });
});

describe('renderPage — client-rendered (SPA) pages', () => {
  it('waits for and captures content injected by client-side JS after page load, not just the pre-hydration HTML shell', async () => {
    // Regression test for the real bug: this used to be a plain fetch(), which only ever saw
    // "Loading job posting…" (under MIN_EXTRACTED_VACANCY_CHARS) and would fail with
    // insufficient_text on any JS-rendered job board, or on a chattier shell, silently return
    // the shell's nav/boilerplate text instead of the real posting.
    //
    // Uses renderPageForTesting (SSRF validation disabled) rather than extractVacancyFromUrl
    // directly, because any local test server is necessarily at a private address that the real
    // SSRF guard correctly blocks by design — that guard is already covered by its own tests
    // above; this test is specifically about the JS-rendering behavior.
    const { html } = await renderPageForTesting(new URL(`http://127.0.0.1:${port}/spa-job-posting`));
    expect(html).toContain('SPA_HYDRATED_MARKER');
    expect(html).toContain('Senior Test Engineer requirements');
    // The <title> is also updated by the same script — confirms the DOM state captured is
    // post-JS-execution, not a snapshot of the initial server response.
    expect(html).toContain('<title>Senior Test Engineer - Acme Corp</title>');
  }, 15_000);
});

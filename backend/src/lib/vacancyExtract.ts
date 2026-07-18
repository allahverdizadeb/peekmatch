import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { lookup } from 'node:dns/promises';
import { isPrivateOrReservedIp, SsrfBlockedError } from './ssrfGuard.js';

export const MIN_VACANCY_TEXT_CHARS = 3000; // manual-paste minimum
const MIN_EXTRACTED_VACANCY_CHARS = 200; // below this, treat extraction as failed
const NAV_TIMEOUT_MS = 15_000;
const HYDRATION_WAIT_MS = 1_500; // lets client-rendered (SPA) job boards populate content after DOMContentLoaded
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface VacancyExtractResult {
  title: string;
  company: string;
  location: string;
  domain: string;
  text: string;
}

export class VacancyExtractError extends Error {
  code: 'invalid_url' | 'fetch_failed' | 'blocked' | 'insufficient_text';
  constructor(code: VacancyExtractError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/** Resolves `hostname` and throws SsrfBlockedError if ANY resolved address is private/reserved.
 * Called for every navigation Playwright makes (initial URL and every redirect hop) — checking
 * only the first URL would let an attacker point a public-looking URL through a redirect to an
 * internal address. */
async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
  }
  if (addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new SsrfBlockedError(hostname);
  }
}

function guessTitle($: cheerio.CheerioAPI): string {
  const og = $('meta[property="og:title"]').attr('content');
  if (og) return og.trim();
  const h1 = $('h1').first().text().trim();
  if (h1) return h1;
  return $('title').first().text().trim();
}

function guessCompany($: cheerio.CheerioAPI, domain: string): string {
  const og = $('meta[property="og:site_name"]').attr('content');
  if (og) return og.trim();
  return domain;
}

function parsePublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new VacancyExtractError('invalid_url', 'Düzgün vakansiya linki daxil edin.');
  }
  if (!/^https?:$/.test(url.protocol)) throw new VacancyExtractError('invalid_url', 'Düzgün vakansiya linki daxil edin.');
  return url;
}

interface RenderedPage {
  html: string;
  finalUrl: URL;
}

/** Launches a headless browser, navigates to `url` (waiting for JS hydration to populate
 * client-rendered content — see extractVacancyFromUrl's doc comment for why this matters), and
 * returns the fully-rendered DOM plus the final URL after any redirects.
 *
 * `validateNavigation` is called for EVERY navigation (the initial URL and every redirect hop,
 * via page.route intercepting navigation requests) and must throw to abort a hop — this is how
 * SSRF protection is enforced, and it's a required parameter (not defaulted to a real check)
 * specifically so a caller can't forget to pass one. extractVacancyFromUrl passes
 * `assertPublicHost`; tests pass a no-op so JS-rendering behavior can be exercised against a local
 * test server without also fighting the (correct, working-as-intended) guard that blocks every
 * local test server's address by design. */
async function renderPage(url: URL, validateNavigation: (hostname: string) => Promise<void>): Promise<RenderedPage> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, extraHTTPHeaders: { 'Accept-Language': 'az,en;q=0.8,ru;q=0.6' } });
    const page = await context.newPage();

    let blockedErr: unknown = null;
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (!req.isNavigationRequest()) return route.continue();
      try {
        await validateNavigation(new URL(req.url()).hostname);
      } catch (err) {
        blockedErr = err;
        return route.abort();
      }
      return route.continue();
    });

    let response;
    try {
      response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } catch (err) {
      throw blockedErr ?? err;
    }
    if (blockedErr) throw blockedErr;
    if (!response) throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
    if (response.status() === 403 || response.status() === 429) {
      throw new VacancyExtractError('blocked', 'Bəzi saytlar avtomatik oxunmanı məhdudlaşdırır.');
    }
    if (!response.ok()) {
      throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
    }
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
    }

    // Give client-rendered pages a beat to populate real content after DOMContentLoaded.
    await page.waitForTimeout(HYDRATION_WAIT_MS);
    return { html: await page.content(), finalUrl: new URL(page.url()) };
  } finally {
    await browser.close();
  }
}

/** Test-only entry point for renderPage with SSRF validation disabled — see renderPage's doc
 * comment. Never call this from production code paths. */
export async function renderPageForTesting(url: URL): Promise<RenderedPage> {
  return renderPage(url, async () => {});
}

export async function extractVacancyFromUrl(rawUrl: string): Promise<VacancyExtractResult> {
  const url = parsePublicHttpUrl(rawUrl);

  // Many job boards (jobsearch.az among them) render the actual posting client-side: a plain
  // fetch() only ever sees the pre-hydration HTML shell (nav/filters/other-listings widgets),
  // never the real job description — the page's own <title>/og:title tags are often still
  // server-rendered for SEO, which made this easy to miss without directly inspecting the body
  // text. A real (headless) browser executes the page's JavaScript exactly like a human's would,
  // so this renders correctly for both server-rendered and client-rendered sites alike.
  let rendered: RenderedPage;
  try {
    rendered = await renderPage(url, assertPublicHost);
  } catch (err) {
    if (err instanceof VacancyExtractError) throw err;
    if (err instanceof SsrfBlockedError) throw new VacancyExtractError('blocked', 'Bu ünvana müraciət edilə bilməz.');
    throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
  }

  const $ = cheerio.load(rendered.html);
  $('script, style, noscript, nav, footer, header, svg, iframe').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  if (bodyText.length < MIN_EXTRACTED_VACANCY_CHARS) {
    throw new VacancyExtractError(
      'insufficient_text',
      'Linkdən vakansiya mətni alınmadı. Bəzi saytlar avtomatik oxunmanı məhdudlaşdırır.',
    );
  }

  return {
    title: guessTitle($) || 'Vakansiya',
    company: guessCompany($, rendered.finalUrl.hostname),
    location: '',
    domain: rendered.finalUrl.hostname.replace(/^www\./, ''),
    text: bodyText.slice(0, 20000),
  };
}

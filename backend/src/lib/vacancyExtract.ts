import * as cheerio from 'cheerio';

export const MIN_VACANCY_TEXT_CHARS = 3000; // manual-paste minimum
const MIN_EXTRACTED_VACANCY_CHARS = 200; // below this, treat extraction as failed

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

export async function extractVacancyFromUrl(rawUrl: string): Promise<VacancyExtractResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error('bad protocol');
  } catch {
    throw new VacancyExtractError('invalid_url', 'Düzgün vakansiya linki daxil edin.');
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'az,en;q=0.8,ru;q=0.6',
      },
    }).finally(() => clearTimeout(timeout));
  } catch {
    throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
  }

  if (res.status === 403 || res.status === 429) {
    throw new VacancyExtractError('blocked', 'Bəzi saytlar avtomatik oxunmanı məhdudlaşdırır.');
  }
  if (!res.ok) {
    throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new VacancyExtractError('fetch_failed', 'Vakansiya səhifəsi avtomatik oxuna bilmədi.');
  }

  const html = await res.text();
  const $ = cheerio.load(html);
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
    company: guessCompany($, url.hostname),
    location: '',
    domain: url.hostname.replace(/^www\./, ''),
    text: bodyText.slice(0, 20000),
  };
}

import { chromium } from 'playwright';

export type DocLang = 'az' | 'en';

/** Unrecognized values (missing, or a removed legacy language like 'tr'/'ru') fall back to English —
 * PeekMatch targets the global market, so an unsupported selection should never default to
 * Azerbaijani content. */
function resolveDocLang(lang: string | null | undefined): DocLang {
  return lang === 'az' ? lang : 'en';
}

/** Matches the frontend's t.workspace.statusLabel/importanceLabel wording exactly (Workspace.tsx's
 * report tab) so the downloaded report and the on-site report never show different translations
 * for the same underlying `status`/`importance` enum values (those enum keys are fixed regardless
 * of outputLanguage — only their display labels are localized). */
export const REPORT_LABELS: Record<
  DocLang,
  {
    title: string;
    compatibilityLine: (pct: number, met: number, total: number) => string;
    tableHeaders: [string, string, string, string, string];
    statusLabel: Record<'met' | 'partial' | 'missing' | 'insufficient_info', string>;
    importanceLabel: Record<'kritik' | 'əsas' | 'üstünlük', string>;
  }
> = {
  az: {
    title: 'Uyğunluq hesabatı',
    compatibilityLine: (pct, met, total) => `Uyğunluq: ${pct}% · ${met}/${total} əsas tələb`,
    tableHeaders: ['Tələb', 'Kateqoriya', 'Vaciblik', 'Status', 'Sübut'],
    statusLabel: { met: 'Uyğundur', partial: 'Qismən uyğundur', missing: 'Kritik boşluq', insufficient_info: 'Məlumat kifayət deyil' },
    importanceLabel: { kritik: 'Kritik', əsas: 'Əsas', üstünlük: 'Üstünlük' },
  },
  en: {
    title: 'Compatibility Report',
    compatibilityLine: (pct, met, total) => `Compatibility: ${pct}% · ${met}/${total} core requirements`,
    tableHeaders: ['Requirement', 'Category', 'Importance', 'Status', 'Evidence'],
    statusLabel: { met: 'Met', partial: 'Partially met', missing: 'Critical gap', insufficient_info: 'Insufficient information' },
    importanceLabel: { kritik: 'Critical', əsas: 'Core', üstünlük: 'Preferred' },
  },
};

export function getReportLabels(lang: string | null | undefined) {
  return REPORT_LABELS[resolveDocLang(lang)];
}

const FILE_NAME: Record<DocLang, { report: string }> = {
  az: { report: 'Uygunluq_Hesabati' },
  en: { report: 'Compatibility_Report' },
};

/** ASCII-safe filename stems (no Content-Disposition RFC 5987 encoding needed) per language. */
export function docFileName(kind: 'report', lang: string | null | undefined): string {
  return FILE_NAME[resolveDocLang(lang)][kind];
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' } });
    return pdf;
  } finally {
    await browser.close();
  }
}

const PDF_BASE_STYLE = `
  body{font-family:Georgia,'Times New Roman',serif;color:#102A43;line-height:1.5;font-size:13px}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:15px;color:#0F9D91;margin:18px 0 6px;border-bottom:1px solid #DDE5EC;padding-bottom:4px}
  .meta{color:#52667A;font-size:12px;margin-bottom:4px}
  .exp-role{font-weight:700;margin-top:10px}
  .exp-dates{color:#74879A;font-size:12px;font-style:italic}
  ul{margin:4px 0;padding-left:18px}
`;

export async function reportToPdf(vacancyTitle: string, company: string, summaryHtml: string, lang?: string | null): Promise<Buffer> {
  const title = REPORT_LABELS[resolveDocLang(lang)].title;
  const html = `<html><head><meta charset="utf-8"><style>${PDF_BASE_STYLE}</style></head><body>
    <h1>${title}</h1>
    <div class="meta">${escapeHtml(vacancyTitle)} — ${escapeHtml(company)}</div>
    ${summaryHtml}
  </body></html>`;
  return htmlToPdf(html);
}

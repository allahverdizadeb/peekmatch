import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { chromium } from 'playwright';
import type { TailoredCv, CoverLetter } from './anthropic.js';

export type DocLang = 'az' | 'en';

function resolveDocLang(lang: string | null | undefined): DocLang {
  return lang === 'en' ? lang : 'az';
}

const CV_LABELS: Record<DocLang, { summary: string; skills: string; experience: string; education: string; certifications: string; languages: string }> = {
  az: { summary: 'Peşəkar xülasə', skills: 'Əsas bacarıqlar', experience: 'İş təcrübəsi', education: 'Təhsil', certifications: 'Sertifikatlar', languages: 'Dil bilikləri' },
  en: { summary: 'Professional Summary', skills: 'Core Skills', experience: 'Work Experience', education: 'Education', certifications: 'Certifications', languages: 'Languages' },
};

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

const FILE_NAME: Record<DocLang, { cv: string; report: string; coverLetter: string }> = {
  az: { cv: 'CV_Uygunlasdirilmis', report: 'Uygunluq_Hesabati', coverLetter: 'Cover_Letter' },
  en: { cv: 'Tailored_CV', report: 'Compatibility_Report', coverLetter: 'Cover_Letter' },
};

/** ASCII-safe filename stems (no Content-Disposition RFC 5987 encoding needed) per language. */
export function docFileName(kind: 'cv' | 'report' | 'coverLetter', lang: string | null | undefined): string {
  return FILE_NAME[resolveDocLang(lang)][kind];
}

export async function cvToDocx(cv: TailoredCv, lang?: string | null): Promise<Buffer> {
  const l = CV_LABELS[resolveDocLang(lang)];
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: cv.name, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: cv.title, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: cv.contact }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: l.summary, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.summary }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: l.skills, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.skills.join(' · ') }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: l.experience, heading: HeadingLevel.HEADING_3 }),
          ...cv.experience.flatMap((exp) => [
            new Paragraph({ children: [new TextRun({ text: exp.role, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: exp.dates, italics: true })] }),
            ...exp.bullets.map((b) => new Paragraph({ text: `• ${b}` })),
            new Paragraph({ text: '' }),
          ]),
          new Paragraph({ text: l.education, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.education }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: l.certifications, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.certifications }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: l.languages, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.languages }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function coverLetterToDocx(letter: CoverLetter, vacancyTitle: string, company: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: `${vacancyTitle} — ${company}`, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: letter.greeting }),
          new Paragraph({ text: '' }),
          ...letter.body.map((p) => new Paragraph({ text: p })),
          new Paragraph({ text: '' }),
          new Paragraph({ text: letter.closing }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
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

export async function cvToPdf(cv: TailoredCv, lang?: string | null): Promise<Buffer> {
  const l = CV_LABELS[resolveDocLang(lang)];
  const html = `<html><head><meta charset="utf-8"><style>${PDF_BASE_STYLE}</style></head><body>
    <h1>${escapeHtml(cv.name)}</h1>
    <div class="meta">${escapeHtml(cv.title)}</div>
    <div class="meta">${escapeHtml(cv.contact)}</div>
    <h2>${l.summary}</h2>
    <p>${escapeHtml(cv.summary)}</p>
    <h2>${l.skills}</h2>
    <p>${escapeHtml(cv.skills.join(' · '))}</p>
    <h2>${l.experience}</h2>
    ${cv.experience
      .map(
        (exp) =>
          `<div class="exp-role">${escapeHtml(exp.role)}</div><div class="exp-dates">${escapeHtml(exp.dates)}</div><ul>${exp.bullets
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join('')}</ul>`,
      )
      .join('')}
    <h2>${l.education}</h2><p>${escapeHtml(cv.education)}</p>
    <h2>${l.certifications}</h2><p>${escapeHtml(cv.certifications)}</p>
    <h2>${l.languages}</h2><p>${escapeHtml(cv.languages)}</p>
  </body></html>`;
  return htmlToPdf(html);
}

export async function reportToPdf(vacancyTitle: string, company: string, summaryHtml: string, lang?: string | null): Promise<Buffer> {
  const title = REPORT_LABELS[resolveDocLang(lang)].title;
  const html = `<html><head><meta charset="utf-8"><style>${PDF_BASE_STYLE}</style></head><body>
    <h1>${title}</h1>
    <div class="meta">${escapeHtml(vacancyTitle)} — ${escapeHtml(company)}</div>
    ${summaryHtml}
  </body></html>`;
  return htmlToPdf(html);
}

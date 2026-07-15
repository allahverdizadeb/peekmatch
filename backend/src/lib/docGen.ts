import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { chromium } from 'playwright';
import type { TailoredCv, CoverLetter } from './anthropic.js';

export async function cvToDocx(cv: TailoredCv): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: cv.name, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: cv.title, heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: cv.contact }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Peşəkar xülasə', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.summary }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Əsas bacarıqlar', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.skills.join(' · ') }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'İş təcrübəsi', heading: HeadingLevel.HEADING_3 }),
          ...cv.experience.flatMap((exp) => [
            new Paragraph({ children: [new TextRun({ text: exp.role, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: exp.dates, italics: true })] }),
            ...exp.bullets.map((b) => new Paragraph({ text: `• ${b}` })),
            new Paragraph({ text: '' }),
          ]),
          new Paragraph({ text: 'Təhsil', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.education }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Sertifikatlar', heading: HeadingLevel.HEADING_3 }),
          new Paragraph({ text: cv.certifications }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Dil bilikləri', heading: HeadingLevel.HEADING_3 }),
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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

export async function cvToPdf(cv: TailoredCv): Promise<Buffer> {
  const html = `<html><head><meta charset="utf-8"><style>${PDF_BASE_STYLE}</style></head><body>
    <h1>${escapeHtml(cv.name)}</h1>
    <div class="meta">${escapeHtml(cv.title)}</div>
    <div class="meta">${escapeHtml(cv.contact)}</div>
    <h2>Peşəkar xülasə</h2>
    <p>${escapeHtml(cv.summary)}</p>
    <h2>Əsas bacarıqlar</h2>
    <p>${escapeHtml(cv.skills.join(' · '))}</p>
    <h2>İş təcrübəsi</h2>
    ${cv.experience
      .map(
        (exp) =>
          `<div class="exp-role">${escapeHtml(exp.role)}</div><div class="exp-dates">${escapeHtml(exp.dates)}</div><ul>${exp.bullets
            .map((b) => `<li>${escapeHtml(b)}</li>`)
            .join('')}</ul>`,
      )
      .join('')}
    <h2>Təhsil</h2><p>${escapeHtml(cv.education)}</p>
    <h2>Sertifikatlar</h2><p>${escapeHtml(cv.certifications)}</p>
    <h2>Dil bilikləri</h2><p>${escapeHtml(cv.languages)}</p>
  </body></html>`;
  return htmlToPdf(html);
}

export async function reportToPdf(vacancyTitle: string, company: string, summaryHtml: string): Promise<Buffer> {
  const html = `<html><head><meta charset="utf-8"><style>${PDF_BASE_STYLE}</style></head><body>
    <h1>Uyğunluq hesabatı</h1>
    <div class="meta">${escapeHtml(vacancyTitle)} — ${escapeHtml(company)}</div>
    ${summaryHtml}
  </body></html>`;
  return htmlToPdf(html);
}

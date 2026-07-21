import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { ocrDocumentImages } from './ai.js';

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_CV_TEXT_CHARS = 2000; // pasted CV text minimum
export const MIN_EXTRACTED_TEXT_CHARS = 120; // below this a PDF is treated as "scanned / no text layer"
const MAX_OCR_PAGES = 5; // bound cost/latency for the vision-OCR fallback on pathological page counts

export class CvParseError extends Error {
  code: 'unsupported_type' | 'too_large' | 'scanned_pdf' | 'parse_failed';
  constructor(code: CvParseError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/** Joins a page's text items into readable lines, grouping by Y-position since pdfjs only
 * exposes positioned glyph runs, not paragraph/line structure. */
async function extractPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  const lines: string[] = [];
  let currentY: number | null = null;
  let current: string[] = [];
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform[5];
    if (currentY !== null && Math.abs(y - currentY) > 2) {
      lines.push(current.join(' ').trim());
      current = [];
    }
    currentY = y;
    if (item.str) current.push(item.str);
    if (item.hasEOL) {
      lines.push(current.join(' ').trim());
      current = [];
      currentY = null;
    }
  }
  if (current.length) lines.push(current.join(' ').trim());
  return lines.filter(Boolean).join('\n');
}

/** Renders a PDF page to a PNG image. Page-image-only PDFs — no text layer — are exactly what
 * this is for: resumes exported as a rasterized page by design tools (Canva, Figma, browser
 * print-to-PDF of a styled template) rather than real text, where `extractPageText` finds nothing. */
async function renderPageToPng(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const renderParams: any = { canvasContext: canvas.getContext('2d'), canvas, viewport };
  await page.render(renderParams).promise;
  return canvas.toBuffer('image/png').toString('base64');
}

/** Best-effort vision-OCR fallback for image-only PDF pages. Returns '' (never throws) when
 * unavailable (no OPENAI_API_KEY) or when OCR itself fails — the caller's existing "not enough
 * text" rejection is the correct behavior in that case, not a 500. */
async function tryOcrFallback(doc: any): Promise<string> {
  try {
    const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
    const images: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      images.push(await renderPageToPng(await doc.getPage(i)));
    }
    const text = await ocrDocumentImages(images.map((data) => ({ data, mediaType: 'image/png' as const })));
    return (text || '').trim();
  } catch (err) {
    console.error('[cvParse] OCR fallback failed', err);
    return '';
  }
}

export async function extractCvText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lower.endsWith('.pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');

  if (!isPdf && !isDocx) {
    throw new CvParseError('unsupported_type', 'Yalnız PDF və DOCX formatları dəstəklənir.');
  }

  try {
    if (isPdf) {
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const pageTexts: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        pageTexts.push(await extractPageText(await doc.getPage(i)));
      }
      let text = pageTexts.join('\n').trim();
      if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
        text = await tryOcrFallback(doc);
      }
      if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
        throw new CvParseError(
          'scanned_pdf',
          'Bu PDF-dən kifayət qədər mətn oxunmadı. DOCX və ya mətn əsaslı PDF yükləyin.',
        );
      }
      return text;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
        throw new CvParseError(
          'scanned_pdf',
          'Bu fayldan kifayət qədər mətn oxunmadı. Mətn əsaslı sənəd yükləyin.',
        );
      }
      return text;
    }
  } catch (err) {
    if (err instanceof CvParseError) throw err;
    throw new CvParseError('parse_failed', 'Fayl oxunarkən xəta baş verdi.');
  }
}

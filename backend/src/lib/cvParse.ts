import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_CV_TEXT_CHARS = 2000; // pasted CV text minimum
export const MIN_EXTRACTED_TEXT_CHARS = 120; // below this a PDF is treated as "scanned / no text layer"

export class CvParseError extends Error {
  code: 'unsupported_type' | 'too_large' | 'scanned_pdf' | 'parse_failed';
  constructor(code: CvParseError['code'], message: string) {
    super(message);
    this.code = code;
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
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = (result.text || '').trim();
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

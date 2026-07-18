import nodemailer from 'nodemailer';

const SUPPORT_EMAIL = 'support@peeky.az';

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export function mailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendFeedbackEmail(params: { category: string; text: string; email: string }): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[mailer] SMTP_HOST not set — skipping feedback email (suggestion is still saved to the database).');
    return;
  }
  const html = `<p><strong>Kateqoriya:</strong> ${escapeHtml(params.category)}</p>
    <p><strong>Göndərən:</strong> ${escapeHtml(params.email)}</p>
    <p><strong>Mətn:</strong></p>
    <p>${escapeHtml(params.text).replace(/\n/g, '<br>')}</p>`;
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || SUPPORT_EMAIL,
      to: SUPPORT_EMAIL,
      replyTo: params.email,
      subject: `PeekMatch təklifi — ${params.category}`,
      html,
    });
  } catch (err) {
    console.error('[mailer] failed to send feedback email', err);
  }
}

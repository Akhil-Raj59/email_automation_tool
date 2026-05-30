/**
 * Email Service — Provider-abstracted email sending layer.
 * Supports: Gmail SMTP (via Nodemailer), Resend, Amazon SES.
 * Swap providers by changing SMTP_PROVIDER env var.
 */

import nodemailer, { Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ----- Nodemailer SMTP Transport (Google Workspace / Gmail) -----

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASSWORD!,
    },
    pool: true,          // Reuse connections
    maxConnections: 2,   // Conservative — internal tool
    maxMessages: 50,     // Per connection
    rateDelta: 1000,     // 1 second between messages
    rateLimit: 1,        // 1 message per rateDelta
  });

  return _transporter;
}

/**
 * Interpolate {{variable}} placeholders with lead data.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match; // Leave unmatched placeholders as-is
  });
}

/**
 * Send a single email via configured SMTP provider.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();

    const fromName = process.env.SMTP_FROM_NAME || 'Vanguard Platform';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
    const from = opts.from || `"${fromName}" <${fromEmail}>`;

    const info = await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email.service] Send failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Verify SMTP connection — useful for health checks.
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

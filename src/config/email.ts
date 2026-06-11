/**
 * Email service — Nodemailer.
 *
 * Sends transactional emails (password reset, etc.).
 * Works with any SMTP provider: Gmail, Outlook, SendGrid, Mailgun, etc.
 *
 * SETUP
 * ─────
 * Add to .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false          (true for port 465, false for 587)
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=your_app_password
 *   EMAIL_FROM=AuraOS <no-reply@yourrestaurant.com>
 *
 * Gmail setup:
 *   1. Enable 2-factor authentication on your Google account
 *   2. Go to Google Account → Security → App Passwords
 *   3. Generate an app password for "Mail"
 *   4. Use that 16-character password as SMTP_PASS
 *
 * SendGrid setup:
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=your_sendgrid_api_key
 *
 * Development (no real email):
 *   Leave SMTP_HOST empty. Emails are logged to the console instead.
 *   Use https://ethereal.email for a free test inbox.
 *
 * SMTP_HOST=smtp.ethereal.email
 * SMTP_PORT=587
 * SMTP_USER=<ethereal username>
 * SMTP_PASS=<ethereal password>
 */

import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@/config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (!env.SMTP_HOST) {
    // No SMTP configured — use a console logger (dev mode)
    console.warn('[Email] SMTP_HOST not set — emails will be logged to console only');
    transporter = nodemailer.createTransport({
      jsonTransport: true,  // logs email as JSON, doesn't send
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host:   env.SMTP_HOST,
    port:   env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email.
 * In development (no SMTP configured), logs the email to console.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const t = getTransporter();

  const mailOptions = {
    from: env.EMAIL_FROM || 'AuraOS <no-reply@auraos.local>',
    to:   options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]+>/g, ''),
  };

  if (!env.SMTP_HOST) {
    // Dev mode — log to console so developers can see the token
    console.log('\n📧 [Email — DEV MODE — not actually sent]');
    console.log(`  To:      ${mailOptions.to}`);
    console.log(`  Subject: ${mailOptions.subject}`);
    console.log(`  Body:    ${mailOptions.text?.slice(0, 300)}`);
    console.log('');
    return;
  }

  await t.sendMail(mailOptions);
}

/**
 * Send a password reset email.
 * The reset link contains the raw token as a query parameter.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
  appUrl: string,
): Promise<void> {
  const resetUrl = `${appUrl}/password-reset?token=${token}`;
  const expiryMinutes = 60;

  await sendEmail({
    to,
    subject: 'Reset your AuraOS password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px; }
          .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .logo { font-size: 24px; font-weight: 700; color: #4f46e5; margin-bottom: 24px; }
          h1 { font-size: 20px; color: #111827; margin: 0 0 8px; }
          p { color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
          .btn { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin: 8px 0 24px; }
          .token-box { background: #f3f4f6; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #111827; text-align: center; margin: 16px 0; }
          .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">AuraOS</div>
          <h1>Reset your password</h1>
          <p>Hi ${name}, we received a request to reset your password.</p>
          <p>Click the button below or copy the token into the app:</p>
          <a href="${resetUrl}" class="btn">Reset Password</a>
          <p>Or enter this token manually:</p>
          <div class="token-box">${token}</div>
          <p>This link expires in <strong>${expiryMinutes} minutes</strong>.</p>
          <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          <div class="footer">
            AuraOS Restaurant POS · This is an automated message, please do not reply.
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Hi ${name},\n\nReset your AuraOS password:\n${resetUrl}\n\nOr enter this token: ${token}\n\nExpires in ${expiryMinutes} minutes.\n\nIf you didn't request this, ignore this email.`,
  });
}

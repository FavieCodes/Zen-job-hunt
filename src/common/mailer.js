require('dotenv').config();
const nodemailer = require('nodemailer');
const logger = require('./logger');

const SMTP_HOST    = process.env.SMTP_HOST;
const SMTP_PORT    = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER    = process.env.SMTP_USER;
const SMTP_PASS    = process.env.SMTP_PASS;
const SMTP_FROM    = process.env.SMTP_FROM || 'noreply@jobhunt.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://job-hunt-frontend-gold.vercel.app';

let transporter  = null;
const emailEnabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

if (emailEnabled) {
  const useSecure = SMTP_PORT === 465;

  transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: useSecure,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  });

  transporter.verify((error) => {
    if (error) {
      logger.error(`[Email] SMTP verification check failed: ${error.message}`);
      logger.error(`[Email] Check your SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in Vercel → Settings → Environment Variables`);
    } else {
      logger.info('[Email] SMTP server is ready to send emails');
    }
  });
} else {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !process.env[k]);
  logger.warn(`[Email] SMTP not configured — missing env vars: ${missing.join(', ')}`);
  logger.warn('[Email] Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM to Vercel → Settings → Environment Variables');
  logger.warn('[Email] Emails will be LOGGED to console but NOT delivered until those vars are set.');
}

// ── Fallback: logs email content so you can debug confirm links locally ────────
const fallbackTransporter = {
  sendMail: async (opts) => {
    logger.info('[Email] ========== EMAIL NOT SENT (SMTP not configured) ==========');
    logger.info(`[Email] To:      ${opts.to}`);
    logger.info(`[Email] Subject: ${opts.subject}`);
    logger.info(`[Email] From:    ${opts.from}`);
    // Log the confirm/reset URL so you can manually test even without SMTP
    const urlMatch = (opts.text || opts.html || '').match(/https?:\/\/\S+token\S+/);
    if (urlMatch) logger.info(`[Email] Link:    ${urlMatch[0]}`);
    logger.info('[Email] =============================================================');
    return { messageId: `fallback-${Date.now()}` };
  },
};

// ── Shared send helper ────────────────────────────────────────────────────────

async function sendMail(opts) {
  const active = transporter || fallbackTransporter;
  try {
    const info = await active.sendMail(opts);
    logger.info(`[Email] Sent "${opts.subject}" to ${opts.to} (id: ${info.messageId})`);
    return true;
  } catch (err) {
    logger.error(`[Email] Failed to send "${opts.subject}" to ${opts.to}: ${err.message}`, { stack: err.stack });
    // Log fallback email content so the confirmation/reset link appears in Vercel logs
    try { await fallbackTransporter.sendMail(opts); } catch {}
    return false;
  }
}

// ── Confirmation email ────────────────────────────────────────────────────────

async function sendConfirmationEmail(to, token) {
  const confirmUrl = `${FRONTEND_URL}/confirm?token=${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Email - JobHunt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6; }
    .wrapper { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #06b6d4 0%, #1e3a8a 100%); color: white; padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 1.6rem; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #06b6d4; color: white !important; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1rem; margin: 24px 0; }
    .url-box { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: .82rem; word-break: break-all; color: #374151; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Welcome to JobHunt! 🎯</h1></div>
    <div class="body">
      <h2 style="margin-top:0;">Confirm your email address</h2>
      <p>Thanks for signing up! Click the button below to activate your account:</p>
      <div style="text-align:center;">
        <a href="${confirmUrl}" class="btn">Confirm My Account</a>
      </div>
      <p style="font-size:.9rem;color:#6b7280;">Or copy this link into your browser:</p>
      <div class="url-box">${confirmUrl}</div>
      <p style="font-size:.85rem;color:#9ca3af;margin-top:20px;">This link expires in <strong>24 hours</strong>. If you didn't create an account, ignore this email.</p>
    </div>
    <div class="footer">&copy; 2026 JobHunt. All rights reserved.</div>
  </div>
</body>
</html>`;

  return sendMail({
    from:    `"JobHunt" <${SMTP_FROM}>`,
    to,
    subject: 'Confirm Your Email — JobHunt',
    html,
    text: `Welcome to JobHunt!\n\nConfirm your email: ${confirmUrl}\n\nExpires in 24 hours.`,
  });
}

// ── Password-reset email ──────────────────────────────────────────────────────

async function sendResetEmail(to, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reset Your Password - JobHunt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f3f4f6; }
    .wrapper { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: #ef4444; color: white; padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 1.6rem; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #ef4444; color: white !important; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1rem; margin: 24px 0; }
    .warn { background: #fef3c7; padding: 14px 16px; border-radius: 6px; border-left: 4px solid #f59e0b; font-size: .9rem; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Password Reset Request</h1></div>
    <div class="body">
      <p>We received a request to reset your JobHunt password.</p>
      <div style="text-align:center;">
        <a href="${resetUrl}" class="btn">Reset My Password</a>
      </div>
      <div class="warn">⚠️ This link expires in <strong>1 hour</strong>. If you didn't request this, ignore the email — your password won't change.</div>
    </div>
    <div class="footer">&copy; 2026 JobHunt. All rights reserved.</div>
  </div>
</body>
</html>`;

  return sendMail({
    from:    `"JobHunt" <${SMTP_FROM}>`,
    to,
    subject: 'Reset Your Password — JobHunt',
    html,
    text: `Reset your JobHunt password: ${resetUrl}\n\nExpires in 1 hour.`,
  });
}

module.exports = { sendConfirmationEmail, sendResetEmail, emailEnabled };
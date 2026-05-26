require('dotenv').config();
const nodemailer = require('nodemailer');
const logger = require('./logger');

// Use SMTP with better error handling
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@jobhunt.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://job-hunt-frontend-pjub.vercel.app';

let transporter;
let emailEnabled = false;

// Create transporter if SMTP is configured
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false 
      },
    });
    
    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        logger.error(`[Email] SMTP connection error: ${error.message}`);
        emailEnabled = false;
      } else {
        logger.info('[Email] SMTP server is ready to send emails');
        emailEnabled = true;
      }
    });
  } catch (error) {
    logger.error(`[Email] Failed to create transporter: ${error.message}`);
    emailEnabled = false;
  }
} else {
  logger.warn('[Email] SMTP not configured. Emails will be logged but not sent.');
  logger.warn(`[Email] SMTP_HOST: ${SMTP_HOST ? 'set' : 'missing'}, SMTP_USER: ${SMTP_USER ? 'set' : 'missing'}, SMTP_PASS: ${SMTP_PASS ? 'set' : 'missing'}`);
}

// Fallback transporter that logs instead of sends
const fallbackTransporter = {
  sendMail: async (opts) => {
    logger.info('[Email] ========== EMAIL WOULD BE SENT ==========');
    logger.info(`[Email] To: ${opts.to}`);
    logger.info(`[Email] Subject: ${opts.subject}`);
    logger.info(`[Email] From: ${opts.from}`);
    logger.info('[Email] ========================================');
    return { messageId: 'fallback-' + Date.now() };
  }
};

async function sendConfirmationEmail(to, token) {
  const confirmUrl = `${FRONTEND_URL}/confirm?token=${encodeURIComponent(token)}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm Your Email - JobHunt</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
        .button:hover { background: #5a67d8; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; margin-top: 20px; }
        .code { background: #e5e7eb; padding: 10px; border-radius: 6px; font-family: monospace; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Welcome to JobHunt! 🎯</h1>
        </div>
        <div class="content">
          <h2>Hello!</h2>
          <p>Thank you for registering with <strong>JobHunt</strong>. We're excited to help you find your next opportunity!</p>
          <p>Please confirm your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${confirmUrl}" class="button" style="color: white; text-decoration: none;">Confirm My Account</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">${confirmUrl}</div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This link will expire in <strong>24 hours</strong>.</p>
          <p style="font-size: 14px; color: #6b7280;">If you didn't create an account with JobHunt, please ignore this email.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 14px;">Best regards,<br /><strong>The JobHunt Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; 2026 JobHunt. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Welcome to JobHunt!\n\nPlease confirm your email by visiting: ${confirmUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, please ignore this email.`;

  const activeTransporter = emailEnabled && transporter ? transporter : fallbackTransporter;
  
  try {
    const info = await activeTransporter.sendMail({
      from: `"JobHunt" <${SMTP_FROM}>`,
      to: to,
      subject: 'Confirm Your Email - JobHunt',
      html: html,
      text: text,
    });
    
    logger.info(`[Email] Confirmation email sent to ${to}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send confirmation email to ${to}: ${error.message}`);
    return false;
  }
}

async function sendResetEmail(to, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Your Password - JobHunt</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; background: #ef4444; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
        .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Password Reset Request</h1>
        </div>
        <div class="content">
          <p>We received a request to reset your password for your JobHunt account.</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button" style="color: white; text-decoration: none;">Reset Password</a>
          </div>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in <strong>1 hour</strong>. If you didn't request this, please ignore this email.
          </div>
          <p>Or copy this link: <span class="code">${resetUrl}</span></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p>Best regards,<br /><strong>The JobHunt Team</strong></p>
        </div>
        <div class="footer">
          <p>&copy; 2026 JobHunt. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const activeTransporter = emailEnabled && transporter ? transporter : fallbackTransporter;
  
  try {
    const info = await activeTransporter.sendMail({
      from: `"JobHunt" <${SMTP_FROM}>`,
      to: to,
      subject: 'Reset Your Password - JobHunt',
      html: html,
      text: `Reset your password by visiting: ${resetUrl}`,
    });
    
    logger.info(`[Email] Reset email sent to ${to}, messageId: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send reset email to ${to}: ${error.message}`);
    return false;
  }
}

module.exports = { sendConfirmationEmail, sendResetEmail, emailEnabled };
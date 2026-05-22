require('dotenv').config();
const nodemailer = require('nodemailer');
const logger = require('./logger');

// Use SMTP
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transporter;
if (SMTP_HOST && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
} else {
  transporter = {
    sendMail: async (opts) => {
      logger.info('Mail (noop) would be sent: ' + JSON.stringify({ to: opts.to, subject: opts.subject }));
      return Promise.resolve();
    }
  };
}

async function sendConfirmationEmail(to, token) {
  const from = SMTP_FROM || 'no-reply@example.com';
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirm?token=${encodeURIComponent(token)}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaec; border-radius: 8px;">
      <h2 style="color: #333; text-align: center;">Welcome to JobHunt!</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Thank you for registering. We're excited to have you on board.
        Please confirm your email address to activate your account and start your job hunt.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          Confirm Account
        </a>
      </div>
      <p style="color: #999; font-size: 14px; text-align: center;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  `;

  await transporter.sendMail({ from, to, subject: 'Confirm your registration - JobHunt', html });
}

async function sendResetEmail(to, token) {
  const from = SMTP_FROM || 'no-reply@example.com';
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `<p>Reset your password by clicking <a href="${url}">here</a></p>`;
  await transporter.sendMail({ from, to, subject: 'Password reset', html });
}

module.exports = { sendConfirmationEmail, sendResetEmail };

const nodemailer = require('nodemailer');
const logger = require('./logger');

// Use SMTP config from env if provided, otherwise create a noop sender that logs
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
  const html = `<p>Confirm your account by clicking <a href="${url}">here</a></p>`;
  await transporter.sendMail({ from, to, subject: 'Confirm your registration', html });
}

async function sendResetEmail(to, token) {
  const from = SMTP_FROM || 'no-reply@example.com';
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `<p>Reset your password by clicking <a href="${url}">here</a></p>`;
  await transporter.sendMail({ from, to, subject: 'Password reset', html });
}

module.exports = { sendConfirmationEmail, sendResetEmail };

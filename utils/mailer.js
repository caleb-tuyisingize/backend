let transporter = null;
try {
  const nodemailer = require('nodemailer');
  // Configure transporter from environment variables if provided
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({ host, port, auth: { user, pass }, secure: process.env.SMTP_SECURE === 'true' });
  }
} catch (e) {
  // nodemailer not installed — we'll fall back to console logging
}

const sendEmail = async ({ to, subject, text, html }) => {
  if (transporter) {
    return transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@safaritix.local', to, subject, text, html });
  }
  // Fallback: log the email
  console.log('mailer: sendEmail fallback — email not sent (no transporter configured)');
  console.log({ to, subject, text, html });
  return Promise.resolve();
};

const sendSMS = async ({ to, text }) => {
  // No SMS provider configured; log for now. Add Twilio integration if needed.
  console.log('mailer: sendSMS fallback — SMS not sent (no provider configured)');
  console.log({ to, text });
  return Promise.resolve();
};

module.exports = { sendEmail, sendSMS };

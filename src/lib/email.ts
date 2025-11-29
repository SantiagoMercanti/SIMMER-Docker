import 'server-only';
import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;
const smtpSecure = process.env.SMTP_SECURE === 'true';

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
  console.warn('[email] Faltan variables SMTP en el entorno');
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: Number(smtpPort ?? 587),
  secure: smtpSecure, // true para 465, false para 587 (STARTTLS)
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

type SendMailParams = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export async function sendMail({ to, subject, text, html }: SendMailParams) {
  if (!smtpFrom) {
    throw new Error('SMTP_FROM no está configurado');
  }

  // Pequeña validación básica
  if (!to || !subject) {
    throw new Error('to y subject son obligatorios');
  }

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
}

import nodemailer from 'nodemailer';

// Outgoing email for subscription reminders. The From address is
// environment-dependent: local/dev sends from the personal Gmail account,
// production sends from the Gateverse domain mailbox. EMAIL_FROM overrides
// both when set.
const DEV_FROM = 'Gateverse <ahmedmahmoudtech@gmail.com>';
const PROD_FROM = 'Gateverse <contact@gateverse.tech>';

const FROM =
  process.env.EMAIL_FROM ||
  (process.env.NODE_ENV === 'production' ? PROD_FROM : DEV_FROM);

let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
} else {
  console.warn(
    '[mailer] SMTP_USER/SMTP_PASS not set — outgoing email disabled (admin notifications still work)'
  );
}

export const mailerEnabled = () => Boolean(transporter);

// Returns true when the message was handed to the SMTP server; false when
// the mailer is disabled. SMTP errors propagate to the caller.
export async function sendMail({ to, subject, html, text }) {
  if (!transporter) return false;
  await transporter.sendMail({ from: FROM, to, subject, html, text });
  return true;
}

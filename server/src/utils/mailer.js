import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Outgoing email for subscription reminders. The From address is
// environment-dependent: local/dev sends from the personal Gmail account,
// production sends from the Gateverse domain mailbox. EMAIL_FROM overrides
// both when set (production does set it).
//
// Keep PROD_FROM on gateverse.NET: production relays through Brevo, which
// rejects any sender outside the domain it has authenticated. A .tech/.com
// address here silently fails every reminder.
const DEV_FROM = 'Gateverse <ahmedmahmoudtech@gmail.com>';
const PROD_FROM = 'Gateverse <contact@gateverse.net>';

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

// ─── Brand logo ───────────────────────────────────────────────────────────────
// Embedded as a CID attachment rather than an <img src="https://…">: most
// clients (Gmail, Outlook) block remote images by default, so a hosted URL
// would leave a broken box in the header. CID art always renders, and it
// keeps the email working even if the site is down.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOGO_CID = 'gateverse-logo';
const LOGO_PATH = path.join(__dirname, '../assets/email-logo.png');

// Resolved once at startup. If the asset is missing (e.g. it never got
// committed, so `git archive` left it out of a deploy) we send the email
// WITHOUT the logo rather than throwing — a reminder with a broken header
// still does its job; a reminder that never arrives does not.
const logoExists = fs.existsSync(LOGO_PATH);
if (!logoExists) {
  console.warn(`[mailer] logo missing at ${LOGO_PATH} — emails will send without it`);
}

const logoAttachment = () => ({
  filename: 'gateverse-logo.png',
  path: LOGO_PATH,
  cid: LOGO_CID,
  contentDisposition: 'inline',
});

/**
 * Returns true when the message was handed to the SMTP server; false when
 * the mailer is disabled. SMTP errors propagate to the caller.
 * The brand logo is attached automatically — reference it in `html` as
 * <img src="cid:gateverse-logo">. Pass `logo: false` to omit it.
 */
export async function sendMail({ to, subject, html, text, logo = true }) {
  if (!transporter) return false;
  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    html,
    text,
    ...(logo && logoExists ? { attachments: [logoAttachment()] } : {}),
  });
  return true;
}

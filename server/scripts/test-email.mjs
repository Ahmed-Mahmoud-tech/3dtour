#!/usr/bin/env node
/**
 * Checks the outgoing-mail path and previews the subscription reminder emails.
 *
 *   node scripts/test-email.mjs                      # config + SMTP handshake only
 *   node scripts/test-email.mjs --preview            # also print all 6 rendered emails
 *   node scripts/test-email.mjs --send you@mail.com  # actually send one real test
 *
 * --send is the only mode that puts mail on the wire; everything else is
 * read-only, so it is safe to run against production.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const sendTo = argv.includes('--send') ? argv[argv.indexOf('--send') + 1] : null;
const preview = argv.includes('--preview');

// ── 1. Config ────────────────────────────────────────────────────────────────
const port = Number(process.env.SMTP_PORT) || 465;
const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const enabled = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const from =
  process.env.EMAIL_FROM ||
  (process.env.NODE_ENV === 'production'
    ? 'Gateverse <contact@gateverse.net>'
    : 'Gateverse <ahmedmahmoudtech@gmail.com>');

console.log('── mail config ──────────────────────────────────');
console.log('  NODE_ENV   :', process.env.NODE_ENV || '(unset → dev)');
console.log('  host:port  :', `${host}:${port}`, `(secure=${port === 465})`);
console.log('  SMTP_USER  :', enabled ? 'set' : 'MISSING');
console.log('  SMTP_PASS  :', process.env.SMTP_PASS ? 'set' : 'MISSING');
console.log('  From       :', from);
console.log('  mailer     :', enabled ? 'ENABLED' : 'DISABLED (reminders will not email)');

if (!enabled) {
  console.error('\nSet SMTP_USER and SMTP_PASS in server/.env, then re-run.');
  process.exit(1);
}

// ── 2. SMTP handshake (no mail sent) ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

console.log('\n── SMTP handshake ───────────────────────────────');
try {
  await transporter.verify();
  console.log('  OK — server accepted the credentials.');
} catch (err) {
  console.error('  FAILED —', err.message);
  process.exit(1);
}

// ── 3. Render the real templates ─────────────────────────────────────────────
// ownerEmailContent is module-private, so load the job source with its imports
// stripped rather than duplicating the copy here (it would drift).
const jobSrc = (
  await readFile(path.join(__dirname, '../src/jobs/subscriptionReminders.js'), 'utf8')
)
  .replace(/^import .*$/gm, '')
  .concat('\nexport { ownerEmailContent };\n');

const { ownerEmailContent } = await import(
  'data:text/javascript;base64,' + Buffer.from(jobSrc, 'utf8').toString('base64')
);

const DAY = 24 * 60 * 60 * 1000;
const CASES = [
  ['expiry_7d', () => new Date(Date.now() + 7 * DAY)],
  ['expiry_1d', () => new Date(Date.now() + 1 * DAY)],
  ['expired', () => new Date(Date.now() - 2 * DAY)],
];

if (preview) {
  console.log('\n── rendered templates ───────────────────────────');
  for (const lang of ['ar', 'en']) {
    for (const [key, at] of CASES) {
      const { subject, text } = ownerEmailContent(key, 'Demo Tour', at(), lang);
      console.log(`\n[${lang} / ${key}]`);
      console.log('  subject:', subject);
      console.log('  body   :', text);
    }
  }
}

// ── 4. Optional real send ────────────────────────────────────────────────────
if (sendTo) {
  console.log(`\n── sending a real test email to ${sendTo} ───────`);
  for (const lang of ['ar', 'en']) {
    const { subject, html, text } = ownerEmailContent('expiry_7d', 'Test Tour', CASES[0][1](), lang);
    await transporter.sendMail({ from, to: sendTo, subject: `[TEST ${lang}] ${subject}`, html, text });
    console.log(`  sent (${lang}).`);
  }
  console.log('  Check the inbox — Arabic should render right-to-left.');
} else {
  console.log('\nNo mail was sent. Pass --send <address> to deliver a real test.');
}

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
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
// The real send path, so a test exercises the same code production runs
// (including the CID logo attachment).
import { sendMail, mailerEnabled, LOGO_CID } from '../src/utils/mailer.js';

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
// gateverse.net has no MX record, so replies to From bounce unless this is set.
console.log(
  '  Reply-To   :',
  process.env.EMAIL_REPLY_TO || 'UNSET — client replies will bounce (see ops/email-deliverability.md)'
);
console.log('  mailer     :', mailerEnabled() ? 'ENABLED' : 'DISABLED (reminders will not email)');

// The logo is attached from disk at send time — a missing file throws mid-send
// and loses the reminder, so check it up front.
const logoPath = path.join(__dirname, '../src/assets/email-logo.png');
try {
  const { size } = await stat(logoPath);
  console.log('  logo       :', `OK (${size} bytes, cid:${LOGO_CID})`);
} catch {
  console.log('  logo       :', `MISSING at ${logoPath} — emails would fail to send`);
}

// Rendering the templates needs no SMTP, so --preview still works on a dev
// box with no credentials; only an actual send requires them.
if (!enabled && sendTo) {
  console.error('\nCannot send: set SMTP_USER and SMTP_PASS in server/.env, then re-run.');
  process.exit(1);
}

// ── 2. SMTP handshake (no mail sent) ─────────────────────────────────────────
if (enabled) {
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
}

// ── 3. Render the real templates ─────────────────────────────────────────────
// ownerEmailContent is module-private, so load the job source with its imports
// stripped rather than duplicating the copy here (it would drift).
const jobSrc = `const LOGO_CID = ${JSON.stringify(LOGO_CID)};\n`.concat(
  (await readFile(path.join(__dirname, '../src/jobs/subscriptionReminders.js'), 'utf8'))
    .replace(/^import .*$/gm, '')
    .concat('\nexport { ownerEmailContent };\n')
);

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
      console.log('  body   :', text.replace(/\n/g, '\n           '));
    }
  }

  // Also drop the HTML to disk so the header/logo can be eyeballed in a
  // browser. cid: images don't resolve outside a mail client, so swap in the
  // real file for the preview only.
  const out = argv.includes('--html') ? argv[argv.indexOf('--html') + 1] : null;
  if (out) {
    const parts = [];
    for (const lang of ['ar', 'en']) {
      for (const [key, at] of CASES) {
        const { subject, html } = ownerEmailContent(key, 'Demo Tour', at(), lang);
        parts.push(
          `<p style="font:12px monospace;color:#888;margin:24px 0 4px">${lang}/${key} — ${subject}</p>`,
          html.replace(`cid:${LOGO_CID}`, path.resolve(logoPath).replace(/\\/g, '/'))
        );
      }
    }
    const { writeFile } = await import('node:fs/promises');
    await writeFile(out, `<body style="background:#e5e7eb;padding:20px">${parts.join('')}</body>`);
    console.log(`\n  HTML preview written to ${out}`);
  }
}

// ── 4. Optional real send ────────────────────────────────────────────────────
if (sendTo) {
  console.log(`\n── sending real test emails to ${sendTo} ───────`);
  // One per language × threshold, so every template gets eyeballed in a
  // real client. Goes through sendMail() — same path as the hourly job.
  for (const lang of ['ar', 'en']) {
    for (const [key, at] of CASES) {
      const { subject, html, text } = ownerEmailContent(key, 'Test Tour', at(), lang);
      const info = await sendMail({
        to: sendTo,
        subject: `[TEST ${lang}/${key}] ${subject}`,
        html,
        text,
      });
      // Print the relay's id — "accepted" is not "delivered", and this is the
      // handle for finding the message in the Brevo transactional log.
      console.log(`  sent  ${lang}/${key}`.padEnd(24), info.messageId, '|', info.response);
    }
  }
  console.log(`\n  ${2 * CASES.length} emails delivered. Check the inbox:`);
  console.log('   - the Gateverse logo should show in the header (no "load images" prompt)');
  console.log('   - Arabic copy should read right-to-left with Latin-digit dates');
} else {
  console.log('\nNo mail was sent. Pass --send <address> to deliver a real test.');
}

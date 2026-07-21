import Subscription from '../models/Subscription.js';
import Notification from '../models/Notification.js';
import { sendMail, mailerEnabled, LOGO_CID } from '../utils/mailer.js';

const DAY = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL = 60 * 60 * 1000; // hourly; remindersSent dedups

// Ordered least → most urgent. A subscription created (or first seen) with
// only 1 day left gets one 'expiry_1d' reminder, not the whole ladder —
// every crossed threshold is recorded, only the most urgent one is sent.
const THRESHOLDS = [
  { key: 'expiry_7d', msBefore: 7 * DAY },
  { key: 'expiry_1d', msBefore: 1 * DAY },
  { key: 'expired', msBefore: 0 },
];

// Don't backfill 'expired' reminders for subscriptions that lapsed long
// before this job existed (or while the server was down for weeks).
const EXPIRED_BACKFILL_WINDOW = 14 * DAY;

// Admin-facing dates (notifications) stay English; owner emails use the
// locale matching the owner's chosen language.
const fmtDate = (d, locale = 'en-GB') =>
  new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

// Tour titles are staff-authored free text — escape before embedding in HTML
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Inverse pair, used only to build the plain-text alternative of a rendered
// line. `&amp;` must be decoded last or "&amp;lt;" would double-decode.
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const unescapeHtml = (s) =>
  String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// One entry per supported owner language. `dir`/`locale` drive the HTML
// wrapper; the copy functions take the escaped title + formatted date.
const LOCALES = {
  en: {
    dir: 'ltr',
    locale: 'en-GB',
    subject: (key, title, days) =>
      key === 'expired'
        ? `Your Gateverse tour subscription has expired — ${title}`
        : key === 'expiry_1d'
          ? `Your Gateverse tour subscription expires tomorrow — ${title}`
          : `Your Gateverse tour subscription expires in ${days} days — ${title}`,
    lead: (key, title, date) =>
      key === 'expired'
        ? `The subscription for your virtual tour <strong>${title}</strong> expired on <strong>${date}</strong>. Your tour stays online during a short grace period — please renew soon to avoid interruption.`
        : `The subscription for your virtual tour <strong>${title}</strong> expires on <strong>${date}</strong>.`,
    cta: `To renew your subscription, simply reply to this email or contact us and we'll take care of it.`,
    signature: '— The Gateverse team',
  },
  ar: {
    dir: 'rtl',
    // -u-nu-latn keeps Latin digits (٢٨ → 28); Egyptian usage is Latin numerals
    locale: 'ar-EG-u-nu-latn',
    subject: (key, title, days) =>
      key === 'expired'
        ? `انتهى اشتراك جولتك على Gateverse — ${title}`
        : key === 'expiry_1d'
          ? `اشتراك جولتك على Gateverse ينتهي غدًا — ${title}`
          : `اشتراك جولتك على Gateverse ينتهي خلال ${days} أيام — ${title}`,
    lead: (key, title, date) =>
      key === 'expired'
        ? `انتهى اشتراك جولتك الافتراضية <strong>${title}</strong> بتاريخ <strong>${date}</strong>. جولتك ما زالت متاحة خلال فترة سماح قصيرة — برجاء التجديد قريبًا لتفادي توقف الخدمة.`
        : `اشتراك جولتك الافتراضية <strong>${title}</strong> ينتهي بتاريخ <strong>${date}</strong>.`,
    cta: `لتجديد الاشتراك، يكفي الرد على هذه الرسالة أو التواصل معنا وسنتولى الأمر.`,
    signature: '— فريق Gateverse',
  },
};

const ownerEmailContent = (key, rawTitle, expiresAt, lang = 'ar') => {
  const L = LOCALES[lang] || LOCALES.ar;
  const date = fmtDate(expiresAt, L.locale);
  const tourTitle = escapeHtml(rawTitle);
  const daysLeft = Math.max(Math.ceil((new Date(expiresAt) - Date.now()) / DAY), 0);

  // Subject is a plain-text header — use the raw title there
  const subject = L.subject(key, rawTitle, daysLeft);
  const lead = L.lead(key, tourTitle, date);

  const align = L.dir === 'rtl' ? 'right' : 'left';
  // Header = the brand lockup: planet mark + "Gate" (white) / "verse" (teal),
  // the same split the site header uses (client/src/landing/LandingView.jsx).
  // The mark is a CID attachment (see utils/mailer.js) so it renders even with
  // remote images blocked; the wordmark is live HTML text rather than baked
  // into the image, so it stays sharp on every screen and survives an
  // images-off client. That white text needs the dark band behind it —
  // bgcolor on the <td> (not a CSS background) is what Outlook honours.
  // The lockup stays LTR in both languages: it's a brand name, not copy.
  const html = `
  <div dir="${L.dir}" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
      <tr>
        <td bgcolor="#070d13" style="background-color:#070d13;padding:18px 24px" dir="ltr">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px">
                <img src="cid:${LOGO_CID}" width="34" height="34" alt=""
                     style="display:block;width:34px;height:34px;border:0;outline:none" />
              </td>
              <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:23px;font-weight:bold;letter-spacing:-0.2px;white-space:nowrap">
                <span style="color:#ffffff">Gate</span><span style="color:#10c9b7">verse</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;text-align:${align}">
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${lead}</p>
          <p style="font-size:15px;line-height:1.6;margin:0">${L.cta}</p>
          <p style="font-size:13px;color:#6b7280;margin:32px 0 0">${L.signature}</p>
        </td>
      </tr>
    </table>
  </div>`;

  // Plain-text alternative, built from the copy directly rather than scraped
  // out of the HTML: the wordmark is two adjacent spans, so tag-stripping
  // would emit "Gate verse", and the escaped title would leak "&amp;".
  const text = ['Gateverse', '', unescapeHtml(stripTags(lead)), '', L.cta, '', L.signature].join(
    '\n'
  );

  return { subject, html, text };
};

const processSubscription = async (sub) => {
  const now = Date.now();
  const expiresAt = new Date(sub.expiresAt).getTime();

  const crossed = THRESHOLDS.filter((t) => now >= expiresAt - t.msBefore).map((t) => t.key);
  const unsent = crossed.filter((k) => !sub.remindersSent.includes(k));
  if (unsent.length === 0) return;

  // Skip ancient expiries silently (first deploy / long downtime).
  if (crossed.includes('expired') && now - expiresAt > EXPIRED_BACKFILL_WINDOW) {
    sub.remindersSent = [...new Set([...sub.remindersSent, ...crossed])];
    await sub.save();
    return;
  }

  const key = unsent[unsent.length - 1]; // most urgent unsent threshold
  const project = sub.project; // populated
  const tourTitle = project?.info?.title || 'Untitled tour';
  const owner = project?.owner; // populated User or null

  // 1) Email the owner (if there is one and the mailer is configured)
  let emailNote = 'No owner assigned — no email sent.';
  if (owner?.email) {
    if (!mailerEnabled()) {
      emailNote = `Email NOT sent to ${owner.email} (mailer not configured).`;
    } else {
      try {
        const lang = owner.language === 'en' ? 'en' : 'ar';
        const { subject, html, text } = ownerEmailContent(key, tourTitle, sub.expiresAt, lang);
        await sendMail({ to: owner.email, subject, html, text });
        emailNote = `Reminder email sent to ${owner.email} (${lang}).`;
      } catch (err) {
        emailNote = `Email to ${owner.email} FAILED: ${err.message}`;
        console.error(`[subscriptionReminders] email failed for sub ${sub._id}:`, err.message);
      }
    }
  }

  // 2) In-app notification for the admin team
  const expired = key === 'expired';
  await Notification.create({
    type: expired ? 'subscription_expired' : 'subscription_expiring',
    title: expired
      ? `Subscription expired: ${tourTitle}`
      : `Subscription expiring ${key === 'expiry_1d' ? 'tomorrow' : 'soon'}: ${tourTitle}`,
    body: `${
      owner
        ? `Owner: ${owner.name} <${owner.email}>${owner.phone ? ` · ${owner.phone}` : ''}. `
        : ''
    }Plan: ${sub.plan}. ${
      expired ? 'Expired' : 'Expires'
    } ${fmtDate(sub.expiresAt)}. ${emailNote}`,
    project: project?._id || null,
  });

  // 3) Record every crossed threshold so lower rungs never fire late
  sub.remindersSent = [...new Set([...sub.remindersSent, ...crossed])];
  await sub.save();
};

export const runSubscriptionReminders = async () => {
  try {
    const subs = await Subscription.find({
      status: 'active',
      expiresAt: { $lt: new Date(Date.now() + 7 * DAY) },
    }).populate({
      path: 'project',
      select: 'info.title owner',
      populate: { path: 'owner', select: 'name email language phone' },
    });

    for (const sub of subs) {
      try {
        await processSubscription(sub);
      } catch (err) {
        console.error(`[subscriptionReminders] sub ${sub._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[subscriptionReminders] sweep failed:', err.message);
  }
};

// Called once from index.js after the DB connection is initiated. The first
// sweep is delayed a few seconds so Mongoose has connected.
export const startSubscriptionReminderJob = () => {
  setTimeout(runSubscriptionReminders, 10 * 1000);
  setInterval(runSubscriptionReminders, CHECK_INTERVAL);
};

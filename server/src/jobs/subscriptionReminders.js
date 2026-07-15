import Subscription from '../models/Subscription.js';
import Notification from '../models/Notification.js';
import { sendMail, mailerEnabled } from '../utils/mailer.js';

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

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const ownerEmailContent = (key, tourTitle, expiresAt) => {
  const date = fmtDate(expiresAt);
  const daysLeft = Math.max(Math.ceil((new Date(expiresAt) - Date.now()) / DAY), 0);

  const subject =
    key === 'expired'
      ? `Your Gateverse tour subscription has expired — ${tourTitle}`
      : key === 'expiry_1d'
        ? `Your Gateverse tour subscription expires tomorrow — ${tourTitle}`
        : `Your Gateverse tour subscription expires in ${daysLeft} days — ${tourTitle}`;

  const lead =
    key === 'expired'
      ? `The subscription for your virtual tour <strong>${tourTitle}</strong> expired on <strong>${date}</strong>. Your tour stays online during a short grace period — please renew soon to avoid interruption.`
      : `The subscription for your virtual tour <strong>${tourTitle}</strong> expires on <strong>${date}</strong>.`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
    <h2 style="color:#0d9488;margin:0 0 16px">Gateverse</h2>
    <p style="font-size:15px;line-height:1.6">${lead}</p>
    <p style="font-size:15px;line-height:1.6">To renew your subscription, simply reply to this email or contact us and we'll take care of it.</p>
    <p style="font-size:13px;color:#6b7280;margin-top:32px">— The Gateverse team</p>
  </div>`;

  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
        const { subject, html, text } = ownerEmailContent(key, tourTitle, sub.expiresAt);
        await sendMail({ to: owner.email, subject, html, text });
        emailNote = `Reminder email sent to ${owner.email}.`;
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
    body: `${owner ? `Owner: ${owner.name} <${owner.email}>. ` : ''}Plan: ${sub.plan}. ${
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
      populate: { path: 'owner', select: 'name email' },
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

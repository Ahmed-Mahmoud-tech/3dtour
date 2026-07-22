# Email deliverability — gateverse.net

Subscription reminders ([server/src/jobs/subscriptionReminders.js](../server/src/jobs/subscriptionReminders.js))
are the recurring-revenue mechanism: if they land in spam, renewals quietly stop.
This is the DNS + config checklist that keeps them in the inbox.

Production relays through **Brevo**, and Brevo only accepts `gateverse.net` as a
sender — see the `PROD_FROM` note in [mailer.js](../server/src/utils/mailer.js).

## Audited state — 2026-07-22 (queried against 1.1.1.1)

| Record | Status | Value found |
| --- | --- | --- |
| Brevo domain verification | ✅ present | `brevo-code:a166ee687519c1b37717ef565cc72f94` |
| DKIM `brevo1._domainkey` | ✅ present | RSA public key |
| DKIM `brevo2._domainkey` | ✅ present | RSA public key |
| DMARC `_dmarc` | ⚠️ monitor-only | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| **SPF** | ❌ **missing** | — only the brevo-code TXT exists |
| **MX** | ❌ **missing** | replies to `contact@gateverse.net` bounce |

DNS is hosted on Cloudflare (the apex A records are Cloudflare proxy IPs), so
every change below is made in the Cloudflare dashboard for the zone.

## Fix 1 — add SPF (required)

Without SPF, receivers that don't evaluate DKIM see an unauthenticated sender.
Add **one** TXT record:

| Field | Value |
| --- | --- |
| Type | `TXT` |
| Name | `@` |
| Content | `v=spf1 include:spf.brevo.com ~all` |

`spf.brevo.com` was verified to resolve to Brevo's sending ranges. Use `~all`
(softfail) rather than `-all` until the setup is confirmed working.

> **A domain may publish only ONE SPF record.** Two `v=spf1` TXT records is a
> permerror and authentication fails outright — worse than having none. If you
> later enable a service that asks you to add its own SPF, merge the includes
> into the single record instead of adding a second one (see Fix 2).

## Fix 2 — make the domain receive mail (MX)

Every reminder tells the client to *"just reply to this email"*, but with no MX
record their reply bounces. Cheapest correct fix is **Cloudflare Email Routing**
(free) forwarding `contact@gateverse.net` to a real mailbox:

1. Cloudflare dashboard → the `gateverse.net` zone → **Email** → **Email Routing** → enable.
2. Add a custom address: `contact@gateverse.net` → forward to your Gmail.
3. Confirm the verification mail Cloudflare sends to that Gmail.
4. Cloudflare adds the required `route1/2/3.mx.cloudflare.net` MX records itself.

⚠️ **The SPF collision.** Cloudflare will offer to add
`v=spf1 include:_spf.mx.cloudflare.net ~all`. Do **not** let it create a second
SPF record next to the Brevo one. Keep exactly one, containing both includes:

```
v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all
```

## Fix 3 — reply-to fallback (works immediately, no DNS wait)

`sendMail` already supports a reply-to override. Until MX is live — and as a
permanent safety net — point replies at a mailbox that exists. On the VPS:

```bash
ssh <vps>
nano /var/www/photovideo360/server/.env     # add the line below
#   EMAIL_REPLY_TO=ahmedmahmoudtech@gmail.com
pm2 restart photovideo360-server
pm2 logs photovideo360-server --lines 30    # the mailer warning should be gone
```

The file is carried across deploys by [remote-deploy-pm2.sh](deploy/remote-deploy-pm2.sh),
so this survives future releases. Unset, the server logs
`[mailer] EMAIL_REPLY_TO not set — client replies to reminders may bounce` at boot.

## Fix 4 — tighten DMARC (only after 1–3 are verified)

DMARC is currently `p=none`, which reports but enforces nothing. Once SPF is
live and a test message shows `dkim=pass` and `spf=pass`, raise it to:

```
v=DMARC1; p=quarantine; rua=mailto:rua@dmarc.brevo.com
```

Reports go to Brevo — read them in the Brevo dashboard. Don't point `rua` at a
Gmail address: cross-domain reporting needs an authorization record at the
receiving domain, which you can't add to `gmail.com`.

## Verifying

Check the records from a machine (PowerShell, bypassing local resolver cache):

```powershell
Resolve-DnsName gateverse.net -Type TXT -Server 1.1.1.1 | ForEach-Object { $_.Strings }
Resolve-DnsName gateverse.net -Type MX  -Server 1.1.1.1
Resolve-DnsName _dmarc.gateverse.net -Type TXT -Server 1.1.1.1 | ForEach-Object { $_.Strings }
```

Check the app side — config + SMTP handshake, sends nothing:

```bash
cd server && node scripts/test-email.mjs
node scripts/test-email.mjs --preview          # render all templates
node scripts/test-email.mjs --send you@gmail.com
```

End-to-end: send a real test to a Gmail address, open it, then
**Show original**. You want `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Replying
to that message must land in the forwarding mailbox, not bounce.

`sendMail` returns `{ messageId, response }` — that id is the handle for
tracing a "never arrived" report in Brevo's transactional log.

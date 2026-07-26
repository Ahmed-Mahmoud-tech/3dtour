# Email deliverability — gateverse.net

Subscription reminders ([server/src/jobs/subscriptionReminders.js](../server/src/jobs/subscriptionReminders.js))
are the recurring-revenue mechanism: if they land in spam, renewals quietly stop.
This is the DNS + config checklist that keeps them in the inbox.

Production relays through **Brevo**, and Brevo only accepts `gateverse.net` as a
sender — see the `PROD_FROM` note in [mailer.js](../server/src/utils/mailer.js).

## Audited state — 2026-07-26 ✅ all green

Queried against **both** authoritative nameservers (`kara`/`kenneth.ns.cloudflare.com`),
not a cache:

| Record | Status | Value |
| --- | --- | --- |
| Brevo domain verification | ✅ | `brevo-code:a166ee687519c1b37717ef565cc72f94` |
| DKIM `brevo1._domainkey` | ✅ | CNAME → `b1.gateverse-net.dkim.brevo.com` |
| DKIM `brevo2._domainkey` | ✅ | CNAME → `b2.gateverse-net.dkim.brevo.com` |
| **SPF** (single TXT) | ✅ | `v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all` |
| **MX** | ✅ | `route1/2/3.mx.cloudflare.net` (Cloudflare Email Routing, enabled) |
| DMARC `_dmarc` | ⚠️ monitor-only | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

**Where the records live.** The domain is registered at **Spaceship** and the app
is hosted on the **Contabo VPS**, but the nameservers are Cloudflare's — so every
DNS record, mail included, is edited in the Cloudflare dashboard for the zone.
Spaceship's DNS panel has no effect while the nameservers point at Cloudflare.

## ⚠️ The SPF record is the fragile part — read before touching Email Routing

A domain may publish only **ONE** `v=spf1` TXT record. Two is a permerror and
authentication fails outright, which is worse than having none. Ours must carry
**both** includes in that single record:

```
v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all
```

- `include:spf.brevo.com` — authorises Brevo, which **sends** the reminders.
  Without it Brevo mail softfails SPF (it survives on DKIM alone).
- `include:_spf.mx.cloudflare.net` — authorises Email Routing, which **forwards**
  inbound mail.

**Email Routing's blue "Add missing records" button rewrites this record to the
Cloudflare-only value**, silently dropping Brevo (this happened on 2026-07-26 and
again by hand while fixing it). After any change in Cloudflare's Email panel,
re-verify with the authoritative query below and re-merge if needed. Fix 1 (SPF)
and Fix 2 (MX) below are both **already applied** — they are kept as the recovery
procedure if a record is ever lost.

## Fix 1 — SPF ✅ applied

| Field | Value |
| --- | --- |
| Type | `TXT` |
| Name | `@` |
| Content | `v=spf1 include:spf.brevo.com include:_spf.mx.cloudflare.net ~all` |

`spf.brevo.com` resolves to Brevo's sending ranges (verified). `~all` (softfail)
rather than `-all` until the setup has run clean for a while.

## Fix 2 — inbound mail (MX) ✅ applied

Every reminder tells the client to *"just reply to this email"*. **Cloudflare
Email Routing** (free) forwards `contact@gateverse.net` to a real mailbox:

1. Cloudflare dashboard → the `gateverse.net` zone → **Email** → **Email Routing**.
2. **Destination Addresses** → add the Gmail → click the verification link it mails you.
3. **Routing rules** → custom address `contact@gateverse.net` → send to that Gmail.
4. **Settings → Add missing records** → adds the three `route*.mx.cloudflare.net`
   MX records plus a `cf2024-1._domainkey` DKIM TXT (no conflict with Brevo's).
5. **Immediately re-merge the SPF record** — step 4 overwrites it (see the warning above).

## Fix 3 — reply-to fallback ✅ handled in code (2026-07-26)

[mailer.js](../server/src/utils/mailer.js) now **defaults `Reply-To` to
`ahmedmahmoudtech@gmail.com`** whenever `EMAIL_REPLY_TO` is unset, so client
replies land in the team Gmail with no VPS action — the fix ships with the next
deploy. To point replies elsewhere (e.g. `contact@gateverse.net` once Fix 2's
MX records are live and forwarding works), override on the VPS:

```bash
ssh <vps>
nano /var/www/photovideo360/server/.env     # add the line below
#   EMAIL_REPLY_TO=contact@gateverse.net
pm2 restart photovideo360-server
```

The file is carried across deploys by [remote-deploy-pm2.sh](deploy/remote-deploy-pm2.sh),
so an override survives future releases.

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

Ask an **authoritative** nameserver, not a resolver: a Cloudflare edit is live on
`kara`/`kenneth.ns.cloudflare.com` within seconds, so if the old value still comes
back from there the change did not save — it is never "propagation delay". Public
resolvers (1.1.1.1, 8.8.8.8) can lag by the record TTL and will mislead you.

```powershell
(Resolve-DnsName gateverse.net -Type TXT -Server kara.ns.cloudflare.com).Strings
(Resolve-DnsName gateverse.net -Type MX  -Server kara.ns.cloudflare.com) |
  ForEach-Object { "$($_.Preference) $($_.NameExchange)" }
(Resolve-DnsName _dmarc.gateverse.net -Type TXT -Server 1.1.1.1).Strings
```

Expect exactly ONE `v=spf1` line, and it must contain `include:spf.brevo.com`.

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

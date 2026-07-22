---
name: social-post
description: Create Gateverse social posts (Arabic-first) for Facebook & Instagram — captions, hashtags, square/carousel creatives built from real tour panoramas, and optional publishing via the Meta Graph API. Use when asked for بوستات، سوشيال، فيسبوك، انستجرام، محتوى تسويقي، caption, reel cover, or a content calendar.
---

# Gateverse social posts

Produce post-ready Arabic content + creatives for Gateverse's Facebook Page and Instagram
Business account. Publishing is optional and only runs when tokens exist (see below).

## Brand facts — never invent alternatives

Pull live values from `client/src/landing/content.js` (`STRINGS.ar`, `PORTFOLIO`, `CONTACT`,
`WHATSAPP_NUMBER`) rather than hardcoding. As of this writing:

- Name: **جيت فيرس / Gateverse** · gateverse.net · contact@gateverse.net · WhatsApp `01113232886`
- Positioning: **جولات ٣٦٠° سينمائية — تصوير حقيقي متصل، مش صور متلزّقة.** The differentiator is
  the *filmed walk between rooms*, not the panoramas.
- Service area: الإسكندرية + الساحل الشمالي (باقي مصر بالطلب). Done-for-you agency — the client
  never uploads anything.
- Packages: الأساسية ٥٬٩٠٠ · الاحترافية ١٠٬٩٠٠ · المتميزة ٢٢٬٩٠٠ ج.م (تصوير مرة واحدة + سنة استضافة).
  Renewal 500 / 1,000 / 2,000 ج.م سنويًا. Never quote the older 4,900/12,900/19,900 numbers still
  commented out at the top of `content.js`.
- Colors: teal `#10c9b7` / bright `#3ef0dd` on near-black `#07100E`. Logo: `client/public/gateverse-logo.png`.

## Voice

Egyptian colloquial Arabic, short lines, second person, no corporate filler. Lead with the client's
problem, not the technology. One idea per post. Latin/technical words only where Egyptians actually
use them (لينك، واتساب، QR). English versions are secondary — write them only if asked.

## Honesty rules — hard limits

- **No fabricated testimonials, client names, or results.** The quotes in `content.js` are still
  placeholders; treat them as unusable until the user confirms a real client said them, on the record.
- No invented numbers (visit counts, conversion rates, "٣× مبيعات"). Claims must trace to something
  real: the pricing table, delivery times, or the tour's own analytics.
- Photos of real client spaces need the client's permission — ask before using anything from
  `server/uploads/`. Demo renders in `client/public/panos/` are always safe.

## Post archetypes (rotate — don't post the same shape twice in a row)

| # | Archetype | Job |
|---|---|---|
| 1 | الهوك / awareness | صورة كاملة + جملة واحدة توقف السكرول |
| 2 | المقارنة | صورة ثابتة ضد جولة — الفرق البصري نفسه هو الإعلان |
| 3 | حالة استخدام قطاعية | كافيه / قاعة / عيادة / عقار — سؤال العميل الحقيقي |
| 4 | تعليمي (كاروسيل) | ٣–٥ سلايدات، خطأ شائع أو خطوات |
| 5 | العرض | الباقات + CTA واتساب |
| 6 | خلف الكواليس | التصوير نفسه — أعلى تفاعل وأقل تكلفة إنتاج |

## Caption formula

```
سطر أول = الهوك (٦ كلمات أو أقل، من غير اسم البراند)
سطرين–أربعة = المشكلة ثم الحل، سطر واحد لكل فكرة
سطر CTA = فعل واحد واضح (احجز واتساب / اللينك في البايو / ابعتلنا)
📍 إسكندرية والساحل الشمالي · 📲 01113232886
٥–٩ هاشتاجات
```

Hashtag pool — mix 3 Arabic local + 2 English + 1 branded:
`#جولة_افتراضية #تصوير_360 #عقارات_الاسكندرية #الساحل_الشمالي #قاعات_افراح #كافيهات_اسكندرية`
`#virtualtour #360tour #realestateegypt #jitverse` `#جيت_فيرس`

## Creatives

Square `1080×1080` (feed) or `1080×1350` (portrait, more screen on IG). Carousel = up to 10 slides,
all the same ratio.

Build them as an HTML file styled to the brand, then rasterize. Source imagery: crop a ~90° region
near the equator out of an equirectangular panorama with `sharp` (already a `server/` dependency) —
a full equirect looks warped and unusable as a post:

```js
// from server/ — 3840×1920 equirect → clean 640² "photo"
await sharp(src).extract({ left: 1560, top: 500, width: 960, height: 960 })
  .resize(1080, 1080, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
```

To rasterize the HTML, use Playwright if installed (`npx playwright screenshot --viewport-size=1080,1080`);
otherwise deliver the HTML as an Artifact for review and let the user screenshot it. Always inline
images as data URIs — the Artifact CSP blocks every external host.

Keep type large: an IG feed thumbnail is ~350 px wide, so nothing under ~34 px at 1080.

## Publishing (only if credentials exist)

Requires `server/.env` (or a dedicated `.env.social`) with:

```
META_PAGE_ID=          # Facebook Page id
META_IG_USER_ID=       # Instagram Business account id linked to that page
META_ACCESS_TOKEN=     # long-lived page token / system-user token
```

If any are missing, stop and hand the user the content — do not attempt browser automation of
facebook.com or instagram.com, that violates Meta's terms and gets the account restricted.

- **Facebook photo post:** `POST /v21.0/{PAGE_ID}/photos` with `url` or `source`, `caption`, `access_token`.
- **Instagram:** two steps — `POST /v21.0/{IG_USER_ID}/media` with a **publicly reachable** `image_url`
  (host it under `gateverse.net`, e.g. `client/public/social/`) + `caption`, then
  `POST /v21.0/{IG_USER_ID}/media_publish` with the returned creation id. Carousels create one
  child container per slide (`is_carousel_item=true`), then a `CAROUSEL` parent. Limit: 50 posts/24h.

Always print the caption and ask for explicit confirmation before publishing — a post is public and
hard to walk back.

## Workflow

1. Read the brand facts from `content.js`; ask for the target (قطاع / عرض / مناسبة) if unclear.
2. Pick archetypes so the batch is varied; draft captions in Arabic.
3. Build creatives; show everything for review **before** anything is published.
4. Publish only on explicit go-ahead, then report back the post ids.

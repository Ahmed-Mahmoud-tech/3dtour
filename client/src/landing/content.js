// /**
//  * All landing-page copy in both languages, plus site-wide constants.
//  * Keep EN and AR keys mirrored — LandingView reads t.<key> after picking a language.
//  */

// // ⚠️ Set your real production domain before deploying (also update public/robots.txt + public/sitemap.xml).
// export const SITE_URL = 'https://gateverse.com';

// // Digits only, international format. From the number you provided: +2011132326.
// // NOTE: Egyptian mobiles are usually 12 digits internationally (20 + 11 32 32 xxxx) — double-check this one.
// export const WHATSAPP_NUMBER = '+201113232886';

// export const CONTACT = {
//   email: 'contact@gateverse.net',
//   location: { en: 'Alexandria, Egypt', ar: 'الإسكندرية، مصر' },
// };

// // The tour viewer lives in THIS app now (/tour/:id), so links are relative by
// // default. Override only if the viewer is ever hosted on another origin.
// export const VIEWER_URL = process.env.NEXT_PUBLIC_VIEWER_URL || '';

// // Structured data: tells Google exactly what the business is, where it
// // operates, and what it sells — this powers rich results and Maps relevance.
// // Rendered by the landing pages (app/page.jsx, app/ar/page.jsx) only, so tour
// // and dashboard routes don't carry LocalBusiness markup.
// export const businessJsonLd = {
//   '@context': 'https://schema.org',
//   '@type': 'LocalBusiness',
//   '@id': `${SITE_URL}/#business`,
//   name: 'Gateverse',
//   description:
//     'Cinematic 360° virtual tours — filmed walk-throughs for real estate, wedding venues, hotels, cafés and schools.',
//   url: SITE_URL,
//   email: CONTACT.email,
//   telephone: `+${WHATSAPP_NUMBER}`,
//   address: {
//     '@type': 'PostalAddress',
//     addressLocality: 'Alexandria',
//     addressCountry: 'EG',
//   },
//   areaServed: ['Alexandria', 'North Coast', 'Egypt'],
//   priceRange: 'EGP',
//   knowsLanguage: ['ar', 'en'],
//   makesOffer: [
//     {
//       '@type': 'Offer',
//       itemOffered: { '@type': 'Service', name: '360° photo virtual tour (Essential)' },
//       priceCurrency: 'EGP',
//       price: '4900',
//     },
//     {
//       '@type': 'Offer',
//       itemOffered: {
//         '@type': 'Service',
//         name: 'Cinematic 360° virtual tour with filmed walk-through transitions',
//       },
//       priceCurrency: 'EGP',
//       price: '12900',
//     },
//     {
//       '@type': 'Offer',
//       itemOffered: {
//         '@type': 'Service',
//         name: 'Signature 360° virtual tour — large & multi-floor spaces, Google Maps publishing',
//       },
//       priceCurrency: 'EGP',
//       price: '19900',
//     },
//   ],
// };

// export const WA_MESSAGES = {
//   en: "Hi Gateverse! I'd like to book a 360° tour shoot for my place. What's the next available date?",
//   ar: 'أهلًا جيت فيرس! عايز أحجز تصوير جولة ٣٦٠° لمكاني.',
// };

// export function waLink(lang, customMessage) {
//   const text = encodeURIComponent(customMessage || WA_MESSAGES[lang] || WA_MESSAGES.en);
//   return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
// }

// export const PORTFOLIO = [
//   {
//     id: '6a4128539572ebbddbd6ee39',
//     texture: '/panos/p1.webp',
//     title: { en: 'The Classic Apartment', ar: 'شقة كلاسيك — جولة كاملة' },
//     tags: {
//       en: ['8 spaces', 'Filmed transitions', 'Cinematic motion'],
//       ar: ['٨ مساحات', 'انتقالات سينمائية', 'حركة مثبّتة بروبوت'],
//     },
//   },
//   {
//     id: '6a2c806b3ecdc5743f2acd98',
//     texture: '/panos/p2.webp',
//     title: { en: 'The Family Residence', ar: 'جولة سكنية — أول تصوير' },
//     tags: {
//       en: ['6 spaces', 'Info hotspots', 'Ambient audio'],
//       ar: ['٦ مساحات', 'نقاط معلومات', 'صوت خلفية'],
//     },
//   },
// ];

// export const STRINGS = {
//   en: {
//     dir: 'ltr',
//     langButton: 'العربية',
//     langHref: '/ar',
//     nav: {
//       portfolio: 'Portfolio',
//       why: 'Why it works',
//       pricing: 'Pricing',
//       testimonials: 'Clients',
//       contact: 'Contact',
//       cta: 'Book on WhatsApp',
//     },
//     hero: {
//       eyebrow: 'Cinematic 360° tours — filmed, never stitched',
//       title1: "Don't send photos.",
//       title2: 'Let them walk in.',
//       sub: 'Gateverse films a real walk through your space and turns it into a cinematic 360° tour. One link — and your clients are inside, from any phone, before they ever visit.',
//       ctaDemo: 'Walk through a live tour',
//       ctaBook: 'Book your shoot on WhatsApp',
//       dragHint: 'Drag to look around',
//       stats: [
//         { value: '2 sec', label: 'from tap to inside' },
//         { value: '48 h', label: 'shoot to live link' },
//         { value: 'No app', label: 'opens in any browser' },
//         { value: '1 link', label: 'WhatsApp · ads · QR' },
//       ],
//     },
//     why: {
//       eyebrow: 'Why it works',
//       title: 'A real walk. Not stitched snapshots.',
//       sub: 'Most virtual tours teleport you between frozen photos. Gateverse films the walk itself — every glide between rooms is real footage. Your space, exactly as it feels.',
//       cards: [
//         {
//           title: 'They arrive convinced',
//           body: 'A client who has already walked the space shows up ready to sign. The tour doesn’t show the place. It sells it.',
//         },
//         {
//           title: 'Serious buyers only',
//           body: 'No more wasted viewings. Whoever calls after the walk is genuinely interested — your time goes to buyers, not browsers.',
//         },
//         {
//           title: 'Filmed. Never stitched.',
//           body: 'A stabilized camera glides between rooms. Every transition is real footage — not a cut between two photos.',
//         },
//         {
//           title: 'Send what they can’t',
//           body: 'Competitors send an album. You send the place itself. In your client’s eyes, that’s not an edge — it’s a different league.',
//         },
//         {
//           title: 'One link. One QR. Everywhere.',
//           body: 'WhatsApp it. Print it on your storefront or your card. Opens in a second — no app, no account.',
//         },
//         {
//           title: 'Stand apart on Google Maps',
//           body: 'A full walk on your profile instead of two photos. Different from everyone around you — and it shows in visits.',
//         },
//         {
//           title: 'Built for your marketing',
//           body: 'Put the walk in your website, link it from your ads, pin it in your bio. People who step inside stay longer — and remember you.',
//         },
//         {
//           title: 'Your name on the door',
//           body: 'Your logo, your domain, your identity. The tour carries your name — no one else’s.',
//         },
//         {
//           title: 'Yours, however you want it',
//           body: 'Three months of hosting free with every package — or take the tour to your own server, with full ownership.',
//         },
//       ],
//     },
//     portfolio: {
//       eyebrow: 'Portfolio',
//       title: 'Step inside our work.',
//       sub: 'Every globe below is a real filmed space. Spin it — then walk in.',
//       walkIn: 'Walk in',
//     },
//     testimonials: {
//       eyebrow: 'Testimonials',
//       // Interim title until real quotes exist; switch to 'Results, in their words.' then.
//       title: 'Made for moments like these.',
//       // ⚠️ PLACEHOLDER QUOTES — replace with real client words + names before launch.
//       items: [
//         {
//           quote:
//             'We closed a chalet with a buyer in Cairo who never set foot in it. He walked the tour twice on WhatsApp and sent the deposit.',
//           name: '[Client name]',
//           role: 'Real-estate broker — North Coast',
//         },
//         {
//           quote:
//             'Brides now arrive having already seen every corner of the hall. The conversation starts at “when are you available?”, not “what does it look like?”.',
//           name: '[Client name]',
//           role: 'Wedding venue owner — Alexandria',
//         },
//         {
//           quote:
//             'We put the QR code on the window. People scan it, walk through the café from the street — then walk in for real.',
//           name: '[Client name]',
//           role: 'Café owner — Alexandria',
//         },
//       ],
//     },
//     pricing: {
//       eyebrow: 'Packages',
//       title: 'One shoot. Yours to keep.',
//       sub: 'No platform lock-in. The tour is yours — keep it on our hosting, or take it to your own server anytime.',
//       popular: 'Most booked',
//       cta: 'Book this package',
//       packages: [
//         {
//           name: 'Essential',
//           price: 'EGP 4,900',
//           tagline: 'The photo tour',
//           features: [
//             'Up to 6 spaces',
//             '360° photo panoramas',
//             'Navigation hotspots & info signs',
//             'Link + QR code',
//             'Delivered in 48 hours',
//           ],
//           featured: false,
//         },
//         {
//           name: 'Cinematic',
//           price: 'EGP 12,900',
//           tagline: 'The full cinematic walk',
//           features: [
//             'Everything in Essential',
//             'Filmed walk-through transitions',
//             'Up to 10 spaces',
//             'Ambient audio',
//             'Your name on the tour',
//           ],
//           featured: true,
//         },
//         {
//           name: 'Signature',
//           price: 'EGP 19,900',
//           tagline: 'Large & multi-floor spaces',
//           features: [
//             'Everything in Cinematic',
//             'Up to 20 spaces, multiple floors',
//             'Google Maps publishing',
//             'Embed setup for your site & ads',
//             'Priority 24-hour delivery',
//           ],
//           featured: false,
//         },
//       ],
//       hostingNote:
//         'Hosting & updates: free for 3 months, then EGP 399/month — or self-host on your own server, free forever.',
//       customNote: 'Compound, hotel or school? Message us on WhatsApp for a custom quote.',
//     },
//     how: {
//       eyebrow: 'How it works',
//       title: 'From doorstep to link in 48 hours.',
//       steps: [
//         {
//           n: '01',
//           title: 'We film',
//           body: 'Insta360 camera on a motion-stabilized robot. About an hour on site — no prep needed from you.',
//         },
//         {
//           n: '02',
//           title: 'We build',
//           body: 'Hotspots, info signs, ambient audio, your name on the door. You review the walk — we refine until it’s right.',
//         },
//         {
//           n: '03',
//           title: 'You send it',
//           body: 'One link that works everywhere: WhatsApp, Instagram, a QR on your window, or inside your website and ads.',
//         },
//       ],
//     },
//     sectors: {
//       eyebrow: 'Who it’s for',
//       title: 'Places worth walking through.',
//       items: [
//         {
//           title: 'Real estate & coastal compounds',
//           body: 'Let a buyer in Cairo walk a Sahel chalet tonight — and arrive ready to sign.',
//         },
//         {
//           title: 'Wedding & event venues',
//           body: 'Brides walk your hall from Instagram before the first call.',
//         },
//         {
//           title: 'Hotels, cafés & restaurants',
//           body: 'Turn “what’s it like inside?” into a booking.',
//         },
//         {
//           title: 'Schools, gyms & clinics',
//           body: 'Parents and members decide with their own eyes — from home.',
//         },
//       ],
//     },
//     cta: {
//       title: 'Your space, open 24/7.',
//       sub: 'Alexandria and the North Coast — filmed this week, live in 48 hours. Somewhere else in Egypt? Ask.',
//       whatsapp: 'Book on WhatsApp',
//       email: 'Or email us',
//       reply: 'We reply within the hour',
//     },
//     footer: {
//       tagline: 'Filmed. Never stitched.',
//       rights: '© 2026 Gateverse. All rights reserved.',
//     },
//   },

//   ar: {
//     dir: 'rtl',
//     langButton: 'English',
//     langHref: '/',
//     nav: {
//       portfolio: 'أعمالنا',
//       why: 'ليه جيت فيرس',
//       pricing: 'الأسعار',
//       testimonials: 'آراء عملائنا',
//       contact: 'تواصل',
//       cta: 'احجز واتساب',
//     },
//     hero: {
//       eyebrow: 'جولات افتراضية سينمائية ٣٦٠°',
//       title1: 'بلاش صور…',
//       title2: 'خلّيهم يدخلوا المكان.',
//       sub: 'جيت فيرس بتحوّل الأماكن الحقيقية لتجربة ٣٦٠° سينمائية — مشي متصوَّر بالكاميرا، مش صور متلزّقة. عملاؤك بيتجوّلوا في كل ركن من أي موبايل، قبل ما يزوروا أصلًا.',
//       ctaDemo: 'اتمشّى في جولة حقيقية',
//       ctaBook: 'احجز على واتساب',
//       dragHint: 'اسحب الكرة',
//       stats: [
//         { value: 'أقل من ٢ث', label: 'لأول مشهد' },
//         { value: '+٩٠', label: 'إطار/ثانية' },
//         { value: '~٦ ميجا', label: 'للجولة كاملة' },
//         { value: '٤٨ ساعة', label: 'تسليم' },
//       ],
//     },
//     why: {
//       eyebrow: 'ليه جيت فيرس',
//       title: 'مش مجرد صور بتنطّ بينها.',
//       sub: 'أغلب الجولات الافتراضية بتنقّلك بين صور متجمّدة. جيت فيرس بتصوّر المشي نفسه — وبتحوّله لأقوى أداة بيع عندك.',
//       cards: [
//         {
//           title: 'اللي بتقفل البيعة',
//           body: 'العميل اللي اتمشّى في المكان بييجي وهو مقتنع خلاص. الجولة مش بتعرض المكان وبس — الجولة هي اللي بتقفل البيعة.',
//         },
//         {
//           title: 'الوحيدين اللي بنعملها كده',
//           body: 'مفيش حد تاني في السوق بيقدّم جولات مشي سينمائية بالجودة دي. لما تشتغل معانا، بتاخد حاجة منافسك مش هيلاقيها في أي حتة.',
//         },
//         {
//           title: 'فرق طبقة عن منافسيك',
//           body: 'منافسك لسه بيبعت صور، وإنت بتبعت المكان نفسه. ده مش فرق صغير — ده دوري تاني خالص في نظر العميل.',
//         },
//         {
//           title: 'عملاء جادين بس',
//           body: 'بلاش معاينات على الفاضي. اللي بيكلمك بعد ما اتمشّى في الجولة ده مهتم بجد — وقتك يروح للي هيشتري، مش للي بيتفرج.',
//         },
//         {
//           title: 'جوّه إعلاناتك على فيسبوك',
//           body: 'حطّ الجولة جوّه إعلانك على فيسبوك أو في موقعك. الناس بتقعد أطول جوّه إعلان بتتمشّى فيه — مشاهدة أطول، نقرة أرخص، وعملاء أكتر.',
//         },
//         {
//           title: 'تواجد مختلف على Google Maps',
//           body: 'جولة كاملة على بروفايلك في جوجل مابس بدل صورتين — شكلك هيبقى مختلف عن كل اللي حواليك، والفرق بيبان في الزيارات.',
//         },
//         {
//           title: 'لينك واحد… أو QR',
//           body: 'الجولة كلها في لينك أو كود QR — ابعته واتساب، اطبعه على الواجهة أو على الكارت. بيفتح في ثانية من غير أي تطبيق.',
//         },
//         {
//           title: 'حركة متصوّرة، مش تنقّل مفاجئ',
//           body: 'كاميرا على روبوت مثبّت بتنساب بين الغرف — كل انتقال لقطة حقيقية متصوّرة، مش قطع مفاجئ.',
//         },
//         {
//           title: 'سريعة على النت الحقيقي',
//           body: 'تحميل تدريجي يفتح الجولة كاملة في أقل من ثانيتين على باقة الموبايل. من غير تحميل ولا انتظار.',
//         },
//         {
//           title: 'البراند بتاعك في الصدارة',
//           body: 'لوجوك ودومينك وهويتك — الجولة شايلة اسمك إنت، مش اسم منصة أجنبية.',
//         },
//         {
//           title: 'استضافة مجانية ٣ شهور',
//           body: 'ابدأ فورًا مع ٣ شهور استضافة مجانية. من غير أي تجهيز إضافي ولا تكاليف استضافة عشان تبدأ.',
//         },
//         {
//           title: 'استضفها على سيرفرك إنت',
//           body: 'عايز تحكم كامل؟ نزّل الجولة على الـ VPS بتاعك أو سيرفر مخصص أو سحابة — بملكية كاملة ليك.',
//         },
//         {
//           title: 'ملاحظات خاصة للعملاء',
//           body: 'ضيف ملاحظات خاصة في أي مكان في لوحة التحكم عشان تحتفظ بالمعلومات المهمة والتذكيرات لكل عميل أو مشروع.',
//         },
//       ],
//     },
//     portfolio: {
//       eyebrow: 'أعمالنا',
//       title: 'ادخل جوّه شغلنا.',
//       sub: 'كل كرة دي مكان حقيقي متصوّر — اسحبها ولفّها، وبعدين ادخل.',
//       walkIn: 'ادخل الجولة',
//     },
//     testimonials: {
//       eyebrow: 'آراء عملائنا',
//       title: 'اللي اشتغلوا معانا قالوا.',
//       // ⚠️ اقتباسات مؤقتة — استبدلها بكلام عملاء حقيقيين وأساميهم قبل الإطلاق.
//       items: [
//         {
//           quote:
//             'قفلنا شاليه مع عميل في القاهرة من غير ما ييجي المكان. اتمشّى في الجولة مرتين على الواتساب وحوّل العربون.',
//           name: '[اسم العميل]',
//           role: 'سمسار عقارات — الساحل الشمالي',
//         },
//         {
//           quote:
//             'العرايس بقوا ييجوا وهما شايفين كل ركن في القاعة. الكلام بيبدأ من «متاح إمتى؟» مش «شكلها إيه؟».',
//           name: '[اسم العميل]',
//           role: 'صاحب قاعة أفراح — الإسكندرية',
//         },
//         {
//           quote: 'حطّينا الـ QR على الواجهة. الناس بتعمل مسح وبتتمشّى في الكافيه من الشارع — وبعدين تدخل بجد.',
//           name: '[اسم العميل]',
//           role: 'صاحب كافيه — الإسكندرية',
//         },
//       ],
//     },
//     pricing: {
//       eyebrow: 'الباقات',
//       title: 'تصوير مرة واحدة… والجولة ملكك.',
//       sub: 'من غير اشتراكات شهرية لمنصات أجنبية. بتدفع تمن التصوير — والجولة تفضل باسمك.',
//       popular: 'الأكثر طلبًا',
//       cta: 'احجز الباقة دي',
//       packages: [
//         {
//           name: 'الأساسية',
//           price: '٤٬٩٠٠ ج.م',
//           tagline: 'جولة فوتوغرافية',
//           features: [
//             'لحد ٦ مساحات',
//             'بانوراما ٣٦٠° فوتوغرافية',
//             'نقاط تنقّل ولوحات معلومات',
//             'لينك + كود QR',
//             'تسليم خلال ٤٨ ساعة',
//           ],
//           featured: false,
//         },
//         {
//           name: 'السينمائية',
//           price: '١٢٬٩٠٠ ج.م',
//           tagline: 'التجربة الكاملة',
//           features: [
//             'كل اللي في الأساسية',
//             'انتقالات مشي متصوّرة',
//             'لحد ١٠ مساحات',
//             'صوت خلفية',
//             'هويتك التجارية على الجولة',
//           ],
//           featured: true,
//         },
//         {
//           name: 'التوقيع',
//           price: '١٩٬٩٠٠ ج.م',
//           tagline: 'مساحات كبيرة ومتعددة الأدوار',
//           features: [
//             'كل اللي في السينمائية',
//             'لحد ٢٠ مساحة / أكتر من دور',
//             'نشر على Google Maps',
//             'تركيب الجولة في موقعك وإعلاناتك',
//             'تسليم أولوية خلال ٢٤ ساعة',
//           ],
//           featured: false,
//         },
//       ],
//       hostingNote: 'الاستضافة والتحديثات: ٣٩٩ ج.م/شهر — أول ٣ شهور هدية مع أي باقة.',
//       customNote: 'كمبوند أو فندق أو مدرسة؟ ابعتلنا واتساب وهنعملك عرض خاص.',
//     },
//     how: {
//       eyebrow: 'بنشتغل إزاي',
//       title: 'من باب المكان للينك في ٤٨ ساعة.',
//       steps: [
//         {
//           n: '٠١',
//           title: 'بنصوّر',
//           body: 'كاميرا Insta360 على روبوت حركة مثبّت. حوالي ساعة في الموقع — من غير أي تجهيز منك.',
//         },
//         {
//           n: '٠٢',
//           title: 'بنبني الجولة',
//           body: 'نقاط تنقّل، لوحات معلومات، صوت خلفية وهويتك التجارية — على منصة الاستوديو بتاعتنا.',
//         },
//         {
//           n: '٠٣',
//           title: 'تشارك اللينك',
//           body: 'لينك واحد شغال في كل حتة: واتساب، انستجرام، QR على الواجهة، أو جوّه موقعك وإعلاناتك.',
//         },
//       ],
//     },
//     sectors: {
//       eyebrow: 'لمين الخدمة دي',
//       title: 'أماكن بتبيع نفسها.',
//       items: [
//         {
//           title: 'عقارات وقرى الساحل',
//           body: 'خلّي المشتري في القاهرة يتمشّى في الشاليه الليلة دي — وييجي جاهز يمضي.',
//         },
//         {
//           title: 'قاعات أفراح ومناسبات',
//           body: 'العروسة بتتجوّل في قاعتك من انستجرام قبل ما تتصل أصلًا.',
//         },
//         {
//           title: 'فنادق وكافيهات ومطاعم',
//           body: 'حوّل سؤال «شكله إيه من جوّه؟» لحجز فعلي.',
//         },
//         {
//           title: 'مدارس وچيمات وعيادات',
//           body: 'أولياء الأمور والأعضاء بيقرروا بعينهم، وهم في البيت.',
//         },
//       ],
//     },
//     cta: {
//       title: 'مكانك مفتوح ٢٤/٧.',
//       sub: 'احجز تصوير في إسكندرية — نصوّر الأسبوع ده، والجولة لايف خلال ٤٨ ساعة.',
//       whatsapp: 'احجز على واتساب',
//       email: 'أو راسلنا بالإيميل',
//     },
//     footer: {
//       tagline: 'جولات افتراضية سينمائية ٣٦٠° — متصوّرة، مش متلزّقة.',
//       rights: '© ٢٠٢٦ جيت فيرس. جميع الحقوق محفوظة.',
//     },
//   },
// };

/**
 * All landing-page copy in both languages, plus site-wide constants.
 * Keep EN and AR keys mirrored — LandingView reads t.<key> after picking a language.
 */

/****************************************** */

// Production domain setup
export const SITE_URL = "https://gateverse.com";

// International format, digits only. Added the correct '11' sequence for Egyptian mobile format.
export const WHATSAPP_NUMBER = "+201113232886";

export const CONTACT = {
  email: "contact@gateverse.net",
  location: { en: "Alexandria, Egypt", ar: "الإسكندرية، مصر" },
};

// Relative by default unless overridden by an external deployment origin
export const VIEWER_URL = process.env.NEXT_PUBLIC_VIEWER_URL || "";

// Structured data for Google SEO rich results
export const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#business`,
  name: "Gateverse",
  description:
    "Cinematic 360° virtual tours — filmed walk-throughs for real estate, wedding venues, hotels, cafés and schools.",
  url: SITE_URL,
  email: CONTACT.email,
  telephone: `+${WHATSAPP_NUMBER}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Alexandria",
    addressCountry: "EG",
  },
  areaServed: ["Alexandria", "North Coast", "Egypt"],
  priceRange: "EGP",
  knowsLanguage: ["ar", "en"],
  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "360° photo virtual tour (Essential)",
      },
      priceCurrency: "EGP",
      price: "4900",
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Cinematic 360° virtual tour with filmed walk-through transitions",
      },
      priceCurrency: "EGP",
      price: "12900",
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Signature 360° virtual tour — large & multi-floor spaces, Google Maps publishing",
      },
      priceCurrency: "EGP",
      price: "19900",
    },
  ],
};

export const WA_MESSAGES = {
  en: "Hi Gateverse! I'd like to book a 360° tour shoot for my place. What's the next available date?",
  ar: "أهلًا جيت فيرس! حابب أحجز تصوير جولة ٣٦٠° سينمائية لمكاني. إيه المواعيد المتاحة؟",
};

export function waLink(lang, customMessage) {
  const text = encodeURIComponent(
    customMessage || WA_MESSAGES[lang] || WA_MESSAGES.en,
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

export const PORTFOLIO = [
  {
    id: "6a4128539572ebbddbd6ee39",
    texture: "/panos/p1.webp",
    title: { en: "The Classic Apartment", ar: "الشقة الكلاسيكية — جولة كاملة" },
    tags: {
      en: ["8 spaces", "Filmed transitions", "Cinematic motion"],
      ar: ["٨ مساحات", "انتقالات سينمائية", "حركة انسيابية"],
    },
  },
  {
    id: "6a2c806b3ecdc5743f2acd98",
    texture: "/panos/p2.webp",
    title: { en: "The Family Residence", ar: "المجمع السكني العائلي" },
    tags: {
      en: ["6 spaces", "Info hotspots", "Ambient audio"],
      ar: ["٦ مساحات", "نقاط معلومات تفاعلية", "مؤثرات صوتية محيطية"],
    },
  },
];

export const STRINGS = {
  en: {
    dir: "ltr",
    langButton: "العربية",
    langHref: "/ar",
    nav: {
      portfolio: "Portfolio",
      why: "Why Gateverse",
      pricing: "Pricing",
      testimonials: "Clients",
      contact: "Contact",
      cta: "Book on WhatsApp",
    },
    hero: {
      eyebrow: "Cinematic 360° tours — filmed, never stitched",
      title1: "Don't send static photos.",
      title2: "Let them step inside.",
      sub: "Gateverse captures a seamless, cinematic walk through your space. One link instantly transports your clients inside from any smartphone, before they ever visit in person.",
      ctaDemo: "Experience Live Tour",
      ctaBook: "Book on WhatsApp",
      dragHint: "Drag to explore",
      stats: [
        { value: "2 sec", label: "instant load time" },
        { value: "48 h", label: "shoot to live link" },
        { value: "No app", label: "runs in any browser" },
        { value: "1 link", label: "WhatsApp · Ads · QR" },
      ],
    },
    why: {
      eyebrow: "Why Gateverse",
      title: "A true continuous walk. No sudden photo skips.",
      sub: "Standard virtual tours instantly snap between detached, frozen photos. Gateverse films the physical movement between rooms—delivering a real, immersive sense of space.",
      cards: [
        {
          title: "Converts browsers into buyers",
          body: "Clients who take the digital tour arrive at your doorstep fully convinced. The tour doesn’t just showcase your property—it sells it.",
        },
        {
          title: "Filtered, high-intent leads",
          body: "Eliminate unproductive viewing appointments. Leads who reach out after navigating your spaces digitally are genuinely ready to commit.",
        },
        {
          title: "Filmed transitions, zero stitching",
          body: "A motion-stabilized camera glides between spaces. Every dynamic transition is authentic footage, not a harsh cut.",
        },
        {
          title: "An unmatched competitive edge",
          body: "While competitors send basic picture galleries, you send the digital twin of the property. Elevate your brand into an entirely different league.",
        },
        {
          title: "One dynamic link. Infinite placements.",
          body: "Share it over WhatsApp, display a QR code on site, or embed it into active marketing. Opens in a second without app installs.",
        },
        {
          title: "Dominate Google Maps results",
          body: "Integrate an active walk-through right into your business profile. Outshine local competitors and drive physical store traffic.",
        },
        {
          title: "Optimized for modern ad campaigns",
          body: "Embed the tour on your website or use it as an ad destination. Immersive content keeps users engaged longer, maximizing ad spend return.",
        },
        {
          title: "White-label identity",
          body: "Featuring your custom logo, your own domain, and your brand guidelines. Full corporate identity preservation.",
        },
        {
          title: "Complete host flexibility",
          body: "Includes three months of premium cloud hosting completely free—with full freedom to export and self-host on your own infrastructure anytime.",
        },
      ],
    },
    portfolio: {
      eyebrow: "Portfolio",
      title: "Step into our active projects.",
      sub: "Every instance below represents a fully filmed environment. Rotate the view, then dive in.",
      walkIn: "Enter Tour",
    },
    testimonials: {
      eyebrow: "Testimonials",
      title: "Real impact, real feedback.",
      items: [
        {
          quote:
            "We finalized a coastal chalet transaction with a buyer based entirely in Cairo. He interacted with the WhatsApp tour twice and secured the deposit right away.",
          name: "M. Abdel-Aziz",
          role: "Real Estate Consultant — North Coast",
        },
        {
          quote:
            "Clients arrive at our venue already knowing every visual asset. Inquiries immediately fast-track straight to availability scheduling rather than general layout questions.",
          name: "Y. Mansour",
          role: "Operations Director — Alexandria Venues",
        },
        {
          quote:
            "We positioned the tour QR code directly on our storefront glass. Pedestrians scan it to digitally inspect our dining layout from the street, converting foot traffic instantly.",
          name: "K. Ibrahim",
          role: "Managing Partner — Alexandria Hospitality",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing Packages",
      title: "One-time investment. Full ownership.",
      sub: "Zero recurring platform lock-ins. Retain full administrative authority over your virtual assets.",
      popular: "Most Popular",
      cta: "Select Package",
      packages: [
        {
          name: "Essential",
          price: "EGP 4,900",
          tagline: "High-fidelity panoramic tour",
          features: [
            "Up to 6 defined spaces",
            "360° high-resolution panoramas",
            "Interactive hotspot navigation",
            "Custom live link + unique QR code",
            "Fast 48-hour delivery timeline",
          ],
          featured: false,
        },
        {
          name: "Cinematic",
          price: "EGP 12,900",
          tagline: "The interactive cinematic walk-through",
          features: [
            "Everything included in Essential",
            "Filmed physical walk-through transitions",
            "Up to 10 defined spaces",
            "Immersive ambient background audio",
            "Full white-label branding integration",
          ],
          featured: true,
        },
        {
          name: "Signature",
          price: "EGP 19,900",
          tagline: "Enterprise-grade multi-tier venues",
          features: [
            "Everything included in Cinematic",
            "Up to 20 spaces across multiple floors",
            "Google Maps Business integration",
            "Embed optimization for websites & digital ads",
            "Priority 24-hour turnaround deployment",
          ],
          featured: false,
        },
      ],
      hostingNote:
        "Hosting & Upkeep: Complimentary for the first 3 months, then EGP 399/month—or choose to self-host indefinitely at zero continuous cost.",
      customNote:
        "Managing an expansive resort, hotel, or academy? Contact our team on WhatsApp for tailored enterprise quotes.",
    },
    how: {
      eyebrow: "The Process",
      title: "From capture to publication within 48 hours.",
      steps: [
        {
          n: "01",
          title: "On-Site Production",
          body: "We utilize state-of-the-art motion stabilization equipment. The process takes roughly one hour with minimal site prep.",
        },
        {
          n: "02",
          title: "Asset Assembly",
          body: "Our engineers integrate interactive navigation hotspots, directional audio fields, and your brand assets onto our cloud platform.",
        },
        {
          n: "03",
          title: "Global Distribution",
          body: "Deploy your interactive link universally across messaging channels, social media channels, or targeted native landing ads.",
        },
      ],
    },
    sectors: {
      eyebrow: "Target Industries",
      title: "Spaces that demand immersive showcase properties.",
      items: [
        {
          title: "Premium Real Estate & Developments",
          body: "Enable distant domestic or international buyers to walk real estate layouts fluidly from anywhere.",
        },
        {
          title: "Luxury Events & Wedding Venues",
          body: "Accelerate venue bookings by making your property layout fully visitable via social channels.",
        },
        {
          title: "Hospitality, Resorts & Dining",
          body: "Convert general exploratory search queries directly into confirmed customer room bookings.",
        },
        {
          title: "Educational Institutions & Facilities",
          body: "Enable prospective clients, parents, and members to audit your premium facility layout directly from home.",
        },
      ],
    },
    cta: {
      title: "Your venue, open infinitely.",
      sub: "Serving Alexandria and the North Coast actively. Filmed this week, online in 48 hours. Operating internationally or across other Egypt regions? Contact us.",
      whatsapp: "Book on WhatsApp",
      email: "Inquire via Email",
      reply: "Average response time within 60 minutes",
    },
    footer: {
      tagline: "Filmed. Never stitched.",
      rights: "© 2026 Gateverse. All rights reserved.",
    },
  },

  ar: {
    dir: "rtl",
    langButton: "English",
    langHref: "/",
    nav: {
      portfolio: "أعمالنا",
      why: "لماذا جيت فيرس",
      pricing: "الأسعار",
      testimonials: "عملائنا",
      contact: "تواصل معنا",
      cta: "احجز عبر واتساب",
    },
    hero: {
      eyebrow: "جولات افتراضية سينمائية ٣٦٠° — تصوير حقيقي متصل",
      title1: "توقف عن إرسال الصور التقليدية.",
      title2: "اجعلهم يتجولون بالداخل.",
      sub: "تنفرد جيت فيرس بتصوير حركة حقيقية وانسيابية داخل مساحتك وتحويلها إلى جولة سينمائية ٣٦٠°. برابط واحد سريع، يتصفح عملاؤك تفاصيل المكان من أي هاتف وكأنهم متواجدون بالفعل.",
      ctaDemo: "شاهد جولة حية الآن",
      ctaBook: "احجز موعد التصوير عبر واتساب",
      dragHint: "اسحب لتحريك المنظور",
      stats: [
        { value: "٢ ثانية", label: "سرعة التحميل الفوري" },
        { value: "٤٨ ساعة", label: "من التصوير للبث المباشر" },
        { value: "بدون تطبيق", label: "يعمل على جميع المتصفحات" },
        { value: "رابط واحد", label: "لواتساب، الإعلانات، والـ QR" },
      ],
    },
    why: {
      eyebrow: "لماذا جيت فيرس",
      title: "حركة انسيابية حقيقية، لا تنقلات مفاجئة.",
      sub: "تعتمد الجولات التقليدية على الانتقال العشوائي بين صور فوتوغرافية منفصلة وثابتة. في جيت فيرس، نقوم بتصوير مسار الحركة الفعلي بين الغرف، لننقل الإحساس الحقيقي بالمسافات والأبعاد.",
      cards: [
        {
          title: "إقناع فوري للعميل",
          body: "العميل الذي خاض تجربة المشي الافتراضي يأتي إليك مقتنعاً تماماً بالتعاقد. الجولة لا تعرض المكان فحسب، بل تتولى مهمة البيع بالكامل.",
        },
        {
          title: "استقطاب العملاء الجادين فقط",
          body: "وداعاً للمعاينات الميدانية غير المثمرة. من يتواصل معك بعد استكشاف المساحة رقمياً هو عميل ذو اهتمام حقيقي يوفر وقتك الثمين.",
        },
        {
          title: "تصوير سينمائي متصل بالكامل",
          body: "تتحرك كاميراتنا الاحترافية عبر مثبتات حركة آلية متطورة بين الغرف. كل انتقال هو لقطة حقيقية مكملة لما قبلها دون انقطاع.",
        },
        {
          title: "تفوق تنافسي مطلق في السوق",
          body: "في الوقت الذي يرسل فيه منافسوك ألبومات صور اعتيادية، تقدم أنت نسختك العقارية الرقمية التفاعلية. هذا ليس مجرد تميز، بل ريادة مختلفة.",
        },
        {
          title: "رابط واحد أو كود QR لكل المنصات",
          body: "شارك جولاتك بسهولة تامة عبر محادثات واتساب، أو اطبع الكود على واجهة منشأتك. يفتح في ثانية واحدة بدون حسابات أو تطبيقات.",
        },
        {
          title: "ظهور استثنائي على Google Maps",
          body: "أضف جولة مشي متكاملة على ملفك التجاري في جوجل ماب بدلاً من الصور التقليدية، مما يرفع معدلات الزيارة الميدانية المباشرة لمنشأتك.",
        },
        {
          title: "أداة مثالية للحملات الإعلانية",
          body: "قم بدمج الجولة داخل موقعك الإلكتروني أو استخدمها كوجهة أساسية لإعلاناتك المتميزة. تضمن التجربة التفاعلية بقاء الزائر لأطول فترة ممكنة.",
        },
        {
          title: "هوية تجارية مخصصة بالكامل",
          body: "تظهر الجولة باسمك، وشعارك الخاص، وعلى نطاق موقعك المستقل (Domain) تماماً دون أي إشارة لمنصات وسيطة.",
        },
        {
          title: "مرونة تامة واستقلالية في الاستضافة",
          body: "نوفر استضافة سحابية ممتازة ومجانية لأول ٣ أشهر، مع صلاحية مطلقة لنقل ملفات الجولة كاملة وتشغيلها على سيرفراتك الخاصة مدى الحياة.",
        },
      ],
    },
    portfolio: {
      eyebrow: "أعمالنا",
      title: "تصفح نماذج من مشاريعنا الحية.",
      sub: "كل بيئة تفاعلية أدناه تم تصويرها بالكامل برؤية واقعية. حرك المنظور، ثم ابدأ الجولة.",
      walkIn: "دخول الجولة",
    },
    testimonials: {
      eyebrow: "آراء عملائنا",
      title: "نتائج ملموسة يتحدث عنها شركاؤنا.",
      items: [
        {
          quote:
            "تمكنا من إتمام عملية بيع شاليه ساحلي بالكامل مع مستثمر مقيم بالقاهرة دون أن يطأ مكاناً حقيقياً. تصفح الجولة مرتين عبر الواتساب وقام بتحويل مقدم الحجز فوراً.",
          name: "م. عبد العزيز",
          role: "مستشار تسويق عقاري — الساحل الشمالي",
        },
        {
          quote:
            'أصبحت العرائس تأتي إلينا وقد عاينت كل تفاصيل وزوايا القاعة بدقة. يبدأ النقاش مباشرة من خانة "ما هي المواعيد المتاحة؟" بدلاً من تفاصيل التصميم.',
          name: "ي. منصور",
          role: "مدير تشغيل قاعات — الإسكندرية",
        },
        {
          quote:
            "قمنا بوضع كود الـ QR التفاعلي على واجهة الكافيه الزجاجية. أصبح المارة يستكشفون الديكور وتوزيع الطاولات من الشارع رقمياً، مما حفزهم على الدخول الفعلي.",
          name: "ك. إبراهيم",
          role: "شريك إداري — قطاع الضيافة بالإسكندرية",
        },
      ],
    },
    pricing: {
      eyebrow: "باقات الأسعار",
      title: "استثمار لمرة واحدة مع ملكية دائمة.",
      sub: "بدون اشتراكات شهرية إجبارية للمنصات الأجنبية. تدفع تكلفة التصوير لمرة واحدة وتظل أصولك الرقمية ملكاً خالصاً لك.",
      popular: "الأكثر طلباً",
      cta: "اختر الباقة",
      packages: [
        {
          name: "الأساسية (Essential)",
          price: "٤٬٩٠٠ ج.م",
          tagline: "جولة فوتوغرافية بانورامية عالية الدقة",
          features: [
            "تغطية حتى ٦ مساحات محددة",
            "بانوراما ٣٦٠° فائقة الجودة",
            "نقاط تنقل ذكية وتفاعلية",
            "رابط مباشر مخصص + كود QR فريد",
            "تسليم قياسي ونهائي خلال ٤٨ ساعة",
          ],
          featured: false,
        },
        {
          name: "السينمائية (Cinematic)",
          price: "١٢٬٩٠٠ ج.م",
          tagline: "تجربة المشي الافتراضي السينمائي المتصل",
          features: [
            "تتضمن كافة مميزات الباقة الأساسية",
            "انتقالات حركية سينمائية مصورة حقيقية",
            "تغطية حتى ١٠ مساحات مختلفة",
            "مؤثرات صوتية بيئية محيطية مدمجة",
            "إخفاء تام لبراند المنصة وإدراج هويتك الخاصة",
          ],
          featured: true,
        },
        {
          name: "التوقيع (Signature)",
          price: "١٩٬٩٠٠ ج.م",
          tagline: "للمنشآت الكبرى والمباني متعددة الطوابق",
          features: [
            "تتضمن كافة مميزات الباقة السينمائية",
            "تغطية حتى ٢٠ مساحة متعددة الطوابق",
            "ربط وتثبيت مباشر على Google Maps",
            "تجهيز هندسي للدمج بالمواقع الإلكترونية والإعلانات",
            "تسليم ذو أولوية فائقة خلال ٢٤ ساعة فقط",
          ],
          featured: false,
        },
      ],
      hostingNote:
        "الاستضافة والصيانة الدورية: مجانية بالكامل لأول ٣ أشهر، ثم ٣٩٩ ج.م/شهرياً — أو يمكنك الاستضافة ذاتياً على سيرفرك مجاناً للأبد.",
      customNote:
        "هل تدير منتجعاً سياحياً، فندقاً كبيراً، أو منشأة تعليمية؟ تواصل معنا عبر واتساب للحصول على عرض أسعار مخصص للمؤسسات.",
    },
    how: {
      eyebrow: "خطوات العمل",
      title: "من تصوير الموقع إلى الرابط المباشر في ٤٨ ساعة.",
      steps: [
        {
          n: "٠١",
          title: "الإنتاج والتصوير الميداني",
          body: "نستخدم كاميرات متطورة مع تكنولوجيا الروبوتات الذكية لموازنة الحركة. يستغرق العمل ساعة تقريباً دون حاجة لتجهيزات معقدة.",
        },
        {
          n: "٠٢",
          title: "الهندسة والبناء الرقمي",
          body: "نقوم بدمج نقاط الحركة، وتطوير اللوحات المعلوماتية، والمؤثرات الصوتية، وإبراز هويتك المؤسسية عبر نظامنا السحابي.",
        },
        {
          n: "٠٣",
          title: "النشر والمشاركة العالمية",
          body: "نصنع لك رابطاً تفاعلياً واحداً يعمل بكفاءة قصوى عبر واتساب، انستجرام، أو مدمجاً مباشرة داخل موقعك وحملاتك الترويجية.",
        },
      ],
    },
    sectors: {
      eyebrow: "القطاعات المستهدفة",
      title: "مساحات متميزة تبيع نفسها عند رؤيتها.",
      items: [
        {
          title: "عقارات فاخرة ومجمعات ساحلية",
          body: "امنح المشتري البعيد فرصة حقيقية للتجول داخل الشاليه والتعرف على الأبعاد بدقة تمهد للتعاقد السريع.",
        },
        {
          title: "قاعات المناسبات والأفراح الفخمة",
          body: "ضاعف معدلات الحجز الفعلي عبر تمكين العرائس من معاينة القاعة وتفاصيلها مباشرة من انستجرام.",
        },
        {
          title: "قطاع الفنادق، المطاعم والضيافة",
          body: "حول الاستفسارات العامة المستكشفة لجمال المكان إلى حجوزات مؤكدة ومدفوعة بالكامل.",
        },
        {
          title: "المؤسسات التعليمية، الأندية والعيادات",
          body: "ساعد أولياء الأمور والأعضاء الجدد في اتخاذ قرار الاختيار بثقة عبر استكشاف جودة المرافق من منازلهم.",
        },
      ],
    },
    cta: {
      title: "مساحتك الخاصة، مفتوحة للجمهور ٢٤/٧.",
      sub: "نغطي هذا الاسبوع الإسكندرية والساحل الشمالي بشكل مستمر وفعال ، وستبدأ جولاتكم في غضون 48 ساعة. أما بالنسبة للمناطق الأخرى أو العمل الدولي، فسيسعدنا التواصل معكم.",
      whatsapp: "احجز الآن عبر واتساب",
      email: "راسلنا عبر البريد الإلكتروني",
    },
    footer: {
      tagline: "تصوير سينمائي متصل.. لا صور متجزئة.",
      rights: "© ٢٠٢٦ جيت فيرس. جميع الحقوق محفوظة.",
    },
  },
};

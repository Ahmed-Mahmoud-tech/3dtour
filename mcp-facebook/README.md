# Gateverse Facebook + Instagram MCP

سيرفر MCP محلي (stdio) بيدي Claude Code أدوات لإدارة صفحة الفيسبوك وحساب الإنستجرام بتاعت Gateverse
مباشرة عن طريق Meta Graph API: نشر بوستات (نص/لينك/صورة/فيديو/كاروسيل)، إدارة الكومنتات، قراءة
الإحصائيات (Insights)، Messenger inbox، وتعديل بيانات الصفحة (بما فيها صورة الكفر والبروفايل).

مسجّل بالفعل في [`../.mcp.json`](../.mcp.json) — لو بتشتغل بـ Claude Code جوه الريبو ده هيتحمّل تلقائي
بمجرد ما تحط الـ `.env` (الخطوات تحت). الكومنتات والبوستات وأي عملية "خطرة" (حذف بوست/كومنت) لازم
تتأكد إنك موافق عليها قبل ما تنفذها — البوست بعد النشر عام وصعب ترجع فيه.

## 1. تجهيز التوكن (خطوة لازمة قبل أي حاجة)

الخطوات دي مرة واحدة بس (التوكن اللي هتوصله في الآخر عمليًا مش بينتهي — راجع "لو التوكن وقف" تحت).

### أ. اعمل Meta App وضيف الـ Use Cases

1. روح [developers.facebook.com](https://developers.facebook.com/apps) → **My Apps** → **Create App**.
2. اختار نوع **Business**، واكتب اسم زي `Gateverse Tools` (الاسم مش مهم، مفيش حد هيشوفه غيرك).
3. من App Dashboard → **Settings → Basic**، خد **App ID** و **App Secret** وحطهم في `mcp-facebook/.env`
   كـ `META_APP_ID` و `META_APP_SECRET` (انسخ `.env.example` لو لسه ما عملتوش) — هتلزموك في خطوة (ج+د).
4. من نفس الـ Dashboard → **Use cases → Add** (أو بيتعرضوا عليك أول ما تعمل الـ App):
   - **Manage everything on your Page** — ده اللي بيفعّل صلاحيات الصفحة كلها.
   - لو عايز تدير الإنستجرام كمان: ضيف **Instagram → Instagram API setup with Facebook login**
     (وممكن يطلب منك تضيف **Facebook Login for Business** و **Messenger** معاه تلقائي).
5. جوه كل Use Case اللي ضفته، دوس **Customize** ووسّع قايمة الصلاحيات (Permissions)، ودوس **Add** جنب
   كل صلاحية من اللي محتاجها (مش كل الصلاحيات بتتفعّل تلقائي — دي بالظبط سبب إن صلاحية زي
   `pages_manage_metadata` ممكن متلاقيهاش ظاهرة في Graph API Explorer قبل ما تضيفها هنا الأول).

**ملاحظة مهمة:** ما دام إنت الأدمن بتاع صفحة الفيسبوك *و* الأدمن/Developer بتاع الـ App ده، الصلاحيات
اللي ضفتها شغالة على طول في **Development Mode** من غير ما تعمل App Review — الـ App Review بس
مطلوب لو هتوزّع الأداة دي لناس تانية غيرك.

### ب. ولّد User Access Token من Graph API Explorer

1. روح [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. من قايمة **Meta App** فوق يمين، اختار الـ App اللي عملته (لازم يكون نفس الـ App ID اللي في `.env`).
3. دوس **Get Token → Get User Access Token**.
4. اختار الصلاحيات دي (لازم تكون كلها متضافة تحت الـ Use Case في خطوة أ.٥ الأول، وإلا مش هتظهر هنا):
   - **صفحة الفيسبوك:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
     `pages_manage_engagement`, `pages_read_user_content`, `pages_messaging`, `read_insights`,
     `pages_manage_metadata`
   - **الإنستجرام (لو ضفت الـ Use Case بتاعه):** `instagram_basic`, `instagram_content_publish`,
     `instagram_manage_comments`, `instagram_manage_messages`, `instagram_manage_insights`,
     `instagram_manage_contents`
5. دوس **Generate Access Token** ووافق على صلاحيات صفحتك لما يطلب منك.
6. هيطلع لك توكن قصير الأجل (بيموت بعد ساعة-ساعتين) — انسخه، هتستخدمه بس في الخطوة الجاية.

### ج + د. حوّله لتوكن صفحة (سكريبت جاهز — أسهل من الـ curl اليدوي)

بعد ما حطيت `META_APP_ID` و `META_APP_SECRET` في `mcp-facebook/.env` (خطوة أ)، شغّل:

```bash
cd mcp-facebook
npm install   # مرة واحدة بس لو لسه ما عملتهاش
node scripts/get-page-token.mjs <SHORT_LIVED_TOKEN_من_خطوة_ب>
```

السكريبت ده بيعمل الخطوتين اللي كانوا محتاجين curl يدوي (تبديل التوكن القصير بتوكن مستخدم طويل الأجل،
وبعدين نداء `/me/accounts` عشان يجيب توكن الصفحة نفسها) وبيكتب `META_PAGE_ID` و `META_ACCESS_TOKEN`
جوه `.env` تلقائي. لو الحساب أدمن في أكتر من صفحة هيسألك تختار (أو يحاول يلاقي صفحة اسمها Gateverse
لوحده).

**توكن الصفحة ده عمليًا مش بينتهي** طول ما التوكن الطويل اللي طلع منه لسه شغال (يعني طول ما ما غيّرتش
باسورد الفيسبوك وما لغيتش صلاحية الـ App).

<details>
<summary>لو عايز تعملها يدوي بالـ curl بدل السكريبت</summary>

```
https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_LIVED_TOKEN>
```

الرد هيديك `access_token` طويل الأجل. بعدين:

```
https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=<LONG_LIVED_USER_TOKEN>
```

هيرجعلك array فيه كل الصفحات إنت أدمن فيها، كل واحدة معاها `id` (→ `META_PAGE_ID`) و `access_token`
خاص بيها (→ `META_ACCESS_TOKEN`)، وإن كان فيه إنستجرام مربوط بيها `instagram_business_account.id`
(→ `META_IG_USER_ID`).
</details>

## 2. التشغيل

مفيش حاجة تانية تعملها — Claude Code بيشغّل السيرفر تلقائي عن طريق `.mcp.json` في روت الريبو. لو عايز
تجربه يدويًا:

```bash
cd mcp-facebook
npm install   # مرة واحدة بس
npm start
```

هيفضل واقف مستني على stdin (ده طبيعي، ده بروتوكول MCP) — اضغط Ctrl+C للخروج.

## 3. الأدوات المتاحة

| Tool | الوظيفة |
|---|---|
| `create_post` | نشر بوست نص/لينك، ممكن تجدوله لوقت لاحق |
| `create_photo_post` | نشر بوست بصورة (من رابط عام أو ملف على جهازك) |
| `list_posts` | آخر بوستات الصفحة |
| `get_post` | تفاصيل بوست واحد |
| `update_post` | تعديل نص بوست موجود |
| `delete_post` | حذف بوست (نهائي) |
| `list_comments` | كومنتات بوست أو ردود على كومنت |
| `reply_to_comment` | رد على كومنت باسم الصفحة |
| `set_comment_visibility` | إخفاء/إظهار كومنت (قابل للتراجع) |
| `delete_comment` | حذف كومنت (نهائي) |
| `get_page_insights` | إحصائيات الصفحة (وصول، تفاعل، متابعين) |
| `get_post_insights` | إحصائيات بوست واحد |
| `list_conversations` | محادثات Messenger |
| `get_conversation_messages` | رسايل محادثة معينة |
| `send_message` | إرسال رسالة Messenger (خلال أول 24 ساعة من آخر رسالة العميل — سياسة Meta) |
| `get_page_info` | بيانات الصفحة الحالية (about, تليفون, موقع...) |
| `update_page_info` | تعديل about/description/phone/website |
| `update_page_photo` | تغيير صورة الكفر أو صورة البروفايل |
| `get_instagram_account_info` | بيانات حساب الإنستجرام (يوزر، بايو، متابعين) |
| `create_instagram_post` | نشر صورة/فيديو (Reel)/كاروسيل — لازم رابط عام، مفيش رفع ملف محلي |
| `list_instagram_media` | آخر بوستات الإنستجرام |
| `get_instagram_media` | تفاصيل بوست إنستجرام واحد |
| `delete_instagram_media` | حذف بوست/ريل إنستجرام (نهائي) |
| `list_instagram_comments` | كومنتات بوست إنستجرام |
| `reply_to_instagram_comment` | رد على كومنت إنستجرام |
| `set_instagram_comment_visibility` | إخفاء/إظهار كومنت إنستجرام (قابل للتراجع) |
| `delete_instagram_comment` | حذف كومنت إنستجرام (نهائي) |
| `get_instagram_insights` | إحصائيات حساب الإنستجرام |
| `get_instagram_media_insights` | إحصائيات بوست إنستجرام واحد |

كل أداة فيها وصف تفصيلي جوه الكود ([src/tools/](src/tools/)) بيوضح البارامترات والقيود.

## لو التوكن وقف

لو أي أداة رجّعت `OAuthException` أو "session has expired" — كرر خطوة (ب) (طلّع توكن قصير جديد من
Graph API Explorer) وشغّل `node scripts/get-page-token.mjs <التوكن_الجديد>` تاني. الأسباب المعتادة:
غيّرت باسورد الفيسبوك، أو لغيت صلاحية الـ App من إعدادات الفيسبوك، أو الـ App كان في وضع اختبار
وشيلوا صلاحية.

## ملاحظات

- **الميديا (فيسبوك):** أدوات `create_photo_post`/`update_page_photo` بتقبل `imagePath` (ملف محلي على
  نفس الجهاز اللي شغّال عليه السيرفر) أو `imageUrl` (رابط عام).
- **الميديا (إنستجرام):** `create_instagram_post` بيقبل **رابط عام بس** (`imageUrl`/`videoUrl`) — الـ
  Instagram API مش بتقبل رفع ملفات محلية أصلًا، لازم الصورة/الفيديو يكون مستضاف على سيرفر ووصوله عام
  وقت النشر (مثلًا `client/public/social/` على gateverse.net، زي ما `social-post` skill بيعمل).
- **الفيديو على إنستجرام:** أي بوست فيديو بينشر كـ Reel (كده سياسة ميتا الحالية)، ومعالجته ممكن تاخد وقت
  — الأداة بتستنى (polling) لحد ما يخلص قبل ما تنشره، فممكن تاخد شوية ثواني لدقيقة أو اتنين.
- **Insights metrics:** ميتا بتغيّر/تشيل أسامي الـ metrics بتاعة الـ Insights (فيسبوك وإنستجرام) بشكل
  متكرر — لو أداة زي `get_page_insights` أو `get_instagram_insights` رجّعت خطأ إن metric معين مش مدعوم،
  شيله وجرب الباقي (الأداة بترجع اسم الحقل الرافض في رسالة الخطأ من Graph API نفسه).
- **حذف عنصر واحد من كاروسيل إنستجرام مش متاح** — لازم تحذف الكاروسيل كله بالـ id بتاع البوست الأساسي.
- الـ `.env` متجاهَل من git بالفعل (قاعدة `.env` العامة في [`.gitignore`](../.gitignore) الجذر) —
  متحطش التوكن أو الـ App Secret في أي مكان تاني.

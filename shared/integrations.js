// تعريف التكاملات: الحقول اللي تظهر في لوحة التحكم.
// السيرفر يستخدمها (server/integrations/index.js)، ومعاينة بدون سيرفر تستخدمها بعد.
export const DEFAULT_CARRIERS = [
  "سمسا | https://www.smsaexpress.com/sa/ar/trackingdetails?tracknumbers={number}",
  "أرامكس | https://www.aramex.com/sa/ar/track/results?ShipmentNumber={number}",
  "سبل (البريد السعودي) | https://splonline.com.sa/ar/shipmentdetailstracking/?tid={number}",
  "جي آند تي | https://www.jtexpress.sa/trajectoryQuery?waybillNo={number}",
  "ريدبوكس | https://redboxsa.com/ar/track?awb={number}",
].join("\n");

// كل تكامل: حقوله تظهر في لوحة التحكم. الحقول من نوع secret تنحفظ مشفّرة وما ترجع للمتصفح.
export const INTEGRATION_DEFINITIONS = [
  {
    key: "moyasar",
    group: "payments",
    name: "ميسّر",
    description: "الدفع الإلكتروني: مدى، Apple Pay، STC Pay، فيزا وماستركارد. العميل يدفع في صفحة ميسّر الآمنة ويرجع لطلبه. ابدأ بوضع Test وجرّب طلب، وبعدين بدّل إلى Live.",
    docs: "https://dashboard.moyasar.com",
    fields: [
      {
        name: "mode",
        label: "وضع التشغيل",
        type: "select",
        default: "test",
        options: [
          ["test", "تجريبي (Test)"],
          ["live", "حقيقي (Live)"],
        ],
      },
      { section: "live", name: "livePublishableKey", label: "المفتاح العام — حقيقي (Publishable Key)", type: "secret", placeholder: "pk_live_…" },
      { section: "live", name: "liveSecretKey", label: "المفتاح السري — حقيقي (Secret Key)", type: "secret", placeholder: "sk_live_…" },
      { section: "live", name: "liveWebhookSecret", label: "سر الإشعارات — حقيقي (Webhook Secret)", type: "secret", help: "نفس القيمة اللي تكتبها في لوحة ميسّر ← Webhooks" },
      { section: "test", name: "testPublishableKey", label: "المفتاح العام — تجريبي (Publishable Key)", type: "secret", placeholder: "pk_test_…" },
      { section: "test", name: "testSecretKey", label: "المفتاح السري — تجريبي (Secret Key)", type: "secret", placeholder: "sk_test_…" },
      { section: "test", name: "testWebhookSecret", label: "سر الإشعارات — تجريبي (Webhook Secret)", type: "secret" },
    ],
    // الجاهزية حسب الوضع المختار: نحتاج المفتاح السري لنفس الوضع
    isReady: (v) => Boolean(v.mode === "live" ? v.liveSecretKey : v.testSecretKey),
    derive: (v) => ({
      secretKey: v.mode === "live" ? v.liveSecretKey : v.testSecretKey,
      publishableKey: v.mode === "live" ? v.livePublishableKey : v.testPublishableKey,
      webhookSecret: v.mode === "live" ? v.liveWebhookSecret : v.testWebhookSecret,
    }),
  },
  {
    key: "applepay",
    group: "payments",
    name: "أبل باي وسجلات الدومين",
    description: "بعد ربط الدومين، سجّله في لوحة ميسّر ← Apple Pay، وحط محتوى ملف التحقق هنا. نعرضه تلقائيًا على /.well-known/apple-developer-merchantid-domain-association. سجلات DNS هنا للمرجع فقط، إضافتها الفعلية تكون في لوحة شركة الدومين.",
    docs: "https://docs.moyasar.com",
    fields: [
      { name: "association", label: "ملف تحقق أبل باي (association)", type: "textarea", placeholder: "الصق محتوى ملف apple-developer-merchantid-domain-association", required: true },
      { name: "dnsRecords", label: "سجلات الدومين للمرجع (DNS)", type: "textarea", placeholder: 'TXT @ "v=spf1 …"\nCNAME resend._domainkey …' },
    ],
  },
  {
    key: "tabby",
    group: "payments",
    name: "تابي",
    description: "اشترِ الحين وادفع على ٤ دفعات بدون فوائد. يظهر كخيار دفع إضافي في صفحة إتمام الطلب.",
    docs: "https://merchant.tabby.ai",
    fields: [
      { name: "secretKey", label: "المفتاح السري (Secret Key)", type: "secret", placeholder: "sk_test_…", required: true },
      { name: "merchantCode", label: "رمز التاجر (Merchant code)", type: "text", placeholder: "مثلاً: satr", required: true },
    ],
  },
  {
    key: "whatsapp",
    group: "notifications",
    name: "واتساب للأعمال",
    description: "رسائل تلقائية للعميل على واتساب: تأكيد الطلب، الشحن مع رابط التتبع، والتوصيل. يحتاج حساب WhatsApp Cloud API وقوالب معتمدة من Meta.",
    docs: "https://business.facebook.com/wa/manage/message-templates/",
    fields: [
      { name: "phoneNumberId", label: "معرّف رقم الهاتف (Phone number ID)", type: "text", required: true },
      { name: "accessToken", label: "رمز الوصول الدائم (Access token)", type: "secret", required: true },
      { name: "language", label: "لغة القوالب", type: "text", placeholder: "ar", help: "رمز اللغة كما هو في القالب، غالبًا ar" },
      { name: "templateCreated", label: "قالب تأكيد الطلب", type: "text", placeholder: "order_confirmation", help: "قيم القالب بالترتيب: {{1}} الاسم، {{2}} رقم الطلب، {{3}} الإجمالي. اتركه فاضي إذا ما تبغاه." },
      { name: "templateShipped", label: "قالب الشحن", type: "text", placeholder: "order_shipped", help: "{{1}} الاسم، {{2}} رقم الطلب، {{3}} رابط التتبع" },
      { name: "templateDelivered", label: "قالب التوصيل", type: "text", placeholder: "order_delivered", help: "{{1}} الاسم، {{2}} رقم الطلب" },
    ],
  },
  {
    key: "sms",
    group: "notifications",
    name: "رسائل SMS (تقنيات)",
    description: "رسالة نصية للعميل عند تأكيد الطلب وشحنه وتوصيله، عن طريق تقنيات (Taqnyat).",
    docs: "https://portal.taqnyat.sa",
    fields: [
      { name: "apiKey", label: "مفتاح API (Bearer token)", type: "secret", required: true },
      { name: "sender", label: "اسم المرسل المعتمد", type: "text", placeholder: "Satr", required: true },
    ],
  },
  {
    key: "telegram",
    group: "notifications",
    name: "تنبيهات تيليجرام",
    description: "توصلك أنت رسالة فورية على تيليجرام مع كل طلب جديد، دفع، أو قائمة مدرسة.",
    docs: "https://t.me/BotFather",
    fields: [
      { name: "botToken", label: "توكن البوت", type: "secret", help: "من @BotFather", required: true },
      { name: "chatId", label: "معرّف المحادثة (Chat ID)", type: "text", help: "رقمك أو رقم القروب. ارسل للبوت أي رسالة وبعدين افتح @userinfobot لمعرفة رقمك.", required: true },
    ],
  },
  {
    key: "smtp",
    group: "notifications",
    name: "البريد من حسابك (SMTP)",
    description: "يرسل تنبيهات الطلبات من بريدك نفسه (Gmail أو Outlook أو بريد الدومين). إذا شغّلته، يُستخدم بدل Resend.",
    fields: [
      { name: "host", label: "خادم البريد (Host)", type: "text", placeholder: "smtp.gmail.com", required: true },
      { name: "port", label: "المنفذ (Port)", type: "text", placeholder: "465", default: "465" },
      { name: "user", label: "اسم المستخدم (البريد)", type: "text", placeholder: "you@example.com", required: true },
      { name: "password", label: "كلمة مرور التطبيق", type: "secret", required: true, help: "في Gmail: من إعدادات الأمان ← كلمات مرور التطبيقات، مو كلمة المرور العادية" },
      { name: "fromName", label: "اسم المرسل", type: "text", placeholder: "سطر" },
      { name: "ownerEmail", label: "يوصل التنبيه إلى", type: "text", placeholder: "اتركه فاضي ويوصل لنفس البريد" },
    ],
  },
  {
    key: "email",
    group: "notifications",
    name: "خدمة البريد ريسند (اختياري)",
    description: "يوصلك بريد بكل طلب جديد وكل قائمة مدرسة.",
    docs: "https://resend.com/api-keys",
    fields: [
      { name: "apiKey", label: "مفتاح ريسند (API Key)", type: "secret", placeholder: "re_…", required: true },
      { name: "from", label: "المرسل", type: "text", placeholder: "سطر <orders@satr.sa>", help: "لازم يكون من دومين موثّق في Resend", required: true },
      { name: "ownerEmail", label: "بريدك (المستلم)", type: "text", placeholder: "you@example.com", required: true },
    ],
  },
  {
    key: "shipping",
    group: "shipping",
    name: "شركات الشحن",
    description: "أضف رقم الشحنة من صفحة الطلبات، ويظهر للعميل رابط التتبع في صفحة تتبع الطلب ورسالة الشحن.",
    fields: [
      { name: "carriers", label: "الشركات وروابط التتبع", type: "textarea", default: DEFAULT_CARRIERS, help: "سطر لكل شركة: الاسم | رابط التتبع، و{number} مكان رقم الشحنة. تأكد من الروابط مع شركتك." },
    ],
  },
  {
    key: "analytics",
    group: "marketing",
    name: "التحليلات وبكسلات الإعلانات",
    description: "يتتبع الزيارات والإضافة للسلة وبدء الدفع والشراء، ويرسلها لـ Google وMeta وتيك توك وسناب شات. حط المعرّفات اللي تستخدمها بس.",
    fields: [
      { name: "ga4", label: "تحليلات قوقل (GA4)", type: "text", placeholder: "G-XXXXXXXXXX" },
      { name: "gtm", label: "مدير وسوم قوقل (GTM)", type: "text", placeholder: "GTM-XXXXXXX" },
      { name: "googleAds", label: "إعلانات قوقل — معرّف التحويل", type: "text", placeholder: "AW-XXXXXXXXX/xxxxxxxx", help: "معرّف التحويل مع التسمية، يرسل حدث الشراء لإعلانات Google" },
      { name: "metaPixel", label: "بكسل ميتا (فيسبوك وانستقرام)", type: "text", placeholder: "123456789012345" },
      { name: "tiktokPixel", label: "بكسل تيك توك", type: "text", placeholder: "CXXXXXXXXXXXXXXXXX" },
      { name: "snapPixel", label: "بكسل سناب شات", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    ],
  },
  {
    key: "feed",
    group: "marketing",
    name: "ملف المنتجات (كتالوج)",
    description: "رابط ملف XML فيه كل منتجاتك، تربطه مع Google Merchant Center وكتالوج Meta وتيك توك وسناب للإعلانات والتسوق. يحتاج رابط الموقع في الإعدادات، والمنتجات اللي ما لها صورة ما تطلع فيه.",
    fields: [],
  },
  {
    key: "webhook",
    group: "automation",
    name: "الربط التلقائي (Webhook)",
    description: "نرسل كل حدث لرابط تختاره: طلب جديد، تغيّر حالة، دفع، قائمة مدرسة. اربطه مع Zapier أو Make أو n8n أو Google Sheets.",
    fields: [
      { name: "url", label: "الرابط", type: "text", placeholder: "https://hooks.zapier.com/…", required: true },
      { name: "secret", label: "مفتاح التوقيع (اختياري)", type: "secret", help: "يجي في الهيدر X-Satr-Signature كـ sha256=HMAC" },
    ],
  },
];

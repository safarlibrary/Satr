// إعدادات المتجر الافتراضية (تتغيّر من لوحة التحكم ← الإعدادات)
export const DEFAULT_SETTINGS = {
  storeName: "سطر",
  storeUrl: "",
  shippingFee: 25,
  freeShippingMin: 150,
  lowStock: 5,
  supportWhatsapp: "",
  // الهوية والتواصل — تظهر في الفوتر إذا عبّيتها
  officialEmail: "",
  senderName: "",
  freelanceNumber: "",
  businessCenterNumber: "",
  instagram: "",
  tiktok: "",
  snapchat: "",
  x: "",
  linkedin: "",
};

// اللي ينعرض للزوار في الموقع
export const PUBLIC_SETTING_KEYS = ["storeName", "supportWhatsapp", "officialEmail", "freelanceNumber", "businessCenterNumber", "instagram", "tiktok", "snapchat", "x", "linkedin"];

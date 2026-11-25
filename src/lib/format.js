export const formatPrice = (c) => `${c.toLocaleString("ar-SA")} ر.س`;

export const FREE_SHIPPING_MIN = 150;

export const SHIPPING_FEE = 25;

// طرق الدفع المفعّلة فعلًا (حسب التكاملات): الإلكتروني يظهر بس إذا ميسّر أو تابي شغّال
export function paymentMethods({ onlinePayment, tabby }) {
  return [
    ...(onlinePayment ? ["مدى", "Apple Pay", "STC Pay"] : []),
    ...(tabby ? ["تابي"] : []),
    "الدفع عند الاستلام",
  ];
}


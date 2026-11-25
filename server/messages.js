import { getSettings } from "./db.js";
import { getConfig, trackingUrl } from "./integrations/index.js";
import * as email from "./integrations/email.js";
import * as smtp from "./integrations/smtp.js";
import { formatSar } from "./util.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const STATUS = { new: "استلمنا طلبك", preparing: "نجهّز طلبك", shipped: "في الطريق", delivered: "وصل", cancelled: "ملغي" };
const PAY = { cod: "عند الاستلام", paid: "مدفوع", awaiting_payment: "بانتظار الدفع" };

// يرسل بريد من SMTP إذا مشغّل، وإلا Resend
export async function sendEmail({ to, subject, text, html }) {
  if (getConfig("smtp").active) return smtp.send(getConfig("smtp").values, { to, subject, text, html });
  if (getConfig("email").active) return email.send(getConfig("email").values, { to, subject, text, html });
  throw new Error("فعّل البريد (SMTP أو Resend) من التكاملات أول");
}

const date = (iso) => new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

function itemsText(order) {
  return order.items.map((i) => `• ${i.name}${i.color ? ` (${i.color})` : ""} × ${i.qty} — ${formatSar(i.price * i.qty)}`).join("\n");
}

// جدول الفاتورة (HTML) — يُستخدم في البريد وفي صفحة الطباعة
export function invoiceTable(order) {
  const s = getSettings();
  const rows = order.items
    .map((i) => `<tr><td>${esc(i.name)}${i.color ? ` <small>(${esc(i.color)})</small>` : ""}</td><td>${i.qty}</td><td>${esc(formatSar(i.price))}</td><td>${esc(formatSar(i.price * i.qty))}</td></tr>`)
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px" dir="rtl">
<thead><tr style="background:#cbe4da"><th style="text-align:right;padding:8px">المنتج</th><th style="padding:8px">الكمية</th><th style="padding:8px">السعر</th><th style="padding:8px">المجموع</th></tr></thead>
<tbody>${rows.replace(/<td>/g, '<td style="padding:8px;border-bottom:1px solid #eee">')}</tbody>
<tfoot>
<tr><td colspan="3" style="padding:6px 8px">المنتجات</td><td style="padding:6px 8px">${esc(formatSar(order.subtotal))}</td></tr>
<tr><td colspan="3" style="padding:6px 8px">التوصيل</td><td style="padding:6px 8px">${order.shipping ? esc(formatSar(order.shipping)) : "مجاني"}</td></tr>
<tr style="font-weight:800"><td colspan="3" style="padding:8px">الإجمالي</td><td style="padding:8px">${esc(formatSar(order.total))}</td></tr>
</tfoot></table>
<p style="font-size:13px;color:#675e6b">رقم الطلب ${esc(order.number)} · ${esc(date(order.createdAt))} · الدفع: ${esc(PAY[order.paymentStatus] ?? order.paymentStatus)}${s.freelanceNumber ? ` · وثيقة العمل الحر ${esc(s.freelanceNumber)}` : ""}${s.businessCenterNumber ? ` · مركز الأعمال ${esc(s.businessCenterNumber)}` : ""}</p>`;
}

function values(order) {
  const s = getSettings();
  return {
    "{الاسم}": order.customer.name,
    "{الجوال}": order.customer.phone,
    "{رقم_الطلب}": order.number,
    "{الإجمالي}": formatSar(order.total),
    "{التاريخ}": date(order.createdAt),
    "{الحالة}": STATUS[order.status] ?? order.status,
    "{المدينة}": order.customer.city,
    "{العنوان}": `${order.customer.city}، ${order.customer.district}، ${order.customer.address}`,
    "{شركة_الشحن}": order.carrier ?? "",
    "{رقم_الشحنة}": order.trackingNumber ?? "",
    "{رابط_التتبع}": trackingUrl(order.carrier, order.trackingNumber) ?? (s.storeUrl ? `${s.storeUrl}/#/track` : ""),
    "{اسم_المتجر}": s.storeName,
    "{المنتجات}": itemsText(order),
  };
}

export const PLACEHOLDERS = ["{الاسم}", "{الجوال}", "{رقم_الطلب}", "{الإجمالي}", "{التاريخ}", "{الحالة}", "{المدينة}", "{العنوان}", "{شركة_الشحن}", "{رقم_الشحنة}", "{رابط_التتبع}", "{المنتجات}", "{الفاتورة}", "{اسم_المتجر}"];

// يعبّي القالب ببيانات الطلب: نسخة نص ونسخة HTML
export function renderTemplate(template, order) {
  const v = values(order);
  const fill = (str, html) =>
    Object.entries(v).reduce((acc, [k, val]) => acc.split(k).join(html ? esc(val) : val), html ? esc(str) : str);
  const subject = fill(template.subject, false).replace("{الفاتورة}", "");
  const text = fill(template.body, false).replace("{الفاتورة}", `${itemsText(order)}\nالتوصيل: ${order.shipping ? formatSar(order.shipping) : "مجاني"}\nالإجمالي: ${formatSar(order.total)}`);
  const bodyHtml = fill(template.body, true).replace(/\n/g, "<br>").replace("{الفاتورة}", invoiceTable(order));
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#3b3242;max-width:640px">${bodyHtml}</div>`;
  return { subject, text, html };
}

// صفحة فاتورة كاملة للطباعة
export function invoicePage(order) {
  const s = getSettings();
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${esc(order.number)}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;color:#3b3242;margin:32px;max-width:760px}h1{margin:0 0 4px}small{color:#675e6b}.box{border:2px solid #3b3242;border-radius:14px;padding:16px;margin:16px 0}@media print{button{display:none}}</style></head>
<body><button onclick="print()" style="float:left;padding:8px 18px;border-radius:10px;border:2px solid #3b3242;background:#fdecaa;font:inherit;cursor:pointer">طباعة</button>
<h1>${esc(s.storeName)}</h1><small>${esc(s.storeUrl || "")} ${s.officialEmail ? `· ${esc(s.officialEmail)}` : ""}</small>
<div class="box"><b>فاتورة الطلب ${esc(order.number)}</b><br>${esc(order.customer.name)} · <span dir="ltr">${esc(order.customer.phone)}</span><br>${esc(order.customer.city)}، ${esc(order.customer.district)}، ${esc(order.customer.address)}</div>
${invoiceTable(order)}</body></html>`;
}

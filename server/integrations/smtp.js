import nodemailer from "nodemailer";
import { getSettings } from "../db.js";

// البريد عن طريق حساب بريدك (SMTP) — مثل Gmail أو Outlook أو بريد الدومين
// Gmail: الخادم smtp.gmail.com والمنفذ 465، وكلمة مرور تطبيق من إعدادات الأمان (مو كلمة المرور العادية)
export function send(cfg, { to, subject, text, html }) {
  const port = Number(cfg.port) || 465;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 15_000,
  });
  const settings = getSettings();
  const name = cfg.fromName || settings.senderName || settings.storeName;
  const from = name ? `"${name.replace(/"/g, "")}" <${cfg.user}>` : cfg.user;
  return transport.sendMail({ from, to: to || cfg.ownerEmail || cfg.user, subject, text, ...(html ? { html } : {}) });
}

export async function test(cfg) {
  await send(cfg, { subject: "تجربة بريد متجر سطر", text: "إذا وصلتك هذي الرسالة، فالبريد (SMTP) مربوط صح ✅" });
  return `انرسلت رسالة تجريبية إلى ${cfg.ownerEmail || cfg.user}`;
}

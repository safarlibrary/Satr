import { createHash, randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import {
  addReview, addStockAlert, createCustomerSession, deleteCustomerSession, deleteOtp, findCustomerSession, getCustomer, getOrderByNumber,
  getOtp, bumpOtp, getProduct, getSettings, listReviews, ordersByPhone, reviewsByPhone, saveCart, saveOtp, upsertCustomer,
} from "../db.js";
import { ENV } from "../env.js";
import { getConfig, trackingUrl } from "../integrations/index.js";
import * as sms from "../integrations/sms.js";
import { fail, isSaudiMobile, normalizePhone, rateLimit, safeEqual } from "../util.js";
import { handle } from "./helpers.js";

export const customerRouter = Router();

const sha256 = (v) => createHash("sha256").update(String(v)).digest("hex");
const OTP_TTL = 5 * 60 * 1000;

// العميل المسجّل: الهيدر X-Customer-Token
export function currentCustomer(req) {
  const token = req.get("x-customer-token");
  if (!token) return null;
  const id = findCustomerSession(sha256(token));
  return id ? getCustomer(id) : null;
}
const requireCustomer = (req) => currentCustomer(req) ?? fail(401, "سجّل دخولك برقم جوالك أول");

// ───────── تسجيل الدخول برمز يوصل SMS ─────────
customerRouter.post(
  "/auth/otp",
  rateLimit("otp", 6, 15 * 60 * 1000),
  handle(async (req, res) => {
    const raw = req.body?.phone;
    if (!isSaudiMobile(raw)) fail(400, "رقم الجوال لازم يبدأ بـ 05 ويكون 10 أرقام");
    const phone = normalizePhone(raw);
    const previous = getOtp(phone);
    if (previous && Date.now() - previous.sent_at < 60_000) fail(429, "انتظر دقيقة قبل ما تطلب رمز جديد");
    const code = String(randomInt(1000, 10000));
    const smsConfig = getConfig("sms");
    if (!smsConfig.active && ENV.isProduction) fail(503, "التسجيل برقم الجوال غير متاح حالياً");
    saveOtp(phone, sha256(`${phone}:${code}`), OTP_TTL);
    if (smsConfig.active) {
      try {
        await sms.send(smsConfig.values, phone, `رمز الدخول لمتجر ${getSettings().storeName}: ${code}\nلا تشاركه مع أحد.`);
      } catch (error) {
        console.error(`[otp] ${error.message}`);
        fail(502, "ما قدرنا نرسل الرسالة، جرّب بعد شوي");
      }
      return res.json({ sent: true });
    }
    // وضع التطوير بدون SMS: الرمز يطلع في السيرفر والصفحة عشان تقدر تجرّب
    console.log(`[otp] ${phone}: ${code}`);
    res.json({ sent: true, devCode: code });
  }),
);

customerRouter.post("/auth/verify", rateLimit("otp-verify", 20, 15 * 60 * 1000), (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? "").replace(/\D/g, "");
  const otp = getOtp(phone);
  if (!otp || otp.expires_at < Date.now()) fail(400, "الرمز انتهى، اطلب رمز جديد");
  if (otp.attempts >= 5) fail(429, "محاولات كثيرة، اطلب رمز جديد");
  if (!safeEqual(sha256(`${phone}:${code}`), otp.code_hash)) {
    bumpOtp(phone);
    fail(400, "الرمز غلط");
  }
  deleteOtp(phone);
  // أول تسجيل: ناخذ الاسم من آخر طلب بنفس الرقم
  const lastOrder = ordersByPhone(phone)[0];
  const existing = upsertCustomer(phone, { login: true });
  const customer = existing.name || !lastOrder ? existing : upsertCustomer(phone, { name: lastOrder.customer.name });
  const token = randomBytes(32).toString("base64url");
  createCustomerSession(sha256(token), customer.id);
  res.json({ token, customer });
});

customerRouter.post("/auth/logout", (req, res) => {
  const token = req.get("x-customer-token");
  if (token) deleteCustomerSession(sha256(token));
  res.json({ ok: true });
});

// ───────── حسابي: الطلبات والتقييمات ─────────
customerRouter.get("/me", (req, res) => {
  const customer = requireCustomer(req);
  const orders = ordersByPhone(customer.phone).map((o) => ({
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: o.total,
    subtotal: o.subtotal,
    shipping: o.shipping,
    createdAt: o.createdAt,
    items: o.items,
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: trackingUrl(o.carrier, o.trackingNumber),
  }));
  res.json({ customer, orders, reviews: reviewsByPhone(customer.phone) });
});

customerRouter.put("/me", (req, res) => {
  const customer = requireCustomer(req);
  const name = String(req.body?.name ?? customer.name).trim().slice(0, 60);
  const email = String(req.body?.email ?? customer.email).trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "البريد غير صحيح");
  res.json(upsertCustomer(customer.phone, { name, email }));
});

// ───────── التقييمات ─────────
customerRouter.get("/products/:id/reviews", (req, res) => {
  const short = (name) => String(name).trim().split(/\s+/)[0] || "عميل";
  res.json(listReviews({ productId: req.params.id }).map((r) => ({ id: r.id, name: short(r.name), rating: r.rating, comment: r.comment, createdAt: r.createdAt })));
});

customerRouter.post("/reviews", rateLimit("reviews", 20, 60 * 60 * 1000), (req, res) => {
  const customer = requireCustomer(req);
  const { orderNumber, productId, comment } = req.body ?? {};
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, "اختر من نجمة إلى ٥ نجوم");
  const order = getOrderByNumber(String(orderNumber ?? ""));
  if (!order || order.customer.phone !== customer.phone) fail(404, "الطلب غير موجود");
  if (order.status !== "delivered") fail(400, "تقدر تقيّم بعد ما يوصلك الطلب");
  if (!order.items.some((i) => i.id === productId)) fail(400, "المنتج مو في هذا الطلب");
  addReview({ productId, orderNumber: order.number, phone: customer.phone, name: customer.name || order.customer.name, rating, comment: String(comment ?? "").trim().slice(0, 600) });
  res.json({ ok: true });
});

// ───────── نبّهني إذا توفّر ─────────
customerRouter.post("/stock-alerts", rateLimit("alerts", 20, 60 * 60 * 1000), (req, res) => {
  const product = getProduct(String(req.body?.productId ?? ""));
  if (!product || !product.active) fail(404, "المنتج غير موجود");
  if (!isSaudiMobile(req.body?.phone)) fail(400, "رقم الجوال لازم يبدأ بـ 05 ويكون 10 أرقام");
  const color = String(req.body?.color ?? "");
  if (color && !(product.colors ?? []).includes(color)) fail(400, "اللون غير موجود");
  addStockAlert(product.id, color, normalizePhone(req.body.phone));
  res.json({ ok: true });
});

// ───────── السلة (للسلات المتروكة) ─────────
customerRouter.post("/carts", rateLimit("carts", 120, 10 * 60 * 1000), (req, res) => {
  const id = String(req.body?.id ?? "");
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) fail(400, "سلة غير صحيحة");
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 60).flatMap((line) => {
    const p = getProduct(String(line?.id ?? ""));
    const qty = Math.min(99, Math.max(0, Math.floor(Number(line?.qty) || 0)));
    return p && qty ? [{ id: p.id, name: p.name, price: p.price, qty, color: line.color || undefined }] : [];
  });
  const customer = currentCustomer(req);
  const phone = customer?.phone ?? (isSaudiMobile(req.body?.phone) ? normalizePhone(req.body.phone) : "");
  const name = customer?.name || String(req.body?.name ?? "").trim().slice(0, 60);
  saveCart({ id, name, phone, items, total: items.reduce((s, i) => s + i.price * i.qty, 0) });
  res.json({ ok: true });
});

// ───────── الخريطة: العنوان من الموقع (OpenStreetMap) ─────────
const geoCache = new Map();
async function nominatim(path) {
  if (geoCache.has(path)) return geoCache.get(path);
  const response = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { "User-Agent": "SatrStore/1.0", "Accept-Language": "ar" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);
  const data = await response.json();
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(path, data);
  return data;
}

customerRouter.get(
  "/geo/reverse",
  rateLimit("geo", 60, 60 * 1000),
  handle(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(400, "موقع غير صحيح");
    try {
      const data = await nominatim(`reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`);
      const a = data?.address ?? {};
      res.json({
        district: a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential || "",
        street: [a.road, a.house_number].filter(Boolean).join(" "),
        city: a.city || a.town || a.village || a.county || "",
      });
    } catch {
      fail(502, "ما قدرنا نجيب العنوان، اكتبه يدوي");
    }
  }),
);

customerRouter.get(
  "/geo/search",
  rateLimit("geo", 60, 60 * 1000),
  handle(async (req, res) => {
    const q = String(req.query.q ?? "").trim().slice(0, 80);
    if (!q) fail(400, "اكتب اسم المدينة");
    try {
      const data = await nominatim(`search?format=jsonv2&limit=1&countrycodes=sa&q=${encodeURIComponent(q)}`);
      const hit = data?.[0];
      res.json(hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null);
    } catch {
      res.json(null);
    }
  }),
);

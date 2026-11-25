import { createHash, randomBytes, randomInt } from "node:crypto";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import {
  categories, changeStock, deleteAlert, deleteCart, deleteReview, deleteTemplate, getTemplate, listAbandonedCarts, listCustomers, listReviews,
  listStockAlerts, listTemplates, markAlertNotified, markCartReminded, saveTemplate, setReviewHidden, findDevice, insertDevice, listDevices, revokeDevice, getOrder, getProduct, getSchoolList, getSettings, insertProduct, listLogs, listOrders, listProducts,
  listSchoolLists, addLog, saveSettings, setProductActive, setProductImage, updateOrder, updateProduct, UPLOADS_DIR,
} from "../db.js";
import { ENV } from "../env.js";
import { adminView, carriers, getDefinition, publicConfig, saveConfig, testIntegration, trackingUrl } from "../integrations/index.js";
import { notifyBackInStock, orderPaid, orderStatusChanged } from "../notify.js";
import { invoicePage, PLACEHOLDERS, renderTemplate, sendEmail } from "../messages.js";
import * as sms from "../integrations/sms.js";
import { getConfig } from "../integrations/index.js";
import { EXTENSIONS, fail, parseDataUrl, rateLimit, safeEqual } from "../util.js";
import { baseUrl, handle } from "./helpers.js";

export const adminRouter = Router();

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function describeDevice(ua = "") {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "جهاز";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "متصفح";
  return `${os} · ${browser}`;
}

// الدخول: التوكن (ADMIN_TOKEN) يُكتب مرة وحدة على كل جهاز، وبعدها الجهاز يدخل بمفتاحه الخاص.
// تقدر تلغي أي جهاز من الإعدادات ← الأجهزة.
adminRouter.post("/login", rateLimit("admin-login", 10, 15 * 60 * 1000), (req, res) => {
  const token = String(req.body?.token ?? "");
  if (!token || !safeEqual(token, ENV.adminToken)) return res.status(401).json({ error: "التوكن غلط" });
  const deviceToken = randomBytes(32).toString("base64url");
  insertDevice(sha256(deviceToken), describeDevice(req.get("user-agent")));
  res.json({ deviceToken });
});

// كل مسارات الإدارة الباقية تحتاج مفتاح جهاز مسجّل (أو ADMIN_TOKEN نفسه للسكربتات)
adminRouter.use(rateLimit("admin", 300, 5 * 60 * 1000), (req, res, next) => {
  const token = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token && safeEqual(token, ENV.adminToken)) return next();
  const device = token ? findDevice(sha256(token)) : null;
  if (!device) return res.status(401).json({ error: "انتهت صلاحية الدخول من هذا الجهاز، ادخل بالتوكن من جديد" });
  req.device = device;
  next();
});

adminRouter.get("/devices", (req, res) => res.json(listDevices().map((d) => ({ ...d, current: d.id === req.device?.id }))));

adminRouter.post("/devices/:id/revoke", (req, res) => {
  revokeDevice(Number(req.params.id));
  res.json({ ok: true, signedOut: Number(req.params.id) === req.device?.id });
});

const STATUSES = ["new", "preparing", "shipped", "delivered", "cancelled"];
const ARTS = ["pencil", "notebook", "backpack", "ruler", "crayons", "eraser", "scissors", "pencilcase", "highlighter", "glue", "sharpener", "geometry", "tote", "sticky", "calendar"];
const BADGES = ["جديد", "خصم", "الأكثر طلبًا"];

adminRouter.get("/status", (req, res) => res.json({ onlinePayment: publicConfig().onlinePayment }));

// ───────── نظرة عامة ─────────
adminRouter.get("/overview", (req, res) => {
  const orders = listOrders().filter((o) => o.status !== "cancelled");
  const today = new Date().toISOString().slice(0, 10);
  const settings = getSettings();
  const sum = (list) => list.reduce((s, o) => s + o.total, 0);
  const isCounted = (o) => o.paymentMethod === "cod" || o.paymentStatus === "paid";
  res.json({
    ordersToday: orders.filter((o) => o.createdAt.startsWith(today)).length,
    salesToday: sum(orders.filter((o) => o.createdAt.startsWith(today) && isCounted(o))),
    salesTotal: sum(orders.filter(isCounted)),
    openOrders: orders.filter((o) => o.status === "new" || o.status === "preparing").length,
    awaitingPayment: orders.filter((o) => o.paymentStatus === "awaiting_payment").length,
    lowStock: listProducts({ includeHidden: true })
      .filter((p) => p.active && p.stock <= Number(settings.lowStock))
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
  });
});

// ───────── الطلبات ─────────
adminRouter.get("/orders", (req, res) => {
  const products = new Map(listProducts({ includeHidden: true }).map((p) => [p.id, p]));
  res.json(
    listOrders().map((o) => ({
      id: o.id, number: o.number, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      paymentProvider: o.paymentProvider, customer: o.customer, total: o.total, subtotal: o.subtotal, shipping: o.shipping,
      createdAt: o.createdAt, carrier: o.carrier, trackingNumber: o.trackingNumber,
      trackingUrl: trackingUrl(o.carrier, o.trackingNumber), note: o.note, location: o.location,
      // كم باقي في المخزون من كل منتج (ومن نفس اللون)
      items: o.items.map((i) => {
        const p = products.get(i.id);
        return { ...i, remaining: p ? (i.color && p.colorStock?.[i.color] !== undefined ? p.colorStock[i.color] : p.stock) : null };
      }),
    })),
  );
});

adminRouter.get("/carriers", (req, res) => res.json(carriers().map((c) => c.name)));

adminRouter.patch("/orders/:id", (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) fail(404, "الطلب غير موجود");
  const { status, carrier, trackingNumber } = req.body ?? {};
  const changes = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) fail(400, "حالة غير صحيحة");
    changes.status = status;
    // الإلغاء يرجّع الكميات للمخزون، والرجوع عن الإلغاء يحجزها من جديد
    if (status === "cancelled" && !order.stockReleased) {
      for (const item of order.items) changeStock(item.id, item.qty, item.color);
      changes.stockReleased = true;
    }
    if (status !== "cancelled" && order.stockReleased) {
      for (const item of order.items) changeStock(item.id, -item.qty, item.color);
      changes.stockReleased = false;
    }
  }
  if (carrier !== undefined) changes.carrier = String(carrier).trim().slice(0, 80) || null;
  if (trackingNumber !== undefined) changes.trackingNumber = String(trackingNumber).trim().slice(0, 80) || null;
  const updated = updateOrder(order.id, changes);
  if (status !== undefined && status !== order.status) orderStatusChanged(updated, order.status);
  res.json({ ok: true });
});

adminRouter.post("/orders/:id/mark-paid", (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) fail(404, "الطلب غير موجود");
  if (order.paymentStatus !== "paid") orderPaid(updateOrder(order.id, { paymentStatus: "paid" }));
  res.json({ ok: true });
});

// ───────── المنتجات ─────────
adminRouter.get("/products", (req, res) => res.json({ categories, products: listProducts({ includeHidden: true }) }));

function cleanProduct(body, { id, stockFallback = 0 } = {}) {
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const stock = body.stock === undefined || body.stock === "" ? stockFallback : Number(body.stock);
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(id)) fail(400, "المعرّف لازم يكون بالإنجليزي الصغير والأرقام والشرطة فقط، مثل blue-pen");
  if (name.length < 2) fail(400, "اكتب اسم المنتج");
  if (!categories.some((c) => c.id === body.category)) fail(400, "اختر القسم");
  if (!Number.isFinite(price) || price <= 0) fail(400, "اكتب سعر صحيح");
  if (!Number.isInteger(stock) || stock < 0) fail(400, "المخزون لازم يكون رقم صحيح");
  const oldPrice = body.oldPrice ? Number(body.oldPrice) : undefined;
  if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice <= price)) fail(400, "سعر قبل الخصم لازم يكون أعلى من السعر");
  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : []);
  return {
    id,
    name,
    category: body.category,
    price,
    oldPrice,
    art: ARTS.includes(body.art) ? body.art : "notebook",
    tint: /^var\(--color-[a-z-]+\)$|^#[0-9a-f]{3,8}$/i.test(String(body.tint ?? "")) ? body.tint : "var(--color-mint)",
    badge: BADGES.includes(body.badge) ? body.badge : undefined,
    description: String(body.description ?? "").trim(),
    details: list(body.details),
    stock,
    brand: String(body.brand ?? "").trim() || undefined,
    madeIn: String(body.madeIn ?? "").trim() || undefined,
    colors: list(body.colors),
    cost: body.cost === undefined || body.cost === "" ? undefined : Math.max(0, Number(body.cost) || 0),
  };
}

// كمية كل لون (اختياري): لو انرسلت، المخزون الكلي = مجموعها
function withColorStock(product, body, previous) {
  const raw = body.colorStock && typeof body.colorStock === "object" ? body.colorStock : previous;
  if (!raw || !product.colors.length) return { ...product, colorStock: undefined };
  const colorStock = {};
  for (const c of product.colors) {
    const n = Number(raw[c] ?? 0);
    if (!Number.isInteger(n) || n < 0) fail(400, `كمية اللون ${c} لازم تكون رقم صحيح`);
    colorStock[c] = n;
  }
  const hasAny = body.colorStock && typeof body.colorStock === "object";
  return { ...product, colorStock, stock: hasAny ? Object.values(colorStock).reduce((a, b) => a + b, 0) : product.stock };
}

adminRouter.post("/products", (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  if (getProduct(id)) fail(409, "فيه منتج بنفس المعرّف");
  res.json(insertProduct({ ...withColorStock(cleanProduct(req.body ?? {}, { id }), req.body ?? {}), active: true }));
});

adminRouter.put("/products/:id", (req, res) => {
  const existing = getProduct(req.params.id);
  if (!existing) fail(404, "المنتج غير موجود");
  const clean = cleanProduct(req.body ?? {}, { id: existing.id, stockFallback: existing.stock });
  // صور الألوان والصور الإضافية تتعدّل من أزرار الصور، نحتفظ فيها للألوان اللي ما زالت موجودة
  const keep = (map) => (map ? Object.fromEntries(Object.entries(map).filter(([c]) => clean.colors.includes(c))) : undefined);
  const next = withColorStock({ ...clean, cost: clean.cost ?? existing.cost }, req.body ?? {}, keep(existing.colorStock));
  const updated = updateProduct(existing.id, { ...next, colorImages: keep(existing.colorImages), images: existing.images });
  notifyBackInStock(existing, updated);
  res.json(updated);
});

adminRouter.post("/products/:id/active", (req, res) => {
  const existing = getProduct(req.params.id);
  if (!existing) fail(404, "المنتج غير موجود");
  setProductActive(existing.id, Boolean(req.body?.active));
  res.json(getProduct(existing.id));
});

adminRouter.post("/products/:id/image", (req, res) => {
  const existing = getProduct(req.params.id);
  if (!existing) fail(404, "المنتج غير موجود");
  const parsed = parseDataUrl(req.body?.file, ["image/jpeg", "image/png", "image/webp"]);
  if (!parsed) fail(400, "الصورة لازم تكون JPG أو PNG أو WebP");
  if (parsed.buffer.length > 7 * 1024 * 1024) fail(400, "الصورة أكبر من 7 ميجا");
  // cover: صورة مصمّمة بخلفيتها تملأ البطاقة. color: صورة لون معيّن. extra: صورة إضافية (زاوية ثانية)
  const { color, cover, extra } = req.body ?? {};
  if (color && !(existing.colors ?? []).includes(color)) fail(400, "اللون غير موجود");
  const name = `${existing.id}-${Date.now()}-${randomInt(1000, 9999)}${cover ? "-cover" : ""}.${EXTENSIONS[parsed.mime]}`;
  writeFileSync(path.join(UPLOADS_DIR, "products", name), parsed.buffer);
  const url = `/uploads/products/${name}`;
  if (color) {
    removeUpload(existing.colorImages?.[color]);
    updateProduct(existing.id, { ...existing, colorImages: { ...(existing.colorImages ?? {}), [color]: url } });
  } else if (extra) {
    updateProduct(existing.id, { ...existing, images: [...(existing.images ?? []), url].slice(0, 12) });
  } else {
    removeUpload(existing.image);
    setProductImage(existing.id, url);
  }
  res.json(getProduct(existing.id));
});

adminRouter.post("/products/:id/images/remove", (req, res) => {
  const existing = getProduct(req.params.id);
  if (!existing) fail(404, "المنتج غير موجود");
  const url = String(req.body?.url ?? "");
  removeUpload(url);
  updateProduct(existing.id, { ...existing, images: (existing.images ?? []).filter((u) => u !== url) });
  res.json(getProduct(existing.id));
});

// نحذف الصورة القديمة لو كانت مرفوعة من اللوحة (صور المشروع نفسه ما تنحذف)
function removeUpload(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/products/")) return;
  const file = path.join(UPLOADS_DIR, "products", path.basename(url));
  if (existsSync(file)) unlinkSync(file);
}

// ───────── قوائم المدارس ─────────
adminRouter.get("/school-lists", (req, res) =>
  res.json(listSchoolLists().map((l) => ({ ...l, file: l.file ? `/api/admin/school-lists/${l.id}/file` : null }))),
);

adminRouter.get("/school-lists/:id/file", (req, res) => {
  const list = getSchoolList(Number(req.params.id));
  if (!list?.file) fail(404, "ما فيه ملف");
  res.type(list.fileType ?? "application/octet-stream");
  res.sendFile(path.join(UPLOADS_DIR, "school-lists", path.basename(list.file)));
});

// ───────── الإعدادات ─────────
adminRouter.get("/settings", (req, res) => res.json(getSettings()));

adminRouter.put("/settings", (req, res) => {
  const body = req.body ?? {};
  const values = {};
  if (body.storeName !== undefined) values.storeName = String(body.storeName).trim().slice(0, 60) || "سطر";
  if (body.storeUrl !== undefined) {
    const url = String(body.storeUrl).trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\/[^\s/]+$/.test(url)) fail(400, "رابط الموقع لازم يكون مثل https://satr.sa بدون مسار");
    values.storeUrl = url;
  }
  for (const key of ["shippingFee", "freeShippingMin", "lowStock"]) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) fail(400, "الأرقام لازم تكون صفر أو أكثر");
    values[key] = n;
  }
  if (body.supportWhatsapp !== undefined) values.supportWhatsapp = String(body.supportWhatsapp).replace(/[^\d+]/g, "").slice(0, 16);
  if (body.officialEmail !== undefined) {
    const email = String(body.officialEmail).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "البريد الرسمي غير صحيح");
    values.officialEmail = email;
  }
  for (const key of ["senderName", "freelanceNumber", "businessCenterNumber"]) {
    if (body[key] !== undefined) values[key] = String(body[key]).trim().slice(0, 80);
  }
  for (const key of ["instagram", "tiktok", "snapchat", "x", "linkedin"]) {
    if (body[key] === undefined) continue;
    const url = String(body[key]).trim();
    if (url && !/^https:\/\/[^\s]+$/.test(url)) fail(400, "روابط الحسابات لازم تبدأ بـ https://");
    values[key] = url.slice(0, 200);
  }
  res.json(saveSettings(values));
});

// ───────── التكاملات ─────────
adminRouter.get("/integrations", (req, res) => {
  res.json({ integrations: adminView(), logs: listLogs(40), feedUrl: `${baseUrl(req)}/feed/products.xml`, callbackUrl: `${baseUrl(req)}/api/payments/moyasar/webhook` });
});

adminRouter.put("/integrations/:key", (req, res) => {
  if (!getDefinition(req.params.key)) fail(404, "تكامل غير معروف");
  const { enabled, values, clear } = req.body ?? {};
  saveConfig(req.params.key, { enabled, values: values ?? {}, clear: Array.isArray(clear) ? clear : [] });
  res.json({ ok: true });
});

adminRouter.post(
  "/integrations/:key/test",
  handle(async (req, res) => {
    if (!getDefinition(req.params.key)) fail(404, "تكامل غير معروف");
    try {
      res.json({ ok: true, message: await testIntegration(req.params.key) });
    } catch (error) {
      res.json({ ok: false, message: error?.message ?? String(error) });
    }
  }),
);

// ───────── الإحصائيات والمخزون ─────────
const counted = (o) => o.status !== "cancelled";
adminRouter.get("/stats", (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const products = listProducts({ includeHidden: true });
  const byId = new Map(products.map((p) => [p.id, p]));
  const orders = listOrders().filter(counted);
  const since = Date.now() - days * 86400000;
  const inRange = orders.filter((o) => Date.parse(o.createdAt) >= since);
  const costOf = (o) => o.items.reduce((s, i) => s + (byId.get(i.id)?.cost ?? 0) * i.qty, 0);
  const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

  // المبيعات اليومية
  const daily = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const list = inRange.filter((o) => o.createdAt.startsWith(day));
    daily.push({ day, orders: list.length, revenue: sum(list, (o) => o.subtotal) });
  }

  // المباع لكل منتج ولون (من كل الطلبات غير الملغية)
  const sold = new Map();
  for (const o of orders)
    for (const i of o.items) {
      const k = `${i.id}|${i.color ?? ""}`;
      const row = sold.get(k) ?? { qty: 0, revenue: 0 };
      row.qty += i.qty;
      row.revenue += i.qty * i.price;
      sold.set(k, row);
    }
  const soldFor = (id, color) => sold.get(`${id}|${color ?? ""}`) ?? { qty: 0, revenue: 0 };

  const inventory = products.map((p) => {
    const colors = (p.colors ?? []).map((c) => {
      const s = soldFor(p.id, c);
      const remaining = p.colorStock?.[c];
      return { color: c, sold: s.qty, remaining: remaining ?? null, purchased: remaining !== undefined ? remaining + s.qty : null };
    });
    const soldTotal = colors.length ? colors.reduce((a, c) => a + c.sold, 0) + soldFor(p.id).qty : soldFor(p.id).qty;
    return { id: p.id, name: p.name, cost: p.cost ?? null, price: p.price, remaining: p.stock, sold: soldTotal, purchased: p.stock + soldTotal, colors, active: p.active };
  });

  const topMap = new Map();
  for (const o of inRange) for (const i of o.items) {
    const row = topMap.get(i.id) ?? { id: i.id, name: i.name, qty: 0, revenue: 0 };
    row.qty += i.qty; row.revenue += i.qty * i.price; topMap.set(i.id, row);
  }

  const revenue = sum(inRange, (o) => o.subtotal);
  const cost = sum(inRange, costOf);
  res.json({
    days,
    summary: {
      orders: inRange.length,
      revenue,
      shipping: sum(inRange, (o) => o.shipping),
      avgOrder: inRange.length ? Math.round(sum(inRange, (o) => o.total) / inRange.length) : 0,
      items: sum(inRange, (o) => o.items.reduce((s, i) => s + i.qty, 0)),
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      stockValue: Math.round(sum(products, (p) => (p.cost ?? 0) * p.stock)),
      stockUnits: sum(products, (p) => p.stock),
      outOfStock: products.filter((p) => p.active && p.stock <= 0).length,
    },
    daily,
    top: [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    inventory,
  });
});

// ───────── السلات المتروكة ─────────
adminRouter.get("/carts", (req, res) => res.json(listAbandonedCarts(60 * 60 * 1000)));
adminRouter.post("/carts/:id/reminded", (req, res) => { markCartReminded(req.params.id); res.json({ ok: true }); });
adminRouter.delete("/carts/:id", (req, res) => { deleteCart(req.params.id); res.json({ ok: true }); });
adminRouter.post(
  "/carts/:id/sms",
  handle(async (req, res) => {
    const cart = listAbandonedCarts(0).find((c) => c.id === req.params.id);
    if (!cart?.phone) fail(404, "السلة ما فيها رقم");
    if (!getConfig("sms").active) fail(400, "فعّل رسائل SMS من التكاملات أول");
    const s = getSettings();
    await sms.send(getConfig("sms").values, cart.phone, `${cart.name ? `هلا ${cart.name}، ` : ""}سلتك في ${s.storeName} تنتظرك 🛍️ ${s.storeUrl ? `${s.storeUrl}/#/checkout` : ""}`.trim());
    markCartReminded(cart.id);
    res.json({ ok: true });
  }),
);

// ───────── نبّهني إذا توفّر ─────────
adminRouter.get("/stock-alerts", (req, res) => {
  const products = new Map(listProducts({ includeHidden: true }).map((p) => [p.id, p]));
  res.json(listStockAlerts({ pending: req.query.all !== "1" }).map((a) => {
    const p = products.get(a.productId);
    const available = p ? (a.color ? (p.colorStock?.[a.color] ?? p.stock) : p.stock) : 0;
    return { ...a, productName: p?.name ?? a.productId, available };
  }));
});
adminRouter.post("/stock-alerts/:id/notified", (req, res) => { markAlertNotified(Number(req.params.id)); res.json({ ok: true }); });
adminRouter.delete("/stock-alerts/:id", (req, res) => { deleteAlert(Number(req.params.id)); res.json({ ok: true }); });

// ───────── التقييمات ─────────
adminRouter.get("/reviews", (req, res) => {
  const products = new Map(listProducts({ includeHidden: true }).map((p) => [p.id, p.name]));
  res.json(listReviews({ includeHidden: true }).map((r) => ({ ...r, productName: products.get(r.productId) ?? r.productId })));
});
adminRouter.post("/reviews/:id/hidden", (req, res) => { setReviewHidden(Number(req.params.id), Boolean(req.body?.hidden)); res.json({ ok: true }); });
adminRouter.delete("/reviews/:id", (req, res) => { deleteReview(Number(req.params.id)); res.json({ ok: true }); });

// ───────── العملاء ─────────
adminRouter.get("/customers", (req, res) => {
  const map = new Map();
  for (const c of listCustomers()) map.set(c.phone, { phone: c.phone, name: c.name, email: c.email, registered: Boolean(c.lastLoginAt), orders: [] });
  for (const o of listOrders()) {
    const row = map.get(o.customer.phone) ?? { phone: o.customer.phone, name: o.customer.name, email: o.customer.email ?? "", registered: false, orders: [] };
    if (!row.name) row.name = o.customer.name;
    if (!row.email && o.customer.email) row.email = o.customer.email;
    row.orders.push({ id: o.id, number: o.number, status: o.status, total: o.total, createdAt: o.createdAt, paymentStatus: o.paymentStatus });
    map.set(o.customer.phone, row);
  }
  const list = [...map.values()].map((c) => ({ ...c, spent: c.orders.filter(counted).reduce((s, o) => s + o.total, 0) }));
  list.sort((a, b) => (b.orders[0]?.createdAt ?? "").localeCompare(a.orders[0]?.createdAt ?? ""));
  res.json(list);
});

// ───────── قوالب الرسائل والفواتير ─────────
adminRouter.get("/templates", (req, res) => res.json({ templates: listTemplates(), placeholders: PLACEHOLDERS }));
adminRouter.post("/templates", (req, res) => {
  const { id, name, subject, body } = req.body ?? {};
  if (!String(name ?? "").trim() || !String(subject ?? "").trim() || !String(body ?? "").trim()) fail(400, "عبّي الاسم والعنوان والنص");
  res.json({ id: saveTemplate({ id: id ? Number(id) : undefined, name: String(name).trim().slice(0, 60), subject: String(subject).trim().slice(0, 200), body: String(body).slice(0, 8000) }) });
});
adminRouter.delete("/templates/:id", (req, res) => { deleteTemplate(Number(req.params.id)); res.json({ ok: true }); });

adminRouter.post("/orders/:id/preview-message", (req, res) => {
  const order = getOrder(Number(req.params.id)) ?? fail(404, "الطلب غير موجود");
  const template = getTemplate(Number(req.body?.templateId)) ?? fail(404, "القالب غير موجود");
  res.json(renderTemplate(template, order));
});

adminRouter.post(
  "/orders/:id/send-message",
  handle(async (req, res) => {
    const order = getOrder(Number(req.params.id)) ?? fail(404, "الطلب غير موجود");
    const template = getTemplate(Number(req.body?.templateId)) ?? fail(404, "القالب غير موجود");
    const to = String(req.body?.to ?? order.customer.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) fail(400, "اكتب بريد العميل");
    const message = renderTemplate(template, order);
    try {
      await sendEmail({ to, ...message });
      addLog(getConfig("smtp").active ? "smtp" : "email", `message:${template.name}`, true, `إلى ${to} — طلب ${order.number}`);
    } catch (error) {
      addLog(getConfig("smtp").active ? "smtp" : "email", `message:${template.name}`, false, error.message);
      fail(502, error.message);
    }
    res.json({ ok: true });
  }),
);

adminRouter.get("/orders/:id/invoice", (req, res) => {
  const order = getOrder(Number(req.params.id)) ?? fail(404, "الطلب غير موجود");
  res.type("html").send(invoicePage(order));
});

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CATEGORIES, SEED_PRODUCTS } from "../shared/catalog.js";
import { ENV } from "./env.js";
import { SEED_COSTS } from "./seed-costs.js";
import { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS } from "../shared/settings.js";

mkdirSync(ENV.dataDir, { recursive: true });
export const UPLOADS_DIR = path.join(ENV.dataDir, "uploads");
mkdirSync(path.join(UPLOADS_DIR, "products"), { recursive: true });
mkdirSync(path.join(UPLOADS_DIR, "school-lists"), { recursive: true });

// قاعدة بيانات SQLite — ملف واحد satr.db داخل DATA_DIR. انسخه احتياطيًا وتكون محتفظ بكل شي.
export const db = new DatabaseSync(path.join(ENV.dataDir, "satr.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    image TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'new',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    payment_provider TEXT,
    payment_ref TEXT,
    customer TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    total INTEGER NOT NULL,
    carrier TEXT,
    tracking_number TEXT,
    stock_released INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS school_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    stage TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    file TEXT,
    file_type TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS integrations (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS admin_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS integration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    integration TEXT NOT NULL,
    event TEXT NOT NULL,
    ok INTEGER NOT NULL,
    message TEXT NOT NULL
  );
`);

export const now = () => new Date().toISOString();

// أعمدة انضافت بعد أول إصدار (تنضاف تلقائيًا لقواعد البيانات القديمة)
function addColumn(table, column, type) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
addColumn("orders", "note", "TEXT");
addColumn("orders", "location", "TEXT");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customer_sessions (
    token_hash TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    order_number TEXT,
    reminded_at TEXT
  );
  CREATE TABLE IF NOT EXISTS stock_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL,
    notified_at TEXT,
    UNIQUE(product_id, color, phone)
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(product_id, order_number)
  );
  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL
  );
`);

// ───────── الأقسام ─────────
// الأقسام ثابتة في shared/catalog.js (لأن لكل قسم رسمة ولون). عدّلها من هناك.
export const categories = CATEGORIES;

// ───────── المنتجات ─────────
function rowToProduct(row) {
  if (!row) return null;
  return { ...JSON.parse(row.data), id: row.id, stock: row.stock, active: row.active === 1, image: row.image ?? undefined };
}

export const listProducts = ({ includeHidden = false } = {}) =>
  db
    .prepare(`SELECT * FROM products ${includeHidden ? "" : "WHERE active = 1"} ORDER BY position, rowid`)
    .all()
    .map(rowToProduct);

export const getProduct = (id) => rowToProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id));

// التكلفة للإدارة بس، ما تطلع للزوار
export function publicProduct(p) {
  if (!p) return p;
  const { cost, ...rest } = p;
  return rest;
}

const PRODUCT_FIELDS = ["name", "category", "price", "oldPrice", "art", "tint", "badge", "description", "details", "brand", "madeIn", "colors", "colorImages", "colorStock", "images", "cost"];
const productData = (product) => JSON.stringify(Object.fromEntries(PRODUCT_FIELDS.filter((k) => product[k] !== undefined).map((k) => [k, product[k]])));

export function insertProduct(product) {
  const position = (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM products").get().next) ?? 0;
  db.prepare("INSERT INTO products (id, position, data, stock, active, image) VALUES (?, ?, ?, ?, ?, ?)").run(
    product.id, position, productData(product), product.stock, product.active === false ? 0 : 1, product.image ?? null,
  );
  return getProduct(product.id);
}

export function updateProduct(id, product) {
  db.prepare("UPDATE products SET data = ?, stock = ? WHERE id = ?").run(productData(product), product.stock, id);
  return getProduct(id);
}

export const setProductActive = (id, active) => db.prepare("UPDATE products SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
export const setProductImage = (id, image) => db.prepare("UPDATE products SET image = ? WHERE id = ?").run(image, id);
// يغيّر المخزون الكلي، ومخزون اللون نفسه إذا المنتج له كمية لكل لون
export function changeStock(id, delta, color) {
  db.prepare("UPDATE products SET stock = MAX(stock + ?, 0) WHERE id = ?").run(delta, id);
  if (!color) return;
  const row = db.prepare("SELECT data FROM products WHERE id = ?").get(id);
  const data = row && JSON.parse(row.data);
  if (!data?.colorStock || data.colorStock[color] === undefined) return;
  data.colorStock[color] = Math.max(0, data.colorStock[color] + delta);
  db.prepare("UPDATE products SET data = ? WHERE id = ?").run(JSON.stringify(data), id);
}

// أول تشغيل: نعبّي المنتجات التجريبية
if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n === 0) {
  for (const product of SEED_PRODUCTS) insertProduct({ ...product, cost: SEED_COSTS[product.id], stock: product.stock ?? 25, active: true });
}

// ───────── الطلبات ─────────
function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider ?? undefined,
    paymentRef: row.payment_ref ?? undefined,
    customer: JSON.parse(row.customer),
    items: JSON.parse(row.items),
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    carrier: row.carrier ?? undefined,
    trackingNumber: row.tracking_number ?? undefined,
    stockReleased: row.stock_released === 1,
    note: row.note ?? "",
    location: row.location ? JSON.parse(row.location) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const listOrders = () => db.prepare("SELECT * FROM orders ORDER BY id DESC").all().map(rowToOrder);
export const getOrder = (id) => rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
export const getOrderByNumber = (number) => rowToOrder(db.prepare("SELECT * FROM orders WHERE number = ?").get(number));
export const getOrderByPaymentRef = (ref) => rowToOrder(db.prepare("SELECT * FROM orders WHERE payment_ref = ?").get(ref));

export function insertOrder(order) {
  const at = now();
  const result = db
    .prepare(
      `INSERT INTO orders (number, status, payment_method, payment_status, payment_provider, customer, items, subtotal, shipping, total, note, location, created_at, updated_at)
       VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(order.number, order.paymentMethod, order.paymentStatus, order.paymentProvider ?? null, JSON.stringify(order.customer), JSON.stringify(order.items), order.subtotal, order.shipping, order.total, order.note ?? "", order.location ? JSON.stringify(order.location) : null, at, at);
  return getOrder(Number(result.lastInsertRowid));
}

const ORDER_COLUMNS = { status: "status", paymentStatus: "payment_status", paymentRef: "payment_ref", carrier: "carrier", trackingNumber: "tracking_number", stockReleased: "stock_released" };
export function updateOrder(id, changes) {
  const entries = Object.entries(changes).filter(([k]) => ORDER_COLUMNS[k]);
  if (!entries.length) return getOrder(id);
  const sets = entries.map(([k]) => `${ORDER_COLUMNS[k]} = ?`).join(", ");
  const values = entries.map(([k, v]) => (k === "stockReleased" ? (v ? 1 : 0) : v ?? null));
  db.prepare(`UPDATE orders SET ${sets}, updated_at = ? WHERE id = ?`).run(...values, now(), id);
  return getOrder(id);
}

// ───────── قوائم المدارس ─────────
const rowToList = (row) => row && { id: row.id, name: row.name, phone: row.phone, stage: row.stage, text: row.text, file: row.file ?? null, fileType: row.file_type ?? null, createdAt: row.created_at };
export const listSchoolLists = () => db.prepare("SELECT * FROM school_lists ORDER BY id DESC").all().map(rowToList);
export const getSchoolList = (id) => rowToList(db.prepare("SELECT * FROM school_lists WHERE id = ?").get(id));
export function insertSchoolList(list) {
  const result = db
    .prepare("INSERT INTO school_lists (name, phone, stage, text, file, file_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(list.name, list.phone, list.stage, list.text ?? "", list.file ?? null, list.fileType ?? null, now());
  return Number(result.lastInsertRowid);
}

// ───────── الإعدادات ─────────
export { DEFAULT_SETTINGS };

// القيم اللي تنعرض للزوار (بدون أي شي داخلي)
export function publicStoreInfo() {
  const s = getSettings();
  return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, s[k]]));
}

export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const saved = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(values) {
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(values)) if (key in DEFAULT_SETTINGS) upsert.run(key, JSON.stringify(value));
  return getSettings();
}

// ───────── التكاملات ─────────
export function getIntegrationRow(key) {
  const row = db.prepare("SELECT * FROM integrations WHERE key = ?").get(key);
  return { enabled: row?.enabled === 1, config: row ? JSON.parse(row.config) : {} };
}

export function saveIntegrationRow(key, enabled, config) {
  db.prepare("INSERT INTO integrations (key, enabled, config) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, config = excluded.config").run(
    key, enabled ? 1 : 0, JSON.stringify(config),
  );
}

export function addLog(integration, event, ok, message) {
  db.prepare("INSERT INTO integration_logs (at, integration, event, ok, message) VALUES (?, ?, ?, ?, ?)").run(now(), integration, event, ok ? 1 : 0, String(message).slice(0, 500));
  db.prepare("DELETE FROM integration_logs WHERE id NOT IN (SELECT id FROM integration_logs ORDER BY id DESC LIMIT 300)").run();
}

export const listLogs = (limit = 50) =>
  db.prepare("SELECT * FROM integration_logs ORDER BY id DESC LIMIT ?").all(limit).map((r) => ({ ...r, ok: r.ok === 1 }));

// ───────── الأجهزة المسموح لها بدخول لوحة التحكم ─────────
const rowToDevice = (r) => r && { id: r.id, label: r.label, createdAt: r.created_at, lastSeenAt: r.last_seen_at, revokedAt: r.revoked_at ?? null };

export function insertDevice(tokenHash, label) {
  const at = now();
  const result = db.prepare("INSERT INTO admin_devices (token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?)").run(tokenHash, label, at, at);
  return Number(result.lastInsertRowid);
}

export function findDevice(tokenHash) {
  const row = db.prepare("SELECT * FROM admin_devices WHERE token_hash = ? AND revoked_at IS NULL").get(tokenHash);
  if (!row) return null;
  // نحدّث "آخر دخول" مرة كل ساعة بالكثير
  if (Date.now() - Date.parse(row.last_seen_at) > 60 * 60 * 1000) db.prepare("UPDATE admin_devices SET last_seen_at = ? WHERE id = ?").run(now(), row.id);
  return rowToDevice(row);
}

export const listDevices = () => db.prepare("SELECT * FROM admin_devices WHERE revoked_at IS NULL ORDER BY last_seen_at DESC").all().map(rowToDevice);
export const revokeDevice = (id) => db.prepare("UPDATE admin_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now(), id);

// ───────── العملاء (تسجيل الدخول برقم الجوال) ─────────
const rowToCustomer = (r) => r && { id: r.id, phone: r.phone, name: r.name, email: r.email, createdAt: r.created_at, lastLoginAt: r.last_login_at };
export const getCustomer = (id) => rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(id));
export const getCustomerByPhone = (phone) => rowToCustomer(db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone));
export const listCustomers = () => db.prepare("SELECT * FROM customers").all().map(rowToCustomer);
export function upsertCustomer(phone, fields = {}) {
  const existing = getCustomerByPhone(phone);
  if (!existing) {
    db.prepare("INSERT INTO customers (phone, name, email, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)").run(phone, fields.name ?? "", fields.email ?? "", now(), fields.login ? now() : null);
  } else {
    db.prepare("UPDATE customers SET name = ?, email = ?, last_login_at = COALESCE(?, last_login_at) WHERE id = ?").run(
      fields.name ?? existing.name, fields.email ?? existing.email, fields.login ? now() : null, existing.id,
    );
  }
  return getCustomerByPhone(phone);
}
export const saveOtp = (phone, codeHash, ttlMs) =>
  db.prepare("INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at").run(phone, codeHash, Date.now() + ttlMs, Date.now());
export const getOtp = (phone) => db.prepare("SELECT * FROM otp_codes WHERE phone = ?").get(phone);
export const bumpOtp = (phone) => db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?").run(phone);
export const deleteOtp = (phone) => db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);
export const createCustomerSession = (tokenHash, customerId) => db.prepare("INSERT INTO customer_sessions (token_hash, customer_id, created_at) VALUES (?, ?, ?)").run(tokenHash, customerId, now());
export const findCustomerSession = (tokenHash) => db.prepare("SELECT customer_id FROM customer_sessions WHERE token_hash = ?").get(tokenHash)?.customer_id ?? null;
export const deleteCustomerSession = (tokenHash) => db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(tokenHash);
export const ordersByPhone = (phone) => listOrders().filter((o) => o.customer.phone === phone);

// ───────── السلات (عشان نعرف السلات المتروكة) ─────────
export function saveCart(cart) {
  db.prepare(
    "INSERT INTO carts (id, name, phone, items, total, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE carts.name END, phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE carts.phone END, items = excluded.items, total = excluded.total, updated_at = excluded.updated_at WHERE carts.order_number IS NULL",
  ).run(cart.id, cart.name ?? "", cart.phone ?? "", JSON.stringify(cart.items), cart.total, now());
}
export const markCartOrdered = (id, number) => db.prepare("UPDATE carts SET order_number = ? WHERE id = ?").run(number, id);
export const markCartReminded = (id) => db.prepare("UPDATE carts SET reminded_at = ? WHERE id = ?").run(now(), id);
export const deleteCart = (id) => db.prepare("DELETE FROM carts WHERE id = ?").run(id);
export const listAbandonedCarts = (olderThanMs) =>
  db
    .prepare("SELECT * FROM carts WHERE order_number IS NULL AND total > 0 AND updated_at < ? ORDER BY updated_at DESC LIMIT 200")
    .all(new Date(Date.now() - olderThanMs).toISOString())
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, items: JSON.parse(r.items), total: r.total, updatedAt: r.updated_at, remindedAt: r.reminded_at }));

// ───────── نبّهني إذا توفّر ─────────
export const addStockAlert = (productId, color, phone) =>
  db.prepare("INSERT INTO stock_alerts (product_id, color, phone, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(product_id, color, phone) DO UPDATE SET notified_at = NULL, created_at = excluded.created_at").run(productId, color ?? "", phone, now());
export const listStockAlerts = ({ pending = true } = {}) =>
  db.prepare(`SELECT * FROM stock_alerts ${pending ? "WHERE notified_at IS NULL" : ""} ORDER BY id DESC LIMIT 500`).all()
    .map((r) => ({ id: r.id, productId: r.product_id, color: r.color, phone: r.phone, createdAt: r.created_at, notifiedAt: r.notified_at }));
export const markAlertNotified = (id) => db.prepare("UPDATE stock_alerts SET notified_at = ? WHERE id = ?").run(now(), id);
export const deleteAlert = (id) => db.prepare("DELETE FROM stock_alerts WHERE id = ?").run(id);

// ───────── التقييمات ─────────
const rowToReview = (r) => r && { id: r.id, productId: r.product_id, orderNumber: r.order_number, name: r.name, phone: r.phone, rating: r.rating, comment: r.comment, hidden: r.hidden === 1, createdAt: r.created_at };
export const addReview = (r) =>
  db.prepare("INSERT INTO reviews (product_id, order_number, phone, name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(product_id, order_number) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at").run(r.productId, r.orderNumber, r.phone, r.name, r.rating, r.comment, now());
export const listReviews = ({ productId, includeHidden = false } = {}) =>
  db.prepare(`SELECT * FROM reviews WHERE 1=1 ${productId ? "AND product_id = ?" : ""} ${includeHidden ? "" : "AND hidden = 0"} ORDER BY id DESC`).all(...(productId ? [productId] : [])).map(rowToReview);
export const reviewsByPhone = (phone) => db.prepare("SELECT * FROM reviews WHERE phone = ?").all(phone).map(rowToReview);
export const setReviewHidden = (id, hidden) => db.prepare("UPDATE reviews SET hidden = ? WHERE id = ?").run(hidden ? 1 : 0, id);
export const deleteReview = (id) => db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
export function ratingSummary() {
  const rows = db.prepare("SELECT product_id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE hidden = 0 GROUP BY product_id").all();
  return Object.fromEntries(rows.map((r) => [r.product_id, { avg: Math.round(r.avg * 10) / 10, count: r.n }]));
}

// ───────── قوالب الرسائل (فاتورة، شحن، عقد...) ─────────
export const listTemplates = () => db.prepare("SELECT * FROM message_templates ORDER BY id").all();
export const getTemplate = (id) => db.prepare("SELECT * FROM message_templates WHERE id = ?").get(id);
export function saveTemplate(t) {
  if (t.id) db.prepare("UPDATE message_templates SET name = ?, subject = ?, body = ? WHERE id = ?").run(t.name, t.subject, t.body, t.id);
  else return Number(db.prepare("INSERT INTO message_templates (name, subject, body) VALUES (?, ?, ?)").run(t.name, t.subject, t.body).lastInsertRowid);
  return t.id;
}
export const deleteTemplate = (id) => db.prepare("DELETE FROM message_templates WHERE id = ?").run(id);
if (db.prepare("SELECT COUNT(*) AS n FROM message_templates").get().n === 0) {
  const seed = [
    ["فاتورة الطلب", "فاتورة طلبك {رقم_الطلب} من {اسم_المتجر}", "هلا {الاسم}،\n\nشكرًا لطلبك من {اسم_المتجر}. هذي فاتورة طلبك:\n\n{الفاتورة}\n\nإذا عندك أي سؤال رد على هذي الرسالة."],
    ["طلبك انشحن", "طلبك {رقم_الطلب} انشحن 🚚", "هلا {الاسم}،\n\nطلبك {رقم_الطلب} انشحن مع {شركة_الشحن}.\nرقم الشحنة: {رقم_الشحنة}\nتتبع الشحنة: {رابط_التتبع}\n\nنتمنى يعجبك 💚\n{اسم_المتجر}"],
    ["تأكيد الطلب", "استلمنا طلبك {رقم_الطلب}", "هلا {الاسم}،\n\nاستلمنا طلبك {رقم_الطلب} بإجمالي {الإجمالي}، ونبلغك أول ما ينشحن.\n\n{المنتجات}\n\n{اسم_المتجر}"],
    ["عقد / اتفاقية", "اتفاقية طلب {رقم_الطلب}", "بين {اسم_المتجر} والعميل {الاسم} (جوال {الجوال})، بخصوص الطلب {رقم_الطلب} بتاريخ {التاريخ}:\n\n{المنتجات}\nالإجمالي: {الإجمالي}\n\n(اكتب هنا بنود الاتفاق: مدة التجهيز، طريقة الدفع، الاسترجاع...)\n\n{اسم_المتجر}"],
  ];
  for (const [name, subject, body] of seed) saveTemplate({ name, subject, body: body.replace(/\\n/g, "\n") });
}

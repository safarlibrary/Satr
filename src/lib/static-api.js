import { ApiError } from "./api";
import { CATEGORIES, SEED_PRODUCTS } from "../../shared/catalog";
import { INTEGRATION_DEFINITIONS } from "../../shared/integrations";
import { DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS } from "../../shared/settings";

// المعاينة: الإعدادات والتكاملات تنحفظ في المتصفح بس، والمفاتيح السرية ما تنحفظ أبد (نحفظ إنها انكتبت فقط)
const SETTINGS_KEY = "satr-preview-settings";
const INTEGRATIONS_KEY = "satr-preview-integrations";
const previewSettings = () => ({ ...DEFAULT_SETTINGS, ...readJson(SETTINGS_KEY, {}) });

function previewIntegrations() {
  const saved = readJson(INTEGRATIONS_KEY, {});
  return INTEGRATION_DEFINITIONS.map((def) => {
    const row = saved[def.key] ?? { enabled: false, config: {} };
    const values = Object.fromEntries(def.fields.map((f) => [f.name, row.config[f.name] ?? (f.type === "secret" ? "" : f.default ?? "")]));
    const ready = def.isReady ? def.isReady(values) : def.fields.filter((f) => f.required).every((f) => String(values[f.name] ?? "").trim());
    return {
      key: def.key, group: def.group, name: def.name, description: def.description, docs: def.docs,
      testable: def.fields.length > 0 && !["shipping", "analytics", "applepay"].includes(def.key),
      enabled: row.enabled, ready,
      configured: def.fields.some((f) => (f.type === "secret" ? Boolean(values[f.name]) : f.default === undefined && String(values[f.name] ?? "").trim())),
      fields: def.fields.map(({ name, label, type, placeholder, help, required, options, section }) => ({
        name, label, type, placeholder, help, required, options, section,
        value: type === "secret" ? "" : values[name],
        saved: type === "secret" ? Boolean(values[name]) : undefined,
      })),
    };
  });
}

const PRODUCTS_KEY = "satr-preview-products-v3";

const ORDERS_KEY = "satr-preview-orders";

const LISTS_KEY = "satr-preview-lists";

const PREVIEW_SHIPPING_FEE = 25;

const PREVIEW_FREE_MIN = 150;

const readJson = (c, r) => {
  try {
    return JSON.parse(localStorage.getItem(c) ?? "null") ?? r;
  } catch {
    return r;
  }
};

const writeJson = (c, r) => {
  try {
    localStorage.setItem(c, JSON.stringify(r));
  } catch {}
};

const normalizePhone = (c) => c.replace(/\D/g, "").replace(/^966/, "0");

const bodyOf = (c) => c.json ?? {};

function getProducts() {
  const c = readJson(PRODUCTS_KEY, null);
  if (c) {
    return c;
  }
  const r = SEED_PRODUCTS.map((o) => ({
    ...o,
    stock: o.stock ?? 25,
    active: true,
  }));
  writeJson(PRODUCTS_KEY, r);
  return r;
}

const saveProducts = (c) => writeJson(PRODUCTS_KEY, c);

const getOrders = () => readJson(ORDERS_KEY, []);

const saveOrders = (c) => writeJson(ORDERS_KEY, c);

const getLists = () => readJson(LISTS_KEY, []);

export function staticApi(c, r) {
  const o = (r.method ?? "GET").toUpperCase();
  const g = new URL(c, "http://preview.local").pathname;
  function m(S, y) {
    throw new ApiError(S, y);
  }
  const b = () => {
    if (!r.token) {
      m(401, "التوكن غلط");
    }
  };
  if (o === "GET" && g === "/api/catalog") {
    return {
      categories: CATEGORIES,
      products: getProducts().filter((S) => S.active !== false),
      onlinePayment: false,
      shipping: { fee: PREVIEW_SHIPPING_FEE, freeMin: PREVIEW_FREE_MIN },
      store: Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, previewSettings()[k]])),
    };
  }
  if (o === "GET" && g.startsWith("/api/products/")) {
    const S = decodeURIComponent(g.slice(14));
    return (
      getProducts().find((h) => h.id === S && h.active !== false) ??
      m(404, "المنتج غير موجود")
    );
  }
  if (o === "POST" && g === "/api/orders") {
    const S = bodyOf(r);
    if (!S.items?.length) {
      m(400, "السلة فاضية");
    }
    if (S.payment !== "cod") {
      m(400, "الدفع الإلكتروني غير متاح في المعاينة، اختر الدفع عند الاستلام.");
    }
    const y = getProducts();
    const h = S.items.map((w) => {
      const Y = y.find((et) => et.id === w.id && et.active !== false);
      if (!Y) {
        m(400, `المنتج ${w.id} ما عاد متوفر.`);
      }
      const J = Y.colors ?? [];
      if (J.length && (!w.color || !J.includes(w.color))) {
        m(400, `اختر لون «${Y.name}».`);
      }
      if (!J.length && w.color) {
        m(400, `«${Y.name}» ما له ألوان.`);
      }
      if (Y.stock < w.qty) {
        m(409, `الكمية المطلوبة من «${Y.name}» أكثر من المتوفر (${Y.stock}).`);
      }
      return {
        id: Y.id,
        name: Y.name,
        price: Y.price,
        qty: w.qty,
        color: w.color,
      };
    });
    for (const w of h) {
      const Y = y.find((J) => J.id === w.id);
      Y.stock -= w.qty;
    }
    saveProducts(y);
    const E = h.reduce((w, Y) => w + Y.price * Y.qty, 0);
    const z = E >= PREVIEW_FREE_MIN ? 0 : PREVIEW_SHIPPING_FEE;
    const Q = new Date();
    const Z = `SA-${String(Q.getFullYear()).slice(2)}${String(Q.getMonth() + 1).padStart(2, "0")}${String(Q.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 8999)}`;
    const O = getOrders();
    const C = {
      id: (O.at(-1)?.id ?? 0) + 1,
      number: Z,
      status: "new",
      paymentMethod: "cod",
      paymentStatus: "cod",
      customer: {
        ...S.customer,
        phone: normalizePhone(S.customer.phone),
      },
      total: E + z,
      subtotal: E,
      shipping: z,
      createdAt: Q.toISOString(),
      items: h,
    };
    saveOrders([...O, C]);
    return {
      number: Z,
      total: C.total,
      paymentUrl: null,
    };
  }
  if (o === "GET" && g.startsWith("/api/orders/") && !g.endsWith("/track")) {
    const S = decodeURIComponent(g.slice(12)).toUpperCase();
    const y = getOrders().find((h) => h.number === S);
    if (!y) {
      m(404, "ما لقينا طلب بهذا الرقم");
    }
    return {
      number: y.number,
      status: y.status,
      paymentStatus: y.paymentStatus,
      paymentMethod: y.paymentMethod,
      total: y.total,
      createdAt: y.createdAt,
    };
  }
  if (o === "POST" && g === "/api/orders/track") {
    const S = bodyOf(r);
    const y = getOrders().find(
      (h) => h.number === S.number.trim().toUpperCase(),
    );
    if (!y || y.customer.phone !== normalizePhone(S.phone)) {
      m(404, "ما لقينا طلب بهذا الرقم والجوال");
    }
    return {
      number: y.number,
      status: y.status,
      paymentMethod: y.paymentMethod,
      paymentStatus: y.paymentStatus,
      total: y.total,
      subtotal: y.subtotal,
      shipping: y.shipping,
      createdAt: y.createdAt,
      city: y.customer.city,
      items: y.items,
    };
  }
  if (o === "POST" && g === "/api/school-lists") {
    const S = bodyOf(r);
    const y = getLists();
    const h = (y.at(-1)?.id ?? 0) + 1;
    saveLists([
      ...y,
      {
        id: h,
        name: S.name,
        phone: normalizePhone(S.phone),
        stage: S.stage,
        text: S.text,
        file: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    return {
      id: h,
    };
  }
  if (o === "POST" && g === "/api/admin/login") {
    // المعاينة بدون سيرفر: أي توكن يفتح اللوحة
    return { deviceToken: String(bodyOf(r).token ?? "preview") };
  }
  if (g.startsWith("/api/admin")) {
    b();
    if (o === "GET" && g === "/api/admin/status") {
      return {
        onlinePayment: false,
      };
    }
    if (o === "GET" && g === "/api/admin/products") {
      return {
        categories: CATEGORIES,
        products: getProducts(),
      };
    }
    if (o === "POST" && g === "/api/admin/products") {
      const h = bodyOf(r);
      const E = getProducts();
      const z = String(h.id ?? "");
      if (E.some((Z) => Z.id === z)) {
        m(409, "فيه منتج بنفس المعرّف");
      }
      const Q = toProduct(h, {
        stock: Number(h.stock ?? 0),
        active: true,
      });
      saveProducts([...E, Q]);
      return Q;
    }
    const S = /^\/api\/admin\/products\/([^/]+)(\/active|\/image)?$/.exec(g);
    if (S) {
      const h = decodeURIComponent(S[1]);
      const E = S[2];
      const z = getProducts();
      const Q = z.findIndex((O) => O.id === h);
      if (Q < 0) {
        m(404, "المنتج غير موجود");
      }
      const Z = z[Q];
      if (o === "PUT" && !E) {
        const O = toProduct(
          {
            ...bodyOf(r),
            id: h,
          },
          {
            stock: Number(bodyOf(r).stock ?? Z.stock),
            active: Z.active,
            image: Z.image,
          },
        );
        z[Q] = O;
        saveProducts(z);
        return O;
      }
      if (o === "POST" && E === "/active") {
        z[Q] = {
          ...Z,
          active: !!bodyOf(r).active,
        };
        saveProducts(z);
        return z[Q];
      }
      if (o === "POST" && E === "/image") {
        const O = String(bodyOf(r).file ?? "");
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(O)) {
          m(400, "الصورة لازم تكون JPG أو PNG أو WebP");
        }
        z[Q] = {
          ...Z,
          image: O,
        };
        saveProducts(z);
        return z[Q];
      }
    }
    if (o === "GET" && g === "/api/admin/orders") {
      return getOrders()
        .slice()
        .reverse()
        .map((h) => ({
          id: h.id,
          number: h.number,
          status: h.status,
          paymentMethod: h.paymentMethod,
          paymentStatus: h.paymentStatus,
          customer: h.customer,
          total: h.total,
          createdAt: h.createdAt,
          items: h.items,
          carrier: h.carrier,
          trackingNumber: h.trackingNumber,
        }));
    }
    const y = /^\/api\/admin\/orders\/(\d+)(\/mark-paid)?$/.exec(g);
    if (y) {
      const h = Number(y[1]);
      const E = getOrders();
      const z = E.findIndex((Q) => Q.id === h);
      if (z < 0) {
        m(404, "الطلب غير موجود");
      }
      if (o === "PATCH" && bodyOf(r).status === undefined) {
        const { carrier: Cr, trackingNumber: Tn } = bodyOf(r);
        E[z] = { ...E[z], carrier: Cr || undefined, trackingNumber: Tn || undefined };
      } else if (o === "PATCH") {
        const Q = bodyOf(r).status;
        if (
          !["new", "preparing", "shipped", "delivered", "cancelled"].includes(
            Q ?? "",
          )
        ) {
          m(400, "حالة غير صحيحة");
        }
        E[z] = {
          ...E[z],
          status: Q,
        };
      }
      if (o === "POST" && y[2]) {
        E[z] = {
          ...E[z],
          paymentStatus: "paid",
        };
      }
      saveOrders(E);
      return {
        ok: true,
      };
    }
    if (o === "GET" && g === "/api/admin/school-lists") {
      return getLists().slice().reverse();
    }
    if (o === "GET" && g === "/api/admin/carriers") {
      return ["سمسا", "أرامكس", "سبل (البريد السعودي)"];
    }
    if (o === "GET" && g === "/api/admin/settings") {
      return previewSettings();
    }
    if (o === "PUT" && g === "/api/admin/settings") {
      const next = { ...previewSettings() };
      for (const k of Object.keys(DEFAULT_SETTINGS)) if (bodyOf(r)[k] !== undefined) next[k] = typeof DEFAULT_SETTINGS[k] === "number" ? Number(bodyOf(r)[k]) : String(bodyOf(r)[k]).trim();
      writeJson(SETTINGS_KEY, next);
      return next;
    }
    if (o === "GET" && g === "/api/admin/devices") {
      const at = new Date().toISOString();
      return [{ id: 1, label: "هذا المتصفح (معاينة)", createdAt: at, lastSeenAt: at, current: true }];
    }
    if (o === "POST" && /^\/api\/admin\/devices\/\d+\/revoke$/.test(g)) {
      return { ok: true, signedOut: true };
    }
    if (o === "GET" && g === "/api/admin/integrations") {
      return { integrations: previewIntegrations(), logs: [], feedUrl: "https://satr.sa/feed/products.xml", callbackUrl: "https://satr.sa/api/payments/moyasar/webhook" };
    }
    const it = /^\/api\/admin\/integrations\/(\w+)(\/test)?$/.exec(g);
    if (it) {
      const def = INTEGRATION_DEFINITIONS.find((d) => d.key === it[1]) ?? m(404, "تكامل غير معروف");
      if (it[2]) return { ok: false, message: "هذي معاينة بدون سيرفر، الاختبار يشتغل بعد ما ترفع الموقع على السيرفر." };
      const saved = readJson(INTEGRATIONS_KEY, {});
      const prev = saved[def.key]?.config ?? {};
      const { enabled, values = {}, clear = [] } = bodyOf(r);
      const config = { ...prev };
      for (const f of def.fields) {
        if (f.type === "secret") {
          if (clear.includes(f.name)) delete config[f.name];
          else if (String(values[f.name] ?? "").trim()) config[f.name] = "saved";
        } else if (values[f.name] !== undefined) config[f.name] = String(values[f.name]).trim();
      }
      writeJson(INTEGRATIONS_KEY, { ...saved, [def.key]: { enabled: Boolean(enabled), config } });
      return { ok: true };
    }
    m(404, "المسار غير موجود");
  }
  return m(404, "المسار غير موجود");
}

function saveLists(c) {
  writeJson(LISTS_KEY, c);
}

function toProduct(c, r) {
  const o = Array.isArray(c.details) ? c.details.filter(Boolean) : [];
  const f = Array.isArray(c.colors) ? c.colors.filter(Boolean) : [];
  return {
    id: String(c.id),
    name: String(c.name ?? ""),
    category: c.category,
    price: Number(c.price ?? 0),
    oldPrice: c.oldPrice ? Number(c.oldPrice) : undefined,
    art: c.art ?? "notebook",
    tint: String(c.tint ?? "var(--color-mint)"),
    badge: c.badge || undefined,
    description: String(c.description ?? ""),
    details: o,
    stock: r.stock,
    active: r.active ?? true,
    brand: c.brand || undefined,
    madeIn: c.madeIn || undefined,
    colors: f,
    image: r.image,
  };
}

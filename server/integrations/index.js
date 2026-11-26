import { getIntegrationRow, saveIntegrationRow } from "../db.js";
import { decryptSecret, encryptSecret } from "../secrets.js";
import { DEFAULT_CARRIERS, INTEGRATION_DEFINITIONS } from "../../shared/integrations.js";
import * as email from "./email.js";
import * as gemini from "./gemini.js";
import * as openai from "./openai.js";
import * as moyasar from "./moyasar.js";
import * as sms from "./sms.js";
import * as smtp from "./smtp.js";
import * as tabby from "./tabby.js";
import * as telegram from "./telegram.js";
import * as webhook from "./webhook.js";
import * as whatsapp from "./whatsapp.js";

// اختبار كل تكامل (زر «احفظ واختبر»)
const TESTS = { moyasar: moyasar.test, tabby: tabby.test, whatsapp: whatsapp.test, sms: sms.test, telegram: telegram.test, smtp: smtp.test, gemini: gemini.test, openai: openai.test, email: email.test, webhook: webhook.test };

export const INTEGRATIONS = INTEGRATION_DEFINITIONS.map((def) => ({ ...def, test: TESTS[def.key] }));

const byKey = Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i]));
export const getDefinition = (key) => byKey[key];

// الإعدادات بعد فك التشفير — للاستخدام داخل السيرفر فقط
export function getConfig(key) {
  const def = byKey[key];
  const { enabled, config } = getIntegrationRow(key);
  const values = {};
  for (const field of def.fields) {
    const raw = config[field.name];
    values[field.name] = field.type === "secret" ? decryptSecret(raw) : raw ?? field.default ?? "";
  }
  const ready = def.isReady
    ? def.isReady(values)
    : def.fields.filter((f) => f.required).every((f) => String(values[f.name] ?? "").trim());
  return { enabled, ready, active: enabled && ready, values: def.derive ? { ...values, ...def.derive(values) } : values };
}

// نفس الإعدادات بس آمنة للعرض في لوحة التحكم (المفاتيح السرية تظهر كـ "محفوظ")
export function adminView() {
  return INTEGRATIONS.map((def) => {
    const { enabled, ready, values } = getConfig(def.key);
    return {
      key: def.key,
      group: def.group,
      configured: def.fields.some((f) => (f.type === "secret" ? Boolean(values[f.name]) : f.default === undefined && String(values[f.name] ?? "").trim())),
      name: def.name,
      description: def.description,
      docs: def.docs,
      testable: Boolean(def.test),
      enabled,
      ready,
      fields: def.fields.map(({ name, label, type, placeholder, help, required, options, section }) => ({
        name, label, type, placeholder, help, required, options, section,
        value: type === "secret" ? "" : values[name],
        saved: type === "secret" ? Boolean(values[name]) : undefined,
      })),
    };
  });
}

// حفظ: الحقل السري الفاضي يعني "خلّ القديم"، و clear يمسحه
export function saveConfig(key, { enabled, values = {}, clear = [] }) {
  const def = byKey[key];
  const { config } = getIntegrationRow(key);
  const next = { ...config };
  for (const field of def.fields) {
    const value = values[field.name];
    if (field.type === "secret") {
      if (clear.includes(field.name)) delete next[field.name];
      else if (typeof value === "string" && value.trim()) next[field.name] = encryptSecret(value.trim());
    } else if (value !== undefined) {
      next[field.name] = String(value).trim();
    }
  }
  saveIntegrationRow(key, Boolean(enabled), next);
}

export async function testIntegration(key) {
  const def = byKey[key];
  if (!def.test) return "ما يحتاج اختبار";
  const { ready, values } = getConfig(key);
  if (!ready) throw new Error("كمّل الحقول المطلوبة واحفظ أول");
  return def.test(values);
}

// ───────── قيم تستخدمها الواجهة (بدون أي أسرار) ─────────
export function parseCarriers(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.split("|").map((p) => p.trim()))
    .filter(([name]) => name)
    .map(([name, url]) => ({ name, url: url ?? "" }));
}

export function carriers() {
  const { enabled, values } = getConfig("shipping");
  return parseCarriers(enabled ? values.carriers : DEFAULT_CARRIERS);
}

export function trackingUrl(carrierName, number) {
  if (!carrierName || !number) return null;
  const carrier = carriers().find((c) => c.name === carrierName);
  return carrier?.url ? carrier.url.replace("{number}", encodeURIComponent(number)) : null;
}

export function publicConfig() {
  const analytics = getConfig("analytics");
  const tracking = analytics.enabled
    ? Object.fromEntries(Object.entries(analytics.values).filter(([, v]) => String(v).trim()))
    : {};
  return {
    onlinePayment: getConfig("moyasar").active,
    tabby: getConfig("tabby").active,
    tracking,
  };
}

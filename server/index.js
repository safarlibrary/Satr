import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import express from "express";
import { ROOT, ENV } from "./env.js";
import { UPLOADS_DIR } from "./db.js";
import { getConfig } from "./integrations/index.js";
import { HttpError } from "./util.js";
import { adminRouter } from "./routes/admin.js";
import { feedRouter } from "./routes/feed.js";
import { paymentsRouter } from "./routes/payments.js";
import { publicRouter } from "./routes/public.js";
import { customerRouter } from "./routes/customer.js";
import { aiRouter } from "./routes/ai.js";
import { getSettings } from "./db.js";
import { baseUrl } from "./routes/helpers.js";
import { ALL_TOOL_PAGES, toolMeta } from "../shared/tools.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
// الصور والملفات المرفوعة تجي كـ data URL، فنسمح بحجم أكبر من الافتراضي
app.use(express.json({ limit: "12mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api", publicRouter);
app.use("/api", customerRouter);
app.use("/api", aiRouter);
app.use("/api", (req, res) => res.status(404).json({ error: "المسار غير موجود" }));
app.use("/feed", feedRouter);

// ملف تحقق Apple Pay (من التكاملات ← Apple Pay و DNS)
app.get("/.well-known/apple-developer-merchantid-domain-association", (req, res) => {
  const { active, values } = getConfig("applepay");
  if (!active) return res.status(404).send("Not found");
  res.type("text/plain").send(values.association.trim());
});

// صور المنتجات المرفوعة من لوحة التحكم (ملفات قوائم المدارس خاصة وما تنعرض هنا)
app.use("/uploads/products", express.static(path.join(UPLOADS_DIR, "products"), { maxAge: "7d", index: false }));
// صور المنتجات المضمّنة في المشروع، لملف المنتجات (الكتالوج)
app.use("/catalog-images", express.static(path.join(ROOT, "src/assets/products"), { maxAge: "7d", index: false }));

// ───────── جوجل: robots و sitemap، وعنوان ووصف كل صفحة أداة ─────────
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
app.get("/sitemap.xml", (req, res) => {
  const base = baseUrl(req);
  const paths = ["/", ...ALL_TOOL_PAGES.map((t) => t.path)];
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
      .map((p) => `  <url><loc>${base}${p === "/" ? "" : p}</loc></url>`)
      .join("\n")}\n</urlset>\n`,
  );
});

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// يحط العنوان والوصف والرابط الأساسي وبيانات منظّمة (مجاني) في صفحة الأداة قبل ما توصل للمتصفح
function toolPageHtml(html, meta, req) {
  const settings = getSettings();
  const url = `${baseUrl(req)}${meta.path}`;
  const title = `${meta.title} | ${settings.storeName}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: meta.title,
    description: meta.description,
    url,
    inLanguage: "ar",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "SAR" },
    provider: { "@type": "Organization", name: settings.storeName },
  };
  const head = [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="ar_SA" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`)
    .replace("</head>", `    ${head}\n  </head>`);
}

if (ENV.isProduction) {
  const dist = path.join(ROOT, "dist");
  if (!existsSync(path.join(dist, "index.html"))) throw new Error("شغّل npm run build قبل npm start");
  const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");
  app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1y", immutable: true }));
  app.use(express.static(dist, { index: false }));
  app.get(["/tools", "/tools/*"], (req, res) => {
    const meta = toolMeta(req.path.replace(/\/+$/, "") || "/");
    if (!meta) return res.status(404).type("html").send(indexHtml);
    res.type("html").send(toolPageHtml(indexHtml, meta, req));
  });
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

// أي خطأ: نرجّع رسالة واضحة بالعربي بدل ما يطيح السيرفر
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "الملف أكبر من المسموح" });
  if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "بيانات غير صحيحة" });
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(error);
  // أخطاءنا المقصودة (HttpError) رسالتها واضحة للعميل، والباقي نخفي تفاصيله
  res.status(status).json({ error: error instanceof HttpError || status < 500 ? error.message : "صار خطأ في السيرفر، جرّب مرة ثانية." });
});

app.listen(ENV.port, () => {
  console.log(`سطر شغّال على http://localhost:${ENV.port}`);
  if (!ENV.isProduction) console.log(`لوحة التحكم: http://localhost:${ENV.port}/#/admin — التوكن: ${ENV.adminToken}`);
});

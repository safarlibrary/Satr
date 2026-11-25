// أدوات مشتركة لكل أدوات PDF. المكتبات الثقيلة تنحمّل أول ما تنطلب بس.

let pdfLibPromise;
export const loadPdfLib = () => {
  pdfLibPromise ??= import("pdf-lib").catch((e) => {
    pdfLibPromise = null;
    throw e;
  });
  return pdfLibPromise;
};

let pdfjsPromise;
export function loadPdfJs() {
  pdfjsPromise ??= (async () => {
    const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })().catch((e) => {
    pdfjsPromise = null;
    throw e;
  });
  return pdfjsPromise;
}

// حدود معقولة عشان الجوال ما يعلق
export const MAX_FILES = 50;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

export const num = (n) => Number(n).toLocaleString("ar-SA");

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${num(Math.max(1, Math.round(n / 1024)))} ك.ب`;
  return `${Number((n / 1048576).toFixed(n < 10 * 1048576 ? 2 : 1)).toLocaleString("ar-SA")} م.ب`;
}

export function checkLimits(current, incoming) {
  if (current.length + incoming.length > MAX_FILES) return `الحد الأقصى ${num(MAX_FILES)} ملف في المرة الوحدة.`;
  const total = [...current, ...incoming].reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return `مجموع الحجم أكبر من ${formatBytes(MAX_TOTAL_BYTES)}. قلّل الملفات عشان جوالك ما يعلق.`;
  return null;
}

export const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const baseName = (name) => name.replace(/\.[^.]+$/, "");
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function pdfErrorMessage(err, name) {
  console.error("[pdf-tools]", err);
  const text = String(err?.message ?? err ?? "");
  if (/encrypt/i.test(text) || err?.name === "PasswordException") return `الملف «${name}» محمي بكلمة مرور. فك الحماية عنه أول وبعدين جرّبه.`;
  if (text === "TOO_MANY_PAGES") return "الضغط القوي يدعم لين ٣٠٠ صفحة. جرّب مستوى ثاني لهذا الملف.";
  if (/memory|allocation|array buffer/i.test(text)) return "الملف كبير على جهازك. جرّب ملف أصغر أو استخدم جهاز أقوى.";
  return `ما قدرنا نقرأ «${name}». يمكن الملف تالف أو مو PDF صحيح.`;
}

export const nextId = (() => {
  let n = 0;
  return () => `i${++n}`;
})();

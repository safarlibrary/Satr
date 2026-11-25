import { loadPdfJs, loadPdfLib, tick } from "./engine";

export const LEVELS = [
  { id: "light", name: "خفيف", note: "بدون أي خسارة في الجودة، والنص يبقى قابل للتحديد. التوفير غالبًا قليل." },
  { id: "medium", name: "متوسط", note: "يضغط الصور اللي داخل الملف ويصغّرها. النص والرسومات تبقى كما هي. الأنسب للملفات الممسوحة والعروض." },
  { id: "strong", name: "قوي", note: "أكبر توفير: كل صفحة تتحول لصورة مضغوطة. النص ما يصير قابل للتحديد ولا البحث." },
];

const MEDIUM = { maxSide: 1700, quality: 0.7, minBytes: 120 * 1024 };

async function withImage(blob, fn) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await fn(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toJpegBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// يرجّع { bytes, recompressed } أو null إذا انلغت العملية
export async function compressPdf(bytes, level, { onProgress = () => {}, shouldCancel = () => false } = {}) {
  if (level === "strong") return rasterize(bytes, onProgress, shouldCancel);

  const lib = await loadPdfLib();
  const src = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  const out = await lib.PDFDocument.create();
  onProgress(0.05);
  // ننسخ الصفحات لملف جديد: هذا يتخلص من الأجزاء القديمة وغير المستخدمة اللي داخل الملف
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  onProgress(0.15);
  let recompressed = 0;
  if (level === "medium") {
    recompressed = await recompressImages(out, lib, (p) => onProgress(0.15 + p * 0.8), shouldCancel);
    if (recompressed === null) return null;
  }
  if (shouldCancel()) return null;
  onProgress(0.97);
  return { bytes: await out.save({ useObjectStreams: true }), recompressed };
}

// يعيد ضغط صور JPEG اللي داخل الملف (مع الحفاظ على النص والرسومات)
async function recompressImages(doc, lib, onProgress, shouldCancel) {
  const { PDFName, PDFNumber, PDFArray, PDFRawStream } = lib;
  const name = (n) => PDFName.of(n);

  const jpegFilter = (dict) => {
    const f = dict.lookup(name("Filter"));
    const first = f instanceof PDFArray ? (f.size() === 1 ? f.lookup(0) : null) : f;
    return first instanceof PDFName && ["DCTDecode", "DCT"].includes(first.decodeText());
  };
  const isRgb = (dict) => {
    const cs = dict.lookup(name("ColorSpace"));
    if (cs instanceof PDFName) return cs.decodeText() === "DeviceRGB";
    if (cs instanceof PDFArray && cs.lookup(0) instanceof PDFName && cs.lookup(0).decodeText() === "ICCBased") {
      const icc = cs.lookup(1);
      return icc?.dict?.lookupMaybe(name("N"), PDFNumber)?.asNumber() === 3;
    }
    return false;
  };

  const targets = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.lookup(name("Subtype"))?.toString() === "/Image")
    .filter(([, obj]) => jpegFilter(obj.dict) && isRgb(obj.dict))
    .filter(([, obj]) => !["ImageMask", "Mask", "Decode", "SMaskInData"].some((k) => obj.dict.has(name(k))));

  let changed = 0;
  for (let i = 0; i < targets.length; i++) {
    if (shouldCancel()) return null;
    onProgress(i / targets.length);
    const [ref, obj] = targets[i];
    try {
      const W = obj.dict.lookupMaybe(name("Width"), PDFNumber)?.asNumber();
      const H = obj.dict.lookupMaybe(name("Height"), PDFNumber)?.asNumber();
      const old = obj.getContents();
      if (!W || !H) continue;
      const k = Math.min(1, MEDIUM.maxSide / Math.max(W, H));
      if (k === 1 && old.length < MEDIUM.minBytes) continue;
      const result = await withImage(new Blob([old], { type: "image/jpeg" }), async (img) => {
        // إذا المتصفح لف الصورة (EXIF) نتركها كما هي عشان ما تنقلب في الملف
        if (img.naturalWidth !== W || img.naturalHeight !== H) return null;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(W * k));
        canvas.height = Math.max(1, Math.round(H * k));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await toJpegBlob(canvas, MEDIUM.quality);
        const size = { w: canvas.width, h: canvas.height };
        canvas.width = canvas.height = 0;
        return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), ...size } : null;
      });
      if (!result || result.bytes.length >= old.length * 0.92) continue;
      const dict = doc.context.obj({
        Type: "XObject",
        Subtype: "Image",
        Width: result.w,
        Height: result.h,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
        Filter: "DCTDecode",
        Length: result.bytes.length,
      });
      const smask = obj.dict.get(name("SMask"));
      if (smask) dict.set(name("SMask"), smask);
      doc.context.assign(ref, PDFRawStream.of(dict, result.bytes));
      changed++;
    } catch {
      // صورة ما قدرنا نعالجها: نخليها كما هي
    }
    await tick();
  }
  return changed;
}

async function rasterize(bytes, onProgress, shouldCancel) {
  const [lib, pdfjs] = await Promise.all([loadPdfLib(), loadPdfJs()]);
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 300) throw new Error("TOO_MANY_PAGES");
    const out = await lib.PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i++) {
      if (shouldCancel()) return null;
      onProgress((i - 1) / pdf.numPages);
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, 1500 / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await toJpegBlob(canvas, 0.6);
      page.cleanup();
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error("memory");
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([base.width, base.height]).drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
      await tick();
    }
    onProgress(0.97);
    return { bytes: await out.save({ useObjectStreams: true }), recompressed: pdf.numPages, rasterized: true };
  } finally {
    await (task.destroy?.() ?? pdf.destroy?.());
  }
}

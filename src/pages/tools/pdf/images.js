import { loadPdfLib, tick } from "./engine";

// معالجة الصور داخل المتصفح: فك التشفير، التدوير، وتحويلها JPEG جاهز للـ PDF

export const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/i.test(f.type);
export const isImageFile = (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name);

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

// يرجّع صورة يقدر المتصفح يقرأها. صور الآيفون (HEIC): نجرّب المتصفح أول (سفاري يفتحها)، وإذا ما فتحها نحوّلها.
export async function makeDecodable(file) {
  try {
    await withImage(file, () => {});
    return file;
  } catch (error) {
    if (!isHeic(file)) throw error;
  }
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: new Blob([file], { type: "image/heic" }), toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

export function makeThumb(blob, size = 140) {
  return withImage(blob, (img) => {
    const s = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * s));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return { thumb: canvas.toDataURL("image/jpeg", 0.7), width: img.naturalWidth, height: img.naturalHeight };
  });
}

async function renderJpeg(blob, rotation, maxSide = 3300, quality = 0.9) {
  return withImage(blob, async (img) => {
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const swap = rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // الصور الشفافة (PNG) تطلع على خلفية بيضاء
    ctx.fillRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    const out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    canvas.width = canvas.height = 0;
    if (!out) throw new Error("memory");
    return { bytes: new Uint8Array(await out.arrayBuffer()), width, height };
  });
}

const A4 = [595.28, 841.89];
const MARGINS = { none: 0, small: 28, large: 57 };

// opts: { size: "a4" | "image", margin: "none" | "small" | "large", orient: "auto" | "portrait" | "landscape" }
export async function buildImagesPdf(items, opts, { onProgress = () => {}, shouldCancel = () => false } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const margin = MARGINS[opts.margin] ?? 0;
  for (let i = 0; i < items.length; i++) {
    if (shouldCancel()) return null;
    onProgress(i / items.length);
    const { bytes, width, height } = await renderJpeg(items[i].blob, items[i].rotation);
    const image = await doc.embedJpg(bytes);
    let pw;
    let ph;
    if (opts.size === "a4") {
      const landscape = opts.orient === "landscape" || (opts.orient === "auto" && width > height);
      [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
    } else {
      const bw = width * 0.75;
      const bh = height * 0.75;
      const k = Math.min(1, 842 / Math.max(bw, bh));
      pw = bw * k + margin * 2;
      ph = bh * k + margin * 2;
    }
    const page = doc.addPage([pw, ph]);
    const fit = Math.min((pw - margin * 2) / width, (ph - margin * 2) / height);
    const dw = width * fit;
    const dh = height * fit;
    page.drawImage(image, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    await tick();
  }
  onProgress(0.97);
  return doc.save();
}

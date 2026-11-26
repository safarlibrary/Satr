import { toJpeg, toPng } from "html-to-image";
import { downloadBlob, loadPdfLib } from "./pdf/engine";

// تصدير صفحة A4 (HTML) كصورة بدقة طباعة ثم PDF. مشترك بين الغلاف والسيرة الذاتية والتقارير.
export const PAGE_W = 794;
export const PAGE_H = 1123;
const A4 = [595.28, 841.89];

const FONT_SPECS = ['400 24px "Amiri"', '700 24px "Amiri"', '400 24px "Cairo"', '600 24px "Cairo"', '800 24px "Cairo"', '600 24px "Baloo Bhaijaan 2"', '800 24px "Baloo Bhaijaan 2"'];
export const loadFonts = () => Promise.all(FONT_SPECS.map((f) => document.fonts.load(f, "أبجد هوز 123 abc").catch(() => null)));
export const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export const dataUrlBytes = (url) => {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60);

// يلتقط عنصر كصورة. نسخة تسخين أولًا (سفاري ما يضمّن الخطوط من أول مرة)، وإذا ذاكرة الجهاز ما كفت ننزل للدقة الأقل
export async function capture(node, kind) {
  const base = { width: PAGE_W, height: PAGE_H, backgroundColor: "#ffffff", style: { transform: "none" } };
  await toPng(node, { ...base, pixelRatio: 1 });
  let last;
  for (const pixelRatio of [3.125, 2]) {
    try {
      return kind === "png" ? await toPng(node, { ...base, pixelRatio }) : await toJpeg(node, { ...base, pixelRatio, quality: 0.96 });
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// يبني PDF من صور JPEG (صفحة A4 لكل صورة)
export async function jpegPagesToPdf(jpegs, title) {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  if (title) doc.setTitle(title);
  for (const bytes of jpegs) {
    const image = await doc.embedJpg(bytes);
    doc.addPage(A4).drawImage(image, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  return new Blob([await doc.save()], { type: "application/pdf" });
}

// يصدّر كل العناصر (كل عنصر صفحة) كملف واحد: PDF أو PNG (لصفحة وحدة) أو ZIP لعدة صور
export async function exportPages(nodes, kind, baseName) {
  await loadFonts();
  if (kind === "pdf") {
    const jpegs = [];
    for (const node of nodes) jpegs.push(dataUrlBytes(await capture(node, "jpg")));
    downloadBlob(await jpegPagesToPdf(jpegs, baseName), `${baseName}.pdf`);
    return;
  }
  const pngs = [];
  for (const node of nodes) pngs.push(dataUrlBytes(await capture(node, "png")));
  if (pngs.length === 1) {
    downloadBlob(new Blob([pngs[0]], { type: "image/png" }), `${baseName}.png`);
    return;
  }
  const { zipSync } = await import("fflate");
  const files = Object.fromEntries(pngs.map((bytes, i) => [`${baseName}-${i + 1}.png`, bytes]));
  downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), `${baseName}.zip`);
}

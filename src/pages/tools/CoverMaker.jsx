import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/arabic-700.css";
import "@fontsource/amiri/latin-400.css";
import "@fontsource/amiri/latin-700.css";
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-800.css";
import "@fontsource/cairo/latin-400.css";
import "@fontsource/cairo/latin-600.css";
import "@fontsource/cairo/latin-800.css";
import { COVER_TOOL } from "../../../shared/tools";
import { Field, SelectField } from "../../components/Field";
import { ToolShell } from "./ToolShell";
import { COVER_H, COVER_W, CoverTemplate, TEMPLATES } from "./cover/templates";
import { formatDate, todayIso } from "./cover/date";
import { downloadBlob, loadPdfLib } from "./pdf/engine";
import { ErrorNote } from "./pdf/ui";

// نحفظ ما كتبه الطالب في جهازه (بدون الشعار) عشان ما يعيد كتابته كل مرة
const STORAGE_KEY = "satr-cover-v1";
const EMPTY = { university: "", college: "", department: "", course: "", courseCode: "", title: "", student: "", studentId: "", doctor: "" };

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") return saved;
  } catch {}
  return null;
}

const FONT_SPECS = ['400 24px "Amiri"', '700 24px "Amiri"', '400 24px "Cairo"', '600 24px "Cairo"', '800 24px "Cairo"', '600 24px "Baloo Bhaijaan 2"', '800 24px "Baloo Bhaijaan 2"'];
const loadFonts = () => Promise.all(FONT_SPECS.map((f) => document.fonts.load(f, "أبجد هوز 123 abc").catch(() => null)));
const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const dataUrlBytes = (url) => {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// يلتقط الغلاف كصورة بدقة طباعة (٣٠٠ نقطة للإنش تقريبًا)، وإذا ذاكرة الجهاز ما كفت ينزل للدقة الأقل
async function capture(node, kind) {
  const base = { width: COVER_W, height: COVER_H, backgroundColor: "#ffffff", style: { transform: "none" } };
  await toPng(node, { ...base, pixelRatio: 1 }); // تسخين: يضمن تضمين الخطوط (مشكلة معروفة في سفاري)
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

async function readLogo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error("size");
    const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60);

export default function CoverMaker() {
  const saved = useRef(loadSaved()).current;
  const [fields, setFields] = useState({ ...EMPTY, ...(saved?.fields ?? {}) });
  const [template, setTemplate] = useState(TEMPLATES.some((t) => t.id === saved?.template) ? saved.template : "formal");
  const [dateMode, setDateMode] = useState(saved?.dateMode === "gregorian" ? "gregorian" : "hijri");
  const [dateValue, setDateValue] = useState(saved?.dateValue ?? todayIso());
  const [logo, setLogo] = useState(null);
  const [tab, setTab] = useState("form");
  const [busy, setBusy] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.45);
  const wrapRef = useRef(null);
  const exportRef = useRef(null);

  const data = { ...fields, date: formatDate(dateValue, dateMode) };
  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fields, template, dateMode, dateValue }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [fields, template, dateMode, dateValue]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(Math.min(1, w / COVER_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const exportCover = async (kind) => {
    setError("");
    setBusy(kind);
    try {
      await loadFonts();
      setMounted(true);
      await frames();
      const node = exportRef.current?.firstElementChild;
      if (!node) throw new Error("no node");
      const base = `غلاف-${safeName(fields.title) || "الواجب"}`;
      const url = await capture(node, kind);
      const bytes = dataUrlBytes(url);
      if (kind === "png") {
        downloadBlob(new Blob([bytes], { type: "image/png" }), `${base}.png`);
      } else {
        const { PDFDocument } = await loadPdfLib();
        const doc = await PDFDocument.create();
        doc.setTitle(fields.title || "غلاف واجب");
        const image = await doc.embedJpg(bytes);
        doc.addPage([595.28, 841.89]).drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
        downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), `${base}.pdf`);
      }
    } catch {
      setError("ما قدرنا نجهّز الغلاف على جهازك. جرّب مرة ثانية، أو من جهاز أقوى.");
    } finally {
      setMounted(false);
      setBusy(null);
    }
  };

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      setLogo(await readLogo(file));
    } catch {
      setError("ما قدرنا نفتح صورة الشعار. جرّب PNG أو JPG.");
    }
  };

  return (
    <ToolShell meta={COVER_TOOL}>
      <div className="grid gap-6">
        <div role="group" aria-label="اختر القالب" className="flex gap-3 overflow-x-auto pb-2 -mx-[18px] px-[18px] lg:mx-0 lg:px-0">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={template === t.id}
              onClick={() => setTemplate(t.id)}
              className={`shrink-0 w-[118px] rounded-[14px] border-2 border-ink p-1.5 text-center ${template === t.id ? "bg-mint shadow-[3px_3px_0_var(--color-ink)]" : "bg-card"}`}
            >
              <span className="block relative overflow-hidden rounded-md border border-ink/30" style={{ width: 104, height: 146 }} aria-hidden="true">
                <span className="block absolute top-0 left-0 pointer-events-none" style={{ width: COVER_W, height: COVER_H, transform: `scale(${104 / COVER_W})`, transformOrigin: "top left" }}>
                  <CoverTemplate id={t.id} d={data} logo={logo} />
                </span>
              </span>
              <span className="block mt-1 text-[14px] font-bold">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 lg:hidden" role="tablist" aria-label="الأقسام">
          <button type="button" role="tab" aria-selected={tab === "form"} className="chip flex-1 justify-center" aria-pressed={tab === "form"} onClick={() => setTab("form")}>
            تعبئة البيانات
          </button>
          <button type="button" role="tab" aria-selected={tab === "preview"} className="chip flex-1 justify-center" aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>
            معاينة وتحميل
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
          <form className={`panel p-5 sm:p-6 grid gap-4 sm:grid-cols-2 ${tab === "form" ? "" : "hidden"} lg:grid`} onSubmit={(e) => e.preventDefault()} noValidate>
            <div className="sm:col-span-2">
              <Field id="cv-university" label="اسم الجامعة" value={fields.university} onChange={set("university")} placeholder="مثلًا: جامعة الملك سعود" />
            </div>
            <Field id="cv-college" label="الكلية" value={fields.college} onChange={set("college")} />
            <Field id="cv-department" label="القسم" value={fields.department} onChange={set("department")} />
            <Field id="cv-course" label="اسم المادة" value={fields.course} onChange={set("course")} />
            <Field id="cv-courseCode" label="رمز المادة" dir="ltr" value={fields.courseCode} onChange={set("courseCode")} placeholder="CS 101" />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cv-title">
                عنوان الواجب
              </label>
              <textarea id="cv-title" className="field min-h-20 resize-y leading-relaxed" value={fields.title} onChange={set("title")} placeholder="مثلًا: تقرير عن الذكاء الاصطناعي" />
            </div>
            <Field id="cv-student" label="اسم الطالب" autoComplete="name" value={fields.student} onChange={set("student")} />
            <Field id="cv-studentId" label="الرقم الجامعي" inputMode="numeric" dir="ltr" value={fields.studentId} onChange={set("studentId")} />
            <div className="sm:col-span-2">
              <Field id="cv-doctor" label="اسم الدكتور" value={fields.doctor} onChange={set("doctor")} />
            </div>
            <SelectField id="cv-datemode" label="نوع التاريخ" value={dateMode} onChange={setDateMode}>
              <option value="hijri">هجري</option>
              <option value="gregorian">ميلادي</option>
            </SelectField>
            <Field id="cv-date" label="التاريخ" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            <div className="sm:col-span-2 grid gap-2">
              <span className="label !mb-0">شعار الجامعة (اختياري)</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn btn-sm btn-paper cursor-pointer focus-within:outline focus-within:outline-3 focus-within:outline-leaf">
                  {logo ? "غيّر الشعار" : "ارفع شعار جامعتك"}
                  <input type="file" accept="image/*" className="sr-only" onChange={pickLogo} />
                </label>
                {logo && (
                  <>
                    <img src={logo} alt="" className="h-11 w-auto max-w-28 object-contain rounded-lg border-2 border-ink bg-white p-1" />
                    <button type="button" className="btn btn-sm btn-paper" onClick={() => setLogo(null)}>
                      احذف الشعار
                    </button>
                  </>
                )}
              </div>
              <p className="m-0 text-[14px] text-ink-soft">الشعار من جهازك أنت، وما ينرفع ولا ينحفظ بعد ما تغلق الصفحة. ما نضيف شعارات جامعات من عندنا.</p>
            </div>
            <p className="sm:col-span-2 m-0 text-[14px] text-ink-soft">
              نحفظ ما كتبته في متصفحك فقط عشان ما تعيد كتابته المرة الجاية.{" "}
              <button
                type="button"
                className="bg-transparent border-0 p-0 text-leaf font-bold underline"
                onClick={() => {
                  setFields(EMPTY);
                  setLogo(null);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
              >
                امسح البيانات
              </button>
            </p>
          </form>

          <div className={`grid gap-4 ${tab === "preview" ? "" : "hidden"} lg:grid lg:sticky lg:top-24`}>
            <div ref={wrapRef} className="w-full">
              <div className="relative mx-auto bg-white border-2 border-ink shadow-[5px_5px_0_var(--color-ink)]" style={{ width: COVER_W * scale, height: COVER_H * scale }} role="img" aria-label="معاينة الغلاف بحجم A4">
                <div className="absolute top-0 left-0" style={{ width: COVER_W, height: COVER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <CoverTemplate id={template} d={data} logo={logo} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className="btn btn-pink" disabled={busy !== null} onClick={() => exportCover("pdf")}>
                {busy === "pdf" ? "جاري التجهيز…" : "حمّل PDF"}
              </button>
              <button type="button" className="btn btn-butter" disabled={busy !== null} onClick={() => exportCover("png")}>
                {busy === "png" ? "جاري التجهيز…" : "حمّل صورة PNG"}
              </button>
            </div>
            <p className="m-0 text-center text-[14px] text-ink-soft">بجودة طباعة عالية (A4). الـ PDF يكون صورة الغلاف، فالنص ما ينحدد منه.</p>
            <ErrorNote>{error}</ErrorNote>
          </div>
        </div>
      </div>

      {/* نسخة خفية بدون خانات تجريبية للتصدير */}
      {mounted && (
        <div ref={exportRef} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, width: COVER_W, height: COVER_H, pointerEvents: "none" }}>
          <CoverTemplate id={template} d={data} logo={logo} ex />
        </div>
      )}
    </ToolShell>
  );
}

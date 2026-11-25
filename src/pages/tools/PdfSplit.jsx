import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { PDF_HUB, PDF_TOOLS } from "../../../shared/tools";
import { Field } from "../../components/Field";
import { ToolShell } from "./ToolShell";
import { baseName, downloadBlob, formatBytes, isPdf, loadPdfJs, loadPdfLib, MAX_TOTAL_BYTES, num, pdfErrorMessage, tick } from "./pdf/engine";
import { formatRanges, parseRanges, rangesToSet } from "./pdf/ranges";
import { ErrorNote, FileDrop, ProgressPanel, ResultCard } from "./pdf/ui";

const META = PDF_TOOLS.find((t) => t.slug === "split");

const MODES = [
  { id: "extract", name: "استخراج صفحات", note: "اختر الصفحات بالضغط عليها أو اكتب أرقامها، وتطلع في ملف واحد." },
  { id: "all", name: "كل صفحة ملف", note: "كل صفحة تصير ملف PDF لحاله، وتنزل كلها في ملف مضغوط (ZIP)." },
  { id: "every", name: "كل عدد من الصفحات", note: "قسّم الملف أجزاء متساوية (مثلاً كل ١٠ صفحات ملف)." },
  { id: "ranges", name: "نطاقات محددة", note: "اكتب النطاقات وكل نطاق يصير ملف، مثل: 1-3, 4-6, 7." },
];

// ترتيب المعاينات: واحدة واحدة عشان الجوال ما يعلق
let thumbQueue = Promise.resolve();
const enqueue = (job) => {
  thumbQueue = thumbQueue.then(job, job);
  return thumbQueue;
};

function Thumb({ doc, n, selected, selectable, onToggle }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!doc) return undefined;
    const el = ref.current;
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        enqueue(async () => {
          if (cancelled) return;
          try {
            const page = await doc.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: 150 / base.width });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            if (!cancelled) setSrc(canvas.toDataURL("image/jpeg", 0.7));
            page.cleanup();
          } catch {
            // المعاينة اختيارية: لو فشلت تبقى الصفحة قابلة للاختيار برقمها
          }
        });
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [doc, n]);

  const body = (
    <>
      <span ref={ref} className="relative block aspect-[3/4] w-full bg-white overflow-hidden">
        {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-contain" /> : <span className="absolute inset-0 grid place-items-center text-ink-soft text-[13px]">{doc ? "…" : "بدون معاينة"}</span>}
        {selected && (
          <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-leaf text-paper grid place-items-center border-2 border-ink">
            <Check size={14} strokeWidth={3.5} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="block py-1 text-[13px] font-bold">{num(n)}</span>
    </>
  );
  const cls = `block w-full rounded-[10px] border-2 overflow-hidden text-center ${selected ? "border-leaf bg-mint" : "border-ink bg-card"}`;
  return selectable ? (
    <button type="button" aria-pressed={selected} aria-label={`الصفحة ${n}`} onClick={() => onToggle(n)} className={`${cls} p-0 cursor-pointer`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// تقسيم PDF واستخراج صفحات منه
export default function PdfSplit() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("extract");
  const [rangeText, setRangeText] = useState("");
  const [everyN, setEveryN] = useState("1");
  const [rangesText, setRangesText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [doc, setDoc] = useState(null);
  const cancel = useRef(false);

  useEffect(() => () => void (doc?.loadingTask?.destroy?.() ?? doc?.destroy?.()), [doc]);

  const pageCount = file?.pageCount ?? 0;
  const parsedExtract = parseRanges(rangeText, pageCount);
  const selected = rangesToSet(parsedExtract.ranges);

  const choose = async ([f]) => {
    setError("");
    setResult(null);
    if (!isPdf(f)) return setError("اختر ملف PDF.");
    if (f.size > MAX_TOTAL_BYTES) return setError(`الملف أكبر من ${formatBytes(MAX_TOTAL_BYTES)}.`);
    setLoading(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { PDFDocument } = await loadPdfLib();
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      setFile({ name: f.name, size: f.size, bytes, pageCount: pdf.getPageCount() });
      setRangeText("");
      setRangesText("");
      setDoc(null);
      try {
        const pdfjs = await loadPdfJs();
        setDoc(await pdfjs.getDocument({ data: bytes.slice() }).promise);
      } catch {
        setDoc(null); // بدون معاينة، وتقدر تكتب أرقام الصفحات
      }
    } catch (e) {
      setFile(null);
      setError(pdfErrorMessage(e, f.name));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (n) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setResult(null);
    setRangeText(formatRanges(next));
  };

  const run = async () => {
    setError("");
    setResult(null);
    const total = file.pageCount;
    const base = baseName(file.name);
    let jobs = [];
    if (mode === "extract") {
      if (parsedExtract.error) return setError(parsedExtract.error);
      if (!selected.size) return setError("اختر صفحة وحدة على الأقل.");
      jobs = [{ name: `${base}-صفحات.pdf`, pages: [...selected].sort((a, b) => a - b) }];
    } else if (mode === "all") {
      jobs = Array.from({ length: total }, (_, i) => ({ name: `${base}-صفحة-${i + 1}.pdf`, pages: [i + 1] }));
    } else if (mode === "every") {
      const n = Math.floor(Number(everyN));
      if (!n || n < 1) return setError("اكتب عدد الصفحات في كل ملف.");
      for (let start = 1; start <= total; start += n) {
        const end = Math.min(total, start + n - 1);
        jobs.push({ name: `${base}-${start}-${end}.pdf`, pages: Array.from({ length: end - start + 1 }, (_, i) => start + i) });
      }
    } else {
      const parsed = parseRanges(rangesText, total);
      if (parsed.error) return setError(parsed.error);
      if (!parsed.ranges.length) return setError("اكتب نطاق واحد على الأقل، مثل 1-3.");
      jobs = parsed.ranges.map(([a, b]) => ({ name: `${base}-${a === b ? a : `${a}-${b}`}.pdf`, pages: Array.from({ length: b - a + 1 }, (_, i) => a + i) }));
    }
    if (jobs.length > 200) return setError("الملفات الناتجة كثيرة (أكثر من ٢٠٠). اختر تقسيم ثاني.");

    cancel.current = false;
    setProgress(0);
    try {
      const { PDFDocument } = await loadPdfLib();
      const src = await PDFDocument.load(file.bytes, { updateMetadata: false });
      const outputs = [];
      for (let i = 0; i < jobs.length; i++) {
        if (cancel.current) return;
        setProgress(i / jobs.length);
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, jobs[i].pages.map((p) => p - 1));
        pages.forEach((p) => out.addPage(p));
        outputs.push({ name: jobs[i].name, bytes: await out.save({ useObjectStreams: true }) });
        await tick();
      }
      if (outputs.length === 1) {
        setResult({ blob: new Blob([outputs[0].bytes], { type: "application/pdf" }), name: outputs[0].name, files: 1 });
      } else {
        const { zipSync } = await import("fflate");
        const zip = zipSync(Object.fromEntries(outputs.map((o) => [o.name, o.bytes])), { level: 0 });
        setResult({ blob: new Blob([zip], { type: "application/zip" }), name: `${base}-مقسوم.zip`, files: outputs.length });
      }
    } catch (e) {
      setError(pdfErrorMessage(e, file.name));
    } finally {
      setProgress(null);
    }
  };

  const busy = loading || progress !== null;
  const current = MODES.find((m) => m.id === mode);

  return (
    <ToolShell meta={META} parent={PDF_HUB}>
      <div className="grid gap-5">
        {!file ? (
          <FileDrop accept="application/pdf,.pdf" disabled={loading} onFiles={choose} title="اضغط واختر ملف PDF (أو اسحبه هنا)" hint={`ملف واحد · لين ${formatBytes(MAX_TOTAL_BYTES)}`} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border-2 border-ink bg-card p-3">
            <span className="min-w-0">
              <span className="block truncate font-bold" dir="auto">
                {file.name}
              </span>
              <span className="text-[14px] text-ink-soft">
                {num(file.pageCount)} صفحة · {formatBytes(file.size)}
              </span>
            </span>
            <button type="button" className="btn btn-sm btn-paper" disabled={busy} onClick={() => { setFile(null); setDoc(null); setResult(null); setError(""); }}>
              غيّر الملف
            </button>
          </div>
        )}
        {loading && <ProgressPanel label="جاري قراءة الملف…" value={0.5} />}
        <ErrorNote>{error}</ErrorNote>

        {file && (
          <>
            <div role="group" aria-label="طريقة التقسيم" className="flex flex-wrap gap-2.5">
              {MODES.map((m) => (
                <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setResult(null); setError(""); }}>
                  {m.name}
                </button>
              ))}
            </div>
            <p className="m-0 text-ink-soft">{current.note}</p>

            {mode === "extract" && (
              <div className="grid gap-2">
                <Field id="ps-range" label="الصفحات" dir="ltr" placeholder="1-3, 5, 8-10" value={rangeText} onChange={(e) => { setRangeText(e.target.value); setResult(null); }} error={parsedExtract.error} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm btn-paper !min-h-10" onClick={() => setRangeText(`1-${pageCount}`)}>
                    حدد الكل
                  </button>
                  <button type="button" className="btn btn-sm btn-paper !min-h-10" onClick={() => setRangeText("")}>
                    امسح التحديد
                  </button>
                  <span className="self-center text-[14px] text-ink-soft">{selected.size ? `${num(selected.size)} صفحة محددة` : "ما حددت شي"}</span>
                </div>
              </div>
            )}
            {mode === "every" && <Field id="ps-every" label="عدد الصفحات في كل ملف" type="number" min={1} dir="ltr" value={everyN} onChange={(e) => setEveryN(e.target.value)} />}
            {mode === "ranges" && <Field id="ps-ranges" label="النطاقات (كل نطاق ملف)" dir="ltr" placeholder="1-3, 4-6, 7" value={rangesText} onChange={(e) => setRangesText(e.target.value)} />}

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5" aria-label="صفحات الملف">
              {Array.from({ length: pageCount }, (_, i) => (
                <Thumb key={i} doc={doc} n={i + 1} selected={mode === "extract" && selected.has(i + 1)} selectable={mode === "extract"} onToggle={toggle} />
              ))}
            </div>

            {progress !== null ? (
              <ProgressPanel label="جاري التقسيم…" value={progress} onCancel={() => (cancel.current = true)} />
            ) : (
              <div className="sticky bottom-3 z-10">
                <button type="button" className="btn btn-pink" disabled={busy} onClick={run}>
                  {mode === "extract" ? "استخرج الصفحات" : "قسّم الملف"}
                </button>
              </div>
            )}
          </>
        )}

        {result && (
          <ResultCard title="جاهز!" downloadLabel={result.files > 1 ? "نزّل الملفات (ZIP)" : "نزّل الملف"} onDownload={() => downloadBlob(result.blob, result.name)} onReset={() => { setFile(null); setDoc(null); setResult(null); }}>
            <p className="m-0">
              {num(result.files)} {result.files > 1 ? "ملفات" : "ملف"} · {formatBytes(result.blob.size)}
            </p>
          </ResultCard>
        )}
      </div>
    </ToolShell>
  );
}

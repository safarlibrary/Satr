import { useRef, useState } from "react";
import { PDF_HUB, PDF_TOOLS } from "../../../shared/tools";
import { ToolShell } from "./ToolShell";
import { LEVELS, compressPdf } from "./pdf/compress";
import { MAX_TOTAL_BYTES, baseName, downloadBlob, formatBytes, isPdf, num, pdfErrorMessage } from "./pdf/engine";
import { ErrorNote, FileDrop, ProgressPanel, ResultCard } from "./pdf/ui";

const META = PDF_TOOLS.find((t) => t.slug === "compress");

// ضغط PDF بثلاث مستويات: يعرض الحجم قبل وبعد
export default function PdfCompress() {
  const [file, setFile] = useState(null);
  const [level, setLevel] = useState("medium");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const cancel = useRef(false);

  const choose = ([f]) => {
    setError("");
    setResult(null);
    if (!isPdf(f)) return setError("اختر ملف PDF.");
    if (f.size > MAX_TOTAL_BYTES) return setError(`الملف أكبر من ${formatBytes(MAX_TOTAL_BYTES)}.`);
    setFile(f);
  };

  const run = async () => {
    setError("");
    setResult(null);
    cancel.current = false;
    setProgress(0);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await compressPdf(bytes, level, { onProgress: setProgress, shouldCancel: () => cancel.current });
      if (!res) return;
      if (res.bytes.length >= file.size) setResult({ same: true, level, recompressed: res.recompressed });
      else setResult({ blob: new Blob([res.bytes], { type: "application/pdf" }), level, recompressed: res.recompressed, rasterized: Boolean(res.rasterized) });
    } catch (e) {
      setError(pdfErrorMessage(e, file.name));
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const saved = result?.blob ? Math.round((1 - result.blob.size / file.size) * 100) : 0;

  return (
    <ToolShell meta={META} parent={PDF_HUB}>
      <div className="grid gap-5">
        {!file ? (
          <FileDrop accept="application/pdf,.pdf" onFiles={choose} title="اضغط واختر ملف PDF (أو اسحبه هنا)" hint={`ملف واحد · لين ${formatBytes(MAX_TOTAL_BYTES)}`} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border-2 border-ink bg-card p-3">
            <span className="min-w-0">
              <span className="block truncate font-bold" dir="auto">
                {file.name}
              </span>
              <span className="text-[14px] text-ink-soft">الحجم الحالي: {formatBytes(file.size)}</span>
            </span>
            <button type="button" className="btn btn-sm btn-paper" disabled={busy} onClick={() => { setFile(null); setResult(null); setError(""); }}>
              غيّر الملف
            </button>
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>

        {file && (
          <>
            <fieldset className="border-0 p-0 m-0 grid gap-2.5" disabled={busy}>
              <legend className="label">مستوى الضغط</legend>
              {LEVELS.map((l) => (
                <label key={l.id} className={`flex items-start gap-3 rounded-[16px] border-2 border-ink p-3.5 cursor-pointer ${level === l.id ? "bg-mint" : "bg-card"}`}>
                  <input type="radio" name="level" className="mt-1.5 w-5 h-5 accent-[var(--color-leaf)]" checked={level === l.id} onChange={() => { setLevel(l.id); setResult(null); }} />
                  <span>
                    <span className="block font-bold text-[17px]">{l.name}</span>
                    <span className="block text-[14px] text-ink-soft">{l.note}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {progress !== null ? (
              <ProgressPanel label={level === "strong" ? "جاري ضغط الصفحات…" : "جاري الضغط…"} value={progress} onCancel={() => (cancel.current = true)} />
            ) : (
              <div>
                <button type="button" className="btn btn-pink" onClick={run}>
                  اضغط الملف
                </button>
              </div>
            )}
          </>
        )}

        {result?.same && (
          <div className="panel !rounded-[22px] p-5 grid gap-2" role="status">
            <p className="m-0 text-[20px] font-extrabold">الملف مضغوط أصلًا</p>
            <p className="m-0">ما قدرنا نصغّره أكثر بهذا المستوى، فما غيّرنا فيه شي.{result.level !== "strong" && " إذا تبغا حجم أصغر جرّب المستوى القوي (النص يصير صورة)."}</p>
            {result.level !== "strong" && (
              <div>
                <button type="button" className="btn btn-sm btn-butter" onClick={() => { setLevel("strong"); setResult(null); }}>
                  جرّب المستوى القوي
                </button>
              </div>
            )}
          </div>
        )}

        {result?.blob && (
          <ResultCard title={`وفّرنا ${num(saved)}٪ من الحجم`} onDownload={() => downloadBlob(result.blob, `${baseName(file.name)}-مضغوط.pdf`)} downloadLabel="نزّل الملف المضغوط" onReset={() => { setFile(null); setResult(null); }}>
            <div className="grid gap-1.5 max-w-[420px]">
              <div className="flex justify-between gap-3">
                <span>قبل</span>
                <b>{formatBytes(file.size)}</b>
              </div>
              <div className="h-3 rounded-full border-2 border-ink bg-card overflow-hidden">
                <div className="h-full bg-pink-deep" style={{ width: "100%" }} />
              </div>
              <div className="flex justify-between gap-3">
                <span>بعد</span>
                <b>{formatBytes(result.blob.size)}</b>
              </div>
              <div className="h-3 rounded-full border-2 border-ink bg-card overflow-hidden">
                <div className="h-full bg-mint border-l-2 border-ink" style={{ width: `${Math.max(2, Math.round((result.blob.size / file.size) * 100))}%` }} />
              </div>
            </div>
            {result.level === "medium" && result.recompressed === 0 && <p className="m-0 text-[15px] text-ink-soft">ما لقينا صور كبيرة داخل الملف نضغطها. إذا الحجم للحين كبير جرّب المستوى القوي.</p>}
            {result.rasterized && <p className="m-0 text-[15px] text-ink-soft">انتبه: النص في هذا الملف صار صورة، فما تقدر تحدده أو تبحث فيه.</p>}
          </ResultCard>
        )}
      </div>
    </ToolShell>
  );
}

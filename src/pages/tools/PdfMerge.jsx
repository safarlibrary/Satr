import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { PDF_HUB, PDF_TOOLS } from "../../../shared/tools";
import { ToolShell } from "./ToolShell";
import { checkLimits, downloadBlob, formatBytes, isPdf, loadPdfLib, nextId, num, pdfErrorMessage, tick } from "./pdf/engine";
import { ErrorNote, FileDrop, ProgressPanel, ResultCard, SortableList } from "./pdf/ui";

const META = PDF_TOOLS.find((t) => t.slug === "merge");

// دمج عدة ملفات PDF في ملف واحد
export default function PdfMerge() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const cancel = useRef(false);

  const addFiles = async (files) => {
    setError("");
    setResult(null);
    const pdfs = files.filter(isPdf);
    const limit = checkLimits(items.map((i) => ({ size: i.size })), pdfs);
    if (limit) return setError(limit);
    setReading(true);
    const { PDFDocument } = await loadPdfLib();
    const added = [];
    const problems = files.length > pdfs.length ? [`${num(files.length - pdfs.length)} ملف مو PDF وتجاهلناه`] : [];
    for (const file of pdfs) {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
        added.push({ id: nextId(), file, name: file.name, size: file.size, pages: doc.getPageCount() });
      } catch (e) {
        problems.push(pdfErrorMessage(e, file.name).replace(/\.$/, ""));
      }
      await tick();
    }
    setReading(false);
    setItems((list) => [...list, ...added]);
    if (problems.length) setError(problems.join(". ") + ".");
  };

  const merge = async () => {
    setError("");
    setResult(null);
    cancel.current = false;
    setProgress(0);
    try {
      const { PDFDocument } = await loadPdfLib();
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        if (cancel.current) return;
        setProgress(i / items.length);
        const src = await PDFDocument.load(await items[i].file.arrayBuffer(), { updateMetadata: false });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
        await tick();
      }
      setProgress(0.97);
      const bytes = await out.save({ useObjectStreams: true });
      setResult({ blob: new Blob([bytes], { type: "application/pdf" }), pages: out.getPageCount(), files: items.length });
    } catch (e) {
      setError(pdfErrorMessage(e, "الملف"));
    } finally {
      setProgress(null);
    }
  };

  const busy = reading || progress !== null;
  const pages = items.reduce((s, i) => s + i.pages, 0);

  return (
    <ToolShell meta={META} parent={PDF_HUB}>
      <div className="grid gap-5">
        <FileDrop accept="application/pdf,.pdf" multiple disabled={busy} onFiles={addFiles} title="اضغط واختر ملفات PDF (أو اسحبها هنا)" hint={`لين ${num(50)} ملف و${formatBytes(100 * 1048576)}`} />
        {reading && <ProgressPanel label="جاري قراءة الملفات…" value={0.5} />}
        <ErrorNote>{error}</ErrorNote>

        {items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 font-bold">
                {num(items.length)} ملف · {num(pages)} صفحة
              </p>
              <button type="button" className="btn btn-sm btn-paper" disabled={busy} onClick={() => { setItems([]); setResult(null); }}>
                امسح الكل
              </button>
            </div>
            <SortableList
              items={items}
              onChange={(next) => {
                setResult(null);
                setItems(next);
              }}
              renderItem={(item) => (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-[15px]" dir="auto">
                      {item.name}
                    </span>
                    <span className="block text-[13px] text-ink-soft">
                      {num(item.pages)} صفحة · {formatBytes(item.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`احذف ${item.name}`}
                    disabled={busy}
                    className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-ink bg-card"
                    onClick={() => {
                      setResult(null);
                      setItems((list) => list.filter((i) => i.id !== item.id));
                    }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </>
              )}
            />
            {items.length < 2 && <p className="m-0 text-[15px] text-ink-soft">أضف ملفين على الأقل عشان تدمجهم.</p>}
            {progress !== null ? (
              <ProgressPanel label="جاري الدمج…" value={progress} onCancel={() => (cancel.current = true)} />
            ) : (
              <div>
                <button type="button" className="btn btn-pink" disabled={busy || items.length < 2} onClick={merge}>
                  ادمج الملفات
                </button>
              </div>
            )}
          </>
        )}

        {result && (
          <ResultCard
            title="تم الدمج!"
            onDownload={() => downloadBlob(result.blob, "مدموج.pdf")}
            onReset={() => {
              setItems([]);
              setResult(null);
            }}
          >
            <p className="m-0">
              {num(result.files)} ملفات في ملف واحد · {num(result.pages)} صفحة · {formatBytes(result.blob.size)}
            </p>
          </ResultCard>
        )}
      </div>
    </ToolShell>
  );
}

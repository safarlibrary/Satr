import { useRef, useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { PDF_HUB, PDF_TOOLS } from "../../../shared/tools";
import { SelectField } from "../../components/Field";
import { ToolShell } from "./ToolShell";
import { checkLimits, downloadBlob, formatBytes, nextId, num } from "./pdf/engine";
import { buildImagesPdf, isHeic, isImageFile, makeDecodable, makeThumb } from "./pdf/images";
import { ErrorNote, FileDrop, ProgressPanel, ResultCard, SortableList } from "./pdf/ui";

const META = PDF_TOOLS.find((t) => t.slug === "images");

// صور (JPG وPNG وHEIC...) إلى ملف PDF واحد
export default function PdfImages() {
  const [items, setItems] = useState([]);
  const [opts, setOpts] = useState({ size: "a4", margin: "small", orient: "auto" });
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(null);
  const [building, setBuilding] = useState(null);
  const [result, setResult] = useState(null);
  const cancel = useRef(false);

  const change = (fn) => {
    setResult(null);
    fn();
  };

  const addFiles = async (files) => {
    setError("");
    const images = files.filter(isImageFile);
    const skipped = files.length - images.length;
    const limit = checkLimits(items.map((i) => ({ size: i.size })), images);
    if (limit) return setError(limit);
    const added = [];
    const failed = [];
    for (let i = 0; i < images.length; i++) {
      setPreparing({ done: i, total: images.length, heic: isHeic(images[i]) });
      try {
        const blob = await makeDecodable(images[i]);
        const { thumb, width, height } = await makeThumb(blob);
        added.push({ id: nextId(), name: images[i].name, size: images[i].size, blob, thumb, width, height, rotation: 0 });
      } catch {
        failed.push(images[i].name);
      }
    }
    setPreparing(null);
    change(() => setItems((list) => [...list, ...added]));
    const problems = [];
    if (skipped) problems.push(`${num(skipped)} ملف مو صورة وتجاهلناه`);
    if (failed.length) problems.push(`ما قدرنا نفتح: ${failed.join("، ")}`);
    if (problems.length) setError(problems.join(". ") + ".");
  };

  const build = async () => {
    setError("");
    setResult(null);
    cancel.current = false;
    setBuilding(0);
    try {
      const bytes = await buildImagesPdf(items, opts, { onProgress: setBuilding, shouldCancel: () => cancel.current });
      if (bytes) setResult({ blob: new Blob([bytes], { type: "application/pdf" }), pages: items.length });
    } catch (e) {
      setError(/memory/i.test(String(e?.message)) ? "الصور كبيرة على جهازك. جرّب عدد أقل منها." : "صار خطأ أثناء إنشاء الملف، جرّب مرة ثانية.");
    } finally {
      setBuilding(null);
    }
  };

  const busy = preparing || building !== null;
  const total = items.reduce((s, i) => s + i.size, 0);

  return (
    <ToolShell meta={META} parent={PDF_HUB}>
      <div className="grid gap-5">
        <FileDrop
          accept="image/*,.heic,.heif"
          multiple
          disabled={busy}
          onFiles={addFiles}
          title="اضغط واختر صور (أو اسحبها هنا)"
          hint={`JPG وPNG وWEBP وصور الآيفون HEIC · لين ${num(50)} صورة و${formatBytes(100 * 1048576)}`}
        />
        {preparing && (
          <ProgressPanel
            label={`جاري تجهيز الصور${preparing.heic ? " (تحويل صور الآيفون ياخذ شوي)" : ""}…`}
            value={preparing.done / preparing.total}
          />
        )}
        <ErrorNote>{error}</ErrorNote>

        {items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 font-bold">
                {num(items.length)} صورة · {formatBytes(total)}
              </p>
              <button type="button" className="btn btn-sm btn-paper" disabled={busy} onClick={() => change(() => setItems([]))}>
                امسح الكل
              </button>
            </div>
            <SortableList
              items={items}
              onChange={(next) => change(() => setItems(next))}
              renderItem={(item) => (
                <>
                  <span className="w-14 h-14 shrink-0 rounded-lg border-2 border-ink bg-mint-soft grid place-items-center overflow-hidden">
                    <img src={item.thumb} alt="" className="max-w-full max-h-full object-contain transition-transform" style={{ transform: `rotate(${item.rotation}deg)` }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-[15px]" dir="auto">
                      {item.name}
                    </span>
                    <span className="block text-[13px] text-ink-soft">
                      {num(item.width)}×{num(item.height)} · {formatBytes(item.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`دوّر ${item.name}`}
                    disabled={busy}
                    className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-ink bg-card"
                    onClick={() => change(() => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, rotation: (i.rotation + 90) % 360 } : i))))}
                  >
                    <RotateCw size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`احذف ${item.name}`}
                    disabled={busy}
                    className="w-10 h-10 shrink-0 grid place-items-center rounded-xl border-2 border-ink bg-card"
                    onClick={() => change(() => setItems((list) => list.filter((i) => i.id !== item.id)))}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </>
              )}
            />

            <div className="panel !rounded-[20px] !shadow-none p-4 grid gap-4 sm:grid-cols-3">
              <SelectField id="pi-size" label="حجم الصفحة" value={opts.size} onChange={(v) => change(() => setOpts((o) => ({ ...o, size: v })))}>
                <option value="a4">A4</option>
                <option value="image">نفس مقاس الصورة</option>
              </SelectField>
              <SelectField id="pi-margin" label="الهوامش" value={opts.margin} onChange={(v) => change(() => setOpts((o) => ({ ...o, margin: v })))}>
                <option value="none">بدون</option>
                <option value="small">صغيرة</option>
                <option value="large">كبيرة</option>
              </SelectField>
              {opts.size === "a4" && (
                <SelectField id="pi-orient" label="اتجاه الصفحة" value={opts.orient} onChange={(v) => change(() => setOpts((o) => ({ ...o, orient: v })))}>
                  <option value="auto">تلقائي حسب الصورة</option>
                  <option value="portrait">طولي</option>
                  <option value="landscape">عرضي</option>
                </SelectField>
              )}
            </div>

            {building !== null ? (
              <ProgressPanel label="جاري إنشاء الملف…" value={building} onCancel={() => (cancel.current = true)} />
            ) : (
              <div>
                <button type="button" className="btn btn-pink" disabled={busy} onClick={build}>
                  حوّل إلى PDF
                </button>
              </div>
            )}
          </>
        )}

        {result && (
          <ResultCard
            title="جاهز!"
            onDownload={() => downloadBlob(result.blob, "صور.pdf")}
            onReset={() => {
              setItems([]);
              setResult(null);
            }}
          >
            <p className="m-0">
              {num(result.pages)} صفحة · {formatBytes(result.blob.size)}
            </p>
          </ResultCard>
        )}
      </div>
    </ToolShell>
  );
}

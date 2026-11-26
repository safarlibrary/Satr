import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import "./fonts";
import { REPORT_TOOL } from "../../../shared/tools";
import { Field } from "../../components/Field";
import { ToolShell } from "./ToolShell";
import { BODY_H, BlockView, REPORT_TEMPLATES, ReportPage, TitleBlock } from "./report/ReportDoc";
import { aiToDoc, parseText } from "./report/parse";
import { PAGE_H, PAGE_W, exportPages, frames, loadFonts, safeName } from "./export";
import { aiPost, useAiStatus } from "./ai";
import { ErrorNote } from "./pdf/ui";

const STORAGE_KEY = "satr-report-v1";
const SAMPLE = `أثر وسائل التواصل الاجتماعي على الطلاب

مقدمة
أصبحت وسائل التواصل الاجتماعي جزءًا من الحياة اليومية للطلاب، وتؤثر في طريقة دراستهم وتواصلهم مع زملائهم ومعلميهم.

الإيجابيات
- سهولة الوصول إلى المعلومات والمصادر التعليمية.
- التواصل السريع مع الزملاء والأساتذة.
- تكوين مجتمعات تعلّم وتبادل الخبرات.

السلبيات
كثرة الاستخدام قد تشتّت الانتباه وتقلّل من وقت المذاكرة، كما أن بعض المحتوى غير موثوق ويحتاج الطالب إلى التحقق منه قبل الاعتماد عليه.

الخاتمة
الاستخدام المتوازن يحقق للطالب فائدة كبيرة ويقلل من الآثار السلبية.`;

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (s && typeof s === "object") return s;
  } catch {}
  return null;
}

export default function ReportMaker() {
  const saved = useRef(loadSaved()).current;
  const [text, setText] = useState(saved?.text ?? "");
  const [titleOverride, setTitleOverride] = useState(saved?.titleOverride ?? "");
  const [author, setAuthor] = useState(saved?.author ?? "");
  const [course, setCourse] = useState(saved?.course ?? "");
  const [date, setDate] = useState(saved?.date ?? "");
  const [template, setTemplate] = useState(REPORT_TEMPLATES.some((t) => t.id === saved?.template) ? saved.template : "academic");
  const [aiDoc, setAiDoc] = useState(null); // { doc, forText }
  const [pages, setPages] = useState([]);
  const [fontsTick, setFontsTick] = useState(0);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(0.45);
  const ai = useAiStatus();
  const wrapRef = useRef(null);
  const exportRef = useRef(null);
  const measureRef = useRef(null);
  const probeRef = useRef(null);

  const doc = useMemo(() => (aiDoc && aiDoc.forText === text ? aiDoc.doc : parseText(text)), [text, aiDoc]);
  const title = titleOverride.trim() || doc.title || "عنوان التقرير";
  const meta = useMemo(() => [author, course, date].map((x) => x.trim()).filter(Boolean), [author, course, date]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, titleOverride, author, course, date, template }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [text, titleOverride, author, course, date, template]);

  // نعيد التقسيم بعد ما تنحمّل الخطوط (القياس قبلها يكون غلط)
  useEffect(() => {
    let alive = true;
    loadFonts().then(() => alive && setFontsTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(Math.min(1, w / PAGE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // تقسيم الصفحات: نقيس ارتفاع كل كتلة ونرصّها، والفقرة الطويلة تنقسم بين الصفحات
  useLayoutEffect(() => {
    const list = measureRef.current;
    const probe = probeRef.current;
    if (!list || !probe) return;
    const nodes = [...list.children]; // [title, ...blocks]
    const measureP = (t) => {
      probe.firstChild.textContent = t;
      return probe.offsetHeight;
    };
    const out = [[]];
    let y = 0;
    const cur = () => out[out.length - 1];
    const newPage = () => {
      const last = cur().at(-1);
      const moved = last && last.kind === "block" && last.b.t === "h" && cur().length > 1 ? cur().pop() : null;
      out.push(moved ? [moved] : []);
      y = moved ? (moved.h ?? 0) : 0;
    };
    const add = (item, h) => {
      cur().push({ ...item, h });
      y += h;
    };
    const place = (item, h) => {
      if (y + h > BODY_H && cur().length) newPage();
      add(item, h);
    };
    place({ kind: "title" }, nodes[0].offsetHeight);
    doc.blocks.forEach((b, i) => {
      const h = nodes[i + 1].offsetHeight;
      if (b.t !== "p" || y + h <= BODY_H) return place({ kind: "block", b }, h);
      let rest = b.text;
      let guard = 0;
      while (rest && guard++ < 400) {
        const space = BODY_H - y;
        const full = measureP(rest);
        if (full <= space) {
          add({ kind: "block", b: { t: "p", text: rest } }, full);
          break;
        }
        const words = rest.split(" ");
        let lo = 0;
        let hi = words.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (measureP(words.slice(0, mid).join(" ")) <= space) lo = mid;
          else hi = mid - 1;
        }
        if (lo < 6 && cur().length) {
          newPage();
          continue;
        }
        lo = Math.max(1, lo);
        const part = words.slice(0, lo).join(" ");
        add({ kind: "block", b: { t: "p", text: part } }, measureP(part));
        newPage();
        rest = words.slice(lo).join(" ");
      }
    });
    setPages(out.filter((p) => p.length));
  }, [doc, template, title, meta, fontsTick]);

  const exportReport = async (kind) => {
    setError("");
    setBusy(kind);
    try {
      setMounted(true);
      await frames();
      const nodes = [...(exportRef.current?.children ?? [])];
      if (!nodes.length) throw new Error("no pages");
      await exportPages(nodes, kind, `تقرير-${safeName(title) || "ملف"}`);
    } catch {
      setError("ما قدرنا نجهّز الملف على جهازك. جرّب مرة ثانية، أو بنص أقصر.");
    } finally {
      setMounted(false);
      setBusy(null);
    }
  };

  const askAi = async () => {
    setError("");
    setBusy("ai");
    try {
      const r = await aiPost("/api/ai/format", { text });
      setAiDoc({ doc: aiToDoc(r), forText: text });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const total = Math.max(1, pages.length);
  const hasText = text.trim().length > 0;

  return (
    <ToolShell meta={REPORT_TOOL} privacy="ai">
      <div className="grid gap-6">
        <div role="group" aria-label="اختر القالب" className="flex flex-wrap gap-2.5">
          {REPORT_TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
              {t.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
          <div className="grid gap-5">
            <section className="panel p-5 sm:p-6 grid gap-4" aria-labelledby="rp-text">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="rp-text" className="m-0 text-[20px] font-extrabold">
                  الصق نصك هنا
                </h2>
                <button type="button" className="btn btn-sm btn-paper" onClick={() => setText(SAMPLE)}>
                  جرّب بنص تجريبي
                </button>
              </div>
              <textarea className="field min-h-64 resize-y leading-relaxed" aria-labelledby="rp-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={"العنوان في أول سطر\n\nمقدمة\nنص المقدمة…\n\n- نقطة\n- نقطة"} />
              <p className="m-0 text-[14px] text-ink-soft">نقسّم النص لعناوين وفقرات ونقاط تلقائيًا: السطر القصير اللي بين سطرين فاضيين يصير عنوان، وسطر يبدأ بـ - أو • أو رقم يصير نقطة.</p>
            </section>

            <section className="panel p-5 sm:p-6 grid gap-4 sm:grid-cols-2" aria-labelledby="rp-meta">
              <h2 id="rp-meta" className="m-0 sm:col-span-2 text-[20px] font-extrabold">
                بيانات اختيارية تظهر تحت العنوان
              </h2>
              <Field id="rp-title" label="العنوان (إذا تبي غير أول سطر)" value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} />
              <Field id="rp-author" label="اسم الطالب" value={author} onChange={(e) => setAuthor(e.target.value)} />
              <Field id="rp-course" label="المادة / الدكتور" value={course} onChange={(e) => setCourse(e.target.value)} />
              <Field id="rp-date" label="التاريخ" value={date} onChange={(e) => setDate(e.target.value)} placeholder="مثلًا: ١٤٤٨/٠٦/١٥ هـ" />
            </section>

            <section className="panel stitched !rounded-[24px] p-5 sm:p-6 grid gap-3" aria-labelledby="rp-ai">
              <h2 id="rp-ai" className="relative m-0 text-[20px] font-extrabold flex items-center gap-2">
                <Sparkles size={22} className="text-leaf" aria-hidden="true" /> تقسيم أذكى بالذكاء الاصطناعي
              </h2>
              {ai.available ? (
                <>
                  <p className="relative m-0 text-[15px] text-ink-soft">
                    يرتّب نصك في عناوين وفقرات ونقاط بشكل أدق، بدون ما يحذف أو يضيف معلومات. نصك يروح للذكاء الاصطناعي بس لما تضغط الزر.
                    {ai.dailyLimit ? ` الحد اليومي ${ai.dailyLimit.toLocaleString("ar-SA")} مرات.` : ""}
                  </p>
                  <div className="relative flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-pink" disabled={busy !== null || text.trim().length < 20} onClick={askAi}>
                      {busy === "ai" ? "جاري الترتيب…" : "رتّب نصي"}
                    </button>
                    {aiDoc && aiDoc.forText === text && (
                      <>
                        <span className="font-bold text-leaf">طُبّق ✓</span>
                        <button type="button" className="btn btn-sm btn-paper" onClick={() => setAiDoc(null)}>
                          ارجع للتقسيم التلقائي
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="relative m-0 text-[15px] text-ink-soft">{ai.ready ? "الترتيب الذكي غير مفعّل حاليًا، والتقسيم التلقائي يكفي لأغلب النصوص." : "جاري التحقق…"}</p>
              )}
            </section>
            <p className="m-0 text-[14px] text-ink-soft">
              نحفظ ما كتبته في متصفحك فقط.{" "}
              <button
                type="button"
                className="bg-transparent border-0 p-0 text-leaf font-bold underline"
                onClick={() => {
                  setText("");
                  setAiDoc(null);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
              >
                امسح النص
              </button>
            </p>
          </div>

          <div className="grid gap-4 lg:sticky lg:top-24">
            <div ref={wrapRef} className="w-full grid gap-4">
              {(hasText ? pages : [[{ kind: "title" }]]).slice(0, 12).map((items, i) => (
                <div key={i} className="relative mx-auto bg-white border-2 border-ink shadow-[5px_5px_0_var(--color-ink)]" style={{ width: PAGE_W * scale, height: PAGE_H * scale }} role="img" aria-label={`صفحة ${(i + 1).toLocaleString("ar-SA")} من ${total.toLocaleString("ar-SA")}`}>
                  <div className="absolute top-0 left-0" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                    <ReportPage id={template} items={items} title={title} meta={meta} n={i + 1} total={total} />
                  </div>
                </div>
              ))}
              {pages.length > 12 && <p className="m-0 text-center text-[14px] text-ink-soft">المعاينة تعرض أول ١٢ صفحة، والتحميل يشمل الكل ({pages.length.toLocaleString("ar-SA")} صفحة).</p>}
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className="btn btn-pink" disabled={busy !== null || !hasText} onClick={() => exportReport("pdf")}>
                {busy === "pdf" ? "جاري التجهيز…" : "حمّل PDF"}
              </button>
              <button type="button" className="btn btn-butter" disabled={busy !== null || !hasText} onClick={() => exportReport("png")}>
                {busy === "png" ? "جاري التجهيز…" : pages.length > 1 ? "حمّل الصور (ZIP)" : "حمّل صورة PNG"}
              </button>
            </div>
            <p className="m-0 text-center text-[14px] text-ink-soft">
              {pages.length.toLocaleString("ar-SA")} صفحة A4 بجودة طباعة عالية. الـ PDF يكون صور الصفحات، فالنص ما ينحدد منه.
            </p>
            <ErrorNote>{error}</ErrorNote>
          </div>
        </div>
      </div>

      {/* قياس الكتل (مخفي) */}
      <div className={`rpx rp-${template} rp-measure`} style={{ width: 650, height: "auto", overflow: "visible", position: "fixed" }} aria-hidden="true">
        <div ref={measureRef}>
          <div style={{ display: "flow-root" }}>
            <TitleBlock title={title} meta={meta} />
          </div>
          {doc.blocks.map((b, i) => (
            <div key={i} style={{ display: "flow-root" }}>
              <BlockView b={b} />
            </div>
          ))}
        </div>
        <div ref={probeRef} style={{ display: "flow-root" }}>
          <p className="b-p" />
        </div>
      </div>

      {mounted && (
        <div ref={exportRef} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, width: PAGE_W, pointerEvents: "none" }}>
          {pages.map((items, i) => (
            <ReportPage key={i} id={template} items={items} title={title} meta={meta} n={i + 1} total={total} />
          ))}
        </div>
      )}
    </ToolShell>
  );
}

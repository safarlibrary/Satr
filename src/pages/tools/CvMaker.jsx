import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import "./fonts";
import { CV_TOOL } from "../../../shared/tools";
import { Field } from "../../components/Field";
import { ToolShell } from "./ToolShell";
import { CV_TEMPLATES, CvTemplate } from "./cv/CvTemplates";
import { PAGE_H, PAGE_W, exportPages, frames, safeName } from "./export";
import { aiPost, useAiStatus } from "./ai";
import { ErrorNote } from "./pdf/ui";

const STORAGE_KEY = "satr-cv-v1";
const blankJob = () => ({ title: "", company: "", period: "", details: "" });
const blankEdu = () => ({ degree: "", school: "", period: "" });
const EMPTY = { name: "", title: "", phone: "", email: "", city: "", links: "", summary: "", skills: "", languages: "", experience: [blankJob()], education: [blankEdu()] };

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") return saved;
  } catch {}
  return null;
}

const skillList = (s) => String(s ?? "").split(/[\n,،؛;]/).map((x) => x.trim()).filter(Boolean);

export default function CvMaker() {
  const saved = useRef(loadSaved()).current;
  const [d, setD] = useState({ ...EMPTY, ...(saved?.d ?? {}), experience: saved?.d?.experience?.length ? saved.d.experience : [blankJob()], education: saved?.d?.education?.length ? saved.d.education : [blankEdu()] });
  const [template, setTemplate] = useState(CV_TEMPLATES.some((t) => t.id === saved?.template) ? saved.template : "classic");
  const [tab, setTab] = useState("form");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(0.45);
  const [overflow, setOverflow] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const ai = useAiStatus();
  const wrapRef = useRef(null);
  const pageRef = useRef(null);
  const exportRef = useRef(null);

  const set = (key) => (e) => setD((x) => ({ ...x, [key]: e.target.value }));
  const setRow = (key, i, field) => (e) => setD((x) => ({ ...x, [key]: x[key].map((r, k) => (k === i ? { ...r, [field]: e.target.value } : r)) }));
  const addRow = (key, blank) => setD((x) => ({ ...x, [key]: [...x[key], blank()] }));
  const removeRow = (key, i, blank) => setD((x) => ({ ...x, [key]: x[key].length > 1 ? x[key].filter((_, k) => k !== i) : [blank()] }));

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ d, template }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [d, template]);

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

  // تنبيه لو المحتوى أطول من صفحة A4
  useLayoutEffect(() => {
    const el = pageRef.current?.firstElementChild;
    if (!el) return;
    const inner = [...el.children].some((c) => c.scrollHeight > c.clientHeight + 2 && c.clientHeight > 0 && c.scrollHeight > PAGE_H);
    setOverflow(el.scrollHeight > PAGE_H + 2 || inner);
  }, [d, template]);

  const exportCv = async (kind) => {
    setError("");
    setBusy(kind);
    try {
      setMounted(true);
      await frames();
      const node = exportRef.current?.firstElementChild;
      if (!node) throw new Error("no node");
      await exportPages([node], kind, `سيرة-${safeName(d.name) || "ذاتية"}`);
    } catch {
      setError("ما قدرنا نجهّز الملف على جهازك. جرّب مرة ثانية، أو من جهاز أقوى.");
    } finally {
      setMounted(false);
      setBusy(null);
    }
  };

  const askAi = async () => {
    setError("");
    setBusy("ai");
    try {
      const r = await aiPost("/api/ai/cv", {
        title: d.title,
        summary: d.summary,
        experience: d.experience.map((j) => ({ title: j.title, company: j.company, details: j.details })),
        education: d.education,
        skills: skillList(d.skills),
      });
      setSuggest(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const hasContent = Boolean(d.summary || d.title || d.experience.some((j) => j.details || j.title) || d.education.some((e) => e.degree));

  return (
    <ToolShell meta={CV_TOOL} privacy="ai">
      <div className="grid gap-6">
        <div role="group" aria-label="اختر القالب" className="flex flex-wrap gap-2.5">
          {CV_TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
              {t.name}
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
          <form className={`grid gap-5 ${tab === "form" ? "" : "hidden"} lg:grid`} onSubmit={(e) => e.preventDefault()} noValidate>
            <fieldset className="panel p-5 sm:p-6 grid gap-4 sm:grid-cols-2 m-0">
              <legend className="sr-only">البيانات الشخصية</legend>
              <h2 className="m-0 sm:col-span-2 text-[20px] font-extrabold">بياناتك</h2>
              <Field id="cv-name" label="الاسم الكامل" autoComplete="name" value={d.name} onChange={set("name")} />
              <Field id="cv-title" label="المسمى أو التخصص" value={d.title} onChange={set("title")} placeholder="مثلًا: طالب نظم معلومات" />
              <Field id="cv-phone" label="الجوال" dir="ltr" inputMode="tel" value={d.phone} onChange={set("phone")} />
              <Field id="cv-email" label="البريد" dir="ltr" type="email" value={d.email} onChange={set("email")} />
              <Field id="cv-city" label="المدينة" value={d.city} onChange={set("city")} />
              <Field id="cv-links" label="رابط (لينكدإن أو موقعك)" dir="ltr" value={d.links} onChange={set("links")} />
              <div className="sm:col-span-2">
                <label className="label" htmlFor="cv-summary">
                  نبذة عنك
                </label>
                <textarea id="cv-summary" className="field min-h-24 resize-y leading-relaxed" value={d.summary} onChange={set("summary")} placeholder="جملتين عن تخصصك وهدفك" />
              </div>
            </fieldset>

            <fieldset className="panel p-5 sm:p-6 grid gap-4 m-0">
              <legend className="sr-only">الخبرات</legend>
              <h2 className="m-0 text-[20px] font-extrabold">الخبرات والتدريب</h2>
              {d.experience.map((j, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-2 rounded-2xl border-2 border-dashed border-ink/20 p-4">
                  <Field id={`cv-jt-${i}`} label="المسمى" value={j.title} onChange={setRow("experience", i, "title")} />
                  <Field id={`cv-jc-${i}`} label="الجهة" value={j.company} onChange={setRow("experience", i, "company")} />
                  <Field id={`cv-jp-${i}`} label="الفترة" value={j.period} onChange={setRow("experience", i, "period")} placeholder="٢٠٢٤ – ٢٠٢٥" />
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`cv-jd-${i}`}>
                      وش سويت؟ (سطر لكل نقطة)
                    </label>
                    <textarea id={`cv-jd-${i}`} className="field min-h-24 resize-y leading-relaxed" value={j.details} onChange={setRow("experience", i, "details")} />
                  </div>
                  <button type="button" className="btn btn-sm btn-paper justify-self-start sm:col-span-2" onClick={() => removeRow("experience", i, blankJob)}>
                    <Trash2 size={16} aria-hidden="true" /> احذف
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-paper justify-self-start" onClick={() => addRow("experience", blankJob)}>
                <Plus size={16} aria-hidden="true" /> أضف خبرة
              </button>
            </fieldset>

            <fieldset className="panel p-5 sm:p-6 grid gap-4 m-0">
              <legend className="sr-only">التعليم</legend>
              <h2 className="m-0 text-[20px] font-extrabold">التعليم</h2>
              {d.education.map((e, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-2 rounded-2xl border-2 border-dashed border-ink/20 p-4">
                  <Field id={`cv-ed-${i}`} label="الشهادة أو التخصص" value={e.degree} onChange={setRow("education", i, "degree")} />
                  <Field id={`cv-es-${i}`} label="الجامعة أو المدرسة" value={e.school} onChange={setRow("education", i, "school")} />
                  <Field id={`cv-ep-${i}`} label="الفترة" value={e.period} onChange={setRow("education", i, "period")} />
                  <button type="button" className="btn btn-sm btn-paper justify-self-start self-end" onClick={() => removeRow("education", i, blankEdu)}>
                    <Trash2 size={16} aria-hidden="true" /> احذف
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-paper justify-self-start" onClick={() => addRow("education", blankEdu)}>
                <Plus size={16} aria-hidden="true" /> أضف تعليم
              </button>
            </fieldset>

            <fieldset className="panel p-5 sm:p-6 grid gap-4 sm:grid-cols-2 m-0">
              <legend className="sr-only">المهارات واللغات</legend>
              <div>
                <label className="label" htmlFor="cv-skills">
                  المهارات (افصل بفاصلة أو سطر)
                </label>
                <textarea id="cv-skills" className="field min-h-24 resize-y" value={d.skills} onChange={set("skills")} placeholder="إكسل، تواصل، عمل جماعي" />
              </div>
              <div>
                <label className="label" htmlFor="cv-langs">
                  اللغات
                </label>
                <textarea id="cv-langs" className="field min-h-24 resize-y" value={d.languages} onChange={set("languages")} placeholder="العربية، الإنجليزية" />
              </div>
            </fieldset>

            <section className="panel stitched !rounded-[24px] p-5 sm:p-6 grid gap-3" aria-labelledby="cv-ai">
              <h2 id="cv-ai" className="relative m-0 text-[20px] font-extrabold flex items-center gap-2">
                <Sparkles size={22} className="text-leaf" aria-hidden="true" /> اقتراحات بالذكاء الاصطناعي
              </h2>
              {ai.available ? (
                <>
                  <p className="relative m-0 text-[15px] text-ink-soft">
                    يحسّن صياغة النبذة والنقاط ويقترح مهارات، بدون ما يضيف معلومات من عنده. نصك يروح للذكاء الاصطناعي بس لما تضغط الزر.
                    {ai.dailyLimit ? ` الحد اليومي ${ai.dailyLimit.toLocaleString("ar-SA")} مرات.` : ""}
                  </p>
                  <div className="relative">
                    <button type="button" className="btn btn-pink" disabled={busy !== null || !hasContent} onClick={askAi}>
                      {busy === "ai" ? "جاري التفكير…" : "اقترح لي تحسينات"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="relative m-0 text-[15px] text-ink-soft">{ai.ready ? "الاقتراحات الذكية غير مفعّلة حاليًا. تقدر تكمل السيرة وتحمّلها بدونها." : "جاري التحقق…"}</p>
              )}
              {suggest && <Suggestions s={suggest} d={d} setD={setD} onClose={() => setSuggest(null)} />}
            </section>

            <p className="m-0 text-[14px] text-ink-soft">
              نحفظ ما كتبته في متصفحك فقط.{" "}
              <button
                type="button"
                className="bg-transparent border-0 p-0 text-leaf font-bold underline"
                onClick={() => {
                  setD({ ...EMPTY, experience: [blankJob()], education: [blankEdu()] });
                  setSuggest(null);
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
              <div className="relative mx-auto bg-white border-2 border-ink shadow-[5px_5px_0_var(--color-ink)]" style={{ width: PAGE_W * scale, height: PAGE_H * scale }} role="img" aria-label="معاينة السيرة الذاتية بحجم A4">
                <div ref={pageRef} className="absolute top-0 left-0" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <CvTemplate id={template} d={d} />
                </div>
              </div>
            </div>
            {overflow && (
              <p role="status" className="m-0 text-center font-bold text-[15px] text-[#a36a00]">
                المحتوى أطول من صفحة A4. اختصر بعض النقاط عشان ما ينقص شي من الطباعة.
              </p>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className="btn btn-pink" disabled={busy === "pdf" || busy === "png"} onClick={() => exportCv("pdf")}>
                {busy === "pdf" ? "جاري التجهيز…" : "حمّل PDF"}
              </button>
              <button type="button" className="btn btn-butter" disabled={busy === "pdf" || busy === "png"} onClick={() => exportCv("png")}>
                {busy === "png" ? "جاري التجهيز…" : "حمّل صورة PNG"}
              </button>
            </div>
            <p className="m-0 text-center text-[14px] text-ink-soft">بجودة طباعة عالية (A4). الـ PDF يكون صورة السيرة، فالنص ما ينحدد منه.</p>
            <ErrorNote>{error}</ErrorNote>
          </div>
        </div>
      </div>

      {mounted && (
        <div ref={exportRef} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, width: PAGE_W, height: PAGE_H, pointerEvents: "none" }}>
          <CvTemplate id={template} d={d} ex />
        </div>
      )}
    </ToolShell>
  );
}

// نتائج الذكاء الاصطناعي: كل اقتراح له زر «استخدمه» وأنت تقرر
function Suggestions({ s, d, setD, onClose }) {
  const jobs = d.experience;
  const newSkills = s.skills.filter((x) => !skillList(d.skills).includes(x));
  return (
    <div className="relative grid gap-3 rounded-2xl border-2 border-ink bg-card p-4">
      {s.summary && (
        <div className="grid gap-2">
          <b>نبذة مقترحة</b>
          <p className="m-0 text-[15px]">{s.summary}</p>
          <button type="button" className="btn btn-sm justify-self-start" onClick={() => setD((x) => ({ ...x, summary: s.summary }))}>
            استخدمها
          </button>
        </div>
      )}
      {s.experience.map((e, i) =>
        e.bullets.length && jobs[i] ? (
          <div key={i} className="grid gap-2">
            <b>نقاط مقترحة: {jobs[i].title || `خبرة ${(i + 1).toLocaleString("ar-SA")}`}</b>
            <ul className="m-0 ps-5 text-[15px]">
              {e.bullets.map((b, k) => (
                <li key={k}>{b}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-sm justify-self-start" onClick={() => setD((x) => ({ ...x, experience: x.experience.map((j, k) => (k === i ? { ...j, details: e.bullets.join("\n") } : j)) }))}>
              استخدمها
            </button>
          </div>
        ) : null,
      )}
      {newSkills.length > 0 && (
        <div className="grid gap-2">
          <b>مهارات مقترحة</b>
          <p className="m-0 text-[15px]">{newSkills.join("، ")}</p>
          <button type="button" className="btn btn-sm justify-self-start" onClick={() => setD((x) => ({ ...x, skills: [...skillList(x.skills), ...newSkills].join("، ") }))}>
            أضفها
          </button>
        </div>
      )}
      <button type="button" className="btn btn-sm btn-paper justify-self-start" onClick={onClose}>
        إغلاق
      </button>
    </div>
  );
}

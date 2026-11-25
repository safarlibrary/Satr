import { useState } from "react";
import { api } from "../../lib/api";
import { useAdminData } from "./useAdminData";

const GROUPS = [
  ["payments", "الدفع الإلكتروني"],
  ["notifications", "الإشعارات والرسائل"],
  ["shipping", "الشحن"],
  ["marketing", "التسويق والتحليلات"],
  ["automation", "الأتمتة"],
];

const EVENTS = {
  "order.created": "طلب جديد",
  "stock.back": "رجع متوفر",
  "order.confirmed": "تأكيد للعميل",
  "order.updated": "تغيّر حالة",
  "order.shipped": "شحن",
  "order.delivered": "توصيل",
  "payment.paid": "دفع",
  "school_list.created": "قائمة مدرسة",
};

// صفحة التكاملات: كل خدمة لها بطاقة فيها التفعيل والمفاتيح وزر اختبار
export function AdminIntegrations({ token }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useAdminData("/api/admin/integrations", token, version);
  const [open, setOpen] = useState(null);

  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;

  const reload = () => setVersion((v) => v + 1);

  return (
    <div className="grid gap-10">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="panel p-6 !bg-ink text-paper" aria-labelledby="status-title">
          <h2 id="status-title" className="m-0 mb-3 text-[22px] font-extrabold text-paper">
            حالة الربط
          </h2>
          <ul className="list-none p-0 m-0 divide-y divide-paper/20">
            {data.integrations.map((i) => {
              const s = !i.enabled ? (i.configured ? "مضبوط، غير مفعّل" : "غير مضاف") : i.ready ? "متصل" : "ناقص إعداد";
              const tone = i.enabled && i.ready ? "text-mint" : i.enabled ? "text-butter" : "text-paper/60";
              return (
                <li key={i.key} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <span className="font-bold">{i.name}</span>
                  <span className={`shrink-0 ${tone}`}>{s}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="panel p-6 !bg-pink-deep" aria-labelledby="order-title">
          <h2 id="order-title" className="m-0 mb-3 text-[22px] font-extrabold">
            الترتيب الصحيح
          </h2>
          <ol className="m-0 ps-5 list-decimal grid gap-2 text-[16px]">
            <li>اربط الدومين واكتب رابط الموقع في الإعدادات.</li>
            <li>اضبط البريد من حسابك، أو وثّق الدومين في ريسند وأضف سجلات الدومين.</li>
            <li>أضف مفاتيح ميسّر في الوضع التجريبي وجرّب طلب كامل.</li>
            <li>
              ارفع ملف تحقق أبل باي (يُعرض على <code dir="ltr">/.well-known/</code>).
            </li>
            <li>اختبر، وبعدها بدّل ميسّر للوضع الحقيقي.</li>
          </ol>
        </section>
      </div>
      {GROUPS.map(([group, title]) => {
        const items = data.integrations.filter((i) => i.group === group);
        if (!items.length) return null;
        return (
          <section key={group} aria-labelledby={`g-${group}`}>
            <h2 id={`g-${group}`} className="m-0 mb-4 text-[22px] font-extrabold">
              {title}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              {items.map((integration) => (
                <IntegrationCard
                  key={integration.key}
                  integration={integration}
                  token={token}
                  open={open === integration.key}
                  onToggle={() => setOpen((k) => (k === integration.key ? null : integration.key))}
                  onSaved={reload}
                  extra={
                    integration.key === "feed" ? (
                      <CopyLine label="رابط ملف المنتجات" value={data.feedUrl} />
                    ) : integration.key === "moyasar" ? (
                      <CopyLine label="رابط الإشعارات — حطه في لوحة ميسّر ← Webhooks مع نفس سر الإشعارات" value={data.callbackUrl} />
                    ) : null
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="logs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="logs" className="m-0 text-[22px] font-extrabold">
            سجل الإرسال
          </h2>
          <button className="btn btn-paper btn-sm" onClick={reload}>
            تحديث
          </button>
        </div>
        {data.logs.length === 0 ? (
          <p className="lead m-0">ما فيه رسائل انرسلت لين الحين. أول ما يجيك طلب بتشوف هنا كل رسالة ونتيجتها.</p>
        ) : (
          <ul className="panel list-none m-0 p-0 divide-y-2 divide-dashed divide-ink/15 overflow-hidden">
            {data.logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[15px]">
                <span className={`font-extrabold ${log.ok ? "text-leaf" : "text-[#b0354f]"}`}>{log.ok ? "✓" : "✗"}</span>
                <b>{data.integrations.find((i) => i.key === log.integration)?.name ?? log.integration}</b>
                <span className="text-ink-soft">{EVENTS[log.event] ?? log.event}</span>
                <span className="text-ink-soft text-[13px]" dir="ltr">
                  {new Date(log.at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                </span>
                {!log.ok && <span className="basis-full text-[13px] text-[#b0354f] break-all" dir="auto">{log.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function statusOf(integration) {
  if (!integration.enabled) return { text: "متوقف", tint: "var(--color-card)" };
  if (!integration.ready) return { text: "ناقص إعداد", tint: "var(--color-butter)" };
  return { text: "شغّال", tint: "var(--color-mint)" };
}

function IntegrationCard({ integration, token, open, onToggle, onSaved, extra }) {
  const [enabled, setEnabled] = useState(integration.enabled);
  const [values, setValues] = useState(() => Object.fromEntries(integration.fields.map((f) => [f.name, f.value ?? ""])));
  const [clear, setClear] = useState([]);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const status = statusOf(integration);

  const save = async (e) => {
    e?.preventDefault();
    setBusy("save");
    setResult(null);
    try {
      await api(`/api/admin/integrations/${integration.key}`, { method: "PUT", json: { enabled, values, clear }, token });
      setResult({ ok: true, text: "انحفظ ✓" });
      setClear([]);
      onSaved();
      return true;
    } catch (err) {
      setResult({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!(await save())) return;
    setBusy("test");
    try {
      const r = await api(`/api/admin/integrations/${integration.key}/test`, { method: "POST", token });
      setResult({ ok: r.ok, text: r.message });
    } catch (err) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="panel p-5 grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[19px] font-extrabold">{integration.name}</h3>
          <p className="m-0 mt-1 text-[15px] text-ink-soft leading-relaxed">{integration.description}</p>
        </div>
        <span className="tag !text-[13px] shrink-0" style={{ background: status.tint }}>
          {status.text}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-sm" aria-expanded={open} onClick={onToggle}>
          {open ? "إغلاق" : "إعداد"}
        </button>
        {integration.docs && (
          <a href={integration.docs} target="_blank" rel="noopener noreferrer" className="text-[15px] font-bold text-leaf">
            لوحة الخدمة ↗
          </a>
        )}
      </div>

      {open && (
        <form className="grid gap-4 border-t-2 border-dashed border-ink/20 pt-4" onSubmit={save} noValidate>
          <label className="flex items-center gap-3 font-bold text-[17px] cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-[var(--color-leaf)]"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            تفعيل {integration.name}
          </label>

          {integration.fields.map((field, index) => {
            const id = `${integration.key}-${field.name}`;
            const cleared = clear.includes(field.name);
            const newSection = field.section && field.section !== integration.fields[index - 1]?.section;
            return (
              <div key={field.name} className="grid gap-0">
                {newSection && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mt-2 pt-3 border-t-2 border-dashed border-ink/15">
                    <h4 className="m-0 text-[17px] font-extrabold">
                      {field.section === "live" ? "مفاتيح الدفع الحقيقي (Live)" : "مفاتيح الدفع التجريبي (Test)"}
                    </h4>
                    <span className="tag !text-[12px]" style={{ background: values.mode === field.section ? "var(--color-mint)" : "var(--color-card)" }}>
                      {values.mode === field.section ? "مفعّلة الآن" : "غير مفعّلة"}
                    </span>
                  </div>
                )}
                <label className="label" htmlFor={id}>
                  {field.label}
                  {field.required && <span className="text-[#b0354f]"> *</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    id={id}
                    className="field"
                    value={values[field.name] || field.options[0][0]}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    {field.options.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={id}
                    className="field min-h-36 leading-relaxed text-[15px]"
                    dir="auto"
                    placeholder={field.placeholder ?? ""}
                    value={values[field.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={id}
                    className="field"
                    dir="ltr"
                    type={field.type === "secret" ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={field.type === "secret" && field.saved && !cleared ? "•••••••• محفوظ (اكتب جديد للتغيير)" : field.placeholder ?? ""}
                    value={values[field.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                )}
                {field.help && <p className="m-0 mt-1.5 text-[14px] text-ink-soft">{field.help}</p>}
                {field.type === "secret" && field.saved && (
                  <label className="mt-1.5 flex items-center gap-2 text-[14px] text-ink-soft cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cleared}
                      onChange={(e) => setClear((c) => (e.target.checked ? [...c, field.name] : c.filter((n) => n !== field.name)))}
                    />
                    امسح المفتاح المحفوظ
                  </label>
                )}
              </div>
            );
          })}

          {extra}

          {result && (
            <p role={result.ok ? "status" : "alert"} className={`m-0 font-bold text-[15px] break-words ${result.ok ? "text-leaf" : "text-[#b0354f]"}`} dir="auto">
              {result.text}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-sm btn-butter" disabled={busy !== null}>
              {busy === "save" ? "جاري الحفظ…" : "احفظ"}
            </button>
            {integration.testable && (
              <button type="button" className="btn btn-sm btn-paper" disabled={busy !== null || !enabled} onClick={test}>
                {busy === "test" ? "جاري الاختبار…" : "احفظ واختبر"}
              </button>
            )}
          </div>
        </form>
      )}
      {!open && extra && integration.enabled && <div>{extra}</div>}
    </article>
  );
}

function CopyLine({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="label !mb-1.5">{label}</p>
      <div className="flex gap-2 items-stretch">
        <code className="field !min-h-11 flex items-center text-[14px] overflow-x-auto whitespace-nowrap" dir="ltr">
          {value}
        </code>
        <button
          type="button"
          className="btn btn-sm btn-paper shrink-0"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "تم النسخ ✓" : "نسخ"}
        </button>
      </div>
    </div>
  );
}

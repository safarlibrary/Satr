import { useEffect, useState } from "react";
import { Field } from "../../components/Field";
import { api } from "../../lib/api";
import { useAdminData } from "./useAdminData";

const NUMBER_FIELDS = ["shippingFee", "freeShippingMin", "lowStock"];

// إعدادات المتجر: الهوية والتواصل، التوصيل، والأجهزة المسموح لها بالدخول
export function AdminSettings({ token, onSignOut }) {
  const { data, error } = useAdminData("/api/admin/settings", token);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ ok: true, text: "" });

  useEffect(() => {
    if (data) setForm({ ...data, ...Object.fromEntries(NUMBER_FIELDS.map((k) => [k, String(data[k])])) });
  }, [data]);

  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!form) return <p className="lead">جاري التحميل…</p>;

  const field = (key, label, props = {}) => (
    <Field id={`s-${key}`} label={label} value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
  );

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ ok: true, text: "" });
    try {
      await api("/api/admin/settings", { method: "PUT", json: form, token });
      setMessage({ ok: true, text: "انحفظت الإعدادات ✓" });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 max-w-[820px]">
      <form className="grid gap-8" onSubmit={save} noValidate>
        <section className="panel p-6 grid gap-5 sm:grid-cols-2">
          <h2 className="m-0 sm:col-span-2 text-[20px] font-extrabold">الهوية والدومين</h2>
          {field("storeName", "اسم العلامة")}
          <div>
            {field("storeUrl", "رابط الموقع (الدومين)", { dir: "ltr", placeholder: "https://satr.sa" })}
            <p className="m-0 mt-1.5 text-[14px] text-ink-soft">يُستخدم في روابط الدفع والرسائل وملف المنتجات.</p>
          </div>
          {field("officialEmail", "البريد الرسمي", { dir: "ltr", type: "email", placeholder: "hello@satr.sa" })}
          {field("senderName", "اسم المرسل", { placeholder: "سطر" })}
          {field("freelanceNumber", "رقم وثيقة العمل الحر", { dir: "ltr", placeholder: "FL-…" })}
          {field("businessCenterNumber", "رقم وثيقة مركز الأعمال", { dir: "ltr" })}
          <div className="sm:col-span-2">
            {field("supportWhatsapp", "رقم واتساب بزنس", { dir: "ltr", placeholder: "9665xxxxxxxx" })}
            <p className="m-0 mt-1.5 text-[14px] text-ink-soft">إذا عبّيته يظهر زر واتساب للزوار ويفتح محادثة مباشرة.</p>
          </div>
          <p className="m-0 sm:col-span-2 text-[14px] text-ink-soft">البريد والأرقام والحسابات اللي تعبّيها تظهر في أسفل الموقع، واللي تتركه فاضي ما يظهر.</p>
        </section>

        <section className="panel p-6 grid gap-5 sm:grid-cols-2">
          <h2 className="m-0 sm:col-span-2 text-[20px] font-extrabold">حسابات التواصل</h2>
          {field("instagram", "إنستقرام", { dir: "ltr", placeholder: "https://instagram.com/…" })}
          {field("tiktok", "تيك توك", { dir: "ltr", placeholder: "https://tiktok.com/@…" })}
          {field("snapchat", "سناب شات", { dir: "ltr", placeholder: "https://snapchat.com/add/…" })}
          {field("x", "إكس (تويتر)", { dir: "ltr", placeholder: "https://x.com/…" })}
          {field("linkedin", "لينكدإن", { dir: "ltr", placeholder: "https://linkedin.com/company/…" })}
        </section>

        <section className="panel p-6 grid gap-5 sm:grid-cols-2">
          <h2 className="m-0 sm:col-span-2 text-[20px] font-extrabold">التوصيل والمخزون</h2>
          {field("shippingFee", "رسوم التوصيل (ر.س)", { type: "number", min: 0, dir: "ltr" })}
          {field("freeShippingMin", "التوصيل مجاني للطلبات فوق (ر.س)", { type: "number", min: 0, dir: "ltr" })}
          {field("lowStock", "نبّهني إذا المخزون أقل من أو يساوي", { type: "number", min: 0, dir: "ltr" })}
        </section>

        {message.text && (
          <p role={message.ok ? "status" : "alert"} className={`m-0 font-bold ${message.ok ? "text-leaf" : "text-[#b0354f]"}`}>
            {message.text}
          </p>
        )}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? "جاري الحفظ…" : "احفظ الإعدادات"}
          </button>
        </div>
      </form>

      <Devices token={token} onSignOut={onSignOut} />
    </div>
  );
}

function Devices({ token, onSignOut }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useAdminData("/api/admin/devices", token, version);
  const [busy, setBusy] = useState(null);
  const date = (iso) => new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });

  const revoke = async (device) => {
    setBusy(device.id);
    try {
      const r = await api(`/api/admin/devices/${device.id}/revoke`, { method: "POST", token });
      if (r.signedOut) onSignOut?.(null);
      else setVersion((v) => v + 1);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel p-6 grid gap-4">
      <div>
        <h2 className="m-0 text-[20px] font-extrabold">الأجهزة المسموح لها بالدخول</h2>
        <p className="m-0 mt-1 text-[15px] text-ink-soft">
          لوحة التحكم تفتح من هذي الأجهزة بس. لإضافة جهاز جديد ادخل منه بالتوكن مرة وحدة. إذا ضاع جهاز ألغه من هنا.
        </p>
      </div>
      {error && <p className="m-0 text-[15px] text-ink-soft">{error}</p>}
      {data && (
        <ul className="list-none p-0 m-0 grid gap-3">
          {data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border-2 border-ink bg-mint-soft px-4 py-3">
              <div className="min-w-0">
                <p className="m-0 font-extrabold flex flex-wrap items-center gap-2" dir="auto">
                  {d.label}
                  {d.current && <span className="tag !text-[12px] !bg-mint">هذا الجهاز</span>}
                </p>
                <p className="m-0 text-[14px] text-ink-soft">
                  أُضيف {date(d.createdAt)} · آخر دخول {date(d.lastSeenAt)}
                </p>
              </div>
              <button className="btn btn-sm btn-paper !text-[#b0354f]" disabled={busy === d.id} onClick={() => revoke(d)}>
                {busy === d.id ? "جاري الإلغاء…" : "إلغاء الجهاز"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

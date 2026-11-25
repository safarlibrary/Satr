import { useEffect, useState } from "react";
import { ORDER_STATUS } from "../../components/Order";
import { api } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { useAdminData } from "./useAdminData";

const date = (iso) => new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });

// يفتح فاتورة الطلب في صفحة جديدة جاهزة للطباعة
export async function openInvoice(token, orderId) {
  const r = await fetch(`/api/admin/orders/${orderId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("ما قدرنا نفتح الفاتورة");
  const url = URL.createObjectURL(new Blob([await r.text()], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// العملاء: كل عميل وتحته طلباته، ومنها ترسل فاتورة أو رسالة من القوالب
export function AdminCustomers({ token }) {
  const { data, error } = useAdminData("/api/admin/customers", token);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;
  const term = q.trim();
  const list = data.filter((c) => !term || c.name.includes(term) || c.phone.includes(term) || c.email.includes(term));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">ابحث عن عميل</span>
          <input className="field" type="search" placeholder="ابحث بالاسم أو الجوال أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="btn btn-sm btn-butter" aria-expanded={showTemplates} onClick={() => setShowTemplates((v) => !v)}>
          {showTemplates ? "إخفاء القوالب" : "قوالب الرسائل"}
        </button>
      </div>
      {showTemplates && <Templates token={token} />}
      <p className="m-0 text-[15px] text-ink-soft">{list.length.toLocaleString("ar-SA")} عميل</p>
      {list.length === 0 && <p className="lead m-0">ما فيه عملاء لين الحين.</p>}
      <div className="grid gap-3">
        {list.map((c) => (
          <article key={c.phone} className="panel p-4 grid gap-3">
            <button
              type="button"
              className="flex flex-wrap items-center justify-between gap-2 bg-transparent border-0 p-0 text-start"
              aria-expanded={open === c.phone}
              onClick={() => setOpen(open === c.phone ? null : c.phone)}
            >
              <span className="grid">
                <b className="text-[17px]">
                  {c.name || "بدون اسم"} {c.registered && <span className="tag !text-[12px] !bg-mint align-middle">مسجّل</span>}
                </b>
                <span className="text-[14px] text-ink-soft" dir="ltr">
                  {c.phone}
                  {c.email ? ` · ${c.email}` : ""}
                </span>
              </span>
              <span className="text-[14px]">
                {c.orders.length.toLocaleString("ar-SA")} طلب · <b>{formatPrice(c.spent)}</b>
              </span>
            </button>
            {open === c.phone && (
              <ul className="list-none p-0 m-0 grid gap-3 border-t-2 border-dashed border-ink/15 pt-3">
                {c.orders.length === 0 && <li className="text-ink-soft">سجّل وما طلب لين الحين.</li>}
                {c.orders.map((o) => (
                  <CustomerOrder key={o.id} token={token} order={o} email={c.email} />
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function CustomerOrder({ token, order, email }) {
  const [compose, setCompose] = useState(false);
  return (
    <li className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <span>
          <b dir="ltr">{order.number}</b> · {date(order.createdAt)} · {ORDER_STATUS[order.status]} · {formatPrice(order.total)}
        </span>
        <button className="btn btn-sm btn-paper !min-h-9" onClick={() => setCompose((v) => !v)}>
          {compose ? "إغلاق" : "فاتورة ورسائل"}
        </button>
      </div>
      {compose && <MessageComposer token={token} order={{ ...order, customer: { email } }} />}
    </li>
  );
}

// إرسال رسالة بالبريد من القوالب لطلب معيّن
export function MessageComposer({ token, order }) {
  const { data } = useAdminData("/api/admin/templates", token);
  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState(order.customer?.email ?? "");
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState({ busy: false, ok: true, text: "" });

  useEffect(() => {
    if (data?.templates?.length && !templateId) setTemplateId(String(data.templates[0].id));
  }, [data, templateId]);

  useEffect(() => {
    if (!templateId) return;
    api(`/api/admin/orders/${order.id}/preview-message`, { method: "POST", json: { templateId: Number(templateId) }, token })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [templateId, order.id, token]);

  const send = async () => {
    setState({ busy: true, ok: true, text: "" });
    try {
      await api(`/api/admin/orders/${order.id}/send-message`, { method: "POST", json: { templateId: Number(templateId), to }, token });
      setState({ busy: false, ok: true, text: `انرسلت إلى ${to} ✓` });
    } catch (err) {
      setState({ busy: false, ok: false, text: err.message });
    }
  };

  return (
    <div className="rounded-[18px] border-2 border-ink bg-mint-soft p-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="label !mb-0">نوع الرسالة</span>
          <select className="field !min-h-11" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {(data?.templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="label !mb-0">إلى (بريد العميل)</span>
          <input className="field !min-h-11" type="email" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" />
        </label>
      </div>
      {preview && (
        <div className="rounded-xl bg-card border border-ink/20 p-3 text-[14px] max-h-64 overflow-y-auto">
          <b className="block mb-1">{preview.subject}</b>
          <div className="whitespace-pre-line">{preview.text}</div>
        </div>
      )}
      {state.text && <p className={`m-0 font-bold text-[15px] ${state.ok ? "text-leaf" : "text-[#b0354f]"}`}>{state.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={state.busy || !templateId || !to} onClick={send}>
          {state.busy ? "جاري الإرسال…" : "أرسل بالبريد"}
        </button>
        <button className="btn btn-sm btn-paper" onClick={() => openInvoice(token, order.id).catch((e) => setState({ busy: false, ok: false, text: e.message }))}>
          افتح الفاتورة للطباعة
        </button>
      </div>
    </div>
  );
}

// القوالب الموحّدة: فاتورة، شحن، عقد... تعدّلها وتضيف جديد
function Templates({ token }) {
  const [version, setVersion] = useState(0);
  const { data } = useAdminData("/api/admin/templates", token, version);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  if (!data) return <p className="lead">جاري التحميل…</p>;

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/templates", { method: "POST", json: edit, token });
      setEdit(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (id) => {
    await api(`/api/admin/templates/${id}`, { method: "DELETE", token });
    setEdit(null);
    setVersion((v) => v + 1);
  };

  return (
    <section className="panel p-5 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[20px] font-extrabold">قوالب الرسائل</h2>
        <button className="btn btn-sm" onClick={() => setEdit({ name: "", subject: "", body: "" })}>
          قالب جديد
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.templates.map((t) => (
          <button key={t.id} className="chip" aria-pressed={edit?.id === t.id} onClick={() => setEdit({ ...t })}>
            {t.name}
          </button>
        ))}
      </div>
      {edit && (
        <form className="grid gap-3" onSubmit={save} noValidate>
          <label className="grid gap-1.5">
            <span className="label !mb-0">اسم القالب</span>
            <input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </label>
          <label className="grid gap-1.5">
            <span className="label !mb-0">عنوان الرسالة</span>
            <input className="field" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
          </label>
          <label className="grid gap-1.5">
            <span className="label !mb-0">نص الرسالة</span>
            <textarea className="field min-h-48 leading-relaxed" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          </label>
          <p className="m-0 text-[14px] text-ink-soft">
            تقدر تستخدم: {data.placeholders.join("، ")}. {"{الفاتورة}"} تحط جدول الفاتورة كامل.
          </p>
          {error && <p className="m-0 font-bold text-[#b0354f]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm btn-butter">احفظ القالب</button>
            <button type="button" className="btn btn-sm btn-paper" onClick={() => setEdit(null)}>
              إلغاء
            </button>
            {edit.id && (
              <button type="button" className="btn btn-sm btn-paper !text-[#b0354f]" onClick={() => remove(edit.id)}>
                احذف القالب
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

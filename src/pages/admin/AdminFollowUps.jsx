import { useState } from "react";
import { Stars } from "../../components/Stars";
import { api } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import { useAdminData } from "./useAdminData";

const ago = (iso) => {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  return h < 24 ? `قبل ${h.toLocaleString("ar-SA")} ساعة` : `قبل ${Math.round(h / 24).toLocaleString("ar-SA")} يوم`;
};
const wa = (phone, text) => `https://wa.me/966${String(phone).replace(/^0/, "")}?text=${encodeURIComponent(text)}`;

function useAction(token, reload) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const run = async (key, path, method = "POST", json) => {
    setBusy(key);
    setError("");
    try {
      await api(path, { method, json, token });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

// السلات المتروكة: ناس حطوا منتجات وما كمّلوا الطلب (من ساعة وأكثر)
export function AdminCarts({ token }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useAdminData("/api/admin/carts", token, version);
  const { busy, error: actionError, run } = useAction(token, () => setVersion((v) => v + 1));
  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;
  const withPhone = data.filter((c) => c.phone);
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[15px] text-ink-soft">
        {data.length.toLocaleString("ar-SA")} سلة متروكة · {withPhone.length.toLocaleString("ar-SA")} منها فيها رقم جوال تقدر تذكّره · القيمة{" "}
        {formatPrice(data.reduce((s, c) => s + c.total, 0))}
      </p>
      {actionError && <p role="alert" className="m-0 font-bold text-[#b0354f]">{actionError}</p>}
      {data.length === 0 && <p className="lead m-0">ما فيه سلات متروكة 🎉</p>}
      {data.map((c) => (
        <article key={c.id} className="panel p-4 grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b>{c.name || (c.phone ? "عميل" : "زائر بدون رقم")}</b>
            <span className="text-[14px] text-ink-soft">
              {ago(c.updatedAt)} · <b className="text-ink">{formatPrice(c.total)}</b>
            </span>
          </div>
          {c.phone && (
            <span className="text-[14px] text-ink-soft" dir="ltr">
              {c.phone}
            </span>
          )}
          <ul className="list-none p-0 m-0 text-[15px]">
            {c.items.map((i) => (
              <li key={`${i.id}-${i.color ?? ""}`}>
                {i.name}
                {i.color && ` (${i.color})`} × {i.qty}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {c.phone && (
              <a
                className="btn btn-sm"
                target="_blank"
                rel="noopener noreferrer"
                href={wa(c.phone, `هلا${c.name ? ` ${c.name}` : ""}، شفنا إنك تركت منتجات في سلتك في متجر سطر 🛍️ إذا تحتاج مساعدة نكمّل الطلب معك`)}
                onClick={() => run(c.id, `/api/admin/carts/${c.id}/reminded`)}
              >
                ذكّره بالواتساب
              </a>
            )}
            {c.phone && (
              <button className="btn btn-sm btn-paper" disabled={busy === c.id} onClick={() => run(c.id, `/api/admin/carts/${c.id}/sms`)}>
                رسالة SMS
              </button>
            )}
            <button className="btn btn-sm btn-paper" disabled={busy === c.id} onClick={() => run(c.id, `/api/admin/carts/${c.id}`, "DELETE")}>
              احذف
            </button>
            {c.remindedAt && <span className="text-[13px] text-leaf font-bold">ذكّرته {ago(c.remindedAt)}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

// نبّهني إذا توفّر: مين ينتظر أي منتج أو لون
export function AdminAlerts({ token }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useAdminData("/api/admin/stock-alerts", token, version);
  const { busy, error: actionError, run } = useAction(token, () => setVersion((v) => v + 1));
  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;
  // نجمّعها حسب المنتج واللون
  const groups = new Map();
  for (const a of data) {
    const k = `${a.productId}|${a.color}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[15px] text-ink-soft">
        لما ترجّع الكمية من «المنتجات»، نرسل لهم SMS تلقائيًا إذا الرسائل مفعّلة. وإلا راسلهم بالواتساب من هنا.
      </p>
      {actionError && <p role="alert" className="m-0 font-bold text-[#b0354f]">{actionError}</p>}
      {data.length === 0 && <p className="lead m-0">ما فيه أحد ينتظر منتج.</p>}
      {[...groups.values()].map((list) => {
        const a0 = list[0];
        return (
          <article key={`${a0.productId}|${a0.color}`} className="panel p-4 grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b>
                {a0.productName}
                {a0.color && ` — ${a0.color}`}
              </b>
              <span className={`text-[14px] font-bold ${a0.available > 0 ? "text-leaf" : "text-[#b0354f]"}`}>
                {a0.available > 0 ? `رجع متوفر (${a0.available.toLocaleString("ar-SA")})` : "ما زال خالص"} · {list.length.toLocaleString("ar-SA")} ينتظرون
              </span>
            </div>
            <ul className="list-none p-0 m-0 grid gap-2">
              {list.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span dir="ltr">{a.phone}</span>
                  <span className="text-[13px] text-ink-soft">{ago(a.createdAt)}</span>
                  <a
                    className="btn btn-sm !min-h-9"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={wa(a.phone, `هلا! «${a.productName}»${a.color ? ` (${a.color})` : ""} رجع متوفر في متجر سطر 🎉`)}
                    onClick={() => run(a.id, `/api/admin/stock-alerts/${a.id}/notified`)}
                  >
                    بلّغه بالواتساب
                  </a>
                  <button className="btn btn-sm btn-paper !min-h-9" disabled={busy === a.id} onClick={() => run(a.id, `/api/admin/stock-alerts/${a.id}`, "DELETE")}>
                    احذف
                  </button>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

// التقييمات: تقدر تخفي أي تقييم أو تحذفه
export function AdminReviews({ token }) {
  const [version, setVersion] = useState(0);
  const { data, error } = useAdminData("/api/admin/reviews", token, version);
  const { busy, error: actionError, run } = useAction(token, () => setVersion((v) => v + 1));
  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;
  return (
    <div className="grid gap-3">
      {actionError && <p role="alert" className="m-0 font-bold text-[#b0354f]">{actionError}</p>}
      {data.length === 0 && <p className="lead m-0">ما فيه تقييمات لين الحين. العملاء يقيّمون من «حسابي» بعد ما يوصلهم الطلب.</p>}
      {data.map((r) => (
        <article key={r.id} className={`panel p-4 grid gap-1.5 ${r.hidden ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b>{r.productName}</b>
            <Stars value={r.rating} />
          </div>
          {r.comment && <p className="m-0 text-[15px] whitespace-pre-line">{r.comment}</p>}
          <p className="m-0 text-[13px] text-ink-soft">
            {r.name} · <span dir="ltr">{r.phone}</span> · طلب <span dir="ltr">{r.orderNumber}</span> · {ago(r.createdAt)}
            {r.hidden && " · مخفي"}
          </p>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-paper !min-h-9" disabled={busy === r.id} onClick={() => run(r.id, `/api/admin/reviews/${r.id}/hidden`, "POST", { hidden: !r.hidden })}>
              {r.hidden ? "إظهار" : "إخفاء"}
            </button>
            <button className="btn btn-sm btn-paper !min-h-9 !text-[#b0354f]" disabled={busy === r.id} onClick={() => run(r.id, `/api/admin/reviews/${r.id}`, "DELETE")}>
              حذف
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

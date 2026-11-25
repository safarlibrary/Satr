import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { ApiError, api } from "../lib/api";
import { useAccount } from "../lib/account";
import { isSaudiMobile } from "../lib/validate";
import { Stars } from "./Stars";

// «نبّهني إذا توفّر»: للمنتج اللي خلص، أو للألوان اللي خلصت
export function NotifyMe({ product, soldOut }) {
  const account = useAccount();
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState(soldOut[0] ?? "");
  const [state, setState] = useState({ busy: false, done: false, error: "" });

  useEffect(() => {
    if (account.status === "ready" && !phone) setPhone(account.customer.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.status]);

  const submit = async (e) => {
    e.preventDefault();
    if (!isSaudiMobile(phone)) return setState({ busy: false, done: false, error: "رقم الجوال لازم يبدأ بـ 05 ويكون 10 أرقام" });
    setState({ busy: true, done: false, error: "" });
    try {
      await api("/api/stock-alerts", { method: "POST", json: { productId: product.id, color: soldOut.length ? color : "", phone } });
      setState({ busy: false, done: true, error: "" });
    } catch (err) {
      setState({ busy: false, done: false, error: err instanceof ApiError ? err.message : "صار خطأ، جرّب مرة ثانية." });
    }
  };

  if (state.done) {
    return (
      <p className="mt-6 mb-0 panel !rounded-[18px] !shadow-none p-4 font-bold flex items-center gap-2" role="status">
        <BellRing size={20} className="text-leaf" aria-hidden="true" />
        تم! بنرسل لك رسالة أول ما يتوفّر.
      </p>
    );
  }

  return (
    <form className="mt-6 panel !rounded-[18px] !shadow-none p-4 grid gap-3" onSubmit={submit} noValidate>
      <p className="m-0 font-extrabold flex items-center gap-2">
        <BellRing size={20} className="text-leaf" aria-hidden="true" />
        {soldOut.length ? "خلص لون؟ نبّهك أول ما يرجع" : "نبّهني إذا توفّر"}
      </p>
      {soldOut.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="اللون">
          {soldOut.map((c) => (
            <button key={c} type="button" className="chip !min-h-10" aria-pressed={color === c} onClick={() => setColor(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {soldOut.length === 1 && <p className="m-0 text-[15px] text-ink-soft">اللون: {soldOut[0]}</p>}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="notify-phone">
          رقم الجوال
        </label>
        <input
          id="notify-phone"
          className="field !min-h-12"
          type="tel"
          dir="ltr"
          placeholder="05xxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button className="btn btn-sm btn-butter shrink-0" disabled={state.busy}>
          {state.busy ? "…" : "نبّهني"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="m-0 text-[14px] font-bold text-[#b0354f]">
          {state.error}
        </p>
      )}
    </form>
  );
}

// تقييمات المنتج (من عملاء استلموا طلبهم)
export function Reviews({ productId }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    api(`/api/products/${encodeURIComponent(productId)}/reviews`)
      .then((r) => alive && setList(r))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [productId]);
  if (!list) return null;
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return (
    <section id="reviews" className="mt-16 scroll-mt-24" aria-labelledby="reviews-title">
      <div className="flex flex-wrap items-baseline gap-3 mb-5">
        <h2 id="reviews-title" className="text-[26px] font-extrabold m-0">
          التقييمات
        </h2>
        {list.length > 0 && (
          <span className="inline-flex items-center gap-2 text-ink-soft">
            <Stars value={avg} size={18} />
            {`${(Math.round(avg * 10) / 10).toLocaleString("ar-SA")} من ٥ · ${list.length.toLocaleString("ar-SA")} تقييم`}
          </span>
        )}
      </div>
      {list.length === 0 ? (
        <p className="lead m-0">ما فيه تقييمات لين الحين. اللي يشتري المنتج يقدر يقيّمه من «حسابي» بعد ما يوصله.</p>
      ) : (
        <ul className="list-none p-0 m-0 grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="panel !rounded-[18px] !shadow-none p-4">
              <div className="flex items-center justify-between gap-2">
                <b>{r.name}</b>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="m-0 mt-1.5 text-[15px] whitespace-pre-line">{r.comment}</p>}
              <p className="m-0 mt-1 text-[13px] text-ink-soft">{new Date(r.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { useState } from "react";
import { Squiggle } from "../components/Decor";
import { Field } from "../components/Field";
import { Cat } from "../components/Cat";
import { OrderProgress, PAYMENT_STATUS } from "../components/Order";
import { StarPicker, Stars } from "../components/Stars";
import { ApiError, api } from "../lib/api";
import { saveCustomerToken, useAccount } from "../lib/account";
import { formatPrice } from "../lib/format";
import { isSaudiMobile } from "../lib/validate";

const errorText = (e) => (e instanceof ApiError ? e.message : "صار خطأ، جرّب مرة ثانية.");

export function AccountPage() {
  const account = useAccount();
  return (
    <section className="wrap pt-10 max-w-[760px]">
      <div className="text-center">
        <h1 className="section-title !text-[36px]">حسابي</h1>
        <Squiggle />
      </div>
      {account.status === "loading" && <p className="lead text-center mt-8">جاري التحميل…</p>}
      {account.status === "error" && <p className="lead text-center mt-8">{account.message}</p>}
      {account.status === "guest" && <Login />}
      {account.status === "ready" && <Dashboard account={account} />}
    </section>
  );
}

// تسجيل الدخول: رقم الجوال ← رمز يوصل SMS
function Login() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  const requestCode = async (e) => {
    e?.preventDefault();
    if (!isSaudiMobile(phone)) return setError("رقم الجوال لازم يبدأ بـ 05 ويكون 10 أرقام");
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/otp", { method: "POST", json: { phone } });
      setDevCode(r.devCode ?? "");
      setStep("code");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/verify", { method: "POST", json: { phone, code } });
      saveCustomerToken(r.token);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="panel stitched !rounded-[28px] p-6 sm:p-8 mt-8 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <form className="relative grid gap-4" onSubmit={step === "phone" ? requestCode : verify} noValidate>
        <p className="m-0 text-[17px]">
          {step === "phone" ? "سجّل برقم جوالك، ونرسل لك رمز دخول برسالة نصية." : `أرسلنا رمز من ٤ أرقام إلى ${phone}`}
        </p>
        {step === "phone" ? (
          <Field id="acc-phone" label="رقم الجوال" type="tel" dir="ltr" placeholder="05xxxxxxxx" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        ) : (
          <Field
            id="acc-code"
            label="رمز الدخول"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        )}
        {devCode && step === "code" && <p className="m-0 text-[14px] text-ink-soft">وضع التجربة (الرسائل مو مفعّلة): الرمز {devCode}</p>}
        {error && (
          <p role="alert" className="m-0 font-bold text-[#b0354f]">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button className="btn" disabled={busy}>
            {busy ? "لحظة…" : step === "phone" ? "أرسل الرمز" : "دخول"}
          </button>
          {step === "code" && (
            <button type="button" className="btn btn-sm btn-paper" disabled={busy} onClick={() => { setStep("phone"); setCode(""); }}>
              غيّر الرقم
            </button>
          )}
        </div>
      </form>
      <Cat awake className="relative w-32 mx-auto hidden sm:block" />
    </div>
  );
}

function Dashboard({ account }) {
  const { customer, orders, reviews } = account;
  const [form, setForm] = useState({ name: customer.name, email: customer.email });
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api("/api/me", { method: "PUT", json: form });
      setMsg({ ok: true, text: "انحفظ ✓" });
      account.reload();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
  };
  return (
    <div className="grid gap-8 mt-8">
      <form className="panel p-6 grid gap-4 sm:grid-cols-2" onSubmit={save} noValidate>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[22px] font-extrabold">هلا {customer.name || ""} 👋</h2>
          <button type="button" className="btn btn-sm btn-paper" onClick={account.logout}>
            تسجيل خروج
          </button>
        </div>
        <Field id="me-name" label="الاسم" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Field id="me-email" label="البريد (للفواتير)" type="email" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <p className="m-0 text-[15px] text-ink-soft sm:col-span-2" dir="auto">
          الجوال: <span dir="ltr">{customer.phone}</span>
        </p>
        {msg.text && <p className={`m-0 font-bold sm:col-span-2 ${msg.ok ? "text-leaf" : "text-[#b0354f]"}`}>{msg.text}</p>}
        <div className="sm:col-span-2">
          <button className="btn btn-sm">احفظ</button>
        </div>
      </form>

      <section aria-labelledby="my-orders">
        <h2 id="my-orders" className="m-0 mb-4 text-[24px] font-extrabold">
          طلباتي
        </h2>
        {orders.length === 0 ? (
          <p className="lead m-0">
            ما عندك طلبات لين الحين. <a href="#/shop">ابدأ تسوّق</a>
          </p>
        ) : (
          <div className="grid gap-4">
            {orders.map((o) => (
              <MyOrder key={o.number} order={o} reviews={reviews} onReviewed={account.reload} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MyOrder({ order, reviews, onReviewed }) {
  const [open, setOpen] = useState(null);
  return (
    <article className="panel p-5 grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 font-extrabold text-[18px]" dir="ltr">
          {order.number}
        </p>
        <p className="m-0 text-[14px] text-ink-soft">{new Date(order.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <OrderProgress status={order.status} />
      <p className="m-0 text-[15px]">
        الإجمالي <b>{formatPrice(order.total)}</b> · الدفع: <b>{PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}</b>
        {order.trackingNumber && (
          <>
            {" · الشحنة: "}
            {order.trackingUrl ? (
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-leaf" dir="ltr">
                {order.trackingNumber}
              </a>
            ) : (
              <b dir="ltr">{order.trackingNumber}</b>
            )}
          </>
        )}
      </p>
      <ul className="list-none p-0 m-0 grid gap-2 border-t-2 border-dashed border-ink/20 pt-3">
        {order.items.map((item) => {
          const key = `${item.id}-${item.color ?? ""}`;
          const review = reviews.find((r) => r.productId === item.id && r.orderNumber === order.number);
          return (
            <li key={key} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
                <span>
                  <a href={`#/product/${item.id}`} className="text-ink font-bold">
                    {item.name}
                  </a>
                  {item.color && ` (${item.color})`} × {item.qty.toLocaleString("ar-SA")}
                </span>
                {order.status === "delivered" &&
                  (review ? (
                    <button type="button" className="inline-flex items-center gap-1 bg-transparent border-0 text-[14px] text-ink-soft" onClick={() => setOpen(open === key ? null : key)}>
                      <Stars value={review.rating} /> عدّل تقييمك
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-butter !min-h-9" onClick={() => setOpen(open === key ? null : key)}>
                      قيّم المنتج
                    </button>
                  ))}
              </div>
              {open === key && (
                <ReviewForm
                  order={order}
                  item={item}
                  review={review}
                  onDone={() => {
                    setOpen(null);
                    onReviewed();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function ReviewForm({ order, item, review, onDone }) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError("اختر عدد النجوم");
    setBusy(true);
    try {
      await api("/api/reviews", { method: "POST", json: { orderNumber: order.number, productId: item.id, rating, comment } });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <form className="rounded-[18px] border-2 border-ink bg-mint-soft p-4 grid gap-3" onSubmit={submit} noValidate>
      <StarPicker value={rating} onChange={setRating} />
      <label className="sr-only" htmlFor={`rv-${item.id}`}>
        تعليقك
      </label>
      <textarea
        id={`rv-${item.id}`}
        className="field min-h-20"
        placeholder="وش عجبك في المنتج؟ (اختياري)"
        maxLength={600}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && (
        <p role="alert" className="m-0 font-bold text-[#b0354f]">
          {error}
        </p>
      )}
      <div>
        <button className="btn btn-sm" disabled={busy}>
          {busy ? "جاري الإرسال…" : "أرسل التقييم"}
        </button>
      </div>
    </form>
  );
}

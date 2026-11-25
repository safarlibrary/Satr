import { MessageCircle, Mail, RotateCcw, Truck } from "lucide-react";
import { Squiggle } from "../components/Decor";
import { SleepingCat } from "../components/Cat";
import { useStore } from "../lib/store";

const SOCIAL = [
  ["instagram", "إنستقرام"],
  ["tiktok", "تيك توك"],
  ["snapchat", "سناب شات"],
  ["x", "إكس"],
  ["linkedin", "لينكدإن"],
];

const waLink = (n) => `https://wa.me/${String(n).replace(/\D/g, "").replace(/^05/, "9665")}`;

// سياسة الاسترجاع والاستبدال — عدّل النص هنا إذا تغيّرت السياسة
export function ReturnsPage() {
  const { store, shipping } = useStore();
  return (
    <section className="wrap pt-10 max-w-[760px]">
      <div className="text-center">
        <h1 className="section-title !text-[36px]">الاسترجاع والاستبدال</h1>
        <Squiggle />
        <p className="lead mt-2 mb-0">نبيك تفرح بطلبك، وإذا ما ناسبك نرتّبها معك.</p>
      </div>
      <div className="panel stitched !rounded-[28px] p-6 sm:p-8 mt-8 grid gap-6">
        <div className="relative flex gap-4 items-start">
          <RotateCcw size={28} className="text-leaf shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h2 className="m-0 text-[20px] font-extrabold">خلال ٧ أيام من الاستلام</h2>
            <p className="m-0 mt-1">تقدر ترجّع أو تستبدل أي منتج خلال ٧ أيام من استلامه، بشرط يكون بحالته وتغليفه وما انفتح أو انستخدم.</p>
          </div>
        </div>
        <div className="relative flex gap-4 items-start">
          <MessageCircle size={28} className="text-leaf shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h2 className="m-0 text-[20px] font-extrabold">كيف تطلب الاسترجاع</h2>
            <p className="m-0 mt-1">تواصل معنا برقم الطلب والمنتج اللي تبي ترجّعه، ونرتّب معك طريقة الإرجاع.</p>
          </div>
        </div>
        <div className="relative flex gap-4 items-start">
          <Truck size={28} className="text-leaf shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h2 className="m-0 text-[20px] font-extrabold">المبلغ</h2>
            <p className="m-0 mt-1">
              نرجّع لك قيمة المنتج بنفس طريقة الدفع بعد ما يوصلنا ونتأكد منه. رسوم التوصيل
              {shipping.fee > 0 ? ` (${shipping.fee.toLocaleString("ar-SA")} ر.س)` : ""} ما تنرد إلا إذا المنتج وصلك فيه خلل أو غلط.
            </p>
          </div>
        </div>
        {(store.supportWhatsapp || store.officialEmail) && (
          <div className="relative flex flex-wrap gap-3">
            {store.supportWhatsapp && (
              <a className="btn btn-sm" href={waLink(store.supportWhatsapp)} target="_blank" rel="noopener noreferrer">
                راسلنا على واتساب
              </a>
            )}
            {store.officialEmail && (
              <a className="btn btn-sm btn-paper" href={`mailto:${store.officialEmail}`} dir="ltr">
                {store.officialEmail}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function ContactPage() {
  const { store } = useStore();
  const social = SOCIAL.filter(([k]) => store[k]);
  const any = store.supportWhatsapp || store.officialEmail || social.length;
  return (
    <section className="wrap pt-10 max-w-[760px]">
      <div className="text-center">
        <h1 className="section-title !text-[36px]">تواصل معنا</h1>
        <Squiggle />
        <p className="lead mt-2 mb-0">عندك سؤال عن منتج أو طلب؟ نرد عليك بأسرع وقت.</p>
      </div>
      <div className="panel stitched !rounded-[28px] p-6 sm:p-8 mt-8 grid gap-5">
        {store.supportWhatsapp && (
          <a href={waLink(store.supportWhatsapp)} target="_blank" rel="noopener noreferrer" className="relative flex items-center gap-4 text-ink no-underline">
            <span className="w-12 h-12 rounded-full bg-mint border-2 border-ink grid place-items-center shrink-0">
              <MessageCircle size={24} aria-hidden="true" />
            </span>
            <span>
              <b className="block text-[18px]">واتساب</b>
              <span className="text-ink-soft" dir="ltr">{store.supportWhatsapp}</span>
            </span>
          </a>
        )}
        {store.officialEmail && (
          <a href={`mailto:${store.officialEmail}`} className="relative flex items-center gap-4 text-ink no-underline">
            <span className="w-12 h-12 rounded-full bg-butter border-2 border-ink grid place-items-center shrink-0">
              <Mail size={24} aria-hidden="true" />
            </span>
            <span>
              <b className="block text-[18px]">البريد</b>
              <span className="text-ink-soft" dir="ltr">{store.officialEmail}</span>
            </span>
          </a>
        )}
        {social.length > 0 && (
          <div className="relative flex flex-wrap gap-2.5">
            {social.map(([k, label]) => (
              <a key={k} href={store[k]} target="_blank" rel="noopener noreferrer" className="chip no-underline text-ink">
                {label}
              </a>
            ))}
          </div>
        )}
        {!any && (
          <div className="relative text-center py-4">
            <SleepingCat className="w-28 mx-auto" />
            <p className="lead m-0 mt-3">بيانات التواصل بتنضاف قريب.</p>
          </div>
        )}
        <p className="relative m-0 text-[15px] text-ink-soft">
          تبي تعرف وين طلبك؟{" "}
          <a href="#/track" className="font-bold text-leaf">
            تتبع طلبك
          </a>
        </p>
      </div>
    </section>
  );
}

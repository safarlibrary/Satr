import { WavyEdge } from "./Decor";
import { paymentMethods } from "../lib/format";
import { linkTo } from "../lib/router";
import { useStore } from "../lib/store";

const SOCIAL = [
  ["instagram", "إنستقرام"],
  ["tiktok", "تيك توك"],
  ["snapchat", "سناب شات"],
  ["x", "إكس"],
  ["linkedin", "لينكدإن"],
];

export function Footer() {
  const storeState = useStore();
  const { store } = storeState;
  const social = SOCIAL.filter(([key]) => store[key]);
  const legal = [
    store.freelanceNumber && `وثيقة العمل الحر: ${store.freelanceNumber}`,
    store.businessCenterNumber && `مركز الأعمال: ${store.businessCenterNumber}`,
  ].filter(Boolean);
  const hasContact = social.length > 0 || legal.length > 0 || store.officialEmail;
  return (
    <footer className="mt-20">
      <WavyEdge fill="var(--color-mint)" />
      <div className="bg-mint -mt-px">
        <div className="wrap py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
          <div>
            <p className="text-[26px] font-extrabold m-0">سطر</p>
            <p className="m-0 mt-2 text-ink-soft max-w-[34ch]">
              قرطاسية وأدوات مدرسية نختارها بعناية، ونوصلها لكل مدن المملكة.
            </p>
          </div>
          <FooterLinks
            title="المتجر"
            links={[
              ["كل المنتجات", "#/shop"],
              ["قائمة المدرسة", "#/school-list"],
              ["أدوات الطالب المجانية", linkTo("/tools")],
            ]}
          />
          <FooterLinks
            title="مساعدة"
            links={[
              ["تتبع طلبك", "#/track"],
              ["الاسترجاع والاستبدال", "#/returns"],
              ["تواصل معنا", "#/contact"],
            ]}
          />
          <div>
            <p className="font-extrabold text-[20px] m-0 mb-3">ندفع بـ</p>
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
              {paymentMethods(storeState).map((c) => (
                <li key={c} className="chip !min-h-9 !text-[14px] !bg-card">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {hasContact && (
          <div className="wrap pb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            {social.map(([key, label]) => (
              <a key={key} href={store[key]} target="_blank" rel="noopener noreferrer" className="font-bold text-ink no-underline hover:underline">
                {label}
              </a>
            ))}
            {store.officialEmail && (
              <a href={`mailto:${store.officialEmail}`} className="text-ink no-underline hover:underline" dir="ltr">
                {store.officialEmail}
              </a>
            )}
            {legal.map((line) => (
              <span key={line} className="text-ink-soft">
                {line}
              </span>
            ))}
          </div>
        )}
        <p className="wrap pb-8 my-0 text-[14px] text-ink-soft">
          {"© "}
          {new Date().getFullYear().toLocaleString("ar-SA", {
            useGrouping: false,
          })}
          {" سطر. جميع الحقوق محفوظة."}
        </p>
      </div>
    </footer>
  );
}

function FooterLinks({ title: c, links: r }) {
  return (
    <div>
      <p className="font-extrabold text-[20px] m-0 mb-3">{c}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {r.map(([o, f]) => (
          <li key={f}>
            <a href={f} className="text-ink no-underline hover:underline">
              {o}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

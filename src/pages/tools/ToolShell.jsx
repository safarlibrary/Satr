import { ShieldCheck } from "lucide-react";
import { Squiggle } from "../../components/Decor";
import { linkTo } from "../../lib/router";
import { useSeo } from "../../lib/seo";
import { SuggestedProducts } from "./SuggestedProducts";

// «ملفاتك ما تطلع من جهازك» — صحيح لأن كل المعالجة تتم داخل المتصفح بدون رفع ولا تخزين
export function PrivacyPill() {
  return (
    <span className="tag !bg-mint inline-flex items-center gap-1.5">
      <ShieldCheck size={16} aria-hidden="true" />
      ملفاتك ما تطلع من جهازك
    </span>
  );
}

// إطار موحّد لكل صفحة أداة: مسار الصفحة، العنوان، ملاحظة الخصوصية، وبطاقة المنتجات المقترحة
export function ToolShell({ meta, parent, children }) {
  useSeo(meta);
  return (
    <section className="wrap pt-8 pb-4 max-w-[980px]">
      <nav aria-label="مسار الصفحة" className="flex flex-wrap items-center gap-1.5 text-[15px] text-ink-soft">
        <a href={linkTo("/tools")} className="text-ink font-bold no-underline hover:underline">
          أدوات الطالب
        </a>
        {parent && (
          <>
            <span aria-hidden="true">›</span>
            <a href={linkTo(parent.path)} className="text-ink font-bold no-underline hover:underline">
              {parent.name}
            </a>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page">{meta.name}</span>
      </nav>
      <div className="text-center mt-4">
        <h1 className="section-title !text-[30px] sm:!text-[38px]">{meta.name} مجانًا</h1>
        <Squiggle />
        <p className="lead mt-2 mb-3 mx-auto max-w-[52ch]">{meta.short}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <PrivacyPill />
          <span className="tag !bg-butter">مجاني · بدون تسجيل</span>
        </div>
      </div>
      <div className="mt-8">{children}</div>
      <SuggestedProducts />
    </section>
  );
}

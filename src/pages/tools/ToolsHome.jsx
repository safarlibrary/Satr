import { Lock } from "lucide-react";
import { Squiggle } from "../../components/Decor";
import { COVER_TOOL, PDF_HUB, PDF_TOOLS, TOOLS_HOME } from "../../../shared/tools";
import { linkTo } from "../../lib/router";
import { useSeo } from "../../lib/seo";
import { PrivacyPill } from "./ToolShell";
import { ToolCards } from "./ToolCards";
import { SuggestedProducts } from "./SuggestedProducts";

// صفحة /tools: كل أدوات الطالب المجانية
export default function ToolsHome() {
  useSeo(TOOLS_HOME);
  return (
    <section className="wrap pt-10 pb-4 max-w-[980px]">
      <div className="text-center">
        <h1 className="section-title !text-[32px] sm:!text-[40px]">أدوات الطالب المجانية</h1>
        <Squiggle />
        <p className="lead mt-2 mb-3 mx-auto max-w-[52ch]">أدوات تساعدك في واجباتك وملفاتك، مجانية وبدون تسجيل.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <PrivacyPill />
          <span className="tag !bg-butter">مجاني · بدون تسجيل</span>
        </div>
      </div>
      <div className="mt-8">
        <ToolCards tools={[COVER_TOOL, PDF_HUB]} />
      </div>

      <h2 className="m-0 mt-12 mb-4 text-[24px] font-extrabold">أدوات PDF</h2>
      <ul className="list-none p-0 m-0 flex flex-wrap gap-2.5">
        {PDF_TOOLS.map((t) => (
          <li key={t.path}>
            <a href={linkTo(t.path)} className="chip no-underline text-ink">
              {t.name}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-12 panel stitched !rounded-[24px] p-5 sm:p-6">
        <h2 className="relative m-0 text-[22px] font-extrabold flex items-center gap-2">
          <Lock size={22} className="text-leaf" aria-hidden="true" />
          وش معنى «ملفاتك ما تطلع من جهازك»؟
        </h2>
        <p className="relative m-0 mt-2">
          كل أداة تشتغل داخل متصفحك أنت. لما تختار ملف أو صورة، المعالجة تصير في جوالك أو جهازك، وما ننرفع لأي سيرفر ولا ننحفظ عندنا.
          تقدر تغلق الصفحة وكل شي يختفي.
        </p>
      </div>

      <SuggestedProducts />
    </section>
  );
}

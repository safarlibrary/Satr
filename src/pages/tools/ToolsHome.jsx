import { Lock } from "lucide-react";
import { Squiggle } from "../../components/Decor";
import { PDF_TOOLS, TOOLS_HOME, TOOL_GROUPS } from "../../../shared/tools";
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
      {TOOL_GROUPS.map((g) => (
        <section key={g.id} className="mt-10" aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="m-0 text-[24px] font-extrabold">
            {g.title}
          </h2>
          <p className="m-0 mb-4 text-ink-soft">{g.note}</p>
          <ToolCards tools={g.tools} cols={g.tools.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1 sm:max-w-[480px]"} />
          {g.id === "pdf" && (
            <ul className="list-none p-0 mt-4 mb-0 flex flex-wrap gap-2.5">
              {PDF_TOOLS.map((t) => (
                <li key={t.path}>
                  <a href={linkTo(t.path)} className="chip no-underline text-ink">
                    {t.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div className="mt-12 panel stitched !rounded-[24px] p-5 sm:p-6">
        <h2 className="relative m-0 text-[22px] font-extrabold flex items-center gap-2">
          <Lock size={22} className="text-leaf" aria-hidden="true" />
          وش معنى «ملفاتك ما تطلع من جهازك»؟
        </h2>
        <p className="relative m-0 mt-2">
          كل أداة تشتغل داخل متصفحك أنت. لما تختار ملف أو صورة، المعالجة تصير في جوالك أو جهازك، وما ننرفع لأي سيرفر ولا ننحفظ عندنا.
          تقدر تغلق الصفحة وكل شي يختفي. الاستثناء الوحيد زر «الاقتراحات الذكية» في السيرة الذاتية وتنسيق التقارير: لما تضغطه نرسل نصك فقط لخدمة الذكاء الاصطناعي عشان تعطيك الاقتراح، وما نخزّنه.
        </p>
      </div>

      <SuggestedProducts />
    </section>
  );
}

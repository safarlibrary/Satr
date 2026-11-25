import { ArrowLeft, Combine, FileText, Images, Layers, Minimize2, Scissors } from "lucide-react";
import { linkTo } from "../../lib/router";

const ICONS = { cover: FileText, pdf: Layers, images: Images, merge: Combine, split: Scissors, compress: Minimize2 };
const TINTS = ["var(--color-pink)", "var(--color-mint)", "var(--color-butter)", "var(--color-lilac)"];

// بطاقات الأدوات (تُستخدم في صفحة /tools وصفحة أدوات PDF)
export function ToolCards({ tools, cols = "sm:grid-cols-2" }) {
  return (
    <ul className={`list-none p-0 m-0 grid gap-4 sm:gap-5 ${cols}`}>
      {tools.map((tool, i) => {
        const Icon = ICONS[tool.slug] ?? FileText;
        return (
          <li key={tool.path} className="min-w-0">
            <a
              href={linkTo(tool.path)}
              className="panel !rounded-[24px] h-full flex flex-col gap-3 p-5 no-underline text-ink transition-transform hover:-translate-y-0.5"
              style={{ background: TINTS[i % TINTS.length] }}
            >
              <span className="w-14 h-14 rounded-2xl border-2 border-ink bg-card grid place-items-center">
                <Icon size={28} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="text-[22px] font-extrabold leading-tight">{tool.name}</span>
              <span className="text-[16px] leading-relaxed">{tool.short}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 font-bold">
                افتح الأداة
                <ArrowLeft size={18} strokeWidth={2.6} aria-hidden="true" />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

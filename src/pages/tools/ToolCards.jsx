import { ArrowLeft, Combine, FileText, Images, Layers, Minimize2, Scissors, ScrollText, UserRound } from "lucide-react";
import { SpinFlower } from "../../components/SpinFlower";
import { linkTo } from "../../lib/router";

const ICONS = { cv: UserRound, report: ScrollText, cover: FileText, pdf: Layers, images: Images, merge: Combine, split: Scissors, compress: Minimize2 };
// لكل أداة وردتها وزاويتها (يمين/يسار، فوق/تحت) وسرعتها، عشان كل بطاقة تكون مختلفة
const FLOWERS = {
  pdf: { name: "hibiscus", pos: "tl", seconds: 26 },
  cv: { name: "sunflower", pos: "bl", seconds: 30, reverse: true },
  cover: { name: "violet", pos: "tl", seconds: 22 },
  report: { name: "daisy", pos: "bl", seconds: 28, reverse: true },
  images: { name: "sunflower", pos: "tl", seconds: 24 },
  merge: { name: "hibiscus", pos: "bl", seconds: 30, reverse: true },
  split: { name: "violet", pos: "tl", seconds: 22, reverse: true },
  compress: { name: "daisy", pos: "bl", seconds: 26 },
};
const TINT_BY_TOOL = {
  pdf: "var(--color-mint)",
  cv: "var(--color-pink)",
  cover: "var(--color-butter)",
  report: "var(--color-lilac)",
};
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
              className="panel !rounded-[24px] h-full relative overflow-hidden flex flex-col gap-3 p-5 sm:ps-5 sm:pl-24 no-underline text-ink transition-transform hover:-translate-y-0.5"
              style={{ background: TINT_BY_TOOL[tool.slug] ?? TINTS[i % TINTS.length] }}
            >
              {FLOWERS[tool.slug] && <SpinFlower {...FLOWERS[tool.slug]} />}
              <span className="relative w-14 h-14 rounded-2xl border-2 border-ink bg-card grid place-items-center">
                <Icon size={28} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="relative text-[22px] font-extrabold leading-tight">{tool.name}</span>
              <span className="relative text-[16px] leading-relaxed">{tool.short}</span>
              <span className="relative mt-auto inline-flex items-center gap-1.5 font-bold">
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

import "./report.css";

export const REPORT_TEMPLATES = [
  { id: "academic", name: "أكاديمي" },
  { id: "modern", name: "عصري" },
  { id: "elegant", name: "فخم" },
];

export const BODY_W = 650; // عرض منطقة النص داخل الصفحة (794 - 72×2)
export const BODY_H = 1123 - 76 - 80;

// الكتلة الأولى في الصفحة الأولى: العنوان وبيانات الطالب
export function TitleBlock({ title, meta }) {
  return (
    <div data-block="title">
      <h1 className="t-title">{title}</h1>
      {meta.length > 0 && <p className="meta">{meta.join(" · ")}</p>}
    </div>
  );
}

export function BlockView({ b }) {
  if (b.t === "h") return <h2 className="b-h">{b.text}</h2>;
  if (b.t === "li") return <p className="b-li">{b.text}</p>;
  return <p className="b-p">{b.text}</p>;
}

// صفحة واحدة. items: [{ kind: "title" | "block", ... }]
export function ReportPage({ id, items, title, meta, n, total }) {
  return (
    <div className={`rpx rp-${id}`}>
      <div className="body">
        {items.map((it, i) => (it.kind === "title" ? <TitleBlock key={i} title={title} meta={meta} /> : <BlockView key={i} b={it.b} />))}
      </div>
      <div className="foot">
        <span>{meta[0] ?? ""}</span>
        <span>
          {n.toLocaleString("ar-SA")} / {total.toLocaleString("ar-SA")}
        </span>
      </div>
    </div>
  );
}

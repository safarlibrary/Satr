import "./cover.css";

export const COVER_W = 794;
export const COVER_H = 1123;

export const TEMPLATES = [
  { id: "formal", name: "رسمي" },
  { id: "simple", name: "بسيط" },
  { id: "geo", name: "هندسي" },
  { id: "play", name: "سطر المرح" },
  { id: "classic", name: "كلاسيكي" },
  { id: "dark", name: "أخضر داكن" },
];

// حجم عنوان الواجب حسب طوله
const titleSize = (text, base) => {
  const n = text.length;
  return Math.round(base * (n > 100 ? 0.55 : n > 70 ? 0.65 : n > 45 ? 0.78 : n > 28 ? 0.9 : 1));
};

// في المعاينة الخانات الفاضية تظهر باهتة كمثال، وعند التصدير (ex) تنحذف
function Line({ v, ph, cls, ex }) {
  if (!v && ex) return null;
  return <div className={`cv-line ${cls}${v ? "" : " cv-ph"}`}>{v || ph}</div>;
}

function Row({ label, v, ph, ex }) {
  if (!v && ex) return null;
  return (
    <div className={`cv-row${v ? "" : " cv-ph"}`}>
      <span className="cv-label">{label}</span>
      <span className="cv-val cv-line">{v || ph}</span>
    </div>
  );
}

function Head({ d, logo, ex }) {
  return (
    <div className="cv-head">
      {logo && <img className="cv-logo" src={logo} alt="" />}
      <div className="cv-headtext">
        <Line v={d.university} ph="اسم الجامعة" cls="cv-uni" ex={ex} />
        <Line v={d.college} ph="الكلية" cls="cv-college" ex={ex} />
        <Line v={d.department} ph="القسم" cls="cv-dept" ex={ex} />
      </div>
    </div>
  );
}

function Mid({ d, ex, base }) {
  const text = d.title || "";
  return (
    <div className="cv-mid">
      <Line v={d.course} ph="اسم المادة" cls="cv-course" ex={ex} />
      <Line v={d.courseCode} ph="رمز المادة" cls="cv-code" ex={ex} />
      {(text || !ex) && (
        <div className={`cv-title${text ? "" : " cv-ph"}`} style={{ fontSize: titleSize(text || "عنوان الواجب", base) }}>
          {text || "عنوان الواجب"}
        </div>
      )}
    </div>
  );
}

function Info({ d, ex }) {
  return (
    <div className="cv-info">
      <Row label="الطالب" v={d.student} ph="الاسم الثلاثي" ex={ex} />
      <Row label="الرقم الجامعي" v={d.studentId} ph="٠٠٠٠٠٠٠٠" ex={ex} />
      <Row label="الدكتور" v={d.doctor} ph="د. الاسم" ex={ex} />
      <Row label="التاريخ" v={d.date} ph="٠٠ شهر ٠٠٠٠" ex={ex} />
    </div>
  );
}

const Corner = ({ pos }) => (
  <svg className={`corner ${pos}`} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M4 96V40C4 20 20 4 40 4h56" fill="none" stroke="#3f7963" strokeWidth="2.5" />
    <path d="M14 96V46c0-18 14-32 32-32h50" fill="none" stroke="#3f7963" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="7" fill="#3f7963" />
    <circle cx="24" cy="24" r="12" fill="none" stroke="#3f7963" strokeWidth="1.5" />
  </svg>
);

const Ornament = () => (
  <svg className="orn" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 11h84M116 11h84" stroke="#3f7963" strokeWidth="1.6" />
    <path d="M100 2l9 9-9 9-9-9z" fill="#3f7963" />
    <circle cx="80" cy="11" r="3" fill="#3f7963" />
    <circle cx="120" cy="11" r="3" fill="#3f7963" />
  </svg>
);

function Play({ d, logo, ex }) {
  return (
    <div className="cv cv-play">
      <svg className="cv-deco" style={{ right: 26, top: 22, width: 64, height: 64, transform: "rotate(12deg)" }} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#fdecaa" stroke="#3b3242" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg className="cv-deco" style={{ left: 38, bottom: 30, width: 58, height: 58, transform: "rotate(-10deg)" }} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" fill="#f198aa" stroke="#3b3242" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <svg className="cv-deco" style={{ left: 300, top: 22, width: 150, height: 34, color: "#8fc7b2" }} viewBox="0 0 56 12" aria-hidden="true">
        <path d="M2 7c6-6 10-6 13 0s7 6 13 0 10-6 13 0 7 6 13 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className="cv-inner">
        <Head d={d} logo={logo} ex={ex} />
        <Mid d={d} ex={ex} base={56} />
        <Info d={d} ex={ex} />
      </div>
    </div>
  );
}

const Frame = ({ id, extra, children }) => <div className={`cv cv-${id}`}>{extra}{children}</div>;

// القالب بحجم A4 كامل (٧٩٤×١١٢٣). المعاينة تصغّره بالـ CSS، والتصدير يأخذه كما هو.
export function CoverTemplate({ id, d, logo, ex = false }) {
  const body = (base) => (
    <div className="cv-inner">
      <Head d={d} logo={logo} ex={ex} />
      <Mid d={d} ex={ex} base={base} />
      <Info d={d} ex={ex} />
    </div>
  );
  switch (id) {
    case "simple":
      return (
        <Frame id="simple" extra={<><span className="cv-bar" /><span className="cv-bar2" /></>}>
          {body(64)}
        </Frame>
      );
    case "geo":
      return (
        <Frame id="geo" extra={<><span className="g1" /><span className="g2" /><span className="g3" /><span className="g4" /></>}>
          {body(52)}
        </Frame>
      );
    case "play":
      return <Play d={d} logo={logo} ex={ex} />;
    case "classic":
      return (
        <Frame id="classic" extra={<><span className="cv-b1" /><span className="cv-b2" /><Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" /></>}>
          <div className="cv-inner">
            <Head d={d} logo={logo} ex={ex} />
            <Ornament />
            <Mid d={d} ex={ex} base={54} />
            <Info d={d} ex={ex} />
          </div>
        </Frame>
      );
    case "dark":
      return (
        <Frame id="dark" extra={<><span className="f1" /><span className="sq s1" /><span className="sq s2" /><span className="sq s3" /><span className="sq s4" /></>}>
          {body(58)}
        </Frame>
      );
    default:
      return (
        <Frame id="formal" extra={<><span className="cv-b1" /><span className="cv-b2" /></>}>
          <div className="cv-inner">
            <Head d={d} logo={logo} ex={ex} />
            <div className="cv-rule" />
            <Mid d={d} ex={ex} base={52} />
            <Info d={d} ex={ex} />
          </div>
        </Frame>
      );
  }
}

import "./cv.css";

export const CV_TEMPLATES = [
  { id: "classic", name: "كلاسيكي" },
  { id: "modern", name: "عصري" },
  { id: "minimal", name: "بسيط" },
];

const lines = (s) => String(s ?? "").split(/\r?\n/).map((x) => x.replace(/^[\s•\-–*]+/, "").trim()).filter(Boolean);
const items = (s) => String(s ?? "").split(/[\n,،؛;]/).map((x) => x.trim()).filter(Boolean);

// ex = نسخة التصدير: بدون الخانات التجريبية الباهتة
export function CvTemplate({ id, d, ex }) {
  const jobs = d.experience.filter((j) => j.title || j.company || j.details);
  const edu = d.education.filter((e) => e.degree || e.school);
  const skills = items(d.skills);
  const langs = items(d.languages);
  const contacts = [d.phone && ["ltr", d.phone], d.email && ["ltr", d.email], d.city && ["", d.city], d.links && ["ltr", d.links]].filter(Boolean);
  const show = (v, ph) => (v ? v : ex ? null : <span className="ph">{ph}</span>);

  const jobsView = (
    <>
      {jobs.map((j, i) => (
        <div className="job" key={i}>
          <div className="job-head">
            <span>
              <b>{j.title}</b>
              {j.title && j.company ? " — " : ""}
              {j.company}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>{j.period}</span>
          </div>
          {lines(j.details).length > 0 && (
            <ul className="bul">
              {lines(j.details).map((l, k) => (
                <li key={k}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {!jobs.length && !ex && (
        <p className="ph">مثلًا: متدرب تسويق — شركة كذا (٢٠٢٥)</p>
      )}
    </>
  );
  const eduView = (
    <>
      {edu.map((e, i) => (
        <div className="job" key={i}>
          <div className="job-head">
            <span>
              <b>{e.degree}</b>
              {e.degree && e.school ? " — " : ""}
              {e.school}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>{e.period}</span>
          </div>
        </div>
      ))}
      {!edu.length && !ex && <p className="ph">مثلًا: بكالوريوس نظم معلومات — جامعة الملك سعود</p>}
    </>
  );

  if (id === "modern") {
    return (
      <div className="cvx cv-modern">
        <main>
          <h1 className="nm">{show(d.name, "اسمك الكامل")}</h1>
          <p className="ti">{show(d.title, "المسمى أو التخصص")}</p>
          {(d.summary || !ex) && (
            <section className="sec">
              <h2>نبذة</h2>
              <p>{show(d.summary, "نبذة قصيرة عنك وعن هدفك…")}</p>
            </section>
          )}
          <section className="sec">
            <h2>الخبرات</h2>
            {jobsView}
          </section>
          <section className="sec">
            <h2>التعليم</h2>
            {eduView}
          </section>
        </main>
        <aside>
          <h2>التواصل</h2>
          <ul>
            {contacts.map(([c, v], i) => (
              <li key={i} className={c}>{v}</li>
            ))}
            {!contacts.length && !ex && <li className="ph">الجوال والبريد والمدينة</li>}
          </ul>
          <h2>المهارات</h2>
          <ul>
            {skills.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
            {!skills.length && !ex && <li className="ph">مهاراتك</li>}
          </ul>
          {(langs.length > 0 || !ex) && (
            <>
              <h2>اللغات</h2>
              <ul>
                {langs.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
                {!langs.length && !ex && <li className="ph">العربية، الإنجليزية</li>}
              </ul>
            </>
          )}
        </aside>
      </div>
    );
  }

  const cls = id === "minimal" ? "cv-minimal" : "cv-classic";
  const head =
    id === "minimal" ? (
      <header className="hd">
        <h1 className="nm">{show(d.name, "اسمك الكامل")}</h1>
        <p className="ti">{show(d.title, "المسمى أو التخصص")}</p>
        <div className="ct">
          {contacts.map(([c, v], i) => (
            <span key={i} className={c}>{v}</span>
          ))}
          {!contacts.length && !ex && <span className="ph">الجوال · البريد · المدينة</span>}
        </div>
      </header>
    ) : (
      <header>
        <h1 className="nm">{show(d.name, "اسمك الكامل")}</h1>
        <p className="ti">{show(d.title, "المسمى أو التخصص")}</p>
        <div className="ct">
          {contacts.map(([c, v], i) => (
            <span key={i} className={c}>{v}</span>
          ))}
          {!contacts.length && !ex && <span className="ph">الجوال · البريد · المدينة</span>}
        </div>
      </header>
    );
  return (
    <div className={`cvx ${cls}`}>
      {head}
      {(d.summary || !ex) && (
        <section className="sec">
          <h2>نبذة</h2>
          <p>{show(d.summary, "نبذة قصيرة عنك وعن هدفك…")}</p>
        </section>
      )}
      <section className="sec">
        <h2>الخبرات</h2>
        {jobsView}
      </section>
      <section className="sec">
        <h2>التعليم</h2>
        {eduView}
      </section>
      <section className="sec">
        <h2>المهارات</h2>
        <div className="chips">
          {skills.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
          {!skills.length && !ex && <span className="ph">مهاراتك</span>}
        </div>
      </section>
      {(langs.length > 0 || !ex) && (
        <section className="sec">
          <h2>اللغات</h2>
          <div className="chips">
            {langs.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
            {!langs.length && !ex && <span className="ph">العربية، الإنجليزية</span>}
          </div>
        </section>
      )}
    </div>
  );
}

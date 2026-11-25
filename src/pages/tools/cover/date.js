// التاريخ الهجري (أم القرى، المعتمد في السعودية) أو الميلادي
export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso, mode) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const options = { day: "numeric", month: "long", year: "numeric" };
  try {
    if (mode === "hijri") {
      const text = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", options).format(date);
      return /هـ\s*$/.test(text) ? text : `${text} هـ`;
    }
    return `${new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", options).format(date)} م`;
  } catch {
    return iso;
  }
}

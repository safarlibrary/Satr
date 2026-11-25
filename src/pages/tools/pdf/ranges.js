// كتابة أرقام الصفحات: «1-3, 5, 8-10» (ويقبل الأرقام العربية والفاصلة العربية)
const INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

const normalize = (s) =>
  s
    .replace(/[٠-٩]/g, (d) => INDIC.indexOf(d))
    .replace(/[۰-۹]/g, (d) => PERSIAN.indexOf(d))
    .replace(/[،;؛]/g, ",")
    .replace(/[–—ـ]/g, "-")
    .replace(/\s+/g, "");

export function parseRanges(text, max) {
  const clean = normalize(text);
  if (!clean) return { ranges: [], error: "" };
  const ranges = [];
  for (const part of clean.split(",").filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return { ranges: [], error: `ما فهمنا «${part}». اكتب مثل: 1-3, 5, 8-10` };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1) return { ranges: [], error: "أرقام الصفحات تبدأ من ١" };
    if (a > b) return { ranges: [], error: `النطاق «${part}» مقلوب، اكتب الأصغر أول` };
    if (b > max) return { ranges: [], error: `الصفحة ${b.toLocaleString("ar-SA")} أكبر من عدد صفحات الملف (${max.toLocaleString("ar-SA")})` };
    ranges.push([a, b]);
  }
  return { ranges, error: "" };
}

export function rangesToSet(ranges) {
  const set = new Set();
  for (const [a, b] of ranges) for (let i = a; i <= b; i++) set.add(i);
  return set;
}

export function formatRanges(set) {
  const nums = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(i === j ? `${nums[i]}` : `${nums[i]}-${nums[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

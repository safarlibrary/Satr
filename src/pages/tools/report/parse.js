// تقسيم النص تلقائيًا (بدون ذكاء اصطناعي): عناوين، فقرات، نقاط.
// البلوكات: { t: "h" | "p" | "li", text }
const BULLET = /^\s*(?:[•\-–—*·]|\d{1,2}[.)\-]|[أ-ي][.)\-])\s+/;
const END = /[.،؛:!؟?…]$/;

export function parseText(raw) {
  const lines = String(raw ?? "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let title = "";
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", text: para.join(" ") });
    para = [];
  };
  lines.forEach((line, idx) => {
    const text = line.trim();
    if (!text) return flush();
    const md = /^#{1,3}\s+(.*)$/.exec(text);
    if (md) {
      flush();
      if (!title && !blocks.length) title = md[1];
      else blocks.push({ t: "h", text: md[1] });
      return;
    }
    if (BULLET.test(text)) {
      flush();
      blocks.push({ t: "li", text: text.replace(BULLET, "") });
      return;
    }
    const next = (lines[idx + 1] ?? "").trim();
    const prevBlank = idx === 0 || !lines[idx - 1]?.trim();
    // سطر قصير بدون علامة ترقيم في آخره، بعد سطر فاضي، وتحته فقرة أطول (أو نقاط أو سطر فاضي) = عنوان
    const headingLike = !next || BULLET.test(next) || next.length > text.length;
    if (text.length <= 70 && !END.test(text) && prevBlank && headingLike) {
      flush();
      if (!title && !blocks.length) title = text;
      else blocks.push({ t: "h", text });
      return;
    }
    para.push(text);
  });
  flush();
  return { title, blocks };
}

// نتيجة الذكاء الاصطناعي (أقسام) إلى بلوكات
export function aiToDoc(ai) {
  const blocks = [];
  for (const s of ai.sections ?? []) {
    if (s.heading) blocks.push({ t: "h", text: s.heading });
    for (const p of s.paragraphs ?? []) blocks.push({ t: "p", text: p });
    for (const b of s.bullets ?? []) blocks.push({ t: "li", text: b });
  }
  return { title: ai.title ?? "", blocks };
}

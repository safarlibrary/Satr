import { useEffect } from "react";
import { useStore } from "./store";

// نفس القيم في index.html، نرجّعها لما نطلع من صفحة أداة
const DEFAULT_TITLE = "سطر — قرطاسية وأدوات مدرسية";
const DEFAULT_DESCRIPTION = "دفاتر وأقلام وشنط وملاحظات لاصقة مختارة بعناية، توصل لباب بيتك.";

// عنوان ووصف الصفحة (مهم لجوجل). السيرفر يحطهم قبل ما تنرسل الصفحة، وهذا يحدّثهم لما تتنقل بين الأدوات.
export function useSeo(meta) {
  const { store } = useStore();
  const name = store?.storeName ?? "";
  useEffect(() => {
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    document.title = name ? `${meta.title} | ${name}` : meta.title;
    tag.setAttribute("content", meta.description);
    return () => {
      document.title = DEFAULT_TITLE;
      tag.setAttribute("content", DEFAULT_DESCRIPTION);
    };
  }, [meta, name]);
}

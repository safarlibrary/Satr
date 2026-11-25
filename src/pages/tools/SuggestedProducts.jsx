import { useMemo } from "react";
import { ProductArt } from "../../components/Art";
import { formatPrice } from "../../lib/format";
import { linkTo } from "../../lib/router";
import { useStore } from "../../lib/store";

// بطاقة خفيفة آخر كل أداة: ٣ منتجات من الدفاتر والأقلام، بدون نوافذ ولا إزعاج
export function SuggestedProducts() {
  const { products, catalog } = useStore();
  const picks = useMemo(() => {
    const ok = (p) => p.stock > 0;
    const notebooks = products.filter((p) => p.category === "notebooks" && ok(p));
    const pens = products.filter((p) => p.category === "pens" && ok(p));
    const list = [...notebooks.slice(0, 2), ...pens.slice(0, 1)];
    for (const p of [...notebooks.slice(2), ...pens.slice(1)]) if (list.length < 3) list.push(p);
    return list;
  }, [products]);

  if (catalog.status !== "ready" || picks.length === 0) return null;
  return (
    <aside className="mt-12 panel !rounded-[22px] !shadow-none p-4 sm:p-5" aria-label="منتجات مقترحة">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <p className="m-0 font-extrabold text-[18px]">تحتاج دفاتر وأقلام لواجباتك؟</p>
        <a href="#/shop" className="text-leaf font-bold text-[15px]">
          تصفّح المتجر
        </a>
      </div>
      <ul className="list-none p-0 m-0 grid grid-cols-3 gap-2.5 sm:gap-4">
        {picks.map((p) => (
          <li key={p.id} className="min-w-0">
            <a href={`#/product/${p.id}`} className="block text-ink no-underline">
              <span className="relative block aspect-square rounded-[14px] border-2 border-ink overflow-hidden" style={{ background: p.tint }}>
                <ProductArt product={p} />
              </span>
              <span className="block mt-1.5 text-[14px] font-bold leading-snug line-clamp-2">{p.name}</span>
              <span className="block text-[14px] text-ink-soft">{formatPrice(p.price)}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

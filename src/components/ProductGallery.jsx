import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Art } from "./Art";
import { resolveProductImage } from "../lib/product-images";

// كل صور المنتج بالترتيب: الأساسية، صورة كل لون، وبعدها الصور الإضافية (زوايا ثانية)
export function galleryOf(product) {
  const seen = new Set();
  const list = [];
  const add = (name, color) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    list.push({ name, color });
  };
  const firstColor = (product.colors ?? []).find((c) => product.colorImages?.[c] === product.image);
  add(product.image, firstColor);
  for (const c of product.colors ?? []) add(product.colorImages?.[c], c);
  for (const extra of product.images ?? []) add(extra);
  return list;
}

function Slide({ product, name }) {
  const src = resolveProductImage(name);
  if (!src) return <Art kind={product.art} className="absolute inset-[17%] w-[66%] h-[66%]" />;
  const cover = /-cover\./.test(name);
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className={cover ? "block w-full h-full object-cover" : "block w-full h-full object-contain p-[12%]"}
    />
  );
}

// صور المنتج تتقلّب بالسحب بالإصبع (أو الأسهم في الكمبيوتر). ما تفتح المنتج إلا بالضغط.
export function ProductGallery({ product, color, onColor, rounded = "" }) {
  const slides = galleryOf(product);
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const fromScroll = useRef(false);

  // لما يتغيّر اللون من برا (صفحة المنتج) نروح لصورته
  useEffect(() => {
    if (!color || fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    const i = slides.findIndex((s) => s.color === color);
    if (i >= 0) go(i, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const go = (i, smooth = true) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(slides.length - 1, i));
    // الاتجاه من اليمين لليسار: نستخدم موقع العنصر نفسه
    el.children[n]?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "start" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (i !== index) {
      setIndex(i);
      const c = slides[i]?.color;
      if (c && onColor && c !== color) {
        fromScroll.current = true;
        onColor(c);
      }
    }
  };

  if (slides.length <= 1) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${rounded}`}>
        <Slide product={product} name={slides[0]?.name} />
      </div>
    );
  }

  const arrow = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    go(index + dir);
  };

  return (
    <div className={`group relative w-full h-full overflow-hidden ${rounded}`}>
      <div
        ref={track}
        onScroll={onScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="معرض صور"
      >
        {slides.map((s, i) => (
          <div key={s.name} className="relative shrink-0 w-full h-full snap-start" aria-label={s.color ? `اللون ${s.color}` : `صورة ${i + 1}`}>
            <Slide product={product} name={s.name} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-2 inset-x-0 flex justify-center gap-1.5" aria-hidden="true">
        {slides.map((s, i) => (
          <span
            key={s.name}
            className={`h-2 rounded-full border border-ink/60 transition-all ${i === index ? "w-5 bg-ink" : "w-2 bg-card/80"}`}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="الصورة السابقة"
        onClick={arrow(-1)}
        className="hidden md:grid absolute top-1/2 right-2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-card border-2 border-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:invisible"
        disabled={index === 0}
      >
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        aria-label="الصورة التالية"
        onClick={arrow(1)}
        className="hidden md:grid absolute top-1/2 left-2 -translate-y-1/2 w-9 h-9 place-items-center rounded-full bg-card border-2 border-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:invisible"
        disabled={index === slides.length - 1}
      >
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}

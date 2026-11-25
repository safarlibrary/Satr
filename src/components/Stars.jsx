import { Star } from "lucide-react";

// نجوم التقييم (للعرض فقط)
export function Stars({ value, size = 14, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} من ٥`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={2} className={n <= Math.round(value) ? "fill-[#fdd56b] text-ink" : "text-ink/30"} aria-hidden="true" />
      ))}
    </span>
  );
}

// اختيار النجوم في نموذج التقييم
export function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} من ٥`}
          className="w-11 h-11 grid place-items-center rounded-xl bg-transparent border-0"
          onClick={() => onChange(n)}
        >
          <Star size={30} strokeWidth={2} className={n <= value ? "fill-[#fdd56b] text-ink" : "text-ink/35"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

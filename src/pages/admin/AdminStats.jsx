import { useState } from "react";
import { formatPrice } from "../../lib/format";
import { useAdminData } from "./useAdminData";

const n = (v) => Number(v ?? 0).toLocaleString("ar-SA");

// الإحصائيات: المبيعات والربح والمخزون (كم انشرى، كم انباع، كم باقي) لكل منتج ولون
export function AdminStats({ token }) {
  const [days, setDays] = useState(30);
  const { data, error } = useAdminData(`/api/admin/stats?days=${days}`, token);
  const [filter, setFilter] = useState("all");
  if (error) return <p role="alert" className="font-bold text-[#b0354f]">{error}</p>;
  if (!data) return <p className="lead">جاري التحميل…</p>;
  const s = data.summary;
  const max = Math.max(1, ...data.daily.map((d) => d.revenue));
  const cards = [
    ["المبيعات", formatPrice(s.revenue), "var(--color-mint)"],
    ["الربح التقديري", formatPrice(Math.round(s.profit)), "var(--color-butter)"],
    ["الطلبات", n(s.orders), "var(--color-pink)"],
    ["متوسط الطلب", formatPrice(s.avgOrder), "var(--color-lilac)"],
    ["القطع المباعة", n(s.items), "var(--color-card)"],
    ["قيمة المخزون (بالتكلفة)", formatPrice(s.stockValue), "var(--color-card)"],
  ];
  const inventory = data.inventory.filter((p) =>
    filter === "low" ? p.remaining > 0 && (p.remaining <= 5 || p.colors.some((c) => c.remaining !== null && c.remaining <= 2)) : filter === "out" ? p.remaining <= 0 || p.colors.some((c) => c.remaining === 0) : true,
  );

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-2" role="group" aria-label="الفترة">
        {[
          [7, "آخر ٧ أيام"],
          [30, "آخر ٣٠ يوم"],
          [90, "آخر ٣ شهور"],
          [365, "آخر سنة"],
        ].map(([d, label]) => (
          <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(([label, value, tint]) => (
          <div key={label} className="panel !rounded-[20px] p-4" style={{ background: tint }}>
            <p className="m-0 text-[14px] font-bold text-ink-soft">{label}</p>
            <p className="m-0 mt-1 text-[24px] font-extrabold leading-tight">{value}</p>
          </div>
        ))}
      </div>
      <p className="m-0 -mt-4 text-[14px] text-ink-soft">
        المبيعات بدون رسوم التوصيل. الربح = المبيعات − تكلفة المنتجات (من خانة التكلفة في كل منتج)، والطلبات الملغية ما تنحسب.
      </p>

      <section className="panel p-5" aria-labelledby="daily">
        <h2 id="daily" className="m-0 mb-4 text-[20px] font-extrabold">
          المبيعات اليومية
        </h2>
        <div className="flex items-end gap-[2px] h-40" dir="ltr">
          {data.daily.map((d) => (
            <div key={d.day} className="flex-1 min-w-0 h-full flex items-end" title={`${d.day}: ${formatPrice(d.revenue)} · ${n(d.orders)} طلب`}>
              <div className="w-full rounded-t-[4px] bg-leaf/80" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[12px] text-ink-soft mt-1" dir="ltr">
          <span>{data.daily[0]?.day}</span>
          <span>{data.daily.at(-1)?.day}</span>
        </div>
      </section>

      <section className="panel p-5" aria-labelledby="top">
        <h2 id="top" className="m-0 mb-3 text-[20px] font-extrabold">
          الأكثر مبيعًا
        </h2>
        {data.top.length === 0 ? (
          <p className="lead m-0">ما فيه مبيعات في هذي الفترة.</p>
        ) : (
          <ol className="m-0 ps-5 grid gap-1.5">
            {data.top.map((t) => (
              <li key={t.id}>
                <b>{t.name}</b> — {n(t.qty)} قطعة · {formatPrice(t.revenue)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="inv">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="inv" className="m-0 text-[22px] font-extrabold">
            المخزون
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="عرض">
            {[
              ["all", "الكل"],
              ["low", "قرّب يخلص"],
              ["out", "خلص"],
            ].map(([k, label]) => (
              <button key={k} className="chip !min-h-10" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 mb-3 text-[14px] text-ink-soft">«الكمية الكلية» = اللي انباع + الباقي (يعني اللي اشتريته من المورد).</p>
        <div className="overflow-x-auto panel !shadow-none">
          <table className="w-full text-[14px] border-collapse">
            <thead>
              <tr className="bg-mint text-right">
                <th className="p-2.5">المنتج / اللون</th>
                <th className="p-2.5">الكمية الكلية</th>
                <th className="p-2.5">انباع</th>
                <th className="p-2.5">باقي</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((p) => (
                <InventoryRows key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function tone(remaining) {
  if (remaining === null || remaining === undefined) return "";
  if (remaining <= 0) return "text-[#b0354f] font-bold";
  if (remaining <= 2) return "text-[#a36a00] font-bold";
  return "";
}

function InventoryRows({ p }) {
  return (
    <>
      <tr className="border-t-2 border-ink/15">
        <td className="p-2.5 font-bold">
          {p.name}
          {!p.active && <span className="text-ink-soft font-normal"> · مخفي</span>}
        </td>
        <td className="p-2.5 tabular-nums">{n(p.purchased)}</td>
        <td className="p-2.5 tabular-nums">{n(p.sold)}</td>
        <td className={`p-2.5 tabular-nums ${tone(p.remaining)}`}>{p.remaining <= 0 ? "خلص" : n(p.remaining)}</td>
      </tr>
      {p.colors
        .filter((c) => c.remaining !== null)
        .map((c) => (
          <tr key={c.color} className="text-ink-soft">
            <td className="p-2 ps-6">— {c.color}</td>
            <td className="p-2 tabular-nums">{n(c.purchased)}</td>
            <td className="p-2 tabular-nums">{n(c.sold)}</td>
            <td className={`p-2 tabular-nums ${tone(c.remaining)}`}>{c.remaining <= 0 ? "خلص" : n(c.remaining)}</td>
          </tr>
        ))}
    </>
  );
}

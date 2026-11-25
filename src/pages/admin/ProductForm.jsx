import { useState } from "react";
import { Field, SelectField } from "../../components/Field";
import { ApiError, api, fileToDataUrl } from "../../lib/api";

const ART_KINDS = [
  "pencil",
  "notebook",
  "backpack",
  "ruler",
  "crayons",
  "eraser",
  "scissors",
  "pencilcase",
  "highlighter",
  "glue",
  "sharpener",
  "geometry",
  "tote",
  "sticky",
  "calendar",
];

const TINTS = [
  "var(--color-pink)",
  "var(--color-butter)",
  "var(--color-mint)",
  "var(--color-lilac)",
];

const emptyProduct = (c) => ({
  id: "",
  name: "",
  category: c[0]?.id ?? "notebooks",
  price: "",
  oldPrice: "",
  art: "notebook",
  tint: TINTS[0],
  badge: "",
  description: "",
  details: "",
  stock: "25",
  brand: "",
  madeIn: "",
  colors: "",
});

export function ProductForm({
  token: c,
  categories: r,
  product: o,
  onDone: f,
  onCancel: g,
}) {
  const [m, b] = useState(() =>
    o
      ? {
          id: o.id,
          name: o.name,
          category: o.category,
          price: String(o.price),
          oldPrice: o.oldPrice ? String(o.oldPrice) : "",
          art: o.art,
          tint: o.tint,
          badge: o.badge ?? "",
          description: o.description,
          details: o.details.join(`
`),
          stock: String(o.stock),
          brand: o.brand ?? "",
          madeIn: o.madeIn ?? "",
          colors: (o.colors ?? []).join("، "),
          cost: o.cost !== undefined && o.cost !== null ? String(o.cost) : "",
          colorStock: Object.fromEntries(Object.entries(o.colorStock ?? {}).map(([k, v]) => [k, String(v)])),
        }
      : { ...emptyProduct(r), cost: "", colorStock: {} },
  );
  const [cover, setCover] = useState(false);
  const [colorFiles, setColorFiles] = useState({});
  const [extraFiles, setExtraFiles] = useState([]);
  const [images, setImages] = useState(o?.images ?? []);
  const colorList = m.colors.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  const hasColorStock = colorList.length > 0 && colorList.some((col) => m.colorStock[col] !== undefined && m.colorStock[col] !== "");
  const colorTotal = colorList.reduce((s, col) => s + (Number(m.colorStock[col]) || 0), 0);
  const removeImage = async (url) => {
    await api(`/api/admin/products/${o.id}/images/remove`, { method: "POST", json: { url }, token: c });
    setImages((list) => list.filter((u) => u !== url));
  };
  const [S, y] = useState("");
  const [h, E] = useState(null);
  const [z, Q] = useState(false);
  const Z = (C, w) =>
    b((Y) => ({
      ...Y,
      [C]: w,
    }));
  const O = async (C) => {
    C.preventDefault();
    Q(true);
    y("");
    const w = {
      id: m.id.trim(),
      name: m.name.trim(),
      category: m.category,
      price: Number(m.price),
      oldPrice: m.oldPrice ? Number(m.oldPrice) : undefined,
      art: m.art,
      tint: m.tint,
      badge: m.badge || undefined,
      description: m.description.trim(),
      details: m.details
        .split(
          `
`,
        )
        .map((Y) => Y.trim())
        .filter(Boolean),
      stock: Number(m.stock),
      brand: m.brand.trim() || undefined,
      madeIn: m.madeIn.trim() || undefined,
      colors: m.colors
        .split(/[،,]/)
        .map((Y) => Y.trim())
        .filter(Boolean),
      cost: m.cost === "" ? undefined : Number(m.cost),
      ...(hasColorStock ? { colorStock: Object.fromEntries(colorList.map((col) => [col, Number(m.colorStock[col]) || 0])) } : {}),
    };
    try {
      const Y = o
        ? await api(`/api/admin/products/${o.id}`, {
            method: "PUT",
            json: w,
            token: c,
          })
        : await api("/api/admin/products", {
            method: "POST",
            json: w,
            token: c,
          });
      const upload = async (file, extra) =>
        api(`/api/admin/products/${Y.id}/image`, { method: "POST", json: { file: await fileToDataUrl(file), cover, ...extra }, token: c });
      if (h) await upload(h, {});
      for (const [color, file] of Object.entries(colorFiles)) if (file && colorList.includes(color)) await upload(file, { color });
      for (const file of extraFiles) await upload(file, { extra: true });
      f();
    } catch (Y) {
      y(Y instanceof ApiError ? Y.message : "صار خطأ، جرّب مرة ثانية.");
    } finally {
      Q(false);
    }
  };
  return (
    <form
      className="panel p-6 grid gap-4 sm:grid-cols-2"
      onSubmit={O}
      noValidate
    >
      <h2 className="m-0 sm:col-span-2 text-[20px] font-extrabold">
        {o ? `تعديل: ${o.name}` : "منتج جديد"}
      </h2>
      <Field
        id="p-id"
        label="المعرّف (إنجليزي، لا يتغيّر)"
        dir="ltr"
        value={m.id}
        disabled={!!o}
        onChange={(C) => Z("id", C.target.value)}
      />
      <Field
        id="p-name"
        label="الاسم"
        value={m.name}
        onChange={(C) => Z("name", C.target.value)}
      />
      <SelectField
        id="p-cat"
        label="القسم"
        value={m.category}
        onChange={(C) => Z("category", C)}
      >
        {r.map((C) => (
          <option key={C.id} value={C.id}>
            {C.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-3 gap-3">
        <Field
          id="p-price"
          label="السعر"
          type="number"
          min={1}
          dir="ltr"
          value={m.price}
          onChange={(C) => Z("price", C.target.value)}
        />
        <Field
          id="p-old"
          label="قبل الخصم"
          type="number"
          min={1}
          dir="ltr"
          value={m.oldPrice}
          onChange={(C) => Z("oldPrice", C.target.value)}
        />
        <Field
          id="p-stock"
          label="المخزون"
          type="number"
          min={0}
          dir="ltr"
          value={hasColorStock ? String(colorTotal) : m.stock}
          disabled={hasColorStock}
          onChange={(C) => Z("stock", C.target.value)}
        />
      </div>
      <Field
        id="p-cost"
        label="التكلفة (للإحصائيات، ما تظهر للعميل)"
        type="number"
        min={0}
        step="0.01"
        dir="ltr"
        value={m.cost}
        onChange={(C) => Z("cost", C.target.value)}
      />
      <SelectField
        id="p-art"
        label="الرسمة"
        value={m.art}
        onChange={(C) => Z("art", C)}
      >
        {ART_KINDS.map((C) => (
          <option key={C} value={C}>
            {C}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="p-tint"
        label="لون الخلفية"
        value={m.tint}
        onChange={(C) => Z("tint", C)}
      >
        {TINTS.map((C) => (
          <option key={C} value={C}>
            {C.replace("var(--color-", "").replace(")", "")}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="p-badge"
        label="الشارة"
        value={m.badge}
        onChange={(C) => Z("badge", C)}
      >
        <option value="">بدون</option>
        <option value="جديد">جديد</option>
        <option value="خصم">خصم</option>
        <option value="الأكثر طلبًا">الأكثر طلبًا</option>
      </SelectField>
      <label className="grid gap-2 sm:col-span-2">
        <span className="label m-0">الوصف</span>
        <textarea
          className="field min-h-24"
          value={m.description}
          onChange={(C) => Z("description", C.target.value)}
        />
      </label>
      <label className="grid gap-2 sm:col-span-2">
        <span className="label m-0">تفاصيل (سطر لكل تفصيل)</span>
        <textarea
          className="field min-h-24"
          value={m.details}
          onChange={(C) => Z("details", C.target.value)}
        />
      </label>
      <Field
        id="p-brand"
        label="الشركة"
        value={m.brand}
        onChange={(C) => Z("brand", C.target.value)}
      />
      <Field
        id="p-madein"
        label="بلد الصنع"
        value={m.madeIn}
        onChange={(C) => Z("madeIn", C.target.value)}
      />
      <label className="grid gap-2 sm:col-span-2">
        <span className="label m-0">
          الألوان (افصل بينها بفاصلة، واتركها فاضية إذا ما فيه ألوان)
        </span>
        <input
          className="field"
          value={m.colors}
          onChange={(C) => Z("colors", C.target.value)}
          placeholder="أزرق، أحمر"
        />
      </label>
      <label className="grid gap-2 sm:col-span-2">
        <span className="label m-0">
          صورة المنتج (JPG أو PNG أو WebP، حتى ٧ ميجا)
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(C) => E(C.target.files?.[0] ?? null)}
        />
        {h && (
          <span className="text-[14px] text-ink-soft">
            {"بتنرفع: "}
            {h.name}
          </span>
        )}
      </label>
      <label className="flex items-start gap-2 sm:col-span-2 text-[15px] cursor-pointer">
        <input type="checkbox" className="mt-1.5 w-5 h-5" checked={cover} onChange={(e) => setCover(e.target.checked)} />
        <span>
          <b>الصور مصمّمة بخلفيتها</b> (مثل صور شات بخلفية لون المتجر): تملأ بطاقة المنتج كاملة. اتركها بدون صح للصور المقصوصة بدون خلفية.
        </span>
      </label>
      {colorList.length > 0 && (
        <fieldset className="sm:col-span-2 border-2 border-dashed border-ink/25 rounded-[18px] p-4 m-0 grid gap-3">
          <legend className="label !mb-0 px-1">الكمية والصورة لكل لون</legend>
          {colorList.map((col) => (
            <div key={col} className="grid gap-2 sm:grid-cols-[8rem_7rem_1fr] sm:items-center">
              <b>{col}</b>
              <input
                className="field !min-h-11"
                type="number"
                min={0}
                dir="ltr"
                aria-label={`كمية ${col}`}
                placeholder="الكمية"
                value={m.colorStock[col] ?? ""}
                onChange={(e) => Z("colorStock", { ...m.colorStock, [col]: e.target.value })}
              />
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`صورة ${col}`} onChange={(e) => setColorFiles((f) => ({ ...f, [col]: e.target.files?.[0] ?? null }))} />
            </div>
          ))}
          <p className="m-0 text-[14px] text-ink-soft">
            {hasColorStock ? `المخزون الكلي يصير ${colorTotal.toLocaleString("ar-SA")} (مجموع الألوان).` : "إذا كتبت كمية لكل لون، العميل ما يقدر يطلب لون خلص، ونبلّغ اللي طلبوا «نبّهني» لما يرجع."}
          </p>
        </fieldset>
      )}
      <label className="grid gap-2 sm:col-span-2">
        <span className="label m-0">صور إضافية (زوايا ثانية للمنتج، تتقلّب بالسحب)</span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setExtraFiles([...(e.target.files ?? [])])} />
        {extraFiles.length > 0 && <span className="text-[14px] text-ink-soft">بتنرفع {extraFiles.length.toLocaleString("ar-SA")} صورة</span>}
      </label>
      {o && images.length > 0 && (
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {images.map((u) => (
            <span key={u} className="relative">
              <img src={u} alt="" className="w-20 h-20 object-cover rounded-xl border-2 border-ink" />
              <button type="button" className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-pink border-2 border-ink text-[14px] font-bold" aria-label="احذف الصورة" onClick={() => removeImage(u)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {S && (
        <p role="alert" className="m-0 sm:col-span-2 font-bold text-[#b0354f]">
          {S}
        </p>
      )}
      <div className="sm:col-span-2 flex gap-3">
        <button className="btn" disabled={z}>
          {z ? "جاري الحفظ…" : "احفظ"}
        </button>
        <button type="button" className="btn btn-paper" onClick={g}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

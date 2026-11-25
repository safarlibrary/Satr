import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Download, GripVertical, Upload } from "lucide-react";

// منطقة اختيار الملفات (ضغط أو سحب وإفلات)
export function FileDrop({ accept, multiple = false, onFiles, title, hint, disabled = false }) {
  const [over, setOver] = useState(false);
  const pick = (list) => {
    const files = [...list];
    if (files.length) onFiles(files);
  };
  return (
    <label
      className={`flex flex-col items-center justify-center gap-2 min-h-40 rounded-[18px] border-2 border-dashed border-ink cursor-pointer text-center p-4 transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-leaf ${over ? "bg-mint" : "bg-mint-soft"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
    >
      <Upload size={32} className="text-leaf" aria-hidden="true" />
      <span className="font-bold text-[18px]">{title}</span>
      {hint && <span className="text-[14px] text-ink-soft">{hint}</span>}
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function ProgressPanel({ label, value, onCancel }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="panel !rounded-[18px] !shadow-none p-4 grid gap-3" role="status">
      <div className="flex justify-between gap-3 font-bold">
        <span>{label}</span>
        <span>{pct.toLocaleString("ar-SA")}٪</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} className="h-3 rounded-full border-2 border-ink bg-card overflow-hidden">
        <div className="h-full bg-mint border-l-2 border-ink transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      {onCancel && (
        <button type="button" className="btn btn-sm btn-paper justify-self-start" onClick={onCancel}>
          إلغاء
        </button>
      )}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 rounded-[14px] border-2 border-[#b0354f]/40 bg-pink/40 px-4 py-2.5 text-[15px] font-bold text-[#8c2640]">
      {children}
    </p>
  );
}

// نتيجة جاهزة للتنزيل
export function ResultCard({ title, children, onDownload, downloadLabel = "نزّل الملف", onReset }) {
  return (
    <div className="panel stitched !rounded-[22px] p-5 grid gap-3" role="status">
      <p className="relative m-0 text-[20px] font-extrabold">{title}</p>
      {children && <div className="relative text-[16px] grid gap-1">{children}</div>}
      <div className="relative flex flex-wrap gap-3">
        <button type="button" className="btn btn-pink" onClick={onDownload}>
          <Download size={20} strokeWidth={2.6} aria-hidden="true" />
          {downloadLabel}
        </button>
        {onReset && (
          <button type="button" className="btn btn-paper btn-sm" onClick={onReset}>
            ابدأ من جديد
          </button>
        )}
      </div>
    </div>
  );
}

// قائمة قابلة للترتيب: بالسحب من المقبض، أو بأزرار فوق وتحت (أنسب للجوال ولقارئات الشاشة)
export function SortableList({ items, onChange, renderItem }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from, to) => {
    if (to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) move(items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className="list-none p-0 m-0 grid gap-2.5">
          {items.map((item, index) => (
            <Row key={item.id} id={item.id} index={index} count={items.length} onMove={move}>
              {renderItem(item, index)}
            </Row>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, index, count, onMove, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.85 : 1 }}
      className={`flex items-center gap-2 sm:gap-3 rounded-[16px] border-2 border-ink bg-card p-2.5 ${isDragging ? "shadow-[4px_4px_0_var(--color-ink)]" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="اسحب لتغيير الترتيب"
        className="w-9 h-11 shrink-0 grid place-items-center rounded-lg bg-transparent border-0 text-ink-soft cursor-grab"
        style={{ touchAction: "none" }}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
      <span className="w-6 shrink-0 text-center font-bold text-ink-soft" aria-hidden="true">
        {(index + 1).toLocaleString("ar-SA")}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-3">{children}</div>
      <div className="flex flex-col shrink-0">
        <button type="button" aria-label="حرّك لفوق" disabled={index === 0} onClick={() => onMove(index, index - 1)} className="w-9 h-6 grid place-items-center bg-transparent border-0 disabled:opacity-25">
          <ArrowUp size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="حرّك لتحت" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="w-9 h-6 grid place-items-center bg-transparent border-0 disabled:opacity-25">
          <ArrowDown size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

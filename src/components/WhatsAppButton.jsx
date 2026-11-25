import { useStore } from "../lib/store";

// زر واتساب العائم — يظهر فقط إذا حطيت رقم واتساب بزنس في لوحة التحكم ← الإعدادات
export function WhatsAppButton() {
  const { store, panel } = useStore();
  const number = String(store.supportWhatsapp ?? "").replace(/\D/g, "").replace(/^05/, "9665");
  if (!number || panel) return null;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا على واتساب"
      className="fixed bottom-5 left-5 z-40 grid place-items-center w-14 h-14 rounded-full bg-mint border-2 border-ink shadow-[4px_4px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden="true">
        <path
          d="M16 4a12 12 0 0 0-10.3 18.2L4 28l5.9-1.6A12 12 0 1 0 16 4z"
          fill="#fffdf8"
          stroke="#3b3242"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 10.5c.4-.9 1-.9 1.4-.9h.7c.3 0 .6.1.8.6l1 2.3c.1.3.1.6-.1.9l-.7.9c-.2.3-.2.5 0 .8.9 1.6 2.1 2.8 3.7 3.6.3.2.6.1.8-.1l.9-1.1c.2-.3.5-.3.8-.2l2.2 1.1c.4.2.5.4.5.7 0 .8-.4 1.9-1.6 2.4-1 .4-2.4.4-4.6-.6a12.4 12.4 0 0 1-5.4-5.2c-.9-1.6-1.1-3.2-.4-4.2z"
          fill="#3f7963"
        />
      </svg>
    </a>
  );
}

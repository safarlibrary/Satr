import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";

// هل أدوات الذكاء الاصطناعي مفعّلة من لوحة التحكم؟ (إذا لا، الأداة تشتغل عادي بدون زر الاقتراحات)
export function useAiStatus() {
  const [status, setStatus] = useState({ ready: false, available: false, dailyLimit: 0 });
  useEffect(() => {
    let alive = true;
    api("/api/ai/status")
      .then((s) => alive && setStatus({ ready: true, available: Boolean(s?.available), dailyLimit: s?.dailyLimit ?? 0 }))
      .catch(() => alive && setStatus({ ready: true, available: false, dailyLimit: 0 }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

export async function aiPost(path, json) {
  try {
    return await api(path, { method: "POST", json });
  } catch (e) {
    throw new Error(e instanceof ApiError ? e.message : "ما قدرنا نجيب الاقتراحات الحين. جرّب بعد شوي.");
  }
}

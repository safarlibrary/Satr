import { useCallback, useEffect, useState } from "react";
import { CUSTOMER_KEY, api, readCustomerToken } from "./api";

// حساب العميل (تسجيل الدخول برمز SMS). الحالة مشتركة بين كل الصفحات عن طريق حدث في المتصفح.
const EVENT = "satr-account";
const notify = () => window.dispatchEvent(new Event(EVENT));

export function saveCustomerToken(token) {
  try {
    if (token) localStorage.setItem(CUSTOMER_KEY, token);
    else localStorage.removeItem(CUSTOMER_KEY);
  } catch {}
  notify();
}

export function useAccount() {
  const [state, setState] = useState({ status: readCustomerToken() ? "loading" : "guest" });
  const load = useCallback(() => {
    if (!readCustomerToken()) return setState({ status: "guest" });
    api("/api/me")
      .then((data) => setState({ status: "ready", ...data }))
      .catch((error) => {
        if (error.status === 401) {
          saveCustomerToken(null);
          setState({ status: "guest" });
        } else setState({ status: "error", message: error.message });
      });
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    saveCustomerToken(null);
  }, []);
  return { ...state, reload: load, logout };
}

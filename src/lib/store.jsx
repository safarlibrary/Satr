import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from "./format";
import { initTracking, track } from "./tracking";

const sameLine = (c, r, o) => c.id === r && (c.color ?? null) === (o ?? null);

const StoreContext = createContext(null);

const CART_KEY = "satr-cart";
const CART_ID_KEY = "satr-cart-id";

// معرّف ثابت لسلة هذا المتصفح (عشان السلات المتروكة في لوحة التحكم)
function cartIdFor() {
  try {
    let id = localStorage.getItem(CART_ID_KEY);
    if (!id) {
      id = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CART_ID_KEY, id);
    }
    return id;
  } catch {
    return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function loadCart() {
  try {
    const c = localStorage.getItem(CART_KEY);
    const r = c ? JSON.parse(c) : [];
    if (Array.isArray(r)) {
      return r.filter((o) => o && typeof o.id == "string" && o.qty > 0);
    } else {
      return [];
    }
  } catch {
    return [];
  }
}

export function StoreProvider({ children: c }) {
  const [r, o] = useState(loadCart);
  const [f, g] = useState(null);
  const [m, b] = useState({
    status: "loading",
  });
  const S = useRef(null);
  const y = useCallback((O) => {
    if (O) {
      S.current = document.activeElement;
    }
    g(O);
  }, []);
  const h = useCallback(() => S.current?.focus?.(), []);
  const E = useCallback(() => {
    b({
      status: "loading",
    });
    api("/api/catalog")
      .then((O) =>
        b({
          status: "ready",
          ...O,
        }),
      )
      .catch((O) =>
        b({
          status: "error",
          message: O.message,
        }),
      );
  }, []);
  useEffect(() => {
    E();
  }, [E]);
  useEffect(() => {
    if (m.status === "ready") initTracking(m.tracking);
  }, [m]);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(r));
    } catch {}
  }, [r]);
  const cartId = useMemo(cartIdFor, []);
  const contact = useRef({});
  const syncCart = useCallback(
    (items) => api("/api/carts", { method: "POST", json: { id: cartId, items, ...contact.current } }).catch(() => {}),
    [cartId],
  );
  // نرسل السلة للسيرفر بعد ثانيتين من آخر تغيير
  const synced = useRef(false);
  useEffect(() => {
    if (!synced.current && r.length === 0) return;
    synced.current = true;
    const t = setTimeout(() => syncCart(r.map(({ id, qty, color }) => ({ id, qty, color }))), 2000);
    return () => clearTimeout(t);
  }, [r, syncCart]);
  const syncCartContact = useCallback(
    ({ name, phone }) => {
      contact.current = { name, phone };
      if (r.length) syncCart(r.map(({ id, qty, color }) => ({ id, qty, color })));
    },
    [r, syncCart],
  );
  const z = useMemo(() => (m.status === "ready" ? m.products : []), [m]);
  const Q = useMemo(() => (m.status === "ready" ? m.categories : []), [m]);
  const Z = useMemo(() => {
    const O = r.flatMap((w) => {
      const Y = z.find((J) => J.id === w.id);
      if (Y) {
        return [
          {
            ...w,
            qty: Math.min(w.qty, Math.max(Y.stock, 0)),
            product: Y,
          },
        ];
      } else {
        return [];
      }
    });
    const C = (w, Y) => {
      const J = z.find((et) => et.id === w);
      if (J) {
        return Math.min(Y, J.stock);
      } else {
        return Y;
      }
    };
    return {
      catalog: m,
      onlinePayment: m.status === "ready" && m.onlinePayment,
      tabby: m.status === "ready" && Boolean(m.tabby),
      ratings: (m.status === "ready" && m.ratings) || {},
      cartId,
      syncCartContact,
      // بيانات المتجر من لوحة التحكم ← الإعدادات (واتساب، الحسابات، أرقام الوثائق)
      store: (m.status === "ready" && m.store) || {},
      // رسوم التوصيل وحد التوصيل المجاني — تتغيّر من لوحة التحكم ← الإعدادات
      shipping: {
        fee: m.shipping?.fee ?? SHIPPING_FEE,
        freeMin: m.shipping?.freeMin ?? FREE_SHIPPING_MIN,
      },
      reloadCatalog: E,
      categories: Q,
      products: z,
      lines: O,
      count: O.reduce((w, Y) => w + Y.qty, 0),
      subtotal: O.reduce((w, Y) => w + Y.qty * Y.product.price, 0),
      add: (w, Y = 1, J) => {
        const product = z.find((p) => p.id === w);
        if (product && product.stock > 0) {
          track("add_to_cart", {
            value: product.price * Y,
            items: [{ id: product.id, name: product.name, price: product.price, qty: Y, color: J }],
          });
        }
        return o((et) => {
          const K = et.find((st) => sameLine(st, w, J));
          const W = K ? K.qty + Y : Y;
          const R = C(w, W);
          if (R <= 0) {
            return et;
          }
          const P = J || undefined;
          if (K) {
            return et.map((st) =>
              sameLine(st, w, J)
                ? {
                    ...st,
                    qty: R,
                  }
                : st,
            );
          } else {
            return [
              ...et,
              {
                id: w,
                qty: R,
                color: P,
              },
            ];
          }
        });
      },
      setQty: (w, Y, J) =>
        o((et) =>
          Y <= 0
            ? et.filter((K) => !sameLine(K, w, J))
            : et.map((K) =>
                sameLine(K, w, J)
                  ? {
                      ...K,
                      qty: C(w, Y),
                    }
                  : K,
              ),
        ),
      remove: (w, Y) => o((J) => J.filter((et) => !sameLine(et, w, Y))),
      clear: () => o([]),
      panel: f,
      setPanel: y,
      returnFocus: h,
    };
  }, [r, f, m, z, Q, E, y, h, cartId, syncCartContact]);
  return <StoreContext.Provider value={Z}>{c}</StoreContext.Provider>;
}

export function useStore() {
  const c = useContext(StoreContext);
  if (!c) {
    throw new Error("useStore outside StoreProvider");
  }
  return c;
}

import { useEffect, useState } from "react";

// التوجيه: صفحات المتجر على #/ مثل ما كانت، وأدوات الطالب لها روابط حقيقية (/tools/...)
// عشان جوجل يفهرس كل أداة. في المعاينة بدون سيرفر كل شي يشتغل على #/.
const STATIC_PREVIEW = import.meta.env.VITE_STATIC_PREVIEW === "1";
const ROUTE_EVENT = "satr-route";

export const isToolsPath = (path) => path === "/tools" || path.startsWith("/tools/");

export function readRoute() {
  const { pathname, search, hash } = window.location;
  if (!STATIC_PREVIEW) {
    const p = pathname.replace(/\/+$/, "") || "/";
    if (isToolsPath(p)) return p + search;
  }
  return hash.startsWith("#/") ? hash.slice(1) : "/";
}

// رابط صفحة: روابط حقيقية للأدوات، و#/ لباقي المتجر
export const linkTo = (path) => (!STATIC_PREVIEW && isToolsPath(path.split("?")[0]) ? path : `#${path}`);

// انتقال برمجي (بدل window.location.hash)
export function navigate(path) {
  const tools = isToolsPath(path.split("?")[0]);
  if (STATIC_PREVIEW || (!tools && window.location.pathname === "/")) {
    window.location.hash = `#${path}`;
    return;
  }
  window.history.pushState(null, "", tools ? path : `/#${path}`);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const update = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener(ROUTE_EVENT, update);
    // الضغط على أي رابط داخلي من صفحة أدوات إلى المتجر (أو العكس) ما يعيد تحميل الصفحة
    const onClick = (e) => {
      if (STATIC_PREVIEW || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      let to = null;
      if (href.startsWith("#/")) {
        if (window.location.pathname === "/") return;
        to = `/${href}`;
      } else if (isToolsPath(href.split("?")[0])) {
        to = href;
      } else return;
      e.preventDefault();
      window.history.pushState(null, "", to);
      window.dispatchEvent(new Event(ROUTE_EVENT));
    };
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener(ROUTE_EVENT, update);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return route;
}

export const useHashRoute = useRoute;

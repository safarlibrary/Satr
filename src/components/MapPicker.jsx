import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { api } from "../lib/api";

// خريطة تحديد الموقع في صفحة إتمام الطلب (OpenStreetMap).
// العميل يضغط على الخريطة أو يسحب الدبوس، ونعبّي الحي والشارع تلقائيًا.
const RIYADH = { lat: 24.7136, lng: 46.6753 };

const pinIcon = (L) =>
  L.divIcon({
    className: "",
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    html: `<svg viewBox="0 0 36 46" width="36" height="46"><path d="M18 44C18 44 4 28 4 17a14 14 0 0 1 28 0c0 11-14 27-14 27z" fill="#f198aa" stroke="#3b3242" stroke-width="2.5"/><circle cx="18" cy="17" r="5.5" fill="#fffdf8" stroke="#3b3242" stroke-width="2.5"/></svg>`,
  });

export function MapPicker({ city, value, onPick }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const Lref = useRef(null);
  const [status, setStatus] = useState("");
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const place = async (lat, lng) => {
    const L = Lref.current;
    if (!map.current || !L) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        place(p.lat, p.lng);
      });
    } else marker.current.setLatLng([lat, lng]);
    setStatus("جاري جلب العنوان…");
    try {
      const address = await api(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      pickRef.current({ lat, lng, ...address });
      setStatus(address.street || address.district ? "تم تعبئة الحي والشارع، عدّلها إذا تحتاج" : "حدّدنا الموقع، اكتب الحي والشارع");
    } catch {
      pickRef.current({ lat, lng });
      setStatus("حدّدنا الموقع، اكتب الحي والشارع");
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([mod]) => {
      if (cancelled || !box.current || map.current) return;
      const L = mod.default ?? mod;
      Lref.current = L;
      const start = value ?? RIYADH;
      map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
      if (value) marker.current = L.marker([value.lat, value.lng], { draggable: true, icon: pinIcon(L) }).addTo(map.current);
      map.current.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // لما تتغيّر المدينة ننقل الخريطة لها
  useEffect(() => {
    if (!city || value) return;
    let cancelled = false;
    api(`/api/geo/search?q=${encodeURIComponent(city)}`)
      .then((hit) => {
        if (!cancelled && hit && map.current) map.current.setView([hit.lat, hit.lng], 12);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const locate = () => {
    if (!navigator.geolocation) return setStatus("جهازك ما يدعم تحديد الموقع");
    setStatus("جاري تحديد موقعك…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], 17);
        place(pos.coords.latitude, pos.coords.longitude);
      },
      () => setStatus("ما قدرنا نحدد موقعك، اضغط على الخريطة بدلها"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label !mb-0">حدّد موقعك على الخريطة</span>
        <button type="button" className="btn btn-sm btn-paper !min-h-10" onClick={locate}>
          <LocateFixed size={18} aria-hidden="true" />
          موقعي الحالي
        </button>
      </div>
      <div
        ref={box}
        className="relative z-0 h-64 sm:h-72 rounded-[18px] border-2 border-ink overflow-hidden bg-mint-soft"
        role="application"
        aria-label="خريطة لتحديد موقع التوصيل"
      />
      <p className="m-0 text-[14px] text-ink-soft" aria-live="polite">
        {status || "اضغط على مكان بيتك في الخريطة، ونعبّي الحي والشارع تلقائيًا."}
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

import catImage from "../assets/media/mishmish.webp";

const CAT_INK = "#1c2040";

const EYES = [
  { x: 275, y: 651 },
  { x: 525, y: 583 },
];

export function Cat({
  awake: c,
  gaze: r = "center",
  patrol: o = false,
  className: f,
}) {
  const g = r === "down" ? 11 : r === "up" ? -11 : 0;
  return (
    <div
      className={`relative aspect-[1254/1189] ${o ? "cat-patrol" : ""} ${f ?? ""}`}
    >
      <img
        src={catImage}
        alt=""
        className="block w-full h-full"
        draggable={false}
      />
      <svg
        viewBox="0 0 1254 1189"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {EYES.map(({ x, y }) =>
          c ? (
            <g key={x}>
              <circle
                cx={x}
                cy={y}
                r="62"
                fill="#fff"
                stroke={CAT_INK}
                strokeWidth="12"
              />
              <g
                style={{
                  transform: `translateY(${g}px)`,
                  transition: "transform 260ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <circle cx={x + 10} cy={y - 4} r="41" fill={CAT_INK} />
                <circle cx={x + 22} cy={y - 21} r="14" fill="#fff" />
                <circle cx={x - 7} cy={y + 10} r="7" fill="#fff" />
              </g>
            </g>
          ) : (
            <path
              key={x}
              d={`M ${x - 52} ${y - 6} Q ${x} ${y + 44} ${x + 52} ${y - 6}`}
              fill="none"
              stroke={CAT_INK}
              strokeWidth="13"
              strokeLinecap="round"
            />
          ),
        )}
      </svg>
    </div>
  );
}

function Zzz() {
  return (
    <span className="cat-zzz" aria-hidden="true">
      <span>z</span>
      <span>z</span>
      <span>z</span>
      <span>z</span>
    </span>
  );
}

export function SleepyCatButton({ className: c, onWake: r }) {
  const o = useRef(null);
  const [f, g] = useState(false);
  const [m, b] = useState("center");
  useEffect(() => r?.(f), [f, r]);
  useEffect(() => {
    const S = o.current;
    if (!S) {
      return;
    }
    const y = new IntersectionObserver(([h]) => {
      if (!h.isIntersecting) {
        g(false);
        b("center");
      }
    });
    y.observe(S);
    return () => y.disconnect();
  }, []);
  useEffect(() => {
    if (!f) {
      return;
    }
    let S = window.scrollY;
    const y = () => {
      const h = window.scrollY;
      if (!(Math.abs(h - S) < 2)) {
        b(h > S ? "down" : "up");
        S = h;
      }
    };
    window.addEventListener("scroll", y, {
      passive: true,
    });
    return () => window.removeEventListener("scroll", y);
  }, [f]);
  return (
    <button
      ref={o}
      type="button"
      className={`cat-btn ${c ?? ""}`}
      aria-pressed={f}
      aria-label={
        f ? "القطو صاحي — اضغط عشان ينام" : "القطو نايم — اضغط عشان يصحى"
      }
      onClick={() => {
        g((S) => !S);
        b("center");
      }}
    >
      <Cat
        awake={f}
        gaze={m}
        className={`w-full translate-x-[7%] ${f ? "cat-wake" : "cat-breathe"}`}
      />
      {!f && <Zzz />}
    </button>
  );
}

export function SleepingCat({ className: c }) {
  return (
    <div className={`relative ${c ?? ""}`}>
      <Cat awake={false} className="w-full cat-breathe" />
      <Zzz />
    </div>
  );
}

export function WalkingCat({ className: c }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className={c}
      aria-hidden="true"
      overflow="visible"
    >
      <g className="walk-legs-a">
        <path
          d="M18 28v9M40 28v9"
          stroke={CAT_INK}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
      <g className="walk-legs-b">
        <path
          d="M24 28v9M46 28v9"
          stroke={CAT_INK}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
      <path
        className="walk-tail"
        d="M50 20c8-2 10-10 6-14"
        fill="none"
        stroke={CAT_INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <rect
        x="14"
        y="14"
        width="38"
        height="17"
        rx="8.5"
        fill="#f6b98a"
        stroke={CAT_INK}
        strokeWidth="2.5"
      />
      <path
        d="M6 8l2-7 6 5M20 8l-1-7-6 5"
        fill="#f6b98a"
        stroke={CAT_INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle
        cx="13"
        cy="15"
        r="10"
        fill="#f6b98a"
        stroke={CAT_INK}
        strokeWidth="2.5"
      />
      <circle cx="9.5" cy="14" r="1.8" fill={CAT_INK} />
      <circle cx="16" cy="14" r="1.8" fill={CAT_INK} />
      <ellipse cx="7.5" cy="18.5" rx="2.2" ry="1.4" fill="#f7a9b8" />
      <path
        d="M11.5 18.5l1.5 1.5 1.5-1.5"
        fill="none"
        stroke={CAT_INK}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

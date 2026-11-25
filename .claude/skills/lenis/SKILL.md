---
name: lenis
description: Add smooth (inertia) scrolling to websites with Lenis by darkroom.engineering, in React or vanilla JS, including syncing with GSAP ScrollTrigger, anchor links, scrollTo, nested scroll areas and horizontal scroll. Use when the user asks for Lenis, smooth scroll, buttery/inertial scrolling, or scroll-driven landing pages.
---

# Lenis

Install: `npm install lenis --save-exact` (package is `lenis`; the old `@studio-freight/lenis` is deprecated). CDN: `https://unpkg.com/lenis@1.3.28/dist/lenis.min.js` + CSS `https://unpkg.com/lenis@1.3.28/dist/lenis.css`.

**Always import the CSS**: `import 'lenis/dist/lenis.css'`.

## React
```jsx
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

export default function App() {
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true, anchors: true }}>
      <Page />
    </ReactLenis>
  );
}

// anywhere inside
const lenis = useLenis(({ scroll, progress, velocity }) => { /* on every scroll */ });
lenis?.scrollTo('#pricing', { offset: -80, duration: 1.5 });
```

## With GSAP ScrollTrigger (single RAF loop driven by GSAP)
```jsx
import { useEffect, useRef } from 'react';
import { ReactLenis } from 'lenis/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({ children }) {
  const lenisRef = useRef(null);
  useEffect(() => {
    const update = time => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    lenis?.on('scroll', ScrollTrigger.update);
    return () => { gsap.ticker.remove(update); lenis?.off('scroll', ScrollTrigger.update); };
  }, []);
  return <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>{children}</ReactLenis>;
}
```

## Vanilla
```js
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
const lenis = new Lenis({ autoRaf: true, anchors: true });
// with GSAP: new Lenis(); lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
```

## Key options & API
`lerp` (0–1, lower = smoother) or `duration`+`easing`; `orientation: 'vertical'|'horizontal'`; `gestureOrientation`; `smoothWheel`; `syncTouch` (off by default — keep native touch on mobile); `wheelMultiplier`; `infinite`; `wrapper`/`content` for a non-root scroller; `prevent: node => …`.
Methods: `scrollTo(target|number, { offset, duration, immediate, lock })`, `stop()` / `start()` (e.g. when a modal opens), `resize()`, `destroy()`.
Nested scrollable elements (modals, dropdowns, code blocks): add `data-lenis-prevent` (or `-wheel`/`-touch`).

## Rules
- One Lenis instance per page (`root`). Don't combine with CSS `scroll-behavior: smooth` (lenis.css handles it).
- Disable or set `lerp: 1` when `prefers-reduced-motion: reduce`.
- Call `lenis.stop()` while modals/menus lock the page; `start()` after.
- RTL pages work as-is for vertical scroll; for horizontal sections verify direction.

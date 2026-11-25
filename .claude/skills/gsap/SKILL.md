---
name: gsap
description: Build web animations with GSAP (GreenSock) in React or vanilla JS — tweens, timelines, ScrollTrigger scroll animations, SplitText, Flip, Draggable, MotionPath, Observer and the useGSAP React hook. Use when the user asks for GSAP, scroll-triggered/scrubbed/pinned animations, staggered reveals, timeline sequencing, text-split reveals, or complex motion that CSS transitions can't express.
---

# GSAP

Install: `npm install gsap @gsap/react --save-exact` (GSAP 3.13+ — **all plugins are free and included**, including SplitText, ScrollSmoother, MorphSVG, DrawSVG, Inertia, Physics2D. No club/bonus registry needed). CDN: `https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js` (+ `/dist/ScrollTrigger.min.js` etc.).

## React (always use `useGSAP`)

```jsx
import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText); // once, at module level

export default function Hero() {
  const root = useRef(null);
  useGSAP(() => {
    // selectors are scoped to `root`; everything is reverted on unmount
    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } });
    tl.from('.title', { y: 40, autoAlpha: 0 })
      .from('.card', { y: 30, autoAlpha: 0, stagger: 0.08 }, '-=0.4');

    gsap.to('.parallax', {
      yPercent: -20, ease: 'none',
      scrollTrigger: { trigger: '.parallax', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }, { scope: root });

  // event-handler animations: wrap with contextSafe so they are cleaned up too
  const { contextSafe } = useGSAP({ scope: root });
  const onEnter = contextSafe(e => gsap.to(e.currentTarget, { scale: 1.05 }));

  return <section ref={root}>…</section>;
}
```
Re-run on state: `useGSAP(fn, { scope, dependencies: [x], revertOnUpdate: true })`.

## Core API cheat sheet
- `gsap.to/from/fromTo/set(targets, vars)`; vars: `duration, delay, ease, stagger, repeat, yoyo, onComplete`, transforms `x, y, xPercent, rotation, scale`, `autoAlpha` (opacity + visibility).
- Timelines: `gsap.timeline()`, position param: `'<'` (with prev start), `'-=0.3'`, `'+=1'`, labels.
- Eases: `power1-4.in/out/inOut`, `expo`, `back.out(1.7)`, `elastic`, `'none'` for scrub.
- `gsap.matchMedia()` for responsive + reduced motion:
  ```js
  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', isDesktop: '(min-width: 768px)' }, ctx => { … });
  ```
- Utilities: `gsap.utils.toArray, clamp, mapRange, interpolate, wrap`, `gsap.quickTo` for cursor followers.

## ScrollTrigger
`scrollTrigger: { trigger, start: 'top 80%', end: 'bottom top', scrub: true|1, pin: true, toggleActions: 'play none none reverse', markers: true (debug only), once: true }`.
- Call `ScrollTrigger.refresh()` after images/fonts/layout change. Create triggers in page order (or set `refreshPriority`).
- Horizontal scroll section: pin the wrapper, tween the track `x: () => -(track.scrollWidth - window.innerWidth)`, `invalidateOnRefresh: true`.
- With **Lenis** smooth scroll: `lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);` (see the `lenis` skill).

## SplitText (v3.13+)
`SplitText.create(el, { type: 'lines,words,chars', mask: 'lines', autoSplit: true, onSplit: self => gsap.from(self.lines, { yPercent: 100, stagger: 0.1 }) })`. For **Arabic/RTL**, split by `words`/`lines` only — `chars` breaks letter joining.

## Rules
- Animate transforms and opacity, not `top/left/width/height`.
- Never create tweens in render; only inside `useGSAP`/`contextSafe`. No manual `kill()` needed inside `useGSAP`.
- Avoid `markers: true` in shipped code. Honor `prefers-reduced-motion`.
- SSR/Next: put animated components in `'use client'` files; register plugins client-side.

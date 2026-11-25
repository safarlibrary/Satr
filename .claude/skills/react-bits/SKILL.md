---
name: react-bits
description: Add animated React components from React Bits (215+ text animations, backgrounds, cursors, galleries, menus, micro-interactions). Use whenever building or polishing a React UI that needs an eye-catching hero, animated heading, animated background, gallery/carousel, dock/menu, cursor effect or micro-interaction — or when the user mentions React Bits, reactbits.dev, SplitText, Aurora, Silk, Galaxy, Dock, MagicBento, etc.
---

# React Bits

React Bits (github.com/DavidHDev/react-bits, MIT + Commons Clause) is a **copy-in** library: components are copied into the project's source, not imported from npm. You own and can edit the code.

## Add a component

```bash
bash .claude/skills/react-bits/scripts/add.sh <Name> [variant] [dest]
# variant: tailwind (default, JS+Tailwind) | content (JS+plain CSS) | ts-tailwind | ts-default
# dest default: src/components/reactbits
```

The script sparse-clones the GitHub repo (works even when reactbits.dev is blocked), copies the component folder, and prints the npm packages it imports — install them with `npm install <deps> --save-exact`.

If the script is unavailable (skill used outside this repo), do the same by hand:
`git clone --depth 1 --filter=blob:none --sparse https://github.com/DavidHDev/react-bits.git && git -C react-bits sparse-checkout set src/tailwind` then copy `src/tailwind/<Category>/<Name>/`.
With open network, the official CLI also works: `npx shadcn@latest add https://reactbits.dev/r/<Name>-JS-TW` (or `-JS-CSS`, `-TS-TW`, `-TS-CSS`).

## Choosing a component

Read `catalog.md` (same folder) for all names grouped by category with their npm deps. Categories:
- **TextAnimations** — SplitText, BlurText, ShinyText, GradientText, RotatingText, TextType, ScrollReveal, CountUp, DecryptedText…
- **Animations** — AnimatedContent, FadeContent, ClickSpark, Magnet, StarBorder, LogoLoop, TargetCursor, GlareHover…
- **Backgrounds** — Aurora, Silk, Galaxy, Particles, Threads, DotGrid, LiquidEther, Beams, Iridescence…
- **Components** — Dock, MagicBento, SpotlightCard, TiltedCard, CircularGallery, Carousel, CardSwap, PillNav, StaggeredMenu, Masonry…
- **Micro** — HoldButton, SquishSwitch, SwipeToast, FlipCard, PeekRating…

Before using a component, open the copied file and read its props (defaults at top of the function signature).

## Rules
- Match the variant to the project: Tailwind project → `tailwind`/`ts-tailwind`; else `content`/`ts-default`.
- Common deps: `gsap` + `@gsap/react`, `motion` (Framer Motion), `ogl`, `three` + `@react-three/fiber` + `@react-three/drei`, `matter-js`. Install only what the chosen component imports, pinned (`--save-exact`).
- Many use WebGL/canvas: give the parent an explicit size (`position:relative; height:…`), and keep 1–2 heavy backgrounds per page at most.
- RTL (Arabic) pages: text-splitting effects (SplitText, ScrambledText, DecryptedText) split per character and break Arabic letter joining — use `splitType="words"`/word mode or prefer BlurText (words), FadeContent, AnimatedContent, ScrollReveal for Arabic text.
- Respect `prefers-reduced-motion`: skip or shorten animations when it matches.
- Don't paste the whole library; add only the components used.

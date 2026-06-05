---
name: Mobile backdrop-filter GPU corruption
description: Android Chrome renders horizontal artifact lines and ghost/duplicate sections when backdrop-filter + GPU compositing layers are stacked — the fix and pattern to prevent recurrence.
---

# Mobile backdrop-filter GPU Corruption

## The Rule
Never use `backdrop-filter` on mobile (≤767px). Use solid/high-opacity backgrounds instead.

**Why:** Android Chrome's GPU compositor cannot cleanly stack multiple `backdrop-filter` elements. When `transform: translateZ(0)` or `isolation: isolate` on a parent element combines with `backdrop-filter` on children (especially `position: fixed` elements), the compositor produces horizontal artifact lines, ghost-rendered sections, overlapping content, and duplicate UI — visible on Android Chrome, invisible on desktop.

**How to apply:** Any time you add glass/frosted effects, modals, overlays, drawers, or navigation with `backdrop-filter`, wrap the declaration in `@media (min-width: 768px)` or add a mobile override that sets `backdrop-filter: none !important` with a solid opaque fallback background.

## Root causes in this project (fixed 2026-06-05)

1. `transform: translateZ(0)` on `.tt-main` created a GPU compositing layer that caused bleed-through from child backdrop-filter elements — **removed**.
2. Two stacked `position: fixed` elements both with `backdrop-filter` (the overlay + the sheet in layout.tsx) — classic Android Chrome compositor bug — **backdrop-filter removed from both**.
3. `.tt-float-dock` had `backdrop-filter: blur(40px) saturate(200%)` — always visible on mobile — **removed via media query**.
4. `.glass-card`, `.glass-panel`, `.premium-card` applied `backdrop-filter` globally — creating dozens of compositing layers per page — **disabled on mobile via media query**.
5. Inline `backdropFilter` in `dialog.tsx`, `auth-modal.tsx`, `policy-popup.tsx`, `chart.tsx`, `settings.tsx`, `demo.tsx` — **removed**.
6. Infinite animations (`.float`, `.pulse-glow`) running while backdrop-filter compositing was active worsened the corruption — **disabled on mobile**.

## The mobile override pattern (in index.css)

```css
@media (max-width: 767px) {
  .glass-nav, .glass-card, .glass-panel, .premium-card, .tt-float-dock {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: <solid-opaque-equivalent> !important;
  }
  .float { animation: none !important; }
  .pulse-glow { animation: none !important; }
}
```

## Safe solid replacements
- `backdrop-filter: blur(28px)` on nav → `rgba(5,8,22,0.98)` dark / `rgba(248,249,251,0.99)` light
- `backdrop-filter: blur(40px)` on dock → `rgba(5,8,22,0.97)` dark
- Modal overlay `backdrop-filter: blur(6px)` → `rgba(0,0,0,0.65)` (no filter)
- Modal content `backdrop-filter: blur(32px)` → rely on `--glass-bg-strong` which is already near-opaque

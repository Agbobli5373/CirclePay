# Profile page — premium polish

## What I changed
- **Added a confident page anchor.** The page now opens with a real `Profile` title (`text-3xl font-bold tracking-tight`) plus a muted subtitle — matching the Funds page. Previously it dove straight into the avatar card with no statement of where you are. The loading state now shows the same title (no jarring layout shift when data arrives).
- **Gave the Trust Score one focal point.** The standing label (e.g. "Good standing") is now the dominant line (`text-2xl font-bold`) with the check icon, instead of being buried in a small chip while three equal-weight stats competed. The section header dropped to a quiet uppercase meta label, so the *status* leads and the metrics support it.
- **Made the numbers trustworthy.** The three stats now use `tabular-nums` and sit in a hairline-divided row (`divide-x divide-border/70`) under a top rule — aligned, precise, finance-grade.
- **Subtracted color-as-ornament from the Security list.** Removed the three repeated `bg-primary/10` icon circles; icons now sit inline in muted `text-secondary`. The green accent is reserved for genuine status (trust segments, active toggles) instead of decorating every row.
- **Unified radii and structure.** The locked-account alert now uses the `cp-card` family (`rounded-3xl`) instead of a one-off `rounded-2xl`; the trust-score explainer lost its box-in-box muted fill and is now calm hairline-separated copy. Section labels use the app's uppercase-tracked meta style instead of `px-1` nudges.
- **Reused primitives.** Sign-out now uses `cp-btn-ghost` instead of a bespoke button. Tightened section rhythm to `space-y-8`, made icon-buttons round 40/32px hit areas, gave the Toggle a `bg-card` knob (was raw `bg-white`) and a visible `focus-visible` ring.

## Why it reads as premium now
- **Clarity:** there's a clear top-to-bottom order — title → identity → trust standing → security — and each card has a single thing the eye lands on first. Hierarchy is carried by size, weight, and space, so it survives in grayscale.
- **Deference & restraint:** removing the decorative icon chips and the inner muted box lets the accent mark only what matters, and the content (your name, standing, numbers) does the talking. Every change stays inside the existing `cp-*` classes and semantic tokens — no new colors, gradients, or shadows — so it looks like it always belonged.

## Verification
Behavior, data, imports, hooks, props, and the exported component name are unchanged — only markup/classes were touched. Compiled clean against the real project (`tsc --noEmit`, exit 0) via a throwaway route that was removed; the repo's `app/profile/page.tsx` was not modified.

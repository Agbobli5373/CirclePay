# Premium polish — pre-finish audit

Run this before declaring a redesign done. It catches the small misses that separate "fine" from
"premium". Don't treat it as boxes to tick blindly — each item is a question; if the answer is "no",
fix it or have a reason.

## Hierarchy & focus
- [ ] Does the view open with a **confident page title/anchor** (not a small grey line)? Subtitle sits
      under it, not instead of it?
- [ ] Is there **one** clear focal point? Does the eye land on the right thing first?
- [ ] Exactly **one** primary action in view? Secondary actions visibly quieter?
- [ ] Could you tell the importance order with color removed (grayscale)? Hierarchy should survive on
      size/weight/space alone.

## Typography
- [ ] Only ~3–4 type sizes on the screen? Clear jumps between levels (no near-duplicate sizes)?
- [ ] Secondary text uses a muted color *and* smaller size (two channels, one clear step down)?
- [ ] Money/data right-aligned and `tabular-nums`? Currency/label paired with the amount, not uniform?
- [ ] Large headings `tracking-tight`; body `leading-relaxed`; text not cramped?

## Spacing & alignment
- [ ] Padding/gaps from a consistent step scale (4/8/12/16/24/32)? No random 13px/15px gaps?
- [ ] Tight within groups, generous between groups (proximity communicates grouping)?
- [ ] Everything shares alignment edges? Consistent corner radii from one family?
- [ ] Cards/sections have room to breathe (not airless, not aimlessly empty)?

## Color & depth
- [ ] One accent, used only for the important action/status? No second loud color?
- [ ] Structure via hairlines + padding, not heavy borders or a shadow on everything?
- [ ] Any shadow soft, low, singular (or none)? Consistent with the app's flat/elevated choice?
- [ ] On-palette (semantic tokens / accent tints), no stray raw hex?

## States (the premium tell)
- [ ] Empty state designed (calm copy + a next action), not a blank gap?
- [ ] Loading reserves layout (sized spinner or matching skeletons) — no layout shift on data arrival?
- [ ] Error is plain-language with a recovery path — no raw codes?
- [ ] Long/edge content tested (long names, big numbers, many rows, zero rows)?

## Motion
- [ ] Motion is subtle + fast (150–200ms ease-out) or absent? No parallax/stagger/loops/scroll-jacking?
- [ ] Non-essential motion guarded by `motion-safe:` / `prefers-reduced-motion`?

## Accessibility & responsive
- [ ] Semantic elements; visible focus on every interactive control?
- [ ] Text contrast ≥ 4.5:1 (incl. muted secondary)? Icon-only buttons have `aria-label`?
- [ ] Touch targets ≥ 44px? Layout holds at ~375px mobile width?

## Consistency (don't ship a beautiful outlier)
- [ ] Matches the app's existing tokens, components, radii, and spacing — looks like it always belonged?
- [ ] No behavior, data, or props changed just to restyle?

## The gut check
- [ ] Did you **remove** at least as much as you added?
- [ ] Does it feel calm and confident — or busy and trying-hard? Premium is quiet.

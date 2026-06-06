# Craft — concrete recipes (React / Next.js + Tailwind)

The *how*. These are defaults and patterns, not laws — adapt to the project's tokens. Tailwind classes
shown; translate to the project's scale/variables where they exist.

## Typography — the hierarchy engine

Premium hierarchy is mostly type. Use a **small, deliberate scale** with clear jumps, not a smooth
ramp where every size is 1px apart.

- **Give the view a real title.** Open with a confident page/section title (e.g. `text-2xl`/`text-3xl
  font-bold tracking-tight`) so the user instantly knows where they are. A descriptive subtitle goes
  *under* it in muted secondary text — not *instead* of it. Don't demote the title to a small grey
  line; an under-sized heading is the most common "looks unfinished" tell.

- A workable scale: `text-xs` (12) labels/meta · `text-sm` (14) secondary/body-dense · `text-base` (16)
  body · `text-lg`/`text-xl` section titles · `text-2xl`–`text-4xl` page title / hero number. Most
  screens need only **3–4 of these**. If you see 6 sizes, collapse them.
- Weight does heavy lifting: `font-semibold`/`font-bold` for emphasis, `font-medium` for labels,
  `font-normal` for body. Avoid making everything semibold — then nothing stands out.
- Large headings: tighten with `tracking-tight`. Body: comfortable `leading-relaxed`; never cram lines.
- Secondary text is quieter (a muted/secondary token), not just smaller. Two channels (size + color)
  read as one clear step down.
- **Numbers / money / tables:** right-align and use tabular figures so digits line up:
  `class="tabular-nums"` (or `font-variant-numeric: tabular-nums`). Misaligned currency is an instant
  tell. Pair a large amount with a smaller, muted currency/label rather than one uniform string.

## Spacing — rhythm, not vibes

- Stick to a step scale (multiples of 4): `gap-2 gap-3 gap-4 gap-6 gap-8` and matching `p-*`. Use
  Tailwind's `space-y-*` / `gap-*` for consistent rhythm between siblings.
- **Proximity = meaning.** Tighten space *within* a group (label + value), widen it *between* groups.
  Most "cluttered" screens just need more space between groups and less inside them.
- Give content room: cards `p-5`/`p-6`, page gutters `px-4` mobile → `px-8`/`px-10` desktop, sections
  separated by `space-y-6`/`space-y-8`. Cramped padding is the #1 cheap signal.
- Cap line length for readable text (`max-w-prose` / `max-w-2xl`). Full-width paragraphs feel unread.

## Color — discipline

- **One accent.** It marks the single most important action or a key status. Everything else is
  foreground / secondary / muted neutrals + borders. A second saturated color almost always cheapens.
- Use opacity tints of the accent for soft surfaces (`bg-primary/5`, `bg-primary/10`, `border-primary/40`)
  instead of new colors — quieter and automatically on-palette.
- Status colors (success/warn/danger) are functional, not decorative. Prefer a tinted chip
  (`bg-amber-500/15 text-amber-600`) over a loud solid fill for inline status.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1. Muted secondary text must still clear 4.5:1 — "subtle"
  never means unreadable.

## Depth & structure — hairlines first

- Default to a **1px border** (`border border-border`) + padding to define a surface. It's calmer and
  more precise than a shadow.
- If you need lift (menus, sheets, the one hero card), use a **single soft shadow**, low and diffuse:
  `shadow-sm`/`shadow-md` — never stacked or dark. Flat-with-hairlines is a perfectly premium house style.
- Separate list rows with a hairline divider (`divide-y divide-border/70`) rather than boxing each row.
- Consistent corner radii from the token scale (e.g. `rounded-xl`/`rounded-2xl`/`rounded-full`). Don't
  mix many radii on one screen; pick the family and stay in it.

## Components — the usual suspects

- **Buttons:** one primary (solid accent) per view; secondary is quieter (ghost/outline); destructive
  only where truly destructive. Comfortable height (≥44px target), `rounded-full` or `rounded-xl` per
  house style, clear hover/active/disabled. Don't ship three equally-loud buttons.
- **Cards:** a title row, generous padding, clear internal hierarchy; let one number/element dominate.
- **Inputs:** tall enough to tap, clear label, visible focus ring (`focus:ring-4 ring-primary/15`),
  helpful placeholder, inline validation. Group with consistent vertical rhythm.
- **Lists/tables:** align columns; right-align numbers; quiet zebra/hairlines; a designed empty row.
- **Chips/badges:** small, `rounded-full`, tinted; for status/metadata, not emphasis.

## States — design all of them

A screen isn't done until these exist and look intentional:
- **Empty:** a calm line of copy + one clear next action (and maybe a small icon). Not a blank void.
- **Loading:** reserve layout to avoid shift — a centered spinner in a sized container, or skeletons
  that match the real content's shape. Never let the page jump when data arrives.
- **Error:** plain-language message + a way to recover (retry / go back). No raw codes in the user's face.
- **Success/confirmation:** brief, calm acknowledgement; don't over-celebrate.

## Motion — subtle, fast, optional

- Transition only what changes, briefly: `transition-colors`/`transition-transform` at **150–200ms**,
  `ease-out`. Hover/press feedback, a sheet fade/scale, a chevron rotate. That's the whole budget.
- Sheets/menus: short fade + small translate or scale (e.g. from `scale-95 opacity-0`). No big travel.
- Always guard: wrap non-essential motion in `motion-safe:` (Tailwind) or honor
  `@media (prefers-reduced-motion: reduce)`. No autoplay loops, parallax, scroll-jacking, or staggered
  entrances. Zero motion is a valid, premium choice.

## Accessibility (part of premium, not separate)

- Semantic elements (`button`, `nav`, `main`, `label`+`htmlFor`); don't make a `div` a button.
- Visible focus states on every interactive element (don't remove outlines without replacing them).
- Touch targets ≥ 44×44px. Icon-only buttons get an `aria-label`.
- Respect `prefers-reduced-motion` and `prefers-color-scheme` if the app supports themes.

## Quick worked example (cheap → premium)

Before — flat hierarchy, boxed rows, cramped, two accents:
```tsx
<div className="border rounded p-2">
  <p className="text-base font-semibold text-blue-600">Total saved</p>
  <p className="text-base font-semibold text-green-600">GHS 1200</p>
  <div className="border rounded p-2 mt-1"><p className="text-base">Kofi — GHS 200</p></div>
  <div className="border rounded p-2 mt-1"><p className="text-base">Ama — GHS 200</p></div>
</div>
```
After — one accent, type hierarchy, hairline rows, rhythm, aligned numbers:
```tsx
<section className="cp-card p-6 space-y-5">
  <div>
    <p className="text-sm font-medium text-secondary">Total saved</p>
    <p className="text-3xl font-bold tracking-tight tabular-nums">GHS 1,200.00</p>
  </div>
  <ul className="divide-y divide-border/70">
    <li className="flex items-center justify-between py-3">
      <span className="text-sm text-foreground">Kofi</span>
      <span className="text-sm font-semibold tabular-nums">GHS 200.00</span>
    </li>
    <li className="flex items-center justify-between py-3">
      <span className="text-sm text-foreground">Ama</span>
      <span className="text-sm font-semibold tabular-nums">GHS 200.00</span>
    </li>
  </ul>
</section>
```
The win isn't new decoration — it's hierarchy (one dominant number), restraint (one accent, neutrals
elsewhere), rhythm (consistent spacing), and precision (aligned, formatted money).

# CirclePay design system — extend this, don't fork it

The house style is **calm, flat, rounded, single-accent.** Premium work here means tightening within
this language. Source of truth: `frontend/app/globals.css` (Tailwind v4, `@theme inline`). Re-read it
if anything below looks stale.

## Tokens (use the semantic names, not raw hex)

| Token | Value | Use |
|---|---|---|
| `background` | `#F5F3ED` (warm cream) | app background — never pure white |
| `foreground` | `#1C1917` (near-black) | primary text |
| `card` | `#FFFFFF` | cards, sidebar, inputs (the white plane over cream) |
| `primary` | `#1D9E75` (green) | **the one accent** — primary action, key figures, progress, active nav |
| `primary-foreground` | `#FFFFFF` | text on primary |
| `secondary` | `#78716C` (stone) | muted/secondary text, meta |
| `muted` | `#E7E3DC` | quiet fills, progress track, avatar bg |
| `border` | `#E7E3DC` | hairlines (same as muted — borders are deliberately soft) |
| `destructive` | `#DC2626` | errors, danger, the "Medical" tag |
| `--radius` | `1rem` (16px) | base radius; cards use `rounded-3xl`, controls `rounded-xl`/`rounded-full` |

Font: **Inter** (`--font-sans`). Use `tabular-nums` for money. Tailwind classes map to these tokens
(`text-foreground`, `text-secondary`, `bg-card`, `bg-muted`, `border-border`, `bg-primary`, `text-primary`,
`bg-primary/10`, `text-destructive`, …). Prefer accent tints (`bg-primary/5`, `/10`, `/15`) over new colors.

## Component classes (in `globals.css @layer components`) — reuse before inventing

- `cp-card` — `rounded-3xl border border-border bg-card` (**flat, no shadow** — the signature look).
- `cp-card-interactive` — adds `hover:border-primary/50` for clickable cards.
- `cp-btn-primary` — `h-12 px-7 rounded-full bg-primary` solid CTA; `disabled:bg-muted`.
- `cp-btn-ghost` — `h-12 rounded-full border-2 border-border bg-card` secondary action.
- `cp-pill` — small `rounded-full bg-muted text-secondary` chip for metadata.
- `cp-input` / `cp-textarea` — `rounded-xl border-2`, focus `border-primary` + `ring-4 ring-primary/15`.
- `cp-gradient` — **flat `var(--primary)` fill** (legacy name; it is NOT a gradient). Used on the hero/
  balance block. Keep it flat — the PRD calls for **no gradients**.

When a screen needs something new, build it from these primitives and tokens so it looks native to the
app. If you find yourself reaching for a raw hex, a drop shadow, a second bright color, or a gradient,
stop — that's drifting off-style.

## House rules (the CirclePay "feel")

- **Flat, not shadowed.** Structure with hairlines (`border-border`, `divide-border/70`) + padding.
  Avoid drop shadows except a genuine overlay (menu/sheet); even then keep it soft.
- **One accent: green.** Money figures, the primary CTA, progress fills, active state. Red is reserved
  for destructive/medical. Amber only for a pending/warning chip. Never add a new brand color.
- **Cream canvas, white cards.** The cream background + white `cp-card` is the depth model. Don't put
  white on white or box things inside boxes.
- **Rounded + generous.** `rounded-2xl`/`3xl` cards, `rounded-full` controls/chips, roomy padding
  (`p-5`/`p-6`), section rhythm `space-y-6`/`8`.
- **Money is the hero.** Format with `formatGhs` (from `@circlepay/shared`), big + bold + `tabular-nums`;
  pair with a small muted label. This is a finance app — the numbers should feel trustworthy and precise.
- **Trust cues stay quiet.** "Powered by Moolre", verification badges, etc. are small and calm —
  reassurance, not noise.
- **Mobile-first.** Most users are on a phone; check the layout at ~375px and ensure ≥44px tap targets.

## Already-polished references to match

These screens set the bar — open one before redesigning so your work is consistent:
- `frontend/app/page.tsx` — dashboard (greeting, hero balance block, cards + activity rail).
- `frontend/app/f/[slug]/page.tsx` — public donate page (standalone shell, max-w-2xl, trust footer).
- `frontend/components/app-shell.tsx` — sidebar/topbar chrome, spacing, active states.

## Known house quirks (don't "fix" as bugs)
- `cp-gradient` is intentionally a flat fill (no gradient) — leave it flat.
- Cards are intentionally shadow-less. "Add a shadow to lift the card" is usually the wrong move here;
  prefer a hairline and spacing.

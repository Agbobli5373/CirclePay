# Activity page — premium redesign

## What I changed
- **One surface, not box soup.** Replaced the stack of individually-bordered `cp-card` rows with a
  single `cp-card` whose rows are separated by hairlines (`divide-y divide-border/70`) — the same row
  pattern the dashboard already uses. The page now reads as one calm plane instead of N competing boxes.
- **Grouped the timeline by day** (Today / Yesterday / Earlier this week / month / older), with a quiet
  uppercase `text-xs` section label. Grouping is purely presentational — it walks the existing
  newest-first list in order and never reorders or drops items.
- **Money now aligns.** Amounts and the relative timestamp use `tabular-nums` so digits line up
  column-to-column down the right rail; kept the single green accent for incoming (`+`), neutral
  `foreground` for outgoing (`−`).
- **Calmer icon language.** Dropped the second green tint on contributions so green marks only money
  *in* (payouts) and the primary CTA; contributions/joins recede to neutral `bg-muted`, donations keep
  the reserved `destructive` tint. One accent, used with intent.
- **Segmented filter.** Swapped the loose row of bordered pills for a single rounded segmented control
  (`role="tablist"` + `aria-selected`, equal-width tabs) that sits cleanly on the cream canvas, with a
  visible `focus-visible` ring.
- **Designed states.** Loading is now a 6-row skeleton matching the real row shape (no layout shift on
  arrival) instead of a bare centered spinner; error and empty are centered cards with calm copy, and
  empty offers one clear next action ("Go to my funds"). Folded the long `Ref:` line into the muted
  meta row with `truncate` so a long reference can't blow out the layout.
- Tightened the container to `max-w-2xl` with an 8-pt rhythm (`space-y-8` between zones, `space-y-3`
  within a group), `tracking-tight` on the page title, and per-row `truncate` for long names.

## Why it reads as premium now
- **Clarity & deference:** one white surface with hairline rows lets the user's names and amounts be
  the stars; chrome recedes. Day headers and aligned, tabular money give the eye an instant hierarchy
  and an order to scan, instead of a flat wall of equal-weight rows.
- **Restraint:** fewer boxes, one accent (green = money-in / primary action only), a single segmented
  control, and a consistent 8-pt spacing rhythm. Nothing was added for decoration — the redesign mostly
  *removes* (per-row borders, the duplicate accent, the raw spinner and bare empty line) and the
  finished loading/empty/error states are the strongest "real product, not a demo" signal.
- Same data, hooks, imports, props, and exported component — verified with a clean `tsc` pass against
  the real repo types. Only markup/classes changed.

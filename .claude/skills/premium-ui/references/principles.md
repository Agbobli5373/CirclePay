# Design principles — the philosophy behind "premium"

This is the *why*. The craft file is the *how*. Internalize these mental models so your decisions are
coherent rather than a checklist.

## What actually makes UI feel premium

People read "premium" as *expensive, trustworthy, effortless.* Those feelings come from a few sources,
roughly in order of impact:

1. **Hierarchy you feel instantly.** In a premium screen your eye lands on the one important thing
   immediately, then flows in a deliberate order. Cheap screens are flat — everything shouts, so
   nothing does. You create hierarchy with **size, weight, and space first**; color and decoration last.
2. **Restraint.** Few type sizes, one accent color, lots of breathing room, no ornament that isn't
   doing a job. Restraint signals confidence; clutter signals insecurity. The hardest, most valuable
   move is *removing* things.
3. **Precision.** Everything aligns. Radii match. Icons are optically sized to their text. Spacing
   follows a rhythm. Sub-pixel sloppiness — a 13px gap here, 15px there, a slightly-off baseline — is
   subconsciously read as "cheap" even by people who can't name why.
4. **Calm.** Premium products feel quiet. Low-contrast structure (hairlines, soft neutrals), gentle or
   no motion, muted secondary text. The user's content provides the energy; the UI stays out of the way.
5. **Finish.** The unglamorous states — empty, loading, error, the edge cases — are handled with the
   same care as the happy path. This is where "looks like a demo" becomes "looks like a product."

## Apple's three principles, expanded

**Clarity.** Text is legible at every size, icons are precise, adornment is subtle, and a sharpened
focus on functionality motivates the design. Negative space, color, fonts, and graphics highlight the
important content and convey hierarchy. Practically: one focal point per view; one primary action;
secondary actions visibly quieter; never make the user hunt for the point of the screen.

**Deference.** Content is king; the UI is the frame, not the picture. Fluid motion and a crisp,
unobtrusive interface help people understand and interact with content without competing with it.
Practically: chrome recedes (light borders, restrained fills), the user's data is the most prominent
thing, and whitespace is used generously to let content breathe.

**Depth.** Distinct visual layers and realistic motion convey hierarchy, impart vitality, and aid
understanding. Transitions provide a sense of place. Practically: use layering (a sheet over a dimmed
background, a card lifted by a hairline + faint shadow) to show relationships — not to decorate. Motion
is a courtesy that orients the user, kept subtle and fast.

## Taste heuristics (when unsure, prefer the first option)

- Subtract over add. Quiet over loud. Neutral over colorful. Aligned over "close enough."
- Type/space for hierarchy over borders/boxes for hierarchy.
- One strong accent over a rainbow. One primary button over three equal buttons.
- Hairline + padding over heavy border. Soft single shadow over stacked shadows. Flat over glossy.
- Consistent with the rest of the app over locally clever.
- Real content widths and lengths (long names, GHS 1,234,567.00, empty lists) over lorem-ipsum-perfect.

## Reading the room: don't over-restyle

The goal is to elevate, not to impose a personal style. If the app already has a calm, consistent
language (most do once a design system exists), premium work is mostly **tightening**: fixing spacing
rhythm, collapsing redundant type sizes, calming an over-eager color, designing the missing states,
aligning things. A dramatic visual overhaul is rarely what "make it premium" means — and it risks
making the screen inconsistent with everything around it, which is itself un-premium.

## Anti-patterns that read as "cheap" (watch for these)

- Many font sizes/weights with weak contrast between them (everything ~16px semibold).
- Multiple accent colors competing; status colors used decoratively.
- Heavy borders everywhere, or a drop shadow on every element ("box soup").
- Inconsistent padding and gaps; elements not sharing an alignment edge.
- Tight, airless layouts (no breathing room) — or the opposite, aimless empty space with no rhythm.
- Centered long-form text; numbers that don't right-align in tables.
- Emoji as UI icons; mismatched icon sizes/weights; icons not aligned to text baseline.
- Placeholder/"coming soon" states left raw; spinners with no layout; jarring layout shift on load.
- Gratuitous motion (things sliding/bouncing on every render) — distracting, and it ages badly.

# DateField — SVG mask arrow (future)

**Date:** 2026-05-08
**Status:** Backlog — out of scope for current project, closer to application-level work

## Problem

The current CSS arrow (`<div class="arrow">`) is a separate element with its own `background: var(--df-calendar-bg)`. When `--df-calendar-bg` is semi-transparent (frosted glass), the arrow and calendar surface composite independently, creating a visible seam where they overlap. There is also limited control over arrow curve/radius.

## Goal

Replace the CSS div arrow with a **unified surface** — one visual shape covering both the calendar rectangle and the arrow bump. No seam, no double transparency, full control over curvature.

## Proposed approach: JS-updated SVG mask

`CalendarSurface` gets a `mask="url(#df-calendar-mask)"` that defines the full shape. JS already calculates the arrow's X position in `_updateLayout()` — it extends that to write a bezier path string into the SVG mask's `<path d="...">`.

The path is a rounded rectangle (matching `--df-calendar-radius`) with an arrow bump at the correct horizontal position. Corners and arrow tip use cubic bezier curves, giving full radius control.

```
Normal:        ╭───────────────╮
               │               │
               │               │
               ╰───────▲───────╯

Near left:     ╭───────────────╮
               │               │
               │               │
               ◣───────────────╯

Near right:    ╭───────────────╮
               │               │
               │               │
               ╰───────────────◢
```

## Edge cases to design

| Case | Behaviour |
|---|---|
| Arrow in safe zone (top) | Standard symmetric arrow, full bezier tip |
| Arrow in safe zone (bottom) | Same, mirrored |
| Arrow near left edge | Arrow curve interpolates into left corner radius |
| Arrow near right edge | Arrow curve interpolates into right corner radius |
| Arrow at extreme left | Fully merged with corner — no distinct arrow |
| Arrow at extreme right | Fully merged with corner — no distinct arrow |

The corner-merge is handled geometrically: as arrow X approaches the corner radius boundary, the bezier handles for arrow and corner converge to the same control points. No hard clamp needed.

## Why not CSS-only

- `clip-path: polygon()` supports CSS variables but no curves → no rounded arrow tip
- `clip-path: path()` supports curves but not CSS variables → JS needed anyway
- SVG filter (gooey) requires `filter` on parent → breaks `backdrop-filter` on `CalendarSurface`

## Integration points

- `_updateLayout()` in `DateField.ts` already calculates arrow offset — extend to write SVG path
- `--df-calendar-radius` needs to be read via `getComputedStyle` to incorporate into path
- Arrow token `--df-arrow-size` drives the bump height
- `<svg>` with `<defs><mask>` injected once on init, path updated on each layout recalc
- CSS div `.arrow` and its CSS rules are removed

## References

- https://ishadeed.com/article/thinking-about-the-cut-out-effect/
- https://www.joshwcomeau.com/css/backdrop-filter/

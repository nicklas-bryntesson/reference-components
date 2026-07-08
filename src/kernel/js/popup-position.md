# popup-position (kernel / pure functions)

Pure geometry helpers for positioning a popover bubble on a horizontal slide rail and pointing its
arrow at the trigger. No DOM, no side effects — the component reads rects and applies the results.

## Public API

```ts
// % offset of the bubble along the rail, clamped so it never overflows the viewport.
calculatePopupOffset(
  triggerCenterX, containerLeft, containerWidth, popupWidth,
  viewportWidth = window.innerWidth, viewportInset = 0,
): number

// px correction so the arrow points at the trigger centre, clamped to stay within the
// bubble's rounded corners.
calculateArrowOffset(
  triggerCenterX, popupLeft, popupWidth, borderRadius, arrowSize,
): number

// 'top' | 'bottom' — which side has more room. Ties go to 'top'.
detectDirection(
  triggerRect: { top, bottom }, viewportHeight = window.innerHeight,
): 'top' | 'bottom'
```

## Semantics

- `calculatePopupOffset` returns a **percentage** of `containerWidth` (the rail), not pixels — when
  the bubble can't fit either edge it centres on the viewport instead.
- `calculateArrowOffset` clamps to `popupWidth/2 - borderRadius - arrowSize/2` so the arrow never
  detaches from a rounded corner.
- `detectDirection` only compares available space; the component decides what to do with the result.

## Known limitations

**Clipping in overflow ancestors.** The popup is positioned in normal flow (`position:
absolute` + these offsets), so any ancestor with `overflow: hidden | auto | scroll` — a
scroll container, a table cell that scrolls — clips or scrolls it. This is inherent to
absolute-in-flow positioning and affects every popover component (ToggleTip + the date/time
family). The escape is to render the popup in the **top layer** (the Popover API) or a
**portal** to `document.body` (`position: fixed` + reposition-on-scroll) — but *which*
escape, and the feature-detection / browser-baseline policy around it, is the **consuming
project's** call (it differs per stack: Tailwind `supports-[…]`, a React conditional, a plain
`@supports`). This module keeps the maths portable and documents the limit; it does not bake
in a top-layer strategy. See [ADR-0012](../../../docs/adr/0012-popover-clipping-is-a-documented-limitation.md).

## Conformance

Black-box: [`tests/popup-position.unit.test.ts`](tests/popup-position.unit.test.ts). Port the three
functions, run this suite against your implementation.

Consumed by: DateField, DateTimeField, TimeField, MonthField, WeekField, ToggleTip.

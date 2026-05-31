# Onboarding

## Popover architecture

Four components share one popover/positioning model. If you touch one, keep it consistent with the others — they drift easily because they were built by copy-paste.

### The components and who's the reference

| Component | Popup is a… | Role |
|---|---|---|
| **ToggleTip** | tooltip bubble | **reference for the popover mechanics** (positioning, dismiss model) |
| **DateField** | calendar | **reference for the segment-field family** (native fallback, segments, value sync) |
| **DateTimeField** | calendar + time columns | follows DateField |
| **TimeField** | 3D wheel columns (see `WheelColumn.ts`) | follows DateField |

Files: `src/partials/components/<Name>/<Name>.{ts,css}`. Shared math: `src/js/popup-position.ts`.

### Shared positioning module — `src/js/popup-position.ts`

Three pure functions, used by all four:

- `calculatePopupOffset(triggerCenterX, containerLeft, containerWidth, popupWidth, viewportWidth, viewportInset)` → `%` offset along the rail, clamped so the popup never overflows the viewport.
- `calculateArrowOffset(triggerCenterX, popupLeft, popupWidth, borderRadius, arrowSize)` → `px` correction so the arrow points at the trigger, clamped inside the rounded corners.
- `detectDirection(triggerRect, viewportHeight)` → `'top' | 'bottom'` (ties go to `top`).

### How positioning is wired (the "slide rail" model)

CSS Anchor Positioning isn't used (browser support). Instead each component positions a popup manually:

1. A `.slideContainer` element is the horizontal rail (full-viewport-width, centered on the component, `pointer-events: none`).
2. On open, `_updateLayout()` measures the trigger + rail + popup, calls the three shared functions, and writes two CSS custom properties on the root:
   - `--<prefix>-popup-offset` (a `%`) — where the popup sits along the rail.
   - `--<prefix>-arrow-offset` (a `px`) — where the arrow points.
3. `data-direction="top|bottom"` is set on the root; CSS flips the popup above/below accordingly.
4. Resize is handled by `_handleResize`, **rAF-throttled** (cancel pending frame, schedule one), recomputing only while open.

`<prefix>` is per component: `--tt-*` (ToggleTip), `--df-*` (DateField), `--dtf-*` (DateTimeField), `--tf-*` (TimeField).

#### `_getCSSPx(property)` — resolving design tokens to px

Arrow size / corner-radius / site-padding are CSS custom properties (e.g. `--_tf-arrow-size`), scoped to the **component root**. To read them as numbers, each component has a `_getCSSPx` helper that appends a hidden probe `<div>` with `width: var(<property>, 0px)` and measures it.

> **Gotcha (already bit us):** the probe MUST be appended to `this.root`, not `document.body`. The tokens are component-scoped, so a probe on `body` resolves them to the `0px` fallback — silently zeroing the viewport inset and arrow clamp. (TimeField also used to hardcode `4`/`8` instead of reading tokens — fixed.)

### Naming conventions (keep these aligned)

| Thing | Convention | Notes |
|---|---|---|
| Popup container class | `.<Component>-popup` | e.g. `.DateField-popup`, `.TimeField-popup` (and its BEM children `.TimeField-popup-*`) |
| Rail class | `.slideContainer` | generic, scoped by nesting under the component root |
| Arrow class | `.arrow` | generic; **must be nested under the component root in CSS** or it leaks globally |
| Trigger class | `.<Component>-trigger` | ToggleTip is a bare `<button>` (fine for a tooltip) |
| Direction | `data-direction="top\|bottom"` | not a bare `direction` attribute |
| Offset vars | `--<prefix>-popup-offset`, `--<prefix>-arrow-offset` | set from JS |

### Dismiss & focus

- **Light dismiss (outside click):** a `document` click listener (registered via `setTimeout(…, 0)` so it doesn't catch the opening click) closes the popup **without** refocusing the trigger — `_closeCalendar(false)` / equivalent.
  > **Gotcha (already bit us):** calling `.focus()` on the trigger during outside-click close scrolls the viewport back to an off-screen trigger and steals focus from whatever the user clicked. Only refocus on **keyboard/Escape** close.
- **Keyboard / Escape close:** refocuses the trigger (`refocusTrigger = true`, the default) — correct WAI-ARIA behavior.
- **aria-expanded** is managed on the trigger (`false`/`true`) for the field components.

### Native fallback on touch (`data-input-mode`)

Segment fields keep their custom look on touch but defer interaction to the native input. DateField is the reference.

- `_init()` checks `window.matchMedia('(pointer: coarse)')`.
- **`custom`** (fine pointer): native input is a hidden value carrier; the overlay/segments are the interactive UI.
- **`display`** (coarse pointer): the styled overlay stays visible but `pointer-events: none` and decorative (`aria-hidden`); the native input becomes a transparent full-size layer on top (`position:absolute; inset:0; opacity:0`) that fires the platform picker on tap and is the accessible control.

To verify: emulate a touch viewport, then `document.elementFromPoint(center)` should return the native `<input>` in display mode.

### One deliberate difference (not drift)

ToggleTip **keeps** its popup in the DOM and toggles visibility via `aria-hidden` + `display:none`; the three fields **remove + clone** from a `<template>` on each open (their content is rebuilt anyway). ToggleTip also has no Escape/focus-management (it's a tooltip, not a dialog) — that's correct, not drift.

### State partials

Components with many HTML variants generate `states/*.hbs` from `<Name>.generate.ts` (gitignored build artifacts — never edit by hand). When you change popup markup, edit `canonical()` in the generator and run `npm run generate:states`.

# Onboarding

## Popover architecture

Six components share one popover/positioning model. If you touch one, keep it consistent with the others — they drift easily because they were built by copy-paste.

### The components and who's the reference

| Component | Popup is a… | Role |
|---|---|---|
| **ToggleTip** | tooltip bubble | **reference for the popover mechanics** (positioning, dismiss model) |
| **DateField** | calendar | **reference for the segment-field family** (native fallback, segments, value sync) |
| **DateTimeField** | calendar + time columns | follows DateField |
| **TimeField** | 3D wheel columns (see `WheelColumn.ts`) | follows DateField |
| **MonthField** | month + year wheel columns | follows TimeField |
| **WeekField** | calendar with selectable week rows + week-number column | follows DateField |

Files: `src/partials/components/<Name>/<Name>.{ts,css}`. Shared math: `src/kernel/js/popup-position.ts`.

### Shared positioning module — `src/kernel/js/popup-position.ts`

Three pure functions, used by all six:

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

`<prefix>` is per component: `--tt-*` (ToggleTip), `--df-*` (DateField), `--dtf-*` (DateTimeField), `--tf-*` (TimeField), `--mf-*` (MonthField), `--wf-*` (WeekField).

#### `_getCSSPx(property)` — resolving design tokens to px

Arrow size / corner-radius / site-padding are CSS custom properties (e.g. `--_tf-arrow-size`), scoped to the **component root**. To read them as numbers, each component has a `_getCSSPx` helper that appends a hidden probe `<div>` with `width: var(<property>, 0px)` and measures it.

> **Gotcha (already bit us):** the probe MUST be appended to `this.root`, not `document.body`. The tokens are component-scoped, so a probe on `body` resolves them to the `0px` fallback — silently zeroing the viewport inset and arrow clamp. (TimeField also used to hardcode `4`/`8` instead of reading tokens — fixed.)

### Naming conventions (keep these aligned)

| Thing | Convention | Notes |
|---|---|---|
| Popup container class | `.popup` | the same word in every component; the CSS rule is always fully qualified — `.DateField .popup`, `.TimeField .popup` |
| Rail class | `.rail` | same word everywhere; the JS property is `_rail` |
| Arrow class | `.arrow` | same word everywhere |
| Trigger class | `.trigger` | ToggleTip is a bare `<button>` (fine for a tooltip) |
| Every element rule | `.Component .element` | **never a bare `.element` at column 0** — generic names are only safe because the root qualifies them. See the class-naming section in [`.claude/philosophy.md`](.claude/philosophy.md) |
| Direction | `data-direction="top\|bottom"` | not a bare `direction` attribute |
| Orientation | `data-orientation="horizontal\|vertical"` | same word and values in every component that has a direction of flow (ChoiceGroup, Picklist) |
| Offset vars | `--<prefix>-popup-offset`, `--<prefix>-arrow-offset` | set from JS |
| Boolean vs enum `data-*` | run the orthogonality test | **boolean** if the axis is independent and stacks (`data-invalid`, `data-emphasis`, `data-segmented`); **enum** if the values are mutually exclusive on one axis (`data-legend`, `data-orientation`, `data-variant`). See the `data-*` section in [`.claude/philosophy.md`](.claude/philosophy.md) |
| Naming a `data-*` | after what it **is**, not how it works | `data-emphasis` not `elevated`; `data-segmented` not `data-flush`/`data-joined`. A design *value* (radius, colour) is a `--_*`/`--ui-*` token, not an attribute |

> **Gotcha (already bit us):** the same rule applies to **e2e locators**. `page.locator('.popup')` matches every component's popup on the shared kitchensink page — always scope to the suite's root constant: `page.locator(\`${TF} .popup\`)`. The only page-wide locators should be ones qualified by a component class on purpose (e.g. targeting the disabled kitchensink row).

### Dismiss & focus

- **Light dismiss (outside click):** a `document` click listener (registered via `setTimeout(…, 0)` so it doesn't catch the opening click) closes the popup **without** refocusing the trigger — `_closeCalendar(false)` / equivalent.
  > **Gotcha (already bit us):** calling `.focus()` on the trigger during outside-click close scrolls the viewport back to an off-screen trigger and steals focus from whatever the user clicked. Only refocus on **keyboard/Escape** close.
- **Keyboard / Escape close:** refocuses the trigger (`refocusTrigger = true`, the default) — correct WAI-ARIA behavior.
- **aria-expanded** is managed on the trigger (`false`/`true`) for the field components.
- **Focus on open (family rule):** calendar-grid popups (DateField, DateTimeField, WeekField) move focus into the grid on open; wheel-only popups (TimeField, MonthField) keep focus on the trigger — the user Tabs into the wheels. Both are deliberate: a grid has an obvious "current day" to land on, a wheel stack doesn't.
- **Focus trap + wheel-scroll containment** inside the open popup is a shared kernel primitive — see `src/kernel/js/popup-interaction.md`.

### Native fallback on touch (`data-input-mode`)

Segment fields keep their custom look on touch but defer interaction to the native input. DateField is the reference.

- `_init()` checks `window.matchMedia('(pointer: coarse)')`.
- **`custom`** (fine pointer): native input is a hidden value carrier; the overlay/segments are the interactive UI.
- **`display`** (coarse pointer): the styled overlay stays visible but `pointer-events: none` and decorative (`aria-hidden`); the native input becomes a transparent full-size layer on top (`position:absolute; inset:0; opacity:0`) that fires the platform picker on tap and is the accessible control.

To verify: emulate a touch viewport, then `document.elementFromPoint(center)` should return the native `<input>` in display mode.

### Internal view switching (panels)

When a popup has multiple swappable body views (DateField & DateTimeField: the date **grid** vs the month/year **picker**), each view is wrapped in a `[data-panel="<name>"]` container carrying an explicit boolean `data-active="true|false"`. Exactly one sibling panel is `"true"`. CSS keys on **both** states (deterministic, greppable, no `:not()` / presence-absence):

```css
.<Component>-popup [data-panel][data-active="false"]        { display: none; }
.<Component>-popup [data-panel="calendar"][data-active="true"] { display: block; }
.<Component>-popup [data-panel="picker"][data-active="true"]   { display: flex; … }
```

JS switches with a small helper that sets the attribute on every panel:

```ts
_setPanel(active) {
  this.calendarEl.querySelectorAll('[data-panel]').forEach(p =>
    p.setAttribute('data-active', String(p.dataset.panel === active)))
}
_isPickerActive() {
  return this.calendarEl?.querySelector('[data-panel="picker"]')?.getAttribute('data-active') === 'true'
}
```

The DOM attribute is the single source of truth — read it (`_isPickerActive()`) rather than tracking view state in a separate field. Header, footer, arrow (and DateTimeField's time-columns) are **persistent chrome** outside the panels and never toggle.

### One deliberate difference (not drift)

ToggleTip **keeps** its popup in the DOM and toggles visibility via `aria-hidden` + `display:none`; the five fields **remove + clone** from a `<template>` on each open (their content is rebuilt anyway). ToggleTip also has no Escape/focus-management (it's a tooltip, not a dialog) — that's correct, not drift.

### State partials

Components with many HTML variants generate `states/*.hbs` from `<Name>.generate.ts` (gitignored build artifacts — never edit by hand). When you change popup markup, edit `canonical()` in the generator and run `npm run generate:states`.

# DateField Calendar Positioning

**Date:** 2026-05-06
**Status:** Approved

## Problem

The DateField calendar is currently positioned by appending to `document.body` with hardcoded `top` and `left` values derived from `getBoundingClientRect`. This means:

- The calendar clips at viewport edges (no horizontal clamping)
- The calendar always opens below the trigger (no direction detection)
- No arrow connecting the calendar to the trigger icon
- Positioning logic is duplicated instead of shared with ToggleTip

## Goal

Apply ToggleTip's slideContainer positioning pattern to the DateField calendar: viewport-clamped horizontal positioning, above/below direction detection, and an arrow pointing at the calendar trigger icon. The three pure positioning functions are extracted to a shared module so both components use identical math.

Nothing inside the calendar changes — only the outer positioning scaffold.

---

## Architecture

### Shared module: `src/js/popup-position.ts`

Three pure functions extracted from `ToggleTip.ts` with no changes to their signatures or behaviour:

- `calculatePopupOffset(triggerCenterX, containerLeft, containerWidth, popupWidth, viewportWidth?, viewportInset?)` — returns `%` for horizontal bubble position along the slide rail, clamped within viewport insets
- `calculateArrowOffset(triggerCenterX, popupLeft, popupWidth, borderRadius, arrowSize)` — returns `px` correction so the arrow always points at the trigger center
- `detectDirection(triggerRect, viewportHeight?)` — returns `'top' | 'bottom'` based on available space; ties go to `'top'`

`ToggleTip.ts` replaces its local definitions with imports from this module. Its behaviour is unchanged.

`DateField.ts` imports the same three functions.

Unit tests for all three functions move from `ToggleTip.unit.test.ts` to a new `tests/popup-position.unit.test.ts` at the repo root. ToggleTip's unit test file retains tests for ToggleTip-specific behaviour only.

---

## Markup

`DateField.generate.ts` — `canonical()` gains a `slideContainer` inside `.Custom`, between `.Segments` and the closing tag. The `<template>` moves inside `slideContainer`. An `.arrow` div sits alongside the template.

```html
<div class="DateField" data-component="DateField" data-id="…" …>
  <input class="Native" type="date" … />
  <div class="Custom" aria-hidden="true">
    <div class="Segments" role="group">
      <button type="button" class="Trigger" …>
        <!-- calendar SVG icon -->
      </button>
    </div>
    <div class="slideContainer">
      <template data-template="datefield-calendar">
        <!-- calendar markup unchanged -->
      </template>
      <div class="arrow"></div>
    </div>
  </div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
</div>
```

The `slideContainer` is always in the DOM. When closed it is empty (`height: 0`) and has no visual presence.

---

## CSS

### `DateField.css`

**Initialisation gate** — same pattern as `toggle-tip[initialized]`:

```css
.DateField {
  overflow: hidden;
}

.DateField[data-initialized] {
  overflow: visible;
}
```

**Slide rail** — centred on `.Custom`. `calculatePopupOffset` uses absolute viewport coordinates for both trigger center and container left edge, so the calendar lands correctly relative to the trigger regardless of where the container is anchored in CSS.

```css
.DateField .slideContainer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(100vw, var(--_df-rail-max-width, 80rem));
  height: 0;
  pointer-events: none;
  z-index: 9999;
}
```

**Vertical offset** — controlled by a public custom property so callers can nudge the calendar away from the trigger icon:

```css
.DateField {
  --df-calendar-gap: 0.5rem; /* public — override to reposition vertically */
}
```

**Calendar bubble:**

```css
.DateField .DateFieldCalendar {
  position: absolute;
  left: var(--df-popup-offset, 50%);
  transform: translateX(-50%);
  pointer-events: auto;
  will-change: filter;
  filter:
    drop-shadow(0 0.1875rem 0.1875rem hsl(0 0% 0% / 20%))
    drop-shadow(0 0.75rem 0.75rem hsl(0 0% 0% / 20%));
}
```

**Direction gates** — `data-direction` on `.DateField` root, set by JS:

```css
.DateField[data-direction="bottom"] .DateFieldCalendar {
  top: var(--df-calendar-gap);
}

.DateField[data-direction="top"] .DateFieldCalendar {
  bottom: var(--df-calendar-gap);
}
```

**Arrow** — identical structure to ToggleTip. Size derived from trigger button width:

```css
.DateField {
  --_df-arrow-size: 0.75rem;
  --_df-arrow-corner-radius: 0.25rem;
  --_df-surface-color: white;
}

.DateField .arrow {
  position: absolute;
  width: var(--_df-arrow-size);
  height: var(--_df-arrow-size);
  background-color: var(--_df-surface-color);
  left: 50%;
}

.DateField[data-direction="top"] .arrow {
  bottom: calc(var(--_df-arrow-size) * -0.5);
  transform: translateX(calc(-50% + var(--df-arrow-offset, 0px))) rotate(45deg);
  border-end-end-radius: var(--_df-arrow-corner-radius);
}

.DateField[data-direction="bottom"] .arrow {
  top: calc(var(--_df-arrow-size) * -0.5);
  transform: translateX(calc(-50% + var(--df-arrow-offset, 0px))) rotate(45deg);
  border-start-start-radius: var(--_df-arrow-corner-radius);
}
```

---

## JavaScript

### `DateField.ts` changes

**New instance variable:**

```ts
private slideContainer!: HTMLElement
```

Resolved in `_init()` after markup is in DOM:

```ts
this.slideContainer = this.root.querySelector('.slideContainer') as HTMLElement
```

**`_openCalendar()` — remove body-append, replace with slideContainer:**

```ts
// Remove:
document.body.appendChild(this.calendarEl)
this.calendarEl.style.top = `${rect.bottom + window.scrollY + 4}px`
this.calendarEl.style.left = `${rect.left + window.scrollX}px`

// Replace with:
this.slideContainer.appendChild(this.calendarEl)
this.root.setAttribute('data-initialized', '')
this._updateLayout()
```

**New `_updateLayout()` method:**

```ts
private _updateLayout(): void {
  if (!this.calendarEl) return

  const triggerRect = this.trigger.getBoundingClientRect()
  const containerRect = this.slideContainer.getBoundingClientRect()
  const calendarWidth = this.calendarEl.offsetWidth
  if (!containerRect.width || !calendarWidth) return

  const direction = detectDirection(triggerRect)
  this.root.dataset.direction = direction

  const triggerCenterX = triggerRect.left + triggerRect.width / 2

  const offset = calculatePopupOffset(
    triggerCenterX,
    containerRect.left,
    containerRect.width,
    calendarWidth,
  )
  this.root.style.setProperty('--df-popup-offset', `${offset}%`)

  const calendarLeft = containerRect.left + (offset / 100 * containerRect.width) - calendarWidth / 2
  const arrowOffset = calculateArrowOffset(
    triggerCenterX,
    calendarLeft,
    calendarWidth,
    this._getCSSPx('--_df-arrow-corner-radius'),
    this._getCSSPx('--_df-arrow-size'),
  )
  this.root.style.setProperty('--df-arrow-offset', `${arrowOffset}px`)
}
```

**`_getCSSPx()` — same probe pattern as ToggleTip**, resolves CSS custom properties to px.

**`_closeCalendar()` — unchanged**, `this.calendarEl.remove()` still works; slideContainer remains in DOM, empty.

**Resize handler** — add `_handleResize` with `requestAnimationFrame` debounce, call `_updateLayout()` when calendar is open. Same pattern as ToggleTip.

**Outside-click handler** — simplified. The calendar now lives inside `slideContainer` which is inside `this.root`, so a single root-contains check covers everything:

```ts
if (!this.root.contains(e.target as Node)) {
  this._closeCalendar()
}
```

---

## Testing

- `popup-position.unit.test.ts` — unit tests for all three shared functions (moved from ToggleTip)
- `DateField.unit.test.ts` — add tests for `_updateLayout()` covering: below-trigger placement, above-trigger placement (near top of viewport), viewport-edge clamping
- `DateField.e2e.test.js` — existing tests cover calendar open/close/keyboard; add one test confirming `data-direction` is set on open

---

## Out of scope

- RTL support
- Animation/transition on calendar open (separate concern)
- Touch/pointer-coarse behaviour
- Horizontal fine-tuning of the slideContainer anchor — to be adjusted during implementation once visually testable

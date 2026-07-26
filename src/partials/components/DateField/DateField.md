# DateField

An accessible date input that renders editable day, month, and year segments with an optional calendar picker. Wraps a native `input[type=date]` for form submission and delegates keyboard navigation to individual segment spans.

## Contract

```html
<label for="FIELD_ID">Label</label>
<div
  class="DateField"
  data-component="DateField"
  data-id="FIELD_ID"
  data-name="FIELD_ID"
  data-locale="sv-SE"
  data-min="1900-01-01"
  data-max="2100-12-31"
>
  <input class="Native" type="date" />
  <div class="Custom" aria-hidden="true">
    <div class="Segments" role="group">
      <button
        type="button"
        class="DateField-trigger"
        aria-label="Open calendar"
        aria-expanded="false"
        aria-haspopup="dialog"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
    </div>
    <div class="slideContainer">
      <template data-template="datefield-calendar">
        <div class="DateField-popup" role="dialog" aria-modal="true">
          <div class="CalendarHeader">
            <button type="button" class="PrevMonth">&#8249;</button>
            <button type="button" class="MonthYearTrigger" aria-expanded="false"></button>
            <button type="button" class="NextMonth">&#8250;</button>
          </div>
          <div class="Panel" data-panel="calendar" data-active="true">
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="Panel YearMonthPicker WheelColumns" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
          <div class="CalendarFooter">
            <button type="button" class="CalendarFooterClear"></button>
            <button type="button" class="CalendarFooterToday"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
</div>
```

`FIELD_ID` must be unique on the page and must match both `data-id` and the `<label for>`. `data-locale` controls segment labels and calendar month/weekday names. `data-min` and `data-max` define the selectable date range (ISO 8601). JS injects the segment spans into `.Segments` and clones the calendar dialog from the `<template>` into `.slideContainer` on open — do not author the segment spans or the cloned calendar outside the template. The `WheelColumns` class on the picker panel is required — the kernel `Wheel.css` styles the wheel band and fade on it. JS gives `.MonthYearTrigger` an `aria-controls` pointing at the picker panel and toggles its `aria-expanded`; it deliberately carries no `aria-haspopup` (the trigger swaps an in-dialog panel of spinbutton wheels, not a listbox popup). The SVG icon, the `<template>` structure, and its contents are all authored markup. The `aria-label` on `.DateField-trigger` is a placeholder; JS overwrites it with a localised string derived from `data-locale` — port it to your translation system rather than hardcoding a value.

## Behaviour

All observable outcomes are state changes on `data-*` attributes or DOM changes:

- **Init:** JS reads `data-id`, `data-name`, `data-locale`, `data-min`, `data-max` from the root and injects three editable segment spans (day, month, year) into `.Segments`. The calendar dialog is cloned fresh from the `<template>` into `.slideContainer` on every open and removed from the DOM on close.
- **Segment editing (keyboard):** Arrow Up/Down increments/decrements the focused segment value. Left/Right moves focus between segments. Digit keys fill the segment; when the segment is complete it advances focus to the next. Backspace clears the segment.
- **Segment editing (commit):** When all three segments are valid, JS writes the ISO date to the native input (`input.value = "YYYY-MM-DD"`) and fires a native `change` event.
- **Calendar open:** Clicking `.DateField-trigger` sets `aria-expanded="true"` on the trigger and makes the calendar dialog visible. The calendar renders the month grid for the current or selected date.
- **Calendar navigation:** `.PrevMonth` / `.NextMonth` step the displayed month. `.MonthYearTrigger` toggles between the two panels: `.Panel[data-panel="calendar"]` (the grid) and `.Panel[data-panel="picker"]` (the month/year wheels). Only one panel has `data-active="true"` at a time. The two `.Wheel` elements (`data-picker="month"` / `"year"`) are upgraded by the `WheelColumn` kernel primitive to `role="spinbutton"` — see [`src/kernel/js/WheelColumn.md`](../../../kernel/js/WheelColumn.md).
- **Calendar date selection:** Clicking a day cell commits the date, closes the calendar (`aria-expanded="false"`), and focuses the trigger.
- **Calendar close (Escape):** Escape is two-step. When the month/year picker panel is open, Escape reverts to the month/year the picker opened on and closes only the picker (back to the calendar panel); a second Escape closes the calendar.
- **Disabled:** When `data-disabled="true"` is present on the root, all interaction is blocked (`pointer-events: none` via CSS). The server renders it, and JS also mirrors it onto the root at init when the native input has the `disabled` attribute.
- **Invalid:** When `data-invalid="true"` is present, CSS applies error styling. JS does not set this attribute — the server renders it.
- **Announcement:** After a date is committed, JS writes a human-readable string to `.Announce` (e.g. "15 juni 1990") so screen readers announce the selection.

## Accessibility

- `.Segments` has `role="group"` — groups the three segment spans as a logical unit.
- Each segment span has `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label` (e.g. "dag", "månad", "år"). These are injected by JS.
- `.DateField-trigger` has `aria-expanded` (toggled by JS) and `aria-haspopup="dialog"`.
- The calendar dialog has `role="dialog"` and `aria-modal="true"`.
- `.Custom` is authored with `aria-hidden="true"`. In `data-input-mode="custom"` (fine pointer) JS removes it — the segments are the accessible control, and the native input is hidden from everyone (`visibility: hidden`), serving only as the value carrier for form submission. In `data-input-mode="display"` (coarse pointer) the custom layer stays `aria-hidden` and the native input is the accessible control.
- `.Announce` has `aria-live="polite"` and `aria-atomic="true"` — date confirmations are announced synchronously on commit.
- The native `input[type=date]` receives the committed value in both modes and carries it for form submission.

## Attributes

### On root element (authored)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `data-id` | string | yes | Unique ID — used as `id` on the native input and as `for` on the label |
| `data-name` | string | yes | `name` attribute written to the native input for form submission |
| `data-locale` | BCP 47 tag | no | Locale for segment labels and calendar formatting (e.g. `"sv-SE"`). Falls back to `<html lang>`, then `"en"` |
| `data-min` | ISO 8601 date | no | Earliest selectable date (`YYYY-MM-DD`). Defaults to none — year segment/wheel then spans 1900–2100 |
| `data-max` | ISO 8601 date | no | Latest selectable date (`YYYY-MM-DD`). Defaults to none — year segment/wheel then spans 1900–2100 |
| `data-label-field` | string | no | Fallback `aria-label` for `.Segments` when no matching `<label for>` exists |
| `data-disabled` | `"true"` | no | Disables all interaction; renders CSS disabled state |
| `data-invalid` | `"true"` | no | Renders CSS error state; does not block interaction |
| `data-test-state` | `"hover"` / `"focus"` / `"active"` | no | Kitchensink / visual-test only — simulates CSS pseudo-state without user interaction |

### On native input (authored)

| Attribute | Description |
|-----------|-------------|
| `value` | Pre-filled date in `YYYY-MM-DD` format |
| `required` | Marks the field as required for form validation |
| `aria-invalid` | Set to `"true"` when the field has a validation error |
| `disabled` | Mirrors `data-disabled="true"`; set together with the root attribute |

### State attributes (set by JS)

| Attribute | Set when |
|-----------|----------|
| `data-initialized="true"` | Component has been mounted |
| `data-input-mode` | `"custom"` or `"display"` — chosen at init via `matchMedia('(pointer: coarse)')` |
| `data-state` | `"open"` while the calendar is open, `"idle"` after close |
| `data-direction` | `"top"` or `"bottom"` — which side of the trigger the popup opens on |

JS also sets two inline custom properties on the root while the calendar is open: `--_df-popup-offset` (horizontal popup position, %) and `--_df-arrow-offset` (arrow position, px).

#### Display mode (coarse pointer / touch)

On coarse-pointer devices JS sets `data-input-mode="display"` instead of `"custom"`: the component keeps the custom appearance, but the segments become non-interactive read-only display (`tabindex="-1"`, custom layer stays `aria-hidden`) and the native input is the real, accessible control — it sits transparently on top and opens the platform's own date picker on tap. DateField is the family reference for this native-fallback pattern.

## Kernel dependencies

This component composes shared primitives from [`src/kernel/`](../../../kernel/README.md). Port and verify these once — they are not re-implemented per component.

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/WheelColumn`](../../../kernel/js/WheelColumn.md) | JS | month/year picker wheels |
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | calendar popover placement + arrow offset |
| [`js/popup-interaction`](../../../kernel/js/popup-interaction.md) | JS | calendar focus trap (nav → grid → footer; picker wheels when active) + wheel-scroll containment |
| [`utils/dates`](../../../kernel/utils/dates.md) | JS | calendar maths, leap years, ISO formatting, segment order |
| [`utils/locale`](../../../kernel/utils/locale.md) | JS | locale resolution |
| [`css/Wheel.css`](../../../kernel/css/Wheel.md) | CSS | wheel visuals — required wherever `WheelColumn` runs |

## Required tokens

The `--_df-*` design tokens default to the `--ui-*` theming seam (design) and `--SITE--*` layout tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/ui-tokens.css`](../../../css/site/01-Setup/ui-tokens.css)); porting the component without them leaves colours and spacing unset.

- `--MAX--WIDTH--SITE`, `--SITE--PADDING`
- `--ui-surface`, `--ui-surface-foreground`, `--ui-muted-foreground`, `--ui-border`, `--ui-radius`, `--ui-shadow`, `--ui-surface-padding`, `--ui-hover`, `--ui-primary`, `--ui-primary-foreground`

Map onto your design system from the **values** in `ui-tokens.css` (design) / `tokens.css` (layout), not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Manual accessibility testing

Test with a real screenreader before shipping. Sources: `docs/atomica11y/form/date-picker-dialog.md`, `docs/atomica11y/form/text-input.md`, `docs/atomica11y/form/hint-help-or-error.md`.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Segments**
- [ ] Purpose of each segment is clear (label read: "dag", "månad", "år")
- [ ] Each segment identifies itself as an editable input (spinbutton)
- [ ] Disabled/required state is expressed if applicable

**Calendar trigger**
- [ ] Purpose is clear ("Öppna kalender" or localised equivalent)
- [ ] Identifies as a button with popup/dialog indicator
- [ ] Expresses expanded/collapsed state

**Calendar dialog**
- [ ] Dialog title or purpose is announced on open
- [ ] Identifies itself as a dialog/modal
- [ ] When closed, focus returns to the trigger
- [ ] Content behind the dialog is inert (not reachable) while open
- [ ] Each day cell is announced with day number, month, and year
- [ ] Day cells express state (selected, disabled/dimmed)
- [ ] Prev/next month buttons have clear purpose

**Invalid state**
- [ ] When `data-invalid="true"` is set, the error is announced automatically
- [ ] Error is read after the input name, role, and state

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Swipe to trigger — purpose is clear, identifies as button with dialog popup
- [ ] Double-tap opens dialog
- [ ] Swipe within dialog — day cells and navigation controls come into focus
- [ ] Double-tap on a day — date is selected, dialog closes, focus returns to trigger

## Non-goals

- No time picker (hours, minutes, seconds)
- No date-range selection (start/end pair)
- No inline calendar (always triggered via the button)
- No RTL support
- No `minlength` / `maxlength` constraint on segment values beyond the natural range
- No custom validation messages (use native constraint validation or wrap the component)

## Known limitations

**Popover clipping in overflow ancestors.** The calendar popup is positioned in normal flow, so a
scroll container — or a scrolling table cell — around this component clips it. The escape (top layer
via the Popover API, or a portal) and its feature-detection are the consuming project's layer: see
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations).

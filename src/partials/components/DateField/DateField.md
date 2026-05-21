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
        class="Trigger"
        aria-label="Öppna kalender"
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
        <!-- calendar dialog structure — see DateField.generate.ts canonical() for full markup -->
      </template>
    </div>
  </div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
</div>
```

`FIELD_ID` must be unique on the page and must match both `data-id` and the `<label for>`. `data-locale` controls segment labels and calendar month/weekday names. `data-min` and `data-max` define the selectable date range (ISO 8601). JS injects the segment spans into `.Segments` and clones the full calendar dialog from the `<template>` into `.slideContainer` — do not author these. The SVG icon and `<template>` content are authored markup.

## Behaviour

All observable outcomes are state changes on `data-*` attributes or DOM changes:

- **Init:** JS reads `data-id`, `data-name`, `data-locale`, `data-min`, `data-max` from the root. It injects three editable segment spans (day, month, year) into `.Segments` and clones the calendar dialog from the `<template>` into `.slideContainer`.
- **Segment editing (keyboard):** Arrow Up/Down increments/decrements the focused segment value. Left/Right moves focus between segments. Digit keys fill the segment; when the segment is complete it advances focus to the next. Delete/Backspace clears the segment.
- **Segment editing (commit):** When all three segments are valid, JS writes the ISO date to the native input (`input.value = "YYYY-MM-DD"`) and fires a native `change` event.
- **Calendar open:** Clicking `.Trigger` sets `aria-expanded="true"` on the trigger and makes the calendar dialog visible. The calendar renders the month grid for the current or selected date.
- **Calendar navigation:** `.PrevMonth` / `.NextMonth` step the displayed month. `.MonthYearTrigger` toggles the year/month picker panel (`aria-expanded` on `.MonthYearTrigger`).
- **Calendar date selection:** Clicking a day cell commits the date, closes the calendar (`aria-expanded="false"`), and focuses the trigger.
- **Calendar close (Escape):** Pressing Escape reverts any pending picker state and closes the calendar.
- **Disabled:** When `data-disabled` is present on the root, all interaction is blocked (`pointer-events: none` via CSS). JS does not set this attribute — the server renders it.
- **Invalid:** When `data-invalid` is present, CSS applies error styling. JS does not set this attribute — the server renders it.
- **Announcement:** After a date is committed, JS writes a human-readable string to `.Announce` (e.g. "15 juni 1990") so screen readers announce the selection.

## Accessibility

- `.Segments` has `role="group"` — groups the three segment spans as a logical unit.
- Each segment span has `role="spinbutton"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label` (e.g. "dag", "månad", "år"). These are injected by JS.
- `.Trigger` has `aria-expanded` (toggled by JS) and `aria-haspopup="dialog"`.
- The calendar dialog has `role="dialog"` and `aria-modal="true"`.
- `.Custom` has `aria-hidden="true"` — screen readers use the native input, not the custom segments.
- `.Announce` has `aria-live="polite"` and `aria-atomic="true"` — date confirmations are announced after a short debounce.
- The native `input[type=date]` is visually hidden but accessible to screen readers and receives the committed value.

## Attributes

### On root element (authored)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `data-id` | string | yes | Unique ID — used as `id` on the native input and as `for` on the label |
| `data-name` | string | yes | `name` attribute written to the native input for form submission |
| `data-locale` | BCP 47 tag | yes | Locale for segment labels and calendar formatting (e.g. `"sv-SE"`) |
| `data-min` | ISO 8601 date | yes | Earliest selectable date (`YYYY-MM-DD`) |
| `data-max` | ISO 8601 date | yes | Latest selectable date (`YYYY-MM-DD`) |
| `data-disabled` | boolean | no | Disables all interaction; renders CSS disabled state |
| `data-invalid` | boolean | no | Renders CSS error state; does not block interaction |

### On native input (authored)

| Attribute | Description |
|-----------|-------------|
| `value` | Pre-filled date in `YYYY-MM-DD` format |
| `required` | Marks the field as required for form validation |
| `aria-invalid` | Set to `"true"` when the field has a validation error |
| `disabled` | Mirrors `data-disabled`; set together with the root attribute |

### State attributes (set by JS)

| Attribute | Set when |
|-----------|----------|
| `data-initialized` | Component has been mounted |

## Non-goals

- No time picker (hours, minutes, seconds)
- No date-range selection (start/end pair)
- No inline calendar (always triggered via the button)
- No RTL support
- No `minlength` / `maxlength` constraint on segment values beyond the natural range
- No custom validation messages (use native constraint validation or wrap the component)

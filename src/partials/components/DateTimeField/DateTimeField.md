# DateTimeField

Custom accessible datetime input wrapping a hidden `input[type="datetime-local"]`.

## Contract

```html
<label for="UNIQUE_ID">Date and time</label>
<div
  class="DateTimeField"
  data-component="DateTimeField"
  data-id="UNIQUE_ID"
  data-name="INPUT_NAME"
  data-locale="sv-SE"
>
  <input class="native" data-part="native" type="datetime-local" tabindex="-1" aria-hidden="true">
  <div class="overlay" data-part="overlay">
    <div class="segments" data-part="segments" role="group"></div>
    <button class="trigger" data-part="trigger" type="button" aria-label="Open calendar" aria-expanded="false" aria-haspopup="dialog"><!-- calendar icon SVG --></button>
  </div>
  <template class="calendar-template" data-part="calendar-template">
    <div class="popup" data-part="popup" role="dialog" aria-modal="true">
      <div class="calendar-inner">
        <div class="calendar-left">
          <div class="calendar-header">
            <button class="prev-month" data-part="prev-month" type="button">&#8249;</button>
            <button class="month-year-trigger" data-part="month-year-trigger" type="button" aria-expanded="false"><span class="calendar-month-year" data-part="calendar-month-year"></span></button>
            <button class="next-month" data-part="next-month" type="button">&#8250;</button>
          </div>
          <div data-panel="calendar" data-active="true">
            <table class="calendar-grid" data-part="calendar-grid" role="grid"></table>
          </div>
          <div class="year-month-picker WheelColumns" data-part="year-month-picker" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
        </div>
        <div class="time-columns WheelColumns">
          <div class="Wheel" data-segment="hour" tabindex="0"></div>
          <div class="Wheel" data-segment="minute" tabindex="0"></div>
          <div class="Wheel" data-segment="second" tabindex="0" style="display:none"></div>
          <div class="ampm" data-part="ampm" role="group" hidden></div>
        </div>
      </div>
      <div class="calendar-footer">
        <button class="calendar-footer-clear" data-part="calendar-footer-clear" type="button"></button>
        <button class="calendar-footer-today" data-part="calendar-footer-today" type="button"></button>
        <button class="calendar-footer-now" data-part="calendar-footer-now" type="button"></button>
      </div>
      <div class="arrow"></div>
    </div>
  </template>
  <div class="rail" data-part="rail"></div>
  <div class="announce" data-part="announce" aria-live="polite" aria-atomic="true"></div>
</div>
```

JS injects the segment spinbuttons into `[data-part="segments"]` and the day cells into `[data-part="calendar-grid"]`, and clones
the `<template>` into `[data-part="rail"]` on open — do not author those. The five `.Wheel` elements
(two `data-picker` for month/year, three `data-segment` for hour/minute/second) are upgraded by the
`WheelColumn` kernel primitive to `role="spinbutton"`; see
[`src/kernel/js/WheelColumn.md`](../../../kernel/js/WheelColumn.md). The `WheelColumns` class on the
picker panel and `[data-part="time-columns"]` is required — the kernel `Wheel.css` styles the wheel band and fade
on it. The `data-panel="calendar"` and
`data-panel="picker"` panels swap via `data-active`; the second segment and `[data-part="ampm"]` stay
hidden unless `data-step < 60` / a 12-hour locale applies. JS gives `[data-part="month-year-trigger"]` an
`aria-controls` pointing at the picker panel and toggles its `aria-expanded` on picker open/close; it
deliberately carries no `aria-haspopup` (the trigger swaps an in-dialog panel of spinbutton wheels,
not a listbox popup).

## Parts

Every part carries a lowercase class **for styling only** — rename, hash or delete them all and the
suite still passes. A part also carries `data-part` when the suite, the reference JS or a composing
component has to *find* it; that attribute is the contract, and the stylesheet never reads it.
The **Bound by** column says who holds on to each part.


| Part | Element | Role | Bound by |
|---|---|---|---|
| `native` | `<input type="datetime-local">` | The real form control; hidden in `custom` mode, the transparent tap layer in `display` mode | suite + JS |
| `overlay` | `<div>` | The visible bordered field box | suite + JS |
| `segments` | `<div role="group">` | Container the JS fills with segment spans | suite + JS |
| `segment` | `<span role="spinbutton">` | One editable segment; `data-segment` says which (`day` · `month` · `year` · `hour` · `minute` · `second` · `ampm`) | suite |
| `separator` | `<span aria-hidden>` | Separators between segments | styled only |
| `trigger` | `<button>` | Opens the popup; carries `aria-expanded` / `aria-haspopup="dialog"` | suite + JS |
| `icon` | `<svg>` | The trigger glyph | styled only |
| `calendar-template` | `<template>` | Authored popup markup, cloned into the rail on open | suite + JS |
| `rail` | `<div>` | Zero-height positioning rail | JS |
| `popup` | `<div role="dialog">` | The combined calendar + time picker | suite + JS |
| `calendar-inner` | `<div>` | Two-column layout: calendar on the left, wheels on the right | styled only |
| `calendar-left` | `<div>` | The calendar column (header, grid, month/year picker) | styled only |
| `calendar-header` | `<div>` | Month navigation row | styled only |
| `prev-month` · `next-month` | `<button>` | Step the displayed month | suite + JS / JS |
| `month-year-trigger` | `<button>` | Swaps the calendar panel for the wheel picker panel (`data-panel` / `data-active`) | suite + JS |
| `calendar-month-year` | `<span>` | The displayed month and year, inside the trigger | suite + JS |
| `calendar-grid` | `<table role="grid">` | The month grid; day cells carry `data-date`, `data-today`, `data-selected`, `data-outside-month` | suite + JS |
| `year-month-picker` | `<div class="WheelColumns" role="group">` | Row of wheel hosts (`.Wheel[data-picker]`) | JS |
| `time-columns` | `<div class="WheelColumns">` | Row of time wheel hosts (`.Wheel[data-segment]`) plus the AM/PM toggle | styled only |
| `ampm` | `<div role="group">` | AM/PM toggle group, shown for 12-hour locales | suite + JS |
| `ampm-option` | `<button aria-pressed>` | One AM/PM option, built by JS | suite + JS |
| `calendar-footer` | `<div>` | Footer holding the three actions | styled only |
| `calendar-footer-clear` · `calendar-footer-today` · `calendar-footer-now` | `<button>` | Clear / Today / Now | suite + JS |
| `arrow` | `<div>` | The popup pointer, positioned from JS | styled only |
| `announce` | `<div aria-live="polite">` | Visually hidden live region for committed values | suite + JS |

## Attributes

### On root element

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Unique field ID (required) |
| `data-name` | string | Native input name (required) |
| `data-locale` | BCP 47 | Controls segment order and 12h/24h |
| `data-min` | `YYYY-MM-DDTHH:mm` | Constrains the calendar grid (day granularity) and the year segment/wheel range. Typed segment values are not clamped to it on write |
| `data-max` | `YYYY-MM-DDTHH:mm` | Constrains the calendar grid (day granularity) and the year segment/wheel range. Typed segment values are not clamped to it on write |
| `data-disabled` | `"true"` | Disables the component |
| `data-invalid` | `"true"` | Marks field invalid, adds `aria-invalid` |
| `data-value` | `YYYY-MM-DDTHH:mm` | Initial value (server-render) |
| `data-step` | number (seconds) | Shows second segment when < 60 |
| `data-label-field` | string | Fallback `aria-label` for `[data-part="segments"]` when no matching `<label for>` exists |

### State attributes (set by JS)

| Attribute | Set when |
|---|---|
| `data-initialized="true"` | Component mounted |
| `data-open="true"` | Popup is open |
| `data-input-mode` | `"custom"` or `"display"` — chosen at init via `matchMedia('(pointer: coarse)')` |
| `data-direction` | `"top"` or `"bottom"` — which side of the trigger the popup opens on |

JS also sets two inline custom properties on the root while the popup is open: `--_dtf-popup-offset` (horizontal popup position, %) and `--_dtf-arrow-offset` (arrow position, px).

## Behaviour

- segment spinbuttons for day/month/year/hour/minute (and second when `step < 60`, AM/PM when locale is 12h)
- Popup: calendar grid on the left, scrollable time columns on the right
- "Nu" footer button sets current datetime
- All segments must be filled before native input is written
- Form reset clears all segments
- Footer actions that complete the value close the popup ("Nu" writes the full
  datetime; "Rensa" empties it) and return focus to the trigger. "Idag" only
  sets the date part — a **partial** value, so it leaves the popup open with
  the time still editable, same as a day click in the grid.

## Events

- `change` — dispatched on the native input as `new Event('change', { bubbles: true })`, exactly once per actual value change. An equality gate against the native input's current value collapses cascading segment writes (e.g. a calendar selection touches up to seven segments) into a single event. Popup **Clear** also dispatches `change` (value set to `""`).
- Each value change also writes "Selected date and time: <localized label>" (localised) to the `[data-part="announce"]` live region.

## Accessibility notes

- Native input is `aria-hidden="true"` and `tabindex="-1"`
- `[data-part="segments"]` has `role="group"` with `aria-roledescription`, and is **named** from the `<label for>`
  via `aria-labelledby` (JS wires it on mount; `data-label-field` is the fallback when no label
  element exists). The label targets the native input, so display mode needs no extra wiring
- The trigger carries `aria-haspopup="dialog"` and `aria-expanded`; its `aria-label` swaps between
  "Open calendar" and "Close calendar" (localised)
- Popup is `role="dialog"` with `aria-modal="true"`, named "Choose date and time" (localised) — a
  title, not the trigger's action label
- Each spinbutton has `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` — except the AM/PM segment, which gets only `aria-valuenow`/`aria-valuetext` (a 2-state toggle, not a range)
- Empty segments remove `aria-valuenow` and speak the localized `empty` word ("blank"/"tomt") as `aria-valuetext` — never the visible placeholder, and never no valuetext at all (min/max without valuenow makes VoiceOver announce a computed percentage). Same contract as DateField.
- Time columns are `.Wheel` spinbuttons — the `WheelColumn` primitive sets `role="spinbutton"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`/`aria-valuetext` (not `listbox`)
- `aria-disabled="true"` on all segments when disabled
- `[data-part="announce"]` (`aria-live="polite"`, `aria-atomic="true"`, last child of the root) announces the selected date and time on each value change

## Kernel dependencies

This component composes shared primitives from [`src/kernel/`](../../../kernel/README.md). Port and verify these once — they are not re-implemented per component.

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/WheelColumn`](../../../kernel/js/WheelColumn.md) | JS | month/year picker wheels **and** hour/minute/second time wheels |
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | popover placement + arrow offset |
| [`js/popup-interaction`](../../../kernel/js/popup-interaction.md) | JS | calendar focus trap (nav → grid → time wheels → am/pm → footer; picker wheels when active) + wheel-scroll containment |
| [`utils/dates`](../../../kernel/utils/dates.md) | JS | calendar maths, leap years, ISO datetime formatting, segment order |
| [`utils/locale`](../../../kernel/utils/locale.md) | JS | locale resolution + 12h/24h |
| [`css/Wheel.css`](../../../kernel/css/Wheel.md) | CSS | wheel visuals — required wherever `WheelColumn` runs |

## Required tokens

The `--_dtf-*` design tokens default to the `--ui-*` theming seam (design) and `--SITE--*` layout tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/ui-tokens.css`](../../../css/site/01-Setup/ui-tokens.css)); porting the component without them leaves colours and spacing unset.

- `--MAX--WIDTH--SITE`, `--SITE--PADDING`
- `--ui-surface`, `--ui-surface-foreground`, `--ui-muted-foreground`, `--ui-border`, `--ui-radius`, `--ui-shadow`, `--ui-surface-padding`, `--ui-hover`, `--ui-primary`, `--ui-primary-foreground`

Map onto your design system from the **values** in `ui-tokens.css` (design) / `tokens.css` (layout), not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Manual accessibility testing

Test with a real screenreader before shipping.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**segment group**
- [ ] When tabbing into the component, the group label is announced
- [ ] First segment announces its type and current value

**Spinbutton segments**
- [ ] Each segment announces its label (Day, Month, Year, Hour, Minute)
- [ ] ArrowUp/Down announces the new value
- [ ] Placeholder state is announced (e.g. "Day, empty")
- [ ] When disabled, segments announce their disabled state

**Calendar popup**
- [ ] Dialog label is announced when popup opens
- [ ] Each day cell is announced with day number, month, and year
- [ ] Day cells express state (today, selected, disabled/dimmed)
- [ ] ArrowKeys navigate between days with date announcement
- [ ] PageUp/PageDown announces new month/year

**Time columns (wheels)**
- [ ] Each wheel announces its label (Hours, Minutes, Seconds)
- [ ] ArrowUp/Down announces the new hour/minute value
- [ ] The centred value is announced as the current value

**AM/PM (12h locales only)**
- [ ] AM/PM segment announces current state
- [ ] Toggle (A/P key or ArrowUp/Down) announces new state

**"Nu" button**
- [ ] Announced as a button with clear purpose
- [ ] After activation, current date and time are announced via live region

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Swipe to segment — type and value announced
- [ ] Double-tap adjusts value (falls back to native picker on some devices)
- [ ] Swipe to trigger — announced as button
- [ ] Double-tap opens popup
- [ ] Swipe through time columns — values announced
- [ ] (seconds fields) On iOS, the native picker shows only hour/minute — seconds cannot be set there (see Platform gotchas)

## Platform gotchas

### iOS: no seconds in the native picker

iOS Safari's native `<input type="datetime-local">` picker only renders date + **hour/minute** wheels — it never shows a seconds wheel, regardless of the `step` attribute. This is a long-standing WebKit limitation, not a bug in this component. (Desktop Chrome does render a seconds field when `step < 60`.)

Because the touch interaction model defers to the native input as the real control, a `DateTimeField` with `data-step` < 60 effectively **degrades to minute precision on iOS touch**: an existing seconds value is preserved and shown in the custom segments but cannot be edited through the native picker. If seconds precision must be editable on iOS, collect it through a separate, explicit control. See `TimeField.md` for the same constraint.

## Non-goals

- No datetime range (two fields)
- No inline calendar
- No RTL layout
- No timezone handling (local time only)
- No seconds by default — only via explicit `data-step`

## Known limitations

**Popover clipping in overflow ancestors.** The calendar popup is positioned in normal flow, so a
scroll container — or a scrolling table cell — around this component clips it. The escape (top layer
via the Popover API, or a portal) and its feature-detection are the consuming project's layer: see
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations).

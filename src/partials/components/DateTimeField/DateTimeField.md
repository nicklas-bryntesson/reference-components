# DateTimeField

Custom accessible datetime input wrapping a hidden `input[type="datetime-local"]`.

## Contract

```html
<div
  class="DateTimeField"
  data-component="DateTimeField"
  data-id="UNIQUE_ID"
  data-name="INPUT_NAME"
  data-locale="sv-SE"
>
  <input type="datetime-local" class="DateTimeField-native" tabindex="-1" aria-hidden="true">
  <div class="DateTimeField-overlay">
    <div class="Segments" role="group"></div>
    <button class="DateTimeField-trigger" type="button"><!-- calendar icon SVG --></button>
  </div>
  <template class="DateTimeField-calendarTemplate">
    <div class="DateTimeField-popup" role="dialog" aria-modal="true">
      <div class="CalendarInner">
        <div class="CalendarLeft">
          <div class="CalendarHeader">
            <button class="CalendarPrev" type="button">&#8249;</button>
            <button class="MonthYearTrigger" type="button" aria-expanded="false"><span class="CalendarMonthYear"></span></button>
            <button class="CalendarNext" type="button">&#8250;</button>
          </div>
          <div class="Panel" data-panel="calendar" data-active="true">
            <table class="CalendarGrid" role="grid"></table>
          </div>
          <div class="Panel YearMonthPicker WheelColumns" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
        </div>
        <div class="TimeColumns WheelColumns">
          <div class="Wheel" data-segment="hour" tabindex="0"></div>
          <div class="Wheel" data-segment="minute" tabindex="0"></div>
          <div class="Wheel" data-segment="second" tabindex="0" style="display:none"></div>
          <div class="DateTimeField-ampm" role="group" hidden></div>
        </div>
      </div>
      <div class="CalendarFooter">
        <button type="button" class="CalendarFooterClear"></button>
        <button type="button" class="CalendarFooterToday"></button>
        <button type="button" class="CalendarFooterNow"></button>
      </div>
      <div class="arrow"></div>
    </div>
  </template>
  <div class="slideContainer"></div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
</div>
```

JS injects the segment spinbuttons into `.Segments` and the day cells into `.CalendarGrid`, and clones
the `<template>` into `.slideContainer` on open — do not author those. The five `.Wheel` elements
(two `data-picker` for month/year, three `data-segment` for hour/minute/second) are upgraded by the
`WheelColumn` kernel primitive to `role="spinbutton"`; see
[`src/kernel/js/WheelColumn.md`](../../../kernel/js/WheelColumn.md). The `WheelColumns` class on the
picker panel and `.TimeColumns` is required — the kernel `Wheel.css` styles the wheel band and fade
on it. The `data-panel="calendar"` and
`data-panel="picker"` panels swap via `data-active`; the second segment and `.DateTimeField-ampm` stay
hidden unless `data-step < 60` / a 12-hour locale applies. JS gives `.MonthYearTrigger` an
`aria-controls` pointing at the picker panel and toggles its `aria-expanded` on picker open/close; it
deliberately carries no `aria-haspopup` (the trigger swaps an in-dialog panel of spinbutton wheels,
not a listbox popup).

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

### State attributes (set by JS)

| Attribute | Set when |
|---|---|
| `data-initialized="true"` | Component mounted |
| `data-open="true"` | Popup is open |
| `data-input-mode` | `"custom"` or `"display"` — chosen at init via `matchMedia('(pointer: coarse)')` |
| `data-direction` | `"top"` or `"bottom"` — which side of the trigger the popup opens on |

JS also sets two inline custom properties on the root while the popup is open: `--dtf-popup-offset` (horizontal popup position, %) and `--dtf-arrow-offset` (arrow position, px).

## Behaviour

- Segment spinbuttons for day/month/year/hour/minute (and second when `step < 60`, AM/PM when locale is 12h)
- Popup: calendar grid on the left, scrollable time columns on the right
- "Nu" footer button sets current datetime
- All segments must be filled before native input is written
- Form reset clears all segments

## Events

- `change` — dispatched on the native input as `new Event('change', { bubbles: true })`, exactly once per actual value change. An equality gate against the native input's current value collapses cascading segment writes (e.g. a calendar selection touches up to seven segments) into a single event. Popup **Clear** also dispatches `change` (value set to `""`).
- Each value change also writes "Selected date and time: <localized label>" (localised) to the `.Announce` live region.

## Accessibility notes

- Native input is `aria-hidden="true"` and `tabindex="-1"`
- `.Segments` has `role="group"` with `aria-roledescription`
- Each spinbutton has `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` — except the AM/PM segment, which gets only `aria-valuenow`/`aria-valuetext` (a 2-state toggle, not a range)
- Popup is `role="dialog"` with `aria-modal="true"`
- Time columns are `.Wheel` spinbuttons — the `WheelColumn` primitive sets `role="spinbutton"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`/`aria-valuetext` (not `listbox`)
- `aria-disabled="true"` on all segments when disabled
- `.Announce` (`aria-live="polite"`, `aria-atomic="true"`, last child of the root) announces the selected date and time on each value change

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

## Required site tokens

The `--dtf-*` design tokens default to host-provided site tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/tokens.css`](../../../css/site/01-Setup/tokens.css)); porting the component without them leaves colours and spacing unset.

- `--MAX--WIDTH--SITE`, `--SITE--PADDING`
- `--SITE--POPOVER--BG`, `--SITE--POPOVER--COLOR`, `--SITE--POPOVER--MUTED`, `--SITE--POPOVER--BORDER--COLOR`, `--SITE--POPOVER--RADIUS`, `--SITE--POPOVER--SHADOW`, `--SITE--POPOVER--PADDING`, `--SITE--POPOVER--HOVER-BG`, `--SITE--POPOVER--ACCENT`, `--SITE--POPOVER--ACCENT-TEXT`

Map onto your design system from the **values** in `tokens.css`, not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Manual accessibility testing

Test with a real screenreader before shipping.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Segment group**
- [ ] When tabbing into the component, the group label is announced
- [ ] First segment announces its type and current value

**Spinbutton segments**
- [ ] Each segment announces its label (Day, Month, Year, Hour, Minute)
- [ ] ArrowUp/Down announces the new value
- [ ] Placeholder state is announced (e.g. "Day, empty")
- [ ] When disabled, segments announce their disabled state

**Calendar popup**
- [ ] Dialog label is announced when popup opens
- [ ] Selected date is indicated in the calendar grid
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
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations) and
[ADR-0012](../../../../docs/adr/0012-popover-clipping-is-a-documented-limitation.md).

## Decision record

The *why* behind this component's cross-cutting choices lives in [`docs/adr/`](../../../../docs/adr/README.md):

- [ADR-0006](../../../../docs/adr/0006-native-control-fallback-on-coarse-pointers.md) — the `data-input-mode` custom/display native fallback
- [ADR-0007](../../../../docs/adr/0007-popover-light-dismiss-never-refocuses-trigger.md) — the picker's Escape-vs-outside-click close paths
- [ADR-0008](../../../../docs/adr/0008-family-wide-field-height-contract.md) — the `2.5rem` field-height / `18px` icon contract

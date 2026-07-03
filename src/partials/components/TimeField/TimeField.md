# TimeField

An accessible time input wrapping `<input type="time">`. Custom spinbutton segments for keyboard interaction on desktop; native time input on touch devices.

## Attributes

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Applied as `id` on the native input, and as `name` when `data-name` is absent |
| `data-name` | string | Overrides the field `name` (defaults to `data-id`) |
| `data-locale` | BCP 47 | Controls 12h/24h display and segment labels. Resolved as `data-locale` → `<html lang>` → `en`; `sv-SE` is the kitchensink's authored value |
| `data-value` | `HH:mm` or `HH:mm:ss` | Initial value (server-side render) |
| `data-min` | `HH:mm` | Only clamps the popup **Now** button — segments, wheels and the native input are not bounded |
| `data-max` | `HH:mm` | Only clamps the popup **Now** button — segments, wheels and the native input are not bounded |
| `data-step` | number (seconds) | Step in seconds. Values < 60 show the seconds segment. Default: 60 |
| `data-disabled` | boolean | Disables the entire field |
| `data-invalid` | boolean | Marks the field invalid — styling hook only; the author must also set `aria-invalid="true"` on the native input (as the kitchensink states do) |
| `data-input-mode` | `custom` \| `display` | Set by JS: `custom` on fine pointers (spinbutton overlay), `display` on touch (native picker) — via `matchMedia('(pointer: coarse)')` |

State attributes set by JS: `data-initialized`, `data-open`, `data-has-value`, `data-direction`, and `aria-expanded` on the trigger. All are styling hooks in `TimeField.css`.

## Segments

- **hour** — 00–23 (24h) or 01–12 (12h)
- **minute** — 00–59
- **second** — 00–59, only rendered when `data-step < 60`
- **ampm** — AM/PM, only rendered for 12h locales (e.g. en-US)

## Keyboard

| Key | Action |
|-----|--------|
| `0`–`9` | Digit entry with fast-advance |
| `ArrowUp` / `ArrowDown` | Increment / decrement with wrap |
| `ArrowLeft` / `ArrowRight` | Move between segments |
| `Tab` / `Shift+Tab` | Leave the segment group (roving tabindex — the segments are one tab stop): Tab moves to the trigger, Shift+Tab exits the field |
| `Backspace` | Clear segment, move left |
| `A` / `P` | Set AM / PM (ampm segment only) |
| `Tab` (popup) | Cyclic focus trap: wheels → footer buttons (Clear, Now) |
| `Escape` | Close popup |

## Popup footer

Two footer buttons, both tab stops inside the popup focus trap:

- **Clear** ("Rensa") — disabled (and skipped by Tab) while the field is empty. Clears the segments and the native value **silently** — no `input`/`change` is dispatched.
- **Now** ("Nu") — writes the current time, clamped to `data-min`/`data-max`. Also written silently.

## Value sync

The native `<input type="time">` value is written only when all active segments are filled. Partial state leaves the native input empty (same contract as DateField).

## Events

The component dispatches `input` and `change` events on the native `<input>` only when a **complete** value is written (all active segments filled). Clearing a filled field with `Backspace` empties the native value without dispatching anything, and the popup **Clear** and **Now** buttons also write silently.

## JS API

`TimeField` is the default export. Statics: `TimeField.attach(parent?)` (instantiate every `.TimeField` root) and `TimeField.registerLocale(locale, strings)`. Instances expose `destroy()`. The pure helpers `parseTimeValue`, `formatSegment` and `wrapValue` are exported for unit tests.

## CSS tokens

All tokens are custom properties on `.TimeField`:

| Token | Description |
|---|---|
| `--tf-border-color` | Segment border |
| `--tf-border-color-hover` | Segment border on hover |
| `--tf-border-color-invalid` | Border color when invalid |
| `--tf-bg-hover` | Background on hover |
| `--tf-color-muted` | Placeholder text color |
| `--tf-trigger-bg-hover` | Trigger button hover background |
| `--tf-trigger-bg-active` | Trigger button active background |
| `--tf-popup-bg` | Popup background |
| `--tf-popup-color` | Popup text color |
| `--tf-popup-border-color` | Popup border |
| `--tf-popup-radius` | Popup border radius |
| `--tf-popup-shadow` | Popup box shadow |
| `--tf-popup-width` | Popup width |
| `--tf-popup-gap` | Gap between field and popup |
| `--tf-site-padding` | Viewport padding read by JS for popup positioning (defaults to `--SITE--PADDING`) |
| `--tf-option-bg-selected` | Selected option background |
| `--tf-option-color-selected` | Selected option text color |

## Kernel dependencies

This component composes shared primitives from [`src/kernel/`](../../../kernel/README.md). Port and verify these once — they are not re-implemented per component.

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/WheelColumn`](../../../kernel/js/WheelColumn.md) | JS | hour/minute/second time wheels |
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | popover placement + arrow offset |
| [`js/popup-interaction`](../../../kernel/js/popup-interaction.md) | JS | popup focus trap (wheels → footer) + wheel-scroll containment |
| [`utils/locale`](../../../kernel/utils/locale.md) | JS | locale resolution + 12h/24h |
| [`css/Wheel.css`](../../../kernel/css/Wheel.md) | CSS | wheel visuals — required wherever `WheelColumn` runs |

`utils/dates` is **not** used — TimeField does its own time parsing (`parseTimeValue`, `formatSegment`, `wrapValue`).

## Required site tokens

The `--tf-*` tokens (see `## CSS tokens`) default to host-provided site tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/tokens.css`](../../../css/site/01-Setup/tokens.css)):

- `--SITE--PADDING`
- `--SITE--POPOVER--BG`, `--SITE--POPOVER--COLOR`, `--SITE--POPOVER--MUTED`, `--SITE--POPOVER--BORDER--COLOR`, `--SITE--POPOVER--RADIUS`, `--SITE--POPOVER--SHADOW`, `--SITE--POPOVER--PADDING`, `--SITE--POPOVER--HOVER-BG`, `--SITE--POPOVER--ACCENT`, `--SITE--POPOVER--ACCENT-TEXT`

Map onto your design system from the **values** in `tokens.css`, not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Platform gotchas

### iOS: no seconds in the native picker

iOS Safari's native `<input type="time">` picker only renders **hour and minute** wheels — it never shows a seconds wheel, regardless of the `step` attribute. This is a long-standing WebKit limitation, not a bug in this component. (Desktop Chrome, by contrast, does render a seconds field when `step < 60`.)

Because the touch interaction model defers to the native input as the real control, a `TimeField` with `data-step` < 60 effectively **degrades to minute precision on iOS touch**: the user can set hour/minute via the native wheel but cannot edit the seconds there. An existing seconds value (e.g. from `data-value="13:45:30"`) is preserved and still displayed in the custom segments, but is not reachable through the native picker.

If seconds precision must be editable on iOS, do not rely on the native picker — collect seconds through a separate, explicit control.

## Non-goals

- No time range (two fields)
- No timezone handling (local time only)
- No 12h UI in the kitchensink (12h is tested via unit tests with en-US locale)
- No inline mode — popup only
- No RTL layout

## Manual accessibility testing

### Desktop screenreader (VoiceOver / NVDA)

- [ ] When tabbing into the field, I hear the label ("Mötestid") and the first segment label ("Timmar")
- [ ] When pressing ArrowUp/Down, I hear the new value announced
- [ ] When pressing Tab to move to the next segment, I hear the segment label
- [ ] When opening the popup with the trigger, I hear "Välj tid" (dialog label)
- [ ] When moving into a column, I hear the column label ("Timmar", "Minuter")
- [ ] When selecting an option in the popup column, the value is reflected in the segment
- [ ] The "Rensa" and "Nu" footer buttons have clear purpose; "Rensa" is not a tab stop while the field is empty
- [ ] When pressing Escape, the popup closes and focus returns to the trigger
- [ ] On a disabled field, I cannot interact with any segment or button
- [ ] The AM/PM segment announces "FM" / "EM" (sv-SE) or "AM" / "PM" (en-US) correctly

### Mobile screenreader (VoiceOver iOS / TalkBack Android)

- [ ] Native time input is shown (not the custom overlay)
- [ ] I can set a time using the native drum-roller (iOS) or time picker (Android)
- [ ] (seconds fields) On iOS, the native picker shows only hour/minute — seconds cannot be set there (see Platform gotchas)
- [ ] The field label is read when I enter the input

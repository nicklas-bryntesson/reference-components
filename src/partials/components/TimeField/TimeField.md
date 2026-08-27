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
| `data-disabled` | `"true"` | Disables the entire field |
| `data-invalid` | `"true"` | Marks the field invalid — styling hook only; the author must also set `aria-invalid="true"` on the native input (as the kitchensink states do) |
| `data-input-mode` | `custom` \| `display` | Set by JS: `custom` on fine pointers (spinbutton overlay), `display` on touch (native picker) — via `matchMedia('(pointer: coarse)')` |

State attributes set by JS: `data-initialized="true"`, `data-open="true"`, `data-has-value="true"` (boolean state always carries the literal value `"true"`, absent when off), `data-direction`, and `aria-expanded` on the trigger. All are styling hooks in `TimeField.css`.

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
| `Tab` / `Shift+Tab` | Leave the segment group (roving tabindex — the segments are one tab stop): Tab moves to the trigger, Shift+Tab exits the field. The tab stop stays on the segment that had focus, so Shift+Tab back from the trigger returns to it — a roving tabindex has to rove **back** or the group becomes keyboard-unreachable |
| `Backspace` | Clear segment, move left |
| `A` / `P` | Set AM / PM (ampm segment only) |
| `Tab` (popup) | Cyclic focus trap: wheels → footer buttons (Clear, Now) |
| `Escape` | Close popup. Opening moves focus into the popup — including a mouse-driven open — because the handler is scoped to the popup and could not otherwise receive the key |

## Popup footer

Two footer buttons, both tab stops inside the popup focus trap:

- **Clear** ("Rensa") — disabled (and skipped by Tab) while the field is empty. Clears the segments and the native value, then dispatches `input` + `change` once.
- **Now** ("Nu") — writes the current time, clamped to `data-min`/`data-max`, then dispatches `input` + `change` once.

Both buttons close the popup and return focus to the trigger: a footer action
completes the value, so the task is done. Spinning the wheels never closes —
the wheel surface edits live, and is left via the trigger, `Escape`, or a
click outside.

## Value sync

The native `<input type="time">` value is written only when all active segments are filled. Partial state leaves the native input empty (same contract as DateField).

## Events

The component dispatches `input` and `change` events on the native `<input>` when a **complete** value is written (all active segments filled) and once per popup **Clear**/**Now** press. Clearing a filled field with `Backspace` empties the native value without dispatching anything.

## JS API

`TimeField` is the default export. Statics: `TimeField.attach(parent?)` (instantiate every `.TimeField` root) and `TimeField.registerLocale(locale, strings)`. Instances expose `destroy()`. The pure helpers `parseTimeValue`, `formatSegment` and `wrapValue` are exported for unit tests.

## CSS tokens

All tokens are custom properties on `.TimeField`:

| Token | Description |
|---|---|
| `--_tf-border-color` | Segment border |
| `--_tf-border-color-hover` | Segment border on hover |
| `--_tf-border-color-invalid` | Border color when invalid |
| `--_tf-bg-hover` | Background on hover |
| `--_tf-color-muted` | Placeholder text color |
| `--_tf-trigger-bg-hover` | Trigger button hover background |
| `--_tf-trigger-bg-active` | Trigger button active background |
| `--_tf-popup-bg` | Popup background |
| `--_tf-popup-color` | Popup text color |
| `--_tf-popup-border-color` | Popup border |
| `--_tf-popup-radius` | Popup border radius |
| `--_tf-popup-shadow` | Popup box shadow |
| `--_tf-popup-width` | Popup width |
| `--_tf-popup-gap` | Gap between field and popup |
| `--_tf-site-padding` | Viewport padding read by JS for popup positioning (defaults to `--SITE--PADDING`) |
| `--_tf-option-bg-selected` | Selected option background |
| `--_tf-option-color-selected` | Selected option text color |

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

## Required tokens

The `--_tf-*` tokens (see `## CSS tokens`) default to the `--ui-*` theming seam (design) and `--SITE--*` layout tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/ui-tokens.css`](../../../css/site/01-Setup/ui-tokens.css)):

- `--SITE--PADDING`
- `--ui-surface`, `--ui-surface-foreground`, `--ui-muted-foreground`, `--ui-border`, `--ui-radius`, `--ui-shadow`, `--ui-surface-padding`, `--ui-hover`, `--ui-primary`, `--ui-primary-foreground`

Map onto your design system from the **values** in `ui-tokens.css` (design) / `tokens.css` (layout), not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

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

## Known limitations

**Popover clipping in overflow ancestors.** The picker popup is positioned in normal flow, so a
scroll container — or a scrolling table cell — around this component clips it. The escape (top layer
via the Popover API, or a portal) and its feature-detection are the consuming project's layer: see
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations).

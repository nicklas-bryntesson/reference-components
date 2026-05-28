# TimeField

An accessible time input wrapping `<input type="time">`. Custom spinbutton segments for keyboard interaction on desktop; native time input on touch devices.

## Attributes

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Applied as `id` and `name` on the native input |
| `data-locale` | BCP 47 | Controls 12h/24h display and segment labels. Default: `sv-SE` |
| `data-value` | `HH:mm` or `HH:mm:ss` | Initial value (server-side render) |
| `data-min` | `HH:mm` | Minimum allowed time |
| `data-max` | `HH:mm` | Maximum allowed time |
| `data-step` | number (seconds) | Step in seconds. Values < 60 show the seconds segment. Default: 60 |
| `data-disabled` | boolean | Disables the entire field |
| `data-invalid` | boolean | Marks the field invalid; adds `aria-invalid="true"` to the native input |

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
| `Tab` / `Shift+Tab` | Move between segments; Tab on last → trigger |
| `Backspace` | Clear segment, move left |
| `A` / `P` | Set AM / PM (ampm segment only) |
| `Escape` | Close popup |

## Value sync

The native `<input type="time">` value is written only when all active segments are filled. Partial state leaves the native input empty (same contract as DateField).

## Events

The component dispatches `input` and `change` events on the native `<input>` when the value changes.

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
| `--tf-popup-border-color` | Popup border |
| `--tf-popup-radius` | Popup border radius |
| `--tf-popup-shadow` | Popup box shadow |
| `--tf-popup-width` | Popup width |
| `--tf-popup-backdrop` | Popup backdrop-filter (glass effect) |
| `--tf-option-bg-selected` | Selected option background |
| `--tf-option-color-selected` | Selected option text color |

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
- [ ] When pressing Escape, the popup closes and focus returns to the trigger
- [ ] On a disabled field, I cannot interact with any segment or button
- [ ] The AM/PM segment announces "FM" / "EM" (sv-SE) or "AM" / "PM" (en-US) correctly

### Mobile screenreader (VoiceOver iOS / TalkBack Android)

- [ ] Native time input is shown (not the custom overlay)
- [ ] I can set a time using the native drum-roller (iOS) or time picker (Android)
- [ ] The field label is read when I enter the input

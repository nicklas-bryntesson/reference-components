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
    <div class="Segments" role="group" aria-label="…"></div>
    <button class="DateTimeField-trigger" type="button"><!-- icon --></button>
  </div>
  <template class="DateTimeField-calendarTemplate">
    <!-- see DateTimeField.html for full template markup -->
  </template>
  <div class="slideContainer"></div>
</div>
```

## Attributes

### On root element

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Unique field ID (required) |
| `data-name` | string | Native input name (required) |
| `data-locale` | BCP 47 | Controls segment order and 12h/24h |
| `data-min` | `YYYY-MM-DDTHH:mm` | Minimum allowed datetime |
| `data-max` | `YYYY-MM-DDTHH:mm` | Maximum allowed datetime |
| `data-disabled` | boolean | Disables the component |
| `data-invalid` | boolean | Marks field invalid, adds `aria-invalid` |
| `data-value` | `YYYY-MM-DDTHH:mm` | Initial value (server-render) |
| `data-step` | number (seconds) | Shows second segment when < 60 |

### State attributes (set by JS)

| Attribute | Set when |
|---|---|
| `data-initialized` | Component mounted |
| `data-open` | Popup is open |

## Behaviour

- Segment spinbuttons for day/month/year/hour/minute (and second when `step < 60`, AM/PM when locale is 12h)
- Popup: calendar grid on the left, scrollable time columns on the right
- "Nu" footer button sets current datetime
- All segments must be filled before native input is written
- Form reset clears all segments

## Accessibility notes

- Native input is `aria-hidden="true"` and `tabindex="-1"`
- `.Segments` has `role="group"` with `aria-roledescription`
- Each spinbutton has `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
- Popup is `role="dialog"` with `aria-modal="true"`
- Time columns are `role="listbox"` with `aria-label`
- `aria-disabled="true"` on all segments when disabled

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

**Time columns**
- [ ] Each listbox announces its label (Hours, Minutes, Seconds)
- [ ] ArrowUp/Down announces the selected hour/minute value
- [ ] Selected option is indicated as "selected"

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

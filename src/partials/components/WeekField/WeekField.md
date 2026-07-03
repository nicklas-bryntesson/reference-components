# WeekField

An accessible week input wrapping `<input type="week">`. The value is a `YYYY-Www` string (ISO week-numbering year + ISO week, e.g. `2026-W27`). Custom spinbutton segments for keyboard interaction on desktop; the native week input on touch devices where the platform supports it.

The popup picker is **DateField's calendar with whole-week selection plus a leading week-number column** — matching the native week pickers (iOS Safari 18.2+, Chrome desktop). The unit of selection is a **whole ISO week (a table row)**, not a single day. There is **no wheel picker**.

Completes the date family alongside DateField, DateTimeField, TimeField, and MonthField.

## The selection model (the core difference from DateField)

- The calendar renders month grids with a **leading week-number column** (`getISOWeek` per row).
- Hovering a row previews the whole week; clicking **any day in the row — or the week number — selects that week**. The selected row is highlighted end-to-end.
- The value is `formatWeekISO(getISOWeekYear(mondayOfRow), getISOWeek(mondayOfRow))`.
- **ISO week-year correctness:** the week-numbering year differs from the visible month's calendar year at the Jan/Dec boundary (Mon 2025-12-29 → `2026-W01`; 2027-01-01 → `2026-W53`). The component always derives the year from the kernel helpers on the row's Monday, **never** from the visible month.

## Attributes

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Applied as `id` and `name` on the native input |
| `data-name` | string | Overrides the field `name` (defaults to `data-id`) |
| `data-locale` | BCP 47 | Controls segment labels, weekday/month names. Resolved as `data-locale` → `<html lang>` → `en`; `sv-SE` is the kitchensink's authored value |
| `data-value` | `YYYY-Www` | Initial value (server-side render) |
| `data-min` | `YYYY-Www` | Minimum allowed week; bounds the segments and disables earlier week rows |
| `data-max` | `YYYY-Www` | Maximum allowed week; bounds the segments and disables later week rows |
| `data-disabled` | boolean | Disables the entire field |
| `data-invalid` | boolean | Marks the field invalid — styling hook only; the author must also set `aria-invalid="true"` on the native input (as the kitchensink states do) |
| `data-input-mode` | `custom` \| `display` | Set by JS: `custom` on desktop / where native week is unsupported, `display` on touch with native week support |

State attributes set by JS: `data-initialized`, `data-open`, `data-has-value`, `data-direction`, and `aria-expanded` on the trigger.

## Native fallback (feature detection)

`<input type="week">` is supported by Chrome/Edge/Chrome-Android/Samsung and iOS Safari 18.2+, but **not** Firefox (any platform) or desktop Safari. The component detects support:

```js
function supportsNativeWeek() { const i = document.createElement('input'); i.type='week'; i.value='x'; return i.value !== 'x'; }
```

- **Touch AND native week supported** → `data-input-mode="display"`: a transparent native `<input type="week">` sits over the custom appearance as a tap layer, opening the platform week picker.
- **Native week NOT supported** (Firefox, Safari desktop) → `data-input-mode="custom"` **even on touch** — a native `<input type="week">` there degrades to a plain text field, so the custom UI is always the better experience.
- **Desktop (any browser)** → `custom`.

In every mode the value written to the native input is a valid `YYYY-Www` string, so the field submits correctly even when the browser treats it as text.

## Segments

Two inline spinbutton segments, in order **week → year** separated by `/`, prefixed with a localized "week" abbreviation (`v.` / `Wk`). The segments group carries a localized `aria-roledescription` so AT announces it as a week field:

- **week** — `role="spinbutton"`, `aria-valuemin="1"`, `aria-valuemax` = **52 or 53** depending on the current year (an ISO year has 53 weeks iff Dec 28 falls in week 53). Displays a zero-padded number ("27"). `aria-valuetext` carries a human label so AT announces e.g. "Vecka 27, 2026" (O1).
- **year** — `role="spinbutton"`, bounds from `data-min`/`data-max`, or the current ISO week-year ±100 when unbounded (O3). Displays the plain 4-digit year. Changing the year re-clamps the week segment to that year's valid max.

## Keyboard

### Segments

| Key | Action |
|-----|--------|
| `0`–`9` | Digit entry. Week accepts 1–max with fast-advance (a first digit ≥6 commits); year accepts up to 4 digits |
| `ArrowUp` / `ArrowDown` | Week steps ±1 and **wraps** at the year boundary (1 ↔ 52/53); year steps ±1 and **clamps** to bounds |
| `ArrowLeft` / `ArrowRight` | Move between segments |
| `Tab` / `Shift+Tab` | Leave the segment group (roving tabindex — the segments are one tab stop): Tab moves to the trigger, Shift+Tab exits the field |
| `Backspace` | Clear segment, move left |
| `Space` / `Enter` (trigger) | Open the popup; focus moves into the week grid |

### Calendar (week grid) — whole-week model (O5)

| Key | Action |
|-----|--------|
| `ArrowUp` / `ArrowDown` | Move the row highlight to the previous / next week |
| `ArrowLeft` / `ArrowRight` | Also ±1 week (there is no single-day focus in a week picker) |
| `PageUp` / `PageDown` | Previous / next month |
| `Enter` / `Space` | Select the focused week (apply + close) |
| `Escape` | Close the popup; focus returns to the trigger |
| `Tab` / `Shift+Tab` | Cyclic focus trap via `popup-interaction`: prev-nav → grid (one composite stop) → next-nav → footer |

The date grid is a **single composite tab stop** (WAI-ARIA grid pattern): roving tabindex lives on the `<tr>` rows (one `tabindex="0"`, the rest `-1`), so Tab enters/leaves the grid as a unit and arrow keys move within it.

Light-dismiss (outside click) closes the popup but **never** calls `trigger.focus()` — this avoids scroll-jump and focus-steal (TimeField is the reference for this rule).

## Value sync

The native `<input type="week">` value is written as `YYYY-Www` only when **both** segments are filled. Partial state leaves the native input empty (same contract as DateField/MonthField). When `data-min`/`data-max` are set, the combined value is clamped before it reaches the native input, and the correction is reflected back into the segments.

## Events

The component dispatches `input` and `change` events on the native `<input>` only when a **complete** value is written: both segments filled, a week selected in the calendar, or **Denna vecka** (This week) pressed. The popup **Rensa** (Clear) button also dispatches both events — the same contract as TimeField/MonthField. Clearing a filled field with `Backspace` empties the native value without dispatching anything.

## JS API

`WeekField` is the default export. Statics: `WeekField.attach(parent?)` (instantiate every `.WeekField` root), `WeekField.registerLocale(locale, strings)` and `WeekField.supportsNativeWeek()` (feature detection). Instances expose `destroy()`. The pure helpers `formatSegment`, `wrapValue`, `clampValue`, `weeksInISOYear` and `clampWeekISO` are exported for unit tests.

## CSS tokens

All tokens are custom properties on `.WeekField`:

| Token | Description |
|---|---|
| `--wf-border-color` | Segment border |
| `--wf-border-color-hover` | Segment border on hover |
| `--wf-border-color-invalid` | Border color when invalid |
| `--wf-bg-hover` | Background on hover / week-row preview |
| `--wf-color-muted` | Placeholder / separator / week-number text color |
| `--wf-trigger-bg-hover` | Trigger button hover background |
| `--wf-trigger-bg-active` | Trigger button active background |
| `--wf-popup-bg` | Popup background |
| `--wf-popup-color` | Popup text color |
| `--wf-popup-color-muted` | Muted popup text (weekday heads, outside-month days, week numbers) |
| `--wf-popup-border-color` | Popup border + week-column divider |
| `--wf-popup-radius` | Popup border radius |
| `--wf-popup-shadow` | Popup box shadow |
| `--wf-popup-width` | Popup width |
| `--wf-popup-gap` | Gap between field and popup |
| `--wf-site-padding` | Viewport padding read by JS for popup positioning (defaults to `--SITE--PADDING`) |
| `--wf-popup-link-color` | Footer button text color |
| `--wf-option-bg-selected` | Selected week-row background |
| `--wf-option-color-selected` | Selected week-row text color |

## Kernel dependencies

This component composes shared primitives from [`src/kernel/`](../../../kernel/README.md). Port and verify these once — they are not re-implemented per component. **Note: WeekField does NOT use `WheelColumn` — it is a calendar-grid picker, not a wheel picker.**

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | popover placement + arrow offset |
| [`js/popup-interaction`](../../../kernel/js/popup-interaction.md) | JS | popup focus trap (nav → grid → footer) + scroll containment |
| [`utils/dates`](../../../kernel/utils/dates.md) | JS | `getISOWeek`, `getISOWeekYear`, `getDateOfISOWeek`, `formatWeekISO`, `parseWeekISO`, plus `getMonthName`, `getWeekdayNames`, `getDaysInMonth`, `getFirstWeekdayOfMonth` for grid rendering |
| [`utils/locale`](../../../kernel/utils/locale.md) | JS | locale resolution |

## Required site tokens

The `--wf-*` tokens (see `## CSS tokens`) default to host-provided site tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/tokens.css`](../../../css/site/01-Setup/tokens.css)); porting the component without them leaves colours and spacing unset.

- `--SITE--PADDING`
- `--SITE--POPOVER--BG`, `--SITE--POPOVER--COLOR`, `--SITE--POPOVER--MUTED`, `--SITE--POPOVER--BORDER--COLOR`, `--SITE--POPOVER--RADIUS`, `--SITE--POPOVER--SHADOW`, `--SITE--POPOVER--PADDING`, `--SITE--POPOVER--HOVER-BG`, `--SITE--POPOVER--ACCENT`, `--SITE--POPOVER--ACCENT-TEXT`

Map onto your design system from the **values** in `tokens.css`, not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Non-goals

- No wheel picker (this is a calendar-grid week picker; MonthField owns the wheel model)
- No single-day selection (the whole week is the unit — DateField owns day selection)
- No week-range selection (two fields)
- No inline mode — popup only
- No top-layer / popover-clip fix (deferred to consuming projects)
- No RTL layout

## Manual accessibility testing

Test with a real screenreader before shipping. Sources: `docs/atomica11y/form/date-picker-dialog.md`, `docs/atomica11y/form/text-input.md`, `docs/atomica11y/form/hint-help-or-error.md`.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Segments**
- [ ] When tabbing into the field, I hear the label ("Mötesvecka") and the first segment label ("Vecka")
- [ ] Each segment identifies itself as an editable input (spinbutton)
- [ ] Pressing ArrowUp/Down announces the new value; the week announces "Vecka 27, 2026", not just "27"
- [ ] The week segment wraps at the year boundary (1 ↔ 52/53); the year segment stops at its bounds
- [ ] Tab to the next segment reads the segment label ("År")
- [ ] Disabled/required state is expressed if applicable

**Week trigger**
- [ ] Purpose is clear ("Öppna veckoväljare" or localised equivalent)
- [ ] Identifies as a button with popup/dialog indicator
- [ ] Expresses expanded/collapsed state

**Picker dialog (week grid)**
- [ ] Dialog title or purpose is announced on open ("Välj vecka")
- [ ] Identifies itself as a dialog/modal
- [ ] The grid identifies as a table/grid
- [ ] Moving through the grid announces each **week** (e.g. "Vecka 27, 29 juni – 5 juli"), not individual days
- [ ] The selected week row expresses its selected state
- [ ] Out-of-range weeks express a disabled/unavailable state
- [ ] ArrowUp/Down moves by a whole week; PageUp/Down moves by a month
- [ ] "Denna vecka" and "Rensa" buttons have clear purpose
- [ ] Pressing Escape closes the popup and focus returns to the trigger
- [ ] Content behind the dialog is not the focus target while open

**Invalid state**
- [ ] When `data-invalid` is set, the error is announced automatically
- [ ] Error is read after the input name, role, and state

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Where native week is supported (iOS 18.2+, Chrome/Samsung Android), the native week input is shown (not the custom overlay)
- [ ] Swipe to the control — purpose is clear
- [ ] Double-tap opens the native week picker
- [ ] I can set a week + year using the native picker
- [ ] The field label is read when I enter the input
- [ ] On a browser without native week support, the custom grid is used and behaves as the desktop dialog above

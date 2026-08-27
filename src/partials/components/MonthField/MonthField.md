# MonthField

An accessible month input wrapping `<input type="month">`. The value is a `YYYY-MM` string (year + month, no day). Custom spinbutton segments for keyboard interaction on desktop; the native month input on touch devices. The popup picker is two spinning wheels — a month wheel and a year wheel — with **no calendar day grid**.

Completes the date family alongside DateField, DateTimeField, and TimeField.

## Attributes

| Attribute | Type | Description |
|---|---|---|
| `data-id` | string | Applied as `id` and `name` on the native input |
| `data-name` | string | Overrides the field `name` (defaults to `data-id`) |
| `data-locale` | BCP 47 | Controls segment/wheel labels and month names. Resolved as `data-locale` → `<html lang>` → `en`; `sv-SE` is the kitchensink's authored value |
| `data-value` | `YYYY-MM` | Initial value (server-side render) |
| `data-min` | `YYYY-MM` | Minimum allowed month; bounds the year wheel and the segments — the month wheel always spans all 12 months, and out-of-range combinations are corrected (`_enforceBounds`) |
| `data-max` | `YYYY-MM` | Maximum allowed month; bounds the year wheel and the segments — the month wheel always spans all 12 months, and out-of-range combinations are corrected (`_enforceBounds`) |
| `data-disabled` | `"true"` | Disables the entire field |
| `data-invalid` | `"true"` | Marks the field invalid — styling hook only; the author must also set `aria-invalid="true"` on the native input (as the kitchensink states do) |
| `data-input-mode` | `custom` \| `display` | Set by JS: `custom` on fine pointers (spinbutton overlay), `display` on touch (native picker) |

State attributes set by JS: `data-initialized="true"`, `data-open="true"`, `data-has-value="true"` (boolean state always carries the literal value `"true"`, absent when off), `data-direction`, and `aria-expanded` on the trigger.

## Segments

Two inline spinbutton segments, in order **month → year** separated by `/`:

- **month** — `role="spinbutton"`, `aria-valuemin="0"` / `aria-valuemax="11"`. Displays a **zero-padded 1-based number** ("06" for June); `aria-valuenow` is the **0-based index** (5) so it stays consistent with the wheel. `aria-valuetext` carries a human label so AT announces e.g. "juni 2026" (O2).
- **year** — `role="spinbutton"`, bounds derived from `data-min`/`data-max`, or the current year ±100 when unbounded (O5). Displays the plain 4-digit year.

The popup **month wheel** shows the localized month **name** ("Juni"); the inline month **segment** shows the number ("06"). Both surfaces carry the human label in `aria-valuetext` (O2).

Empty segments remove `aria-valuenow` and speak the localized `empty` word ("blank"/"tomt") as `aria-valuetext` — never the visible placeholder, and never no valuetext at all (min/max without valuenow makes VoiceOver announce a computed percentage). Same contract as DateField.

## Keyboard

| Key | Action |
|-----|--------|
| `0`–`9` | Digit entry. Month accepts a 1-based value (1–12) with fast-advance; year accepts up to 4 digits |
| `ArrowUp` / `ArrowDown` | Month steps ±1 and **wraps** Dec↔Jan; year steps ±1 and **clamps** to bounds |
| `ArrowLeft` / `ArrowRight` | Move between segments |
| `Tab` / `Shift+Tab` | Leave the segment group (roving tabindex — the segments are one tab stop): Tab moves to the trigger, Shift+Tab exits the field. The tab stop stays on the segment that had focus, so Shift+Tab back from the trigger returns to it — a roving tabindex has to rove **back** or the group becomes keyboard-unreachable |
| `Backspace` | Clear segment, move left |
| `Space` / `Enter` (trigger) | Open the popup; focus stays on the trigger — Tab moves into the wheels |
| `ArrowUp` / `ArrowDown` (wheel) | `WheelColumn.stepBy` — spin the focused wheel |
| `Tab` (popup) | Cycle month wheel → year wheel → footer buttons |
| `Escape` | Close the popup; focus returns to the trigger. Opening moves focus into the popup — including a mouse-driven open — because the handler is scoped to the popup and could not otherwise receive the key |

Light-dismiss (outside click) closes the popup but **never** calls `trigger.focus()` — this avoids scroll-jump and focus-steal (TimeField is the reference for this rule).

## Value sync

The native `<input type="month">` value is written as `YYYY-MM` only when **both** segments are filled. Partial state leaves the native input empty (same contract as DateField/TimeField). When `data-min`/`data-max` are set, the combined value is clamped before it reaches the native input, and the correction is reflected back into the segments.

## Events

The component dispatches `input` and `change` events on the native `<input>` when a **complete** value is written (both segments filled) and once per popup **Rensa** (Clear) / **Denna månad** (This month) press. **Denna månad** also speaks the committed month via the `.announce` live region (closing moves focus to the trigger, which says nothing about *what* was set). Clearing a filled field with `Backspace` empties the native value without dispatching anything.

Both footer buttons close the popup and return focus to the trigger: a footer
action completes the value, so the task is done. Spinning the wheels never
closes — the wheel surface edits live, and is left via the trigger, `Escape`,
or a click outside.

## JS API

`MonthField` is the default export. Statics: `MonthField.attach(parent?)` (instantiate every `.MonthField` root) and `MonthField.registerLocale(locale, strings)`. Instances expose `destroy()`. The pure helpers `formatSegment`, `wrapValue`, `clampValue` and `clampMonthISO` are exported for unit tests.

## CSS tokens

All tokens are custom properties on `.MonthField`:

| Token | Description |
|---|---|
| `--_mf-border-color` | Segment border |
| `--_mf-border-color-hover` | Segment border on hover |
| `--_mf-border-color-invalid` | Border color when invalid |
| `--_mf-bg-hover` | Background on hover |
| `--_mf-color-muted` | Placeholder / separator text color |
| `--_mf-trigger-bg-hover` | Trigger button hover background |
| `--_mf-trigger-bg-active` | Trigger button active background |
| `--_mf-popup-bg` | Popup background |
| `--_mf-popup-color` | Popup text color |
| `--_mf-popup-border-color` | Popup border |
| `--_mf-popup-radius` | Popup border radius |
| `--_mf-popup-shadow` | Popup box shadow |
| `--_mf-popup-gap` | Gap between field and popup |
| `--_mf-site-padding` | Viewport padding read by JS for popup positioning (defaults to `--SITE--PADDING`) |
| `--_mf-option-bg-selected` | Selected option background |
| `--_mf-option-color-selected` | Selected option text color |

There is no popup width token — the popup sizes to `fit-content`; the month + year columns define the width.

## Kernel dependencies

This component composes shared primitives from [`src/kernel/`](../../../kernel/README.md). Port and verify these once — they are not re-implemented per component.

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/WheelColumn`](../../../kernel/js/WheelColumn.md) | JS | month + year picker wheels |
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | popover placement + arrow offset |
| [`js/popup-interaction`](../../../kernel/js/popup-interaction.md) | JS | popup focus trap (wheels → footer) + wheel-scroll containment |
| [`utils/dates`](../../../kernel/utils/dates.md) | JS | `getMonthName`, `formatMonthISO`, `parseMonthISO` |
| [`utils/locale`](../../../kernel/utils/locale.md) | JS | locale resolution |
| [`css/Wheel.css`](../../../kernel/css/Wheel.md) | CSS | wheel visuals — required wherever `WheelColumn` runs |

## Required tokens

The `--_mf-*` tokens (see `## CSS tokens`) default to the `--ui-*` theming seam (design) and `--SITE--*` layout tokens. A consumer must declare these (reference values live in [`src/css/site/01-Setup/ui-tokens.css`](../../../css/site/01-Setup/ui-tokens.css)); porting the component without them leaves colours and spacing unset.

- `--SITE--PADDING`
- `--ui-surface`, `--ui-surface-foreground`, `--ui-muted-foreground`, `--ui-border`, `--ui-radius`, `--ui-shadow`, `--ui-surface-padding`, `--ui-hover`, `--ui-primary`, `--ui-primary-foreground`

Map onto your design system from the **values** in `ui-tokens.css` (design) / `tokens.css` (layout), not from the names alone. The reference popover colours are CSS **system colors** (`Canvas`, `CanvasText`, `color-mix(in srgb, CanvasText 12%, transparent)`): this gives free dark-mode support and makes `axe` treat the colour as un-evaluable, so faded/transient text never trips a contrast check. Substituting fixed hex values is valid but a deliberate divergence — you then own contrast yourself.

## Non-goals

- No calendar day grid (this is a month picker — DateField owns day selection)
- No month-range selection (two fields)
- No inline mode — popup only
- No top-layer / popover-clip fix (deferred to consuming projects)
- No RTL layout

## Manual accessibility testing

Test with a real screenreader before shipping. Sources: `docs/atomica11y/form/date-picker-dialog.md`, `docs/atomica11y/form/text-input.md`, `docs/atomica11y/form/hint-help-or-error.md`.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Segments**
- [ ] When tabbing into the field, I hear the label ("Mötesmånad") and the first segment label ("Månad")
- [ ] Each segment identifies itself as an editable input (spinbutton)
- [ ] Pressing ArrowUp/Down announces the new value; the month announces its name + year (e.g. "juni 2026"), not just "06"
- [ ] The month segment wraps Dec↔Jan; the year segment stops at its bounds
- [ ] Tab to the next segment reads the segment label ("År")
- [ ] Disabled/required state is expressed if applicable

**Month trigger**
- [ ] Purpose is clear ("Öppna månadsväljare" or localised equivalent)
- [ ] Identifies as a button with popup/dialog indicator
- [ ] Expresses expanded/collapsed state

**Picker dialog**
- [ ] Dialog title or purpose is announced on open ("Välj månad")
- [ ] Identifies itself as a dialog/modal
- [ ] Moving into a wheel reads the wheel label ("Månad", "År")
- [ ] The month wheel announces the month **name**; the year wheel announces the number
- [ ] Selecting/spinning a wheel reflects the value in the inline segment
- [ ] "Denna månad" and "Rensa" buttons have clear purpose
- [ ] Pressing Escape closes the popup and focus returns to the trigger
- [ ] Content behind the dialog is not the focus target while open

**Invalid state**
- [ ] When `data-invalid="true"` is set, the error is announced automatically
- [ ] Error is read after the input name, role, and state

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Native month input is shown (not the custom overlay)
- [ ] Swipe to the control — purpose is clear
- [ ] Double-tap opens the native month picker
- [ ] I can set a month + year using the native picker
- [ ] The field label is read when I enter the input

## Known limitations

**Popover clipping in overflow ancestors.** The picker popup is positioned in normal flow, so a
scroll container — or a scrolling table cell — around this component clips it. The escape (top layer
via the Popover API, or a portal) and its feature-detection are the consuming project's layer: see
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations).

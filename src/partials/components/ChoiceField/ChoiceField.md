# ChoiceField

A styled **native** `<input type="radio">` or `<input type="checkbox">` + `<label>` —
**one component, keyed on the native `type` attribute**. Radio and checkbox
share a single skeleton: the input itself is the box (`appearance: none` + border), and
the `::after` is the mark. `type` is the discriminator, not an invented API — so both the
behaviour (single-select via a shared `name` + arrow roving, vs independent toggle) and
the visuals (circle + dot, vs square + tick) follow the one attribute native already owns.

There is no JavaScript: the native input is the single source of truth. Group several
under a `<fieldset><legend>` with **ChoiceGroup** (built next).

## Contract

**Checkbox** — independent; no shared `name`:

```html
<span class="ChoiceField">
  <input type="checkbox" id="notify-email" name="notify-email">
  <label for="notify-email">Email notifications</label>
</span>
```

**Radio** — a single-selection group shares one `name`:

```html
<span class="ChoiceField">
  <input type="radio" id="ship-standard" name="shipping" checked>
  <label for="ship-standard">Standard</label>
</span>
<span class="ChoiceField">
  <input type="radio" id="ship-express" name="shipping">
  <label for="ship-express">Express</label>
</span>
```

Contract rules (enforced by the unit test against this file's kitchensink):

- **`for` must equal `id`; `id`s are unique.** A mismatch or duplicate focuses the wrong
  control or nothing.
- **Radio: one unique `name` per group.** All options in a single-selection group share
  exactly one `name` — that is what makes them mutually exclusive. `name` is an authored
  end-state, not a JS-distributed prop (a framework may distribute it from a prop, a
  server may render it, our reference authors it — the contract is the finished DOM).
- **Checkbox: independent** — no shared `name`.

## HTML Authoring API

| Attribute | Values | Notes |
|---|---|---|
| `type` | `checkbox` · `radio` | The discriminator — drives both behaviour and skin |
| `name` | string | Radio: shared across a group. Checkbox: independent |
| `checked` | present / absent | Initial state (radio: at most one per group) |
| `disabled` | present / absent | Functional state — `pointer-events: none`, so no hover/focus |
| `required` | present / absent | Native constraint validation |
| `data-invalid` | `"true"` on the root | Visual invalid skin (pair with `aria-invalid="true"`) |
| `data-test-state` | `hover` · `focus` · `active` on the root | **Kitchensink only** — simulated pseudo-class |

## CSS Variable API

Override on the `.ChoiceField` element (or any rule that targets it — e.g.
`.my-theme .ChoiceField { --cf-selected: … }`). An ancestor or `:root` override is
**shadowed** by the component's own defaults on the root, so it must target `.ChoiceField`
itself. Neutral, monochrome defaults on system colours — the component **takes** design;
override `--cf-selected` to push an accent.

| Variable | Default | Description |
|---|---|---|
| `--cf-size` | `1.5em` | Control box size — `em` so the control scales with its local text (≈24px at 16px); the tick (0.82×) and dot (0.6×) follow proportionally |
| `--cf-gap` | `0.5rem` | Space between box and label |
| `--cf-border-width` | `1px` | Box border |
| `--cf-radius` | `0.25rem` | Checkbox corner (radio is always `50%`) |
| `--cf-border-color` | `currentColor` | Unselected border |
| `--cf-border-color-hover` | `CanvasText` | Hover / active border |
| `--cf-border-color-invalid` | `#c00` | Invalid border |
| `--cf-bg-hover` | `var(--SITE--POPOVER--HOVER-BG)` | Hover / active fill (unselected) |
| `--cf-selected` | `CanvasText` | Checkbox fill · radio ring + dot — **override for accent** |
| `--cf-mark-color` | `Canvas` | Checkbox tick colour on the filled box |
| `--cf-mark` | inline check SVG | Tick shape (a `mask`; fill colour is irrelevant) |

### Why one icon, and why neutral

The tick is a single `mask-image` tinted by `--cf-mark-color`, so one shape serves both
checked and disabled-checked — the colour is a token swap, not a second SVG. Defaults are
monochrome (system colours) to match the rest of the field family (AffixField, WeekField):
a reference skeleton should look like every other field until the host paints it.

## Accessibility

### Semantics come from native

`role` (checkbox/radio), state announcement, Space to toggle, arrow-key roving (radio),
single-selection, form participation and label association are all native. We add no ARIA
beyond the optional `aria-invalid="true"` that mirrors `data-invalid`.

### Forced colors (Windows High Contrast) — required

An `appearance: none` control loses its selection glyph in forced-colors mode. The shipped
`@media (forced-colors: active)` block redraws the selected state from system colour
keywords (`Highlight` / `HighlightText`). The unselected box already uses `currentColor` +
`Canvas`, which forced-colors maps on its own. Do not delete the block when porting.

### Focus and target size

- Focus uses `outline: 2px solid` (currentColor) via `:focus-visible` — the same treatment
  as the rest of the field family; it survives forced-colors (a `box-shadow` ring would not).
- The box is ~20px; the clickable target is the box **plus** its label, which clears the
  WCAG 2.5.8 (24px) minimum. Keep the label present and wired (`for`/`id`).

### Motion

The mark's fade/scale-in respects `prefers-reduced-motion: reduce`.

### Manual accessibility testing (definition of done — atomica11y checkbox & radio §2–3)

- [ ] **Desktop SR (NVDA/JAWS/VoiceOver):** Tab to a control — I HEAR its label, role (checkbox / radio button), and state (checked/unchecked/selected, disabled).
- [ ] Checkbox: Space toggles — I HEAR the new state. Radio: arrow keys move + select — I HEAR each new selection.
- [ ] When grouped (ChoiceGroup), I HEAR the group name (from `<legend>`) and any hint/error after the label.
- [ ] **Mobile SR:** swipe focuses a control with label + role + state; double-tap toggles/selects and announces.
- [ ] **200% text zoom:** label and box resize without clipping or overlap.

## Testing strategy

Because behaviour is native, the test centre of gravity differs from the date family:

- **Unit (`tests/ChoiceField.unit.test.ts`, jsdom):** no logic to test — it guards the
  markup-contract invariants native cannot self-enforce, parsed from this file's own
  kitchensink: for/id integrity, unique `id`s, a label per control, both `type`s exercised,
  and the radio-only rule that the live group shares exactly one `name` with one selection.
- **E2E (`tests/ChoiceField.e2e.test.js`, Playwright + axe):** verifies native actually
  delivers the contract in a real browser — checkbox Space/label toggle, radio arrow
  roving + single-selection, label-click for both, disabled can't toggle, the
  `appearance:none` box renders at size, focus draws an outline, axe clean.

## Non-goals

- **No JS / no roving-tabindex reimplementation** — native does it; that is the whole
  reason to stay native rather than build a stateful group component.
- **No grouping here** — `<fieldset><legend>` grouping (and single-vs-multiple cardinality)
  is ChoiceGroup's job. Cardinality is a *group* property, not a field one.
- **No card / chip / segmented layouts** — those are skins (ChoiceGroup) or their own
  components (a chip Picklist, a segmented Toggle).
- **Not an action control** — if it triggers something instead of submitting a value, it's
  a ButtonGroup, not a ChoiceField (the selection-vs-action test).

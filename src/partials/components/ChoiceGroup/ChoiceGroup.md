# ChoiceGroup

The `<fieldset><legend>` wrapper that groups **ChoiceField** items into one labelled
selection group. ChoiceGroup owns the group label, the layout (orientation +
legend placement) and an optional hint/error — and knows nothing about how an individual
field is drawn. ChoiceField knows nothing about the group. They compose in the DOM.

No JavaScript: native `<fieldset>` gives the disabled cascade and form grouping; native
`<legend>` gives the intrinsic group name; native radios/checkboxes give selection and
keyboard behaviour. ChoiceGroup is markup + CSS.

## Contract

```html
<fieldset class="ChoiceGroup" data-orientation="vertical" data-legend="above">
  <legend>Shipping speed</legend>
  <div class="Body">
    <div class="Options">
      <span class="ChoiceField"><input type="radio" id="ship-std" name="shipping" checked><label for="ship-std">Standard</label></span>
      <span class="ChoiceField"><input type="radio" id="ship-exp" name="shipping"><label for="ship-exp">Express</label></span>
    </div>
  </div>
</fieldset>
```

With a hint (and an error when invalid):

```html
<fieldset class="ChoiceGroup" data-legend="above" data-invalid="true" aria-describedby="acct-hint acct-err">
  <legend>Account type</legend>
  <div class="Body">
    <p class="Hint" id="acct-hint">Choose the plan that fits your team.</p>
    <div class="Options"> …fields… </div>
    <p class="Error" id="acct-err" role="alert">Pick an account type to continue.</p>
  </div>
</fieldset>
```

Contract rules (enforced by the unit test):

- **`<legend>` is the first child of `<fieldset>`** — a spec requirement, and the only
  *intrinsic* group label (no id plumbing, no document-outline dependency).
- **The `.Body` wrapper holds hint + options + error.** It establishes a formatting
  context that clears the floated legend in the `above` recipe, and stacks the parts.
- **`.Options` holds the fields.** Its layout follows `data-orientation`.
- **One unique `name` per radio group.** Shared `name` = mutually exclusive.
- **Every `aria-describedby` target must exist** — a dangling reference is a silent no-op.

## HTML Authoring API (`data-*`)

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `data-orientation` | `vertical` · `horizontal` | `vertical` | `.Options` stacks (column) or flows + wraps (row) |
| `data-legend` | `above` · `beside` · `hidden` | `above` | Legend placement recipe (see below) |
| `data-invalid` | `"true"` | — | Group-level invalid; pair with a `.Error` and `aria-describedby` |
| `aria-describedby` | id ref list | — | Points at the `.Hint` and/or `.Error` ids so SRs read them after the group name |

### Cardinality is implicit, not an attribute

Single-vs-multiple selection is a property of the **children's `type`**: radios
sharing a `name` are single-select; checkboxes are multi-select. ChoiceGroup encodes no
cardinality — native already carries it. (This is why the item is `ChoiceField`, not
`SingleChoiceField`: a lone radio is not "a single choice"; the *group* is.)

### Legend placement recipes

| `data-legend` | Recipe | Notes |
|---|---|---|
| `above` | `legend { float: left; inline-size: 100% }`; `.Body` (flow-root) clears it | The documented `<fieldset>` cost. Legend sits on its own line above the fields |
| `beside` | fieldset becomes `display: grid` (`auto minmax(0,1fr)`); legend left, `.Body` right | Legend `float: none` here |
| `hidden` | legend clipped to 1px (SR-only) | Still the group's accessible name — verified by e2e |

## CSS Variable API

| Variable | Default | Description |
|---|---|---|
| `--cg-gap` | `0.5rem` | Gap between fields (vertical) and between parts |
| `--cg-gap-horizontal` | `1rem` | Gap between fields when horizontal; legend↔body gap for `beside` |
| `--cg-legend-gap` | `0.5rem` | Legend → body gap (`above`) |
| `--cg-max-inline-size` | `30rem` | Caps the group width |
| `--cg-legend-weight` | `600` | Legend font weight |
| `--cg-hint-color` | `var(--SITE--POPOVER--MUTED, #6e6e6e)` | Hint text colour |
| `--cg-error-color` | `#c00` | Error text colour |

## Accessibility

### Why `<legend>`, not `role="group"` + `aria-labelledby`

For a selection group, `<legend>` is the only intrinsic group label — no id plumbing, no
heading-structure dependency, both of which authors routinely break. A hidden
legend (`data-legend="hidden"`) is still the accessible name; the e2e suite asserts the
group is reachable by that name even when the legend is visually clipped.

### Hint and error

The `.Hint` / `.Error` are referenced from the fieldset's `aria-describedby`, so screen
readers read them **after** the group name (atomica11y radio/checkbox §2). Support note:
description on a grouping element is well-supported in current NVDA/JAWS/VoiceOver; if you
must support an older stack, mirror the description onto each field's `aria-describedby`.

> **Note — the `.Error` here is a placeholder.** `role="alert"` announces a *content change
> inside a live region that already exists*; a pre-filled alert that is injected as one node
> (or present at page load) is not reliably announced. The real error will be a reusable
> **Notice** rendered into a persistent, initially-empty `role="alert"` container — the
> container stays mounted and its contents are swapped (clear → next frame → set). Until
> that component lands, treat this markup as visual reference only.

### Keyboard & selection

All native, via the ChoiceFields inside: radios rove with arrow keys within the shared
`name`; checkboxes toggle with Space; Tab moves in/out of the group. ChoiceGroup adds no
tabindex and no key handlers.

### Manual accessibility testing (definition of done)

- [ ] **Desktop SR:** entering the group, I HEAR the group name (legend) — including when `data-legend="hidden"`.
- [ ] With a hint, I HEAR the hint after the group name; with an error, I HEAR the error.
- [ ] Radios: arrow keys move/select within the group; checkboxes: Space toggles — each change announced.
- [ ] **Mobile SR:** the group name is conveyed; swiping reaches each field with label + role + state.
- [ ] **200% zoom / horizontal:** fields wrap without clipping; `beside` legend does not overlap the options.

## Testing strategy

- **Unit (jsdom):** wrapper-contract invariants — legend is the first child and non-empty,
  `.Options` present, for/id integrity, unique ids, one shared `name` per radio group,
  every `aria-describedby` target resolves, `data-legend` is a known value.
- **E2E (Playwright + axe):** the group is reachable by its legend name (including hidden),
  hint/error surface as the accessible description, orientation lays fields row vs column,
  single-selection holds, axe clean.

## Non-goals

- **Not a state machine** — no roving-tabindex or selection JS; native does it.
- **Does not draw fields** — that is ChoiceField. ChoiceGroup is layout + label only.
- **Does not lock `<fieldset>`** to this use — `<fieldset>` stays a general grouping element
  elsewhere; this component governs only the radio/checkbox grouping use.
- **No card / chip / segmented group** — those are their own components (a chip Picklist, a
  segmented Toggle, a CardChoice), not skins of ChoiceGroup.
- **No cross-field validation logic** — `data-invalid` + `.Error` are presentational; the
  host owns when to set them.

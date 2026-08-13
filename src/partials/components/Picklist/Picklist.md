# Picklist

A wrapping set of **chips** the user picks from — "choose one" or "choose many". Picklist
composes the same semantic core as **ChoiceGroup** — `<fieldset>` + `<legend>` + native
`<input type="radio|checkbox">` + `<label>` — and diverges only in **item rendering**: the
input's box disappears and the **label becomes the chip surface**.

No JavaScript: native `<fieldset>` gives the disabled cascade and form grouping, native
`<legend>` gives the intrinsic group name, native radios/checkboxes give selection and keyboard
behaviour. Picklist is markup + CSS.

**When to reach for which:** a Picklist is for *picking chips out of a set* (filters, tags,
sizes, cuisines). A **ChoiceGroup** is for *reading down a labelled list of options*. They share
semantics and differ in use — pick by which mental model the user holds, not by how it looks.

## Contract

Single-select — radios sharing one `name`:

```html
<fieldset class="Picklist" data-legend="above">
  <legend>Cuisine</legend>
  <div class="content">
    <div class="options">
      <span class="option"><input type="radio" id="pl-thai" name="cuisine" checked><label for="pl-thai">Thai</label></span>
      <span class="option"><input type="radio" id="pl-ital" name="cuisine"><label for="pl-ital">Italian</label></span>
    </div>
  </div>
</fieldset>
```

Multi-select is the **same markup with `type="checkbox"`** and independent `name`s.

Removable chips — the `×` is a decorative glyph **inside the chip's own label**:

```html
<span class="option">
  <input type="checkbox" id="pl-f1" name="pl-f1" checked>
  <label for="pl-f1">Under 500 kr<svg class="deselect" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="2" fill="none"/></svg></label>
</span>
```

Contract rules (enforced by the unit test):

- **`<legend>` is the first child of `<fieldset>`** — a spec requirement, and the only
  *intrinsic* group label (no id plumbing, no document-outline dependency).
- **The `.content` wrapper holds hint + options + error;** `.options` holds the chips and wraps.
- **The label must directly follow its input** (`input + label`). The whole visual model rests
  on that adjacency — see *The chip mechanism*. An element between them silently kills the
  selected and focus styling.
- **`for` must equal `id`; `id`s are unique.**
- **One unique `name` per radio group,** with at most one preselected.
- **Every `aria-describedby` target must exist** — a dangling reference is a silent no-op.
- **The `×` glyph carries `aria-hidden="true"` and sits inside the label,** and never appears on
  a radio chip.

### Cardinality is implicit, not an attribute

Single-vs-multiple selection is a property of the **children's `type`**: radios sharing a `name`
are single-select, checkboxes are multi-select. Picklist encodes no cardinality — native already
carries it.

## HTML Authoring API (`data-*`)

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `data-orientation` | `horizontal` · `vertical` | `horizontal` | Chips run in a wrapping row, or stack in a column |
| `data-segmented` | `"true"` | — | The set becomes **one control with N positions**: gaps collapse, borders join, the outer radius moves to the two ends, and the row no longer wraps |
| `data-legend` | `above` · `beside` · `hidden` | `above` | Legend placement recipe (see below) |
| `data-invalid` | `"true"` | — | Group-level invalid; tints unselected chip borders. Pair with an error Notice in a live region + `aria-describedby` |
| `aria-describedby` | id ref list | — | Points at the `.hint` and/or the error Notice's text id so SRs read them after the group name |
| `data-test-state` | `hover` · `focus` · `active` on the root | — | **Kitchensink only** — simulated pseudo-class, projected down to the chips |

### The two axes

`data-orientation` and `data-segmented` are independent, and all four combinations are useful:

| | gapped (default) | `data-segmented="true"` |
|---|---|---|
| **horizontal** (default) | a wrapping row of chips — filters, tags | a segmented control — alignment, density |
| **vertical** | a stacked list of pills, each hugging its own text | one vertical bar of joined segments |

Two consequences worth knowing when porting:

- **Wrap and equal-width are not separate settings.** They follow from `data-segmented`: a joined
  row that wrapped would break mid-row with stray radii, so segmented never wraps.
- **Pill vs rectangle is not an attribute.** It is the `--_pl-chip-radius` token, and the same
  token that rounds a chip also rounds the two ends of a segmented bar, in either orientation.

A vertical Picklist is **not** a ChoiceGroup. What separates them is the item **skin** — a pill
versus a box with a mark — not the direction the items run in.

There is no `data-removable` — a chip is removable exactly when its label contains a `.deselect`
glyph, so a second source of truth would only be a way to disagree with the markup.

### Legend placement recipes

| `data-legend` | Recipe | Notes |
|---|---|---|
| `above` | `legend { float: left; inline-size: 100% }`; `.content` (flow-root) clears it | Legend sits on its own line above the chips |
| `beside` | legend floats at auto width; `.content` fills the room beside it | |
| `hidden` | legend clipped to 1px (SR-only) | Still the group's accessible name — verified by e2e |

## The chip mechanism

The input is **sr-clipped to 1px but still focusable**, and the adjacent label is the chip
surface. That makes every state a plain sibling selector:

```css
.Picklist .option input + label               { /* the chip */ }
.Picklist .option input:checked + label       { /* selected */ }
.Picklist .option input:focus-visible + label { /* focus ring */ }
```

Two consequences worth keeping when porting:

- **No `:has()` anywhere.** A focus ring is load-bearing, and `:has()` is only ever used for
  progressive enhancement in this library. Adjacent-sibling selectors need no such caveat.
- **The ring is drawn on the label,** because that is the visible control. Drawing it on the
  clipped input would produce a 1px ring nobody can see.

The chip's total height is **2.5rem / 40px**, matching every other control in the library. The
label is `box-sizing: border-box` so the border counts inside that height.

Two details the segmented mode adds, both of which are easy to get wrong:

- **The focus ring must be raised.** Segments touch, so without `position: relative; z-index: 1`
  on the focused label the *next* segment paints over the ring's trailing edge — verified in a
  browser, not a precaution.
- **Vertical segments need `flex: 1` on the label.** `align-items: stretch` stretches the
  `.option` wrapper, but the label is a flex item inside that wrapper's own row context and stays
  at content width — and the label is what the user sees as the segment.

## Removable chips (the `×`)

The `×` is a **decorative `aria-hidden` SVG inside the chip's single `<label>`**. Because it
lives in the label, activating it activates the label, which toggles the input — so it deselects
with no JavaScript, no second label, and no extra keyboard model.

- **Checkbox core only.** A native radio cannot be unchecked by the user, so an `×` on a radio
  chip would promise something it cannot do. The unit test rejects it.
- **The glyph only shows on a selected chip** — there is nothing to remove from an unselected
  one. It is hidden with `visibility`, not `display`, so the slot keeps its width and toggling
  never resizes the chip or reflows the wrapped rows around it.
- **Author `>Text<svg` with no whitespace** before the glyph. A text node `"Thai "` leaves a
  trailing space in the accessible name.
- **It is not a button.** A focusable `×` that deletes the chip from the DOM would need JS,
  focus management and a live-region announcement — see Non-goals.

## CSS Variable API

Override on the `.Picklist` element (or a rule that targets it). An ancestor or `:root` override
is **shadowed** by the component's own defaults on the root, so it must target `.Picklist`
itself. Neutral, monochrome defaults on system colours — the component **takes** design;
override `--_pl-chip-selected-bg` to push an accent.

| Variable | Default | Description |
|---|---|---|
| `--_pl-gap` | `0.5rem` | Between chips, both axes |
| `--_pl-legend-gap` | `0.5rem` | Legend → body (`above`) |
| `--_pl-legend-gap-inline` | `1rem` | Legend → body (`beside`) |
| `--_pl-legend-weight` | `600` | Legend font weight |
| `--_pl-max-inline-size` | `30rem` | Caps the group width |
| `--_pl-hint-color` | `var(--ui-muted-foreground, #6e6e6e)` | Hint text colour |
| `--_pl-chip-min-block-size` | `2.5rem` | Chip height / touch target |
| `--_pl-chip-padding-inline` | `0.75rem` | Chip horizontal padding |
| `--_pl-chip-radius` | `999px` | Pill by default; set `0.25rem` for a rounded rectangle |
| `--_pl-chip-border-width` | `1px` | Chip border |
| `--_pl-chip-border-color` | `currentColor` | Unselected border |
| `--_pl-chip-border-color-hover` | `CanvasText` | Hover / active border |
| `--_pl-chip-border-color-invalid` | `var(--ui-destructive, #c00)` | Invalid border |
| `--_pl-chip-bg` | `Canvas` | Unselected fill |
| `--_pl-chip-bg-hover` | `var(--ui-hover)` | Hover / active fill (unselected) |
| `--_pl-chip-selected-bg` | `CanvasText` | Selected fill + border — **override for accent** |
| `--_pl-chip-selected-fg` | `Canvas` | Selected text |
| `--_pl-deselect-size` | `0.75em` | The `×` glyph box — `em`, tracks the chip text |
| `--_pl-deselect-gap` | `0.375rem` | Text → `×` gap |
| `--_pl-deselect-opacity` | `0.7` | Glyph opacity |
| `--_pl-transition` | `120ms ease` | Colour transitions |

## Accessibility

### Semantics come from native

`role` (radio / checkbox), state announcement, Space to toggle, arrow-key roving within a radio
group, single-selection, form participation and label association are all native. The chip skin
adds no ARIA and no tabindex — the e2e suite asserts each of these still holds in a browser.

### Why `<legend>`, not `role="group"` + `aria-labelledby`

For a selection group, `<legend>` is the only intrinsic group label — no id plumbing, no
heading-structure dependency, both of which authors routinely break. A hidden legend
(`data-legend="hidden"`) is still the accessible name; the e2e suite asserts the group is
reachable by that name even when the legend is visually clipped.

### Hint and error

The `.hint` and the error text are referenced from the fieldset's `aria-describedby`, so screen
readers read them **after** the group name. The error uses the **Notice** component inside a
persistent live region, giving two complementary behaviours — *announce on appear* (the
`.notice-region` is mounted from the start, so swapping content in is announced) and *describe
on focus* (`aria-describedby` points at the Notice's text id).

### Forced colors (Windows High Contrast) — required

The chip is an author-painted `<label>`, so the platform draws neither the selection nor the
focus ring. The shipped `@media (forced-colors: active)` block redraws both from system colour
keywords (`Highlight` / `HighlightText` / `CanvasText` / `GrayText`). **Do not delete the block
when porting.** It has not been verified on real Windows High Contrast — browsers cannot emulate
forced-colors — so treat it as reviewed code, not tested code.

### Focus and target size

Focus uses `outline: 2px solid` (currentColor) via `:focus-visible` — the same treatment as the
rest of the family; it survives forced-colors, where a `box-shadow` ring would not. The chip is
the whole hit target at 40px tall, which clears the WCAG 2.5.8 (24px) minimum by construction.

### Manual accessibility testing (definition of done)

- [ ] **Desktop SR:** entering the set, I HEAR the group name (legend) — including when `data-legend="hidden"`.
- [ ] Tab to a chip — I HEAR its label, its role (radio button / checkbox) and its state (selected, checked, disabled).
- [ ] Radios: arrow keys move + select, each change announced. Checkboxes: Space toggles, each change announced.
- [ ] With a hint, I HEAR the hint after the group name; with an error, I HEAR the error.
- [ ] **Removable chips:** I HEAR the plain label text with no "times"/"x" and no stray pause — the glyph must be silent.
- [ ] **Mobile SR:** swiping reaches each chip with label + role + state; double-tap toggles and announces.
- [ ] **200% text zoom:** chips grow with the text and wrap without clipping or overlap.
- [ ] **Windows High Contrast:** the selected chip is still visibly distinct, and the focus ring is visible.

## Testing strategy

Because behaviour is native, the centre of gravity sits in e2e:

- **Unit (jsdom):** markup-contract invariants parsed from this file's own kitchensink — legend
  first and non-empty, `.content`/`.options` present, `input + label` adjacency and `for`/`id`
  wiring, unique ids, both `type`s exercised, one shared `name` per radio group with at most one
  preselected, every `aria-describedby` target resolves, known `data-legend` values, and the
  removable-chip rules (`aria-hidden`, inside the label, never on a radio, no trailing space).
- **E2E (Playwright + axe):** that native delivers the contract in a real browser — role and
  state survive the skin, label click and Space toggle, arrow roving with single-selection, the
  focus ring lands on the chip (and the input really is clipped to 1px), the 40px height
  contract, the `×` deselects and stays out of the accessible name, chips flow in a row and wrap
  at a narrow viewport without overflowing, hint/error surface as the accessible description,
  disabled and the `<fieldset disabled>` cascade block selection, axe clean.

## Non-goals

- **Not for actions.** A row of pills that *does* something — triggers, navigates — produces no
  submitted value and is a **ButtonGroup**, not a Picklist. The litmus: *does it produce a value
  the form submits?*
- **Not a segmented toggle.** A segmented control that switches one preference, with a governed
  sliding indicator, is its own component.
- **No `<button>`-based `×`** that deletes the chip from the DOM. That needs JS, focus
  management (where does focus go when a chip vanishes?) and a live-region announcement, and it
  would put an *action* inside a *selection* item. Our `×` deselects via the label instead.
- **No JS**: no roving-tabindex reimplementation, no value logic, no "clear all", no selection
  counter. The moment a click handler appears, the component has left the native family.
- **No combobox/autocomplete** feeding the chips — that is the token-input pattern, a different
  component.
- **No sliding indicator.** A segmented Picklist paints the selected segment directly. An
  indicator that *animates* between segments would need either one CSS rule per segment index
  (capping how many segments a group may have) or JavaScript — neither is worth it for a
  decoration, and the selection is already unambiguous without it.
- **No horizontal-scroll variant** — scrolling a selection group hides options from sighted users
  while keeping them Tab-reachable; that needs its own accessibility round.
- **Does not restyle or import ChoiceGroup** — the two are siblings that share a recipe, not a
  stylesheet.

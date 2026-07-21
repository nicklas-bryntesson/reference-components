# ADR 0013: Radio and checkbox are native primitives; ChoiceGroup names the fieldset *use*, not the element

**Status:** Accepted · the RadioField/CheckboxField split is superseded by ADR-0015 (native primitives + ChoiceGroup stand)
**Date:** 2026-07-09
**Decider:** Nicklas Bryntesson

## Context

Radio and checkbox controls are next (README "Next in line"; acceptance criteria already in
`docs/atomica11y/form/radio-button.md` and `checkbox.md`). The design work was in drawing the
abstraction boundaries. Two reference points and two worked examples shaped it:

- **Web Awesome** models a group as a stateful `<wa-radio-group>` owning `<wa-radio>` children
  — it must re-implement roving tabindex, single-selection, arrow keys and form participation
  in JS, because a web component severs native form semantics.
- **Flowbite** builds groups from plain `<button>`s and bespoke card markup — visually rich,
  semantically loose.
- A **working legend experiment** confirmed `<fieldset><legend>` styling is solvable with a
  small CSS recipe.
- An **SVL membership step** (a whole reactive form step wrapped in one `<fieldset>`) and a
  **ThemeSwitch** (an animated segmented toggle that is, underneath, a radio fieldset) showed
  that `<fieldset>` is a broad, general element — it holds everything from a micro radio group
  to an entire interactive step.

The conclusion: `<fieldset>` is as broad as `<button>` or `<label>`. We do **not** own it and
must not lock it to one pattern. But the *specific use* "group radio/checkbox in their vanilla
form" earns a real, named, scoped component.

## Decision

Build three things, named after their **use**, not after any HTML element:

1. **RadioField** — a styled native `<input type="radio">` + `<label>` (with a basic skin).
2. **CheckboxField** — a styled native `<input type="checkbox">` + `<label>`.
3. **ChoiceGroup** — the component for the radio/checkbox grouping use: `<fieldset><legend>`
   wrapping the fields, with alignment props and the legend CSS hygiene. Its own file and its
   own scoped CSS name.

Principles:

- **Name after the use, not the element.** Hence `ChoiceGroup`, not "FieldGroup" — and later
  `CardChoice`, a segmented toggle, etc. `<fieldset>` stays a general grouping element used
  case-by-case everywhere else; **this ADR governs only the radio/checkbox use.**
- **Semantics live in native elements.** Radios are mutually exclusive via a shared `name`;
  checkboxes are independent. Native gives roving tabindex, arrow keys and form participation
  for free — ChoiceGroup adds no state machine.
- **`data-*` is the API** (ADR-0002). ChoiceGroup's alignment props: `data-orientation`
  (`vertical` default · `horizontal`) and `data-legend` (`above` · `beside` · `hidden`), which
  select the layout and its matching legend recipe. Purely visual restyles of the *same* item
  and *same* interaction are `data-variant` skins on RadioField/CheckboxField.
- **`name` is an authored end-state, not a JS-distributed prop** (ADR-0009). The contract is
  the finished DOM ("every radio in the group shares one `name`"); a framework may distribute
  it from a prop, a server renders it, our reference authors it. No parent→child coupling.

### Grouping label: `<fieldset><legend>`, not `role="group"` + `aria-labelledby`

For a selection group, `<legend>` is the only *intrinsic* group label — no id plumbing, no
document-outline dependency. The ARIA replacement couples the group name to a valid, unique id
**and** a correct heading structure, both of which authors routinely break. (The single-field
segmented pattern in DateField/TimeField/etc. keeps `role="group"` + `aria-labelledby` because
there the label is the field's own `<label>`, not a heading — a scoped, deliberate difference.)

### Contract rules baked in

- **Legend CSS hygiene** (the only real cost of `<fieldset>`), verified against a working
  reference:
  ```css
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; } /* min-width:0 kills the implicit min-content width in flex/grid */
  legend   { float: left; inline-size: 100%; }                 /* lifts legend out of the border layout → wraps like a normal block */
  ```
  The options live in a **flex/grid wrapper inside the fieldset**; that wrapper establishes a
  new formatting context and clears the floated legend on its own — no `clear` needed. (The
  `beside` and `hidden` legend layouts use their own recipe; `above` is the one above.)
- **One unique `name` per ChoiceGroup.** Two groups sharing a `name` are *one* radio group —
  selecting in the second deselects the first.
- **Unique `id`s.** `for`/`id` breaks on duplicates (a label focuses the first match).
- **Scoped sub-element class names.** Root is the namespace (`.ChoiceGroup`); inner parts are
  named and selected under it — no bare, collision-prone class names.

### The boundary rule (skin vs own component)

- **Skin** (`data-variant`) — a visual restyle of the *same item* and *same interaction*.
- **Own component** — when the item's **content model** changes (a card with icon/title/
  description → `CardChoice`), or when the **motion/interaction is itself the designed thing**
  (a segmented toggle with an animated sliding indicator).

## Considered alternatives

1. **Stateful group component (Web Awesome)** — Rejected: needed only because web components
   sever native semantics; native radios in a fieldset make it unnecessary.
2. **A generic "FieldGroup" owning all `<fieldset>` uses** — Rejected: `<fieldset>` is a broad
   multi-tool (whole steps to micro-groups); one component/pattern for all of it is a visual
   footgun. Group uses are case-by-case; we name the specific one (ChoiceGroup).
3. **Plain-`<button>` group / `role="group"`+`aria-labelledby` for the group label** —
   Rejected: drops selection semantics / fragile id+outline coupling.
4. **Div-based faux radios** — Rejected: semantics-first is the point.
5. **Native primitives + a use-named ChoiceGroup (chosen)** — robust native semantics,
   `data-*` alignment/skins, grouping as markup; ports across client/server placement with one
   contract; leaves `<fieldset>` free for every other use.

## Consequences

### Positive
- Almost certainly **no kernel needed** for this family — native carries the behaviour. A
  strong simplicity signal versus the date family (which earned WheelColumn/popup primitives).
- The `<fieldset>` disabled cascade and form grouping come for free.
- Naming after use keeps each component honest and small; `<fieldset>` is never over-claimed.

### Costs
- A deliberate, scoped inconsistency with the single-field `role="group"` label pattern —
  documented here so it is a choice, not drift.
- The legend recipe must travel with ChoiceGroup (non-obvious; `float: left` in 2026).

### Risks to manage
- Skin creep: a skin must not grow click handlers or value logic — the `<input>` stays the
  source of truth. If it needs real interactivity or motion, it is a different component.
- Reading order: skins may want the `<input>` before the `<label>` (for `:has()`/sibling
  styling); keep `for`/`id` correct regardless of source order.

### Explicitly deferred — their own future components, not part of this ADR
- **Segmented / toggle group** (the ThemeSwitch kin) — reuses ChoiceGroup's semantic core
  (`<fieldset>` + native radios) but **owns a designed, governed sliding-indicator motion**
  (motion-policy kin, ADR-0010; reduced-motion aware). For cases like theme it also **reflects
  a layered preference** — a truth resolved as *OS default ← user override* (the "system"
  option means "mirror the OS", updated live) — the same shape `motion-policy` already
  embodies. Its motion and preference-resolution put it well outside vanilla ChoiceGroup.
- **CardChoice** — when the choice item's content model changes (icon/title/description).
- **Action / navigation button group** (no selection state) — a separate sibling.
- **Toggle switch** — its own a11y contract (`toggle-switch.md`).
- We do **not** lock `<fieldset>` to one pattern; other uses stay case-by-case.

### Kernel dependencies
- None required to start. Two future candidates, each promoted **only if reuse earns it**
  (ADR-0004): a shared label/`describedby`-wiring helper; and a `preference` resolver (OS
  signal ← user override, reflect + persist) shared with `motion-policy` — theme would be its
  second consumer, which is exactly the bar that earns a kernel.

## Reconsider when

- The build starts — flip to `Accepted` and build RadioField, then CheckboxField, then
  ChoiceGroup + alignment layouts.
- The segmented/toggle component is built — revisit the shared `preference` kernel then, with
  `motion-policy` as the first consumer.

## References

- `docs/atomica11y/form/radio-button.md`, `checkbox.md`, `button.md`, `toggle-switch.md`
- ADR-0002 (`data-*` API), ADR-0004 (kernel earned by reuse), ADR-0005 (`:has()` PE-only),
  ADR-0006 (native-first), ADR-0009 (end-state contract — `name` is authored DOM),
  ADR-0010 (motion-policy / MotionRegion — the governance the toggle kin inherits)
- `role="group"` precedent kept for single-field segment groups: `DateField.ts`,
  `TimeField.ts`, `FileUpload.generate.ts`
- ThemeSwitch (external Astro reference) — the segmented-toggle + preference-resolution shape

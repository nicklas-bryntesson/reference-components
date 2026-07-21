# ADR 0015: ChoiceField — one component keyed on native `type`, not a RadioField/CheckboxField split

**Status:** Accepted
**Date:** 2026-07-21
**Decider:** Nicklas Bryntesson

## Context

ADR-0013 decided to build **three** things: RadioField, CheckboxField, and ChoiceGroup.
RadioField and CheckboxField were built. Two things then became clear:

1. Once the design was **consolidated to a neutral, monochrome skeleton** (matching the
   AffixField/WeekField family — system colours, `2px` currentColor focus, `opacity:0.5`
   disabled; no accent, no bespoke focus ring), RadioField and CheckboxField were **~95%
   identical CSS**. The only real differences: the box shape (circle vs square), the mark
   (dot vs mask-tick), and whether the checked box fills.
2. Those three differences are cleanly expressible as `input[type="radio"]` vs
   `input[type="checkbox"]` branches of **one** stylesheet. The discriminator is the native
   `type` attribute — which already drives all the *behavioural* differences (single-select
   + arrow roving vs independent toggle). Keying visuals off the same native attribute is
   more honest than two files that each hard-code one type.

A naming alternative was also raised — `SingleChoice` / `MultipleChoice`. But **cardinality
is a group property, not a field one**: a lone radio is not "a single choice"; it is the
*group* (shared `name`) that makes selection single. So single-vs-multiple belongs on
ChoiceGroup, not on the item.

## Decision

Build **one component, `ChoiceField`**, a styled native `<input type="radio|checkbox">` +
`<label>`, keyed on the native `type` attribute. This **supersedes the RadioField +
CheckboxField split** in ADR-0013. Everything else in ADR-0013 stands: native primitives
(no JS/state machine), `<fieldset><legend>` grouping via **ChoiceGroup**, the `data-*` API,
and the boundary rules in ADR-0014.

Principles:

- **The native `type` is the discriminator, not an invented API.** One `.ChoiceField`
  stylesheet: a shared skeleton (`appearance:none` input as the box, `::after` as the mark,
  shared focus/hover/active/disabled/invalid states), plus two small branches —
  `input[type="checkbox"]` (square, fills, mask-tick) and `input[type="radio"]` (circle,
  ring + dot). This is DRY *without abstraction*: no `data-variant`, no config — the branch
  key is the same attribute that already decides behaviour.
- **Item vs group.** `ChoiceField` is the item; `ChoiceGroup` is the `<fieldset><legend>`
  wrapper. Cardinality (single vs multiple selection) is expressed on the **group** (its
  children's `type`, or a future `data-select`), never on the field.
- **Neutral skeleton (take design, not push it).** Monochrome system-colour defaults like
  the rest of the field family. The host paints the selection by overriding one token
  (`--cf-selected`); the reference ships no accent.
- **Semantics stay native** (ADR-0013): roving tabindex, arrow keys, single-selection,
  form participation, Space to toggle — none re-implemented.

## Considered alternatives

1. **Two components: RadioField + CheckboxField** (ADR-0013 as written) — Rejected: after the
   neutral-skeleton consolidation they are ~95% duplicate CSS whose only differences are
   two clean native-`type` branches. Splitting them hides the shared skeleton rather than
   showing it; a single file keyed on `type` is *clearer*, not merely DRYer — so this does
   not trade clarity for DRY (ADR-0004), it improves both.
2. **`SingleChoice` / `MultipleChoice`** — Rejected at the item level: cardinality is a
   group property. The insight is kept, applied to ChoiceGroup.
3. **A `data-variant` / config prop to pick radio vs checkbox** — Rejected: the native
   `type` attribute already is that switch. Inventing a parallel API would be redundant and
   could drift from `type`.
4. **One `ChoiceField` keyed on native `type` (chosen)** — one contract, one stylesheet, the
   honest native discriminator; pairs with ChoiceGroup; leaves cardinality on the group.

## Consequences

### Positive
- One small, honest component instead of two near-duplicates; the shared skeleton is visible
  in one place, the two type branches are explicit.
- The discriminator is native HTML, reinforcing "native is the source of truth" (ADR-0013).
- `ChoiceField` (item) + `ChoiceGroup` (wrapper) is a clean, self-describing pair.

### Costs
- Supersedes a just-built pair of components — the RadioField/CheckboxField directories are
  removed and their contracts fold into `ChoiceField.md`.
- A consumer who expects framework-idiomatic separate `<Radio>` / `<Checkbox>` components
  must split on their side — but the reference's job is to show the shared CSS/HTML
  technique, which one file does best; splitting in a framework is trivial.

### Risks to manage
- **Branch creep:** if the two `type` branches ever diverge beyond box-shape/mark/fill (e.g.
  a checkbox indeterminate state, radio-only affordances), keep them as clearly-labelled
  branches in the one file; only reconsider a split if a branch grows its own skeleton.
- **Cardinality leaking onto the field:** resist adding single/multiple logic to ChoiceField
  — it belongs to ChoiceGroup.

### Non-goals
- Unchanged from ADR-0013/0014: no grouping here (ChoiceGroup), no card/chip/segmented skins
  (Picklist/Toggle/ChoiceGroup), not an action control (ButtonGroup).

### Kernel dependencies
- None. Native carries behaviour; the component reads only `--SITE--*` tokens with fallbacks.

## Reconsider when

- A `type` branch grows a full second skeleton (then a split may be warranted again).
- ChoiceGroup is built — confirm cardinality lives on the group, and that `ChoiceField`
  needs no group-awareness.

## References

- Supersedes the RadioField/CheckboxField split in
  [ADR-0013](0013-native-radio-checkbox-and-fieldset-grouping.md) (the rest of 0013 stands).
- [ADR-0014](0014-picklist-toggle-buttongroup-selection-vs-action.md) — sibling boundaries.
- ADR-0002 (`data-*` API), ADR-0004 (clarity over DRY), ADR-0009 (end-state `name`).
- `src/partials/components/ChoiceField/ChoiceField.md` — the contract.
- `docs/atomica11y/form/radio-button.md`, `checkbox.md`.

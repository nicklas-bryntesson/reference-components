# ADR 0014: Picklist, Toggle and ButtonGroup are distinct components; *selection-vs-action* draws the line

**Status:** Accepted 2026-08-12 · Picklist built; condition 3 held up in the building (see note below)
**Date:** 2026-07-21
**Decider:** Nicklas Bryntesson

> **2026-08-12 — the "Reconsider when" check, on building Picklist.** Condition 3 still reads as
> the honest reason: Picklist's own `.md` ended up with a *different contract*, not a different
> stylesheet — no `data-orientation` (a stacked list of options **is** a ChoiceGroup), a chip
> mechanism ChoiceGroup has no use for (sr-clipped input, label-as-surface), and a removable-chip
> rule that only makes sense for chips. A skin could not have carried those. Picklist does **not**
> import ChoiceGroup's CSS; it copies the legend recipe, so a consumer can port one without the
> other.
>
> One refinement the building produced: the **removable chip** is *not* the action-inside-selection
> problem this ADR feared. Its `×` is a decorative `aria-hidden` glyph inside the chip's own
> `<label>`, so activating it activates the label and **deselects the value** — no JS, no second
> label, no submitted-value violation. A focusable `<button>` `×` that deletes the chip from the
> DOM *would* cross the line, and is recorded as a non-goal. Toggle and ButtonGroup remain unbuilt.

## Context

ADR-0013 established the native selection family — RadioField, CheckboxField, and
ChoiceGroup (the `<fieldset><legend>` grouping use) — and a **boundary rule** for when a
variation earns its own component: only when the item's *content model* changes, or when
*motion/interaction is itself the designed thing*. Everything else is a `data-variant` skin.

While sketching the markup, two follow-on questions surfaced that the boundary rule did not
cleanly answer:

- **A chip "picklist"** (Argyle-style wrapping pills — "choose one / choose many") is, by the
  letter of 0013's rule, *just a skin*: same native `<input>`, same interaction, only a chip
  look plus `flex-wrap`. Yet it reads as a distinct control in a distinct context.
- **A picklist and a ButtonGroup can be visually identical** (a row of pills), so "what it
  looks like" cannot be the thing that tells them apart.

Two worked references framed it: a **chip picklist** (selection, wraps) and a **list-card
group** with supporting text (which stays a RadioField/CheckboxField skin with a description
slot, per 0013's own rule — no content-model change beyond a `describedby` line). A third
sibling, **Toggle** (segmented, animated, reflects one value/preference), was already deferred
by 0013 as its own component. The open work was drawing the lines *between* these siblings.

## Decision

Two rulings, one refining ADR-0013 and one new.

### 1. Refine 0013's boundary rule — add a third earning condition

A variation earns its own component (not a skin) when **any** of:

1. the item's **content model** changes (0013), or
2. **motion/interaction is itself the designed thing** (0013), or
3. **(new)** it forms a **distinct visual family bound to a distinct usage context** — a
   separate mental model the user holds ("pick chips" vs "toggle a setting" vs "trigger
   actions") — *even when the item and interaction are otherwise unchanged*.

Under condition 3, **Picklist is its own component** (chip selection, wraps), a sibling to
**Toggle** (segmented, animated, one value/preference). Both **compose ChoiceGroup's semantic
core** — `<fieldset>` + `<legend>` + native `<input type=radio/checkbox>` — exactly as 0013
already lets the deferred segmented/toggle kin do. They diverge only in item rendering and
(for Toggle) governed motion, not in semantics.

The guard against this condition becoming a skin-creep loophole: it requires a *distinct usage
context*, not merely a new coat of paint. A pure recolor/reshape of the **same** use is still a
`data-variant` skin (the list-card group stays a skin). Condition 3 is met by a different
*answer to "what is this control for"*, not a different stylesheet.

### 2. New — *selection-vs-action* separates the selection family from ButtonGroup

The whole selection family (Picklist, Toggle, ChoiceGroup) is separated from **ButtonGroup**
by one question, not by appearance:

> **Does it produce a value the form submits?**
> **Yes → selection** (native `<input>` in a `<fieldset>`, `<legend>` names it, `name=value`
> follows the form). **No → ButtonGroup** (`<button>`/`<a>` that *do* something — actions or
> navigation — with no submitted value; `role="group"`/`toolbar` + `aria-label`).

Sharpening edge case: a toolbar of `<button aria-pressed="true">` (bold/italic) has on/off
*state* and can look like a picklist, but that state is a **command mode, not a form value** —
so it belongs to **ButtonGroup**, not Picklist.

### The three siblings

| | **Picklist** | **Toggle** | **ButtonGroup** |
|---|---|---|---|
| Purpose | choose value(s) | switch one value/preference | trigger action / navigate |
| Element | `<input radio/checkbox>` + `<label>` in `<fieldset>` | same (radio core) | `<button>` / `<a>` |
| Group label | `<legend>` (intrinsic) | `<legend>` | `aria-label` on `role="group"`/`toolbar` |
| State | selected — persists, submits | selected — persists, submits | momentary click; nav has "current" |
| Form | `name=value` | `name=value` | nothing submitted |
| Designed extra | chip look + wrap | governed sliding-indicator motion (ADR-0010) | — |
| A11y model | radiogroup / checkbox (native) | radiogroup (native) | group / toolbar of buttons |

The **selection-vs-action test** is recorded as a mutual **non-goal** in each component's
eventual `.md`: Picklist/Toggle say "not for actions — see ButtonGroup"; ButtonGroup says "no
submitted value — for selection see Picklist/Toggle".

This is ADR-0013's first principle — *name after the use, not the element* — playing out: two
controls that look identical are different components because they *do* different things, and
two controls that share semantics (Picklist/Toggle) are different components because they *are
used* differently.

## Considered alternatives

1. **Keep the chip picklist as a `data-variant` skin of RadioField/CheckboxField** (strict
   0013) — Rejected: it reads as a distinct control in a distinct context, and pinning it as a
   skin fights the "name after use" principle. Condition 3 records *why* it earns separation.
2. **One mega "SelectableGroup" spanning list, chip, and segmented** — Rejected: same footgun
   0013 rejected for a generic "FieldGroup" — one component for visually and behaviourally
   divergent uses is a maintenance and clarity trap. Name the specific uses.
3. **Fold ButtonGroup into the selection family (a "group of pills" component)** — Rejected:
   they have no shared semantics (no `<fieldset>`, no submitted value, different a11y model).
   Visual similarity is not kinship.
4. **Distinct siblings with a selection-vs-action discriminator (chosen)** — three small,
   honest components sharing an aesthetic; each carries the mutual non-goal so the boundary is
   documented, not folklore.

## Consequences

### Positive
- A clear, small sibling set: Picklist, Toggle, ButtonGroup — each named after its use.
- Picklist and Toggle **reuse ChoiceGroup's semantic core**; no duplicated selection semantics.
- The selection-vs-action test is a one-line litmus authors can apply without reading three
  contracts, and it lives as a cross-referenced non-goal in each.

### Costs
- Softening the boundary rule (condition 3) widens what may become its own component. Mitigated
  by requiring a *distinct usage context*, not a restyle — the list-card group stays a skin as
  the worked counter-example.
- Three contracts to keep aligned where one skin might have sufficed; accepted as the cost of
  clarity over DRY (ADR-0004).

### Risks to manage
- **Skin-creep in reverse:** teams promoting every restyle to a component by over-claiming
  "distinct context". The list-card-stays-a-skin precedent is the calibration point.
- **Semantic drift in Picklist/Toggle:** if either grows click handlers or value logic outside
  the native `<input>`, it has left the family (same risk 0013 flagged for skins).

### Non-goals
- This ADR does **not** build any of the three; it draws the lines between them. Picklist and
  ButtonGroup remain future components (Toggle already deferred by ADR-0013).
- Does **not** lock `<fieldset>` to these uses — it stays a general grouping element elsewhere
  (ADR-0013).
- Tabs (`role="tablist"` + panels) are **out of family** — neither selection value nor action
  group; their own contract if built.

### Kernel dependencies
- None new. Picklist and Toggle inherit ChoiceGroup's `<fieldset>`/`<legend>` recipe (ADR-0013).
  The `preference` resolver candidate (OS signal ← user override) stays scoped to Toggle/theme,
  promoted only if reuse earns it (ADR-0004, ADR-0010).

## Reconsider when

- **Picklist is built** — flip to `Accepted`; confirm condition 3 still reads as the honest
  reason (or fold back to a skin if, in the building, no distinct usage context materialises).
- **A fourth pill-shaped control appears** that fits none of the three cleanly — revisit
  whether the selection-vs-action test needs a third axis.
- **ButtonGroup is built** — confirm the mutual non-goal wording against its real a11y contract.

## References

- ADR-0013 (native radio/checkbox + ChoiceGroup — the family and the boundary rule this refines)
- ADR-0002 (`data-*` API), ADR-0004 (clarity over DRY), ADR-0009 (end-state `name` contract),
  ADR-0010 (motion-policy — the governance Toggle inherits)
- `docs/atomica11y/form/radio-button.md`, `checkbox.md`, `button.md`, `toggle-switch.md`
- Argyle-style chip picklist and list-card group (design references for the boundary questions)

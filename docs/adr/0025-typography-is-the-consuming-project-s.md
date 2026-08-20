# ADR 0025: Typography belongs to the consuming project; this repo owns the mechanics

**Status:** Accepted
**Date:** 2026-08-20
**Decider:** Nicklas Bryntesson

## Context

Discussing a possible `Heading` component surfaced a question that had never been asked: does this
repo own typography at all? The honest answer required measuring what it *already* owns, and the
measurement was worse than expected.

**Twenty-five `font-size` declarations across the component set, in four incompatible systems:**

| How size is expressed | Count |
|---|---|
| Hardcoded (`1rem`, `0.875rem`, `1.5rem`, `0.75rem`) | 18 |
| Component-local variables invented per component | 3 |
| References to a type scale that **is never declared anywhere** | 6 |
| Anything shared | **0** |

The six scale references live only in `Combobox` (parked legacy) and point at `--font-size-h5`,
`--font-size-body-small` and `--font-weight-heading`, none of which exist in this repo. They are
dangling variables falling back to nothing, and nobody noticed because nothing tests typography.

Two more findings from the same pass. `RangeGroup` had `letter-spacing: 0.05em` and
`text-transform: uppercase` on its legend — the **only** occurrence of either in the whole
repository, i.e. a unique appearance opinion in a library that claims to have none. And `measure`
already exists in three uncoordinated versions: `Combobox` 28rem, `ChoiceGroup` 30rem, `Notice`
50rem, the last of which is roughly 100 characters and therefore over the WCAG 1.4.8 (AAA) ceiling
of 80.

The tempting conclusion — that the components lack `Heading` and `Prose` and should compose them
internally — does not survive counting. The text parts across the component set are:

| Part | Count |
|---|---|
| `<label>` | 183 |
| `<output>` / `.value` | 27 |
| `.label` | 19 |
| `<legend>` | 14 |
| `<p>` (hints) | **9** |

`Prose` would cover the nine hints and nothing else. A label is not prose and not a heading; neither
is a legend, an `<output>` or a tick mark. Composing typographic components inside fields would also
break their self-containment: porting `DateField` would mean porting `Prose` for a hint.

And decisively: **another design system may have reached entirely different conclusions.** A
different type hierarchy, different roles, different names, Tailwind utility classes instead of
components. A reference library that ships a scale forces its own taxonomy onto every consumer, and
that is not what this repo is for.

## Decision

**This is not a design project.** Typography — the family, the scale, the ratio, the rhythm — is the
consuming project's to pour in, and it is expected to replace anything here with its own typography
components, utility classes, or nothing at all.

What this repo owns is the **mechanics and the invariants**. The line is drawn property by property,
by one test: *does the value follow from a mechanism or a criterion, or is it taste?*

| | Ours | Why |
|---|---|---|
| `font-family` | no | taste |
| Size scale — steps, ratio, values | no | taste |
| `letter-spacing` as a value | no | taste |
| Margins between blocks (vertical rhythm) | no | a relation between siblings, i.e. content layout |
| Which variant to reach for | no | editorial |
| **Relationships expressed in `em`** | **yes** | mechanical and scale-free: survives any consumer scale |
| `text-wrap: balance` vs `pretty` | **yes** | a documented trade with a line-count limit in engines |
| `hyphens` depending on a correct `lang` | **yes** | a mechanical dependency |
| `tabular-nums` for a value that changes in place | **yes** | without it the digits jump — measured |
| `unicode-bidi: isolate` for a number-plus-unit run | **yes** | bidi mechanics |
| `1lh` to **read** line height in a calculation | **yes** | reads, never sets |
| Surviving WCAG 1.4.12 Text Spacing | **yes** | a criterion with a source |
| Measure — the **ceiling** only | **yes** | WCAG 1.4.8 (AAA) is 80 characters |

**Components express relationships, never a scale.** A hint at `0.875em` is not a type step; it is
the statement *"supporting text is smaller than what it supports"*, and in `em` it is independent of
whatever scale the consumer installs. `Picklist` already documented the reasoning before this ADR
existed: `--_pl-deselect-size: 0.75em; /* the × glyph — em, tracks chip text */`.

Two relationships cover the measured set — supporting text and its own sub-step — and agreeing on
*those two numbers* is the real work. The drift was never a missing scale; it was the same
relationship written as `0.875em` in one component and `0.75em` in another.

**The repo's contribution to typography is a survivability test, not a scale.** WCAG 1.4.12 says a
user must be able to force `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em` and
`2em` between paragraphs with no loss of content or functionality. That is mechanical, testable in
e2e, and shipped by almost nobody. Proving that the components tolerate the consumer's typography is
a stronger position than supplying a scale, and it costs no opinions at all.

## Considered alternatives

1. **Ship a type scale in `--ui-*`.** Rejected. The colour precedent does not transfer:
   `--ui-destructive` says "there is a destructive role" without saying `#c0362c`, but a type scale
   cannot be expressed without its ratio and its step count — and those *are* the taxonomy. A
   consumer with five roles cannot use a seam built for six.
2. **Compose `Heading` and `Prose` inside components.** Rejected on the count above: nine of over
   250 text parts, at the cost of every field depending on a typographic component.
3. **Own nothing typographic at all.** Rejected as impossible in practice. `tabular-nums` on a
   readout, `unicode-bidi: isolate` on a number-plus-unit, `1lh` in a row reservation — remove them
   and components measurably break. These are mechanics, not taste.
4. **Own the mechanics and the invariants; disown the values and the rhythm (chosen).** It is the
   only line that survives the property-by-property test, and it leaves the consumer's design system
   fully in charge of everything it would want to be in charge of.

## Consequences

### Positive
- A consuming project can install its own typography — components, utilities or a plain stylesheet —
  and nothing here fights it.
- The relationships are `em`-based, so they rescale with whatever the consumer installs rather than
  needing to be re-derived.
- `Heading`'s real value is isolated and survives: the **legality matrix** (element and appearance
  are independent axes, except where a cell duplicates another component's job) is structure, not
  taste, and it is portable to any type system.
- The survivability test is something a consumer genuinely cannot get elsewhere.

### Costs
- The kitchensink will look plainer, because components stop making appearance decisions.
- Two relationship numbers still have to be agreed, and an `em` relationship is a judgement even if
  it is not a scale.
- A consumer who installs nothing gets browser defaults, and the reference will look unstyled in
  places. That is honest rather than broken, but it needs saying in the README.

### Risks to manage
- **The relationships can drift back.** `0.875em` and `0.75em` for the same concept is exactly how
  this started. Named once, referenced everywhere, and greppable.
- **"Mechanics" can be stretched to justify taste.** The test is whether removing the declaration
  breaks something measurable. If it only looks worse, it is taste.
- **Dangling references.** `Combobox` points at a scale that does not exist. Parked legacy is
  excluded from contract standards, but a dangling variable is not a style choice, it is a defect.

### Non-goals
- A type scale, a ratio, a font stack, or a set of typographic roles.
- Vertical rhythm and the spacing between text blocks.
- `Heading` and `Prose` as suppliers of appearance. If they are ever built, they carry structure —
  the element/appearance split and the legality matrix — and read appearance from the consumer.
- Fluid type, breakpoint steps and clamp arithmetic.

### Kernel dependencies
- None — this ADR sets a boundary, not code.

## Follow-ups this ADR creates

1. A WCAG 1.4.12 survivability test across every component: force the four properties, assert no
   clipping and no overlap.
2. Agree the two `em` relationships, name them, and point the 27 measured sites at them.
3. Delete the two appearance opinions in `RangeGroup` (`letter-spacing`, `text-transform`).
4. Resolve `Combobox`'s dangling scale references — remove them rather than declare a scale.
5. Reconcile the three `measure` values, and bring the 50rem one under the 80-character ceiling or
   record why it is exempt.

## Reconsider when

- A consuming project reports that the `em` relationships fight its scale. That would mean even a
  relationship is too much opinion, and components should inherit size entirely.
- `Heading` is built. Its legality matrix will test whether "structure without appearance" is
  actually expressible, or whether a matrix without a scale is empty.
- WCAG adds a criterion that fixes a typographic *value* rather than a tolerance. That would move
  that value from taste to invariant.

## References

- ADR-0018 (`--ui-*` is the theming seam), ADR-0004 (clarity over DRY; components self-contained),
  ADR-0002 (`data-*` is the public API)
- ADR-0020 — the precedent that a category must survive its own discriminator
- WCAG 2.1 SC 1.4.12 Text Spacing (AA), SC 1.4.8 Visual Presentation (AAA)
- `Picklist.css` — the `em`-relationship reasoning, written before this ADR named it

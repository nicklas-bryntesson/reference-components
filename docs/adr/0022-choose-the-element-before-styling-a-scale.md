# ADR 0022: Choose the element before styling a scale

**Status:** Accepted
**Date:** 2026-08-18
**Decider:** Nicklas Bryntesson

## Context

A slider is the first control this library has considered where **presentation leaks into
semantics**. `appearance: none` — the first line of any styling attempt — removes the browser's
`<datalist>` tick marks and the focus ring, hands the author a coordinate system they did not ask
for, and leaves the meaning of the scale living only in the visual layer until someone actively
mirrors it into `aria-valuetext`. Nothing in ARIA knows that tick marks exist.

That makes the usual order wrong. Picking a control by how it should *look* — "a slider with
labelled steps" — routes work to `<input type="range">` for cases where the range is the wrong
element outright, and the gap only shows up under a screenreader. Two symptoms recur: a control
that must have "no answer yet" but a range always carries a value, and an author writing the same
word list twice, once in markup and once in CSS or JS.

The library already ships the components most of those cases actually need — `ChoiceField`,
`ChoiceGroup`, `Picklist` — so the cost of the wrong turn is not a missing component. It is a
bespoke, inaccessible reimplementation of one we have.

## Decision

**The element is chosen before anything is styled, and it is chosen by one test:** does the same
distance along the track mean the same thing everywhere? If there is no unit to answer in, there is
no scale — only ordered options.

| Situation | Element | Note |
|---|---|---|
| Continuous quantity, linear (volume, percent, temperature) | `<input type="range">` | `aria-valuetext` for the unit only |
| Continuous quantity read multiplicatively (money, zoom, exposure) | `<input type="range">` on a log scale | `aria-valuetext` carries the real value |
| Arbitrary ordered set with named steps (off/low/mid/high, Likert) | `<fieldset>` + radios | `ChoiceGroup` + `ChoiceField`, or `Picklist` when it reads as chips — **unless the sweep is the point; see below** |
| The same, but a long list | `<select>` | |
| Two values bounding a span | two inputs | `multiple` on range was never implemented |
| An exact value that must be typeable | `<input type="number">` | |
| A measurement that is read, not set | `<meter>` | **not** a disabled range |
| How far something has progressed | `<progress>` | |

**The ordered-set row has one caveat, and it is a real one.** The test above measures *semantics* —
whether a distance along the track means anything. It does not settle *behaviour*. Dragging a
handle, clicking anywhere on the lane and sweeping on touch are a continuous pointer gesture over a
shared surface, and N discrete targets cannot offer them (a radio group also has no Home/End). So a
scale of words can legitimately want slider behaviour, and radios are the right **default** for an
ordered set rather than the only answer.

What such a control costs, and why it is not simply a restyled radio group: its value is an index
that *stands for* a meaning, so two things must be kept in step from a single source of truth; the
form receives that index rather than the word; and "no answer yet" stays impossible. That is a
contract of its own, not a variant — it is recorded separately as a proposed component.

Two consequences of the test are binding regardless of element:

- **Tick marks are decoration.** Nothing in ARIA models them, so they belong in CSS — and the
  meaning they carry must be borne by `aria-valuetext`. Marks without labels need no ARIA at all:
  `step` already makes the keyboard land on exactly those values, so both channels agree for free.
- **The visible scale is the source of truth.** Words live in the DOM and are mirrored into
  `aria-valuetext`, never derived in a stylesheet. A word that exists only as CSS `content` cannot
  be selected, copied, translated, or read back by JS.

## Considered alternatives

1. **Leave element choice to each component's `.md`.** Rejected — the decision is cross-cutting.
   It governs Rating, Stepper, Filter and anything else with an ordered set, and stating it once
   per contract guarantees drift (the failure mode ADR-0019 and ADR-0020 both had to clean up).
2. **Encode the tree as a lint or a test.** Rejected — the input is a design intent, not a fact in
   the code. No static check can tell a budget slider from a Likert scale.
3. **State it as a repo-wide rule, ahead of the components that follow it (chosen).** It routes
   most cases to contracts that already exist, and it makes the range family's scope boundary a
   consequence rather than an assertion.

## Consequences

### Positive
- Most "slider" requests resolve to `ChoiceGroup`/`ChoiceField`/`Picklist`, which are built,
  tested and accessible. The tree is a reuse mechanism before it is a naming rule.
- The range family's scope shrinks to the narrow continuous case, which is why it fits in one
  contract per tier rather than one per use case.
- `<meter>` and `<progress>` get named as the right answers for read-only values, closing a gap
  the library never addressed.

### Costs
- A judgement call remains at the top of the tree. The test is sharp but it is applied by a human.
- Log scales still need `aria-valuetext`, because a range is linear in its own value regardless of
  how the positions are laid out.

### Risks to manage
- **Uneven stops.** `step` cannot express irregular values. Snapping on `change` fixes the pointer
  and breaks the keyboard, which then moves one raw unit at a time. When the stops are uneven, ask
  first whether the set is genuinely closed — if it is a budget it is continuous, and the numbers
  are labels on a log track with `step="any"` and rounding, not stops.
- **Zero cannot be logged.** `log(v+1)` distorts more than it fixes. Prefer admitting that zero is
  an on/off state written as a digit: a toggle plus a log slider over the non-zero range.

### Non-goals
- Ranking or reordering controls. Ordered output, but the interaction is drag-and-drop, not a scale.
- `<meter>` and `<progress>` as components. Named here as correct answers; neither earns a contract
  until something in the library actually needs one.

### Kernel dependencies
- None — this ADR sets a convention, not code.

## Reconsider when

- CSS Forms L1 ships `::track` / `::fill` / `::thumb` broadly enough that `appearance: none` stops
  being a cliff. The tree's *shape* would survive, but its central premise — that styling costs you
  the ticks and the focus ring — would need restating.
- A tick-mark or tick-label primitive appears in ARIA. That would move "ticks are decoration" from
  a fact to a choice.

## References

- `docs/atomica11y/form/range-slider-input.md` — the keyboard and screenreader criteria
- ADR-0015 (one component keyed on native `type`), ADR-0020 (a category must survive its own
  discriminator), ADR-0005 (feature detection is progressive enhancement only)
- `ChoiceGroup.md`, `ChoiceField.md`, `Picklist.md` — where most of this tree lands
- [CSS Forms Level 1](https://www.w3.org/TR/css-forms-1/) — `::track` contains `::fill`
- [WAI-ARIA APG: Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

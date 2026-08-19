# ADR 0024: A scale of words is its own component, not a RangeScale variant

**Status:** Proposed
**Date:** 2026-08-19
**Decider:** Nicklas Bryntesson

## Context

ADR-0022 routes an arbitrary ordered set with named steps to `<fieldset>` + radios, and ADR-0023
built the range family on the narrow continuous case that remains. While building RangeScale's tick
labels, the contract asserted that labels are "numeric by definition" — reasoning that a scale of
words *is* an ordered set, therefore radios, therefore not a range.

That reasoning conflated two independent questions. The test in ADR-0022 measures **semantics**:
whether a distance along the track means anything. It does not settle **behaviour**. Dragging a
handle, clicking anywhere on the lane and sweeping on touch are one continuous pointer gesture over
a shared surface; N discrete targets cannot offer any of them, and a radio group has no Home/End
either. So a control that slides between words — t-shirt size, quality preset, a Likert scale — is a
real thing that radios do not cover, and calling the two interchangeable was wrong.

Adding words to RangeScale's existing tick labels is the tempting shortcut and it is a trap: the eye
would read "Mid" while the screenreader says "2" unless something actively mirrors the active word.

## Decision

**A scale of words is in scope as its own component, and it does not ship until this ADR is
resolved.** Scope boundary in one line: a native `<input type="range">` whose value is an *index*
into an authored word list, with the active word mirrored into `aria-valuetext`.

The line that makes it separate rather than a variant: everything else in the range family has a
value that **is** its own meaning, and this has a value that **stands for** one. Keeping those two in
step from a single source of truth is a contract about meaning, not about drawing a lane — which is
all RangeScale promises.

RangeScale's own labels stay numeric, and its contract now says so as a scope boundary rather than a
law.

## Considered alternatives

1. **Words in RangeScale's tick labels.** Rejected — it borrows the lane's geometry and quietly
   inherits none of the responsibility. The mirroring has to live somewhere, and a component whose
   contract is "draw a lane" is the wrong owner.
2. **A sweepable radio group** — `role="radiogroup"` with pointer handling bolted on. Rejected:
   substantial work to re-implement, less accessibly, the interaction a native range already has.
3. **Leave it to the consuming project.** Rejected — the failure is invisible (a channel split only a
   screenreader hears), which is exactly the class of thing a reference library exists to solve.
4. **Its own component, keyed on the value being an index (chosen).** The new responsibility is
   named, and the honest costs below are stated up front rather than discovered.

## Consequences

### Positive
- Full slider behaviour over an ordered set: drag, click anywhere, sweep, Home/End.
- Native semantics throughout — `role="slider"` and the value properties come free.
- The word list has one home, in the DOM, and is mirrored from there.

### Costs
- **The form receives an index, not the word.** The server gets `2`, not `"Mid"`. The mapping is the
  consumer's, and for a plain form field that alone is a reason to choose radios instead.
- **"No answer yet" is impossible.** A range always carries a value, so `required` in that sense
  cannot be expressed. A satisfaction question that must distinguish an answer from an
  unanswered control cannot use this — and one that starts in the middle biases responses toward it.

### Risks to manage
- **The gesture may not survive contact.** Sweeping across four discrete words is jumpy: the
  continuous feedback that makes a range worth the trouble does not exist when only four positions
  can be landed on. This must be tried with a pointer and on touch before anything is built, and it
  is a legitimate outcome that radios win on behaviour too.
- **`aria-live` is the wrong instinct.** A slider already announces on change, so a live region
  would say the value twice. The mechanism is `aria-valuetext` and nothing more. A live region only
  becomes relevant if the word changes something *else* on the page, and then it is that thing's
  announcement, in the consumer's own persistent region.
- **Two sources of truth is the failure mode.** If the words exist in both markup and script, the
  element was chosen wrongly regardless of how the component is built.

### Non-goals
- Multi-select or any cardinality beyond one value.
- Uneven spacing between words. If the gaps are meaningful, the axis is a quantity, not a set.
- Free text or an editable list.

### Kernel dependencies
- None expected — it composes RangeField and, if it needs a lane, RangeScale.

## Reconsider when

- **The pointer and touch trial says radios are better.** Then this ADR is rejected, and the tree in
  ADR-0022 goes back to having no caveat worth stating.
- A native way to bind a range's value to a label list appears, which would remove the mirroring
  entirely.
- The first real port asks for it. Until something needs it, `Proposed` is the correct status.

## References

- ADR-0022 (choose the element first) — the caveat on its ordered-set row points here
- ADR-0023 (the range family splits three ways) — the lane whose labels stay numeric
- `RangeScale.md` — states the numeric labels as a scope boundary
- `docs/atomica11y/form/range-slider-input.md`
- [WAI-ARIA APG: Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

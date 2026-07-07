# ADR 0002: `data-*` attributes are the component's public API

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records a decision in force since the first components; formalized in `.claude/philosophy.md`._

## Context

A reference component has two audiences that must not reach into each other's
internals: JavaScript that drives behaviour, and CSS that renders state. It also has a
third: the kitchensink, which must render every state (hover, focus, disabled, invalid,
filled) with no JS running. Without a single agreed surface between JS, CSS, and markup,
state leaks into JS variables CSS can't see, into class-name conventions that fight the
cascade, and into states that can't be reproduced statically.

## Decision

All component state is expressed as `data-*` attributes on the root element.

- **JS reads and writes `data-*`; CSS responds to it.** A state held only in a JS
  variable is a hidden state CSS and tests can't observe — state is always reflected to
  the DOM.
- **Boolean state carries the explicit literal `="true"`** — never a bare/empty
  attribute. `[data-disabled="true"]` reads as a condition, not an existence check; the
  off state removes the attribute.
- **The CSS class is always PascalCase matching the component** (`.DateField`,
  `.ToggleTip`). No BEM modifiers (`.DateField--disabled`), no utility classes.
- **Interaction states are paired selectors:** every real pseudo-class has a
  `data-test-state` counterpart on the root (`&:hover, &[data-test-state="hover"]`), so
  the kitchensink renders every state without JS.

## Considered alternatives

1. **BEM modifiers + class toggling in JS** — Rejected: modifier classes fight the base
   rule (ADR-0003), and JS-owned class lists become the hidden state CSS can't fully see.
2. **State in JS, CSS driven by inline styles** — Rejected: not inspectable, not
   reproducible in a static kitchensink, and couples CSS to JS internals.
3. **Bare boolean attributes (`data-disabled` with no value)** — Rejected: an empty
   declaration reads as an existence check, not a condition, in both HTML and selectors
   (`b5b7323` made every boolean explicit family-wide).
4. **`data-*` as the sole surface (chosen)** — Chosen: one contract for JS, CSS, tests,
   and the kitchensink; ports cleanly (a `data-*` attribute is framework-agnostic).

## Consequences

### Positive
- One inspectable, portable surface; JS and CSS never touch each other's internals.
- Every state is renderable statically → the kitchensink and e2e suite can assert it.
- `data-*` maps 1:1 onto any framework's attribute binding when porting.

### Costs
- More verbose than a bare attribute or a class toggle.
- JS must remember to reflect state to the DOM rather than hold it internally.

### Risks to manage
- "No impossible states" depends on discipline — the source of truth (JS + `generate.ts`)
  must never author invalid attribute combinations; CSS then never guards against them.

## Reconsider when

- A platform primitive (e.g. a standardized state API for custom elements) offers the
  same inspectable, static-renderable surface with less ceremony.

## References

- `.claude/philosophy.md` → "Markup rules", "JavaScript rules"
- ADR-0003 (bounded CSS — the cascade strategy this surface feeds)
- ADR-0005 (`:has()` PE-only — the corollary: DOM facts become `data-*`, never inferred)
- Commit `b5b7323` — explicit `="true"` on all boolean data attributes, family-wide

# ADR 0005: Feature detection is progressive-enhancement-only; `:has()` is never load-bearing

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records a standing rule; stated explicitly in `AffixField.md` and applied family-wide._

## Context

Modern CSS can infer structural facts (`:has()`) and branch on capabilities
(`@supports`). It is tempting to let layout *depend* on `:has(.Prefix)` or on a feature
query. But when a DOM fact is load-bearing layout data, inferring it in CSS means the
layout silently changes if the selector's support or the DOM shape shifts — an implicit
dependency that contradicts the explicit-state contract (ADR-0002) and the deletability
rule (ADR-0003).

## Decision

Feature detection and structural CSS selectors are **progressive enhancement only** —
never load-bearing.

- **A load-bearing DOM fact is made explicit as a `data-*` attribute, and CSS gates on
  that**, not on `:has()`. Example: affix presence drives input padding, so it is
  expressed as `data-has-prefix="true"` / `data-has-suffix="true"` (end-state data) and
  the padding gates key on the attribute exactly — `:has()` is never in that path.
- **`@supports` branches are fully isolated** (the deletability rule): a fallback for a
  browser lacking a feature is self-contained, and when the baseline is met the entire
  `@supports not (...)` block is deleted with no other edits.
- `:has()` and similar may still be used for *enhancement* that degrades gracefully —
  never for anything the layout or behaviour depends on.

## Considered alternatives

1. **Let `:has()` drive load-bearing layout** — Rejected: makes layout depend on selector
   support and live DOM shape; an implicit dependency that can't be gated or deleted
   cleanly, and invisible to JS and tests.
2. **JS feature-flags mutating classes** — Rejected: reintroduces hidden state (ADR-0002)
   and couples CSS to JS internals.
3. **Explicit `data-*` for facts + isolated `@supports`, `:has()` as PE only (chosen)** —
   Chosen: every load-bearing fact is inspectable and gateable; capability branches are
   independently deletable.

## Consequences

### Positive
- Layout never changes silently on a selector-support or DOM-shape shift.
- Every load-bearing fact is inspectable, testable, and portable as an attribute.
- Capability fallbacks are single-delete when their baseline arrives.

### Costs
- A small amount of JS (or server rendering) to project a DOM fact into a `data-*`
  attribute, rather than "getting it for free" from `:has()`.

### Risks to manage
- The convenience of `:has()` for a load-bearing case will recur — review must catch it
  and convert the fact to `data-*`.

## Reconsider when

- Never for the load-bearing/PE split (a stance). The `@supports` fallbacks retire
  individually as their browser baselines are met.

## References

- `AffixField.md` → `data-has-prefix` row ("affix presence is load-bearing layout data,
  so it is expressed as end-state data — never inferred with `:has()`")
- `.claude/philosophy.md` → "Deletability test" (the `@supports` isolation rule)
- ADR-0002 (make DOM facts explicit `data-*`), ADR-0003 (bounded/deletable branches)

# ADR 0004: Clarity over DRY; `src/kernel/` is the single deliberate exception

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records a decision in force since the first components; the kernel tier was extracted 2026-06-03 (PR #2)._

## Context

This repo is a guide for consumers to read and port functionality, not a package that
runs as-is. A consumer ports one component at a time into their own stack. A shared
abstraction that makes the source DRY makes the *port* harder: the reader must chase
indirection across files to understand a single component. So the usual DRY instinct is
actively wrong here — except where re-specifying shared behaviour per component is how
subtle bugs creep in.

## Decision

Favour clarity over DRY: each component is self-contained and self-documenting so it can
be read — and ported — in isolation, even when that repeats a pattern an abstraction
could have hidden.

**The one deliberate exception is `src/kernel/`.** Non-trivial shared behaviour —
looping 3D wheel maths (Dec↔Jan wrap, leap years, min/max clamp), popover positioning,
locale-aware date maths, popup focus-trap + scroll containment — lives in the kernel with
its own contract and conformance tests. Sharing these is a **correctness mechanism**, not
a reuse convenience: re-specifying a looping wheel per component is exactly how the wrap
and leap-year bugs appear. Each component's `.md` lists what it composes under
`## Kernel dependencies`; the portable unit is **the kernel plus the components that
compose it**, not a lone component.

## Considered alternatives

1. **Conventional DRY (extract every shared pattern)** — Rejected: indirection makes each
   component harder to read and port in isolation, defeating the repo's purpose.
2. **No sharing at all (every component fully standalone)** — Rejected: re-specifying
   looping-wheel / date / popover maths per component reintroduces subtle, drifting bugs.
3. **Anti-DRY by default + a narrow kernel tier for correctness-critical shared behaviour
   (chosen)** — Chosen: components stay readable and independently portable; the handful
   of things that *must not drift* are specified once and conformance-tested.

## Consequences

### Positive
- A component can be read and ported without chasing indirection across the tree.
- Correctness-critical shared maths is specified and tested once and cannot drift.
- The kernel/consumer boundary is explicit (each `.md`'s `## Kernel dependencies`).

### Costs
- Deliberate repetition across components (accepted, and called out where it occurs).
- The kernel is a second thing to port first — but only for components that compose it
  (AffixField and FileUpload have no kernel deps and port on their own).

### Risks to manage
- Scope creep into the kernel: something shared but *not* correctness-critical does not
  belong there. Promotion to the kernel is itself a direction → its own ADR.

## Reconsider when

- A third component needs a piece of shared behaviour currently duplicated: that's the
  trigger to promote it into the kernel (with an ADR), not before.

## References

- `README.md` → "The kernel — shared primitives" (states this stance verbatim)
- `src/kernel/README.md` — the kernel manifest + token contract
- ADR-0002, ADR-0003 (the clarity-first contracts this stance protects)

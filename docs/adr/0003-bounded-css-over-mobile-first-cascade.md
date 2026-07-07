# ADR 0003: Bounded CSS — gate selectors over the mobile-first cascade

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records a decision in force since the first components; formalized in `.claude/philosophy.md`._

## Context

The conventional mobile-first pattern declares a base value and overrides it up a
`min-width` cascade. The same habit extends to states and variants: declare a default,
then fight it with more specific rules. The result is that a property is in the cascade
even when it doesn't apply, its real value depends on what won the override war, and no
block can be deleted without checking what it was overriding. For a repo whose job is to
be *read and ported*, that implicit coupling is the enemy.

## Decision

Each declaration is bound to the context where it is valid; nothing is declared only to
be overridden.

- **Deletability test:** any block — a media range, a `@supports` branch, a state gate —
  must be removable without touching anything outside it. If deleting it requires cleanup
  elsewhere, it wasn't properly bounded.
- **Bounded ranges, not a cascade:** `(width >= 600px) and (width < 900px)` — each
  breakpoint is self-contained, not a `min-width` chain.
- **Conditional properties live behind a gate:** a property that only applies in some
  states never appears in the base rule. The grouped gate selector declares it once;
  individual selectors set a `--_*` private variable.
- **`--_*` private props carry no value in the base** — they have meaning only once a
  variant sets them.
- **The base rule contains only unconditional properties** — everything that varies by
  attribute sits behind a gate.

## Considered alternatives

1. **Mobile-first `min-width` cascade** — Rejected: base values exist only to be
   overridden; the effective value is implicit and the base can't be deleted safely.
2. **Defaults with `var(--_x, fallback)` in the base** — Rejected: the property is always
   in the inspector (noise even when the variant is never used) and re-enters the cascade
   unconditionally.
3. **Bounded ranges + gate selectors (chosen)** — Chosen: every declaration is where it's
   valid; blocks are independently deletable; the cascade never fights itself.

## Consequences

### Positive
- The inspector shows only properties that actually apply — readable, portable CSS.
- Removing a state, variant, or breakpoint is a local delete.
- Variants never fight the base, so specificity wars don't accumulate.

### Costs
- More selectors than a terse base-plus-overrides sheet.
- Requires discipline: the reflex to "set a default and override" must be resisted.

### Risks to manage
- A property sneaking into the base "for convenience" quietly breaks deletability — the
  gate is the contract, and review must hold it.

## Reconsider when

- A CSS mechanism makes context-bound declaration terser without reintroducing the
  override cascade (this is a strategy, not a workaround — unlikely to retire).

## References

- `.claude/philosophy.md` → "The core principle", "Deletability test", "CSS rules"
- Generic CSS, Mobile First — Hodgson, 2018 (the argument this extends beyond breakpoints)
- ADR-0002 (`data-*` public API — the state surface these gates key on)
- ADR-0005 (`@supports` branches are the same deletability rule applied to feature detection)

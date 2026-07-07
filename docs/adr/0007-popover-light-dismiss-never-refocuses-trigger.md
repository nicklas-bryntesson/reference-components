# ADR 0007: Popover light-dismiss never refocuses the trigger

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records a cross-cutting popover behaviour; TimeField is the reference pattern._

## Context

Every popover in the repo (date/time pickers, ToggleTip) closes two ways: **Escape** and
an **outside click** (light dismiss). Escape is a keyboard action from inside the popup —
returning focus to the trigger is correct and expected. But an outside click is a
pointer action whose focus target is wherever the user clicked. Calling `trigger.focus()`
on light-dismiss steals focus back to the trigger and, worse, scroll-jumps the page to
bring the trigger into view — a jarring bug that recurred as each component grew its own
close path.

## Decision

Close paths are split by origin:

- **Escape (keyboard, from inside the popup): close + refocus the trigger.** This stays
  per-component — it needs component state and the live picker instances.
- **Outside-click light-dismiss: close only — never call `trigger.focus()`.** Focus stays
  wherever the pointer put it; no scroll-jump, no focus theft.

Focus containment *while the popup is open* is a separate concern owned by the
`popup-interaction` kernel primitive (cyclic Tab trap + scroll containment for
`aria-modal="true"`). This ADR governs only what happens on close.

## Considered alternatives

1. **Always refocus the trigger on close** — Rejected: on outside-click it steals focus
   from the click target and scroll-jumps the page to the trigger.
2. **Never refocus, even on Escape** — Rejected: a keyboard user who pressed Escape is
   left with focus detached from any control — an a11y regression.
3. **Split by close origin (chosen)** — Chosen: Escape refocuses (keyboard continuity);
   light-dismiss doesn't (respects the pointer, no scroll-jump).

## Consequences

### Positive
- No scroll-jump or focus theft on outside-click dismiss.
- Keyboard users keep focus continuity after Escape.
- The rule is uniform across the whole popover family.

### Costs
- Two close paths to keep straight per component; the distinction must be honoured in each.

### Risks to manage
- A new popover component re-adding a blanket `trigger.focus()` on every close reintroduces
  the bug — the reference (TimeField) and this ADR are the guard.

## Reconsider when

- The platform Popover API's built-in light-dismiss provides focus semantics that make the
  manual split unnecessary — revisit against its behaviour then.

## References

- `src/kernel/js/popup-interaction.md` — the open-state focus trap + scroll containment
  (Escape refocus and Arrow stepping are noted there as per-component)
- TimeField — the reference implementation for the split close paths
- ADR-0006 (the same components' native-fallback face)

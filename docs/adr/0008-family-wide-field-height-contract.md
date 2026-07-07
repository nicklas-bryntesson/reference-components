# ADR 0008: Family-wide field-height contract

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records the metric contract aligned family-wide in PR #16 (`48f038a`)._

## Context

The field family (DateField, DateTimeField, TimeField, MonthField, WeekField,
AffixField) grew component by component, and their bordered boxes drifted apart in
height, and their trailing icons in size and display. Fields sit next to each other and
next to buttons in real forms; visually and for hit-target consistency they must share
one metric baseline. Divergent per-component values are exactly the kind of drift a
reference set must not ship.

## Decision

Every field in the family honours one metric contract:

- **The bordered box is at least `2.5rem` (40px) tall**, expressed per component as a
  `--<prefix>-field-min-block-size: 2.5rem` token (`--df-`, `--tf-`, `--wf-`, `--af-`, …)
  so each component stays self-documenting while the value is identical.
- **Trailing icons are `18px` and `display: block`** — a consistent optical size and no
  inline-layout baseline gap.
- **Adjacent buttons match the field height** so a field and its button align on the same
  40px baseline.

The value lives as a per-component custom property (not a shared variable) deliberately:
it keeps each component readable and portable in isolation (ADR-0004), and the shared
figure is documented as a contract, not enforced by a common dependency.

## Considered alternatives

1. **Per-component ad-hoc heights** — Rejected: the drift this ADR fixes; fields and
   buttons don't align.
2. **A single shared `--field-min-block-size` variable across the family** — Rejected:
   introduces a cross-component dependency that fights the clarity-over-DRY stance
   (ADR-0004) and the per-component-token convention.
3. **Identical value as a per-component token + documented contract (chosen)** — Chosen:
   one baseline in practice, each component still self-contained and portable.

## Consequences

### Positive
- Fields, and fields-next-to-buttons, align on one 40px baseline.
- Consistent icon sizing removes the inline-baseline gap.
- Each component keeps its own readable token; nothing depends on a shared variable.

### Costs
- The shared value is duplicated across components by design — if the baseline changes it
  must be updated in each (the contract, and this ADR, are the record of what the value is).

### Risks to manage
- A new field joining the family must adopt the same `2.5rem` / `18px` metrics — this ADR
  and the existing components' CSS comments are the reference.

## Reconsider when

- The host design system mandates a different control height as its baseline — then the
  contract value changes family-wide (record the new value in a superseding ADR).

## References

- Commit `48f038a` / PR #16 — align field metrics to DateField family-wide
- Per-component CSS: `--df-field-min-block-size`, `--tf-…`, `--wf-…`, `--af-…` (all `2.5rem`)
- ADR-0004 (why the value is a per-component token, not a shared variable)

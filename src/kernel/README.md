# Kernel

Shared primitives that components compose. **Port and verify the kernel once**, then components stay
thin and cannot drift in the shared behaviour.

## Why this tier exists

Several components need the same non-trivial behaviour: a 3D wheel with year-boundary looping and
momentum/snap, popover positioning, locale-aware date maths. If every component re-implemented these
from a spec, the subtle edge cases (Dec↔Jan loop, leap years, locale segment order, min/max clamp)
would get re-interpreted per component and drift. Sharing them is a **correctness mechanism**, not
just hygiene. This folder makes that coupling **explicit** instead of hidden behind `../../../`.

## Modules

| Module | Kind | Conformance test | Consumed by |
|--------|------|------------------|-------------|
| [`js/WheelColumn.ts`](js/WheelColumn.md) | DOM primitive | `js/tests/WheelColumn.unit.test.ts` (standalone e2e/axe **deferred**) | DateField, DateTimeField, TimeField, MonthField |
| [`js/popup-position.ts`](js/popup-position.md) | pure functions | `js/tests/popup-position.unit.test.ts` | DateField, DateTimeField, TimeField, MonthField, WeekField, ToggleTip |
| [`js/popup-interaction.ts`](js/popup-interaction.md) | DOM primitive | `js/tests/popup-interaction.unit.test.ts` (+ field e2e) | DateField, DateTimeField, TimeField, MonthField, WeekField |
| [`utils/dates.ts`](utils/dates.md) | pure functions | `utils/tests/dates.unit.test.ts` | DateField, DateTimeField, MonthField, WeekField |
| [`utils/locale.ts`](utils/locale.md) | pure functions | (covered via component tests) | DateField, DateTimeField, TimeField, MonthField, WeekField |
| [`css/Wheel.css`](css/Wheel.md) | CSS primitive | visual/axe **deferred** (paired with WheelColumn) | DateField, DateTimeField, TimeField, MonthField |
| [`js/motion-policy.ts`](js/motion-policy.md) | pure functions | `js/tests/motion-policy.unit.test.ts` | MotionRegion |

The kernel modules have **zero dependencies on each other** — each can be ported independently.
The pure-function modules (`popup-position`, `dates`, `locale`) are black-box-portable: port the
function, run the conformance test against your implementation. The DOM primitive (`WheelColumn` +
`Wheel.css`) is a JS+CSS pair — porting one without the other yields unstyled, overlapping text.
`popup-interaction` is a standalone DOM primitive (no CSS): it wires a cyclic focus trap +
wheel-scroll containment onto any popup container given its ordered tab stops.

## How to port

1. Port the kernel modules a component declares (see each component's `## Kernel dependencies`).
2. Run the kernel conformance tests against your port.
3. Then port the component — it composes the kernel and adds only its own thin layer.

## Decision record

Why this tier exists at all — the one deliberate exception to the repo's clarity-over-DRY
stance — is recorded in [ADR-0004](../../docs/adr/0004-clarity-over-dry-kernel-is-the-exception.md).
Promoting a new piece of shared behaviour into the kernel is itself a direction → write an ADR.

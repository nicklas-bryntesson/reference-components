# ADR 0006: Custom controls fall back to the native control on coarse pointers

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records the display/custom input-mode model; DateField is the reference._

## Context

The date/time family renders a custom, editable-segment UI with a popover picker on
desktop. On touch devices the OS date/time pickers are excellent, familiar, and
accessible, and a custom popover fights the platform (soft keyboard, scroll, hit
targets). A field must submit a value in a form either way. So the same component needs
two faces without forking into two components.

## Decision

A custom control degrades to the browser's native control on coarse pointers, keyed off
a single `data-input-mode` attribute:

- **`data-input-mode="custom"` (fine pointer):** the custom segments are the accessible
  control; JS removes `aria-hidden` from the custom layer, and the native `input` is
  hidden from everyone (`visibility: hidden`) and serves only as the value carrier for
  form submission.
- **`data-input-mode="display"` (coarse pointer):** the custom layer stays `aria-hidden`
  and purely visual; the native input is the accessible, interactive control and carries
  the value. On touch the native picker drives.
- **The native input receives the committed value in both modes** — form submission is
  identical regardless of face.
- The mode is feature-detected (pointer coarseness), not user-agent sniffed.

## Considered alternatives

1. **Custom popover everywhere, including touch** — Rejected: fights the mobile platform
   (soft keyboard, scroll, hit targets) and throws away well-built, accessible OS pickers.
2. **Native input everywhere** — Rejected: loses the desktop segment/wheel UX and the
   consistent styling a design system needs.
3. **Two separate components (desktop vs mobile)** — Rejected: duplicates the contract and
   splits the value/submission story.
4. **One component, two faces via `data-input-mode` (chosen)** — Chosen: one contract, one
   submitted value, the right control per platform; the switch is a single inspectable
   attribute.

## Consequences

### Positive
- The right control on each platform, from one component and one submitted value.
- The mode is an inspectable `data-*` attribute (ADR-0002) — testable and portable.
- iOS/Android native pickers do the mobile a11y heavy lifting for free.

### Costs
- Two rendering paths and two accessibility wirings to keep correct per component.
- The custom layer must be genuinely inert (`aria-hidden`) in display mode or it
  double-announces.

### Risks to manage
- Pointer-coarseness detection is a heuristic (hybrid devices) — the native fallback must
  always be a correct, submittable control so a wrong guess is never broken, only
  suboptimal.

## Reconsider when

- Native date/time controls gain the styling and API control that made the custom desktop
  UI necessary, collapsing the two faces back into one.

## References

- `DateField.md` → "Accessibility" (`data-input-mode="custom"` vs `"display"`)
- ADR-0002 (`data-*` as the mode surface)
- The date/time family: DateField, DateTimeField, TimeField, MonthField, WeekField

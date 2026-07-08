# ADR 0012: Popover clipping in overflow ancestors is a documented limitation, not a reference fix

**Status:** Accepted
**Date:** 2026-07-08
**Decider:** Nicklas Bryntesson

## Context

Every popover component in the repo (ToggleTip and the date/time family's
calendars/wheels) positions its popup in normal flow — `position: absolute` plus
JS-computed offsets from the `popup-position` kernel. That means any ancestor with
`overflow: hidden | auto | scroll` clips or scrolls the popup: a scroll container, a
table cell that scrolls, a masked panel. This surfaced in real consuming work (tables
allowed inside scroll containers, with a ToggleTip in a cell) — the popup becomes
"pannkaka." It is inherent to absolute-in-flow positioning, and native mobile pickers
avoid it precisely because they render in the OS/top layer.

The escape is to lift the popup out of the flow into a viewport-level layer — the
**Popover API top layer**, or a **portal** to `document.body` with `position: fixed` +
reposition-on-scroll. Both work; the top layer is the modern answer (it also grants
light-dismiss / Esc / one-at-a-time for free).

The open question is not *whether* an escape exists, but **which layer owns it.** An
earlier decision deferred a top-layer fix to consuming projects; this ADR makes that
boundary explicit and records the reasoning.

## Decision

**The reference documents the limitation and keeps the positioning maths portable; it
does not ship a top-layer/portal escape or a feature-detection strategy.** That belongs
to the **consuming project's** layer.

- **Reference owns:** the positioning maths (`popup-position` kernel), a clean seam (the
  markup/behaviour must not *prevent* a consumer lifting the popup to the top layer), and
  an honest **`## Known limitations`** note in every popover contract + the kernel doc.
- **Consumer owns:** the escape mechanism (Popover API vs portal) *and* the
  feature-detection / browser-baseline policy around it. That policy is genuinely
  environment-specific and looks different per stack — a Tailwind shop writes
  `supports-[…]` variants, a React app conditionally calls `showPopover()`, a plain
  project uses `@supports`. Baking one form into the reference would impose the wrong
  strategy on the other two.

We do **not** self-clip: verified that ToggleTip's `overflow: hidden` is a pre-init FOUC
guard only (flipped to `visible` on `[initialized]`); the open popup renders in
`overflow: visible` and escapes its own host box. The clipping is strictly *ancestor*
clipping, which is the consumer's context.

## Considered alternatives

1. **Ship a `@supports (popover)` top-layer PE branch in the reference** — Rejected:
   feature-detection and how-forward-leaning-to-be is a *policy* that varies per consuming
   stack; the reference would dictate the wrong one for Tailwind/React/plain consumers.
2. **Bake a portal-to-body implementation into the components** — Rejected: same layer
   overreach, and it couples the reference to a specific rendering strategy.
3. **The `transform` + `position: fixed` breakout trick** — Rejected: works only in a
   specific ancestor shape and breaks unpredictably with any other transformed/filtered/
   contained ancestor; too brittle for a reference.
4. **Document the limitation + keep the seam portable, escape is the consumer's (chosen)**
   — Chosen: honest, correct on the layer boundary, and lets each consumer apply the
   escape in their own idiom while reusing our maths.

## Consequences

### Positive
- The limitation is discoverable (in each contract + the kernel), not a surprise in production.
- Consumers keep full control of their browser-baseline / rendering-strategy policy.
- The `popup-position` maths stays reusable regardless of which escape a consumer picks.

### Costs
- The reference's own kitchensink still clips inside a scroll container (it is honest about
  this). A "known limitation" demo could show it, but no fix ships here.

### Risks to manage
- Re-flagging: without this record the gap keeps being reported as a bug. This ADR + the
  `## Known limitations` notes are the closure.
- Adopting the Popover API later would interact with **ADR-0007** (light-dismiss must not
  refocus) — the native close-focus behaviour must be checked against it. Noted for whoever
  takes the escape (consumer or a future reference enhancement).

## Reconsider when

- The Popover API + CSS Anchor Positioning reach a cross-browser baseline where a
  top-layer default could ship in the reference *without* imposing a feature-detection
  policy — then revisit whether the reference should own the escape after all.

## References

- `src/kernel/js/popup-position.md` — the portable maths + the `## Known limitations` note
- ADR-0007 (light-dismiss never refocuses — must be re-checked against native popover focus)
- Earlier deferral of the top-layer fix (recorded here with its rationale)
- MDN: Popover API (top layer), CSS Anchor Positioning

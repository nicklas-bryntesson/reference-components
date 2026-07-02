# popup-interaction (kernel / DOM primitive)

Interaction hygiene for a `role="dialog" aria-modal="true"` popup: a **cyclic focus trap** over its
tab stops and **scroll containment** so trackpad wheel events never chain to the page behind. Two
behaviours that belong to the popup as a whole — not to any single wheel or button inside it — and
that otherwise get re-implemented per component and drift.

## Public API

```ts
trapPopupInteraction(opts: {
  container: HTMLElement          // the popup surface (role="dialog"); both listeners attach here
  tabStops: () => HTMLElement[]   // ordered focusable stops: wheels first, then footer buttons
  signal: AbortSignal             // teardown — abort on popup close (mirrors WheelColumn's { signal })
}): void

// Pure, DOM-free wrapping helper (exported for testing / custom traps):
nextTabStop(
  stops: HTMLElement[], current: Element | null, backward: boolean,
): HTMLElement | null
```

## Semantics

- **Cyclic Tab trap.** On `Tab`, `tabStops()` is called fresh, the current stop is located via
  `document.activeElement`, and focus moves to the next stop — wrapping last→first (Tab) and
  first→last (Shift+Tab). Tab is **always** `preventDefault`ed while the popup is open, so focus can
  never escape into the page — the correct behaviour for `aria-modal="true"`. This is the deliberate
  fix for two gaps: (a) once focus reached a **footer button**, Tab used to leak to the page; and
  (b) Shift+Tab from the **first** stop used to close the popup — under the pure trap it wraps to the
  last footer button instead.
- **`tabStops()` is a callback, not a snapshot** — re-read every Tab so the order reflects the live
  DOM (a disabled/absent Clear button, a hidden seconds wheel). Return only focusable elements;
  wheels carry `tabindex` (WheelColumn sets `-1`/`0`), buttons are natively focusable. Programmatic
  `.focus()` works on `tabindex="-1"` wheels, so this composes with the component's roving-tabindex
  wheel-to-wheel navigation rather than fighting it.
- **`nextTabStop` snaps onto an end** when `current` is not a stop (focus on some non-stop element, or
  nothing focused): first going forward, last going backward — a stray Tab always lands back inside.
- **Scroll containment.** A `wheel` listener on `container` (`{ passive: false }`) `preventDefault`s
  every wheel event over the popup surface. The wheel columns already contain scroll on themselves;
  this covers the padding / inter-column gap / footer around them.
- **No scrollable inner region today.** The blanket wheel-preventDefault assumes nothing inside the
  popup needs to scroll. **If a scrollable region is ever added, it must stop propagation (or opt
  out) before this handler runs**, or its own scrolling will be swallowed.

Escape (close + refocus trigger) and ArrowUp/Down → `wheel.stepBy` stay **per-component** — they need
component state and the live `WheelColumn` instances. This primitive owns **Tab + scroll containment**
only.

## Conformance

Black-box: [`tests/popup-interaction.unit.test.ts`](tests/popup-interaction.unit.test.ts) covers the
`nextTabStop` wrapping/wrap-around/snap logic. The trap + scroll containment are exercised end-to-end
by the four field e2e suites (focus stays inside the popup on Tab/Shift+Tab past the last footer
button; a `wheel` on the popup surface is `defaultPrevented`).

Consumed by: DateField, DateTimeField, TimeField, MonthField.

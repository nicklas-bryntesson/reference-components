// Popup interaction hygiene shared by every wheel/calendar popup.
//
// Two behaviours that belong to the popup *as a whole*, not to any one control
// inside it, and that otherwise get re-implemented (and drift) per component:
//
//  1. A cyclic focus trap over the popup's ordered tab stops. This is the
//     correct behaviour for a `role="dialog" aria-modal="true"` surface: Tab
//     past the last stop wraps to the first, Shift+Tab before the first wraps
//     to the last, and Tab is always intercepted so focus never escapes into
//     the page behind the modal.
//
//  2. Scroll containment. The wheel columns already preventDefault their own
//     `wheel` events, but the popup surface *around* the narrow columns
//     (padding, inter-column gaps, footer) does not — so a trackpad scroll
//     landing just off a column chains to the page and jitters the background.
//     A single blanket `wheel` handler on the container stops the chain
//     wherever the pointer sits inside the popup.
//
// Escape (close + refocus trigger) and ArrowUp/Down → wheel.stepBy stay
// per-component: they need component state and the live WheelColumn instances.
// This primitive owns Tab + scroll containment only, and composes with the
// component's roving-tabindex wheel navigation rather than replacing it.

export interface TrapPopupInteractionOptions {
  /** The popup surface (role="dialog"). Both listeners attach here. */
  container: HTMLElement
  /**
   * The popup's tab stops in visual/DOM order — wheels first, then footer
   * buttons. Called fresh on every Tab so the order can reflect the current
   * DOM (disabled/absent buttons, hidden wheels). Must return only elements
   * that can receive focus (wheels carry tabindex, buttons are natively
   * focusable). Empty/single-element lists are handled gracefully.
   */
  tabStops: () => HTMLElement[]
  /** Torn down with the popup — mirror WheelColumn's `{ signal }` teardown. */
  signal: AbortSignal
}

// ─── Pure tab-stop wrapping ──────────────────────────────────────────────────

/**
 * Given the ordered `stops` and the element that currently holds focus, return
 * the element Tab (or Shift+Tab when `backward`) should move to under a cyclic
 * trap. Wraps at the ends. Returns null only when there is nowhere to go
 * (empty list). Pure — no DOM side effects — so it is unit-testable in jsdom.
 *
 * When `current` is not one of the stops (focus sat on some non-stop element,
 * or nothing is focused) we snap onto an end: the first stop going forward,
 * the last going backward — so a stray Tab always lands back inside the popup.
 */
export function nextTabStop(
  stops: HTMLElement[],
  current: Element | null,
  backward: boolean,
): HTMLElement | null {
  if (stops.length === 0) return null

  const i = current ? stops.indexOf(current as HTMLElement) : -1

  if (i === -1) {
    return backward ? stops[stops.length - 1] : stops[0]
  }

  const delta = backward ? -1 : 1
  const next = (i + delta + stops.length) % stops.length
  return stops[next]
}

// ─── Wiring ──────────────────────────────────────────────────────────────────

/**
 * Install the cyclic focus trap + scroll containment on `container`. Both
 * listeners are removed automatically when `signal` aborts (close the popup by
 * aborting its controller). Call once per popup open.
 */
export function trapPopupInteraction(opts: TrapPopupInteractionOptions): void {
  const { container, tabStops, signal } = opts

  container.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const stops = tabStops()
      if (stops.length === 0) return
      const target = nextTabStop(stops, document.activeElement, e.shiftKey)
      if (!target) return
      // Always take over Tab inside an aria-modal dialog — even a single stop
      // (Tab must not leak to the page).
      e.preventDefault()
      target.focus()
    },
    { signal },
  )

  // Contain wheel scroll for the whole surface. The wheel columns preventDefault
  // their own events too; a second preventDefault here is harmless. NOTE: the
  // popup has no legitimately-scrollable inner region today — if one is ever
  // added, it must stop propagation (or opt out) before this blanket handler
  // runs, or its own scrolling will be swallowed.
  container.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault()
    },
    { passive: false, signal },
  )
}

# WheelColumn (kernel / DOM primitive)

An iOS-style 3D wheel/spinner over a numeric range. Drives the month/year pickers (DateField,
DateTimeField, MonthField) and the hour/minute/second columns (DateTimeField, TimeField). Pairs with
[`Wheel.css`](../css/Wheel.md) — the JS injects the structure, the CSS gives it the 3D look.

## DOM contract

The host element is **authored** by the component and must carry `class="Wheel"`. Give it a
`tabindex` if you want it focusable before construction (otherwise WheelColumn sets `tabindex="0"`).

```html
<div class="Wheel" data-picker="month" tabindex="0"></div>
```

On construction, WheelColumn:
- sets `role="spinbutton"`, `aria-valuemin`, `aria-valuemax` on the host;
- per render, sets `aria-valuenow`, `aria-valuetext` (the formatted display; when empty, the
  `emptyText` option — pass the host component's localized "blank"/"tomt" — falling back to `--`.
  The empty state must always carry a valuetext: a spinbutton with min/max but no valuenow makes
  VoiceOver fall back to a computed percentage) and
  `aria-activedescendant` pointing at the centred option;
- injects a `.cylinder` containing nine ``.option` (also `data-part="option"` — the suite and the JS find it by that)` slots (`aria-hidden`, the centred one gets
  `aria-selected="true"` + an id), plus one `.band` appended to the host as a **sibling** of
  the ring. Per [`Wheel.css`](../css/Wheel.md) the band is currently hidden — the visible centre
  band and fade are drawn by the component-authored `.WheelColumns` wrapper.

Do not author `.cylinder` / ``.option` (also `data-part="option"` — the suite and the JS find it by that)` / `.band` — they are generated.

## Public API

```ts
new WheelColumn(el: HTMLElement, opts: WheelColumnOptions)

interface WheelColumnOptions {
  min: number
  max: number
  value: number | null
  onChange: (value: number) => void
  loop?: boolean                      // true (default) = wrap past the ends; false = clamp
  format?: (value: number) => string  // default: zero-padded number; pass month names etc.
  emptyText?: string                  // spoken value while empty; pass the localized "blank"/"tomt" (default "--")
  disabled?: (value: number) => boolean  // reserved (declared, not yet consumed)
}

setValue(value: number | null, animate = true): void  // external set — does NOT fire onChange
stepBy(delta: number): void                            // keyboard ±1 etc — animates, fires onChange
get value(): number | null
readonly count: number
render(): void
destroy(): void                                        // aborts listeners, cancels RAF/timers
```

## Subtle semantics (the reason this is shared, not re-specced)

- **Looping vs bounded.** `loop: true` wraps the index (`Dec → Jan`, the year-boundary case); `loop:
  false` clamps at the ends, kills velocity at an edge, and renders nothing past the ends.
- **Momentum vs snap.** A flick above the velocity threshold runs a friction-based momentum loop, then
  snaps to the nearest row; a slow release snaps directly. `prefers-reduced-motion` short-circuits
  the `_animateTo` paths (click, `stepBy`, animated `setValue`) to an instant set + commit; a drag
  release under reduced motion skips only momentum — the snap easing still animates.
- **External vs user change.** `setValue` sets an internal `_externalSet` flag so syncing the wheel
  from the field does **not** re-fire `onChange` (no feedback loop). User gestures and `stepBy` do fire it.
- **Wheel and drag map the same physical direction to opposite results, on purpose.** The wheel uses
  the **scroll** model: wheel-down moves forward through the values, matching every other scrollable
  surface and matching `stepBy(+1)` (what ArrowDown is bound to). The drag uses the **grab** model:
  the finger holds the cylinder and the content follows it, so dragging down brings *earlier* values
  into view — what a native touch picker does. Porting one mapping to both gestures makes the wheel
  disagree with the component's own keyboard, which is how this was found.
- **Cross-column wheel lock.** When several wheels sit side by side, a module-level lock + min-delta
  gate prevents trackpad inertia from one column bleeding into its neighbour.

## CSS / token dependency

Reads `--_wheel-row-height` from computed style (falls back to 38px) to size geometry — so
[`Wheel.css`](../css/Wheel.md) (or an equivalent declaring that token) **must** be present. Without
it the options stack as unstyled overlapping text and fail colour-contrast (the original port bug).

## Conformance

Unit: [`tests/WheelColumn.unit.test.ts`](tests/WheelColumn.unit.test.ts) — construction/ARIA, loop
wrap, bounded clamp, `onChange` gating (including an animated-`setValue` regression), format,
`setValue`, `destroy`. No dedicated e2e/axe yet — that layer is exercised indirectly by the
DateField/DateTimeField/TimeField e2e suites (wheel open, spinbutton roles, value sync, Jan↔Dec
loop, aria-valuemin/max); a standalone WheelColumn e2e/axe suite is a **deferred TODO**.

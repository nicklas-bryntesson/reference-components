# ToggleTip

An accessible tooltip triggered by a button. The bubble positions itself above the trigger by default, flips below when there is insufficient space, and never overflows the viewport edges.

## Contract

**Authored markup** — the `<toggle-tip>` custom element is the only thing you write:

```html
<toggle-tip icon="info">
  Content shown inside the bubble.
</toggle-tip>
```

All attributes are optional — `icon` defaults to `"info"` (see `## Attributes`).

**Rendered DOM** — on initialisation the JS replaces the element's contents with the trigger button and the bubble. Port this structure if you rebuild without the reference JS:

```html
<toggle-tip icon="info" initialized data-direction="top">
  <button aria-label="More information" aria-expanded="false" aria-controls="tt-ID">
    <!-- icon SVG -->
  </button>
  <div class="slideContainer">
    <div class="ToggleTip-popup" id="tt-ID" role="tooltip" aria-hidden="true">
      <span class="title" role="heading" aria-level="3">Optional heading</span> <!-- only when title is set -->
      Content shown inside the bubble.
      <div class="arrow"></div>
    </div>
  </div>
</toggle-tip>
```

## Dependencies

One kernel primitive: [`popup-position`](../../../kernel/js/popup-position.md) — `detectDirection` plus the bubble/arrow offset maths. No framework dependencies. See `## Kernel dependencies` below.

## HTML Authoring API

```html
<toggle-tip
  icon="info"
  title="Optional heading"
  heading-level="3"
>
  Content shown inside the bubble.
</toggle-tip>
```

| Attribute | Values | Default | Notes |
|---|---|---|---|
| `icon` | `"info"`, `"question"` | `"info"` | Button icon shape |
| `title` | string | — | Heading inside bubble. Optional. |
| `heading-level` | `"1"`–`"6"` | `"3"` | `aria-level` for the title heading |

`data-direction` and `initialized` are set by JS — do not author them.

### Known attribute conflict

`title` is a global HTML attribute — browsers show a native tooltip on hover when it is set on any element. This attribute name was chosen for readability but causes a native tooltip to appear on the `<toggle-tip>` element. Rename to `heading` or `label` in framework implementations to avoid this.

## CSS Variable API

Override at `:root` or on the `toggle-tip` element directly.

| Variable | Default | Description |
|---|---|---|
| `--_toggletip-gap` | `0.75rem` | Space between trigger and bubble |
| `--_toggletip-content-width` | `20rem` | Bubble max width |
| `--_toggletip-padding` | `1.5rem` | Bubble inner padding |
| `--_toggletip-border-radius` | `var(--SITE--POPOVER--RADIUS)` | Bubble corner radius |
| `--_toggletip-button-width` | `1.5rem` | Trigger button size |
| `--_toggletip-button-color` | `CanvasText` | Icon colour |
| `--_toggletip-surface-color` | `Canvas` | Bubble background |
| `--_toggletip-text-color` | `CanvasText` | Bubble text colour |
| `--_toggletip-border-color` | `var(--SITE--POPOVER--BORDER--COLOR)` | Bubble border and title divider colour |
| `--_toggletip-site-max-width` | `100rem` | Site max width (caps the slide rail) |
| `--_toggletip-site-padding` | `var(--SITE--PADDING, 1rem)` | Outer site padding — bubble stays at least half this value from each viewport edge |

## Accessibility

### ARIA pattern

- `<button>` with `aria-expanded` and `aria-controls` — standard disclosure pattern.
- Bubble has `role="tooltip"` and `aria-hidden` toggled on open/close. `display: none` when hidden so it is fully removed from the accessibility tree.
- Button `aria-label`: `"More information"` (info icon) or `"Learn more"` (question icon). Override in your implementation to match the surrounding context.

### Why `role="tooltip"` and not `role="dialog"`

The content is supplementary and non-interactive. `role="dialog"` would require focus management (moving focus into the bubble on open, trapping it, returning on close). `role="tooltip"` is correct for passive informational content triggered by a button.

### Why `aria-hidden` toggling and not DOM removal

DOM removal causes layout recalculation on every open, and loses the bubble's scroll position if the content is long. `aria-hidden="true"` + `display: none` achieves the same screen-reader result with less churn.

### Keyboard behaviour

- Button is focusable and activatable with Enter and Space (native `<button>` behaviour).
- `focusout` on the component closes the bubble — covers both Tab-away and programmatic focus moves.
- No arrow-key navigation inside the bubble (content is passive).

### Pointer light dismiss

A `mousedown` outside the component closes the bubble. Closing this way deliberately does **not** refocus the trigger — refocusing on outside click steals the user's click target and can cause scroll jumps (project-wide light-dismiss convention).

## Positioning

The slide-rail model is left-to-right only. RTL is not supported — the rail is intentionally physical (uses `left`, not `inset-inline-start`). If RTL is needed, the JS offset calculations and CSS rail positioning both need mirroring.

CSS Anchor Positioning is not used — browser support was below the customer threshold at time of writing (~73%). The JS-based approach is the intended long-term implementation, not a fallback.

## Framework integration / dynamic injection

Bubble/arrow offset maths and CSS variable resolution run lazily when the bubble opens, not at page load or component init — `_buildDOM()` only constructs markup. Direction (`data-direction`) is the exception: it is computed at init and re-computed on window resize, even while the bubble is closed. This means the component works correctly when injected into the DOM after page load — e.g. via HTMX, a SPA router, or any other dynamic mechanism — as long as it is initialised after injection.

`DOMContentLoaded` has already fired by the time a dynamic partial lands, so the built-in bootstrap won't pick up new elements automatically. The reference file exports nothing — the `ToggleTip` class is module-private and only the bootstrap runs. When porting or supporting dynamic injection, add an export such as `initToggleTips` and call it after the swap:

```js
// ToggleTip.ts — what to add alongside the default bootstrap
export function initToggleTips(root = document) {
  root.querySelectorAll('toggle-tip').forEach(el => new ToggleTip(el))
}

document.addEventListener('DOMContentLoaded', () => initToggleTips())
```

```js
// your HTMX / framework glue
document.addEventListener('htmx:afterSwap', e => initToggleTips(e.detail.target))
```

The `root` parameter scopes the query to the swapped fragment so already-running instances are not re-initialised.

Each instance exposes `destroy()`, which removes all listeners (window resize, document mousedown, component focusout, button click) — call it before removing the element from the DOM.

## Kernel dependencies

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/popup-position`](../../../kernel/js/popup-position.md) | JS | `detectDirection` + bubble/arrow offset maths |

No CSS kernel dependency. The site tokens this component reads (`--SITE--PADDING`, `--SITE--POPOVER--BORDER--COLOR`, `--SITE--POPOVER--RADIUS`, `--SITE--POPOVER--SHADOW`) are surfaced through the `--_toggletip-*` CSS Variable API above. Most have fallbacks, so the component largely runs standalone — with two exceptions: `box-shadow: var(--SITE--POPOVER--SHADOW)` has no fallback (no shadow without the token), and `--_toggletip-border-color`'s fallback chain bottoms out in `--SITE--POPOVER--BORDER--COLOR` (the border degrades to `currentColor` without it).

## Non-goals

- Animation beyond the `@starting-style` fade-in
- RTL support
- CSS Anchor Positioning
- Framework integration (port the JS class and adapt to your component model)

## Known limitations

**Popover clipping in overflow ancestors.** The popup is positioned in normal flow, so a scroll
container — or a scrolling table cell — around this component clips it. The escape (top layer via
the Popover API, or a portal) and its feature-detection are the consuming project's layer: see
[`popup-position`](../../../kernel/js/popup-position.md#known-limitations). (This is
*ancestor* clipping; the component does not clip its own popup.)

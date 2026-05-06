# ToggleTip

An accessible tooltip triggered by a button. The bubble positions itself above the trigger by default, flips below when there is insufficient space, and never overflows the viewport edges.

## Dependencies

None. Fully self-contained — no shared utilities, no framework dependencies. Drop the three files (`ToggleTip.js`, `ToggleTip.css`, `ToggleTip.html`) into any project.

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

`direction` and `initialized` are set by JS — do not author them.

### Known attribute conflict

`title` is a global HTML attribute — browsers show a native tooltip on hover when it is set on any element. This attribute name was chosen for readability but causes a native tooltip to appear on the `<toggle-tip>` element. Rename to `heading` or `label` in framework implementations to avoid this.

## CSS Variable API

Override at `:root` or on the `toggle-tip` element directly.

| Variable | Default | Description |
|---|---|---|
| `--toggletip-gap` | `0.75rem` | Space between trigger and bubble |
| `--toggletip-content-width` | `20rem` | Bubble max width |
| `--toggletip-button-width` | `1.5rem` | Trigger button size |
| `--toggletip-button-color` | `black` | Icon colour |
| `--toggletip-surface-color` | `white` | Bubble background |
| `--toggletip-text-color` | `black` | Bubble text colour |
| `--toggletip-border-color` | `lightgrey` | Title divider colour |
| `--toggletip-site-max-width` | `100rem` | Site max width (caps the slide rail) |
| `--toggletip-site-padding` | `var(--SITE--PADDING, 1rem)` | Outer site padding — bubble stays at least half this value from each viewport edge |

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

## Positioning

The slide-rail model is left-to-right only. RTL is not supported — the rail is intentionally physical (uses `left`, not `inset-inline-start`). If RTL is needed, the JS offset calculations and CSS rail positioning both need mirroring.

CSS Anchor Positioning is not used — browser support was below the customer threshold at time of writing (~73%). The JS-based approach is the intended long-term implementation, not a fallback.

## Framework integration / dynamic injection

All layout calculations run on button press, not at page load or component init. `_buildDOM()` only constructs markup; position, direction, and CSS variable resolution all happen lazily when the bubble opens. This means the component works correctly when injected into the DOM after page load — e.g. via HTMX, a SPA router, or any other dynamic mechanism — as long as it is initialised after injection.

`DOMContentLoaded` has already fired by the time a dynamic partial lands, so the built-in bootstrap won't pick up new elements automatically. Expose `initToggleTips` and call it after the swap:

```js
// ToggleTip.js — expose alongside the default bootstrap
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

## Non-goals

- Animation beyond the `@starting-style` fade-in
- RTL support
- CSS Anchor Positioning
- Framework integration (port the JS class and adapt to your component model)

# ScrollArea

Wraps horizontally-overflowing content — a wide table, a tab strip — in an
**edge-to-edge** scroller with edge fades and a **custom horizontal scrollbar**.
The bar appears only when the content overflows, auto-hides on idle, and is fully
keyboard-operable.

Why a custom bar: a native scrollbar always spans the whole scroll box, cannot be
inset in line with the content, and cannot be styled consistently across engines.
This one is an absolutely-positioned element drawn under the content, inset to the
page gutter, taking no layout space.

## Markup

Authored:

```html
<div class="ScrollArea" data-component="ScrollArea">
  <div class="viewport" data-scroll-viewport
       role="region" aria-label="Members table">
    <div class="content">
      <!-- the overflowing content, e.g. a wide table -->
    </div>
  </div>
  <div class="fades" aria-hidden="true"></div>
</div>
```

- `[data-component="ScrollArea"]` is the attach hook and the positioning context.
- `[data-scroll-viewport]` is the element that scrolls — it is the accessible scroll
  **region**. Author `role="region"` + a meaningful accessible name (`aria-label`); if
  omitted, the component gap-fills `role="region"` and a generic label. JS makes it
  focusable (`tabindex="0"`) only while it overflows.
- `.fades` **must come after** the viewport in the DOM (stacking) and is
  decorative (`aria-hidden`).
- The custom bar (`.scrollbar` > `.thumb`) is **created by JS**,
  `aria-hidden`, and a pointer/visual affordance only — do not author it.

## Progressive enhancement

- **No JS:** the native scrollbar stays visible as the scroll affordance. Content
  still scrolls; nothing is lost.
- **With JS:** the component sets `data-scrollbar="true"` on the root; only then does
  the CSS hide the native bar and the custom bar takes over.

## Custom property API

| Property | Default | Description |
|---|---|---|
| `--_sc-offset` | `var(--content-offset)` | Inline inset the scroller breaks out to and is padded by, so content lines up with the page gutter while scrolling edge-to-edge. |
| `--_sc-fade-color` | `white` | Colour of the edge fades. **Must match the surface behind the ScrollArea** (see masking, below, to remove this coupling). |
| `--_sc-fade-size` | `--_sc-offset` | Width of each edge fade. |

## Accessibility

Meets the criteria in `docs/atomica11y/form/scrolling-container.md`.

- **The viewport is the accessible region.** It is `role="region"` with an accessible
  name, and becomes focusable (`tabindex="0"`) while it overflows. A screen reader
  announces its role and name; sighted keyboard users see a strong `:focus-visible`
  ring.
- **Keyboard** (region focused): the browser scrolls it natively with the arrow keys
  (and PageUp/PageDown, Home/End). No custom key handling — native scrolling is
  correct across engines, and this is what satisfies the "keyboard-accessible
  scrollable region" requirement (Safari included).
- **The custom bar is `aria-hidden` and pointer-only** — drag the thumb or click the
  track to page. It is a visual + mouse affordance, never a second tab stop, so it
  adds no duplicate announcements.
- The region also remains natively scrollable by wheel, trackpad and touch.

### The popover-clipping limitation

A horizontally-scrollable container needs `overflow-x: auto`, and CSS then forces
`overflow-y` to a non-visible value — "scroll in x, visible in y" is impossible. So
**any popover, tooltip, or menu opened inside a ScrollArea is clipped** at its edges.
The kitchensink demonstrates this deliberately with a ToggleTip inside a ScrollArea.

Therefore: wrap **tables and tab strips** (content with no popovers), never
popover-bearing component demos.

The escape hatch, for a consuming project: render the popover in the **top layer**
via the CSS **Popover API** (`popover` attribute) or `<dialog>`. Top-layer elements
are not clipped by any overflow ancestor. Browser support is broad but not yet
universal, so it is a consumer-side progressive enhancement rather than something
this reference builds in.

## Enhancements a consuming project can add

These are progressive enhancements, deliberately left out of the reference so the
baseline works everywhere:

- **Masking instead of colour fades.** `mask-image: linear-gradient(...)` on the
  viewport fades content to *transparent* regardless of the background, removing the
  `--_sc-fade-color`-must-match-the-surface coupling. Left out of the baseline only
  because the colour fade needs no feature detection.
- **Scroll-driven fades** (`scroll-timeline` / `animation-timeline`): show each edge
  fade only when there is actually more content to scroll in that direction.

## Kernel dependencies

None. The scrollbar state machine lives in `ScrollArea.ts`. If a second component
needs the same custom-scrollbar behaviour (e.g. a horizontally-scrolling tab strip),
promote the controller to `src/kernel/` at that point — not before.

## Non-goals

- **Vertical scrolling.** This is a horizontal-overflow primitive; a native vertical
  scrollbar is already inset-able and consistent enough.
- **Virtualization / data-grid behaviour.** ScrollArea only scrolls; it does not
  windowing, sort, or paginate rows.
- **Containing popovers.** See the clipping limitation above.
- **RTL for the custom bar.** The CSS is fully logical, so content, padding and fades
  flip under `direction: rtl`. The custom bar's projection is physical (LTR
  `scrollLeft` → `translateX`), so the thumb is LTR-only for now; native scrolling
  (keyboard, wheel, touch) still works in RTL.

## Manual accessibility testing

- [ ] With a screen reader, tabbing to the region announces its purpose and its role
      as a region.
- [ ] I can reach the region by keyboard (when it overflows), and its focus is
      strongly visible.
- [ ] With the region focused, the arrow keys browse the content in the overflow
      direction.
- [ ] When the content fits (no overflow), the region is not a tab stop.
- [ ] With `prefers-reduced-motion`, the bar's fade transition is removed.
- [ ] With JavaScript disabled, the native scrollbar is present and the content
      still scrolls.

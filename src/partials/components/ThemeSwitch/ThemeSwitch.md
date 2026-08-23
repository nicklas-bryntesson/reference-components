# ThemeSwitch

A three-segment control — **System · Light · Dark** — that resolves the user's colour-scheme
preference against the OS signal and reflects the answer on `<html>`.

Its entire footprint on a consuming project is **one attribute name**. It never applies colours: it
sets `data-appearance`, and the token layer does the rest. What `dark` looks like is the consuming
project's business.

## Contract

```html
<fieldset class="ThemeSwitch" data-component="ThemeSwitch">
  <legend>Colour theme</legend>              <!-- clipped, but the group's only intrinsic name -->
  <div class="options">
    <input type="radio" id="ts-system" name="ts-appearance" value="system" checked>
    <label for="ts-system">
      <span class="visually-hidden">Follow system setting</span>
      <svg class="icon" aria-hidden="true" focusable="false">…</svg>
    </label>
    …light…
    …dark…
    <span class="indicator" aria-hidden="true"></span>
  </div>
</fieldset>
```

Contract rules (enforced by the unit test):

- **`<legend>` is the first child and non-empty.** Three icons need a name, and a `<legend>` is the
  one that needs no id plumbing. It is visually clipped, not absent.
- **Exactly three options**, one shared `name`, exactly one `checked`, values `system|light|dark`.
  The arity is fixed by the contract — see *The indicator*.
- **The label directly follows its input** (`input + label`), and the **`.indicator` is the last
  child of `.options`**. Both are load-bearing: selection styling is `input:checked + label`, and
  the indicator is reached with `input:nth-of-type(N):checked ~ .indicator`. Neither can cross a
  wrapper.
- **Every icon is `aria-hidden="true" focusable="false"`, and every label carries text.** An
  icon-only label with no text alternative is the failure this guards.
- **Only one instance carries `data-component`.** A page-wide control demoed several times over
  would fight itself for the root attribute; the kitchensink's state rows are inert copies.

### Markup deviation from Picklist, and why

ThemeSwitch composes Picklist's chip mechanism — an sr-clipped radio whose adjacent label is the
visible surface — but **without the per-item wrapper**. Picklist wraps each pair in `.option` to
give the absolutely-positioned input a containing block. A wrapper breaks the sibling chain, and the
indicator depends on it: `input ~ .indicator` can only reach a *following sibling* of the input.
`.options` provides the containing block instead. Nothing is lost — the input is 1px and clipped, so
where it sits is irrelevant as long as it stays focusable and out of layout.

## HTML Authoring API (`data-*`)

| Attribute | Values | Effect |
|---|---|---|
| `data-component` | `"ThemeSwitch"` | Attach hook. Omit it for an inert copy that never projects |
| `data-test-state` | `hover` · `focus` · `active` | **Kitchensink only** — simulated pseudo-class, projected down to the segments |
| `data-initialized` | — | Set by the component |

## The projection contract

```html
<html>                          <!-- system — NO attribute -->
<html data-appearance="light">
<html data-appearance="dark">
```

```css
:root { color-scheme: light dark; }                      /* follow the OS */
:root[data-appearance="light"] { color-scheme: light; }
:root[data-appearance="dark"]  { color-scheme: dark; }
```

- **`system` projects nothing.** The absent attribute *is* the system state, and
  `color-scheme: light dark` already delegates. Nothing has to be computed before first paint, so
  there is no flash and no inline correction script.
- **The attribute's only job is pinning `color-scheme`.** It never applies tokens. Writing
  `documentElement.style.cssText`, as some implementations do, silently destroys every other inline
  style on the root — scroll locks, viewport fixes, view-transition names.
- **A consumer maps it in one line** — a Tailwind `darkMode` selector, one CSS rule, whatever their
  system uses.

### Restoring an explicit choice before first paint — required of the host

A module runs after the document is parsed, so by the time the component attaches the page may
already have painted in the wrong appearance. There is **no client-side way around that**: restoring
a stored override needs a render-blocking inline script in `<head>`.

```html
<script>
  try {
    var a = localStorage.getItem('appearance-preference')
    if (a === 'light' || a === 'dark') document.documentElement.setAttribute('data-appearance', a)
  } catch (e) { /* storage blocked — fall back to following the OS */ }
</script>
```

Note what the snippet does **not** handle: `system`. That is the payoff for projecting nothing for
it — `color-scheme: light dark` already follows the OS, so the most common case needs no script at
all and **cannot** flash. Only an explicit override has to be restored this early.

A server-rendered host skips the script entirely: read the cookie and write
`<html data-appearance="dark">` into the markup. Same end-state, no flash, no client JS.

### The end-state is the contract, not the mechanism

What is contractual is that the root carries the resolved appearance. **How it gets there is the
host's choice.** This reference computes it client-side from `localStorage`; an Astro or Razor
consumer reads a cookie and renders `<html data-appearance="dark">` server-side with zero client JS.
Both satisfy the same contract and pass the same e2e assertions. The persistence medium is
deliberately not specified.

## Kernel dependencies

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/theme-preference`](../../../kernel/js/theme-preference.md) | JS | reading and persisting the stored preference, and resolving `system` against the OS |

## The state machine

The decisions live in the kernel — [`theme-preference`](../../../kernel/js/theme-preference.md) —
so they are unit-testable without a DOM and reusable by a port that renders server-side:

```ts
resolvePreference(stored)             // anything unrecognised → 'system'
resolveAppearance(pref, prefersDark)  // 'system' delegates; an explicit choice does not
shouldProject(pref)                   // false for 'system'
```

**The rule that matters:** an explicit choice outranks the platform signal. Changing the OS theme
must never silently revoke a decision the user made — the component re-projects on a
`prefers-color-scheme` change *only* while the preference is `system`.

The component owns only the plumbing: read storage, read the live signal, hand both to the kernel,
reflect the answer, and dispatch `theme-change`.

## Events

| Event | Detail | When |
|---|---|---|
| `theme-change` | `{ preference, appearance }` | On attach and on every change. Bubbles |

The hook for anything the CSS cannot reach on its own — a chart's palette, a map style,
`<meta name="theme-color">`. The kitchensink's readout table is the worked example.

## The indicator

A single sliding element behind the segments, moved with one CSS rule per segment index:

```css
.ThemeSwitch .options input:nth-of-type(2):checked ~ .indicator { translate: 100%; }
.ThemeSwitch .options input:nth-of-type(3):checked ~ .indicator { translate: 200%; }
```

This is the technique **Picklist explicitly refuses**, and it is legitimate here: one rule per index
caps how many segments a group may have — fatal for a general chip list, irrelevant for a control
whose arity is fixed at three. The equal 40 px segments are what make `translate: 100%` exact rather
than approximate.

`translate`, not `transform`: the property that animates must be the property that is set. Mixing
the two leaves the initial position outside the transition and the other declaration dead.

**Motion is governed by the plain media query**, not by the motion-policy kernel. That kernel
governs decorative motion *regions* — autostart gating, cost blockers, visibility pausing — none of
which mean anything for a 40 px indicator. Every other micro-transition in the library uses the same
media query:

```css
@media (prefers-reduced-motion: reduce) { .ThemeSwitch .options .indicator { transition: none } }
```

## CSS Variable API

| Variable | Default | Description |
|---|---|---|
| `--_ts-size` | `2.5rem` | Segment box — the family field-height contract |
| `--_ts-padding` | `0.25rem` | Track inset around the segments |
| `--_ts-radius` | `999px` | Pill; set `0.25rem` for a rounded rectangle |
| `--_ts-border-color` | `var(--ui-border)` | Track border |
| `--_ts-bg` | `transparent` | Track fill |
| `--_ts-fg` | `CanvasText` | Unselected icon |
| `--_ts-bg-hover` | `var(--ui-hover)` | Hover fill (unselected) |
| `--_ts-selected-bg` | `CanvasText` | The indicator — **override for accent** |
| `--_ts-selected-fg` | `Canvas` | Icon on the indicator |
| `--_ts-icon-size` | `1.125rem` | 18px, the family icon size |
| `--_ts-transition` | `200ms cubic-bezier(0.65, 0, 0.35, 1)` | Indicator slide + colour |

## Accessibility

### Semantics come from native

`role="radio"`, group membership, state announcement, arrow-key roving and single-selection are all
native. The segmented skin adds no ARIA and no tabindex.

### Names for an icon-only control

Each label carries clipped text (`Follow system setting` / `Light` / `Dark`) and the icon is
`aria-hidden`. The group is named by its clipped `<legend>`. Nothing here is announced from an icon.

### Focus is inset — the same reason as Picklist

A selected segment sits on the indicator's fill and flips its `color`, so an outward `currentColor`
ring would be drawn on the page *behind* the control, where it can vanish. Drawn inside, the ring
always lands on the surface directly beneath it and contrasts by construction. The e2e suite asserts
the **contrast ratio**, never that an outline merely exists.

### Forced colors

The indicator is an author-painted element, so the platform draws no selection — the shipped
`@media (forced-colors: active)` block redraws it from `Highlight`/`HighlightText`, with
`forced-color-adjust: none` so the fill survives. **Do not delete it when porting.**

### Manual accessibility testing (definition of done)

- [ ] **Desktop SR:** entering the control, I hear the group name ("Colour theme") even though the
      legend is clipped.
- [ ] Each segment announces its label, role (radio button) and state — never "graphic" or a bare
      "button".
- [ ] Arrow keys move **and** select; each change is announced.
- [ ] The indicator is silent — it is decorative and must never be reached or announced.
- [ ] **Mobile SR:** swiping reaches all three segments with label + role + state; double-tap selects.
- [ ] **Reduced motion:** with the OS setting on, the indicator jumps rather than slides.
- [ ] **200% text zoom:** the track and icons scale without clipping.
- [ ] **Windows High Contrast:** the selected segment stays distinct and the focus ring is visible.
- [ ] Switching appearance does not move focus or scroll position.

## Testing strategy

- **Kernel unit** — every decision, exhaustively, with no DOM. See the kernel contract.
- **Component unit (jsdom):** the markup contract parsed from this component's kitchensink, plus the
  plumbing — the right radio checked on attach, the attribute set *and removed*, an unknown stored
  value falling back to `system`, `theme-change` detail, idempotent re-attach, and `destroy()`.
- **E2E (Playwright + axe):** what only a browser can prove — that the resolved appearance reaches
  `Canvas` itself, that `system` writes nothing, that a choice survives a reload, that **an explicit
  choice is not revoked when the OS signal flips**, that the indicator lands on the selected segment
  (the sibling chain), focus-ring contrast, the inert copies never projecting, and axe clean in both
  appearances.

> **Testing gotcha, hit twice:** reading a computed colour immediately after a selection samples a
> value *mid-transition* — a segment measured `rgb(12,12,12)` on its way from black to white, which
> reads as "wrong colour" rather than "too early". Both suites freeze transitions rather than sleep.

## Non-goals

- **No token application.** One attribute; the token layer does the rest.
- **No opinion on persistence** — cookie, `localStorage` or server session are all conformant.
- **No contrast axis.** `prefers-contrast` has no user override, so it is a media query in the token
  layer, not a state in this control.
- **Not a general theming system.** One axis: colour scheme. Brand and density themes belong to the
  consuming project.
- **No `<meta name="theme-color">` management** — host concern; `theme-change` is the hook.
- **No page-wide cross-fade** on switching. Animating a whole document is a host decision and a
  reduced-motion liability.
- **More or fewer than three segments** — the indicator's rules are per index, and the contract fixes
  the arity at three.

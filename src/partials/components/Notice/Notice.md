# Notice

A presentational message — a severity, an inline-SVG icon, and text. Notice is the
**payload**: it renders a validation error, a form note, a success confirmation. It carries
**no live role** and does nothing on its own. To have it announced by a screen reader, a
context renders it into a persistent **live region** (see *Announcing* below).

No JavaScript. The default is a **calm coloured base** — a surface tint + the accent icon.
Three independent boolean toggles then compose from basic to enriched: `data-icon`,
`data-border` (a full border in the accent colour), and `data-emphasis` (the "styled" hook —
a thick leading accent bar, the richest look). Severity is always carried by the icon
(shape + colour), never by chrome alone.

## Contract

```html
<div class="Notice" data-variant="error">
  <div class="icon" aria-hidden="true">
    <svg viewBox="0 0 24 24"><!-- variant icon, stroke=currentColor --></svg>
  </div>
  <div class="content">
    <strong class="title">Optional title</strong>   <!-- omit for a title-less message -->
    <p>Message body. May contain inline markup like a <a href="#">link</a>.</p>
  </div>
</div>
```

- The **icon is decorative** (`aria-hidden="true"`) — the text carries the meaning.
- `.content` holds an optional `.title` (`<strong>`) and the body.
- Notice has **no margin** — spacing is the layout context's job.

## HTML Authoring API (`data-*`)

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `data-variant` | `error` · `warning` · `success` · `info` · `neutral` | `neutral` | Severity — sets the accent (tint + icon + chrome) and, by convention, which icon you author |
| `data-icon` | `"false"` | icon shown | `"false"` drops the icon and collapses the grid to one column |
| `data-border` | `"true"` | off | A full border in the accent (icon) colour |
| `data-emphasis` | `"true"` | off | The "styled" hook — a thick leading accent bar (the richest look). Compose with `data-border` for the most decorated Notice |

## CSS Variable API

Override on `.Notice` (or a rule targeting it). Set **one** token per variant — `--_nt-accent` —
and the tint derives from it; adjust the rest globally.

| Variable | Default | Description |
|---|---|---|
| `--_nt-accent` | per variant (`error #c0362c`, `warning #a85a00`, `success #1a7f37`, `info #0b6bcb`, `neutral CanvasText`) | Drives the tint, the icon, and the `data-border` / `data-emphasis` chrome; each variant reads `var(--ui-<state>, <fallback>)` (destructive/warning/success/info) |
| `--_nt-bg` | `color-mix(in srgb, var(--_nt-accent) 8%, Canvas)` | Base surface tint (always on) — derived from the accent so it adapts to light/dark |
| `--_nt-text-color` | `CanvasText` | Body text |
| `--_nt-title-color` | `currentColor` | Title colour (bold regardless) |
| `--_nt-border-width` | `1px` | `data-border` border width |
| `--_nt-bar-width` | `0.25rem` | `data-emphasis` leading bar width |
| `--_nt-radius` | `0.375rem` | Corner radius |
| `--_nt-padding` | `1rem` | Inner padding |
| `--_nt-gap` | `1rem` | Icon → content |
| `--_nt-content-gap` | `0.25rem` | Title → body |
| `--_nt-icon-size` | `1.5rem` | Icon box |
| `--_nt-max-inline-size` | `50rem` | Max width of the **component** — the text measure lands at ~75 characters, under the 80-character ceiling (measured, see below) |

### Icons: inline SVG + currentColor

Icons are authored inline as stroke SVGs; the CSS points `.icon { color: var(--_nt-accent) }`
and the SVG uses `stroke: currentColor`, so the mark re-tints with the variant and needs no
sprite sheet. Deliberately **not** a CSS `mask`/`background` icon — this keeps the icon
colour bound to the accent via `currentColor` and the component fully self-contained.

## Announcing — the live region is separate and persistent

`role="alert"` / `role="status"` announce a **content change inside a region that already
exists**. A freshly-injected, pre-filled alert (or one present at page load) is **not
reliably announced**. So the announcer is a separate, persistent container — present and
empty from load — and you swap Notice content into it:

```html
<!-- present and empty at load; the announcer -->
<div class="notice-region" role="alert" aria-live="assertive"></div>
```

```js
// clear → next frame → set: the mutation is what triggers the announcement
function announce(region, noticeEl) {
  region.replaceChildren()
  requestAnimationFrame(() => region.append(noticeEl))
}
```

**Politeness follows severity:** `error` / `warning` → `role="alert"` (`aria-live="assertive"`);
`success` / `info` / `neutral` → `role="status"` (`aria-live="polite"`). Pick the region's role
to match the notice you put in it.

A statically server-rendered Notice that is present on first paint does not need this dance —
but a reference must show the robust (injectable) pattern, so the kitchensink demonstrates the
region.

### The width cap is the component, not the text

`--_nt-max-inline-size` caps the whole Notice, and the icon, the gap and the padding sit inside it.
Measured at the cap: the text line reaches roughly **75 characters**, under the 80-character ceiling
that WCAG 1.4.8 (AAA) sets for line length. Raising the cap raises the measure with it — past about
`54rem` the text crosses 80 characters, so treat that as the limit rather than a round number.

If you restyle the icon away or drop the padding, re-measure: the same cap then gives the text more
room and the measure grows.

## Accessibility

- **Icon decorative** (`aria-hidden`), meaning carried by text + the per-variant icon, never
  colour alone.
- **Focus/interaction:** none — Notice is non-interactive content. (A dismissible or
  auto-timing message is a Toast, a separate component.)
- **Forced colors:** the semantic tint/accent collapse to system colours; the icon (drawn with
  `currentColor` → `CanvasText`) and text keep the message legible.

### Manual accessibility testing (definition of done)

- [ ] **Desktop SR:** when a Notice is swapped into a `role="alert"` region, I HEAR the message announced; a `role="status"` region announces politely (not interrupting).
- [ ] A Notice present on page load in a live region is **not** announced spuriously (region should start empty for injected messages).
- [ ] The icon is not announced (decorative); the title + body read as the message.
- [ ] **200% zoom:** icon and text scale; body wraps without clipping.

## Testing strategy

- **Unit (jsdom):** contract invariants — Notice never carries a live role, `.notice-region`
  always does; every Notice has a known `data-variant` and a `.content`; icons are
  `aria-hidden` and omitted when `data-icon="false"`.
- **E2E (Playwright + axe):** Notice has no `role` while the region has `role="alert"` +
  `aria-live`; variants paint distinct accent borders; `data-icon="false"` renders no icon and
  collapses to one column; icons are `aria-hidden`; axe clean.

## Non-goals

- **Not the announcer** — Notice is the payload; the persistent live region is the context's.
- **No dismissal, auto-timeout, stacking, or positioning** — that is a Toast (its own
  component; it will reuse Notice as content and a shared live region as announcer).
- **Not interactive** — no close button, no actions baked in (a message with an action is a
  composition the host assembles).
- **Colour is not the only signal** — never ship a variant without its icon.

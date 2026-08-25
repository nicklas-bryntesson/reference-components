# RangeField

A styled **native** `<input type="range">`. Nothing else — no wrapper, no sibling elements,
no JavaScript. It draws a track and a thumb, which is exactly what a native range has, so a
bare `<input class="RangeField">` is a complete, working, accessible slider on its own.

**There is no fill.** A coloured portion running up to the thumb is not part of a native range:
it is a second thing drawn on the same lane, and its length depends on `value`, which CSS cannot
read. So it belongs to **RangeScale** — the tier with the coordinate system and the one line of
JavaScript. Nothing in this component can fall out of sync, because there is nothing to sync.

The whole component is bounded by a physical fact: **a range input has exactly two
addressable insides**, the track pseudo-element and the thumb pseudo-element. There is no
third. Anything else drawn on the same lane — tick marks, a value bubble, a reference band,
a second thumb — belongs to **RangeScale**, which composes this component.

`role="slider"`, `aria-valuemin/max/now`, arrow-key stepping, Home/End, form participation
and label association are all native. We add **no ARIA at all**.

## Contract

```html
<label for="volume">Volume</label>
<input class="RangeField" type="range" id="volume" name="volume"
       min="0" max="100" step="1" value="50">
```

Contract rules (enforced by the unit test):

- **`for` must equal `id`; `id`s are unique.** The name comes from `<label>`. Do **not** put
  the range into `aria-label` — it duplicates `aria-valuemin`/`valuemax` and produces a
  mouthful on every focus. If both `label[for]` and `aria-labelledby` point at the field,
  remove the latter.
- **Never author `aria-valuemin`, `aria-valuemax` or `aria-valuenow`.** They are derived
  from `min`, `max` and `value`. Writing them by hand is at best redundant.
- **Never author `aria-valuetext` either — for a worse reason.** The other three are
  redundant; this one is a trap. RangeField ships no JavaScript, so an authored valuetext
  freezes on the first arrow key: the value moves, the speech does not (measured with
  VoiceOver — value at 51, spoken "50 %"). A value that must *speak* its unit needs an
  owner that updates it on every `input`, and that owner is **RangeScale**, whose script
  already does exactly this. When the number is the meaning, the native announcement is
  correct and fresh by itself.
- **`step` must match any tick values** drawn by a composing RangeScale, or the keyboard
  cannot land on them.

## HTML Authoring API

| Attribute | Values | Notes |
|---|---|---|
| `min` `max` `step` `value` | numbers | Passed straight to native. `step` is the keyboard granularity |
| `name` | string | Form participation |
| `disabled` | present / absent | Functional state — `pointer-events: none`, so no hover/focus |
| `required` | present / absent | Native constraint validation. Note a range **always** carries a value, so `required` cannot express "no answer yet" — if the form needs that state, a range is the wrong control |
| `list` | id ref | A `<datalist>` of tick values. **Renders nothing here** — `appearance: none` removes the browser's marks. Keep it as correct markup; draw marks with RangeScale |
| `data-orientation` | `horizontal` (default) · `vertical` | Writing-mode, geometry and arrow mapping. See below |
| `data-min` | `top` | Vertical only: puts min at the **top**. Default is min at the bottom |
| `data-invalid` | `"true"` | Visual invalid skin (pair with `aria-invalid="true"`) |
| `data-test-state` | `hover` · `focus` · `active` | **Kitchensink only** — simulated pseudo-class |

### Vertical is `writing-mode`, never rotation

`data-orientation="vertical"` applies `writing-mode: vertical-rl`. A `transform: rotate(-90deg)`
would look similar and be wrong three ways: the element still occupies its horizontal box in
layout, the hit area rotates with it, and — decisively — **it does not remap the arrow keys**.
Native vertical does: Up increases.

The default recipe is **min at the bottom** (`vertical-rl` + `direction: rtl`), the convention
for volume and mixer controls. `data-min="top"` is the other position.

> **Two things flip inside a vertical input, and both are invisible in a screenshot.**
> Logical sizing follows the element's *own* writing-mode, so `inline-size` means **height**
> there — write it logically and you ship a 24px-tall slider inside a lane that looks correct,
> with only 24px of travel. Use physical `width`/`height`. And `direction` reverses the value
> axis, which is what `data-min` is built on. Measured in Chrome; re-measure when porting.
>
> A flat track needs no other per-orientation geometry. Anything with a *length* does — which
> is RangeScale's problem, and a third instance of the same trap: `background-size` components
> and gradient directions are physical too, and do not flip with writing-mode at all.

## CSS Variable API

Override on the `.RangeField` element itself — an ancestor or `:root` override is shadowed by
the component's own defaults on the root. Neutral, monochrome defaults on system colours: the
component **takes** design.

| Variable | Default | Description |
|---|---|---|
| `--_rf-thumb` | `1.5em` | Thumb size — **the shared geometry constant**, see below |
| `--_rf-track` | `0.5em` | Track thickness |
| `--_rf-radius` | `1e5px` | Track corner — "as round as it gets", not a magic number |
| `--_rf-ring-width` | `0.125em` | Thumb border, and the focus ring |
| `--_rf-target-floor` | `24px` | The WCAG 2.5.8 minimum — the one length that is *not* relative |
| `--_rf-track-color` | `color-mix(in oklab, currentColor 20%, transparent)` | Track |
| `--_rf-thumb-color` | `currentColor` | Handle |
| `--_rf-thumb-ring` | `Canvas` | Handle border, so it reads against the track |
| `--_rf-thumb-outline` | `none` | The focus ring, set on the **element** — see below |
| `--_rf-invalid-color` | `var(--ui-destructive, #c0362c)` | Invalid track |

Part names follow **CSS Forms L1** and the Open UI explainer: the lane is `track`, the handle is
`thumb`, and the filled portion — drawn by RangeScale — is `fill`. MUI inverts the first and
last (its `rail` is the lane, its `track` is the fill); that is the minority reading and is not
used here.

### Lengths are relative, so the control follows the reader

Every length is `em` or derived from one with `calc()`. A reader who raises their text size gets a
bigger thumb and a thicker track, not a bigger label around the same small dot. `em` (rather than
`rem`) follows the *local* font size, so a component sitting in larger type scales with it —
matching ChoiceField.

**`font: inherit` is load-bearing, not tidiness.** A form control does not inherit the document's
font: the UA gives it its own (~13px in Chrome). Without that line `em` resolves against the UA
size, the control stops tracking the reader's text entirely, and the target floor silently
swallows the thumb. Verified: raising the root font size changed nothing until `font: inherit`
was added.

**Two deliberate exceptions, both px:** the WCAG 2.5.8 target floor, because the success criterion
is written in CSS px and a relative floor would dip under it as soon as the root font shrinks; and
the forced-colors hairline borders, which must not round away to nothing.

### `--_rf-thumb` is a shared constant, and the reason is geometric

The thumb's **centre** travels from `--_rf-thumb / 2` to `100% − --_rf-thumb / 2`. It never
reaches the track's edges. So anything drawn in this lane — a fill, tick marks, labels, a
reference band, all of them RangeScale's — has to position as

```
calc(var(--_rf-thumb) / 2 + p * (100% - var(--_rf-thumb)))
```

and never `p * 100%`. The naive version is off by up to **half a thumb**, and the error **changes
sign** along the track: right at both ends, wrong in the middle. Because the inset is expressed in
the same unit as the thumb, the two can never drift apart. RangeField's only obligation is to
publish the constant that maths depends on; RangeScale writes the maths once.

Set the same `--_rf-thumb` on both `::-webkit-slider-thumb` and `::-moz-range-thumb`, with
`box-sizing: border-box`, or the inset only matches in one engine.

### `-webkit-` and `-moz-` can never share a rule

An unrecognised selector discards the **whole** declaration block, so
`::-webkit-slider-thumb, ::-moz-range-thumb { … }` styles nothing anywhere. Two rules, always.
Verified: Chrome drops **every** `-moz-` rule from the parsed stylesheet, and Firefox does the
mirror image — which is exactly why a shared selector list would leave both engines unstyled.

### Every state is a variable on the element, not a declaration on the pseudo-element

Only declarations that *cannot* be a custom property need duplicating per engine. Custom
properties inherit into the pseudo-elements, so each state — focus, invalid, hover, active — is
**one** rule on `.RangeField` that the two base pseudo-element rules read. That is why the
component has four state rules instead of eight, and why the focus ring is
`--_rf-thumb-outline` rather than an `outline` declared twice on the thumb.

It also makes state **assertable**: `getComputedStyle(el).getPropertyValue('--_rf-thumb-outline')`
returns `0.125em solid currentColor` when focused and `none` otherwise. Prefer that in e2e over
trying to inspect a vendor pseudo-element.

### No JavaScript — not "none yet"

There is nothing for JavaScript to do. The browser positions the thumb from `value`; the track
is one flat colour; every state is a CSS custom property. RangeScale is the only tier in this
family with any script, and it has it because it draws things whose position depends on a value
CSS cannot read.

## Accessibility

### Semantics come from native

`role="slider"`, `aria-valuemin`/`valuemax`/`valuenow`, arrow stepping, Home/End, Page Up/Down,
label association and form participation are all free. Authoring any of the value properties by
hand is redundant.

### `appearance: none` removes more than the look

It does **not** remove semantics or behaviour — the control is still a range, still tabbable,
still announced, still in the form data. Hiding the input and drawing a `<span>` beside it is
strictly worse: it removes exactly what `appearance: none` keeps. What it *does* remove is
undocumented and longer than expected:

- **The focus ring.** The replacement must sit on the **thumb**, not the input; on the input it
  draws a rectangle around the whole lane, which is not what is focused.
- **`<datalist>` tick marks.** All three engines draw them today, and all three stop the moment
  you write `appearance: none`. Not inconsistent rendering — you told the browser to stop
  drawing the control.
- **Forced-colors painting.** See below.
- **The invisible margin around the native thumb**, i.e. part of the hit area.

### Target size — WCAG 2.5.8

The thumb is `1.5em` — 24px at a 16px text size — so it clears the minimum on its own, and grows
from there with the reader's text. The **input's block size is
`max(var(--_rf-thumb), var(--_rf-target-floor))`**: the hit area is the field, not the handle, and
the floor only catches unusually small type. Do not shrink it when restyling.

The family's field-height contract governs fields standing in a form row; a slider's visible track
is thinner than a text field, but its target is not.

### Forced colors (Windows High Contrast) — required

Forced-colors paints native controls for you, but we told the browser to stop drawing, so the
job comes back to us: the shipped `@media (forced-colors: active)` block redraws track and thumb
from system keywords (`ButtonFace` / `ButtonText`) with `forced-color-adjust: none`. Without it
the custom track is overpainted or invisible. This is the item that is always forgotten. Do not
delete it when porting.

### Focus

`:focus-visible` puts `outline: var(--_rf-ring-width) solid currentColor` with a matching offset on
the thumb — the same treatment as the rest of the field family — and it survives forced-colors,
which a `box-shadow` ring would not.

### Manual accessibility testing (definition of done — atomica11y range-slider §2–3)

- [ ] **Desktop SR (NVDA/JAWS/VoiceOver):** Tab to the field — I HEAR its purpose, that it is a
      slider/range, its label read with it, and its current value.
- [ ] Arrow keys change the value by one step — I HEAR each new value, **fresh every step**
      (a value that repeats while the thumb moves means someone authored `aria-valuetext`;
      see the contract rule — that belongs to RangeScale).
- [ ] Home / End reach min and max and announce them.
- [ ] **Mobile SR:** swipe focuses the field with purpose, role and value; swipe up/down (iOS) or
      volume buttons (Android) change it one step and announce.
- [ ] **Vertical:** Up increases and Down decreases, and the announced value matches the visual
      end the thumb moved toward.
- [ ] **Forced colors / High Contrast:** track and thumb are both visible, and the focused thumb
      is distinguishable from the unfocused one.
- [ ] **200% text zoom:** the field and its label resize without clipping; the thumb stays ≥24px.

## Non-goals

- **The fill.** Its length depends on `value`; see above.
- **Tick marks, tick labels, a value bubble, a reference band, a second thumb.** All RangeScale
  or RangeGroup — there is no room inside the input for any of them, and no script here to
  place them.
- **Its own JavaScript.** There is nothing for it to do.
- **A `<datalist>`-driven visual.** Kept as markup, never rendered here.
- **A page-level scrim while dragging.** Not modality — nothing is trapped or dismissed — and a
  layer whose correctness depends on its position relative to the whole page is a page concern.

## Kernel dependencies

None — self-contained.

## References

- `docs/atomica11y/form/range-slider-input.md`
- [CSS Forms Level 1](https://www.w3.org/TR/css-forms-1/) — `::track` contains `::fill`
- [WAI-ARIA APG: Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

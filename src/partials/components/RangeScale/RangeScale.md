# RangeScale

The **lane** a RangeField is measured against. RangeField draws a track and a thumb and nothing
else, because a native range has exactly two addressable insides. Everything else that belongs on
the same lane — the filled portion, tick marks, a value bubble, a reference band, a second thumb —
lives here, as sibling elements in a grid stack.

This is the only tier in the range family with **JavaScript**, and it has it for one reason: CSS
cannot read an input's `value`, so anything whose length depends on that value has to be told. The
component writes the normalised position onto **itself**, where it inherits down into every layer.
Custom properties only flow downward, so a field can never publish its own position upward.

## Contract

```html
<label for="volume">Volume</label>
<div class="RangeScale" data-component="RangeScale" style="--_rs-p: 0.5">
  <span class="track"></span>
  <span class="fill"></span>
  <input class="RangeField" type="range" id="volume" name="volume" min="0" max="100" value="50">
  <span class="ticks" aria-hidden="true">
    <i style="--p: 0"><span>0</span></i>
    <i style="--p: 0.5"><span>50</span></i>
    <i style="--p: 1"><span>100</span></i>
  </span>
  <output class="value" for="volume" data-suffix="%">50 %</output>
</div>
```

Contract rules (enforced by the unit test):

- **`.track`, `.fill` and the field share one grid area.** That is what keeps the whole lane
  surface as the input's hit target; the layers carry `pointer-events: none`.
- **`--_rs-p` is authored in the `style` attribute** so the first paint is correct without
  JavaScript, and it must agree with `value`, `min` and `max`. It is the **only** place a position
  is authored in this family, and it belongs to the lane, never to the field.
- **`--_rs-p` must merge into any other authored style**, not replace it. (A generator that wrote
  `style` last silently dropped `--_rs-inset` and `font-size` once.)
- **The `<output>`'s presence is the switch.** No attribute: a state that cannot be authored
  cannot be wrong. `for` points at the input, and it is **never** `aria-live` — the slider already
  announces every change, so a live region would say the value twice.
- **`data-invalid` goes on both** the lane (it draws the track) and the field (it draws the thumb);
  `aria-invalid` goes on the control, which is the field.
- **Orientation is authored on both** the lane and the field, and they must agree.

## HTML Authoring API (`data-*`)

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `data-lane` | `inset` · `flush` | `inset` | How far into the lane the thumb's centre may travel — see below |
| `data-ticks` | `marks` · `labels` | — | Absent draws nothing. `marks` renders the stops, `labels` adds their text — **same markup either way** |
| `data-orientation` | `horizontal` · `vertical` | `horizontal` | Lane direction; mirrors the field's |
| `data-min` | `top` | — | Vertical only: which end the fill is anchored in. Mirrors the field's |
| `data-invalid` | `"true"` | — | Invalid skin on the track; pair with the field's |

## CSS Variable API

| Variable | Default | Description |
|---|---|---|
| `--_rs-thumb` | `1.5em` | Thumb size, **authored here** and supplied to the field as `--_rf-thumb` |
| `--_rs-track` | `0.5em` | Track thickness, likewise |
| `--_rs-inset` | `calc(var(--_rs-thumb) / 2)` | **The lane model as a length** — see below |
| `--_rs-p` | `0` | Normalised position, 0–1. Server-rendered, then kept live by JS |
| `--_rs-pos` | *derived* | The one positioning expression every layer uses |
| `--_rs-radius` | `1e5px` | Track corner |
| `--_rs-track-color` | `color-mix(in oklab, currentColor 20%, transparent)` | Unfilled track |
| `--_rs-fill-color` | `currentColor` | Filled portion |
| `--_rs-gap` | `0.25em` | Lane → ticks → value rows |
| `--_rs-tick-size` | `0.375em` | Mark length |
| `--_rs-tick-width` | `1px` | Mark thickness — a hairline, so px: it must not round to zero |
| `--_rs-tick-color` | `color-mix(in oklab, currentColor 45%, transparent)` | Mark |
| `--_rs-tick-label-size` | `0.75em` | Label text, applied to the label **child** — see below |
| `--_rs-tick-label-color` | `currentColor` | Label text |

### One expression, and why that matters

```
--_rs-pos: calc(var(--_rs-inset) + var(--_rs-p) * (100% - 2 * var(--_rs-inset)))
```

The thumb's **centre** cannot reach the ends of its own input: it travels from half a thumb in to
half a thumb from the far side. `--_rs-inset` is how much of that the lane keeps, and it is the
whole difference between the two lane models — so the fill, the ticks, the labels and a reference
band all position with the *same* expression. The coordinate error is up to **half a thumb** and it
**changes sign** along the track, so a second copy of the formula is a second place for that to
come back.

### Lane model — a documented choice, not a default we picked for you

| | `inset` (default) | `flush` |
|---|---|---|
| `--_rs-inset` | `thumb / 2` | `0` |
| Expression reduces to | `thumb/2 + p × (100% − thumb)` | `p × 100%` |
| The thumb | stays fully on the track | reaches the visible ends and **overhangs** at min/max |
| A scale's first/last stop | half a thumb inside the ends | exactly at the ends |
| The component's box | contains all of its own ink | is overflowed by the thumb |

`inset` is the default because a reference component is dropped into unknown layouts and this one
cannot be clipped or overlap a neighbour. `flush` is the better geometry and an active choice with
a stated cost.

**`--_rs-inset` is a length, not a switch.** The two named models are stops on it; set it directly
for a partial overhang. `flush` widens the input by one thumb and pulls it back half a thumb —
which is the same trick as a container with `width: calc(100% + …)` and a negative inline margin,
expressed once and in terms of the thumb.

**Two consequences of `flush` to plan for, not to work around:**

- The hit area extends half a thumb beyond the visible component, so siblings need
  `gap` ≥ `--_rs-thumb` or their targets overlap.
- The thumb and any label row overflow the box. Either give the lane
  `padding-inline: calc(var(--_rs-thumb) / 2)` — then the box contains its ink *and* the stops sit
  at the drawn track's ends — or let it bleed and make sure the parent has room. That is layout,
  i.e. the consuming project's, and it needs no attribute.

### Ticks

**One element per stop**, each carrying its own `--p`, positioned by the expression above. Not a
repeating gradient: a gradient can only express *even* spacing, and it needs its own period
arithmetic against an inset background box. Per-stop elements handle even and uneven scales
identically and reuse the formula that already exists.

`step` **must land on every drawn stop**, or a mark the eye can see is one the keyboard cannot
reach. The unit test checks that for every authored state.

**The stops are `aria-hidden`, and that is not a compromise.** Nothing in ARIA models tick marks,
and the information they carry already reaches the keyboard: `step` makes the arrow keys land on
exactly these values. Both channels agree without any ARIA at all.

**Labels here are numeric, and that is a scope boundary rather than a law.** Because the label *is*
the value, nothing needs mirroring into `aria-valuetext` — which is what makes this axis cost only
DOM.

A scale of **words** — off / low / mid — is a different thing: a number that *stands for* a meaning,
so two things have to be kept in step from one source of truth. That is a responsibility this
contract does not carry, and it is not a styling difference. It is also not simply a radio group:
dragging, clicking anywhere on the lane and sweeping on touch are a continuous pointer gesture over
a shared surface, and N discrete targets cannot offer them. A word scale is therefore a **separate,
proposed component**, and putting words in these labels without that component is a channel split
waiting to happen — the eye reads "Mid" and the screenreader says "2".

> **The stop element carries geometry, so it keeps the lane's font-size.** The em lengths here are
> custom properties, and those resolve against the font-size of the element that *uses* them — so
> putting the label's smaller size on the stop shrank the mark and its offset by the same fraction.
> Measured, when it did: a 6px mark rendered 4.5px and a −12px offset rendered −9px, and every stop
> drifted with it. The label's typography lives on the child `<span>` for that reason, not for
> tidiness.

### Direction and orientation

The fill is anchored in the **min end**. One rule, three cases, two of them free:

- **Horizontal LTR/RTL** — `justify-self: start` and `inline-size` are logical, so the fill
  anchors to the right edge under `dir="rtl"` with no extra rule. Verified in the browser.
- **Vertical** — logical properties on the *lane* do not flip (the lane is horizontal
  writing-mode; only the composed input's own properties flip). The anchor therefore has to be
  told, and `data-min` is what tells it. Default is min at the bottom.

The lane owns its **length**: the vertical field is stretched to `height: 100%` rather than
carrying its own, so there is no second authored length to drift.

## JavaScript API

`RangeScale.attach(parent?)` mounts every `[data-component="RangeScale"]`.

| Member | Description |
|---|---|
| `sync()` | Recompute from the field's current value. **Public on purpose** — `input` does not fire when `value` is set programmatically, so a host that writes `field.value = 80` must call this. The alternative was patching the value descriptor, which is invisible magic and does not survive porting |
| `value` | The field's current numeric value |
| `position` | The normalised position currently written to the lane |
| `destroy()` | Unbinds |

The component sets `--_rs-p`, writes the `<output>` text, and mirrors that text into the field's
`aria-valuetext` so the seen and the announced value cannot drift. It mirrors **only** when it has
an output — an authored `aria-valuetext` on a field with no readout belongs to the host, and
overwriting it would be a regression rather than a sync.

`data-suffix` on the output carries a unit. It is a **convenience for simple cases**: a number and
a unit form their own bidi run (the readout is `unicode-bidi: isolate` so it cannot reorder the
text around it), but how the two order *within* a given locale is a formatting question. Anything
locale-sensitive belongs in the host's `Intl.NumberFormat`.

## Accessibility

Semantics come entirely from the composed field: `role="slider"`, the value properties, arrow
stepping, Home/End, the label. The lane adds **no ARIA of its own** — it draws.

- **`<output>`, never a live region.** The slider announces on change; a live region duplicates it.
- **The layers are `pointer-events: none`**, so the input keeps the whole lane as its target.
- **Forced colors:** the lane draws its own track and fill, so it owes the same debt the field
  does. The shipped `@media (forced-colors: active)` block repaints both from system colours.
- **No fill in one engine only.** Firefox can fill a native track for free via
  `::-moz-range-progress`, and this component deliberately does not use it: a fill that appears in
  one engine and not the others is a visual inconsistency, not progressive enhancement.

### Manual accessibility testing (definition of done — atomica11y range-slider §2–3)

- [ ] **Desktop SR:** Tab to the control — I HEAR its label, that it is a slider, and its value.
- [ ] Arrow keys change the value one step — I HEAR the new value, **once** (not twice, which
      would mean the output is announcing as well).
- [ ] The announced text matches the visible readout, including the unit.
- [ ] **Mobile SR:** swipe focuses; swipe up/down or volume buttons change and announce.
- [ ] **RTL:** the fill grows from the right and the announced value is unchanged.
- [ ] **Vertical:** Up increases, and the fill grows from the end the thumb moved away from.
- [ ] **With ticks:** the arrow keys land on every drawn stop, and the stops themselves are
      silent (they are decoration — hearing them would mean they are announced twice).
- [ ] **Forced colors:** track and fill are both distinguishable, and the thumb is visible on both.
- [ ] **200% text zoom:** the whole lane scales; nothing clips and no target drops below 24px.
- [ ] **`flush` lane:** the overhanging thumb is not clipped by an ancestor and does not overlap a
      neighbouring control's target.

## Non-goals

- **A reference band** (`region` / `band` / `marker`). Next increment.
- **A value bubble.** After that.
- **A scale of words.** A separate proposed component: the value is an index that stands for a
  meaning, which is a contract about keeping two things in step, not about drawing a lane.
- **Ticks and a readout beside a vertical lane.** The tick and value rows sit under a horizontal
  lane; a vertical lane renders neither yet.
- **Two thumbs.** That is RangeGroup: a `<fieldset>` holding two fields on one shared lane.
- **Formatting beyond `data-suffix`.** Locale-aware number formatting is the host's.
- **A page-level scrim while dragging.** Not modality, and a page concern.

## Kernel dependencies

None — self-contained. If a third component needs the same value↔position conversion, promote it.

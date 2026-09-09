# RangeGroup

Two **RangeFields** on one shared **RangeScale**, bounding a span. Native range has no `multiple` —
it was never implemented — so a span is two inputs, each keeping its own role, its own keyboard and
its own entry in the form data (`?lower=&upper=`, which is what a server wanted anyway).

The `<fieldset>` is not decoration: it gives the group its **intrinsic** name from `<legend>` (no id
plumbing, no document-outline dependency) and cascades `disabled` to both fields for free.

The lane draws. This component owns only the rules that are about the **pair**.

## Contract

```html
<fieldset class="RangeGroup" data-component="RangeGroup">
  <legend>Price</legend>
  <div class="roles" data-part="roles">
    <label for="price-lower">Lowest <b data-readout="lower" aria-hidden="true" data-suffix="tkr">200 tkr</b></label>
    <label for="price-upper">Highest <b data-readout="upper" aria-hidden="true" data-suffix="tkr">700 tkr</b></label>
  </div>
  <div class="RangeScale" data-component="RangeScale" data-fields="2"
       style="--_rs-a: 0.2; --_rs-b: 0.7">
    <span class="track" data-part="track"></span>
    <span class="fill" data-part="fill"></span>
    <input class="RangeField" type="range" id="price-lower" name="price-lower" data-role="lower"
           min="0" max="1000" step="10" value="200">
    <input class="RangeField" type="range" id="price-upper" name="price-upper" data-role="upper"
           min="0" max="1000" step="10" value="700">
  </div>
</fieldset>
```

Contract rules (enforced by the unit test):

- **`<legend>` is the first child of `<fieldset>`** — a spec requirement, and the only intrinsic
  group name.
- **Each field has its own `<label>`.** "Lowest" and "highest" is what each control *is*; a span is
  not one value with two handles, and a single label for the pair would leave one end unnamed.
- **The readout inside the label is `aria-hidden="true"`.** Visible next to the role word, but kept
  out of the accessible name — un-hidden, the name would be "Lowest 200 tkr": a name that mutates on
  every step, and a value spoken twice, since `aria-valuetext` already carries it.
- **`data-role="lower"` / `"upper"` is the discriminator**, and it is a role rather than a position:
  in RTL the lower end sits on the right.
- **Both fields share `min`, `max` and `step`.** Two different scales on one lane would make the
  drawn span meaningless.
- **`data-fields="2"` on the lane is an authored fact**, not something read from the DOM. The
  pointer rule that hangs off it is load-bearing, and load-bearing selectors do not get to depend on
  feature detection.
- **`--_rs-a` and `--_rs-b` are server-rendered** so the first paint is correct without JavaScript.
- **`aria-valuemin`, `aria-valuemax` and `aria-valuetext` are NOT authored.** They are statements
  about the pair at a moment in time; the class writes them on mount. Authoring them would be a
  second source of truth that goes stale on the first drag.

## Parts

Every part carries a lowercase class **for styling only** — rename, hash or delete them all and the
suite still passes. A part also carries `data-part` when the suite, the reference JS or a composing
component has to *find* it; that attribute is the contract, and the stylesheet never reads it.
The **Bound by** column says who holds on to each part.

[`RangeScale.md`](../RangeScale/RangeScale.md#parts). The readouts are `<b data-readout="lower|upper">`,
identified by that attribute.

| Part | Element | Role | Bound by |
|---|---|---|---|
| `roles` | `<div>` | Row holding the two labelled readouts above the lane | suite |

## HTML Authoring API

| Attribute | Values | Notes |
|---|---|---|
| `disabled` on the `<fieldset>` | present / absent | Native cascades it to both fields |
| `data-role` on each field | `lower` · `upper` | The discriminator |
| `data-invalid` | `"true"` on the lane **and** each field | Pair with `aria-invalid` on the fields |
| `data-suffix` on each readout | string | The unit, as on the lane |

There is **no `data-clamp`**. See below.

## CSS Variable API

| Variable | Default | Description |
|---|---|---|
| `--_rg-gap` | `0.5em` | Legend → roles → lane |
| `--_rg-role-size` | `0.875em` | Role labels and legend |
| `--_rg-role-color` | `currentColor` | Role labels and legend |
| `--_rg-readout-color` | `currentColor` | The two values |
| `--_rg-readout-digits` | *set by JS from `max`* | Digits reserved in the readout — see below |

Everything about the lane — its model, ticks, a reference layer — is RangeScale's API, untouched.
A span is the same lane, told that it holds two controls.

## The three rules this component owns

### 1. Clamping is hard stop, and it is the only strategy

Each control stops where the other stands, so **nothing the user did not touch ever moves**.

The **value** is clamped and the `max` attribute is left alone. Changing the attribute would shrink
that input's own geometry — its thumb would travel a shorter distance for the same pixel width — and
the two would stop sharing a coordinate system.

There is no attribute to choose otherwise, because the other two strategies are not styling choices:

- **Push** silently moves a value the user did not touch, and nothing announces it. A screenreader
  reports only the control you are in.
- **Swap** changes a control's *identity* mid-interaction: focus stays on the same element while it
  now drives the other end, and the value you were watching starts running backwards. No ARIA
  mechanism can say "the element you are in means something else now".

### 2. The exposed span

Because the attributes stay put, the narrowed ceiling is exposed through ARIA instead:
`aria-valuemax` on the lower end, `aria-valuemin` on the upper.

> **Measured** in Chromium 147, reading Chrome's accessibility tree over CDP rather than the DOM:
> author-set `aria-valuemin` and `aria-valuemax` **do** override the native mapping on a range, and
> `aria-valuetext` arrives as its own property alongside the numeric value. Not yet measured in
> Firefox or WebKit, and whether a screenreader *announces* the corrected ceiling is a manual check.

So the same fact is carried in words as well, which is the half that is honoured everywhere:
`aria-valuetext` reads *"200 tkr, within 200–700 tkr"*. It deliberately does **not** repeat the role
— the `<label>` already says which end this is, and a screenreader announces name, then role, then
this. "Lowest, slider, 200 tkr, lowest of…" says it twice. What is missing from the announcement is
the pair, so that is what the text adds. The name half is protected the same way: the visible
readout inside the label is `aria-hidden`, so the name stays "Lowest" rather than "Lowest 200 tkr"
— the same value spoken twice from the other direction.

If the measurement comes back negative elsewhere, delete the two attribute lines: the words already
carry it.

### 3. Pointer arbitration

On the same value the thumbs overlap and only one can be reached, so the nearer one is raised.

**Two details that are easy to get wrong.** The raise happens on `pointermove` as well as
`pointerdown`, because a `pointerdown` listener runs *after* the browser has hit-tested and chosen a
target — raising a thumb there would only ever fix the following press. And when both ends hold the
same value the distances are identical, so distance cannot break the tie: **side** does. A cursor
below the shared position wants the lower end, above it the upper. Without that, one end is
permanently unreachable the moment they meet.

Both are read along the lane's inline axis, so they hold in RTL — where the lower end is on the
right.

### The readout reserves width, and only for the digits

A readout whose width follows its content makes the **component** follow its content: `700` is one
character narrower than `1000`, so crossing into four digits widened the readout, the label, the
fieldset and — because the lane is inside it — the track. Every position then recomputed and the
thumb jumped under the finger mid-drag. Reported from a test environment, not caught by any test.

So the digits sit in their own element and their width is reserved from `max`:
`min-inline-size: calc(var(--_rg-readout-digits) * 1ch)`, which under `tabular-nums` is exactly a
digit's width. Taken from the contract, never measured from the DOM — the same idea as AffixField's
`--_af-input-chars`.

**Only the digits.** Reserving the whole string over-reserved by a quarter, because a space and
three lowercase letters are far narrower than a zero: it cost ~51px of permanent width to remove a
12px jump, which is a worse defect than the one it fixed. The unit is static markup instead, so it
costs its natural width — and a unit is not data, so that is where it belonged anyway.

Override `--_rg-readout-digits` for an unusual format (a thousands separator adds characters).

## Two consequences, documented rather than hidden

**Clicking the bare track does not move a thumb.** The inputs give up the pointer so that both
thumbs stay grabbable; that trade is the only way to keep the lower one reachable when they overlap.
A single-field lane keeps track-clicking, a span does not.

**On touch there is no hover to pre-raise with.** A first tap exactly on two coincident thumbs may
take the other end; the second is correct. Implementing a "first tap always wins" rule would mean
re-implementing the drag, which is the thing native is here to provide.

## Accessibility

Semantics come from native throughout: `role="slider"` and the value properties on each field, the
group name from `<legend>`, the disabled cascade, and two entries in the form data. The only ARIA
this component adds is the span — `aria-valuemin` / `aria-valuemax` / `aria-valuetext` — and each of
those is a statement about the pair that native cannot make.

**The gap nothing solves:** no single control announces the span. A user hears "200 tkr" and
"700 tkr" separately and holds them together themselves. `aria-valuetext` carries the context, which
is chatty but arrives only when the control is touched — unlike a live region, which would speak on
every change and duplicate what the slider already says.

### When two number inputs are the better answer

Zero JavaScript, no overlap, no clamping strategy, no `aria-valuetext` — and the value can be typed.
If the span must be exact, or is mostly filled in by keyboard, `<input type="number">` twice is
honestly better, and the kitchensink shows it as the native reference for that reason. Ask why a
slider was wanted before adopting the three behaviours above.

### Manual accessibility testing (definition of done — atomica11y range-slider §2–3)

- [ ] **Desktop SR:** Tab to each end — I HEAR the group name from the legend, then which end it is,
      then that it is a slider, then its value **and** the span it sits within.
- [ ] Arrow keys move one step and announce; the value is never announced twice.
- [ ] Drive one end into the other with the keyboard — it stops, and **the other end never moves**.
- [ ] At the stop, I HEAR that it cannot go further, or at minimum the value stops changing without
      anything contradicting it. *(This is the item the `aria-valuemax` measurement covers only in
      the accessibility tree — verify what is actually spoken.)*
- [ ] **Mobile SR:** both ends are reachable by swipe and adjustable; the collided case is
      recoverable.
- [ ] **RTL:** the lower end sits on the right, the announcement is unchanged, and dragging still
      moves the end nearest the finger.
- [ ] **Forced colors:** both thumbs and the span between them stay distinguishable.
- [ ] **200% text zoom:** the legend, both role labels and both readouts fit without clipping.

## Non-goals

- **Push and swap clamping.** See above; both are rejected for behaviour, not for looks.
- **More than two ends.** A third value is not a span.
- **Track-clicking.** See the consequences above.
- **Formatting beyond `data-suffix`.** Locale-aware numbers are the host's `Intl.NumberFormat`.
- **A combined live region.** The slider already announces; a live region would double it.

## Kernel dependencies

None — self-contained. It composes RangeField and RangeScale.

# ADR 0023: The range family splits three ways — RangeField, RangeScale, RangeGroup

**Status:** Accepted
**Date:** 2026-08-18
**Decider:** Nicklas Bryntesson

## Context

ADR-0022 narrowed "slider" to the continuous-quantity case. What remains is still not one
component, and the reason is physical rather than stylistic.

**An `<input type="range">` has exactly two addressable insides:** the track pseudo-element and the
thumb pseudo-element. There is no third. So the moment a design needs another measurement drawn on
the same lane — consumption already used, a recommended band, a threshold — there is nowhere inside
the input to put it.

**CSS custom properties inherit downward only,** and CSS cannot read `value`. An input therefore
cannot publish its own position to a parent or a sibling. Whoever draws something position-dependent
must be the element that *writes* the position, which is the container holding the siblings.

**Native has no `multiple` on range** — it was never implemented. Two thumbs means two elements,
which means a wrapper that owns the pair.

A working lab (`tasks/range-lab.html`, eight exhibits, geometry measured in-browser) was built
before this ADR and drove several of its rulings.

## Decision

**Three components, each owning one thing.**

| | Owns | Knows nothing about |
|---|---|---|
| **RangeField** | one `<input type="range">`: a flat track, the thumb, the keyboard, the orientation, invalid | the lane, the fill, ticks, words, its own value in CSS |
| **RangeScale** | the lane: `.track`, `.fill`, ticks, `<output>`, the reference layer. **The coordinate system. All JavaScript** | whether it holds one field or two |
| **RangeGroup** | `<fieldset>` + `<legend>`, two RangeFields on one shared RangeScale, clamping, the combined announcement | how a thumb is drawn |

Scope boundary in one line: **RangeField is the control, RangeScale is the lane everything is
measured against, RangeGroup is the pair.**

**Anything whose position or length depends on the value belongs to RangeScale** — the fill
included. A native range has no filled portion: it is a second thing drawn on the same lane, and
CSS cannot read `value`, so a tier with no script cannot keep it honest. RangeField therefore
draws a flat track and a thumb, exactly what native has, and has **nothing to synchronise**.

**The seams run one way, downward.** RangeScale writes the position on itself, where it inherits
into the field, and mirrors the visible words into the field's `aria-valuetext`. No component
reads upward. RangeField has **no JavaScript** — not "none yet", nothing that could need any.

**A reference layer is an axis, not a component.** Reference presence and thumb count are
orthogonal — a house-price filter can want a median marker — so encoding both as component
identity yields a 2×2 matrix with a fourth component nobody wants. One layer, three axes:
`data-reference` (`region` · `band` · `marker`), `data-reference-variant` (the four `--ui-*`
semantic tokens Notice already uses), and `data-reference-layer` as an override only.

**Clamping is hard-stop, and it is the only strategy.** The value is clamped; the `max` attribute is
left alone, because changing it shrinks that input's own geometry and the two lanes stop sharing a
coordinate system.

**Vertical is `writing-mode`, never rotation,** and the standard recipe is min at the bottom
(`vertical-rl` + `direction: rtl`, measured in Chrome). Rotation does not remap the arrow keys.

**Part names follow CSS Forms L1 and Open UI:** the lane is `track`, the filled portion is `fill`,
the handle is `thumb`, the scale marks are `ticks`. MUI's inversion (`rail` for the lane, `track`
for the fill) is the minority and is not followed. No internal part is named `range` — Radix, Ark,
Zag and Chakra v3 all spend that word on the fill.

## Considered alternatives

1. **One component with N thumbs, array-valued.** The dominant pattern — MUI, Radix, Base UI,
   shadcn, React Aria, Ark, and Chakra, which deleted its separate `RangeSlider` in v3. Rejected
   because every one of them abandoned the native element and builds `role="slider"` on divs. We
   cannot: native range has no `multiple`, so two thumbs are two elements. Open UI, reasoning from
   the same constraint, proposes a `<rangegroup>` wrapper — the same split.
2. **The reference layer as its own component.** Rejected — orthogonal to thumb count (see above),
   and it cannot live inside the field anyway: there is no third pseudo-element.
3. **Two `<input type="number">` instead of a pair of sliders.** Not rejected — it is the honest
   answer when the span must be exact or is mostly typed: zero JS, no overlap, no clamping strategy.
   RangeGroup exists for the cases where dragging is the point, and its contract will say so.
4. **Name the middle tier `Control` (Base UI, Ark, Chakra v3) or `Track` (React Aria).** Rejected.
   `Control` means "the interactive part" in libraries that have no real input; here the input *is*
   the control, so the name would assert the opposite. `Track` is claimed by CSS Forms L1 for the
   input's own inside, so a sibling wrapper called Track gives a porter two different tracks.
   `Scale` collides with nothing and is true — it carries the scale.
5. **Push or swap when the thumbs meet.** Rejected. Push silently changes a value the user did not
   touch and nothing announces it. Swap changes the control's *identity* mid-interaction: focus
   stays on the same element while it now drives the other end, and no ARIA mechanism can say so.
6. **Fold the lane into the field and skip the middle tier.** Rejected — the field would have to
   read `--_p` from an ancestor, breaking the self-containment ADR-0017 requires, and its track
   would need to go transparent under external control anyway.

## Consequences

### Positive
- The trivial case stays trivial: a bare `RangeField` works with no wrapper, and it is honest —
  a stateless component that draws only what the browser maintains cannot display stale state.
- One code path covers one thumb, two thumbs and reference layers, because all of them are
  expressed in the lane's coordinate system.
- The thumb-centre correction — `thumb/2 + p × (100% − thumb)` — is written **once**, in RangeScale.
  Laid out naively the error is up to half a thumb width and changes sign along the track.
- A static reference costs **zero** JavaScript: it is a CSS custom property from the server. `min()`
  replaces the branch that keeps a consumed region from overrunning the fill.
- Colour never enters the components. `data-reference-variant` points at existing `--ui-*` tokens,
  whose `light-dark()` pairs make dark mode free.

### Costs
- A slider that shows its value as a filled portion needs the RangeScale wrapper. Only the plain
  control works alone.
- Orientation is authored on both the field and the lane; a unit test must assert they agree.
- `--_rf-thumb` is a constant two tiers depend on: RangeField owns it, RangeScale supplies it
  downward so there is one authored value rather than two to keep in step.

### Risks to manage
- **Author-set `aria-valuemin`/`aria-valuemax` on a native range may be ignored.** Those properties
  are implicitly derived from the attributes, and browsers differ on whether an author may override
  them on a form control. If ignored, the *values* stay correct — clamping happens in JS — but a
  keyboard user hits an unexplained wall. Already hedged: `aria-valuetext` carries the narrowed span
  in words, and it is author-owned, so it is honoured. Verify in the accessibility tree in three
  browsers, then with VoiceOver and NVDA; if negative, drop the two lines and say so in the contract.
- **Vertical inputs flip twice.** Logical sizing follows the element's own writing-mode, so
  `inline-size` means *height* inside a vertical input; and `direction` reverses the value axis.
  Both bugs are invisible in a screenshot — the first ships a 24px-tall slider inside a lane that
  looks correct. Use physical `width`/`height` there.
- **Do not re-introduce an authored fill position in RangeField.** The first draft of this family
  put one there (`--_rf-p` in the `style` attribute). It renders correctly on first paint and goes
  stale the instant anyone drags, so eighteen of nineteen kitchensink examples read as broken — a
  reference library cannot ship that, and no amount of prose next to it helps. The rule that
  prevents the relapse: a tier with no script draws only what the browser maintains.
- **Colour must never be the only carrier** (WCAG 1.4.1). A coloured reference band is paired with a
  swatch beside the hint text reading the same token, and the hint says what the zone *means*.

### Non-goals
- **A page-level scrim / dimming overlay.** Not modality — nothing is trapped or dismissed — and a
  component whose correctness depends on its position relative to the whole page is a page concern.
  Recipe, not component.
- **Feedback when a value leaves a reference zone.** That is a `Notice`, and it is the consumer's.
- **`<meter>` / read-only measurement.** ADR-0022 names `<meter>` as the right element; it earns no
  contract here.
- **Push and swap clamping.** See alternatives.
- **`data-ticks="labels"`** in the first pass. It is the only axis costing both DOM and
  `aria-valuetext` mirroring; ships after `marks` stands.

### Kernel dependencies
- **None — self-contained.** The scale maths is small and lives in RangeScale. Promote a
  `range-scale` primitive only if a third component needs the same value↔position conversion.

## Reconsider when

- **`::slider-fill` / `appearance: base` ship for range in all three engines.** Measured
  2026-08-18 in Chrome 151: `::slider-fill`, `::slider-track`, `::slider-thumb` and
  `appearance: base` are all unsupported, while `appearance: base-select` *is* — the forms work has
  landed for `<select>` only. If range follows everywhere, the one line writing `--_p` can be
  deleted. A Chromium-only implementation changes nothing: a fill is load-bearing visually, so it
  cannot be progressive enhancement (ADR-0005).
- **Open UI's `<rangegroup>` becomes a real element.** RangeGroup would become a thin wrapper over
  it, or retire.
- **A third component needs value↔position conversion** — then promote it to `src/kernel/`.
- **The `aria-valuemax` verification comes back negative** — then the narrowed span is text-only.

## References

- ADR-0022 (choose the element first) — this family is its narrow continuous case
- ADR-0017 (`--_*` is private) — its stated *Reconsider when* is exactly this position seam
- ADR-0004 (clarity over DRY), ADR-0005 (feature detection is PE only), ADR-0018 (`--ui-*` seam),
  ADR-0019 (flat `.Component .element`), ADR-0008 (field-height contract — the 24px hit target)
- `Notice.md` — the four semantic variants the reference layer reuses
- `docs/atomica11y/form/range-slider-input.md`
- [CSS Forms Level 1](https://www.w3.org/TR/css-forms-1/) · [Open UI enhanced range explainer](https://open-ui.org/components/enhanced-range-input.explainer/) — `<rangegroup>`
- [WAI-ARIA APG: Slider (Multi-Thumb)](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)
- [Elastic EUI `levels`](https://eui.elastic.co/docs/components/forms/numeric/range-sliders/) — the
  only verified prior art for static coloured track regions

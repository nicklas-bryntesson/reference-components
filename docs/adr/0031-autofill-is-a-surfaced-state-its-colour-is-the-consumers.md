# ADR 0031: Autofill is a surfaced state; its colour is the consumer's

**Status:** Proposed
**Date:** 2026-08-28
**Decider:** Nicklas Bryntesson

## Context

Browser autofill paints a highlight (Chromium's light blue, historically yellow) that
consuming projects cannot brand, and the irritation is real: it is a recurring client
complaint that the reference pattern could actually address. But the highlight is not
decoration — it is the browser's affordance telling the user *the browser filled this,
verify it* — so removing it without replacement would delete a native function.

The mechanics were measured on 2026-08-28 by driving Chromium's real autofill filling
path (the CDP `Autofill` domain, credit-card profile — the only profile that can be
triggered programmatically; `cc-exp` conveniently targets `<input type="month">`):

1. **Reach splits exactly along our two input modes.** A visible input (AffixField) and
   a display-mode native (`opacity: 0`, full-size — the coarse-pointer tap layer of
   ADR-0006) are both filled. A custom-mode native (`visibility: hidden`, 1px box — the
   desktop state of every date/time field) is **silently skipped**, even when the visible
   fields beside it in the same form are filled, and confirmed on the live MonthField
   kitchensink instance. This is almost certainly deliberate anti-skimming: filling
   invisible fields is a known data-exfiltration vector, and browsers refuse it.
2. **Sync is already free.** Autofill fires both `input` and `change` on every field it
   fills, and all five date/time fields already sync their segments from the native's
   `change`. Where autofill reaches, the components work today; the feared
   filled-native-empty-segments state does not exist.
3. **The paint can be owned, and the state can be observed.** `background-color` on
   `:autofill` is ignored (the UA's internal `!important` wins), but the inset box-shadow
   recipe (`box-shadow: inset 0 0 0 1000px <colour>`) paints over it. And a keyframe
   animation declared on `:-webkit-autofill` fires `animationstart` on every autofilled
   field — a reliable JS-visible signal for the state.

The colour question itself falls to an existing test: remove the declaration and nothing
measurably breaks — the highlight's colour is taste, and taste is the consuming
project's (ADR-0025). What *is* mechanics: the state being reachable by a selector that
holds (ADR-0005 — `:autofill` is a browser-dependent pseudo-class with browser-controlled
paint), and the affordance staying perceivable where our own pattern hides the native
that carries it.

## Decision

**The reference surfaces the autofilled state; it takes no position on its colour.**

- **`data-autofilled="true"` on the component root** mirrors the browser's autofill state,
  detected via the measured `animationstart`-on-`:-webkit-autofill` keyframe. The
  attribute is the load-bearing styling hook (ADR-0005); `:autofill` remains progressive
  enhancement. The attribute clears when the browser drops the state (the user edits the
  field).
- **Detection is a kernel primitive** — two consumers clear the bar (ADR-0004): AffixField
  (visible input, the desktop story) and the date/time family's display mode (touch,
  where the filled native is invisible and the attribute is what makes the state
  perceivable on the custom presentation at all).
- **The reference ships no autofill restyling.** The native highlight stands untouched by
  default — zero colour opinions. The consumer recipe (gate on `data-autofilled`, inset
  box-shadow to own the paint) is documented in the component contracts and **copied, not
  imported** (ADR-0020): it is a visual recipe, not shared behaviour.
- **A consumer who restyles owns keeping the state perceivable.** The contracts say this
  explicitly: replace the highlight, never just delete it.
- **Custom mode does not autofill, and we do not court it.** The browser's refusal to fill
  invisible fields is a security measure, not a bug in our hiding CSS. Contorting the
  native's styling to smuggle it past anti-skimming heuristics would be fragile,
  adversarial, and indistinguishable from the attack the heuristic exists to stop. It is
  recorded as a documented limitation, in the same genre as popover clipping (ADR-0012).

This establishes the test: **is the browser withholding the behaviour on purpose?** When
a browser refuses a behaviour as a security measure, the refusal is a documented
limitation, not a workaround target.

## Considered alternatives

1. **Restyle `:autofill` in the reference CSS** (tokens, brand seam) — rejected twice
   over: the colour is taste (ADR-0025) and the reference holds no colour opinions; and
   the naive override does not even work (`background-color` is ignored; only the
   box-shadow recipe paints). Shipping the recipe as default would also mask the native
   affordance for every consumer who never asked.
2. **Chase autofill reach in custom mode** (swap `visibility: hidden` for opacity-only
   hiding, off-screen positioning, …) — rejected: the skip is deliberate anti-skimming,
   and a hiding recipe tuned to defeat it is exactly what the heuristic will be tuned
   against next. Display mode already covers the platform (touch) where autofill of
   these field types is most common.
3. **Do nothing** — rejected: consumers are left styling a pseudo-class whose paint the
   browser overrides and whose support varies (a load-bearing selector on feature
   detection, ADR-0005), and on touch the filled state is invisible — an autofilled
   display-mode field looks identical to one the user typed, which is the removed-
   affordance state this ADR exists to prevent.
4. **Surface the state, document the recipe, keep the native default** — chosen, on the
   measurements above.

## Consequences

### Positive
- Consumers brand the highlight with one attribute selector and one documented recipe,
  instead of fighting UA internals per project.
- On touch, the autofilled state becomes perceivable on the custom presentation —
  restoring a native affordance our pattern was hiding, not removing one.
- The recurring client complaint gets an answer that is the consumer's to apply, keeping
  the reference opinion-free on colour.

### Costs
- A new kernel primitive (detection) with contract and conformance tests, plus an
  `autofilled` row in the affected kitchensinks (simulated via `data-autofilled`, like
  `data-test-state`).
- One more contract section in AffixField and the date/time family (`## Autofill`).

### Risks to manage
- **The paint recipe is unspecified behaviour.** The box-shadow trick works because the
  UA's forced paint does not extend to box-shadow; a future Chromium may close it. The
  attribute seam is what insulates consumers: the recipe can change without the selector
  changing.
- **The detection hack dies under `* { animation: none !important }`.** A consumer CSS
  reset that nukes animations silently kills detection. The kernel contract must name
  this, and the conformance test must fail under such a reset rather than pass vacuously.
- **Only Chromium's card path is measured.** Firefox/Safari paint and pseudo-class
  behaviour, and the address/birthday profile (undriveable programmatically), need a
  manual pass before the recipe is documented as cross-browser truth. The ADR flips to
  Accepted when the build starts; the contract documents only what is measured.

## References

- Probe measurements 2026-08-28 (CDP `Autofill.trigger`, forms matrix + live MonthField/
  AffixField) — protocol in the gitignored `tasks/` working docs
- ADR-0004 (kernel bar), ADR-0005 (load-bearing selectors), ADR-0006 (native fallback
  modes), ADR-0012 (documented-limitation genre), ADR-0020 (copied vs imported),
  ADR-0025 (mechanics vs taste)

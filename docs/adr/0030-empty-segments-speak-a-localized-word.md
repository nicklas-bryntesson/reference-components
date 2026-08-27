# ADR 0030: An empty segment speaks a localized word, never its placeholder

**Status:** Accepted
**Date:** 2026-08-27
**Decider:** Nicklas Bryntesson

## Context

The segmented fields disagreed about what an empty segment says to a screenreader.
DateField and DateTimeField's date segments authored the visible placeholder as
`aria-valuetext` — so VoiceOver read "dd", "mm" and "yyyy", three tokens it pronounces
three different ways. DateTimeField's time segments, MonthField, WeekField, TimeField and
the WheelColumn kernel primitive authored `"--"`, which VoiceOver's caption panel shows
but its voice silently drops (punctuation). One family, two conventions, and neither chosen
on purpose.

The house rule — mirror the browser default — was measured against native on 2026-08-27
and found nothing to mirror: **native's empty segments are broken with VoiceOver.** An
empty `<input type=date>` segment announced "−950 %, År", "−9,1 %, Månad", "−3,3 %, Dag" —
the spinbutton percent fallback that fires when `aria-valuemin`/`aria-valuemax` are present
but `aria-valuenow` is not, computed over garbage. Filled native segments announce
sensibly ("1990, År Date"), and there the reference already matches.

The same measurement killed the tempting "pure silence" fix: our empty segments already
remove `aria-valuenow` (correct — that is ARIA's indeterminate state), and the only thing
standing between us and native's percent garbage is that we author *some* valuetext. The
accidental `"--"` was load-bearing.

## Decision

**An empty segment always carries an explicit `aria-valuetext`, and it is the localized
`empty` word — `en: "blank"`, `sv: "tomt"` — from the component's translation table.**

- One word for every segment type in every field: day, month, year, week, hour, minute,
  second all announce the same thing when empty ("blank, Day" / "tomt, Dag").
- The **visible** placeholder is untouched — "dd"/"mm"/"yyyy"/"--" remain the sighted
  convention; this ADR governs only the spoken value.
- `aria-valuenow` stays removed while empty (indeterminate), and the valuetext must never
  be omitted along with it: min/max without valuenow is the measured percent-garbage
  recipe. The kernel `WheelColumn` encodes this as an `emptyText` option (default `"--"`
  for compatibility; components pass their localized word).
- The word ships through the existing `registerLocale` seam like every other string.

## Considered alternatives

1. **Mirror native** — the standing house rule, measured inapplicable: native's empty
   state announces computed percentages. Where native works (filled segments), the
   reference already mirrors it.
2. **Pure silence** (no valuetext, indeterminate only) — matches what `"--"` accidentally
   sounded like, but reproduces native's bug: the percent fallback is exactly what fills
   the vacuum. Rejected on the same measurement.
3. **Keep `"--"` everywhere** — silent in VoiceOver by accident of punctuation rules, with
   no contract that other screenreaders drop it too ("dash dash" is a plausible reading).
   An accident is not a convention. Rejected.

## Consequences

### Positive
- The between-segment inconsistency the manual pass caught ("dd" ≠ "mm" ≠ "yyyy" in a
  screenreader's mouth) is gone; so is the family split.
- The empty state is better than native on the exact point native was measured failing.

### Costs
- One more required key in every translation table; consumers registering custom locales
  without `empty` fall back to English "blank" (the `registerLocale` spread).

### Risks to manage
- A future segment or wheel added without a valuetext on its empty state silently
  reintroduces the percent fallback. The unit contract tests assert the word per
  component; `WheelColumn`'s default keeps the kernel safe even when a component
  forgets to pass `emptyText`.

## References

- VoiceOver caption measurements 2026-08-27 (native empty percent garbage; `"--"`
  dropped as punctuation) — protocol in the gitignored `tasks/` working docs
- ADR-0006 (native mirroring) — the rule this ADR carves an exception from, on evidence
- ADR-0028 — the measurement discipline these captures followed

# ADR 0029: A footer action that completes the value closes the popup

**Status:** Accepted
**Date:** 2026-08-27
**Decider:** Nicklas Bryntesson

## Context

The popup fields ended a VoiceOver pass with an inconsistency a user notices: DateField's
**Today**, WeekField's **This week** and DateTimeField's **Now** commit and close the popup,
while TimeField's **Now** and MonthField's **This month** set the value and leave it open.
Clear was split the same way — closing in DateField and DateTimeField, staying open in
TimeField, MonthField *and* WeekField (an outlier even within the calendar group).

The split was not drift. Each footer button had inherited its popup body's selection model:
calendar popups commit-and-close on a day/week click, so their shortcuts closed; wheel popups
are live surfaces that never close on a spin, so their shortcuts stayed open. Internally
coherent — but the footers look identical across the family (same position, same kind of
labels), which invites family-level expectations the body-model rule cannot meet.

The native references split the difference: the Chromium desktop time list closes on
selection; the iOS wheel popover never closes on a spin but carries a footer (Reset, ✓)
whose actions *finish the task*. The footer is not part of the editing surface — it is where
the interaction ends.

## Decision

**The popup body follows its own gesture model; a footer action that produces a complete
value commits and closes.**

- Body gestures keep their nature: a calendar day/week click is a commit and closes; a wheel
  spin edits live and never closes (the wheel surface is left via the trigger, `Escape`, or
  light dismiss).
- Footer shortcuts — **Now, This month, This week, Today, Clear** — close the popup when the
  value they produce is complete. Clear counts: an emptied field is a completed (empty) value.
- A footer action that produces a **partial** value stays open: DateTimeField's **Today** sets
  only the date part, leaving the time still to edit, so it behaves like the day click beside
  it. Only its **Now** — which fills everything — closes.
- Closing from a footer button returns focus to the trigger (the clicked button leaves the DOM
  with the popup), exactly like the `Escape` path. Light dismiss still never refocuses
  (ADR precedent: TimeField's outside-click rule).

Changed by this ADR: TimeField **Now**/**Clear**, MonthField **This month**/**Clear**,
WeekField **Clear** now close. Everything else already conformed.

## Considered alternatives

1. **Keep the body-model rule and document it** — internally coherent and native-mirroring,
   but the rule is invisible at the point of use: identical-looking footers behaving
   differently across the family is what a user actually experiences. Rejected.
2. **Uniform close on every footer action** — breaks DateTimeField's Today, which would close
   around a half-finished value and make the button weaker than the day click next to it.
   The "complete value" qualifier is what the uniform rule was missing. Rejected.
3. **An explicit Done/✓ button in wheel popups** (the iOS shape) — redundant here: the
   trigger toggle, `Escape` and light dismiss already provide the neutral exit, and with
   footer actions closing, the footer has its finishing character without a new control.
   Rejected as scope.

## Consequences

### Positive

- One question decides the behaviour anywhere in the family: *does this action complete the
  value?* Yes → commit and close. No → stay open.
- The common case ("just give me now, done") finishes in one activation, and keyboard/SR
  users get a deliberate focus landing instead of a popup that silently lingers.

### Costs

- "Now, then adjust" in TimeField/MonthField now takes a reopen. The wheels remain the
  primary editing surface for that flow.

### Risks to manage

- New popup components must route their footer through this test rather than inheriting
  their body model. TESTS.md carries the question.

## References

- Probe measurements 2026-08-27 (`tasks/probes/`, gitignored): the full close-behaviour
  matrix across the five popup fields
- Native references: Chromium `<input type="time">` desktop list; iOS time picker popover
- `docs/adr/TESTS.md` § 16 — added by this ADR

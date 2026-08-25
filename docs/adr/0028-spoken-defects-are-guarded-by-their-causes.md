# ADR 0028: Spoken defects are guarded by their mechanical causes; listening stays manual

**Status:** Accepted
**Date:** 2026-08-25
**Decider:** Nicklas Bryntesson
**Supersedes:** ADR-0027 (the automated `test:vo` runner; its three-layer analysis stands)

## Context

ADR-0027 proposed automating the spoken layer with guidepup, driving real VoiceOver from
Playwright. The scaffold was built and worked up to the point of running — where guidepup's own
setup documentation ended the idea. Its permission surface on a development Mac:
Accessibility, Automation, and depending on use **Location Services, Microphone, Screen
Recording and Bluetooth**; its CI path requires **disabling System Integrity Protection** to
write the TCC database and VoiceOver's AppleScript flag by hand. That is a security posture
being traded for a test suite. On a machine that is also a person's daily environment, the
trade is wrong — twice the setup panel says so itself.

Rejecting the runner does not un-learn what the 2026-08-25 pass proved. Both spoken defects it
found had **mechanical causes** that simpler tiers can guard:

- RangeField's frozen speech was caused by an *authored `aria-valuetext` on a component with no
  script to update it* — a static-analysis fact about the generated partials.
- MotionRegion's silent toggle was caused by *relying on an `aria-label` swap to be re-announced*,
  which screenreaders do not do — fixed by a `role="status"` region whose existence, wording and
  write-on-toggle behaviour are all assertable in jsdom and Playwright.

## Decision

**The spoken layer is not a runner; it is a discipline.** Three parts:

1. **Guard the cause, not the speech.** When listening finds a defect, the fix lands with a
   mechanical test for what *produced* the wrong speech — a never-author rule in a contract
   test, a live-region write asserted in jsdom — proven failing first, per the house rule.
   Both 2026-08-25 defects landed exactly this way.
2. **Listening stays manual**, on the `## Manual accessibility testing` checklists. The
   checklists are sharpened as findings come in ("I HEAR each new value, *fresh every step*";
   "a policy pause announces *nothing*") so the next pass listens for the known failure modes.
3. **No screenreader automation on development machines.** Revisit only in an environment where
   the permission surface costs nothing — a dedicated, disposable CI runner — and even then as
   an addition to, never a replacement for, the cause-guards.

TESTS.md test 15 (tier routing) survives with its spoken lane re-routed: tree-readable →
e2e+axe; spoken → *a mechanical guard on the cause* plus a manual checklist item; judgment →
manual checklist.

## Considered alternatives

1. **guidepup / `test:vo`** (ADR-0027) — built, then rejected at the permission gate. The
   packages, config and spoken tests were removed unlanded; the two fixes shipped without them.
2. **Raw AppleScript probes** — already measured and rejected in ADR-0027; strictly worse.
3. **NVDA in a Windows VM** — the least-bad automation home (NVDA logs speech natively,
   virtualizes cleanly, and a VM's permissions are disposable). Not pursued now: no Windows
   environment in the loop, and the cause-guard discipline covers the known failure modes.
   This is the "reconsider" path, not a current plan.

## Consequences

### Positive
- No security posture traded away for a test suite; nothing on the machine gained Microphone,
  Screen Recording or SIP-adjacent powers.
- The two defects the runner was meant to catch are guarded anyway — at unit/e2e speed, in CI,
  with zero setup.

### Costs
- Truly novel speech defects (a class no cause-guard anticipates) are still found only by ear,
  at manual-pass cadence. This is the accepted price; the checklists are the mitigation.

### Risks to manage
- **Checklist decay** — the manual pass only pays off if findings keep flowing back into
  checklist items and cause-guards. The 2026-08-25 items are the template.

## Reconsider when

- A dedicated, disposable runner (CI Mac or NVDA VM) enters the picture — automation becomes an
  addition there, never on a development machine.
- A spoken defect ships that a cause-guard *could not* have expressed — that is evidence the
  discipline has a hole, not just a missed test.

## References

- ADR-0027 — the superseded runner decision; its layer analysis and pilot measurements
- PR #68 — both fixes with their cause-guards, proven failing first
- guidepup environment setup documentation (the permission list quoted above)
- `docs/adr/TESTS.md` § 15 — tier routing, updated by this ADR

# ADR 0027: Spoken output is a test tier — assert what the screenreader says, with guidepup

**Status:** Superseded by ADR-0028
**Date:** 2026-08-25
**Decider:** Nicklas Bryntesson

> Superseded the same day: guidepup's real permission surface (Accessibility, Automation, and
> depending on use Location Services, Microphone, Screen Recording, Bluetooth; SIP-disabling on
> the CI path) was judged a worse trade than the tier is worth on a development machine. The
> three-layer analysis below stands; the runner does not. See ADR-0028.

## Context

A screenreader pass on 2026-08-25 split the accessibility work into three layers with very
different costs:

1. **Structure** — roles, names, states, focus routing. Readable from the accessibility tree,
   already covered by the e2e + axe suite, and a same-day mechanical audit of that tree found and
   fixed four naming defects (PR #66) without a screenreader running.
2. **Speech** — what is *actually spoken*. Two real defects lived only here and were invisible to
   every mechanical check: RangeField's authored `aria-valuetext="50 %"` froze while the value
   moved (VoiceOver kept saying "50 %" at 51), and MotionRegion's play/pause toggle swaps its
   `aria-label` correctly but screenreaders do not re-announce a name change on the focused
   element — the toggle is silent until you leave and return.
3. **Judgment** — is "dd" as a placeholder announcement noise or information; does the reading
   order make sense. Human ears, per the `## Manual accessibility testing` checklists.

Layer 2 currently has no home. It is tested by ear, which means it is tested rarely, never on
regression, and its findings decay: RangeScale's own source carries a comment about a static
`aria-valuetext` that "drifted silently" — the exact bug that shipped again in RangeField.

A raw-AppleScript pilot the same day proved layer 2 is *capturable*: with AppleScript control
enabled, `content of last phrase` returns exactly what VoiceOver spoke, and it reproduced the
RangeField freeze as text. The same pilot showed why raw AppleScript is not the tool: VoiceOver
does not track programmatic `.focus()` into custom elements (native inputs only), its commander
verbs are undocumented (every guessed `perform command` name failed), OS-level keystrokes hang on
an Accessibility-permission prompt, and a hand-rolled driver has no answer for timing. It also
showed the operational constraint: VoiceOver is system-global — an automated run and a human
cannot share the machine.

## Decision

**What a screenreader speaks is a third test tier**, alongside e2e+axe (structure) and the manual
checklists (judgment). It is automated with **guidepup** (`@guidepup/playwright`), which drives
real VoiceOver with real keystrokes and exposes `lastSpokenPhrase()` for assertions.

- The suite is **opt-in** (`npm run test:vo`), never part of `test:e2e`, never a commit gate. It
  runs when the machine is dedicated to it.
- Ear-findings graduate into spoken regressions the way probes graduate into tests: a defect heard
  once becomes an assertion that fails while the defect exists (proven failing before the fix).
- Assertions match on **substance, not phrasing** — `toContain("51")`, not a byte-exact VoiceOver
  sentence. macOS releases reword speech; the tier must survive that.
- The manual checklists keep everything this tier cannot reach: mobile screenreaders, Windows
  High Contrast, and every judgment call.

## Considered alternatives

1. **Keep listening manually** — the current state. Rejected: not repeatable, blind to
   regressions, and the findings demonstrably decay (RangeField re-shipped a bug RangeScale had
   already documented).
2. **Infer speech from the accessibility tree** — extend the e2e suite. Rejected as the *whole*
   answer: the tree audit is the cheapest layer and stays, but both 2026-08-25 speech defects were
   invisible in a correct-looking tree. Name composition ≠ announcement behaviour.
3. **Raw AppleScript probes** — measured in the pilot. Rejected: focus tracking, undocumented
   commander verbs, permission hangs and timing make every probe bespoke; guidepup is the same
   channel with those problems already solved, and it adds NVDA on Windows with the same API.
4. **NVDA in a Windows VM / CI** — attractive later (NVDA logs speech natively and virtualizes
   cleanly, which VoiceOver does not). Not first: the development machine is a Mac and guidepup
   covers both screenreaders behind one API, so the NVDA lane can be added without re-deciding.

## Consequences

### Positive
- Speech defects become regression-testable; today's findings (RangeField freeze, MotionRegion
  silence, the PR #66 naming fixes) become permanent assertions instead of one-day memories.
- The three tiers give each a11y question a home: tree → e2e+axe, speech → `test:vo`,
  judgment → checklist. The checklists shrink to what only a human can answer.

### Costs
- One-time per-machine setup: VoiceOver Utility's "Allow VoiceOver to be controlled with
  AppleScript" plus an Accessibility permission for the terminal host.
- The suite owns the machine while it runs — speech, focus and the VoiceOver cursor. Scheduling
  discipline, not code, solves this.
- macOS-only until an NVDA lane exists; real screenreader timing will make it slower and flakier
  than the e2e suite.

### Risks to manage
- **Flakiness pressure** — if spoken assertions get retried into meaninglessness, the tier loses
  its point. Keep the suite small: regressions and contract-level announcements, not a spoken
  mirror of every e2e test.
- **Phrasing drift** — VoiceOver wording changes across macOS versions. Substance-matching (see
  Decision) is the guard; a wording-only failure is a test bug, not a component bug.

### Non-goals
- Not a CI gate, and not portable to consumer projects the way the e2e suite is — the *tier* is
  the convention; the runner is an implementation detail of this repo.
- Not a replacement for manual passes: mobile screenreaders, forced-colors and every "is this
  noise?" question stay human.

## Reconsider when

- guidepup stops tracking macOS/VoiceOver releases, or Apple breaks AppleScript control — the
  tier survives, the runner is replaced.
- A Windows machine or VM enters the loop — add the NVDA lane then, same API.
- The suite's flake rate makes people ignore red — shrink it or demote it before that becomes
  normal.

## References

- PR #66 — the four naming fixes the tree audit found; their spoken verification is this tier's
  first test case
- `src/partials/components/RangeScale/RangeScale.ts` — the "drifted silently" comment that
  predicted the RangeField defect
- `docs/adr/TESTS.md` § 15 — the tier-routing test this ADR establishes
- guidepup: <https://github.com/guidepup/guidepup> · `@guidepup/playwright`
- ADR-0016 (live-region pattern), ADR-0009 (end-state contracts — the "proven failing first"
  discipline this tier inherits)

# ADR 0009: The end-state contract — specify the finished DOM, not where it's computed

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

_Backfilled — records the principle introduced with AffixField (gate passed 2026-07-06, PR #12)._

## Context

Most components in the repo carry behaviour (keyboard model, value logic, popovers), so
their contract is naturally "what the JS does". But some components have **no
interactivity** — AffixField only *computes attributes* (ids, ARIA wiring, presence
attributes, character counts), and every one of those is equally computable at render
time by a server (a Razor Tag Helper, a Vue render function). For such a component,
specifying "what the client JS does" would wrongly imply client JS is required, and would
make the contract fail a zero-JS server-rendered port that produces the identical DOM.

## Decision

For a component whose work is purely computing attributes, the contract specifies the
**finished DOM end-state**, not where that state is computed.

- The `.md` states the end-state as a table of "must be true" facts, with a "who
  typically computes it" column (reference JS at init · server stack: rendered in markup).
- **The reference JS is gap-filling, never overwriting:** if everything is already
  authored (as a server would render it), JS finds nothing to do. Authored values always
  win.
- **The e2e suite asserts the end-state, not the mechanism** — a server-rendered
  implementation with zero client JS passes the same Playwright suite. This extends the
  porting story from "port to another framework" to "port to another logic placement".
- The computation must be genuinely symmetric to qualify: reference JS and server compute
  the *same thing* at different times (e.g. `textContent.trim().length` ≡ `prefix.Length`).

## Considered alternatives

1. **Specify "what the client JS does" (the family default)** — Rejected for
   non-interactive components: implies client JS is mandatory and would fail an identical
   zero-JS server-rendered port.
2. **Ship two contracts (a JS one and a server one)** — Rejected: two sources of truth
   that drift; the DOM is the one thing both must agree on anyway.
3. **One end-state (finished-DOM) contract + gap-filling JS + DOM-asserting tests
   (chosen)** — Chosen: one contract both placements satisfy; the test suite proves it.

## Consequences

### Positive
- A component ports not just across frameworks but across *logic placement* (client vs
  server) with one contract and one test suite.
- Gap-filling JS is safe to run over server-rendered markup — authored values win.

### Costs
- Applies only where the computation is truly symmetric — misapplying it to a component
  with real client-only behaviour would be wrong.
- The `.md` must carry the end-state table and an honest "where the logic lives" section.

### Risks to manage
- Scope creep: an "end-state" component that quietly grows interactivity breaks the
  premise. Interactive affixes are AffixField's headline non-goal for exactly this reason.

## Reconsider when

- A future component is a candidate for this contract style — apply it only after
  confirming the computation is symmetric (no client-only behaviour), else use the
  behavioural contract.

## References

- `AffixField.md` → "The end-state contract (read this first)", "Where the logic lives"
- `PORTING.md` — the porting story this principle extends
- ADR-0002 (the `data-*` end-state facts this contract enumerates)

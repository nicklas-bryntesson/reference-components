# ADR 0001: Adopt an ADR ledger; component ideas are ADRs

**Status:** Accepted
**Date:** 2026-07-07
**Decider:** Nicklas Bryntesson

## Context

Direction-level decisions in this repo have been real and consequential — `data-*`
state as the public API, bounded CSS over mobile-first, extracting `src/kernel/`,
`:has()` as progressive-enhancement-only, the family-wide field-height contract, the
end-state contract behind AffixField — but they have lived only in commit messages,
`.claude/philosophy.md`, and the author's head. The *why* behind a contract is not
recoverable from the code once the author moves on, and a second port (Vue 3) already
proved that reconciling contracts requires knowing the reasoning, not just the shape.

The working docs we already have are deliberately ephemeral: `tasks/` and
`docs/superpowers/` are gitignored process artefacts. There was no tracked, durable
home for a decision — a snapshot you can loop back to, update the status of, or
supersede.

## Decision

1. **Decisions live in the repo as numbered ADRs** under `docs/adr/`, tracked in git,
   using `0000-adr-template.md`. An ADR is written once and never rewritten; revisiting
   a decision means writing a new ADR that supersedes the old one.
2. **Component ideas are ADRs.** A new component starts as a `Proposed` ADR before its
   `src/partials/components/<Name>/` directory exists. The ADR carries the scope
   boundary, non-goals, and kernel dependencies the eventual `.md` contract inherits;
   when the build starts the ADR flips to `Accepted` and the component's `.md` links
   back to it.
3. **ADRs complement, not duplicate, the contracts.** `philosophy.md` states the
   standing rules; each `<Name>.md` states how a component works; the ADR states *why*
   a decision was made and what would reopen it.

## Considered alternatives

1. **Keep decisions in commit messages and `philosophy.md`** — Rejected: commits are
   not discoverable as a set and can't carry considered-alternatives or a reconsider
   trigger; `philosophy.md` holds standing rules, not the dated reasoning behind a
   specific choice.
2. **Track decisions in the gitignored `tasks/` working docs** — Rejected: those are
   intentionally ephemeral and local; a decision record must be durable and shared.
3. **A ledger under `docs/adr/` + component ideas as ADRs (chosen)** — Chosen: durable,
   ordered, self-linking, and mirrors the ADR practice proven in a sibling project.
   The component-idea flavour gives every new component a recorded rationale from day
   one, at the cost of one short doc before building.

## Consequences

### Positive
- The reasoning behind every contract becomes recoverable and reviewable, which
  directly supports porting — the model this repo exists to serve.
- New components arrive with scope and non-goals decided up front, in the open.
- Superseding rather than editing keeps a truthful history of how the design evolved.

### Costs
- One short authoring step before a new component or direction change.
- A second place to keep honest: an accepted component ADR must be linked from its `.md`.

### Risks to manage
- ADR drift — decisions made without a record. Mitigated by the trigger list in
  `CLAUDE.md` and this directory's `README.md`.
- Over-use — writing ADRs for mechanical edits. The README scopes ADRs to *directions*,
  not renames, type annotations, or single bug fixes.

## Reconsider when

- The trigger list or component-idea flow needs to change shape (revise this ADR's
  successor, don't edit it), or a tool replaces hand-authored records.

## References

- `.claude/philosophy.md` — the standing rules ADRs are dated decisions against
- `CLAUDE.md` → "Decisions (ADRs)" — the write-an-ADR trigger
- `docs/adr/README.md` — how the ledger and component-idea ADRs work
- `.gitignore` — `tasks/` and `docs/superpowers/` are the ephemeral counterpart ADRs contrast with

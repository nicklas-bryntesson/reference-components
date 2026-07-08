# Architecture Decision Records

Every direction-changing decision in this repo lives here as a numbered, immutable
snapshot — so anyone (human or agent) can loop back to *why* something is the way it
is, not just *what* it is.

An ADR is written **once** and then never rewritten. When a decision is revisited, a
**new** ADR is written that supersedes the old one (`Status: Superseded by ADR-XXXX`),
and the old one stays as history. The record is a chain of snapshots, not a document
that gets edited. That chain is the point: the reasoning survives even after the code
moves on.

Unlike `tasks/` and `docs/superpowers/` (ephemeral, gitignored working docs), **ADRs
are tracked in git.** They are part of the contract set, like each component's `.md`.

## When to write one

Write an ADR when the change is a *direction*, not a mechanical edit:

- A **new component idea** earns a place in the library (see below).
- A repo-wide convention is set or broken (e.g. `data-*` state, bounded CSS, explicit `="true"`).
- A shared behaviour is promoted to `src/kernel/`, or a component stops composing one.
- A porting finding changes a contract family-wide.
- A cross-cutting default flips (field-height contract, native-fallback model, `:has()` as PE-only).

Do **not** write one for renames, type annotations, test additions, or a single
bug fix — those live in commit messages.

## Component ideas are ADRs

Each new component starts life as an ADR, *before* any `src/partials/components/<Name>/`
directory exists. The template's sections carry the same weight they do in a component
`.md` contract:

- **Context** — what porting/a11y problem this component answers; why it earns its own contract.
- **Decision** — it's in scope, and its scope boundary in one line.
- **Considered alternatives** — compose from an existing component? defer? leave to the consuming project? Say why not.
- **Consequences → Non-goals** — the explicit out-of-scope list the contract will inherit.
- **Consequences → Kernel dependencies** — what shared primitives it composes, or "none — self-contained".
- **Reconsider when** — the condition that would change or retire the component.

When the component is built, its `<Name>.md` links back to the ADR under a
`## Decision record` line, and the ADR moves from `Proposed` to `Accepted`. The ADR
holds the *why-we-built-it*; the `.md` holds the *how-it-works*.

## How to add one

1. Copy `0000-adr-template.md` to `NNNN-short-title.md` — next free number, kebab-case title.
2. Fill it in. Keep it tight; link out to contracts, kernel modules, PRs, and other ADRs rather than restating them.
3. Start at `Status: Proposed`; move to `Accepted` when the decision stands (for components: when the build starts).
4. Add a row to the index below.

## Index

| # | Title | Kind | Status |
|---|-------|------|--------|
| [0001](0001-adopt-adr-ledger.md) | Adopt an ADR ledger; component ideas are ADRs | Process | Accepted |
| [0002](0002-data-attributes-are-the-public-api.md) | `data-*` attributes are the component's public API | Architecture | Accepted |
| [0003](0003-bounded-css-over-mobile-first-cascade.md) | Bounded CSS — gate selectors over the mobile-first cascade | Architecture | Accepted |
| [0004](0004-clarity-over-dry-kernel-is-the-exception.md) | Clarity over DRY; `src/kernel/` is the single exception | Architecture | Accepted |
| [0005](0005-feature-detection-is-progressive-enhancement-only.md) | Feature detection is PE-only; `:has()` is never load-bearing | Architecture | Accepted |
| [0006](0006-native-control-fallback-on-coarse-pointers.md) | Custom controls fall back to the native control on coarse pointers | Architecture | Accepted |
| [0007](0007-popover-light-dismiss-never-refocuses-trigger.md) | Popover light-dismiss never refocuses the trigger | Architecture | Accepted |
| [0008](0008-family-wide-field-height-contract.md) | Family-wide field-height contract | Architecture | Accepted |
| [0009](0009-end-state-contract-specifies-dom-not-computation-site.md) | End-state contract — specify the finished DOM, not where it's computed | Architecture | Accepted |
| [0010](0010-decorative-motion-region-and-motion-policy-kernel.md) | A decorative motion region governed by a `motion-policy` kernel | Component | Proposed |

# ADR 0033: A part has two names — a class for styling, `data-part` for identity, and CSS never reads `data-part`

**Status:** Accepted
**Date:** 2026-09-06
**Decider:** Nicklas Bryntesson
**Supersedes in part:** ADR-0026 (its "lowercase-kebab element classes are removed, not
reduced" and "CSS may read `data-part`" clauses; its test — identity vs decoration — stands
and is made literal)

## Context

ADR-0026 moved part identity to `data-part` so that the conformance suite stops depending on class
names a consumer may rename, hash or hide. Its own test says *identity → `data-part`, decoration →
a class the consumer may delete*. Its decision text went further: every lowercase element class was
removed and the stylesheets were rewritten to key on `data-part`. The sweep (#78–#83) implemented
the decision text.

The result re-created the coupling the ADR set out to break, one level up. Appearance and
behaviour now share a single name again — `[data-part="popup"]` is what the stylesheet paints *and*
what the suite and the reference JS find — so nothing in the markup tells a reader which names are
load-bearing. Measured on `main` after the sweep: of 159 `data-part` values, 133 are found by a test
or by JS, 19 are referenced only by a stylesheet, 7 by nothing at all. A reader editing a component
cannot tell the three apart, and a class-era habit — a test reaching for whatever name is handy — is
now one attribute away from returning.

The library's whole proposition to a consumer is *restyle on the same DOM and the suite still
passes*. That promise is only checkable when the two concerns have two names.

## Decision

**Every part carries a lowercase-kebab class, and that class is for styling only. A part
additionally carries `data-part` if — and only if — a test, the reference JS or another component
has to find it. A stylesheet never selects on `data-part`.**

- **Class = appearance.** `.DateField .popup { … }`. The consuming project may rename, hash,
  replace with utilities or delete every one of these, and the suite still passes. Same lexicon as
  ADR-0019: `popup`, `trigger`, `rail`, `arrow`, `content`, `options`, `icon`, `title`, `hint`,
  `notice-region`; the utility-collision rule (`tests/utility-name-collisions.unit.test.ts`) applies
  to these names.
- **`data-part` = behaviour.** A part has it because something *finds* it: a Playwright locator, a
  `querySelector` in the reference JS, a composing component. Its presence in the markup is the
  readable signal "this name is load-bearing — renaming it breaks a test or the component". A
  `data-part` that nothing finds is dead and fails the guard.
- **CSS reads classes and state, never identity.** State and variant attributes stay CSS's per
  ADR-0002 — `data-open`, `data-invalid`, `data-direction`, `data-variant`, `data-active`,
  `data-test-state` — and so do the discriminators that say *which* of several same-kind parts an
  element is (`data-segment="hour"`, `data-panel="picker"`, `data-picker="month"`,
  `data-reference-layer`); those are axes with values, not names. `[data-part=…]` in a stylesheet is
  a guard failure.
- **Tests and JS never find by class.** Unchanged from ADR-0026, and now the guard's other half.
- **Every rule stays fully qualified from the root**, `.Component .part`, exactly as ADR-0019 says;
  the scoping argument is unchanged.
- **The `## Parts` table in each contract says who binds each part**: styled only, or found by the
  suite / by JS. That column is the human-readable form of what the guard enforces.

Three guards hold the line, all in `tests/`:

| Guard | Fails when |
|---|---|
| `part-identity` | a stylesheet contains `[data-part=`; a test or JS finds a part by class; a `data-part` in the markup is found by nothing |
| `utility-name-collisions` | a part class is a bare utility-framework word |
| `dead-attribute-selectors` | (unchanged) a stylesheet selects a `data-*` value nobody writes |

## Considered alternatives

1. **Keep one name, `data-part`, for both jobs (the state after #78–#83).** Rejected. It is what the
   sweep produced, and it makes the load-bearing set invisible: a reader has to grep the suite to
   learn whether renaming a part is safe. The swap map is true only in the trivial sense that
   there is nothing left to swap.
2. **One name, split by *which* parts get it** — `data-part` only on found parts, a class only on
   styled-only parts, and let CSS key on `data-part` for the found ones. Rejected. It is what
   ADR-0026's test literally says, and it still gives 133 of 159 parts a single shared name. The
   stylesheet would then depend on identity attributes that exist for the suite's sake, so a
   consumer restyling "on the same DOM" is restyling *our* attributes, not their own classes.
3. **Two names per part, CSS never reads `data-part` (chosen).** Costs one extra attribute on the
   ~140 found parts and a second word to keep in sync. Buys a markup you can read: a class is free
   to change, a `data-part` is a contract. Chosen because the separation is what makes the
   library's promise checkable rather than asserted.
4. **Encode the binding in the class name** (`.popup.is-found`, a `js-` prefix). Rejected. It is
   the two-name model with the second name hidden inside the first, and it survives a CSS-Modules
   hash or a shadow boundary exactly as badly as any class.

## Consequences

### Positive
- **The markup tells you the blast radius.** A class is appearance; `data-part` means a test or a
  script is holding on. No grep needed.
- **The swap map is true and *testable*.** Delete every class → the suite passes. Delete every
  `data-part` → the suite fails on exactly the parts it depends on. Both directions can be run.
- **Restyling touches nothing the suite reads.** A consumer's stylesheet, a CSS-Modules build or a
  utility port never has to reproduce an attribute.
- **Dead identity becomes visible.** The 7 `data-part` values nothing finds fail the guard the
  day this lands, and stay failed until they are removed or something needs them.

### Costs
- **A second sweep.** Every stylesheet goes back to class selectors; every part gets its class
  back; 26 `data-part` attributes are dropped. Mechanical, script-driven, verified with the same
  before/after computed-style probes as #78–#83.
- **Two names to keep in sync on ~140 parts.** The same word, twice, on one element. The guard
  catches a class without its `data-part` only indirectly (the test that needed it fails), so the
  `## Parts` table is what keeps the pair legible.
- **ADR-0026 has to be read together with this one.** Its test stands; its decision text is
  narrowed. This ADR exists because the two disagreed and the disagreement was resolved the
  wrong way in implementation.

### Risks to manage
- **A test reaching for a class again.** Guarded, and the failure names the class.
- **A part found only by CSS `:has()` or sibling combinators** — that is styling, not finding, and
  keys on the class. If a stylesheet needs a *state* it cannot get from a class, that state is a
  `data-*` attribute per ADR-0002, not a `data-part`.
- **Discriminator drift.** `data-segment`, `data-panel`, `data-picker` are *which*-attributes that
  CSS may read. If one of them starts being used as the *only* way a part is found, it is doing
  `data-part`'s job and the part should get a `data-part` too. The guard's "found by nothing" check
  does not see discriminators; the `## Parts` table has to.

## Reconsider when

- **`::part()` becomes the mechanism** for a shadow-DOM build of this library. Then `part` and
  `data-part` are redundant and the class/attribute split is worth re-deriving from that.
- **A consumer reports the two-name model as noise** rather than signal — the honest test is
  whether a port reads the `data-part` set as "the contract" or as clutter.
- **The guard's third check ("found by nothing") produces false positives** because a part is found
  through a discriminator only. Then the discriminator rule above needs to become mechanical.

## References

- **ADR-0026** — the test this makes literal, and the decision text this narrows
- **ADR-0019** — `PascalCase` component / lowercase part lexicon; the class half returns unchanged
- **ADR-0002** — `data-*` is the public API for *state*; this ADR keeps identity out of the
  stylesheet's reach and state within it
- PRs #78–#83 — the sweep whose end state this corrects; the measurement above is of `main` at #83
- `tests/part-identity.unit.test.ts`, `tests/utility-name-collisions.unit.test.ts`

## The test this establishes

For `docs/adr/TESTS.md`:

> **Who reads this name?**
> If a stylesheet reads it, it is a class. If a test, the reference JS or another component reads
> it, it is `data-part`. A part that both paint and find carries both — the same word twice — and
> the stylesheet still reads only the class. A `data-part` nothing finds is dead.

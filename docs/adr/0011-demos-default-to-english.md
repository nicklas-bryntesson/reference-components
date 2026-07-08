# ADR 0011: Demos default to English; localization is shown deliberately

**Status:** Accepted
**Date:** 2026-07-08
**Decider:** Nicklas Bryntesson

## Context

The repo's prose is English throughout — README, CLAUDE.md, the ADRs, every component
`.md` contract, and all code comments. But the **demo layer had drifted to Swedish**: the
kitchensink authored `data-locale="sv-SE"` as the default for the whole date/time family,
the page was `<html lang="sv">`, trigger `aria-label`s were hardcoded Swedish
("Öppna tidsväljare"), and AffixField (which is not even locale-aware) carried Swedish
labels and hints ("Belopp", "Antal timmar", "Anges exklusive moms."). This came from the
author's Swedish working context (SVL), not a decision.

Crucially, the drift is **only in the demo layer**. The components are correct: the
default locale is `en` (`translations[locale] ?? translations['en']`), with a real
`en.json` and bundled `en`/`sv` translations. Swedish is a legitimate, well-formed locale
— it was simply being shown as the *default*, which contradicts the repo's language.

## Decision

**The default demo language is English**, matching the components' own `en` default.

1. All *incidental* demo strings are English — AffixField labels/hints, hardcoded trigger
   labels, `<html lang>`, native-reference labels.
2. Locale-aware components (the date/time family) default their kitchensink instances to
   `data-locale="en"`, and **localization is demonstrated deliberately** via one explicit
   `data-locale="sv-SE"` variant per component — not by making Swedish the default.
3. The locale machinery is untouched: `en.json`, the bundled `sv` translations, and
   `data-locale` support all stay. Swedish remains a first-class *supported* locale; it is
   just no longer the *default demo*.

## Considered alternatives

1. **Leave Swedish as the demo default, document it as intentional** — Rejected: the
   inconsistency with an all-English repo is exactly the drift; documenting it doesn't
   remove the friction for anyone reading/porting.
2. **Remove Swedish entirely (all-English, no `sv`)** — Rejected: throws away a genuine
   feature demonstration. The date/time components exist partly to prove locale-awareness;
   hiding all non-English defeats that.
3. **English default + one explicit `sv-SE` showcase variant (chosen)** — Chosen:
   consistent with the repo and the component default, while still demonstrating the
   locale machinery on purpose rather than by accident.

## Consequences

### Positive
- The demo language matches the repo and the components' own default — no surprise.
- Localization is still visible, but as a deliberate showcase a reader can recognize.
- Removes a class of "why is this Swedish?" friction for anyone porting.

### Costs
- A demo-layer sweep across the generators, the regenerated `states/`, `index.html`, and
  the screen-reader checklists in the `.md`s.

### Risks to manage
- Recurrence: a new component authored in a Swedish context could reintroduce it. This ADR
  is the reference; new locale-aware components follow the English-default + one-variant pattern.

### Non-goals
- Removing or de-prioritizing Swedish as a *supported* locale. `sv` translations stay.
- Changing any component's default-locale logic (already `en`).

## Reconsider when

- The repo's documentation language itself changes (then the demo default follows it), or a
  localization-testing need calls for more than one non-English showcase variant.

## References

- Review finding (2026-07-08) — demo-language drift; component internals verified English-default
- `DateField.ts` (`translations[...] ?? translations['en']`), `DateField/locales/en.json`
- ADR-0002 (explicit end-state — the authored demo markup should read as the finished DOM)

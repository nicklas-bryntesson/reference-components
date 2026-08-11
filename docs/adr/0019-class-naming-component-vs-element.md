# ADR 0019: Class naming — PascalCase is a component (has a contract), lowercase-kebab is an internal element; one shared lexicon

**Status:** Accepted
**Date:** 2026-07-26
**Decider:** Nicklas Bryntesson

## Context

Root class names are PascalCase (`.DateField`), but sub-part naming had drifted with no
documented rule — three styles coexisted:

- bare PascalCase children (`.Segments`, `.Body`, `.Options`, `.Icon`),
- `Component-`prefixed children (`.AffixField-input`, `.AffixField-prefix` — a BEM-ish
  bastardisation),
- `Component-`prefixed **flat** selectors for popup parts (`.DateField-popup`,
  `.DateField-trigger`), plus case drift (`.slideContainer` camelCase, `.arrow` lowercase).

This repo is a **base library meant to be decoded into a consuming system** — the goal is the
smallest possible footprint and the clearest possible pattern, so a consumer can see the
structure at a glance and swap our classes for their own (e.g. Tailwind utilities) in one
pass. That needs **one** unified, documented rule, not three.

## Decision

Case carries meaning: **capital = a component, lowercase = an internal element.**

- **Components — `PascalCase`, no dash** (`.DateField`, `.Wheel`, `.ChoiceField`). This is
  the root *and* any nested/composed sub-component. **Litmus — is it a component?**
  *It has its own `.md` contract* (or is a kernel primitive with one). Binary, non-arbitrary.
- **Internal elements — `lowercase-kebab`** (`.calendar-header`, `.arrow`, `.content`,
  `.options`). No `Component-` prefix — the prefix is redundant once nested under the root,
  and it bloats the footprint. An element is any presentational part with **no** standalone
  contract.
- **Every rule is fully qualified from the root** — `.Component .element`, never a bare
  `.element` and never `&`-nested. The `.Component { }` block holds only tokens + the
  properties applied to the root itself; every part is its own flat, rooted rule:
  ```css
  .DateField { /* tokens + root props only */ }
  .DateField .segments {}
  .DateField[data-invalid="true"] .segments {}
  .DateField .popup [data-panel="picker"][data-active="true"] {}
  .DateField .Wheel {}   /* sub-component — still PascalCase */
  ```
  **Why flat, not nested:** a fully-qualified selector is deterministic to read — no `&` to
  resolve, no depth to track — which is the point for a consuming AI. A bare `.element {}` at
  column 0 is a scoping bug: generic names (`.popup`, `.grid`, `.panel`) leak across
  components; the `.Component` prefix is what makes bare element names safe.
- **Detached parts** — a part rendered *outside* the root (can't be a descendant) is the one
  exception: it gets a root-scoped `.Component-part` name. Rare; must be *genuinely* detached
  (portaled / top-layer). A JS-built descendant of the root is **not** detached.

### Shared lexicon (same kind of part → same word, across all components)

| Role | Class |
|---|---|
| Content region (not the label) | `.content` |
| A set of choices / items | `.options` |
| Popover panel | `.popup` |
| The control that opens it | `.trigger` |
| Positioning slide-rail | `.rail` |
| Decorative pointer | `.arrow` |
| Graphic · heading · helper text | `.icon` · `.title` · `.hint` |
| Live-region for a message | `.notice-region` |
| Generic layout/query box (rare) | `.container` |

`.container` is reserved for a genuinely role-less box (and doubles as a container-query
context); a part with a real role gets the role's name, not `.container` (so `.container`
never becomes the new catch-all "wrapper").

### The swap map (how a consumer decodes the library)

Three legible seams, by case + token namespace:

- **`PascalCase`** — component boundaries → map to your own components.
- **`lowercase-kebab`** — our internal element styling → replace with your utilities / CSS on
  the same DOM.
- **`--ui-*`** — design values (ADR-0018).

## Considered alternatives

1. **All sub-parts PascalCase** (bare, current-ish) — Rejected: over-signals "component" for
   plain elements; loses the component/element distinction the swap map depends on.
2. **`Component-`prefixed children** (`.AffixField-input`) — Rejected: verbose footprint; the
   prefix is redundant under a nested root; reads as BEM without being BEM.
3. **Case = component-vs-element via the `.md` litmus (chosen)** — one decidable rule, minimal
   footprint, and case itself documents the swap boundary.

## Consequences

### Positive
- One rule, decidable by a `.md` check; no per-part judgment to drift on.
- Smallest footprint (`.options`, not `.AffixField-options`) and a legible swap map.
- `grep .DateField` still finds the root + every sub-*component*; elements live nested in the
  one component `.css`, found by opening it.

### Costs
- A repo-wide class rename: CSS selectors, authored HTML, `generate.ts` emitters, JS
  `querySelector`/`classList`, and test locators all move together. The `querySelector`
  coupling is the "green tests, broken UI" risk class — swept component-by-component with the
  orphan-grep + computed-style + visual verification used for the token sweeps.

### Non-goals
- The rename itself is a mechanical follow-up, not this ADR.
- Parked legacy (Combobox, TabAccordion) excluded.

## Reconsider when

- A part with no `.md` genuinely behaves as a standalone, portable component — then give it a
  `.md` (promoting it to PascalCase), rather than bending the litmus.

## References

- ADR-0002 (`data-*` API — the sibling "no `Component--modifier`" rule),
  ADR-0017 (`--_` private component vars), ADR-0018 (`--ui-*` theming seam) — the other two
  legs of the consumer-facing seam
- `.claude/philosophy.md` — the "Class naming" section codifies this for day-to-day authoring

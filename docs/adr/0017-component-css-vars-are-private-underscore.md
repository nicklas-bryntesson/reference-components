# ADR 0017: Component-local CSS custom properties are private (`--_` prefix); the public theming seam is `--SITE--*` + `data-*`

**Status:** Accepted
**Date:** 2026-07-25
**Decider:** Nicklas Bryntesson

## Context

Custom-property naming had drifted. Early components marked component-internal variables
with a leading underscore (`--_af-*`); newer ones (ChoiceField `--cf-*`, ChoiceGroup
`--cg-*`, Notice `--nt-*`) dropped it, and DateTimeField mixes both (`--dtf-*` for most,
`--_dtf-*` for three arbitrary internals) with no clear rule.

Two facts settle the direction:

1. **Any variable set on a component is only overridable by selecting that component**
   (`.DateField { --x: … }`). So every component-local variable is inherently
   component-scoped — effectively private — and should be marked as such.
2. **The public theming seam is already `--SITE--*` + `data-*`.** The consuming site feeds
   the components through `--SITE--*` global tokens (it can map Tailwind / Bootstrap / its
   own tokens into them) and configures per-instance state through `data-*`. That seam is
   deliberately generic and unopinionated; we do **not** want a tiered constant/semantic
   token-reassignment factory in this repo — it would only complicate the consuming
   project's picture.

## Decision

- **All component-local custom properties are prefixed `--_<prefix>-*`** (e.g.
  `--_dtf-calendar-bg`, `--_nt-accent`). The `--_` marks "belongs to this component". It is
  a *convention marker*, not enforced privacy — you can still override one on the element if
  you must; it just signals that this is component-internal, not a global token.
- **The public theming surface is `--SITE--*` global tokens + `data-*` attributes.** A
  component-local variable that should be host-themable **reads** a `--SITE--*` token with a
  fallback default: `--_dtf-calendar-bg: var(--SITE--POPOVER--BG, #fff)`. Purely-internal
  values (spacing, derived `calc()`/`color-mix()`) are just `--_*` with a local default and
  read no token.
- **Variables set by JS follow the same prefix** (`--_df-popup-offset`, `--_af-input-chars`,
  …); the CSS declaration/usage and the `setProperty` call rename together, so they stay in
  sync.
- **`.md` contracts** list the `--_*` variables as component-internal and point at the
  `--SITE--*` tokens the component consumes as the intended theming surface. (A fuller
  rewrite of the theming docs pairs with the separate `--SITE--*` naming cleanup — see
  *Reconsider when*.)

## Considered alternatives

1. **Two-tier: public `--xx-*` + private `--_xx-*`** — Rejected. It implies some component
   variables are a public reach-in API. But any component variable is only overridable via
   the component selector, so the "public vs private" line inside the component is artificial
   here — and the repo already has `--SITE--*` as the genuine public seam. One rule (all
   component vars private) is clearer than two.
2. **No prefix (status quo drift)** — Rejected. No signal of scope; inconsistent across the
   set; nothing distinguishes a component's own var from a global token at a glance.
3. **A tiered `constant`/`semantic` token factory (the author's fuller system)** — Rejected
   *for this repo*. Powerful, but it pushes complexity onto the consuming project; the
   reference stays with a flat, generic `--SITE--*` seam.
4. **Blanket `--_` + `--SITE--*`/`data-*` public seam (chosen)** — one rule, clear scope
   signal, stable and portable public surface, components stay self-contained.

## Consequences

### Positive
- One rule across the set; a variable's scope is legible from its name.
- The public surface is the stable `--SITE--*` + `data-*` seam — portable across whatever
  token system the consuming project uses.
- Components stay self-contained (each uses only its own `--_<prefix>-*`; no cross-refs).

### Costs
- A repo-wide rename touching CSS, the popup-family JS (`setProperty`), one generator, one
  authored HTML demo, and the `.md` var tables.
- `.md` theming sections need at least a note reframe now, a fuller rewrite later.

### Scope
- **Parked legacy components are excluded** — Combobox (`--_component-*`, `--font-*`,
  `--form-*`) and TabAccordion are bordlagda references, not migration targets.
- **The `--SITE--*` token names are themselves inconsistent** (`--SITE--POPOVER--*` vs
  `--MAX--WIDTH--SITE`, `--MOBILE--BREAKPOINT`). Tidying those to a consistent `--SITE--*`
  scheme is a **separate** decision, not part of this sweep.

## Reconsider when

- A component genuinely needs a documented, reach-in public variable distinct from a
  `--SITE--*` token — then revisit whether a two-tier split is warranted for that case.
- The `--SITE--*` token naming is standardised — pair the fuller `.md` theming-doc rewrite
  with it.

## References

- ADR-0002 (`data-*` is the public API), ADR-0004 (clarity over DRY; components self-contained)
- `src/css/site/01-Setup/tokens.css` — the `--SITE--*` seam (simplified reference version)

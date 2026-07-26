# ADR 0018: The component theming seam is a flat `--ui-*` token namespace, decoupled from any design system

**Status:** Accepted
**Date:** 2026-07-26
**Decider:** Nicklas Bryntesson

## Context

ADR-0017 named `--SITE--*` + `data-*` as the public theming seam but left two problems:

1. **The `--SITE--POPOVER--*` group was a misnomer.** Fields read it for *general* roles —
   `--SITE--POPOVER--MUTED` for placeholder text, `--HOVER-BG` for field hover, `--BORDER--COLOR`
   for hairlines — so a text field was themed through "popover" tokens. And SCREAMING made
   them look like immutable constants when they were the consumable roles.
2. **More fundamentally:** this repo is a *portable reference*. Its components must **swallow
   design** from arbitrary consuming sites that almost certainly do **not** share the author's
   design system (which is complex, tiered constant→semantic, and still WIP in another
   project). Mirroring that DS's token factory here would couple the reference to one system
   and complicate every consumer.

The design goal: one small, generic, greppable seam that a consumer maps onto their own
tokens (Tailwind, shadcn, or bespoke) in a single pass.

## Decision

The component theming seam is a single, flat **`--ui-*`** custom-property namespace:

- **`01-Setup/ui-tokens.css`** holds the whole seam with neutral, standalone **defaults**
  (the reference looks right with nothing wired).
- Tokens are `--ui-<role>` — lowercase, single-dash, **role-named**. Roles are
  shadcn/Tailwind-flavoured (`-foreground` = the "on" colour) but named for clarity, not
  slavish parity. The set: `--ui-surface(-foreground)`, `--ui-surface-padding`, `--ui-radius`,
  `--ui-shadow`, `--ui-border`, `--ui-ring`, `--ui-primary(-foreground)`,
  `--ui-muted-foreground`, `--ui-hover`, and state colours `--ui-destructive` /
  `--ui-warning` / `--ui-success` / `--ui-info`.
- **One namespace** so a consumer can find-replace the whole seam against their system in one
  pass — `--ui-primary: var(--primary)`, etc. The `--ui-` prefix makes the seam a searchable,
  mappable *unit*.
- **State colours are unified**: field-invalid (`#c00`, 8 places) and Notice's error variant
  now both read `--ui-destructive`; the Notice states read `--ui-warning/success/info`.
- Components read `--ui-*` from their `--_*` internals (ADR-0017), each with a literal
  fallback, so a component still renders if the seam file is absent.

**Explicitly not adopted:** the author's tiered constant→semantic token factory (SCREAMING
constants fed through media queries into lowercase semantics). It is powerful but belongs to
the author's DS; a portable reference stays with the flat `--ui-*` seam. **Out of scope this
round:** the site *layout* scaffolding (`--SITE--PADDING`, `--MAX--WIDTH--*`, `--GRID--*`,
`grid-*.css`) — that is demo-page layout, not a component contract; its naming is a separate
cleanup.

## Considered alternatives

1. **Consistent `--SITE--*` two-tier mirroring the author's DS** — Rejected: couples the
   reference to one (complex, WIP) system consumers don't share; over-complicates the seam.
2. **Bare shadcn names (`--primary`, no prefix)** — Rejected: maximises free "swallow" for a
   shadcn consumer, but generic un-prefixed names risk collision and aren't greppable as a
   set. With a mapping step either way, the `--ui-` prefix's searchability wins.
3. **Flat `--ui-*` role namespace (chosen)** — one portable, greppable seam; consumer maps
   once; components stay self-contained; roles are honestly named (no "popover" misnomer).

## Consequences

### Positive
- One portable seam; a consumer wires their whole theme with a namespace find-replace.
- Honest role names — a field reads `--ui-muted-foreground`, not a "popover" token.
- Unified state colours (`--ui-destructive` shared by field-invalid + Notice).
- Neutral defaults keep the reference working standalone.

### Costs
- Remap of all component consumption + the `.md` "site tokens read" lists (done this round).

### Scope / follow-ups
- Layout scaffolding (`--SITE--*` layout constants + `grid-*.css`) untouched — separate round.
- `--ui-ring` ships in the contract though focus currently uses `outline`/`currentColor`; it
  is there for consumers who want to theme the ring.

## Reconsider when

- A component needs a role not in the `--ui-*` set — add it to `ui-tokens.css`, don't reach
  past the seam.
- The layout scaffolding gets the same normalisation — decide then whether it also moves to a
  `--ui-*`-style seam or keeps its own.

## References

- ADR-0002 (`data-*` API), ADR-0004 (self-contained components),
  ADR-0017 (component-local `--_*` are private; this refines that ADR's "public seam" from
  `--SITE--*` to `--ui-*`)
- `src/css/site/01-Setup/ui-tokens.css` — the seam
- shadcn/ui + Tailwind CSS custom-property conventions (naming inspiration)

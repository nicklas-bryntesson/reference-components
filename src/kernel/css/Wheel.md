# Wheel.css (kernel / CSS primitive)

The visual half of the wheel primitive. [`WheelColumn.ts`](../js/WheelColumn.md) injects the
structure; this stylesheet gives it the 3D cylinder, the fade mask, and the centre band. **They are a
pair** — shipping `WheelColumn` without `Wheel.css` renders the options as overlapping, unstyled text
*and* fails colour-contrast (this was the original port's hardest-to-find bug, caught only by axe).

## Class contract

| Class | Authored / injected | Role |
|-------|--------------------|------|
| `.Wheel` | **authored** (host) | sizing, perspective, overflow clip, focus ring |
| `.Wheel-ring` | injected by JS | the rotating 3D ring |
| `.Wheel-option` | injected by JS | one row; `[aria-selected="true"]` is the centred value |
| `.Wheel-band` | injected by JS | per-column highlight band — currently **hidden** (`display: none`); superseded by `.WheelColumns::before` |
| `.WheelColumns` | **authored** (wrapper around the `.Wheel` columns) | draws the visible full-width centre band (`::before`) and top/bottom fade (`::after`); declares its own `--_wheel-row-height: 38px` that must stay in sync with `.Wheel`'s |

A port that follows this table must end up with both the centre band and the fade — they live on the
authored `.WheelColumns` wrapper (present in all four consuming components' canonical markup), not on
`.Wheel` or the injected `.Wheel-band`.

## Tokens

- `--_wheel-row-height` (default `38px`) — **read back by `WheelColumn.ts`** (`readRowHeight`) to size
  the geometry. Changing it in CSS changes the JS maths; keep them in sync.
- `--_wheel-rows` (default `5`) — visible row count → wheel height.
- `--_wheel-color`, `--_wheel-color-selected` — derived from the site popover
  tokens (`--SITE--POPOVER--COLOR`, `--SITE--POPOVER--ACCENT`). See each
  consuming component's `## Required site tokens`.

## Conformance

Visual/axe is **deferred** alongside WheelColumn; today it is validated indirectly by the picker/axe
assertions in the DateField/DateTimeField/TimeField e2e suites. Used by: DateField, DateTimeField,
TimeField, MonthField.

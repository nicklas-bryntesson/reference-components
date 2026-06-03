# Wheel.css (kernel / CSS primitive)

The visual half of the wheel primitive. [`WheelColumn.ts`](../js/WheelColumn.md) injects the
structure; this stylesheet gives it the 3D cylinder, the fade mask, and the centre band. **They are a
pair** — shipping `WheelColumn` without `Wheel.css` renders the options as overlapping, unstyled text
*and* fails colour-contrast (this was the original port's hardest-to-find bug, caught only by axe).

## Class contract

| Class | Authored / injected | Role |
|-------|--------------------|------|
| `.Wheel` | **authored** (host) | sizing, perspective, overflow clip, fade mask, focus ring |
| `.Wheel-ring` | injected by JS | the rotating 3D ring |
| `.Wheel-option` | injected by JS | one row; `[aria-selected="true"]` is the centred value |
| `.Wheel-band` | injected by JS | the centre highlight band |

## Tokens

- `--wheel-row-height` (default `38px`) — **read back by `WheelColumn.ts`** (`readRowHeight`) to size
  the geometry. Changing it in CSS changes the JS maths; keep them in sync.
- `--wheel-rows` (default `5`) — visible row count → wheel height.
- `--wheel-focus-bg`, `--wheel-color`, `--wheel-color-selected` — derived from the site popover
  tokens (`--SITE--POPOVER--HOVER-BG`, `--SITE--POPOVER--COLOR`, `--SITE--POPOVER--ACCENT`). See each
  consuming component's `## Required site tokens`.

## Conformance

Visual/axe is **deferred** alongside WheelColumn; today it is validated indirectly by the picker/axe
assertions in the DateField/DateTimeField/TimeField e2e suites. Used by: DateField, DateTimeField,
TimeField.

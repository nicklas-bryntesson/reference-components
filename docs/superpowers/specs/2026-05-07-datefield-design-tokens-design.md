# DateField Design Token API

**Date:** 2026-05-07
**Status:** Approved

## Problem

`DateField.css` has hardcoded hex values throughout (`#333`, `#f8f8f8`, `#c00`, `#6e6e6e`, etc). External styling currently requires knowing internal class names (`.DateFieldCalendar`, `.arrow`) and overriding them directly — as `demo.css` does today.

`demo.css` is also in a broken state:
- Defines variables (`--_df_calendar-surface-primary` etc) that are never consumed by `DateField.css`
- Sets `--_df-surface-color: transparent` making the arrow invisible
- Duplicates the full arrow CSS block (unnecessary)
- Uses `filter: drop-shadow()` directly on `.DateFieldCalendar` instead of via a token

## Goal

Expose a flat public token API on `.DateField` so design can be injected entirely from the outside — no knowledge of internal class names required. All hardcoded values become token fallbacks.

## Scope

DateField only. Token naming conventions across multiple field components (DateField, WeekField, TimeField) will be established when a second field component exists.

## Token API

All tokens are declared with defaults in `.DateField`. They are split into two logical groups, both on the root element.

### Segments (input field)

| Token | Default | Used for |
|---|---|---|
| `--df-segments-border-color` | `currentColor` | Default border |
| `--df-segments-border-color-hover` | `#333` | Hover border |
| `--df-segments-bg-hover` | `#f8f8f8` | Hover background |
| `--df-segments-border-color-invalid` | `#c00` | Invalid border |
| `--df-segments-color-muted` | `#6e6e6e` | Placeholder segments, separator |
| `--df-trigger-bg-hover` | `#f0f0f0` | Calendar trigger button hover |
| `--df-trigger-bg-active` | `#e0e0e0` | Calendar trigger button active |

### Calendar (popup surface)

| Token | Default | Used for |
|---|---|---|
| `--df-calendar-bg` | `Canvas` | Calendar background + arrow background |
| `--df-calendar-color` | `CanvasText` | Primary text |
| `--df-calendar-color-muted` | `#6e6e6e` | Weekday headers, outside-month days |
| `--df-calendar-border-color` | `currentColor` | Calendar border |
| `--df-calendar-radius` | `4px` | Calendar border-radius |
| `--df-calendar-shadow` | `drop-shadow(0 4px 12px rgba(0,0,0,0.15))` | filter drop-shadow value |
| `--df-calendar-backdrop` | `none` | backdrop-filter value |

### Arrow

The arrow uses `--df-calendar-bg` directly — no separate token. This ensures the arrow always matches the calendar surface without extra setup.

The internal `--_df-surface-color` is removed.

## Changes to DateField.css

1. Declare all `--df-*` tokens with fallbacks in `.DateField` block
2. Replace hardcoded hex values with token references throughout
3. `.DateFieldCalendar`: replace `box-shadow` with `filter: var(--df-calendar-shadow)` and add `backdrop-filter: var(--df-calendar-backdrop)`; preserve `will-change: filter`
4. `.DateFieldCalendar`: use `--df-calendar-bg`, `--df-calendar-color`, `--df-calendar-radius`, `--df-calendar-border-color`
5. `.arrow`: change `background-color` from `var(--_df-surface-color)` to `var(--df-calendar-bg)`
6. Remove `--_df-surface-color` declaration

## Changes to demo.css

After the token API is in place, `demo.css` only needs token assignments on `.DateField`:

```css
.DateField {
  --df-calendar-bg: rgba(255, 255, 255, 0.8);
  --df-calendar-radius: 1rem;
  --df-calendar-backdrop: blur(4px);
  --df-calendar-shadow:
    drop-shadow(0px 0px 2px rgba(3, 7, 18, 0.04))
    drop-shadow(0px 2px 6px rgba(3, 7, 18, 0.08))
    drop-shadow(0px 4px 14px rgba(3, 7, 18, 0.12))
    drop-shadow(0px 8px 25px rgba(3, 7, 18, 0.17))
    drop-shadow(0px 12px 39px rgba(3, 7, 18, 0.21))
    drop-shadow(0px 17px 56px rgba(3, 7, 18, 0.25))
    drop-shadow(0px 23px 77px rgba(3, 7, 18, 0.29))
    drop-shadow(0px 30px 100px rgba(3, 7, 18, 0.33));
}
```

All other `.DateFieldCalendar` and `.arrow` blocks in `demo.css` are removed.

The unused `--_df-calendar-dropshadow` variable and the duplicate `--_df-arrow-size` / `--_df-arrow-corner-radius` declarations in `demo.css` are also removed.

## Non-goals

- No global token fallback chains (e.g. `var(--surface-overlay, Canvas)`) — added later if a project needs it
- No split into separate CSS files per layer — premature until a second field component exists
- No tokens for spacing/sizing internals (grid cell size, header padding) — not a design injection concern

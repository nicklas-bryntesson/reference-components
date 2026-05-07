# DateField Design Token API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a flat `--df-*` CSS custom property API on `.DateField` so design can be injected entirely from outside without knowledge of internal class names.

**Architecture:** All hardcoded hex values in `DateField.css` become token fallbacks. `demo.css` is stripped of class-level overrides and replaced with token assignments on `.DateField` only. Arrow is fixed to use `--df-calendar-bg` (was transparent/broken).

**Tech Stack:** CSS custom properties, PostCSS nesting, Vite

**Spec:** `docs/superpowers/specs/2026-05-07-datefield-design-tokens-design.md`

---

## Files

- Modify: `src/partials/components/DateField/DateField.css`
- Modify: `src/css/site/demo.css`

---

### Task 1: Add token declarations to `.DateField` base rule

**Files:**
- Modify: `src/partials/components/DateField/DateField.css`

- [ ] **Replace the current `/* Public API */` + `/* Internal */` block in `.DateField { }` (lines 5–14) with the full token set:**

```css
/* Public API */
--df-calendar-width: 18rem;
--df-calendar-gap: 1.5rem;
--df-site-max-width: var(--MAX--WIDTH--SITE, 100rem);
--df-site-padding: var(--SITE--PADDING, 1rem);
/* Design tokens — segments */
--df-segments-border-color: currentColor;
--df-segments-border-color-hover: #333;
--df-segments-bg-hover: #f8f8f8;
--df-segments-border-color-invalid: #c00;
--df-segments-color-muted: #6e6e6e;
--df-trigger-bg-hover: #f0f0f0;
--df-trigger-bg-active: #e0e0e0;
/* Design tokens — calendar */
--df-calendar-bg: Canvas;
--df-calendar-color: CanvasText;
--df-calendar-color-muted: #6e6e6e;
--df-calendar-border-color: currentColor;
--df-calendar-radius: 4px;
--df-calendar-shadow: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
--df-calendar-backdrop: none;
/* Internal */
--_df-rail-max-width: calc(var(--df-site-max-width) + var(--df-calendar-width));
--_df-arrow-size: 0.75rem;
--_df-arrow-corner-radius: 0.25rem;
```

Note: `--_df-surface-color: white` is removed — it is replaced by `--df-calendar-bg`.

- [ ] **Commit:**
```bash
git add src/partials/components/DateField/DateField.css
git commit -m "feat(DateField): declare public --df-* design token API"
```

---

### Task 2: Replace hardcoded values in Segments and Trigger with tokens

**Files:**
- Modify: `src/partials/components/DateField/DateField.css`

- [ ] **Wire default Segments border to token:**

Find:
```css
  & .Segments {
    display: inline-flex;
    align-items: center;
    border: 1px solid;
```
Replace with:
```css
  & .Segments {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--df-segments-border-color);
```

- [ ] **Replace `.Segment[data-placeholder]` color:**

Find:
```css
    &[data-placeholder] {
      color: #6e6e6e;
    }
```
Replace with:
```css
    &[data-placeholder] {
      color: var(--df-segments-color-muted);
    }
```

- [ ] **Replace Segments hover state:**

Find:
```css
  & .Segments:hover,
  &[data-test-state="hover"] .Segments {
    border-color: #333;
    background-color: #f8f8f8;
  }
```
Replace with:
```css
  & .Segments:hover,
  &[data-test-state="hover"] .Segments {
    border-color: var(--df-segments-border-color-hover);
    background-color: var(--df-segments-bg-hover);
  }
```

- [ ] **Replace invalid border:**

Find:
```css
  &[data-invalid] .Segments {
    border-color: #c00;
  }
```
Replace with:
```css
  &[data-invalid] .Segments {
    border-color: var(--df-segments-border-color-invalid);
  }
```

- [ ] **Replace Trigger hover/active:**

Find:
```css
    &:hover,
    .DateField[data-test-state="hover"] & {
      background-color: #f0f0f0;
    }

    &:active,
    .DateField[data-test-state="active"] & {
      background-color: #e0e0e0;
    }
```
Replace with:
```css
    &:hover,
    .DateField[data-test-state="hover"] & {
      background-color: var(--df-trigger-bg-hover);
    }

    &:active,
    .DateField[data-test-state="active"] & {
      background-color: var(--df-trigger-bg-active);
    }
```

- [ ] **Commit:**
```bash
git add src/partials/components/DateField/DateField.css
git commit -m "feat(DateField): use design tokens in Segments and Trigger"
```

---

### Task 3: Update `.DateFieldCalendar` to use tokens

**Files:**
- Modify: `src/partials/components/DateField/DateField.css`

- [ ] **Replace the standalone `.DateFieldCalendar` opening properties (lines 149–158):**

Find:
```css
.DateFieldCalendar {
  position: absolute;
  background: Canvas;
  color: CanvasText;
  border: 1px solid;
  padding: 0.75rem;
  z-index: 100;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
```
Replace with:
```css
.DateFieldCalendar {
  position: absolute;
  background: var(--df-calendar-bg);
  color: var(--df-calendar-color);
  border: 1px solid var(--df-calendar-border-color);
  padding: 0.75rem;
  z-index: 100;
  border-radius: var(--df-calendar-radius);
  filter: var(--df-calendar-shadow);
  backdrop-filter: var(--df-calendar-backdrop);
```

- [ ] **Replace Grid weekday header color:**

Find:
```css
    & th {
      border: 0;
      padding: 0;
      padding-block-end: 0.25rem;
      text-align: center;
      font-weight: normal;
      color: #6e6e6e;
      min-inline-size: 2rem;
    }
```
Replace with:
```css
    & th {
      border: 0;
      padding: 0;
      padding-block-end: 0.25rem;
      text-align: center;
      font-weight: normal;
      color: var(--df-calendar-color-muted);
      min-inline-size: 2rem;
    }
```

- [ ] **Replace outside-month day color:**

Find:
```css
    & td[data-outside-month] button {
      color: #6e6e6e;
    }
```
Replace with:
```css
    & td[data-outside-month] button {
      color: var(--df-calendar-color-muted);
    }
```

- [ ] **Clean up `.DateField .DateFieldCalendar` overrides — `box-shadow: none` is no longer needed; keep `will-change: filter`:**

Find:
```css
.DateField .DateFieldCalendar {
  position: absolute;
  left: var(--df-popup-offset, 50%);
  transform: translateX(-50%);
  inline-size: var(--df-calendar-width);
  pointer-events: auto;
  box-shadow: none;
  will-change: filter;

}
```
Replace with:
```css
.DateField .DateFieldCalendar {
  position: absolute;
  left: var(--df-popup-offset, 50%);
  transform: translateX(-50%);
  inline-size: var(--df-calendar-width);
  pointer-events: auto;
  will-change: filter;
}
```

- [ ] **Commit:**
```bash
git add src/partials/components/DateField/DateField.css
git commit -m "feat(DateField): use design tokens in DateFieldCalendar"
```

---

### Task 4: Fix arrow to use `--df-calendar-bg`

**Files:**
- Modify: `src/partials/components/DateField/DateField.css`

- [ ] **Replace arrow background:**

Find:
```css
.DateField .arrow {
  position: absolute;
  width: var(--_df-arrow-size);
  height: var(--_df-arrow-size);
  background-color: var(--_df-surface-color);
  left: 50%;
}
```
Replace with:
```css
.DateField .arrow {
  position: absolute;
  width: var(--_df-arrow-size);
  height: var(--_df-arrow-size);
  background-color: var(--df-calendar-bg);
  left: 50%;
}
```

- [ ] **Verify file: grep for `--_df-surface-color` — should return nothing:**
```bash
grep -n "_df-surface-color" src/partials/components/DateField/DateField.css
```
Expected: no output.

- [ ] **Commit:**
```bash
git add src/partials/components/DateField/DateField.css
git commit -m "fix(DateField): arrow uses --df-calendar-bg, remove --_df-surface-color"
```

---

### Task 5: Rewrite `demo.css` to use token API only

**Files:**
- Modify: `src/css/site/demo.css`

The current `demo.css` mixes: unused variables, internal prop overrides, duplicate arrow CSS, and direct `.DateFieldCalendar` class overrides. Replace the entire file content with a clean token injection on `.DateField` only.

- [ ] **Replace the full content of `demo.css` with:**

```css
.DateField {
  /* https://smoothshadows.com/#djEsMSw5LDAuMDUsODQsMjIsMCwjMDMwNzEyLCNmM2Y0ZjYsI2ZmZmZmZiwy */
  --df-calendar-bg: rgba(255, 255, 255, 0.8);
  --df-calendar-radius: 1rem;
  --df-calendar-backdrop: blur(4px);
  --df-calendar-shadow:
    drop-shadow(0px 0px 1px rgba(3, 7, 18, 0.01))
    drop-shadow(0px 1px 4px rgba(3, 7, 18, 0.01))
    drop-shadow(0px 2px 9px rgba(3, 7, 18, 0.02))
    drop-shadow(0px 4px 17px rgba(3, 7, 18, 0.02))
    drop-shadow(0px 7px 26px rgba(3, 7, 18, 0.03))
    drop-shadow(0px 10px 37px rgba(3, 7, 18, 0.03))
    drop-shadow(0px 13px 51px rgba(3, 7, 18, 0.04))
    drop-shadow(0px 17px 66px rgba(3, 7, 18, 0.04))
    drop-shadow(0px 22px 84px rgba(3, 7, 18, 0.05));
}
```

- [ ] **Commit:**
```bash
git add src/css/site/demo.css
git commit -m "refactor(demo): replace class overrides with --df-* token injection"
```

---

### Task 6: Verify

- [ ] **Run unit tests:**
```bash
npm run test:unit
```
Expected: all pass.

- [ ] **Start dev server and open DateField in browser:**
```bash
npm run dev
```
Open `http://localhost:5173` (or whichever port Vite uses), navigate to DateField. Verify:
- Calendar popup opens with frosted glass surface, rounded corners, subtle shadow
- Arrow matches calendar surface colour (not transparent, not solid white)
- Hover/focus/invalid states on segments still work
- Trigger button hover/active states still work

- [ ] **Run e2e tests:**
```bash
npm run test:e2e
```
Expected: all pass.

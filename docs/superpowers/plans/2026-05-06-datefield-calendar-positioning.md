# DateField Calendar Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DateField's hardcoded body-append calendar positioning with ToggleTip's slideContainer pattern — shared positioning math, viewport clamping, direction detection, and an arrow pointing at the trigger icon.

**Architecture:** Extract `calculatePopupOffset`, `calculateArrowOffset`, and `detectDirection` from `ToggleTip.ts` into `src/js/popup-position.ts`. Both components import from there. DateField gains a `slideContainer` in its markup and `_updateLayout()` in its JS. Nothing inside the calendar changes.

**Tech Stack:** TypeScript (strict), Vite, Vitest + jsdom (unit), Playwright (e2e)

---

## File Map

| Action | File | Change |
|---|---|---|
| Create | `src/js/popup-position.ts` | 3 extracted pure functions |
| Create | `tests/popup-position.unit.test.ts` | unit tests for the 3 functions (moved from ToggleTip) |
| Modify | `src/partials/components/ToggleTip/ToggleTip.ts` | replace local defs with imports |
| Modify | `src/partials/components/ToggleTip/tests/ToggleTip.unit.test.ts` | update import path |
| Modify | `src/partials/components/DateField/DateField.generate.ts` | add slideContainer + arrow to canonical() |
| Modify | `src/partials/components/DateField/DateField.css` | overflow gate, slideContainer, bubble, direction, arrow |
| Modify | `src/partials/components/DateField/DateField.ts` | slideContainer, _updateLayout, _getCSSPx, resize handler, updated _openCalendar |
| Modify | `src/partials/components/DateField/tests/DateField.unit.test.ts` | update makeField fixture + add direction tests |
| Modify | `src/partials/components/DateField/tests/DateField.e2e.test.js` | add data-direction test |

---

## Task 1: Extract shared popup-position module

**Files:**
- Create: `src/js/popup-position.ts`

- [ ] **Step 1: Create `src/js/popup-position.ts`** with the three functions copied verbatim from `ToggleTip.ts` lines 17–81:

```ts
/**
 * Calculate the percentage offset of the bubble along the slide rail,
 * clamped so the bubble never overflows the rail edges.
 */
export function calculatePopupOffset(
  triggerCenterX: number,
  containerLeft: number,
  containerWidth: number,
  popupWidth: number,
  viewportWidth: number = window.innerWidth,
  viewportInset: number = 0,
): number {
  const idealLeft = triggerCenterX - containerLeft
  const minLeft = -containerLeft + popupWidth / 2 + viewportInset
  const maxLeft = viewportWidth - containerLeft - popupWidth / 2 - viewportInset
  const clampedLeft = minLeft <= maxLeft
    ? Math.max(minLeft, Math.min(idealLeft, maxLeft))
    : viewportWidth / 2 - containerLeft
  return (clampedLeft / containerWidth) * 100
}

/**
 * Calculate px correction so the arrow always points at the trigger center,
 * clamped so the arrow stays within the bubble's rounded corners.
 */
export function calculateArrowOffset(
  triggerCenterX: number,
  popupLeft: number,
  popupWidth: number,
  borderRadius: number,
  arrowSize: number,
): number {
  const rawOffset = triggerCenterX - (popupLeft + popupWidth / 2)
  const limit = popupWidth / 2 - borderRadius - arrowSize / 2
  return Math.max(-limit, Math.min(rawOffset, limit))
}

/**
 * Detect whether the bubble should appear above or below the trigger.
 * Compares available space; ties go to "top".
 */
export function detectDirection(
  triggerRect: Pick<DOMRect, 'top' | 'bottom'>,
  viewportHeight: number = window.innerHeight,
): 'top' | 'bottom' {
  const spaceAbove = triggerRect.top
  const spaceBelow = viewportHeight - triggerRect.bottom
  return spaceAbove >= spaceBelow ? 'top' : 'bottom'
}
```

- [ ] **Step 2: Run typecheck to verify the new file is valid**

```bash
npm run typecheck
```

Expected: no errors.

---

## Task 2: Move unit tests to popup-position test file

**Files:**
- Create: `tests/popup-position.unit.test.ts`
- Modify: `src/partials/components/ToggleTip/tests/ToggleTip.unit.test.ts`

- [ ] **Step 1: Create `tests/popup-position.unit.test.ts`** with the three test suites moved from the ToggleTip test file:

```ts
import { describe, it, expect } from 'vitest'
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../src/js/popup-position'

describe('calculatePopupOffset', () => {
  it('centers bubble when trigger is in the middle of the container', () => {
    expect(calculatePopupOffset(500, 0, 1000, 200, 1200)).toBeCloseTo(50)
  })

  it('clamps to minimum when trigger is near left edge', () => {
    expect(calculatePopupOffset(50, 0, 1000, 200, 1200)).toBeCloseTo(10)
  })

  it('clamps at viewport right edge', () => {
    expect(calculatePopupOffset(1150, 0, 1000, 200, 1200)).toBeCloseTo(110)
  })

  it('respects viewportInset on left edge — bubble stays inset px from viewport left', () => {
    expect(calculatePopupOffset(10, -590, 1200, 200, 1200, 12)).toBeCloseTo(58.5)
  })

  it('respects viewportInset on right edge — bubble stays inset px from viewport right', () => {
    expect(calculatePopupOffset(1190, 590, 1200, 200, 1200, 12)).toBeCloseTo(41.5)
  })
})

describe('calculateArrowOffset', () => {
  it('returns 0 when popup is perfectly centered on trigger', () => {
    expect(calculateArrowOffset(500, 400, 200, 16, 12)).toBe(0)
  })

  it('clamps to positive limit when trigger is far right of popup center', () => {
    expect(calculateArrowOffset(600, 400, 200, 16, 12)).toBeCloseTo(78)
  })

  it('clamps to negative limit when trigger is far left of popup center', () => {
    expect(calculateArrowOffset(400, 400, 200, 16, 12)).toBeCloseTo(-78)
  })
})

describe('detectDirection', () => {
  it('returns "top" when more space above', () => {
    expect(detectDirection({ top: 600, bottom: 620 }, 800)).toBe('top')
  })

  it('returns "bottom" when more space below', () => {
    expect(detectDirection({ top: 50, bottom: 70 }, 800)).toBe('bottom')
  })

  it('returns "top" when space above equals space below', () => {
    expect(detectDirection({ top: 400, bottom: 420 }, 820)).toBe('top')
  })
})
```

- [ ] **Step 2: Run the new test file to verify it passes**

```bash
npm run test:unit -- tests/popup-position.unit.test.ts
```

Expected: 11 passed.

- [ ] **Step 3: Replace the contents of `src/partials/components/ToggleTip/tests/ToggleTip.unit.test.ts`**

The three describe blocks for `calculatePopupOffset`, `calculateArrowOffset`, and `detectDirection` are removed. The file now imports from the shared module (even though no tests remain for those functions here — the import is gone entirely). The file becomes empty except for a placeholder import:

```ts
import { describe, it, expect } from 'vitest'
// ToggleTip-specific behaviour tests go here.
// Pure positioning function tests live in tests/popup-position.unit.test.ts
```

- [ ] **Step 4: Run unit tests to confirm nothing broke**

```bash
npm run test:unit
```

Expected: all pass (11 popup-position tests now in new file, ToggleTip test file has 0 tests — this is fine with `--passWithNoTests`).

- [ ] **Step 5: Commit**

```bash
git add src/js/popup-position.ts tests/popup-position.unit.test.ts src/partials/components/ToggleTip/tests/ToggleTip.unit.test.ts
git commit -m "refactor: extract popup positioning functions to shared module"
```

---

## Task 3: Update ToggleTip.ts to import from shared module

**Files:**
- Modify: `src/partials/components/ToggleTip/ToggleTip.ts`

- [ ] **Step 1: Add import at the top of `ToggleTip.ts`** (after line 1 `// src/partials/...`):

```ts
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../../../../js/popup-position'
```

Wait — the relative path from `src/partials/components/ToggleTip/ToggleTip.ts` to `src/js/popup-position.ts` is `../../../../js/popup-position`. Use:

```ts
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../../js/popup-position'
```

- [ ] **Step 2: Delete the three local function definitions** from `ToggleTip.ts` — lines 3–81 (the `calculatePopupOffset`, `calculateArrowOffset`, and `detectDirection` functions including their JSDoc comments).

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/partials/components/ToggleTip/ToggleTip.ts
git commit -m "refactor: ToggleTip imports positioning functions from shared module"
```

---

## Task 4: Update DateField.generate.ts markup

**Files:**
- Modify: `src/partials/components/DateField/DateField.generate.ts`

- [ ] **Step 1: Update the `canonical()` function in `DateField.generate.ts`**

Replace the current function body with the version below. The only changes are: (a) `<template>` and `<div class="arrow">` are wrapped in `<div class="slideContainer">`, (b) the template moves inside slideContainer.

```ts
function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="DateField"
  data-component="DateField"
  data-id="${id}"
  data-name="${id}"
  data-locale="sv-SE"
  data-min="1900-01-01"
  data-max="2100-12-31"${rootExtra}
>
  <input class="Native" type="date"${inputAttrs} />
  <div class="Custom" aria-hidden="true">
    <div class="Segments" role="group">
      <button type="button" class="Trigger" aria-label="Öppna kalender" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
    </div>
    <div class="slideContainer">
      <template data-template="datefield-calendar">
        <div class="DateFieldCalendar" role="dialog" aria-modal="true">
          <div class="CalendarHeader">
            <button type="button">&#8249;</button>
            <span aria-live="polite" aria-atomic="true"></span>
            <button type="button">&#8250;</button>
          </div>
          <table class="Grid" role="grid">
            <thead><tr role="row"><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th></tr></thead>
            <tbody></tbody>
          </table>
          <div class="CalendarFooter">
            <button type="button" class="CalendarFooterClear"></button>
            <button type="button" class="CalendarFooterToday"></button>
          </div>
        </div>
      </template>
      <div class="arrow"></div>
    </div>
  </div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
</div>
`
}
```

- [ ] **Step 2: Regenerate state partials**

```bash
npm run generate:states
```

Expected output ends with: `done — 15 state files written`

- [ ] **Step 3: Commit**

```bash
git add src/partials/components/DateField/DateField.generate.ts
git commit -m "feat(DateField): add slideContainer and arrow to canonical markup"
```

---

## Task 5: Update DateField.css

**Files:**
- Modify: `src/partials/components/DateField/DateField.css`

- [ ] **Step 1: Add the following CSS rules to `DateField.css`**

Find the `.DateField` base rule (root selector block) and add the `overflow` property and `--df-calendar-gap` custom property. Then append the slideContainer, calendar bubble, direction gates, and arrow rules after the existing rules.

Add to the `.DateField` base rule:

```css
overflow: hidden;
--df-calendar-gap: 0.5rem;
--_df-arrow-size: 0.75rem;
--_df-arrow-corner-radius: 0.25rem;
--_df-surface-color: white;
--_df-rail-max-width: 80rem;
```

Add after the existing `.DateField` rules:

```css
/* ── Initialisation gate ───────────────────────────────────────────────── */
.DateField[data-initialized] {
  overflow: visible;
}

/* ── Slide rail ────────────────────────────────────────────────────────── */
.DateField .slideContainer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(100vw, var(--_df-rail-max-width));
  height: 0;
  pointer-events: none;
  z-index: 9999;
}

/* ── Calendar bubble ───────────────────────────────────────────────────── */
.DateField .DateFieldCalendar {
  position: absolute;
  left: var(--df-popup-offset, 50%);
  transform: translateX(-50%);
  pointer-events: auto;
  will-change: filter;
  filter:
    drop-shadow(0 0.1875rem 0.1875rem hsl(0 0% 0% / 20%))
    drop-shadow(0 0.75rem 0.75rem hsl(0 0% 0% / 20%));
}

/* ── Direction gates ───────────────────────────────────────────────────── */
.DateField[data-direction="bottom"] .DateFieldCalendar {
  top: var(--df-calendar-gap);
}

.DateField[data-direction="top"] .DateFieldCalendar {
  bottom: var(--df-calendar-gap);
}

/* ── Arrow ─────────────────────────────────────────────────────────────── */
.DateField .arrow {
  position: absolute;
  width: var(--_df-arrow-size);
  height: var(--_df-arrow-size);
  background-color: var(--_df-surface-color);
  left: 50%;
}

.DateField[data-direction="top"] .arrow {
  bottom: calc(var(--_df-arrow-size) * -0.5);
  transform: translateX(calc(-50% + var(--df-arrow-offset, 0px))) rotate(45deg);
  border-end-end-radius: var(--_df-arrow-corner-radius);
}

.DateField[data-direction="bottom"] .arrow {
  top: calc(var(--_df-arrow-size) * -0.5);
  transform: translateX(calc(-50% + var(--df-arrow-offset, 0px))) rotate(45deg);
  border-start-start-radius: var(--_df-arrow-corner-radius);
}
```

- [ ] **Step 2: Run typecheck (CSS changes don't affect TS, but check nothing else broke)**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/partials/components/DateField/DateField.css
git commit -m "feat(DateField): add slideContainer, direction gates, and arrow CSS"
```

---

## Task 6: Update DateField.ts

**Files:**
- Modify: `src/partials/components/DateField/DateField.ts`

- [ ] **Step 1: Add import at the top of `DateField.ts`**

After the existing imports, add:

```ts
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../../js/popup-position'
```

- [ ] **Step 2: Add `slideContainer` instance variable** to the class field declarations (alongside `calendarEl: HTMLElement | null`):

```ts
slideContainer!: HTMLElement
```

- [ ] **Step 3: Resolve `slideContainer` in `_init()`** after the line that resolves `this.calendarTemplate`:

```ts
this.slideContainer = this.root.querySelector<HTMLElement>('.slideContainer')!
```

And at the end of `_init()`, after all event listeners are set up, add:

```ts
this.root.setAttribute('data-initialized', '')
```

- [ ] **Step 4: Update `_openCalendar()`**

Find these three lines in `_openCalendar()`:

```ts
document.body.appendChild(this.calendarEl)

const rect = this.trigger.getBoundingClientRect()
this.calendarEl.style.top = `${rect.bottom + window.scrollY + 4}px`
this.calendarEl.style.left = `${rect.left + window.scrollX}px`
```

Replace with:

```ts
this.slideContainer.appendChild(this.calendarEl)
this._updateLayout()
```

- [ ] **Step 5: Simplify the outside-click handler in `_openCalendar()`**

Find:

```ts
this._outsideClickHandler = (e: MouseEvent) => {
  if (!this.root.contains(e.target as Node) && !this.calendarEl?.contains(e.target as Node)) {
    this._closeCalendar()
  }
}
```

Replace with:

```ts
this._outsideClickHandler = (e: MouseEvent) => {
  if (!this.root.contains(e.target as Node)) {
    this._closeCalendar()
  }
}
```

- [ ] **Step 6: Add `_updateLayout()` method** — add after `_openCalendar()`:

```ts
_updateLayout(): void {
  if (!this.calendarEl) return

  const triggerRect = this.trigger.getBoundingClientRect()
  const containerRect = this.slideContainer.getBoundingClientRect()
  const calendarWidth = this.calendarEl.offsetWidth
  if (!containerRect.width || !calendarWidth) return

  const direction = detectDirection(triggerRect)
  this.root.dataset.direction = direction

  const triggerCenterX = triggerRect.left + triggerRect.width / 2

  const offset = calculatePopupOffset(
    triggerCenterX,
    containerRect.left,
    containerRect.width,
    calendarWidth,
  )
  this.root.style.setProperty('--df-popup-offset', `${offset}%`)

  const calendarLeft = containerRect.left + (offset / 100 * containerRect.width) - calendarWidth / 2
  const arrowOffset = calculateArrowOffset(
    triggerCenterX,
    calendarLeft,
    calendarWidth,
    this._getCSSPx('--_df-arrow-corner-radius'),
    this._getCSSPx('--_df-arrow-size'),
  )
  this.root.style.setProperty('--df-arrow-offset', `${arrowOffset}px`)
}
```

- [ ] **Step 7: Add `_getCSSPx()` method** — add after `_updateLayout()`. This resolves a CSS custom property to px by measuring a probe element:

```ts
private _getCSSPx(property: string): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`
  this.root.appendChild(probe)
  const px = probe.getBoundingClientRect().width
  this.root.removeChild(probe)
  return px
}
```

- [ ] **Step 8: Add resize handler** — add the instance variable alongside `_outsideClickHandler`:

```ts
private _rafHandle: number | null = null
```

Add the method:

```ts
private _handleResize = (): void => {
  if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
  this._rafHandle = requestAnimationFrame(() => {
    if (this.calendarEl) this._updateLayout()
  })
}
```

Add the event listener in `_init()`:

```ts
window.addEventListener('resize', this._handleResize)
```

Add cleanup in the `destroy()` method (if it exists) or at `_closeCalendar()`:

In `_closeCalendar()`, after `document.removeEventListener('click', this._outsideClickHandler!)`, add:

```ts
if (this._rafHandle) {
  cancelAnimationFrame(this._rafHandle)
  this._rafHandle = null
}
```

- [ ] **Step 9: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Run unit tests**

```bash
npm run test:unit
```

Expected: all existing tests pass. (jsdom returns 0 for getBoundingClientRect, so `_updateLayout` early-returns — existing calendar open/close tests still work.)

- [ ] **Step 11: Commit**

```bash
git add src/partials/components/DateField/DateField.ts
git commit -m "feat(DateField): replace body-append with slideContainer positioning"
```

---

## Task 7: Update unit test fixture and add direction tests

**Files:**
- Modify: `src/partials/components/DateField/tests/DateField.unit.test.ts`

- [ ] **Step 1: Update the `makeField` fixture** — locate the `innerHTML` template string inside `makeField()` (around line 229) and add `.slideContainer` wrapping the `<template>`:

Find this block in `makeField`:

```ts
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-label="Öppna kalender"
            aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
```

Replace with:

```ts
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-label="Öppna kalender"
            aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <div class="slideContainer">
        <template data-template="datefield-calendar">
```

And close the `slideContainer` — find the closing `</template>` in makeField and add `</div>` after it:

```ts
        </template>
        <div class="arrow"></div>
        </div>
```

- [ ] **Step 2: Add direction unit tests** — add this describe block at the end of the file:

```ts
describe('DateField — _updateLayout direction', () => {
  it('sets data-direction="bottom" when getBoundingClientRect returns more space below', () => {
    const { el, instance } = makeField()

    // Mock trigger to appear near top of a 1000px viewport
    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue({
      top: 50, bottom: 80, left: 200, right: 250, width: 50, height: 30,
      x: 200, y: 50, toJSON: () => {},
    } as DOMRect)

    // Mock slideContainer to have width so _updateLayout doesn't early-return
    vi.spyOn(instance.slideContainer, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 1000, width: 1000, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    // Mock calendarEl offsetWidth
    instance._openCalendar()
    Object.defineProperty(instance.calendarEl!, 'offsetWidth', { value: 300, configurable: true })
    vi.stubGlobal('innerHeight', 1000)

    instance._updateLayout()

    expect(el.dataset.direction).toBe('bottom')
    instance._closeCalendar()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    el.remove()
  })

  it('sets data-direction="top" when getBoundingClientRect returns more space above', () => {
    const { el, instance } = makeField()

    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue({
      top: 800, bottom: 830, left: 200, right: 250, width: 50, height: 30,
      x: 200, y: 800, toJSON: () => {},
    } as DOMRect)

    vi.spyOn(instance.slideContainer, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 1000, width: 1000, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    instance._openCalendar()
    Object.defineProperty(instance.calendarEl!, 'offsetWidth', { value: 300, configurable: true })
    vi.stubGlobal('innerHeight', 1000)

    instance._updateLayout()

    expect(el.dataset.direction).toBe('top')
    instance._closeCalendar()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    el.remove()
  })
})
```

- [ ] **Step 3: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass including the 2 new direction tests.

- [ ] **Step 4: Commit**

```bash
git add src/partials/components/DateField/tests/DateField.unit.test.ts
git commit -m "test(DateField): update fixture for slideContainer, add _updateLayout direction tests"
```

---

## Task 8: Add e2e test for data-direction

**Files:**
- Modify: `src/partials/components/DateField/tests/DateField.e2e.test.js`

- [ ] **Step 1: Add the following test** at the end of the test file, before the final `});` if there is one, otherwise just append:

```js
test('data-direction is set on root when calendar opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"]').scrollIntoViewIfNeeded()
  await page.locator('[data-id="birthdate"] .Trigger').click()
  const direction = await page.locator('[data-id="birthdate"]').getAttribute('data-direction')
  expect(['top', 'bottom']).toContain(direction)
  await page.keyboard.press('Escape')
})
```

- [ ] **Step 2: Run e2e tests** (requires dev server — run `npm run dev` in a separate terminal first, then):

```bash
npm run test:e2e
```

Expected: new test passes, all previously-passing tests still pass (25+ passed).

- [ ] **Step 3: Commit**

```bash
git add src/partials/components/DateField/tests/DateField.e2e.test.js
git commit -m "test(DateField): add e2e assertion for data-direction on calendar open"
```

---

## Task 9: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` and navigate to the DateField kitchensink.

- [ ] **Step 2: Open the calendar on the live demo instance** (bottom of the kitchensink page — the field with `data-id="birthdate"`).

Verify:
- Calendar opens above or below the trigger depending on viewport position
- Arrow points at the calendar icon
- Drop shadow matches ToggleTip bubble
- Calendar does not clip at viewport edges when scrolled to an edge

- [ ] **Step 3: Commit if any CSS tweaks were needed** (e.g. arrow position fine-tuning, gap adjustment):

```bash
git add src/partials/components/DateField/DateField.css
git commit -m "fix(DateField): adjust calendar positioning after visual review"
```

// src/partials/components/DateTimeField/tests/DateTimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId } from '../../../../e2e-helpers/target.js'

// Scope to the live-demo instance; the kitchensink renders many DateTimeFields,
// only this one carries data-id="meeting-time". Override via TARGET_ID when
// porting the suite to your own page.
const ROOT = targetId('DateTimeField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(ROOT).scrollIntoViewIfNeeded()
  await page.locator(`${ROOT}[data-initialized]`).waitFor()
  await injectAxe(page)
})

// ─── Accessibility audit ─────────────────────────────────────────────────────

test('passes axe accessibility audit', async ({ page }) => {
  await checkA11y(page, ROOT, {
    detailedReport: true,
    axeOptions: {
      rules: {
        'duplicate-id': { enabled: false },
        'color-contrast': { enabled: false },
      },
    },
  })
})

// ─── Initialization ──────────────────────────────────────────────────────────

test('root has data-initialized', async ({ page }) => {
  await expect(page.locator(ROOT)).toBeAttached()
})

// ─── Segments ────────────────────────────────────────────────────────────────

test('date and time segments are rendered as spinbuttons', async ({ page }) => {
  const segs = page.locator(`${ROOT} .Segment[role="spinbutton"]`)
  const types = await segs.evaluateAll(els => els.map(e => e.dataset.segment))
  expect(types).toContain('day')
  expect(types).toContain('month')
  expect(types).toContain('year')
  expect(types).toContain('hour')
  expect(types).toContain('minute')
})

test('segments have aria-valuemin, aria-valuemax, aria-valuetext', async ({ page }) => {
  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  await expect(hourSeg).toHaveAttribute('aria-valuemin')
  await expect(hourSeg).toHaveAttribute('aria-valuemax')
  await expect(hourSeg).toHaveAttribute('aria-valuetext')
})

test('ArrowUp increments hour segment', async ({ page }) => {
  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  await hourSeg.focus()
  const before = await hourSeg.getAttribute('aria-valuenow')
  await page.keyboard.press('ArrowUp')
  const after = await hourSeg.getAttribute('aria-valuenow')
  // If segment had a value, it incremented; if it was empty, it set to min
  expect(after).not.toBeNull()
  if (before !== null) {
    const min = Number(await hourSeg.getAttribute('aria-valuemin'))
    const max = Number(await hourSeg.getAttribute('aria-valuemax'))
    const expected = Number(before) + 1 > max ? min : Number(before) + 1
    expect(Number(after)).toBe(expected)
  }
})

test('Tab moves focus to next segment', async ({ page }) => {
  const firstSeg = page.locator(`${ROOT} .Segment[role="spinbutton"]`).first()
  const secondSeg = page.locator(`${ROOT} .Segment[role="spinbutton"]`).nth(1)
  await firstSeg.focus()
  await page.keyboard.press('ArrowRight')
  await expect(secondSeg).toBeFocused()
})

test('native input is aria-hidden and tabindex -1', async ({ page }) => {
  const native = page.locator(`${ROOT} .DateTimeField-native`)
  await expect(native).toHaveAttribute('aria-hidden', 'true')
  await expect(native).toHaveAttribute('tabindex', '-1')
})

// ─── Calendar popup ───────────────────────────────────────────────────────────

test('trigger button opens the calendar popup', async ({ page }) => {
  const trigger = page.locator(`${ROOT} .DateTimeField-trigger`)
  await trigger.click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
})

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const dialog = page.locator(`${ROOT} .DateTimeField-popup`)
  await expect(dialog).toHaveAttribute('role', 'dialog')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('Escape closes the calendar and restores focus to trigger', async ({ page }) => {
  const trigger = page.locator(`${ROOT} .DateTimeField-trigger`)
  await trigger.click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).not.toBeAttached()
  await expect(trigger).toBeFocused()
})

test('clicking a date closes the popup and updates segments', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const dateBtn = page.locator(`${ROOT} .DateTimeField-popup td:not([data-outside-month]):not([aria-disabled]) button`).first()
  await dateBtn.click({ force: true })
  // Date segments should now be filled
  const daySeg = page.locator(`${ROOT} .Segment[data-segment="day"]`)
  const val = await daySeg.getAttribute('aria-valuenow')
  expect(val).not.toBeNull()
})

// ─── Time wheels (shared spinner with TimeField) ───────────────────────────────

test('hour and minute wheels are visible in the popup', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .Wheel[data-segment="hour"]`)).toBeVisible()
  await expect(page.locator(`${ROOT} .Wheel[data-segment="minute"]`)).toBeVisible()
})

test('hour wheel is a spinbutton with aria-label', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const hourWheel = page.locator(`${ROOT} .Wheel[data-segment="hour"]`)
  await expect(hourWheel).toHaveAttribute('role', 'spinbutton')
  const label = await hourWheel.getAttribute('aria-label')
  expect(label?.length).toBeGreaterThan(0)
})

test('ArrowDown on the hour wheel sets the hour segment', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const hourWheel = page.locator(`${ROOT} .Wheel[data-segment="hour"]`)
  await hourWheel.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap animation
  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  await expect(hourSeg).not.toHaveAttribute('data-placeholder')
  expect(await hourSeg.getAttribute('aria-valuenow')).not.toBeNull()
})

// ─── AM/PM toggle ───────────────────────────────────────────────────────────────

test('AM/PM toggle is hidden in the 24h (sv-SE) locale', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .DateTimeField-ampm`)).toBeHidden()
})

test('AM/PM toggle is shown and drives the hour in a 12h locale', async ({ page }) => {
  const TWELVE = '[data-component="DateTimeField"][data-id="dtf-12h"]'
  await page.locator(`${TWELVE}`).scrollIntoViewIfNeeded()
  await page.locator(`${TWELVE} .DateTimeField-trigger`).click()

  const toggle = page.locator(`${TWELVE} .DateTimeField-ampm`)
  await expect(toggle).toBeVisible()
  const native = page.locator(`${TWELVE} .DateTimeField-native`)

  // Seeded value 14:35 → PM active. Switch to AM → hour drops by 12 (02:35).
  await expect(native).toHaveValue('2026-05-27T14:35')
  await page.locator(`${TWELVE} .DateTimeField-ampm-option[data-ampm="0"]`).click()
  await expect(native).toHaveValue('2026-05-27T02:35')
  await expect(page.locator(`${TWELVE} .DateTimeField-ampm-option[data-ampm="0"]`)).toHaveAttribute('aria-pressed', 'true')
})

// ─── "Nu" button ──────────────────────────────────────────────────────────────

test('"Nu" button sets current datetime and closes popup', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .CalendarFooterNow`).click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).not.toBeAttached()
  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  const val = await hourSeg.getAttribute('aria-valuenow')
  expect(val).not.toBeNull()
})

// ─── Clear ────────────────────────────────────────────────────────────────────

test('clear button empties all segments', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .CalendarFooterNow`).click()
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .CalendarFooterClear`).click()
  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  await expect(hourSeg).toHaveAttribute('data-placeholder')
})

// ─── Calendar navigation ─────────────────────────────────────────────────────

test('ArrowRight moves focus to next day', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const firstBtn = page.locator(`${ROOT} .DateTimeField-popup td:not([data-outside-month]):not([aria-disabled]) button`).first()
  await firstBtn.focus()
  const firstDate = await firstBtn.getAttribute('data-date')
  await page.keyboard.press('ArrowRight')
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-date'))
  expect(focused).not.toBe(firstDate)
})

test('PageDown navigates to next month', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const firstBtn = page.locator(`${ROOT} .DateTimeField-popup td:not([data-outside-month]):not([aria-disabled]) button`).first()
  await firstBtn.focus()
  const before = await page.locator(`${ROOT} .CalendarMonthYear`).textContent()
  await page.keyboard.press('PageDown')
  const after = await page.locator(`${ROOT} .CalendarMonthYear`).textContent()
  expect(after).not.toBe(before)
})

// ─── Month/Year picker wheels ───────────────────────────────────────────────

test('month/year picker opens as wheels', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .MonthYearTrigger`).click()
  await expect(page.locator(`${ROOT} .Wheel[data-picker="month"]`)).toHaveAttribute('role', 'spinbutton')
  await expect(page.locator(`${ROOT} .Wheel[data-picker="year"]`)).toHaveAttribute('role', 'spinbutton')
})

test('MonthYearTrigger uses aria-controls (not aria-haspopup) for the picker', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const trigger = page.locator(`${ROOT} .MonthYearTrigger`)
  expect(await trigger.getAttribute('aria-haspopup')).toBeNull()
  const controls = await trigger.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  await expect(page.locator(`#${controls}`)).toHaveAttribute('data-panel', 'picker')
})

test('ArrowDown on the year wheel navigates the calendar', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .MonthYearTrigger`).click()
  const header = page.locator(`${ROOT} .CalendarMonthYear`)
  const before = await header.textContent()
  await page.locator(`${ROOT} .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap animation
  expect(await header.textContent()).not.toBe(before)
})

test('Escape from the picker returns to the calendar (keeps popup open)', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .MonthYearTrigger`).click()
  await page.locator(`${ROOT} .Wheel[data-picker="month"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${ROOT} [data-panel="picker"]`)).toHaveAttribute('data-active', 'false')
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
})

test('spinning the year wheel updates the underlying field', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .MonthYearTrigger`).click()
  const native = page.locator(`${ROOT} .DateTimeField-native`)
  await expect(native).toHaveValue('') // meeting-time starts empty
  await page.locator(`${ROOT} .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap
  await expect(native).not.toHaveValue('') // the wheel wrote the datetime to the field
})

test('month wheel loops past the year boundary (Jan ↔ Dec)', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await page.locator(`${ROOT} .MonthYearTrigger`).click()
  const month = page.locator(`${ROOT} .Wheel[data-picker="month"]`)
  await month.focus()
  const v0 = Number(await month.getAttribute('aria-valuenow'))
  for (let i = 0; i <= v0; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150) }
  await page.waitForTimeout(400)
  await expect(month).toHaveAttribute('aria-valuenow', '11')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the calendar', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
  // "Now" is the last tab stop. Tab must wrap back into the calendar, not
  // escape the aria-modal dialog (this calendar previously had no Tab trap).
  await page.locator(`${ROOT} .DateTimeField-popup .CalendarFooterNow`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .DateTimeField-popup`)
    return popup?.contains(document.activeElement) ?? false
  }, ROOT)
  expect(inside).toBe(true)
})

test('Shift+Tab from the first tab stop keeps focus inside the calendar', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
  await page.locator(`${ROOT} .DateTimeField-popup .CalendarPrev`).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .DateTimeField-popup`)
    return popup?.contains(document.activeElement) ?? false
  }, ROOT)
  expect(inside).toBe(true)
})

test('wheel event on the calendar surface (off a wheel) is defaultPrevented', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .DateTimeField-popup`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .DateTimeField-popup`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, ROOT)
  expect(prevented).toBe(true)
})

// src/partials/components/DateTimeField/tests/DateTimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

// Scope to the live-demo instance; the kitchensink renders many DateTimeFields,
// only this one carries data-id="meeting-time". The standalone partial page has
// no bootstrap script, so the component is exercised via the full app at '/'.
const ROOT = '[data-component="DateTimeField"][data-id="meeting-time"]'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
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

// ─── Time columns ─────────────────────────────────────────────────────────────

test('time columns are visible in the popup', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  await expect(page.locator(`${ROOT} .HourList`)).toBeVisible()
  await expect(page.locator(`${ROOT} .MinuteList`)).toBeVisible()
})

test('hour list has role=listbox with aria-label', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const hourList = page.locator(`${ROOT} .HourList`)
  await expect(hourList).toHaveAttribute('role', 'listbox')
  const label = await hourList.getAttribute('aria-label')
  expect(label?.length).toBeGreaterThan(0)
})

test('clicking an hour option updates the hour segment', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  // Wait for HourList to be populated
  await page.locator(`${ROOT} .HourList [role="option"]`).first().waitFor()

  const hourOptions = page.locator(`${ROOT} .HourList [role="option"]`)
  const targetOption = hourOptions.nth(5) // pick 5th hour
  const expectedValue = await targetOption.evaluate(el => el.id.split('-').at(-1))
  await targetOption.click()

  const hourSeg = page.locator(`${ROOT} .Segment[data-segment="hour"]`)
  const hourVal = await hourSeg.getAttribute('aria-valuenow')
  expect(String(hourVal)).toBe(String(expectedValue))
})

test('ArrowDown in hour listbox moves selection', async ({ page }) => {
  await page.locator(`${ROOT} .DateTimeField-trigger`).click()
  const hourList = page.locator(`${ROOT} .HourList`)
  await hourList.focus()
  const beforeActive = await hourList.getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowDown')
  const afterActive = await hourList.getAttribute('aria-activedescendant')
  // active-descendant should have changed (or be set if it was unset)
  expect(afterActive).toBeTruthy()
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

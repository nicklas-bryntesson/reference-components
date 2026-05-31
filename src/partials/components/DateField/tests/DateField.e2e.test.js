// tests/DateField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-id="birthdate"]').scrollIntoViewIfNeeded()
  await injectAxe(page)
})

test('custom UI is shown on pointer:fine', async ({ page }) => {
  const custom = page.locator('[data-id="birthdate"] .Custom')
  await expect(custom).toBeVisible()
  const native = page.locator('[data-id="birthdate"] .Native')
  await expect(native).not.toBeVisible()
})

test('Segments group has aria-labelledby or aria-label', async ({ page }) => {
  const segments = page.locator('[data-id="birthdate"] .Segments')
  const labelledBy = await segments.getAttribute('aria-labelledby')
  const ariaLabel = await segments.getAttribute('aria-label')
  expect(labelledBy || ariaLabel).toBeTruthy()
})

test('day segment placeholder state: aria-valuenow absent', async ({ page }) => {
  const daySegment = page.locator('[data-id="birthdate"] [data-segment="day"]')
  const valuenow = await daySegment.getAttribute('aria-valuenow')
  expect(valuenow).toBeNull()
})

test('ArrowUp increments day segment', async ({ page }) => {
  const daySegment = page.locator('[data-id="birthdate"] [data-segment="day"]')
  await daySegment.focus()
  await daySegment.press('ArrowUp')
  const valueNow = await daySegment.getAttribute('aria-valuenow')
  expect(Number(valueNow)).toBeGreaterThanOrEqual(1)
})

test('no aria-controls on trigger at any time', async ({ page }) => {
  const trigger = page.locator('[data-id="birthdate"] .DateField-trigger')
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await trigger.click()
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await page.keyboard.press('Escape')
})

test('calendar does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator('.DateField-popup')).toHaveCount(0)
})

test('calendar is visible inside slideContainer when open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const calendar = page.locator('[data-id="birthdate"] .slideContainer .DateField-popup')
  await expect(calendar).toBeVisible()
})

test('calendar is removed on Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.DateField-popup')).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-id="birthdate"] .DateField-trigger')).toBeFocused()
})

test('calendar is removed on outside click', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await expect(page.locator('.DateField-popup')).toBeVisible()
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator('.DateField-popup')).toHaveCount(0)
})

test('date selection closes calendar and syncs native input', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const firstDay = page.locator('.DateField-popup td:not([data-outside-month]):not([aria-disabled="true"]) button').first()
  const dateLabel = await firstDay.getAttribute('data-date')
  await firstDay.click({ force: true })
  await expect(page.locator('.DateField-popup')).toHaveCount(0)
  const nativeValue = await page.locator('[data-id="birthdate"] .Native').inputValue()
  expect(nativeValue).toBe(dateLabel)
})

test('aria-selected is on td not button', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  // All td elements in grid should have aria-selected
  const tdsWithAriaSelected = page.locator('.Grid td[aria-selected]')
  const count = await tdsWithAriaSelected.count()
  expect(count).toBeGreaterThan(0)
  // No buttons should have aria-selected
  await expect(page.locator('.Grid button[aria-selected]')).toHaveCount(0)
})

test('aria-disabled is on td not button for disabled cells', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const disabledButtons = page.locator('.Grid button[aria-disabled="true"]')
  expect(await disabledButtons.count()).toBe(0) // aria-disabled never on button — only on td
  await page.keyboard.press('Escape')
})

test('Tab wraps from last to first focusable element in calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  // Last tabbable element is the Today button in the footer
  const todayBtn = page.locator('.CalendarFooterToday')
  await todayBtn.focus()
  await page.keyboard.press('Tab')
  // Should wrap to first (prev-month button)
  const prevMonthBtn = page.locator('.CalendarHeader button').first()
  await expect(prevMonthBtn).toBeFocused()
  await page.keyboard.press('Escape')
})

test('data-state="open" on root when calendar open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await expect(page.locator('[data-id="birthdate"][data-state="open"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-id="birthdate"][data-state="idle"]')).toHaveCount(1)
})

test('axe: zero violations on initial render', async ({ page }) => {
  await checkA11y(page, '[data-id="birthdate"]', {
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }
  })
})

test('axe: zero violations with calendar open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await expect(page.locator('.DateField-popup')).toBeVisible()
  await checkA11y(page, undefined, {
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }
  })
  await page.keyboard.press('Escape')
})

test('data-direction is set on root when calendar opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"]').scrollIntoViewIfNeeded()
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const direction = await page.locator('[data-id="birthdate"]').getAttribute('data-direction')
  expect(['top', 'bottom']).toContain(direction)
  await page.keyboard.press('Escape')
})

// ── Month/Year Picker ─────────────────────────────────────────────────────────

test('MonthYearTrigger opens picker on click', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  const picker = page.locator('.DateField-popup [data-panel="picker"]')
  await expect(picker).toHaveAttribute('data-active', 'true')
})

test('MonthYearTrigger has aria-expanded true when picker open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  const trigger = page.locator('.MonthYearTrigger')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

test('MonthList receives focus when picker opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await expect(page.locator('.MonthList')).toBeFocused()
})

test('ArrowDown moves aria-activedescendant in MonthList', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  const monthList = page.locator('.MonthList')
  const initialId = await monthList.getAttribute('aria-activedescendant')
  await page.keyboard.press('ArrowDown')
  const nextId = await monthList.getAttribute('aria-activedescendant')
  expect(nextId).not.toBe(initialId)
})

test('Tab moves focus from MonthList to YearList', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('Tab')
  await expect(page.locator('.YearList')).toBeFocused()
})

test('Enter on month option returns to calendar view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('Enter')
  const picker = page.locator('.DateField-popup [data-panel="picker"]')
  await expect(picker).toHaveAttribute('data-active', 'false')
})

test('Escape from picker returns to calendar view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('Escape')
  const picker = page.locator('.DateField-popup [data-panel="picker"]')
  await expect(picker).toHaveAttribute('data-active', 'false')
})

test('Escape from picker does not close calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.DateField-popup')).toBeVisible()
})

test('axe: no violations in picker view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await checkA11y(page)
})

// ── Keyboard access (atomica11y: date-picker-dialog §1) ──────────────────────

test('Space opens calendar from trigger', async ({ page }) => {
  const trigger = page.locator('[data-id="birthdate"] .DateField-trigger')
  await trigger.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.DateField-popup')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('Enter opens calendar from trigger', async ({ page }) => {
  const trigger = page.locator('[data-id="birthdate"] .DateField-trigger')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.DateField-popup')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('ArrowRight moves focus to next day in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const firstDay = page.locator('.DateField-popup td:not([data-outside-month]):not([aria-disabled="true"]) button').first()
  await firstDay.focus()
  const initialDate = await firstDay.getAttribute('data-date')
  await page.keyboard.press('ArrowRight')
  const focused = page.locator('.Grid button:focus')
  const nextDate = await focused.getAttribute('data-date')
  expect(nextDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('ArrowLeft moves focus to previous day in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const days = page.locator('.DateField-popup td:not([data-outside-month]):not([aria-disabled="true"]) button')
  const secondDay = days.nth(1)
  await secondDay.focus()
  const initialDate = await secondDay.getAttribute('data-date')
  await page.keyboard.press('ArrowLeft')
  const focused = page.locator('.Grid button:focus')
  const prevDate = await focused.getAttribute('data-date')
  expect(prevDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('ArrowDown moves focus one week forward in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const firstDay = page.locator('.DateField-popup td:not([data-outside-month]):not([aria-disabled="true"]) button').first()
  await firstDay.focus()
  const initialDate = await firstDay.getAttribute('data-date')
  await page.keyboard.press('ArrowDown')
  const focused = page.locator('.Grid button:focus')
  const nextDate = await focused.getAttribute('data-date')
  expect(nextDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('PageDown moves calendar to next month', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const monthLabel = page.locator('.MonthYearTrigger')
  const initialLabel = await monthLabel.textContent()
  await page.locator('.Grid').focus()
  await page.keyboard.press('PageDown')
  const nextLabel = await monthLabel.textContent()
  expect(nextLabel).not.toBe(initialLabel)
  await page.keyboard.press('Escape')
})

test('PageUp moves calendar to previous month', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  const monthLabel = page.locator('.MonthYearTrigger')
  const initialLabel = await monthLabel.textContent()
  await page.locator('.Grid').focus()
  await page.keyboard.press('PageUp')
  const nextLabel = await monthLabel.textContent()
  expect(nextLabel).not.toBe(initialLabel)
  await page.keyboard.press('Escape')
})

// ── Month/Year Picker ─────────────────────────────────────────────────────────

test('Home jumps to first enabled month option', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('Home')
  const monthList = page.locator('.MonthList')
  const activeId = await monthList.getAttribute('aria-activedescendant')
  expect(activeId).toMatch(/-month-0$/)
})

test('End jumps to last enabled month option', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .DateField-trigger').click()
  await page.locator('[data-id="birthdate"] .MonthYearTrigger').click()
  await page.keyboard.press('End')
  const monthList = page.locator('.MonthList')
  const activeId = await monthList.getAttribute('aria-activedescendant')
  expect(activeId).toMatch(/-month-11$/)
})

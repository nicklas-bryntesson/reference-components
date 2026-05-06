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
  const trigger = page.locator('[data-id="birthdate"] .Trigger')
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await trigger.click()
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await page.keyboard.press('Escape')
})

test('calendar does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator('.DateFieldCalendar')).toHaveCount(0)
})

test('calendar is a body child when open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  const calendar = page.locator('body > .DateFieldCalendar')
  await expect(calendar).toBeVisible()
})

test('calendar is removed from body on Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.DateFieldCalendar')).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-id="birthdate"] .Trigger')).toBeFocused()
})

test('calendar is removed on outside click', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  await expect(page.locator('.DateFieldCalendar')).toBeVisible()
  await page.mouse.click(10, 10) // outside both root and calendar
  await expect(page.locator('.DateFieldCalendar')).toHaveCount(0)
})

test('date selection closes calendar and syncs native input', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  const firstDay = page.locator('td:not([data-outside-month]):not([aria-disabled="true"]) button').first()
  const dateLabel = await firstDay.getAttribute('data-date')
  await firstDay.click()
  await expect(page.locator('.DateFieldCalendar')).toHaveCount(0)
  const nativeValue = await page.locator('[data-id="birthdate"] .Native').inputValue()
  expect(nativeValue).toBe(dateLabel)
})

test('aria-selected is on td not button', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  // All td elements in grid should have aria-selected
  const tdsWithAriaSelected = page.locator('.Grid td[aria-selected]')
  const count = await tdsWithAriaSelected.count()
  expect(count).toBeGreaterThan(0)
  // No buttons should have aria-selected
  await expect(page.locator('.Grid button[aria-selected]')).toHaveCount(0)
})

test('aria-disabled is on td not button for disabled cells', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  const disabledButtons = page.locator('.Grid button[aria-disabled="true"]')
  expect(await disabledButtons.count()).toBe(0) // aria-disabled never on button — only on td
  await page.keyboard.press('Escape')
})

test('Tab wraps from last to first focusable element in calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
  // Tab to last focusable element (next-month button)
  const nextMonthBtn = page.locator('.CalendarHeader button').last()
  await nextMonthBtn.focus()
  await page.keyboard.press('Tab')
  // Should wrap to first (prev-month button)
  const prevMonthBtn = page.locator('.CalendarHeader button').first()
  await expect(prevMonthBtn).toBeFocused()
  await page.keyboard.press('Escape')
})

test('data-state="open" on root when calendar open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .Trigger').click()
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
  await page.locator('[data-id="birthdate"] .Trigger').click()
  await expect(page.locator('.DateFieldCalendar')).toBeVisible()
  await checkA11y(page, undefined, {
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }
  })
  await page.keyboard.press('Escape')
})

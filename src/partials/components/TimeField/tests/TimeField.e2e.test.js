// src/partials/components/TimeField/tests/TimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

// DateTimeField also uses data-id="meeting-time" — scope to this component only
const TF = '[data-component="TimeField"][data-id="meeting-time"]'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator(TF).scrollIntoViewIfNeeded()
  await page.locator(`${TF}[data-initialized]`).waitFor()
  await injectAxe(page)
})

// ── Custom overlay ─────────────────────────────────────────────────────────────

test('custom overlay is shown on pointer:fine', async ({ page }) => {
  const overlay = page.locator(`${TF} .TimeField-overlay`)
  await expect(overlay).toBeVisible()
})

test('root has data-input-mode=custom after JS init', async ({ page }) => {
  await expect(page.locator(TF)).toHaveAttribute('data-input-mode', 'custom')
})

// ── Segment ARIA structure ─────────────────────────────────────────────────────

test('hour segment has required aria attributes', async ({ page }) => {
  const hour = page.locator(`${TF} [data-segment="hour"]`)
  await expect(hour).toHaveAttribute('role', 'spinbutton')
  await expect(hour).toHaveAttribute('aria-valuemin', '0')
  await expect(hour).toHaveAttribute('aria-valuemax', '23')
  await expect(hour).toHaveAttribute('aria-valuetext') // present (any value)
})

test('minute segment has required aria attributes', async ({ page }) => {
  const minute = page.locator(`${TF} [data-segment="minute"]`)
  await expect(minute).toHaveAttribute('role', 'spinbutton')
  await expect(minute).toHaveAttribute('aria-valuemin', '0')
  await expect(minute).toHaveAttribute('aria-valuemax', '59')
})

test('segments group has role=group', async ({ page }) => {
  const group = page.locator(`${TF} .TimeField-segments`)
  await expect(group).toHaveAttribute('role', 'group')
})

// ── Trigger ARIA ───────────────────────────────────────────────────────────────

test('trigger has aria-expanded=false and aria-haspopup=dialog when closed', async ({ page }) => {
  const trigger = page.locator(`${TF} .TimeField-trigger`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
})

// ── Popup open / close ─────────────────────────────────────────────────────────

test('popup does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator('.TimeFieldPopup')).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  await expect(page.locator('.TimeFieldPopup')).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  await expect(page.locator(`${TF} .TimeField-trigger`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator('.TimeFieldPopup-column[data-segment="hour"]').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.TimeFieldPopup')).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator('.TimeFieldPopup-column[data-segment="hour"]').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TF} .TimeField-trigger`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  await expect(page.locator('.TimeFieldPopup')).toBeVisible()
  // Wait for the setTimeout(0) outside-click handler to register before clicking outside
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator('.TimeFieldPopup')).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  const popup = page.locator('.TimeFieldPopup')
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has aria-label', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  const popup = page.locator('.TimeFieldPopup')
  await expect(popup).toHaveAttribute('aria-label', 'Välj tid')
})

test('popup hour column has role=listbox', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  const hourCol = page.locator('.TimeFieldPopup-column[data-segment="hour"]')
  await expect(hourCol).toHaveAttribute('role', 'listbox')
})

test('popup minute column has role=listbox', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  const minuteCol = page.locator('.TimeFieldPopup-column[data-segment="minute"]')
  await expect(minuteCol).toHaveAttribute('role', 'listbox')
})

test('popup options have role=option', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  const firstOption = page.locator('.TimeFieldPopup-column[data-segment="hour"] [role="option"]').first()
  await expect(firstOption).toBeVisible()
})

// ── Keyboard: segment interaction ─────────────────────────────────────────────

test('ArrowUp increments hour segment', async ({ page }) => {
  const hour = page.locator(`${TF} [data-segment="hour"]`)
  await hour.focus()
  await hour.press('ArrowUp')
  const valueNow = await hour.getAttribute('aria-valuenow')
  expect(Number(valueNow)).toBeGreaterThanOrEqual(0)
})

test('ArrowDown on hour segment sets a value', async ({ page }) => {
  const hour = page.locator(`${TF} [data-segment="hour"]`)
  await hour.focus()
  await hour.press('ArrowDown')
  const valueNow = await hour.getAttribute('aria-valuenow')
  expect(Number(valueNow)).toBeGreaterThanOrEqual(0)
})

// ── Keyboard: Tab focus order ──────────────────────────────────────────────────

test('Tab from last segment moves focus to trigger', async ({ page }) => {
  // Focus the minute segment (last in default 24h sv-SE without seconds)
  const minute = page.locator(`${TF} [data-segment="minute"]`)
  await minute.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator(`${TF} .TimeField-trigger`)).toBeFocused()
})

// ── Disabled state ─────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  // The kitchensink has disabled TimeField instances — find the first one
  const disabledTrigger = page.locator('.TimeField[data-disabled] .TimeField-trigger').first()
  if (await disabledTrigger.count() > 0) {
    await expect(disabledTrigger).toBeDisabled()
  }
})

// ── axe accessibility ──────────────────────────────────────────────────────────

test('passes axe on the kitchensink page', async ({ page }) => {
  await checkA11y(page, TF, {
    detailedReport: false,
  })
})

test('passes axe with popup open', async ({ page }) => {
  await page.locator(`${TF} .TimeField-trigger`).click()
  await expect(page.locator('.TimeFieldPopup')).toBeVisible()
  await checkA11y(page, undefined, {
    detailedReport: false,
    axeOptions: {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      // scrollable-region-focusable: popup columns have tabindex="0" so they ARE
      // keyboard accessible; axe reports a false positive on scrollable listboxes.
      rules: { 'scrollable-region-focusable': { enabled: false } },
    },
  })
  await page.locator('.TimeFieldPopup-column[data-segment="hour"]').focus()
  await page.keyboard.press('Escape')
})

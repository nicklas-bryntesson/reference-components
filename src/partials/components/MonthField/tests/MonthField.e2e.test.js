// src/partials/components/MonthField/tests/MonthField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y } from '../../../../e2e-helpers/target.js'

const MF = targetId('MonthField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(MF).scrollIntoViewIfNeeded()
  await page.locator(`${MF}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

// ── Custom overlay ─────────────────────────────────────────────────────────────

test('custom overlay is shown on pointer:fine', async ({ page }) => {
  await expect(page.locator(`${MF} .overlay`)).toBeVisible()
})

test('root has data-input-mode=custom after JS init', async ({ page }) => {
  await expect(page.locator(MF)).toHaveAttribute('data-input-mode', 'custom')
})

// ── Segment ARIA structure ─────────────────────────────────────────────────────

test('month segment has required aria attributes', async ({ page }) => {
  const month = page.locator(`${MF} .segment[data-segment="month"]`)
  await expect(month).toHaveAttribute('role', 'spinbutton')
  await expect(month).toHaveAttribute('aria-valuemin', '0')
  await expect(month).toHaveAttribute('aria-valuemax', '11')
  await expect(month).toHaveAttribute('aria-valuetext')
})

test('year segment has role=spinbutton', async ({ page }) => {
  const year = page.locator(`${MF} .segment[data-segment="year"]`)
  await expect(year).toHaveAttribute('role', 'spinbutton')
  await expect(year).toHaveAttribute('aria-valuemin')
  await expect(year).toHaveAttribute('aria-valuemax')
})

test('segments group has role=group', async ({ page }) => {
  await expect(page.locator(`${MF} .segments`)).toHaveAttribute('role', 'group')
})

// ── Trigger ARIA ───────────────────────────────────────────────────────────────

test('trigger has aria-expanded=false and aria-haspopup=dialog when closed', async ({ page }) => {
  const trigger = page.locator(`${MF} .trigger`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
})

// ── Popup open / close ─────────────────────────────────────────────────────────

test('popup does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator('.popup')).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .trigger`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape and focus returns to trigger', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.locator('.Wheel[data-picker="month"]').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.popup')).toHaveCount(0)
  await expect(page.locator(`${MF} .trigger`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator('.popup')).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const popup = page.locator('.popup')
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has localized aria-label', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toHaveAttribute('aria-label', 'Choose month')
})

test('popup month column has role=spinbutton with 0–11 bounds', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const monthCol = page.locator('.Wheel[data-picker="month"]')
  await expect(monthCol).toHaveAttribute('role', 'spinbutton')
  await expect(monthCol).toHaveAttribute('aria-valuemin', '0')
  await expect(monthCol).toHaveAttribute('aria-valuemax', '11')
})

test('popup year column has role=spinbutton', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const yearCol = page.locator('.Wheel[data-picker="year"]')
  await expect(yearCol).toHaveAttribute('role', 'spinbutton')
  await expect(yearCol).toHaveAttribute('aria-valuemin')
  await expect(yearCol).toHaveAttribute('aria-valuemax')
})

// ── Keyboard: segment interaction ─────────────────────────────────────────────

test('ArrowUp sets a value on month segment', async ({ page }) => {
  const month = page.locator(`${MF} .segment[data-segment="month"]`)
  await month.focus()
  await month.press('ArrowUp')
  const valueNow = await month.getAttribute('aria-valuenow')
  expect(Number(valueNow)).toBeGreaterThanOrEqual(0)
  expect(Number(valueNow)).toBeLessThanOrEqual(11)
})

test('Tab from last segment (year) moves focus to trigger', async ({ page }) => {
  const year = page.locator(`${MF} .segment[data-segment="year"]`)
  await year.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator(`${MF} .trigger`)).toBeFocused()
})

// ── Wheel popup → value ────────────────────────────────────────────────────────

test('wheel column ArrowDown increases month value in segment', async ({ page }) => {
  // Set a known month first: type "06" (June, index 5)
  const monthSeg = page.locator(`${MF} .segment[data-segment="month"]`)
  await monthSeg.focus()
  await page.keyboard.type('06')
  await page.waitForTimeout(450)

  await page.locator(`${MF} .trigger`).click()
  const monthCol = page.locator('.Wheel[data-picker="month"]')
  await monthCol.focus()
  await page.keyboard.press('ArrowDown') // stepBy(+1) → July, index 6
  await page.waitForTimeout(500)

  await expect(monthSeg).toHaveAttribute('aria-valuenow', '6')
})

test('month wheel loops from December back to January', async ({ page }) => {
  const monthSeg = page.locator(`${MF} .segment[data-segment="month"]`)
  await monthSeg.focus()
  await page.keyboard.type('12') // December, index 11
  await page.waitForTimeout(450)

  await page.locator(`${MF} .trigger`).click()
  const monthCol = page.locator('.Wheel[data-picker="month"]')
  await monthCol.focus()
  await page.keyboard.press('ArrowDown') // stepBy(+1) → wraps to January index 0
  await page.waitForTimeout(500)

  await expect(monthSeg).toHaveAttribute('aria-valuenow', '0')
})

test('"This month" button sets the current month and year', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.locator('.footer-now').click()
  // Native value should be today's YYYY-MM.
  const expected = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  await expect(page.locator(`${MF} .native`)).toHaveValue(expected)
  // And the segments reflect it.
  await expect(page.locator(`${MF} .segment[data-segment="year"]`)).not.toHaveAttribute('data-placeholder')
})

test('"Clear" button empties the native value', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.locator('.footer-now').click()
  await page.locator('.footer-clear').click()
  await expect(page.locator(`${MF} .native`)).toHaveValue('')
})

test('"This month" and "Clear" dispatch input + change on the native input', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.evaluate((sel) => {
    const native = document.querySelector(`${sel} .native`)
    window.__events = []
    native.addEventListener('input', () => window.__events.push('input'))
    native.addEventListener('change', () => window.__events.push('change'))
  }, MF)
  await page.locator('.footer-now').click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change'])
  await page.locator('.footer-clear').click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change', 'input', 'change'])
})

// ── Disabled ────────────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  const disabledTrigger = page.locator('.MonthField[data-disabled="true"] .trigger').first()
  if (await disabledTrigger.count() > 0) {
    await expect(disabledTrigger).toBeDisabled()
  }
})

// ── axe accessibility ──────────────────────────────────────────────────────────

test('passes axe on the closed component', async ({ page }) => {
  await checkA11y(page, MF, { detailedReport: false })
})

test('passes axe with popup open', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
  await scopedCheckA11y(page, MF, {
    detailedReport: false,
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
  })
  await page.locator('.Wheel[data-picker="month"]').focus()
  await page.keyboard.press('Escape')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the popup', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
  // "This month" is the last tab stop (Clear is disabled while empty). Tab must
  // wrap back into the popup, not escape the aria-modal dialog.
  await page.locator('.footer-now').focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate(() =>
    document.querySelector('.popup')?.contains(document.activeElement) ?? false,
  )
  expect(inside).toBe(true)
})

test('Shift+Tab from the first wheel keeps focus inside the popup (wraps, does not close)', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
  await page.locator('.Wheel[data-picker="month"]').focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('.popup')).toBeVisible()
  const inside = await page.evaluate(() =>
    document.querySelector('.popup')?.contains(document.activeElement) ?? false,
  )
  expect(inside).toBe(true)
})

test('wheel event on the popup surface (off a column) is defaultPrevented', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator('.popup')).toBeVisible()
  const prevented = await page.evaluate(() => {
    const popup = document.querySelector('.popup')
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  })
  expect(prevented).toBe(true)
})

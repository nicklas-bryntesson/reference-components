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
  await expect(page.locator(`${MF} .popup`)).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .trigger`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape and focus returns to trigger', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.locator(`${MF} .Wheel[data-picker="month"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${MF} .popup`)).toHaveCount(0)
  await expect(page.locator(`${MF} .trigger`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator(`${MF} .popup`)).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const popup = page.locator(`${MF} .popup`)
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has localized aria-label', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toHaveAttribute('aria-label', 'Choose month')
})

test('popup month column has role=spinbutton with 0–11 bounds', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const monthCol = page.locator(`${MF} .Wheel[data-picker="month"]`)
  await expect(monthCol).toHaveAttribute('role', 'spinbutton')
  await expect(monthCol).toHaveAttribute('aria-valuemin', '0')
  await expect(monthCol).toHaveAttribute('aria-valuemax', '11')
})

test('popup year column has role=spinbutton', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  const yearCol = page.locator(`${MF} .Wheel[data-picker="year"]`)
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
  const monthCol = page.locator(`${MF} .Wheel[data-picker="month"]`)
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
  const monthCol = page.locator(`${MF} .Wheel[data-picker="month"]`)
  await monthCol.focus()
  await page.keyboard.press('ArrowDown') // stepBy(+1) → wraps to January index 0
  await page.waitForTimeout(500)

  await expect(monthSeg).toHaveAttribute('aria-valuenow', '0')
})

test('"This month" button sets the current month and year', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await page.locator(`${MF} .footer-now`).click()
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
  await page.locator(`${MF} .footer-now`).click()
  await page.locator(`${MF} .footer-clear`).click()
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
  await page.locator(`${MF} .footer-now`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change'])
  await page.locator(`${MF} .footer-clear`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change', 'input', 'change'])
})

// ── Disabled ────────────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  const disabledTrigger = page.locator(`.MonthField[data-disabled="true"] .trigger`).first()
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
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  await scopedCheckA11y(page, MF, {
    detailedReport: false,
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
  })
  await page.locator(`${MF} .Wheel[data-picker="month"]`).focus()
  await page.keyboard.press('Escape')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the popup', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  // "This month" is the last tab stop (Clear is disabled while empty). Tab must
  // wrap back into the popup, not escape the aria-modal dialog.
  await page.locator(`${MF} .footer-now`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, MF)
  expect(inside).toBe(true)
})

test('Shift+Tab from the first wheel keeps focus inside the popup (wraps, does not close)', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  await page.locator(`${MF} .Wheel[data-picker="month"]`).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, MF)
  expect(inside).toBe(true)
})

test('wheel event on the popup surface (off a column) is defaultPrevented', async ({ page }) => {
  await page.locator(`${MF} .trigger`).click()
  await expect(page.locator(`${MF} .popup`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, MF)
  expect(prevented).toBe(true)
})

// ── Roving tabindex: out and back in ──────────────────────────────────────────
// The suite could tab *within* the segment group and *off* it, but never off and
// back, so a roving tabindex that never roved back was invisible: intercepting
// Tab on the last segment set every segment to -1, leaving the whole group with
// no tab stop and the field keyboard-unreachable for the rest of the page's
// life. A WCAG 2.1.1 failure that axe has no rule for.
test('the segment group keeps a tab stop after focus leaves it', async ({ page }) => {
  const segs = page.locator(`${MF} .segment[tabindex]`)
  const n = await segs.count()
  expect(n).toBeGreaterThan(1)

  await segs.first().focus()
  // Arrowing is the only keyboard route to the last segment.
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab')

  // Exactly one segment stays tabbable — the one that had focus.
  const tabindexes = await segs.evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')))
  expect(tabindexes.filter((t) => t === '0')).toHaveLength(1)
  expect(tabindexes[tabindexes.length - 1]).toBe('0')
})

test('Shift+Tab returns into the segment that was being edited', async ({ page }) => {
  const segs = page.locator(`${MF} .segment[tabindex]`)
  const n = await segs.count()

  await segs.first().focus()
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  const editing = await page.evaluate(() => document.activeElement?.dataset?.segment ?? null)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')

  await expect(page.locator(`${MF} .segment[data-segment="${editing}"]`)).toBeFocused()
})

// ── A region-qualified locale must reach Intl ─────────────────────────────────
// The collapsed translation key (de-DE → en, because there is no `de` bundle) was
// being handed to Intl as well, so every name Intl produces came out English
// under any locale whose region matters. Invisible in the kitchensink, which only
// demos en-GB and sv-SE — the two locales where the collapse happens to preserve
// the language. Expectations are computed from ICU in-page rather than hardcoded,
// so this asserts the wiring and not a snapshot of one ICU version.
async function serveAs(page, locale) {
  await page.route('**/*', async (route) => {
    const r = await route.fetch()
    if (!(r.headers()['content-type'] ?? '').includes('text/html')) {
      return route.fulfill({ response: r })
    }
    const body = (await r.text()).replace(/data-locale="[^"]*"/g, `data-locale="${locale}"`)
    await route.fulfill({ response: r, body })
  })
  await page.goto(targetPath())
}

test('de-DE renders German month names, not English ones', async ({ page }) => {
  await serveAs(page, 'de-DE')
  await page.locator(`${MF} .trigger`).first().click()

  const expected = await page.evaluate(() =>
    new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(2026, 9, 1)))
  expect(expected).not.toBe('October')   // guard: the probe itself must be meaningful

  const names = await page.locator(`${MF} .Wheel[data-picker="month"] .option`)
    .evaluateAll((els) => els.map((e) => e.textContent.trim()))
  expect(names).toContain(expected)
})

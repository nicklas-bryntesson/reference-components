// tests/DateField.e2e.test.js
import { test, expect } from '@playwright/test'
import { injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y, expectEveryPopupButtonReachable } from '../../../../e2e-helpers/target.js'

const TARGET = targetId('DateField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(TARGET).scrollIntoViewIfNeeded()
  await injectAxe(page)
})

test('custom UI is shown on pointer:fine', async ({ page }) => {
  const custom = page.locator('[data-id="birthdate"] .custom')
  await expect(custom).toBeVisible()
  const native = page.locator('[data-id="birthdate"] .native')
  await expect(native).not.toBeVisible()
})

test('segments group has aria-labelledby or aria-label', async ({ page }) => {
  const segments = page.locator('[data-id="birthdate"] .segments')
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
  const trigger = page.locator('[data-id="birthdate"] .trigger')
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await trigger.click()
  expect(await trigger.getAttribute('aria-controls')).toBeNull()
  await page.keyboard.press('Escape')
})

test('calendar does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
})

test('calendar is visible inside rail when open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const calendar = page.locator('[data-id="birthdate"] .rail .popup')
  await expect(calendar).toBeVisible()
})

test('calendar is removed on Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-id="birthdate"] .trigger')).toBeFocused()
})

test('calendar is removed on outside click', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
})

test('date selection closes calendar and syncs native input', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const firstDay = page.locator(`${TARGET} .popup td:not([data-outside-month="true"]):not([aria-disabled="true"]) button`).first()
  const dateLabel = await firstDay.getAttribute('data-date')
  await firstDay.click({ force: true })
  await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
  const nativeValue = await page.locator('[data-id="birthdate"] .native').inputValue()
  expect(nativeValue).toBe(dateLabel)
})

test('aria-selected is on td not button', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  // All td elements in grid should have aria-selected
  const tdsWithAriaSelected = page.locator(`${TARGET} .grid td[aria-selected]`)
  const count = await tdsWithAriaSelected.count()
  expect(count).toBeGreaterThan(0)
  // No buttons should have aria-selected
  await expect(page.locator(`${TARGET} .grid button[aria-selected]`)).toHaveCount(0)
})

test('aria-disabled is on td not button for disabled cells', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const disabledButtons = page.locator(`${TARGET} .grid button[aria-disabled="true"]`)
  expect(await disabledButtons.count()).toBe(0) // aria-disabled never on button — only on td
  await page.keyboard.press('Escape')
})

test('Tab wraps from last to first focusable element in calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  // Last tabbable element is the Today button in the footer
  const todayBtn = page.locator(`${TARGET} .calendar-footer-today`)
  await todayBtn.focus()
  await page.keyboard.press('Tab')
  // Should wrap to first (prev-month button)
  const prevMonthBtn = page.locator(`${TARGET} .calendar-header button`).first()
  await expect(prevMonthBtn).toBeFocused()
  await page.keyboard.press('Escape')
})

test('data-state="open" on root when calendar open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator('[data-id="birthdate"][data-state="open"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-id="birthdate"][data-state="idle"]')).toHaveCount(1)
})

test('axe: zero violations on initial render', async ({ page }) => {
  await scopedCheckA11y(page, TARGET, {
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }
  })
})

test('axe: zero violations with calendar open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await scopedCheckA11y(page, TARGET, {
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }
  })
  await page.keyboard.press('Escape')
})

test('data-direction is set on root when calendar opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"]').scrollIntoViewIfNeeded()
  await page.locator('[data-id="birthdate"] .trigger').click()
  const direction = await page.locator('[data-id="birthdate"]').getAttribute('data-direction')
  expect(['top', 'bottom']).toContain(direction)
  await page.keyboard.press('Escape')
})

// ── Month/Year Picker ─────────────────────────────────────────────────────────

test('month-year-trigger opens picker on click', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  const picker = page.locator(`${TARGET} .popup [data-panel="picker"]`)
  await expect(picker).toHaveAttribute('data-active', 'true')
})

test('month-year-trigger has aria-expanded true when picker open', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  const trigger = page.locator(`${TARGET} .month-year-trigger`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

test('month-year-trigger uses aria-controls (not aria-haspopup) for the picker', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const trigger = page.locator('[data-id="birthdate"] .month-year-trigger')
  expect(await trigger.getAttribute('aria-haspopup')).toBeNull()
  const controls = await trigger.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  await expect(page.locator(`#${controls}`)).toHaveAttribute('data-panel', 'picker')
})

test('month and year wheels are spinbuttons when picker opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await expect(page.locator(`${TARGET} .popup .Wheel[data-picker="month"]`)).toHaveAttribute('role', 'spinbutton')
  await expect(page.locator(`${TARGET} .popup .Wheel[data-picker="year"]`)).toHaveAttribute('role', 'spinbutton')
})

test('month wheel receives focus when picker opens', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await expect(page.locator(`${TARGET} .popup .Wheel[data-picker="month"]`)).toBeFocused()
})

test('ArrowDown on the year wheel navigates the calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const header = page.locator('[data-id="birthdate"] .month-year-trigger')
  await header.click()
  const before = await header.textContent()
  await page.locator(`${TARGET} .popup .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap animation
  expect(await header.textContent()).not.toBe(before)
})

test('Tab moves focus from month wheel to year wheel', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await page.keyboard.press('Tab')
  await expect(page.locator(`${TARGET} .popup .Wheel[data-picker="year"]`)).toBeFocused()
})

test('clicking the header again returns to the calendar view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  const picker = page.locator(`${TARGET} .popup [data-panel="picker"]`)
  await expect(picker).toHaveAttribute('data-active', 'false')
})

test('Escape from picker returns to calendar view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await page.keyboard.press('Escape')
  const picker = page.locator(`${TARGET} .popup [data-panel="picker"]`)
  await expect(picker).toHaveAttribute('data-active', 'false')
})

test('Escape from picker does not close calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
})

test('spinning the year wheel updates the underlying field', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  const native = page.locator('[data-id="birthdate"] .native')
  await expect(native).toHaveValue('') // birthdate starts empty
  await page.locator(`${TARGET} .popup .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap
  await expect(native).not.toHaveValue('') // the wheel applied a date to the field
})

test('month wheel loops past the year boundary (Jan ↔ Dec)', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  const month = page.locator(`${TARGET} .popup .Wheel[data-picker="month"]`)
  await month.focus()
  const v0 = Number(await month.getAttribute('aria-valuenow'))
  // Step up to 0, then once more — a looping wheel wraps to 11, a capped one stays at 0
  for (let i = 0; i <= v0; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150) }
  await page.waitForTimeout(400)
  await expect(month).toHaveAttribute('aria-valuenow', '11')
})

test('axe: no violations in picker view', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await page.locator('[data-id="birthdate"] .month-year-trigger').click()
  await scopedCheckA11y(page, TARGET)
})

// ── Keyboard access (atomica11y: date-picker-dialog §1) ──────────────────────

test('Space opens calendar from trigger', async ({ page }) => {
  const trigger = page.locator('[data-id="birthdate"] .trigger')
  await trigger.focus()
  await page.keyboard.press('Space')
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await page.keyboard.press('Escape')
})

test('Enter opens calendar from trigger', async ({ page }) => {
  const trigger = page.locator('[data-id="birthdate"] .trigger')
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await page.keyboard.press('Escape')
})

test('ArrowRight moves focus to next day in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const firstDay = page.locator(`${TARGET} .popup td:not([data-outside-month="true"]):not([aria-disabled="true"]) button`).first()
  await firstDay.focus()
  const initialDate = await firstDay.getAttribute('data-date')
  await page.keyboard.press('ArrowRight')
  const focused = page.locator(`${TARGET} .grid button:focus`)
  const nextDate = await focused.getAttribute('data-date')
  expect(nextDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('ArrowLeft moves focus to previous day in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const days = page.locator(`${TARGET} .popup td:not([data-outside-month="true"]):not([aria-disabled="true"]) button`)
  const secondDay = days.nth(1)
  await secondDay.focus()
  const initialDate = await secondDay.getAttribute('data-date')
  await page.keyboard.press('ArrowLeft')
  const focused = page.locator(`${TARGET} .grid button:focus`)
  const prevDate = await focused.getAttribute('data-date')
  expect(prevDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('ArrowDown moves focus one week forward in calendar grid', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const firstDay = page.locator(`${TARGET} .popup td:not([data-outside-month="true"]):not([aria-disabled="true"]) button`).first()
  await firstDay.focus()
  const initialDate = await firstDay.getAttribute('data-date')
  await page.keyboard.press('ArrowDown')
  const focused = page.locator(`${TARGET} .grid button:focus`)
  const nextDate = await focused.getAttribute('data-date')
  expect(nextDate).not.toBe(initialDate)
  await page.keyboard.press('Escape')
})

test('PageDown moves calendar to next month', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const monthLabel = page.locator(`${TARGET} .month-year-trigger`)
  const initialLabel = await monthLabel.textContent()
  await page.locator(`${TARGET} .grid`).focus()
  await page.keyboard.press('PageDown')
  const nextLabel = await monthLabel.textContent()
  expect(nextLabel).not.toBe(initialLabel)
  await page.keyboard.press('Escape')
})

test('PageUp moves calendar to previous month', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  const monthLabel = page.locator(`${TARGET} .month-year-trigger`)
  const initialLabel = await monthLabel.textContent()
  await page.locator(`${TARGET} .grid`).focus()
  await page.keyboard.press('PageUp')
  const nextLabel = await monthLabel.textContent()
  expect(nextLabel).not.toBe(initialLabel)
  await page.keyboard.press('Escape')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  // "Today" is the last tab stop (Clear is disabled while empty). Tab must wrap
  // back into the calendar, not escape the aria-modal dialog.
  await page.locator(`${TARGET} .popup .calendar-footer-today`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, TARGET)
  expect(inside).toBe(true)
})

test('Shift+Tab from the first tab stop keeps focus inside the calendar', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await page.locator(`${TARGET} .popup .prev-month`).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, TARGET)
  expect(inside).toBe(true)
})

test('Tab from a focused grid day exits the grid as one composite stop (→ next-month)', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  // Focus the grid's roving day cell. Tab must leave the grid (WAI-ARIA grid is
  // ONE tab stop), not step to the adjacent day.
  const day = page.locator(`${TARGET} .popup td:not([data-outside-month="true"]):not([aria-disabled="true"]) button[tabindex="0"]`)
  await day.focus()
  await page.keyboard.press('Tab')
  const landedOnDay = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('.grid td button')),
  )
  expect(landedOnDay).toBe(false)
  await expect(page.locator(`${TARGET} .popup .next-month`)).toBeFocused()
})

test('Escape closes the calendar and returns focus to the trigger', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  await page.locator(`${TARGET} .grid`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TARGET} .popup`)).toHaveCount(0)
  await expect(page.locator('[data-id="birthdate"] .trigger')).toBeFocused()
})

test('wheel event on the calendar surface (off a wheel) is defaultPrevented', async ({ page }) => {
  await page.locator('[data-id="birthdate"] .trigger').click()
  await expect(page.locator(`${TARGET} .popup`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, TARGET)
  expect(prevented).toBe(true)
})

// ── Roving tabindex: out and back in ──────────────────────────────────────────
// The suite could tab *within* the segment group and *off* it, but never off and
// back, so a roving tabindex that never roved back was invisible: intercepting
// Tab on the last segment set every segment to -1, leaving the whole group with
// no tab stop and the field keyboard-unreachable for the rest of the page's
// life. A WCAG 2.1.1 failure that axe has no rule for.
test('the segment group keeps a tab stop after focus leaves it', async ({ page }) => {
  const segs = page.locator(`${TARGET} .segment[tabindex]`)
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
  const segs = page.locator(`${TARGET} .segment[tabindex]`)
  const n = await segs.count()

  await segs.first().focus()
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  const editing = await page.evaluate(() => document.activeElement?.dataset?.segment ?? null)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')

  await expect(page.locator(`${TARGET} .segment[data-segment="${editing}"]`)).toBeFocused()
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

test('de-DE renders German weekday names, not English ones', async ({ page }) => {
  await serveAs(page, 'de-DE')
  await page.locator(`${TARGET} .trigger`).first().click()

  const expected = await page.evaluate(() =>
    [...Array(7)].map((_, i) =>
      new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(2026, 5, 1 + i))))

  const heads = await page.locator(`${TARGET} thead th`).evaluateAll((els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean))

  // A week-number column may lead the row; compare the trailing seven.
  expect(heads.slice(-7)).toEqual(expected)
})

// ── Tab-stop membership ───────────────────────────────────────────────────────
// Containment and membership are different properties. The trap tests above prove
// focus cannot escape the popup; this proves the cycle actually includes every
// control in it. A dropped tab stop leaves the first property intact and makes a
// control keyboard-unreachable — WCAG 2.1.1, and invisible to axe.
test('every standalone control in the popup is reachable by Tab', async ({ page }) => {
  await page.locator(`${TARGET} .trigger`).first().click()
  await expect(page.locator(`${TARGET} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, TARGET)
})

test('the same holds for controls that only become actionable with a value', async ({ page }) => {
  // Clear is disabled while the field is empty, so the check above cannot see it —
  // and `.footer-clear` / `.calendar-footer-clear` were among the tab-stop lookups
  // that survived mutation. Populate through the UI, then check the fuller set.
  await page.locator(`${TARGET} .trigger`).first().click()
  await page.locator(`${TARGET} .calendar-footer-today`).click()
  if (!(await page.locator(`${TARGET} [role="dialog"]`).isVisible())) {
    await page.locator(`${TARGET} .trigger`).first().click()
  }
  await expect(page.locator(`${TARGET} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, TARGET)
})

test('Clear is disabled while there is nothing to clear', async ({ page }) => {
  // The lookup that maintains this was another mutation survivor: break it and
  // Clear stays enabled on an empty field, offering an action that does nothing.
  await page.locator(`${TARGET} .trigger`).first().click()
  await expect(page.locator(`${TARGET} .calendar-footer-clear`)).toBeDisabled()

  await page.locator(`${TARGET} .calendar-footer-today`).click()
  if (!(await page.locator(`${TARGET} [role="dialog"]`).isVisible())) {
    await page.locator(`${TARGET} .trigger`).first().click()
  }
  await expect(page.locator(`${TARGET} .calendar-footer-clear`)).toBeEnabled()
})

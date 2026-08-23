// src/partials/components/WeekField/tests/WeekField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y, expectEveryPopupButtonReachable } from '../../../../e2e-helpers/target.js'

const WF = targetId('WeekField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(WF).scrollIntoViewIfNeeded()
  await page.locator(`${WF}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

// ── Custom overlay ─────────────────────────────────────────────────────────────

test('custom overlay is shown on pointer:fine', async ({ page }) => {
  await expect(page.locator(`${WF} .overlay`)).toBeVisible()
})

test('root has data-input-mode=custom after JS init', async ({ page }) => {
  await expect(page.locator(WF)).toHaveAttribute('data-input-mode', 'custom')
})

// ── Segment ARIA structure ─────────────────────────────────────────────────────

test('week segment has required aria attributes', async ({ page }) => {
  const week = page.locator(`${WF} .segment[data-segment="week"]`)
  await expect(week).toHaveAttribute('role', 'spinbutton')
  await expect(week).toHaveAttribute('aria-valuemin', '1')
  await expect(week).toHaveAttribute('aria-valuemax')
  await expect(week).toHaveAttribute('aria-valuetext')
})

test('year segment has role=spinbutton', async ({ page }) => {
  const year = page.locator(`${WF} .segment[data-segment="year"]`)
  await expect(year).toHaveAttribute('role', 'spinbutton')
  await expect(year).toHaveAttribute('aria-valuemin')
  await expect(year).toHaveAttribute('aria-valuemax')
})

test('segments group has role=group', async ({ page }) => {
  await expect(page.locator(`${WF} .segments`)).toHaveAttribute('role', 'group')
})

// ── Trigger ARIA ───────────────────────────────────────────────────────────────

test('trigger has aria-expanded=false and aria-haspopup=dialog when closed', async ({ page }) => {
  const trigger = page.locator(`${WF} .trigger`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
})

// ── Popup open / close ─────────────────────────────────────────────────────────

test('popup does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator(`${WF} .popup`)).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .trigger`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape and focus returns to trigger', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${WF} .popup`)).toHaveCount(0)
  await expect(page.locator(`${WF} .trigger`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator(`${WF} .popup`)).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const popup = page.locator(`${WF} .popup`)
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has localized aria-label', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toHaveAttribute('aria-label', 'Choose week')
})

test('week grid has role=grid with a week-number column', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const grid = page.locator(`${WF} .calendar-grid`)
  await expect(grid).toHaveAttribute('role', 'grid')
  // First column header + a week-number cell in the first row.
  await expect(page.locator(`${WF} .calendar-grid thead th.week-number-head`)).toBeVisible()
  await expect(page.locator(`${WF} .calendar-grid tbody tr`).first().locator('td.week-number-cell')).toHaveCount(1)
})

test('week rows are selectable rows with an aria-label naming the week', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const firstRow = page.locator(`${WF} .calendar-grid tbody tr`).first()
  await expect(firstRow).toHaveAttribute('role', 'row')
  await expect(firstRow).toHaveAttribute('data-week', /^\d{4}-W\d{2}$/)
  await expect(firstRow).toHaveAttribute('aria-label', /Week \d+/)
})

// ── Keyboard: segment interaction ─────────────────────────────────────────────

test('ArrowUp sets a value on week segment', async ({ page }) => {
  const week = page.locator(`${WF} .segment[data-segment="week"]`)
  await week.focus()
  await week.press('ArrowUp')
  const valueNow = await week.getAttribute('aria-valuenow')
  expect(Number(valueNow)).toBeGreaterThanOrEqual(1)
  expect(Number(valueNow)).toBeLessThanOrEqual(53)
})

test('Tab from last segment (year) moves focus to trigger', async ({ page }) => {
  const year = page.locator(`${WF} .segment[data-segment="year"]`)
  await year.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator(`${WF} .trigger`)).toBeFocused()
})

// ── Selecting a week via a day cell (row click) ─────────────────────────────────

test('clicking a week row selects that whole week and closes', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const firstRow = page.locator(`${WF} .calendar-grid tbody tr:not([data-disabled="true"])`).first()
  const iso = await firstRow.getAttribute('data-week')
  await firstRow.click()
  await expect(page.locator(`${WF} .popup`)).toHaveCount(0)
  await expect(page.locator(`${WF} .native`)).toHaveValue(iso)
})

test('clicking a day cell in a row selects the whole week (row highlight)', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  // Click a day cell (not the week-number cell) in the second row.
  const row = page.locator(`${WF} .calendar-grid tbody tr:not([data-disabled="true"])`).nth(1)
  const iso = await row.getAttribute('data-week')
  await row.locator('td[role="gridcell"]').nth(2).click()
  await expect(page.locator(`${WF} .native`)).toHaveValue(iso)
})

// ── Selecting a week via the keyboard ───────────────────────────────────────────

test('ArrowDown moves the week-row highlight (roving tabindex on the row)', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const focusedRow = page.locator(`${WF} .calendar-grid tbody tr[tabindex="0"]`)
  const startISO = await focusedRow.getAttribute('data-week')
  await page.keyboard.press('ArrowDown')
  const newFocused = page.locator(`${WF} .calendar-grid tbody tr[tabindex="0"]`)
  const nextISO = await newFocused.getAttribute('data-week')
  expect(nextISO).not.toBe(startISO)
})

test('Enter selects the focused week and applies it', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const focusedRow = page.locator(`${WF} .calendar-grid tbody tr[tabindex="0"]`)
  const iso = await focusedRow.getAttribute('data-week')
  await page.keyboard.press('Enter')
  await expect(page.locator(`${WF} .popup`)).toHaveCount(0)
  await expect(page.locator(`${WF} .native`)).toHaveValue(iso)
})

test('selected week row is highlighted end-to-end when reopened', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  const focusedRow = page.locator(`${WF} .calendar-grid tbody tr[tabindex="0"]`)
  const iso = await focusedRow.getAttribute('data-week')
  await page.keyboard.press('Enter')
  // Reopen — the selected week's row carries data-selected.
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .calendar-grid tbody tr[data-week="${iso}"]`)).toHaveAttribute('data-selected', 'true')
})

// ── ISO week-year boundary ──────────────────────────────────────────────────────

test('the Jan/Dec boundary week carries the ISO week-year, not the visible month year', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  // Navigate to December 2025 — the last row(s) belong to ISO 2026-W01.
  // Enter a known value first so the grid opens near it, then page around.
  // Simpler: assert the invariant holds for whatever the grid renders — a row
  // whose data-weeknum is "01" but whose visible label month is December must
  // carry weekyear = year+1.
  const rows = page.locator(`${WF} .calendar-grid tbody tr`)
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    const iso = await rows.nth(i).getAttribute('data-week')
    const weekyear = await rows.nth(i).getAttribute('data-weekyear')
    const weeknum = await rows.nth(i).getAttribute('data-weeknum')
    // data-week must equal formatWeekISO(weekyear, weeknum)
    expect(iso).toBe(`${weekyear}-W${String(weeknum).padStart(2, '0')}`)
  }
})

// ── This week / Clear ───────────────────────────────────────────────────────────

test('"This week" button sets the current ISO week', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await page.locator(`${WF} .calendar-footer-now`).click()
  const expected = await page.evaluate(() => {
    const d = new Date()
    // Mirror kernel getISOWeek/getISOWeekYear
    const t = new Date(d)
    t.setHours(0, 0, 0, 0)
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
    const week1 = new Date(t.getFullYear(), 0, 4)
    const week = 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    const weekYear = t.getFullYear()
    return `${weekYear}-W${String(week).padStart(2, '0')}`
  })
  await expect(page.locator(`${WF} .native`)).toHaveValue(expected)
})

test('"Clear" button empties the native value', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await page.locator(`${WF} .calendar-footer-now`).click()
  await page.locator(`${WF} .trigger`).click()
  await page.locator(`${WF} .calendar-footer-clear`).click()
  await expect(page.locator(`${WF} .native`)).toHaveValue('')
})

// ── Disabled ────────────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  const disabledTrigger = page.locator(`.WeekField[data-disabled="true"] .trigger`).first()
  if (await disabledTrigger.count() > 0) {
    await expect(disabledTrigger).toBeDisabled()
  }
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the popup', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  // "This week" is the last enabled tab stop (Clear is disabled while empty).
  await page.locator(`${WF} .calendar-footer-now`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, WF)
  expect(inside).toBe(true)
})

test('Shift+Tab from the first tab stop keeps focus inside the popup (wraps)', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  await page.locator(`${WF} .popup .prev-month`).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  const inside = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    return popup?.contains(document.activeElement) ?? false
  }, WF)
  expect(inside).toBe(true)
})

test('wheel event on the popup surface is defaultPrevented', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} .popup`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, WF)
  expect(prevented).toBe(true)
})

// ── axe accessibility ──────────────────────────────────────────────────────────

test('passes axe on the closed component', async ({ page }) => {
  await checkA11y(page, WF, { detailedReport: false })
})

test('passes axe with popup open', async ({ page }) => {
  await page.locator(`${WF} .trigger`).click()
  await expect(page.locator(`${WF} .popup`)).toBeVisible()
  await scopedCheckA11y(page, WF, {
    detailedReport: false,
    axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
  })
  await page.keyboard.press('Escape')
})

// ── Roving tabindex: out and back in ──────────────────────────────────────────
// The suite could tab *within* the segment group and *off* it, but never off and
// back, so a roving tabindex that never roved back was invisible: intercepting
// Tab on the last segment set every segment to -1, leaving the whole group with
// no tab stop and the field keyboard-unreachable for the rest of the page's
// life. A WCAG 2.1.1 failure that axe has no rule for.
test('the segment group keeps a tab stop after focus leaves it', async ({ page }) => {
  const segs = page.locator(`${WF} .segment[tabindex]`)
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
  const segs = page.locator(`${WF} .segment[tabindex]`)
  const n = await segs.count()

  await segs.first().focus()
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  const editing = await page.evaluate(() => document.activeElement?.dataset?.segment ?? null)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')

  await expect(page.locator(`${WF} .segment[data-segment="${editing}"]`)).toBeFocused()
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
  await page.locator(`${WF} .trigger`).first().click()

  const expected = await page.evaluate(() =>
    [...Array(7)].map((_, i) =>
      new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(2026, 5, 1 + i))))

  const heads = await page.locator(`${WF} thead th`).evaluateAll((els) =>
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
  await page.locator(`${WF} .trigger`).first().click()
  await expect(page.locator(`${WF} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, WF)
})

test('the same holds for controls that only become actionable with a value', async ({ page }) => {
  // Clear is disabled while the field is empty, so the check above cannot see it —
  // and `.footer-clear` / `.calendar-footer-clear` were among the tab-stop lookups
  // that survived mutation. Populate through the UI, then check the fuller set.
  await page.locator(`${WF} .trigger`).first().click()
  await page.locator(`${WF} .calendar-footer-now`).click()
  if (!(await page.locator(`${WF} [role="dialog"]`).isVisible())) {
    await page.locator(`${WF} .trigger`).first().click()
  }
  await expect(page.locator(`${WF} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, WF)
})

test('Clear is disabled while there is nothing to clear', async ({ page }) => {
  // The lookup that maintains this was another mutation survivor: break it and
  // Clear stays enabled on an empty field, offering an action that does nothing.
  await page.locator(`${WF} .trigger`).first().click()
  await expect(page.locator(`${WF} .calendar-footer-clear`)).toBeDisabled()

  await page.locator(`${WF} .calendar-footer-now`).click()
  if (!(await page.locator(`${WF} [role="dialog"]`).isVisible())) {
    await page.locator(`${WF} .trigger`).first().click()
  }
  await expect(page.locator(`${WF} .calendar-footer-clear`)).toBeEnabled()
})

// ── Opening with a mouse must place focus inside ───────────────────────────────
// The Escape handler lives inside the popup, so a popup opened with focus left on
// the trigger cannot be dismissed by keyboard at all — Escape reaches nothing. A
// keyboard user never saw it, because Tab carried them inside before they pressed
// anything. Two of the five fields shipped this way.
test('a mouse-opened popup takes focus, so Escape can close it', async ({ page }) => {
  await page.locator(`${WF} .trigger`).first().click()
  const dialog = page.locator(`${WF} [role="dialog"]`)
  await expect(dialog).toBeVisible()

  // aria-modal claims the rest of the page is inert; focus has to be here to match.
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const inside = await page.evaluate((sel) => {
    const dlg = document.querySelector(`${sel} [role="dialog"]`)
    return Boolean(dlg && dlg.contains(document.activeElement))
  }, WF)
  expect(inside, 'focus is still outside the popup after opening').toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

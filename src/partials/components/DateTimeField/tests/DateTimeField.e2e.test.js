// src/partials/components/DateTimeField/tests/DateTimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, expectEveryPopupButtonReachable } from '../../../../e2e-helpers/target.js'

// Scope to the live-demo instance; the kitchensink renders many DateTimeFields,
// only this one carries data-id="meeting-datetime". Override via TARGET_ID when
// porting the suite to your own page.
const ROOT = targetId('DateTimeField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(ROOT).scrollIntoViewIfNeeded()
  await page.locator(`${ROOT}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

// ─── Accessibility audit ─────────────────────────────────────────────────────

test('passes axe accessibility audit', async ({ page }) => {
  await checkA11y(page, ROOT, {
    detailedReport: true,
    axeOptions: {
      rules: {
      },
    },
  })
})

// ─── Initialization ──────────────────────────────────────────────────────────

test('root has data-initialized', async ({ page }) => {
  await expect(page.locator(ROOT)).toBeAttached()
})

// ─── segments ────────────────────────────────────────────────────────────────

test('date and time segments are rendered as spinbuttons', async ({ page }) => {
  const segs = page.locator(`${ROOT} [data-part="segment"][role="spinbutton"]`)
  const types = await segs.evaluateAll(els => els.map(e => e.dataset.segment))
  expect(types).toContain('day')
  expect(types).toContain('month')
  expect(types).toContain('year')
  expect(types).toContain('hour')
  expect(types).toContain('minute')
})

test('segments have aria-valuemin, aria-valuemax, aria-valuetext', async ({ page }) => {
  const hourSeg = page.locator(`${ROOT} [data-part="segment"][data-segment="hour"]`)
  await expect(hourSeg).toHaveAttribute('aria-valuemin')
  await expect(hourSeg).toHaveAttribute('aria-valuemax')
  await expect(hourSeg).toHaveAttribute('aria-valuetext')
})

test('ArrowUp increments hour segment', async ({ page }) => {
  const hourSeg = page.locator(`${ROOT} [data-part="segment"][data-segment="hour"]`)
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
  const firstSeg = page.locator(`${ROOT} [data-part="segment"][role="spinbutton"]`).first()
  const secondSeg = page.locator(`${ROOT} [data-part="segment"][role="spinbutton"]`).nth(1)
  await firstSeg.focus()
  await page.keyboard.press('ArrowRight')
  await expect(secondSeg).toBeFocused()
})

test('native input is aria-hidden and tabindex -1', async ({ page }) => {
  const native = page.locator(`${ROOT} [data-part="native"]`)
  await expect(native).toHaveAttribute('aria-hidden', 'true')
  await expect(native).toHaveAttribute('tabindex', '-1')
})

test('the segment group is named from the <label for>', async ({ page }) => {
  const wired = await page.locator(ROOT).evaluate((root) => {
    const group = root.querySelector('[data-part="segments"]')
    const labelId = group.getAttribute('aria-labelledby')
    const label = labelId && document.getElementById(labelId)
    return { labelId, isLabel: label?.tagName.toLowerCase(), text: label?.textContent.trim() }
  })
  expect(wired.labelId).toBeTruthy()
  expect(wired.isLabel).toBe('label')
  expect(wired.text).toBe('Meeting date and time')
})

// ─── Calendar popup ───────────────────────────────────────────────────────────

test('trigger button opens the calendar popup', async ({ page }) => {
  const trigger = page.locator(`${ROOT} [data-part="trigger"]`)
  await trigger.click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
})

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const dialog = page.locator(`${ROOT} [data-part="popup"]`)
  await expect(dialog).toHaveAttribute('role', 'dialog')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('the trigger declares its popup, and the dialog gets a title — not the trigger label', async ({ page }) => {
  const trigger = page.locator(`${ROOT} [data-part="trigger"]`)
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  await trigger.click()
  // A dialog is named by what it IS ("Choose date and time"), not by the action
  // that opened it ("Open calendar") — the sibling fields all follow this.
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toHaveAttribute('aria-label', 'Choose date and time')
})

test('Escape closes the calendar and restores focus to trigger', async ({ page }) => {
  const trigger = page.locator(`${ROOT} [data-part="trigger"]`)
  await trigger.click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).not.toBeAttached()
  await expect(trigger).toBeFocused()
})

test('clicking a date closes the popup and updates segments', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const dateBtn = page.locator(`${ROOT} [data-part="popup"] td:not([data-outside-month="true"]):not([aria-disabled]) button`).first()
  await dateBtn.click({ force: true })
  // Date segments should now be filled
  const daySeg = page.locator(`${ROOT} [data-part="segment"][data-segment="day"]`)
  const val = await daySeg.getAttribute('aria-valuenow')
  expect(val).not.toBeNull()
})

// ─── Time wheels (shared spinner with TimeField) ───────────────────────────────

test('hour and minute wheels are visible in the popup', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} .Wheel[data-segment="hour"]`)).toBeVisible()
  await expect(page.locator(`${ROOT} .Wheel[data-segment="minute"]`)).toBeVisible()
})

test('hour wheel is a spinbutton with aria-label', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const hourWheel = page.locator(`${ROOT} .Wheel[data-segment="hour"]`)
  await expect(hourWheel).toHaveAttribute('role', 'spinbutton')
  const label = await hourWheel.getAttribute('aria-label')
  expect(label?.length).toBeGreaterThan(0)
})

test('ArrowDown on the hour wheel sets the hour segment', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const hourWheel = page.locator(`${ROOT} .Wheel[data-segment="hour"]`)
  await hourWheel.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap animation
  const hourSeg = page.locator(`${ROOT} [data-part="segment"][data-segment="hour"]`)
  await expect(hourSeg).not.toHaveAttribute('data-placeholder')
  expect(await hourSeg.getAttribute('aria-valuenow')).not.toBeNull()
})

// ─── AM/PM toggle ───────────────────────────────────────────────────────────────

test('AM/PM toggle is hidden in the 24h (en-GB) locale', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} [data-part="ampm"]`)).toBeHidden()
})

test('AM/PM toggle is shown and drives the hour in a 12h locale', async ({ page }) => {
  const TWELVE = '[data-component="DateTimeField"][data-id="dtf-12h"]'
  await page.locator(`${TWELVE}`).scrollIntoViewIfNeeded()
  await page.locator(`${TWELVE} [data-part="trigger"]`).click()

  const toggle = page.locator(`${TWELVE} [data-part="ampm"]`)
  await expect(toggle).toBeVisible()
  const native = page.locator(`${TWELVE} [data-part="native"]`)

  // Seeded value 14:35 → PM active. Switch to AM → hour drops by 12 (02:35).
  await expect(native).toHaveValue('2026-05-27T14:35')
  await page.locator(`${TWELVE} [data-part="ampm-option"][data-ampm="0"]`).click()
  await expect(native).toHaveValue('2026-05-27T02:35')
  await expect(page.locator(`${TWELVE} [data-part="ampm-option"][data-ampm="0"]`)).toHaveAttribute('aria-pressed', 'true')
})

// ─── "Nu" button ──────────────────────────────────────────────────────────────

test('"Nu" button sets current datetime and closes popup', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="calendar-footer-now"]`).click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).not.toBeAttached()
  const hourSeg = page.locator(`${ROOT} [data-part="segment"][data-segment="hour"]`)
  const val = await hourSeg.getAttribute('aria-valuenow')
  expect(val).not.toBeNull()
})

// ─── Clear ────────────────────────────────────────────────────────────────────

test('clear button empties all segments', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="calendar-footer-now"]`).click()
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="calendar-footer-clear"]`).click()
  const hourSeg = page.locator(`${ROOT} [data-part="segment"][data-segment="hour"]`)
  await expect(hourSeg).toHaveAttribute('data-placeholder')
})

// ─── Calendar navigation ─────────────────────────────────────────────────────

test('ArrowRight moves focus to next day', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const firstBtn = page.locator(`${ROOT} [data-part="popup"] td:not([data-outside-month="true"]):not([aria-disabled]) button`).first()
  await firstBtn.focus()
  const firstDate = await firstBtn.getAttribute('data-date')
  await page.keyboard.press('ArrowRight')
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-date'))
  expect(focused).not.toBe(firstDate)
})

test('PageDown navigates to next month', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const firstBtn = page.locator(`${ROOT} [data-part="popup"] td:not([data-outside-month="true"]):not([aria-disabled]) button`).first()
  await firstBtn.focus()
  const before = await page.locator(`${ROOT} [data-part="calendar-month-year"]`).textContent()
  await page.keyboard.press('PageDown')
  const after = await page.locator(`${ROOT} [data-part="calendar-month-year"]`).textContent()
  expect(after).not.toBe(before)
})

// ─── Month/Year picker wheels ───────────────────────────────────────────────

test('month/year picker opens as wheels', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  await expect(page.locator(`${ROOT} .Wheel[data-picker="month"]`)).toHaveAttribute('role', 'spinbutton')
  await expect(page.locator(`${ROOT} .Wheel[data-picker="year"]`)).toHaveAttribute('role', 'spinbutton')
})

test('month-year-trigger uses aria-controls (not aria-haspopup) for the picker', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const trigger = page.locator(`${ROOT} [data-part="month-year-trigger"]`)
  expect(await trigger.getAttribute('aria-haspopup')).toBeNull()
  const controls = await trigger.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  await expect(page.locator(`#${controls}`)).toHaveAttribute('data-panel', 'picker')
})

test('ArrowDown on the year wheel navigates the calendar', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  const header = page.locator(`${ROOT} [data-part="calendar-month-year"]`)
  const before = await header.textContent()
  await page.locator(`${ROOT} .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap animation
  expect(await header.textContent()).not.toBe(before)
})

test('Escape from the picker returns to the calendar (keeps popup open)', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  await page.locator(`${ROOT} .Wheel[data-picker="month"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${ROOT} [data-panel="picker"]`)).toHaveAttribute('data-active', 'false')
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
})

test('Escape from the picker keeps the wheel-applied date — field and grid stay in sync', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  const header = page.locator(`${ROOT} [data-part="calendar-month-year"]`)
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  await page.locator(`${ROOT} .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(600) // snap + commit
  const native = page.locator(`${ROOT} [data-part="native"]`)
  const applied = await native.inputValue()
  expect(applied).not.toBe('') // the wheel applied a datetime live
  await page.keyboard.press('Escape')
  // The wheels edit live (same model as the time wheels) — Escape only closes
  // the panel. The value must survive AND the calendar heading must show the
  // applied year: an "undo" that reverts only the view desyncs field and grid.
  await expect(native).toHaveValue(applied)
  expect(await header.textContent()).toContain(applied.slice(0, 4))
})

test('spinning the year wheel updates the underlying field', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  const native = page.locator(`${ROOT} [data-part="native"]`)
  await expect(native).toHaveValue('') // meeting-datetime starts empty
  await page.locator(`${ROOT} .Wheel[data-picker="year"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500) // snap
  await expect(native).not.toHaveValue('') // the wheel wrote the datetime to the field
})

test('month wheel loops past the year boundary (Jan ↔ Dec)', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await page.locator(`${ROOT} [data-part="month-year-trigger"]`).click()
  const month = page.locator(`${ROOT} .Wheel[data-picker="month"]`)
  await month.focus()
  const v0 = Number(await month.getAttribute('aria-valuenow'))
  for (let i = 0; i <= v0; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150) }
  await page.waitForTimeout(400)
  await expect(month).toHaveAttribute('aria-valuenow', '11')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the calendar', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  // "Now" is the last tab stop. Tab must wrap back into the calendar, not
  // escape the aria-modal dialog (this calendar previously had no Tab trap).
  await page.locator(`${ROOT} [data-part="popup"] [data-part="calendar-footer-now"]`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.locator(`${ROOT} [data-part="popup"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside).toBe(true)
})

test('Shift+Tab from the first tab stop keeps focus inside the calendar', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  await page.locator(`${ROOT} [data-part="popup"] [data-part="prev-month"]`).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  const inside = await page.locator(`${ROOT} [data-part="popup"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside).toBe(true)
})

test('Tab from a focused grid day exits the grid as one composite stop (→ time wheel)', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  // Focus the grid's roving day cell. Tab must leave the grid (WAI-ARIA grid is
  // ONE tab stop) and land on the first time wheel, not the adjacent day.
  const day = page.locator(`${ROOT} [data-part="popup"] [data-part="calendar-grid"] td:not([data-outside-month="true"]):not([aria-disabled]) button[tabindex="0"]`)
  await day.focus()
  await page.keyboard.press('Tab')
  const landedOnDay = await page.evaluate((rootSel) => {
    const active = document.activeElement
    return Boolean(active?.closest(`${rootSel} [data-part="calendar-grid"] td button`))
  }, ROOT)
  expect(landedOnDay).toBe(false)
  await expect(page.locator(`${ROOT} .Wheel[data-segment="hour"]`)).toBeFocused()
})

test('wheel event on the calendar surface (off a wheel) is defaultPrevented', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()
  await expect(page.locator(`${ROOT} [data-part="popup"]`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} [data-part="popup"]`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, ROOT)
  expect(prevented).toBe(true)
})

// ── Roving tabindex: out and back in ──────────────────────────────────────────
// The suite could tab *within* the segment group and *off* it, but never off and
// back, so a roving tabindex that never roved back was invisible: intercepting
// Tab on the last segment set every segment to -1, leaving the whole group with
// no tab stop and the field keyboard-unreachable for the rest of the page's
// life. A WCAG 2.1.1 failure that axe has no rule for.
test('the segment group keeps a tab stop after focus leaves it', async ({ page }) => {
  const segs = page.locator(`${ROOT} [data-part="segment"][tabindex]`)
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
  const segs = page.locator(`${ROOT} [data-part="segment"][tabindex]`)
  const n = await segs.count()

  await segs.first().focus()
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  const editing = await page.evaluate(() => document.activeElement?.dataset?.segment ?? null)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')

  await expect(page.locator(`${ROOT} [data-part="segment"][data-segment="${editing}"]`)).toBeFocused()
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
  await page.locator(`${ROOT} [data-part="trigger"]`).first().click()

  const expected = await page.evaluate(() =>
    [...Array(7)].map((_, i) =>
      new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(2026, 5, 1 + i))))

  const heads = await page.locator(`${ROOT} thead th`).evaluateAll((els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean))

  // A week-number column may lead the row; compare the trailing seven.
  expect(heads.slice(-7)).toEqual(expected)
})

// ── Calendar cell state must reach the stylesheet ─────────────────────────────
// `_renderMonth()` styled `td[data-today="true"]` and `td[data-disabled="true"]`
// without ever setting either, so today was not bold and an out-of-range day
// looked ordinary — while DateField and WeekField, on the same markup shape, set
// both. The aria half was already correct, which is why no accessibility test
// could see it. The static dead-selector check catches the `data-today` half but
// cannot see element context, so the rendering is asserted here.

test('today is marked in the calendar and rendered differently', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).click()

  const today = page.locator(`${ROOT} [data-part="calendar-grid"] td[data-today="true"] button`)
  await expect(today).toHaveCount(1)

  const weights = await page.locator(ROOT).evaluate((el) => {
    const t = el.querySelector('td[data-today="true"] button')
    const other = [...el.querySelectorAll('td button')].find(
      (b) => b !== t && b.textContent.trim() && !b.closest('td[data-outside-month]'))
    return { today: getComputedStyle(t).fontWeight, other: getComputedStyle(other).fontWeight }
  })

  expect(weights.today).not.toBe(weights.other)
})

test('a day outside the allowed range is marked disabled and rendered muted', async ({ page }) => {
  // No kitchensink instance authors a range, so inject one. The 15th always has
  // days both before and after it inside the same month.
  const now = new Date()
  const min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T00:00`
  await page.route('**/*', async (route) => {
    const r = await route.fetch()
    if (!(r.headers()['content-type'] ?? '').includes('text/html')) {
      return route.fulfill({ response: r })
    }
    const body = (await r.text()).replace(
      /data-component="DateTimeField"/g, `data-component="DateTimeField" data-min="${min}"`)
    await route.fulfill({ response: r, body })
  })
  await page.goto(targetPath())
  await page.locator(`${ROOT} [data-part="trigger"]`).click()

  const colours = await page.locator(ROOT).evaluate((el) => {
    const cells = [...el.querySelectorAll('[data-part="calendar-grid"] td[data-date], [data-part="calendar-grid"] td')]
      .filter((td) => td.querySelector('button[data-date]'))
    const off = cells.find((td) => td.dataset.disabled === 'true')
    const on = cells.find((td) => td.dataset.disabled !== 'true')
    return {
      disabledCount: cells.filter((td) => td.dataset.disabled === 'true').length,
      enabledCount: cells.filter((td) => td.dataset.disabled !== 'true').length,
      offColour: off ? getComputedStyle(off.querySelector('button')).color : null,
      onColour: on ? getComputedStyle(on.querySelector('button')).color : null,
    }
  })

  expect(colours.disabledCount).toBeGreaterThan(0)
  expect(colours.enabledCount).toBeGreaterThan(0)
  expect(colours.offColour).not.toBe(colours.onColour)
})

// ── Tab-stop membership ───────────────────────────────────────────────────────
// Containment and membership are different properties. The trap tests above prove
// focus cannot escape the popup; this proves the cycle actually includes every
// control in it. A dropped tab stop leaves the first property intact and makes a
// control keyboard-unreachable — WCAG 2.1.1, and invisible to axe.
test('every standalone control in the popup is reachable by Tab', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  await expect(page.locator(`${ROOT} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, ROOT)
})

test('the same holds for controls that only become actionable with a value', async ({ page }) => {
  // Clear is disabled while the field is empty, so the check above cannot see it —
  // and `.footer-clear` / `.calendar-footer-clear` were among the tab-stop lookups
  // that survived mutation. Populate through the UI, then check the fuller set.
  await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  await page.locator(`${ROOT} [data-part="calendar-footer-today"]`).click()
  if (!(await page.locator(`${ROOT} [role="dialog"]`).isVisible())) {
    await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  }
  await expect(page.locator(`${ROOT} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, ROOT)
})

test('Clear is disabled while there is nothing to clear', async ({ page }) => {
  // The lookup that maintains this was another mutation survivor: break it and
  // Clear stays enabled on an empty field, offering an action that does nothing.
  await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  await expect(page.locator(`${ROOT} [data-part="calendar-footer-clear"]`)).toBeDisabled()

  await page.locator(`${ROOT} [data-part="calendar-footer-today"]`).click()
  if (!(await page.locator(`${ROOT} [role="dialog"]`).isVisible())) {
    await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  }
  await expect(page.locator(`${ROOT} [data-part="calendar-footer-clear"]`)).toBeEnabled()
})

// ── Opening with a mouse must place focus inside ───────────────────────────────
// The Escape handler lives inside the popup, so a popup opened with focus left on
// the trigger cannot be dismissed by keyboard at all — Escape reaches nothing. A
// keyboard user never saw it, because Tab carried them inside before they pressed
// anything. Two of the five fields shipped this way.
test('a mouse-opened popup takes focus, so Escape can close it', async ({ page }) => {
  await page.locator(`${ROOT} [data-part="trigger"]`).first().click()
  const dialog = page.locator(`${ROOT} [role="dialog"]`)
  await expect(dialog).toBeVisible()

  // aria-modal claims the rest of the page is inert; focus has to be here to match.
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const inside = await page.locator(`${ROOT} [role="dialog"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside, 'focus is still outside the popup after opening').toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

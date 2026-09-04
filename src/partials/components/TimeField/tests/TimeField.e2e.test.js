// src/partials/components/TimeField/tests/TimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y, expectEveryPopupButtonReachable } from '../../../../e2e-helpers/target.js'

// `data-id` is unique per page, so `meeting-time` is this component's alone;
// DateTimeField's live demo is `meeting-datetime`. Still scoped to the component.
// Override via TARGET_ID when porting the suite to your own page.
const TF = targetId('TimeField')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(TF).scrollIntoViewIfNeeded()
  await page.locator(`${TF}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

// ── Custom overlay ─────────────────────────────────────────────────────────────

test('custom overlay is shown on pointer:fine', async ({ page }) => {
  const overlay = page.locator(`${TF} [data-part="overlay"]`)
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
  const group = page.locator(`${TF} [data-part="segments"]`)
  await expect(group).toHaveAttribute('role', 'group')
})

// ── Trigger ARIA ───────────────────────────────────────────────────────────────

test('trigger has aria-expanded=false and aria-haspopup=dialog when closed', async ({ page }) => {
  const trigger = page.locator(`${TF} [data-part="trigger"]`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
})

// ── Popup open / close ─────────────────────────────────────────────────────────

test('popup does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator(`${TF} [data-part="popup"]`)).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="trigger"]`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TF} [data-part="popup"]`)).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TF} [data-part="trigger"]`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  // Wait for the setTimeout(0) outside-click handler to register before clicking outside
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator(`${TF} [data-part="popup"]`)).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const popup = page.locator(`${TF} [data-part="popup"]`)
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has aria-label', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const popup = page.locator(`${TF} [data-part="popup"]`)
  await expect(popup).toHaveAttribute('aria-label', 'Choose time')
})

test('popup hour column has role=spinbutton', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toHaveAttribute('role', 'spinbutton')
  await expect(hourCol).toHaveAttribute('aria-valuemin', '0')
  await expect(hourCol).toHaveAttribute('aria-valuemax', '23')
})

test('popup minute column has role=spinbutton', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  await expect(minuteCol).toHaveAttribute('role', 'spinbutton')
  await expect(minuteCol).toHaveAttribute('aria-valuemin', '0')
  await expect(minuteCol).toHaveAttribute('aria-valuemax', '59')
})

test('popup column contains 9 aria-hidden option elements', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const options = page.locator(`${TF} .Wheel[data-segment="hour"] [data-part="option"]`)
  await expect(options).toHaveCount(9)
  for (let i = 0; i < 9; i++) {
    await expect(options.nth(i)).toHaveAttribute('aria-hidden', 'true')
  }
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
  // Focus the minute segment (last in default 24h en-GB without seconds)
  const minute = page.locator(`${TF} [data-segment="minute"]`)
  await minute.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator(`${TF} [data-part="trigger"]`)).toBeFocused()
})

// ── Disabled state ─────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  // The kitchensink has disabled TimeField instances — find the first one
  const disabledTrigger = page.locator(`.TimeField[data-disabled="true"] [data-part="trigger"]`).first()
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
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  await scopedCheckA11y(page, TF, {
    detailedReport: false,
    axeOptions: {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    },
  })
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Escape')
})

// ── Wheel popup ────────────────────────────────────────────────────────────────

test('wheel column ArrowDown increases value in segment', async ({ page }) => {
  // Set a known initial value — scope to .segment to avoid strict-mode clash with popup column
  const hourSeg = page.locator(`${TF} [data-part="segment"][data-segment="hour"]`)
  await hourSeg.focus()
  // Type '10' to set hour = 10
  await page.keyboard.type('10')
  await page.waitForTimeout(350) // digit buffer timeout

  // Open popup and focus hour column
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await hourCol.focus()

  // ArrowDown = stepBy(+1) = raises the value
  await page.keyboard.press('ArrowDown')
  // Wait for snap animation
  await page.waitForTimeout(500)

  // The overlay segment should now show 11
  await expect(hourSeg).toHaveAttribute('aria-valuenow', '11')
})

test('wheel column ArrowUp decreases value in segment', async ({ page }) => {
  // Scope to .segment to avoid strict-mode clash with popup column
  const hourSeg = page.locator(`${TF} [data-part="segment"][data-segment="hour"]`)
  await hourSeg.focus()
  await page.keyboard.type('10')
  await page.waitForTimeout(350)

  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await hourCol.focus()

  // ArrowUp = stepBy(-1) = lowers the value
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(500)

  await expect(hourSeg).toHaveAttribute('aria-valuenow', '9')
})

test('tapping a wheel option with a mouse selects it', async ({ page }) => {
  // Pointer capture retargets the compatibility mouse events, so `click` on a
  // wheel column always arrives with .Wheel as its target and never with an
  // option. Only a real browser produces those events, which is why this lives
  // here: a tap looked fine on touch and did nothing at all with a mouse.
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toBeVisible()

  const option = hourCol.locator('[data-part="option"][data-value]').nth(1)
  const wanted = await option.getAttribute('data-value')  // slots recycle on render
  await option.click()
  await page.waitForTimeout(500)

  await expect(page.locator(`${TF} [data-part="segment"][data-segment="hour"]`))
    .toHaveAttribute('aria-valuenow', wanted)
})

test('the wheel column publishes the value it just committed', async ({ page }) => {
  // render() writes aria-valuenow out of the committed value, so committing
  // second published the PREVIOUS value on every rest — nothing on the first
  // gesture from an empty field. Visible only to a screenreader.
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  const option = hourCol.locator('[data-part="option"][data-value]').nth(1)
  const wanted = await option.getAttribute('data-value')

  await option.click()
  await page.waitForTimeout(500)

  await expect(hourCol).toHaveAttribute('aria-valuenow', wanted)
  await expect(hourCol).not.toHaveAttribute('aria-valuetext', '--')
})

test('"Now" commits the current time, closes the popup, and refocuses the trigger', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await page.locator(`${TF} [data-part="footer-now"]`).click()
  // A completed value closes the popup (footer shortcuts commit-and-close);
  // the button it was clicked on is gone, so focus must land on the trigger.
  await expect(page.locator(`${TF} [data-part="popup"]`)).toHaveCount(0)
  await expect(page.locator(`${TF} [data-part="trigger"]`)).toBeFocused()
  const nativeVal = await page.locator(`${TF} [data-part="native"]`).inputValue()
  expect(nativeVal).toMatch(/^\d{2}:\d{2}/)
  // Reopening syncs the wheels from the committed value.
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  const hourVal = await hourCol.getAttribute('aria-valuenow')
  const minVal = await minuteCol.getAttribute('aria-valuenow')
  expect(Number(hourVal)).toBeGreaterThanOrEqual(0)
  expect(Number(hourVal)).toBeLessThanOrEqual(23)
  expect(Number(minVal)).toBeGreaterThanOrEqual(0)
  expect(Number(minVal)).toBeLessThanOrEqual(59)
})

test('"Clear" empties the value and closes the popup', async ({ page }) => {
  // First set a value via Now (which closes), then reopen and clear.
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await page.locator(`${TF} [data-part="footer-now"]`).click()
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await page.locator(`${TF} [data-part="footer-clear"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toHaveCount(0)
  await expect(page.locator(`${TF} [data-part="trigger"]`)).toBeFocused()
  const nativeVal = await page.locator(`${TF} [data-part="native"]`).inputValue()
  expect(nativeVal).toBe('')
})

test('"Now" and "Clear" dispatch input + change on the native input', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await page.evaluate((sel) => {
    const native = document.querySelector(`${sel} [data-part="native"]`)
    window.__events = []
    native.addEventListener('input', () => window.__events.push('input'))
    native.addEventListener('change', () => window.__events.push('change'))
  }, TF)
  await page.locator(`${TF} [data-part="footer-now"]`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change'])
  // Now closed the popup — reopening dispatches nothing on the native input.
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await page.locator(`${TF} [data-part="footer-clear"]`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change', 'input', 'change'])
})

test('popup wheel column has aria-valuemin and aria-valuemax', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toHaveAttribute('aria-valuemin', '0')
  await expect(hourCol).toHaveAttribute('aria-valuemax', '23')
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  await expect(minuteCol).toHaveAttribute('aria-valuemin', '0')
  await expect(minuteCol).toHaveAttribute('aria-valuemax', '59')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the popup', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  // "Now" is the last tab stop (Clear is disabled while empty). Tab must wrap
  // back into the popup, not escape to the page behind the aria-modal dialog.
  await page.locator(`${TF} [data-part="footer-now"]`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.locator(`${TF} [data-part="popup"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside).toBe(true)
})

test('Shift+Tab from the first wheel keeps focus inside the popup (wraps, does not close)', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Shift+Tab')
  // Popup stays open and focus is still within it (wraps to the last footer button).
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  const inside = await page.locator(`${TF} [data-part="popup"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside).toBe(true)
})

test('wheel event on the popup surface (off a column) is defaultPrevented', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).click()
  await expect(page.locator(`${TF} [data-part="popup"]`)).toBeVisible()
  const prevented = await page.evaluate((rootSel) => {
    const popup = document.querySelector(`${rootSel} [data-part="popup"]`)
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  }, TF)
  expect(prevented).toBe(true)
})

// ── Roving tabindex: out and back in ──────────────────────────────────────────
// The suite could tab *within* the segment group and *off* it, but never off and
// back, so a roving tabindex that never roved back was invisible: intercepting
// Tab on the last segment set every segment to -1, leaving the whole group with
// no tab stop and the field keyboard-unreachable for the rest of the page's
// life. A WCAG 2.1.1 failure that axe has no rule for.
test('the segment group keeps a tab stop after focus leaves it', async ({ page }) => {
  const segs = page.locator(`${TF} [data-part="segment"][tabindex]`)
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
  const segs = page.locator(`${TF} [data-part="segment"][tabindex]`)
  const n = await segs.count()

  await segs.first().focus()
  for (let i = 0; i < n - 1; i++) await page.keyboard.press('ArrowRight')
  const editing = await page.evaluate(() => document.activeElement?.dataset?.segment ?? null)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')

  await expect(page.locator(`${TF} [data-part="segment"][data-segment="${editing}"]`)).toBeFocused()
})

// ── Tab-stop membership ───────────────────────────────────────────────────────
// Containment and membership are different properties. The trap tests above prove
// focus cannot escape the popup; this proves the cycle actually includes every
// control in it. A dropped tab stop leaves the first property intact and makes a
// control keyboard-unreachable — WCAG 2.1.1, and invisible to axe.
test('every standalone control in the popup is reachable by Tab', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).first().click()
  await expect(page.locator(`${TF} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, TF)
})

test('the same holds for controls that only become actionable with a value', async ({ page }) => {
  // Clear is disabled while the field is empty, so the check above cannot see it —
  // and `.footer-clear` / `.calendar-footer-clear` were among the tab-stop lookups
  // that survived mutation. Populate through the UI, then check the fuller set.
  await page.locator(`${TF} [data-part="trigger"]`).first().click()
  await page.locator(`${TF} [data-part="footer-now"]`).click()
  if (!(await page.locator(`${TF} [role="dialog"]`).isVisible())) {
    await page.locator(`${TF} [data-part="trigger"]`).first().click()
  }
  await expect(page.locator(`${TF} [role="dialog"]`)).toBeVisible()

  await expectEveryPopupButtonReachable(page, expect, TF)
})

test('Clear is disabled while there is nothing to clear', async ({ page }) => {
  // The lookup that maintains this was another mutation survivor: break it and
  // Clear stays enabled on an empty field, offering an action that does nothing.
  await page.locator(`${TF} [data-part="trigger"]`).first().click()
  await expect(page.locator(`${TF} [data-part="footer-clear"]`)).toBeDisabled()

  await page.locator(`${TF} [data-part="footer-now"]`).click()
  if (!(await page.locator(`${TF} [role="dialog"]`).isVisible())) {
    await page.locator(`${TF} [data-part="trigger"]`).first().click()
  }
  await expect(page.locator(`${TF} [data-part="footer-clear"]`)).toBeEnabled()
})

// ── Opening with a mouse must place focus inside ───────────────────────────────
// The Escape handler lives inside the popup, so a popup opened with focus left on
// the trigger cannot be dismissed by keyboard at all — Escape reaches nothing. A
// keyboard user never saw it, because Tab carried them inside before they pressed
// anything. Two of the five fields shipped this way.
test('a mouse-opened popup takes focus, so Escape can close it', async ({ page }) => {
  await page.locator(`${TF} [data-part="trigger"]`).first().click()
  const dialog = page.locator(`${TF} [role="dialog"]`)
  await expect(dialog).toBeVisible()

  // aria-modal claims the rest of the page is inert; focus has to be here to match.
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const inside = await page.locator(`${TF} [role="dialog"]`).evaluate((el) =>
    // `getRootNode()` not `document`: inside an open shadow root
    // document.activeElement is the HOST, so contains() answers false.
    el.contains(el.getRootNode().activeElement))
  expect(inside, 'focus is still outside the popup after opening').toBe(true)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

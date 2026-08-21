// src/partials/components/TimeField/tests/TimeField.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y } from '../../../../e2e-helpers/target.js'

// DateTimeField also uses data-id="meeting-time" — scope to this component only.
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
  const overlay = page.locator(`${TF} .overlay`)
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
  const group = page.locator(`${TF} .segments`)
  await expect(group).toHaveAttribute('role', 'group')
})

// ── Trigger ARIA ───────────────────────────────────────────────────────────────

test('trigger has aria-expanded=false and aria-haspopup=dialog when closed', async ({ page }) => {
  const trigger = page.locator(`${TF} .trigger`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
})

// ── Popup open / close ─────────────────────────────────────────────────────────

test('popup does not exist in DOM when closed', async ({ page }) => {
  await expect(page.locator(`${TF} .popup`)).toHaveCount(0)
})

test('popup is visible after trigger click', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
})

test('trigger aria-expanded=true when popup open', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .trigger`)).toHaveAttribute('aria-expanded', 'true')
})

test('popup closes on Escape', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TF} .popup`)).toHaveCount(0)
})

test('focus returns to trigger after Escape', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  // Focus inside the popup so the popup's keydown handler receives the event
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator(`${TF} .trigger`)).toBeFocused()
})

test('popup closes on outside click', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
  // Wait for the setTimeout(0) outside-click handler to register before clicking outside
  await page.waitForTimeout(50)
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await expect(page.locator(`${TF} .popup`)).toHaveCount(0)
})

// ── Popup ARIA structure ───────────────────────────────────────────────────────

test('popup has role=dialog and aria-modal=true', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const popup = page.locator(`${TF} .popup`)
  await expect(popup).toHaveAttribute('role', 'dialog')
  await expect(popup).toHaveAttribute('aria-modal', 'true')
})

test('popup has aria-label', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const popup = page.locator(`${TF} .popup`)
  await expect(popup).toHaveAttribute('aria-label', 'Choose time')
})

test('popup hour column has role=spinbutton', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toHaveAttribute('role', 'spinbutton')
  await expect(hourCol).toHaveAttribute('aria-valuemin', '0')
  await expect(hourCol).toHaveAttribute('aria-valuemax', '23')
})

test('popup minute column has role=spinbutton', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  await expect(minuteCol).toHaveAttribute('role', 'spinbutton')
  await expect(minuteCol).toHaveAttribute('aria-valuemin', '0')
  await expect(minuteCol).toHaveAttribute('aria-valuemax', '59')
})

test('popup column contains 9 aria-hidden option elements', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const options = page.locator(`${TF} .Wheel[data-segment="hour"] .option`)
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
  await expect(page.locator(`${TF} .trigger`)).toBeFocused()
})

// ── Disabled state ─────────────────────────────────────────────────────────────

test('disabled field trigger is disabled', async ({ page }) => {
  // The kitchensink has disabled TimeField instances — find the first one
  const disabledTrigger = page.locator(`.TimeField[data-disabled="true"] .trigger`).first()
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
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
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
  const hourSeg = page.locator(`${TF} .segment[data-segment="hour"]`)
  await hourSeg.focus()
  // Type '10' to set hour = 10
  await page.keyboard.type('10')
  await page.waitForTimeout(350) // digit buffer timeout

  // Open popup and focus hour column
  await page.locator(`${TF} .trigger`).click()
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
  const hourSeg = page.locator(`${TF} .segment[data-segment="hour"]`)
  await hourSeg.focus()
  await page.keyboard.type('10')
  await page.waitForTimeout(350)

  await page.locator(`${TF} .trigger`).click()
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
  await page.locator(`${TF} .trigger`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toBeVisible()

  const option = hourCol.locator('.option[data-value]').nth(1)
  const wanted = await option.getAttribute('data-value')  // slots recycle on render
  await option.click()
  await page.waitForTimeout(500)

  await expect(page.locator(`${TF} .segment[data-segment="hour"]`))
    .toHaveAttribute('aria-valuenow', wanted)
})

test('the wheel column publishes the value it just committed', async ({ page }) => {
  // render() writes aria-valuenow out of the committed value, so committing
  // second published the PREVIOUS value on every rest — nothing on the first
  // gesture from an empty field. Visible only to a screenreader.
  await page.locator(`${TF} .trigger`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  const option = hourCol.locator('.option[data-value]').nth(1)
  const wanted = await option.getAttribute('data-value')

  await option.click()
  await page.waitForTimeout(500)

  await expect(hourCol).toHaveAttribute('aria-valuenow', wanted)
  await expect(hourCol).not.toHaveAttribute('aria-valuetext', '--')
})

test('"Now" button syncs the wheel with the current time', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const nowBtn = page.locator(`${TF} .footer-now`)
  await nowBtn.click()
  // Wheel columns should now have aria-valuenow set
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  const hourVal = await hourCol.getAttribute('aria-valuenow')
  const minVal = await minuteCol.getAttribute('aria-valuenow')
  expect(Number(hourVal)).toBeGreaterThanOrEqual(0)
  expect(Number(hourVal)).toBeLessThanOrEqual(23)
  expect(Number(minVal)).toBeGreaterThanOrEqual(0)
  expect(Number(minVal)).toBeLessThanOrEqual(59)
})

test('"Clear" button resets the wheel to an empty state', async ({ page }) => {
  // First set a value via Nu
  await page.locator(`${TF} .trigger`).click()
  await page.locator(`${TF} .footer-now`).click()
  // Then clear
  await page.locator(`${TF} .footer-clear`).click()
  // Native value should be empty
  const nativeVal = await page.locator(`${TF} .native`).inputValue()
  expect(nativeVal).toBe('')
})

test('"Now" and "Clear" dispatch input + change on the native input', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await page.evaluate((sel) => {
    const native = document.querySelector(`${sel} .native`)
    window.__events = []
    native.addEventListener('input', () => window.__events.push('input'))
    native.addEventListener('change', () => window.__events.push('change'))
  }, TF)
  await page.locator(`${TF} .footer-now`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change'])
  await page.locator(`${TF} .footer-clear`).click()
  expect(await page.evaluate(() => window.__events)).toEqual(['input', 'change', 'input', 'change'])
})

test('popup wheel column has aria-valuemin and aria-valuemax', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  const hourCol = page.locator(`${TF} .Wheel[data-segment="hour"]`)
  await expect(hourCol).toHaveAttribute('aria-valuemin', '0')
  await expect(hourCol).toHaveAttribute('aria-valuemax', '23')
  const minuteCol = page.locator(`${TF} .Wheel[data-segment="minute"]`)
  await expect(minuteCol).toHaveAttribute('aria-valuemin', '0')
  await expect(minuteCol).toHaveAttribute('aria-valuemax', '59')
})

// ── Kernel: popup-interaction (focus trap + scroll containment) ─────────────────

test('Tab past the last footer button keeps focus inside the popup', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
  // "Now" is the last tab stop (Clear is disabled while empty). Tab must wrap
  // back into the popup, not escape to the page behind the aria-modal dialog.
  await page.locator(`${TF} .footer-now`).focus()
  await page.keyboard.press('Tab')
  const inside = await page.evaluate(() =>
    document.querySelector('.popup')?.contains(document.activeElement) ?? false,
  )
  expect(inside).toBe(true)
})

test('Shift+Tab from the first wheel keeps focus inside the popup (wraps, does not close)', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
  await page.locator(`${TF} .Wheel[data-segment="hour"]`).focus()
  await page.keyboard.press('Shift+Tab')
  // Popup stays open and focus is still within it (wraps to the last footer button).
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
  const inside = await page.evaluate(() =>
    document.querySelector('.popup')?.contains(document.activeElement) ?? false,
  )
  expect(inside).toBe(true)
})

test('wheel event on the popup surface (off a column) is defaultPrevented', async ({ page }) => {
  await page.locator(`${TF} .trigger`).click()
  await expect(page.locator(`${TF} .popup`)).toBeVisible()
  const prevented = await page.evaluate(() => {
    const popup = document.querySelector('.popup')
    const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    popup.dispatchEvent(ev)
    return ev.defaultPrevented
  })
  expect(prevented).toBe(true)
})

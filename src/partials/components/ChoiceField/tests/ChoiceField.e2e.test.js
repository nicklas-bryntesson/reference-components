import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../../../../e2e-helpers/target.js'

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
})

// ── Checkbox behaviour (atomica11y checkbox §1) ───────────────────────────────

test('Space toggles a focused checkbox', async ({ page }) => {
  const input = page.locator('#cf-live-cb-1')
  await input.scrollIntoViewIfNeeded()
  await expect(input).not.toBeChecked()
  await input.focus()
  await page.keyboard.press('Space')
  await expect(input).toBeChecked()
  await page.keyboard.press('Space')
  await expect(input).not.toBeChecked()
})

test('clicking a checkbox label toggles the input', async ({ page }) => {
  const input = page.locator('#cf-live-cb-3')
  await input.scrollIntoViewIfNeeded()
  await expect(input).not.toBeChecked()
  await page.locator('label[for="cf-live-cb-3"]').click()
  await expect(input).toBeChecked()
})

// ── Radio behaviour (atomica11y radio §1) ─────────────────────────────────────

test('arrow keys move selection within the radio group (native roving)', async ({ page }) => {
  const first = page.locator('#cf-live-rd-1')
  const second = page.locator('#cf-live-rd-2')
  await first.scrollIntoViewIfNeeded()
  await expect(first).toBeChecked()
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(second).toBeChecked()
  await expect(first).not.toBeChecked()
})

test('selecting one radio deselects the others (shared name)', async ({ page }) => {
  const second = page.locator('#cf-live-rd-2')
  await second.scrollIntoViewIfNeeded()
  await page.locator('label[for="cf-live-rd-2"]').click()
  await expect(second).toBeChecked()
  await expect(page.locator('#cf-live-rd-1')).not.toBeChecked()
  await expect(page.locator('#cf-live-rd-3')).not.toBeChecked()
})

// ── Shared skeleton: focus + rendering ────────────────────────────────────────

test('focus is visibly indicated on both types', async ({ page }) => {
  for (const id of ['#cf-live-cb-1', '#cf-live-rd-1']) {
    const input = page.locator(id)
    await input.scrollIntoViewIfNeeded()
    await input.focus()
    await expect(input).toBeFocused()
    const outlineWidth = await input.evaluate((el) => getComputedStyle(el).outlineWidth)
    expect(parseFloat(outlineWidth)).toBeGreaterThan(0)
  }
})

test('appearance:none box renders at the token size', async ({ page }) => {
  const input = page.locator('#cf-live-cb-1')
  await input.scrollIntoViewIfNeeded()
  const box = await input.boundingBox()
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)
  const appearance = await input.evaluate((el) => getComputedStyle(el).appearance)
  expect(appearance).toBe('none')
})

// ── Disabled is a functional state ────────────────────────────────────────────

test('disabled controls cannot be toggled', async ({ page }) => {
  const cb = page.locator('#cf-dis-cb-e')
  await cb.scrollIntoViewIfNeeded()
  await expect(cb).toBeDisabled()
  await cb.click({ force: true })
  await expect(cb).not.toBeChecked()
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across ChoiceField states', async ({ page }) => {
  await page.locator('.ChoiceField').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#ChoiceField')
})

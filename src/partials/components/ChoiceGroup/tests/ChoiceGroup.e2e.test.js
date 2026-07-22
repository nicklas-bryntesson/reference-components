import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// ── The legend is the group's accessible name ─────────────────────────────────

test('legend names the group (role=group)', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Shipping speed' })
  await expect(group).toBeVisible()
})

test('a hidden legend still provides the group name', async ({ page }) => {
  // data-legend="hidden" removes the legend visually but not from the a11y tree
  const group = page.getByRole('group', { name: 'Payment method' })
  await expect(group).toHaveCount(1)
  const legend = page.locator('.ChoiceGroup[data-id="hidden"] legend')
  // visually removed (clipped to 1px) but present
  const box = await legend.boundingBox()
  expect(box.width).toBeLessThanOrEqual(2)
})

// ── Hint / error are wired as the group's accessible description ───────────────

test('hint is exposed as the group accessible description', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Account type' })
  await expect(group).toHaveAccessibleDescription(/plan that fits your team/i)
})

test('group error is announced (role=alert) and described', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Terms' })
  await expect(group).toHaveAccessibleDescription(/must accept the terms/i)
  await expect(page.locator('.ChoiceGroup[data-id="invalid"] .Error')).toHaveAttribute('role', 'alert')
})

// ── Layout: orientation ───────────────────────────────────────────────────────

test('horizontal orientation lays fields in a row', async ({ page }) => {
  const opts = page.locator('.ChoiceGroup[data-id="horizontal"] .ChoiceField')
  await opts.first().scrollIntoViewIfNeeded()
  const first = await opts.nth(0).boundingBox()
  const second = await opts.nth(1).boundingBox()
  // same row → tops roughly aligned, second is to the right of the first
  expect(Math.abs(first.y - second.y)).toBeLessThan(4)
  expect(second.x).toBeGreaterThan(first.x)
})

test('vertical orientation stacks fields', async ({ page }) => {
  const opts = page.locator('.ChoiceGroup[data-id="above"] .ChoiceField')
  await opts.first().scrollIntoViewIfNeeded()
  const first = await opts.nth(0).boundingBox()
  const second = await opts.nth(1).boundingBox()
  expect(second.y).toBeGreaterThan(first.y)
})

// ── Selection semantics survive grouping ──────────────────────────────────────

test('single-selection holds within a group', async ({ page }) => {
  const first = page.locator('#cg-live-1')
  const second = page.locator('#cg-live-2')
  await first.scrollIntoViewIfNeeded()
  await expect(first).toBeChecked()
  await page.locator('label[for="cg-live-2"]').click()
  await expect(second).toBeChecked()
  await expect(first).not.toBeChecked()
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across ChoiceGroup variants', async ({ page }) => {
  await page.locator('.ChoiceGroup').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#ChoiceGroup')
})

import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../../../../e2e-helpers/target.js'

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
})

// ── Separation of concerns (ADR-0016) ─────────────────────────────────────────

test('Notice carries no live role; the region does', async ({ page }) => {
  const notice = page.locator('#Notice .Notice').first()
  await notice.scrollIntoViewIfNeeded()
  expect(await notice.getAttribute('role')).toBeNull()

  const region = page.locator('#Notice [data-part="notice-region"][data-id="region"]')
  await expect(region).toHaveAttribute('role', 'alert')
  await expect(region).toHaveAttribute('aria-live', 'assertive')
})

// ── Variants + emphasis ───────────────────────────────────────────────────────

test('variants tint the icon with distinct accents', async ({ page }) => {
  const iconColor = (variant) =>
    page.locator(`#Notice .Notice[data-variant="${variant}"] [data-part="icon"]`).first()
      .evaluate((el) => getComputedStyle(el).color)

  const [error, success, info] = await Promise.all([iconColor('error'), iconColor('success'), iconColor('info')])
  expect(new Set([error, success, info]).size).toBe(3) // all different
})

test('base default has no border; data-border adds a full accent border', async ({ page }) => {
  const base = page.locator('#Notice .Notice[data-variant="error"]:not([data-border]):not([data-emphasis])').first()
  const bordered = page.locator('#Notice .Notice[data-border="true"]').first()
  await base.scrollIntoViewIfNeeded()
  const w = (loc) => loc.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
  expect(await w(base)).toBe(0)
  expect(await w(bordered)).toBeGreaterThan(0)
})

test('data-emphasis adds a leading accent bar the base lacks', async ({ page }) => {
  const base = page.locator('#Notice .Notice[data-variant="error"]:not([data-emphasis])').first()
  const emph = page.locator('#Notice .Notice[data-emphasis="true"]').first()
  await base.scrollIntoViewIfNeeded()
  const lead = (loc) => loc.evaluate((el) => parseFloat(getComputedStyle(el).borderInlineStartWidth))
  expect(await lead(emph)).toBeGreaterThan(await lead(base))
})

// ── Optional icon ─────────────────────────────────────────────────────────────

test('data-icon="false" renders no icon and collapses to one column', async ({ page }) => {
  const notice = page.locator('#Notice .Notice[data-icon="false"]')
  await notice.scrollIntoViewIfNeeded()
  await expect(notice.locator('svg')).toHaveCount(0)
  const cols = await notice.evaluate((el) => getComputedStyle(el).gridTemplateColumns)
  // single track (no "auto 1fr" two-column split)
  expect(cols.trim().split(/\s+/).length).toBe(1)
})

test('icons are decorative (aria-hidden)', async ({ page }) => {
  const icons = page.locator('#Notice .Notice [data-part="icon"] svg')
  const n = await icons.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    await expect(icons.nth(i)).toHaveAttribute('aria-hidden', 'true')
  }
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across Notice variants', async ({ page }) => {
  await page.locator('#Notice').scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#Notice')
})

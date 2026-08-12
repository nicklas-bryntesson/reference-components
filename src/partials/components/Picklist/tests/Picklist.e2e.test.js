import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

// Picklist has no JS, so the e2e layer carries the weight: it proves that
// native actually delivers the contract in a real browser, and that the chip
// mechanism (sr-clipped input + adjacent label as the surface) does not cost
// any of the semantics or the visible focus ring.
//
// NOTE: every locator is scoped to the component root. `.option`, `.content`
// and `.options` are page-global words shared across components.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// ── The legend is the group's accessible name ─────────────────────────────────

test('legend names the group (role=group)', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Cuisine' })).toBeVisible()
})

test('a hidden legend still provides the group name', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Sort order' })).toHaveCount(1)
  const legend = page.locator('.Picklist[data-id="hidden"] legend')
  const box = await legend.boundingBox()
  expect(box.width).toBeLessThanOrEqual(2)
})

// ── Native semantics survive the chip skin ────────────────────────────────────

test('chips keep their native role and state', async ({ page }) => {
  const chip = page.locator('.Picklist[data-id="multi"] input#pl-m-1')
  await chip.scrollIntoViewIfNeeded()
  await expect(chip).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Wi-Fi' })).toHaveCount(1)
  await expect(page.getByRole('radio', { name: 'Thai' }).first()).toHaveCount(1)
})

test('clicking the chip label toggles the checkbox', async ({ page }) => {
  const input = page.locator('#pl-l-3')
  await input.scrollIntoViewIfNeeded()
  await expect(input).not.toBeChecked()
  await page.locator('.Picklist[data-id="live"] label[for="pl-l-3"]').click()
  await expect(input).toBeChecked()
})

test('Space toggles a focused chip, and multi-select keeps several selected', async ({ page }) => {
  const olives = page.locator('#pl-l-3')
  const basil = page.locator('#pl-l-2')
  await olives.scrollIntoViewIfNeeded()
  await olives.focus()
  await page.keyboard.press('Space')
  await expect(olives).toBeChecked()
  await expect(basil, 'checkboxes are independent — the other stays selected').toBeChecked()
})

test('radio chips rove with arrow keys and hold single-selection', async ({ page }) => {
  const thai = page.locator('#pl-s-1')
  const italian = page.locator('#pl-s-2')
  await thai.scrollIntoViewIfNeeded()
  await thai.focus()
  await expect(thai).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(italian, 'arrow key moves AND selects').toBeChecked()
  await expect(thai, 'single-selection: the previous one is released').not.toBeChecked()
})

// ── The focus ring lands on the chip, not on the 1px clipped input ────────────

test('focus draws a ring on the chip label, sized like the chip', async ({ page }) => {
  const input = page.locator('#pl-s-1')
  await input.scrollIntoViewIfNeeded()
  await input.focus()

  const label = page.locator('.Picklist[data-id="single"] label[for="pl-s-1"]')
  const outline = await label.evaluate((el) => {
    const s = getComputedStyle(el)
    return { width: s.outlineWidth, style: s.outlineStyle }
  })
  expect(outline.style, 'the chip must show a real outline on focus').not.toBe('none')
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2)

  // The input itself is clipped to 1px — the visible ring belongs to the chip.
  const inputBox = await input.boundingBox()
  const labelBox = await label.boundingBox()
  expect(inputBox.width).toBeLessThanOrEqual(2)
  expect(labelBox.width, 'the chip is the visible surface').toBeGreaterThan(20)
})

test('the chip meets the family field-height contract (2.5rem / 40px)', async ({ page }) => {
  const label = page.locator('.Picklist[data-id="single"] label[for="pl-s-1"]')
  await label.scrollIntoViewIfNeeded()
  const box = await label.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(40)
})

// ── Removable chips: the × deselects, and never reaches the name ──────────────

test('activating the × glyph deselects the chip', async ({ page }) => {
  const input = page.locator('#pl-r-1')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toBeChecked()
  await page.locator('.Picklist[data-id="removable"] label[for="pl-r-1"] .deselect').click()
  await expect(input, 'the × lives inside the label, so it toggles the input').not.toBeChecked()
})

test('the × glyph contributes nothing to the accessible name', async ({ page }) => {
  const chip = page.getByRole('checkbox', { name: 'Under 500 kr', exact: true })
  await expect(chip, 'name must be the plain text — no glyph, no trailing space').toHaveCount(1)
})

// ── Layout: chips flow in a row and wrap ──────────────────────────────────────

test('chips flow in a row', async ({ page }) => {
  const chips = page.locator('.Picklist[data-id="single"] .option')
  await chips.first().scrollIntoViewIfNeeded()
  const first = await chips.nth(0).boundingBox()
  const second = await chips.nth(1).boundingBox()
  expect(Math.abs(first.y - second.y)).toBeLessThan(4)
  expect(second.x).toBeGreaterThan(first.x)
})

test('a long set wraps to multiple rows without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  const chips = page.locator('.Picklist[data-id="wrap"] .option')
  await chips.first().scrollIntoViewIfNeeded()
  const boxes = []
  for (let i = 0; i < await chips.count(); i++) boxes.push(await chips.nth(i).boundingBox())
  const rows = new Set(boxes.map((b) => Math.round(b.y)))
  expect(rows.size, 'chips must wrap to more than one row when narrow').toBeGreaterThan(1)

  // nothing overflows the group horizontally
  const group = await page.locator('.Picklist[data-id="wrap"]').boundingBox()
  for (const b of boxes) {
    expect(b.x + b.width).toBeLessThanOrEqual(group.x + group.width + 1)
  }
})

// ── Hint / error wiring, inherited from the selection family ──────────────────

test('hint is exposed as the group accessible description', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Applied filters' }))
    .toHaveAccessibleDescription(/activating it removes the selection/i)
})

test('group error is announced (role=alert) and described', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Dietary needs' }))
    .toHaveAccessibleDescription(/at least one option/i)
  await expect(page.locator('.Picklist[data-id="invalid"] .notice-region')).toHaveAttribute('role', 'alert')
  await expect(page.locator('.Picklist[data-id="invalid"] .notice-region .Notice')).toHaveAttribute('data-variant', 'error')
})

// ── Disabled ──────────────────────────────────────────────────────────────────

test('a disabled chip cannot be toggled', async ({ page }) => {
  const input = page.locator('#pl-d-2')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toBeDisabled()
  await page.locator('.Picklist[data-id="disabled-single"] label[for="pl-d-2"]').click({ force: true })
  await expect(input).not.toBeChecked()
})

test('the fieldset disabled cascade blocks the whole group', async ({ page }) => {
  const input = page.locator('#pl-dg-2')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toBeDisabled()
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across Picklist variants', async ({ page }) => {
  await page.locator('.Picklist').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#Picklist')
})

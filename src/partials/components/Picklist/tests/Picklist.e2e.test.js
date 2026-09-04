import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../../../../e2e-helpers/target.js'

// Picklist has no JS, so the e2e layer carries the weight: it proves that
// native actually delivers the contract in a real browser, and that the chip
// mechanism (sr-clipped input + adjacent label as the surface) does not cost
// any of the semantics or the visible focus ring.
//
// NOTE: every locator is scoped to the component root. `.option`, `.content`
// and `.options` are page-global words shared across components.

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
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
  await page.locator('.Picklist[data-id="removable"] label[for="pl-r-1"] [data-part="deselect"]').click()
  await expect(input, 'the × lives inside the label, so it toggles the input').not.toBeChecked()
})

test('the × glyph contributes nothing to the accessible name', async ({ page }) => {
  const chip = page.getByRole('checkbox', { name: 'Under 500 kr', exact: true })
  await expect(chip, 'name must be the plain text — no glyph, no trailing space').toHaveCount(1)
})

// ── Layout: chips flow in a row and wrap ──────────────────────────────────────

test('chips flow in a row', async ({ page }) => {
  const chips = page.locator('.Picklist[data-id="single"] [data-part="option"]')
  await chips.first().scrollIntoViewIfNeeded()
  const first = await chips.nth(0).boundingBox()
  const second = await chips.nth(1).boundingBox()
  expect(Math.abs(first.y - second.y)).toBeLessThan(4)
  expect(second.x).toBeGreaterThan(first.x)
})

test('a long set wraps to multiple rows without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  const chips = page.locator('.Picklist[data-id="wrap"] [data-part="option"]')
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

// ── The two axes: orientation and segmented ───────────────────────────────────

test('segmented collapses the seam to a single border', async ({ page }) => {
  const labels = page.locator('.Picklist[data-id="segmented"] [data-part="option"] label')
  await labels.first().scrollIntoViewIfNeeded()
  const a = await labels.nth(0).boundingBox()
  const b = await labels.nth(1).boundingBox()
  // no gap between neighbours…
  expect(Math.abs(b.x - (a.x + a.width))).toBeLessThan(0.5)
  // …and the seam is one border, not two stacked
  const seam = await labels.nth(1).evaluate((el) => {
    const prev = el.closest('[data-part="option"]').previousElementSibling.querySelector('label')
    return parseFloat(getComputedStyle(prev).borderRightWidth) + parseFloat(getComputedStyle(el).borderLeftWidth)
  })
  expect(seam, 'a doubled seam reads as a 2px line between segments').toBeLessThanOrEqual(1)
})

test('segmented puts the outer radius only on the two ends', async ({ page }) => {
  const labels = page.locator('.Picklist[data-id="segmented"] [data-part="option"] label')
  await labels.first().scrollIntoViewIfNeeded()
  const radii = (l) => l.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
      .map((v) => parseFloat(v))
  })
  const first = await radii(labels.first())
  const middle = await radii(labels.nth(1))
  const last = await radii(labels.last())
  expect(first[0], 'first segment keeps its leading radius').toBeGreaterThan(0)
  expect(first[1], 'first segment has no trailing radius').toBe(0)
  expect(middle.every((r) => r === 0), 'middle segments are square').toBe(true)
  expect(last[1], 'last segment keeps its trailing radius').toBeGreaterThan(0)
  expect(last[0], 'last segment has no leading radius').toBe(0)
})

test('the radius token drives the segmented ends too', async ({ page }) => {
  // pill vs rectangle is a design value, not an attribute
  const first = page.locator('.Picklist[data-id="segmented-rect"] [data-part="option"] label').first()
  await first.scrollIntoViewIfNeeded()
  const r = await first.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))
  expect(r).toBeCloseTo(4, 0)   // 0.25rem
})

test('segmented does not wrap, even when narrow', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  const labels = page.locator('.Picklist[data-id="segmented"] [data-part="option"] label')
  await labels.first().scrollIntoViewIfNeeded()
  const ys = []
  for (let i = 0; i < await labels.count(); i++) ys.push(Math.round((await labels.nth(i).boundingBox()).y))
  expect(new Set(ys).size, 'a joined bar must stay on one row').toBe(1)
})

test('vertical stacks, and gapped chips hug their own text', async ({ page }) => {
  const labels = page.locator('.Picklist[data-id="vertical"] [data-part="option"] label')
  await labels.first().scrollIntoViewIfNeeded()
  const a = await labels.nth(0).boundingBox()
  const b = await labels.nth(1).boundingBox()
  expect(b.y).toBeGreaterThan(a.y + a.height - 1)
  const widths = []
  for (let i = 0; i < await labels.count(); i++) widths.push(Math.round((await labels.nth(i).boundingBox()).width))
  expect(new Set(widths).size, 'gapped chips size to their label, not the group').toBeGreaterThan(1)
})

test('vertical + segmented fills the bar (labels, not just wrappers)', async ({ page }) => {
  const labels = page.locator('.Picklist[data-id="vertical-segmented"] [data-part="option"] label')
  await labels.first().scrollIntoViewIfNeeded()
  const widths = []
  for (let i = 0; i < await labels.count(); i++) widths.push(Math.round((await labels.nth(i).boundingBox()).width))
  // the label IS the segment — stretching only the .option wrapper looks ragged
  expect(new Set(widths).size, `segments must be equal width, got ${widths.join('/')}`).toBe(1)
})

// ── The focus ring must be VISIBLE, not merely present ────────────────────────
//
// Asserting `outlineStyle !== 'none'` is not enough and let a real bug ship: a
// selected chip is `color: Canvas` on `background: CanvasText`, so an outward
// currentColor ring was white drawn on a near-white page — present, 2px, and
// invisible. These tests measure contrast against the surface the ring is drawn
// on, which is what "visible" actually means.

/** WCAG relative luminance + contrast ratio, on computed rgb() strings. */
const RING_CONTRAST = (page, sel) => page.locator(sel).evaluate((el) => {
  const cs = getComputedStyle(el)
  const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number)
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const offset = parseFloat(cs.outlineOffset)
  // A negative offset draws the ring inside the element, over its own fill; a
  // positive one draws it outside, over whatever is behind the element.
  const behind = offset < 0
    ? cs.backgroundColor
    : getComputedStyle(el.closest('.Picklist')).backgroundColor
  const [a, b] = [lum(parse(cs.outlineColor)), lum(parse(behind))].sort((x, y) => y - x)
  return { ratio: (a + 0.05) / (b + 0.05), outlineColor: cs.outlineColor, surface: behind, offset }
})

test('the focus ring contrasts with the chip it is drawn on — selected and unselected', async ({ page }) => {
  for (const [id, forId, what] of [
    ['state-focus', 'pl-sf-2', 'gapped, selected'],
    ['state-focus', 'pl-sf-1', 'gapped, unselected'],
    ['state-seg-focus', 'pl-ssf-1', 'segmented, selected'],
    ['state-seg-focus', 'pl-ssf-2', 'segmented, unselected'],
  ]) {
    const sel = `.Picklist[data-id="${id}"] label[for="${forId}"]`
    await page.locator(sel).scrollIntoViewIfNeeded()
    const r = await RING_CONTRAST(page, sel)
    expect(r.offset, `${what}: the ring must be inset so it lands on the chip's own fill`).toBeLessThan(0)
    expect(
      r.ratio,
      `${what}: ring ${r.outlineColor} on ${r.surface} is only ${r.ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3)
  }
})

test('a real keyboard focus on a selected segment is visible', async ({ page }) => {
  const first = page.locator('#pl-sg-1')          // selected radio in the segmented bar
  await first.scrollIntoViewIfNeeded()
  await first.focus()
  await page.keyboard.press('ArrowRight')          // keyboard modality → :focus-visible
  await page.keyboard.press('ArrowLeft')           // back onto the selected one
  const sel = '.Picklist[data-id="segmented"] label[for="pl-sg-1"]'
  const r = await RING_CONTRAST(page, sel)
  expect(r.ratio, `ring ${r.outlineColor} on ${r.surface} is only ${r.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
})

test('an inset ring needs no z-index raise, because it never reaches a neighbour', async ({ page }) => {
  // The outward ring did: the next segment clipped its trailing edge. Guarding
  // this keeps the two decisions tied together — if the offset ever goes
  // positive again, the raise has to come back with it.
  const sel = '.Picklist[data-id="state-seg-focus"] label[for="pl-ssf-2"]'
  await page.locator(sel).scrollIntoViewIfNeeded()
  const s = await page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el)
    return { offset: parseFloat(cs.outlineOffset), width: parseFloat(cs.outlineWidth) }
  })
  expect(s.offset).toBeLessThan(0)
  expect(Math.abs(s.offset), 'the ring must sit fully inside the border box').toBeGreaterThanOrEqual(s.width)
})

test('the height contract holds in segmented mode', async ({ page }) => {
  const label = page.locator('.Picklist[data-id="segmented"] [data-part="option"] label').first()
  await label.scrollIntoViewIfNeeded()
  const box = await label.boundingBox()
  expect(box.height).toBe(40)
})

// ── Hint / error wiring, inherited from the selection family ──────────────────

test('hint is exposed as the group accessible description', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Applied filters' }))
    .toHaveAccessibleDescription(/activating it removes the selection/i)
})

test('group error is announced (role=alert) and described', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Dietary needs' }))
    .toHaveAccessibleDescription(/at least one option/i)
  await expect(page.locator('.Picklist[data-id="invalid"] [data-part="notice-region"]')).toHaveAttribute('role', 'alert')
  await expect(page.locator('.Picklist[data-id="invalid"] [data-part="notice-region"] .Notice')).toHaveAttribute('data-variant', 'error')
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

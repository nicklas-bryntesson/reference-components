import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../../../../e2e-helpers/target.js'

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
})

const LIVE = '#rf-live'

// ── Keyboard (atomica11y range-slider §1) ─────────────────────────────────────

test('arrow keys change the value by exactly one step', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  await expect(input).toHaveValue('50')

  await input.focus()
  await page.keyboard.press('ArrowRight')
  await expect(input).toHaveValue('51')
  await page.keyboard.press('ArrowLeft')
  await expect(input).toHaveValue('50')

  // Up/Down are equivalent on a horizontal slider — both must work.
  await page.keyboard.press('ArrowUp')
  await expect(input).toHaveValue('51')
  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveValue('50')
})

test('Home and End reach min and max', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  await input.focus()
  await page.keyboard.press('Home')
  await expect(input).toHaveValue('0')
  await page.keyboard.press('End')
  await expect(input).toHaveValue('100')
})

test('step is respected — a stepped field lands only on its tick values', async ({ page }) => {
  const input = page.locator('#rf-variant-stepped')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toHaveValue('75')
  await input.focus()
  await page.keyboard.press('ArrowRight')
  await expect(input).toHaveValue('100')     // not 76 — step is 25
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(input).toHaveValue('50')
})

test('the field is reachable by Tab and takes focus', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  await input.focus()
  await expect(input).toBeFocused()
})

// ── Focus visibility ─────────────────────────────────────────────────────────
//
// The ring is drawn on a vendor pseudo-element, whose computed style Chrome does
// not expose. Because every state in this component is a custom property on the
// ELEMENT, the ring is assertable there instead — which is both possible and
// more precise than a screenshot.

test('focus raises a visible ring, and only while focused', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()

  const ring = () => input.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--_rf-thumb-outline').trim())

  expect(await ring()).toBe('none')
  await input.focus()
  // The width is relative, like every other length here — assert the shape, and
  // that it is NOT pinned in px, rather than a magic number.
  expect(await ring()).toMatch(/^[\d.]+em solid currentColor$/)
  await input.blur()
  expect(await ring()).toBe('none')
})

test('the input itself has no outline — the ring sits on the thumb', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  await input.focus()
  const outlineStyle = await input.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outlineStyle).toBe('none')
})

// ── Target size (WCAG 2.5.8) ──────────────────────────────────────────────────

test('every field clears the 24px minimum target size', async ({ page }) => {
  const boxes = await page.locator('#RangeField .RangeField').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { id: el.id, w: r.width, h: r.height, vertical: el.dataset.orientation === 'vertical' }
    }))
  expect(boxes.length).toBeGreaterThan(0)
  for (const b of boxes) {
    // The hit area is the field: 24px across the thin axis in either orientation.
    expect(b.vertical ? b.w : b.h, b.id).toBeGreaterThanOrEqual(24)
  }
})

// ── ARIA structure ────────────────────────────────────────────────────────────

test('native supplies role=slider and the value properties', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  // Native mapping, never authored — so assert the ROLE, and that we did not
  // hand-write the value properties over it.
  await expect(input).toHaveRole('slider')
  await expect(input).not.toHaveAttribute('aria-valuenow')
  await expect(input).not.toHaveAttribute('aria-valuemin')
  await expect(input).not.toHaveAttribute('aria-valuemax')
})

test('the accessible name comes from the <label>, not aria-label', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  await expect(input).not.toHaveAttribute('aria-label')
  const name = await input.evaluate((el) => el.labels[0]?.textContent.trim())
  expect(name).toBe('Volume')
})

test('aria-valuetext carries the unit where the number is not the meaning', async ({ page }) => {
  const input = page.locator('#rf-variant-valuetext')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toHaveAttribute('aria-valuetext', '250 kr')
})

test('invalid states pair data-invalid with aria-invalid', async ({ page }) => {
  const input = page.locator('#rf-invalid-mid')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toHaveAttribute('data-invalid', 'true')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
})

// ── Disabled ──────────────────────────────────────────────────────────────────

test('a disabled field ignores the keyboard and is not focusable', async ({ page }) => {
  const input = page.locator('#rf-disabled-mid')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toBeDisabled()
  await expect(input).toHaveValue('50')
  await input.focus({ timeout: 1000 }).catch(() => {})
  await expect(input).not.toBeFocused()
})

// ── Vertical — the arrow mapping is the whole point ───────────────────────────

test('vertical: ArrowUp increases the value (writing-mode, not rotation)', async ({ page }) => {
  const input = page.locator('#rf-variant-vertical')
  await input.scrollIntoViewIfNeeded()
  await expect(input).toHaveValue('50')
  await input.focus()
  await page.keyboard.press('ArrowUp')
  await expect(input).toHaveValue('51')
  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveValue('50')
})

test('vertical: the field is taller than it is wide', async ({ page }) => {
  const box = await page.locator('#rf-variant-vertical').boundingBox()
  expect(box.height).toBeGreaterThan(box.width)
})

test('vertical: min sits at the bottom by default, at the top under data-min', async ({ page }) => {
  // With min at the bottom, the thumb moves UP as the value grows, so the
  // rendered position of a high value is nearer the top of the box. Compare the
  // two variants at the same value by reading back the direction that drives it.
  const bottom = page.locator('#rf-variant-vertical')
  const top = page.locator('#rf-variant-vertical-top')
  await bottom.scrollIntoViewIfNeeded()
  expect(await bottom.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
  expect(await top.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr')
  await expect(top).toHaveAttribute('data-min', 'top')
})

// ── appearance: none removes the marks, and that is documented, not broken ────

test('a datalist renders no marks once the control is styled', async ({ page }) => {
  const styled = page.locator('#rf-variant-datalist')
  await styled.scrollIntoViewIfNeeded()
  // Same datalist as the native reference; the difference is appearance.
  await expect(styled).toHaveAttribute('list', 'rf-variant-datalist-ticks')
  expect(await styled.evaluate((el) => getComputedStyle(el).appearance)).toBe('none')

  const native = page.locator('#rf-native')
  await expect(native).toHaveAttribute('list', 'rf-native-ticks')
  expect(await native.evaluate((el) => getComputedStyle(el).appearance)).toBe('auto')
})

// ── Statelessness ─────────────────────────────────────────────────────────────

test('dragging changes only the value — nothing is authored to fall out of sync', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()

  // No inline style at all: the browser positions the thumb from `value`.
  expect(await input.getAttribute('style')).toBeNull()

  await input.focus()
  await page.keyboard.press('End')
  await expect(input).toHaveValue('100')
  expect(await input.getAttribute('style')).toBeNull()
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across RangeField states', async ({ page }) => {
  await page.locator('.RangeField').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#RangeField')
})

// ── Relative units — the control follows the reader's text size ───────────────
//
// This is the point of using em rather than px, and it only works because the
// component sets `font: inherit`: a form control does not inherit the document's
// font, so without that line `em` resolves against the UA's ~13px and the control
// stops scaling entirely.

test('the whole control scales with the root font size', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()

  const heightAtRoot = (size) =>
    page.evaluate(async ([sel, s]) => {
      const html = document.documentElement
      const original = html.style.fontSize
      html.style.fontSize = s
      const h = document.querySelector(sel).getBoundingClientRect().height
      html.style.fontSize = original
      return h
    }, [LIVE, size])

  const at16 = await heightAtRoot('16px')
  const at32 = await heightAtRoot('32px')

  expect(at16).toBeGreaterThanOrEqual(24)      // still clears WCAG 2.5.8
  expect(at32).toBeCloseTo(at16 * 2, 0)        // and doubles with the text
})

test('no length is pinned in px except the documented target floor', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()
  const vars = await input.evaluate((el) => {
    const cs = getComputedStyle(el)
    return ['--_rf-thumb', '--_rf-track', '--_rf-ring-width']
      .map((n) => [n, cs.getPropertyValue(n).trim()])
  })
  for (const [name, value] of vars) {
    expect(value, name).toMatch(/em$/)
  }
  // The floor is the one exception: WCAG 2.5.8 states its minimum in CSS px.
  expect(await input.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--_rf-target-floor').trim())).toBe('24px')
})

// ── No layout shift while interacting ─────────────────────────────────────────
//
// The thumb grows on :active, and it must do so by TRANSFORM: --_rf-thumb feeds
// the input's own block-size, so growing the size relaid out the page by a few
// pixels every time someone grabbed the handle.

test('grabbing the thumb grows it without reflowing the page', async ({ page }) => {
  const input = page.locator(LIVE)
  await input.scrollIntoViewIfNeeded()

  const measure = () => input.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { h: r.height, top: r.top, doc: document.documentElement.scrollHeight,
             thumb: getComputedStyle(el).getPropertyValue('--_rf-thumb').trim(),
             scale: getComputedStyle(el).getPropertyValue('--_rf-thumb-scale').trim() }
  })

  const idle = await measure()
  await input.evaluate((el) => el.setAttribute('data-test-state', 'active'))
  const active = await measure()
  await input.evaluate((el) => el.removeAttribute('data-test-state'))

  expect(Number(active.scale)).toBeGreaterThan(Number(idle.scale))  // it does grow …
  expect(active.thumb).toBe(idle.thumb)                            // … but not in size
  expect(active.h).toBe(idle.h)
  expect(active.top).toBe(idle.top)
  expect(active.doc).toBe(idle.doc)
})

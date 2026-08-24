import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../../../../e2e-helpers/target.js'

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
})

const GROUP = '[data-id="rangegroup-live"]'
const LOWER = '#rg-live-lower'
const UPPER = '#rg-live-upper'

const state = (page, group = GROUP) =>
  page.locator(group).evaluate((g) => {
    const scale = g.querySelector('.RangeScale')
    const lo = g.querySelector('[data-role="lower"]')
    const hi = g.querySelector('[data-role="upper"]')
    const track = scale.querySelector('.track').getBoundingClientRect()
    const fill = scale.querySelector('.fill').getBoundingClientRect()
    const cs = getComputedStyle(scale)
    return {
      lower: lo.value,
      upper: hi.value,
      a: cs.getPropertyValue('--_rs-a').trim(),
      b: cs.getPropertyValue('--_rs-b').trim(),
      fillStart: fill.left - track.left,
      fillWidth: fill.width,
      trackWidth: track.width,
      lowerMax: lo.getAttribute('aria-valuemax'),
      upperMin: hi.getAttribute('aria-valuemin'),
      lowerText: lo.getAttribute('aria-valuetext'),
      upperText: hi.getAttribute('aria-valuetext'),
      readouts: [...g.querySelectorAll('[data-readout]')].map((x) => x.textContent),
      onTop: {
        lower: lo.getAttribute('data-on-top'),
        upper: hi.getAttribute('data-on-top'),
      },
    }
  })

// ── Clamping: hard stop, and nothing else moves ───────────────────────────────

test('driving the lower end up stops at the upper, which does not move', async ({ page }) => {
  const lower = page.locator(LOWER)
  await lower.scrollIntoViewIfNeeded()

  const before = await state(page)
  expect(before.lower).toBe('200')
  expect(before.upper).toBe('700')

  await lower.focus()
  for (let i = 0; i < 80; i++) await page.keyboard.press('ArrowRight')

  const after = await state(page)
  expect(after.lower).toBe('700')            // stopped at the other end
  expect(after.upper).toBe('700')            // which never moved
})

test('driving the upper end down stops at the lower, which does not move', async ({ page }) => {
  const upper = page.locator(UPPER)
  await upper.scrollIntoViewIfNeeded()
  await upper.focus()
  for (let i = 0; i < 80; i++) await page.keyboard.press('ArrowLeft')

  const after = await state(page)
  expect(after.upper).toBe('200')
  expect(after.lower).toBe('200')
})

test('End on the lower end does not drag the upper along', async ({ page }) => {
  const lower = page.locator(LOWER)
  await lower.scrollIntoViewIfNeeded()
  await lower.focus()
  await page.keyboard.press('End')

  const after = await state(page)
  expect(after.lower).toBe('700')            // clamped, not 1000
  expect(after.upper).toBe('700')
})

// ── The lane draws the span ───────────────────────────────────────────────────

test('the fill spans between the two ends, not from min', async ({ page }) => {
  const s = await state(page)
  expect(Number(s.a)).toBeCloseTo(0.2, 5)
  expect(Number(s.b)).toBeCloseTo(0.7, 5)
  expect(s.fillStart).toBeGreaterThan(0)     // it does not start at the lane's edge
  expect(s.fillWidth).toBeGreaterThan(0)
  expect(s.fillWidth).toBeLessThan(s.trackWidth)
})

test('the published positions are sorted by value, not by document order', async ({ page }) => {
  // Force the upper input below the lower one from script, then sync: a/b must
  // still come out in order, because a clamping owner may have just corrected one.
  const sorted = await page.locator(GROUP).evaluate((g) => {
    const scale = g.querySelector('.RangeScale')
    g.querySelector('[data-role="upper"]').value = '100'
    scale.__rangeScaleInstance.sync()
    const cs = getComputedStyle(scale)
    return {
      a: Number(cs.getPropertyValue('--_rs-a')),
      b: Number(cs.getPropertyValue('--_rs-b')),
    }
  })
  expect(sorted.a).toBeLessThanOrEqual(sorted.b)
})

// ── The exposed span ─────────────────────────────────────────────────────────

test('the narrowed span is exposed through ARIA, and the attributes stay put', async ({ page }) => {
  const s = await state(page)
  expect(s.lowerMax).toBe('700')             // not the attribute's 1000
  expect(s.upperMin).toBe('200')             // not the attribute's 0

  // The attributes themselves are untouched: changing them would shrink the
  // input's own geometry and the two would stop sharing a coordinate system.
  await expect(page.locator(LOWER)).toHaveAttribute('max', '1000')
  await expect(page.locator(UPPER)).toHaveAttribute('min', '0')
})

test('the announcement carries the span in words and does not repeat the role', async ({ page }) => {
  const s = await state(page)
  expect(s.lowerText).toBe('200 tkr, within 200–700 tkr')
  expect(s.upperText).toBe('700 tkr, within 200–700 tkr')
  // The <label> already says which end it is; the text must not say it again.
  expect(s.lowerText.toLowerCase()).not.toContain('lowest')
  expect(s.upperText.toLowerCase()).not.toContain('highest')
})

test('the exposed span follows the values as they move', async ({ page }) => {
  const lower = page.locator(LOWER)
  await lower.scrollIntoViewIfNeeded()
  await lower.focus()
  await page.keyboard.press('ArrowRight')

  const s = await state(page)
  expect(s.lower).toBe('210')
  expect(s.upperMin).toBe('210')
  expect(s.lowerText).toContain('210–700')
  expect(s.readouts).toEqual(['210 tkr', '700 tkr'])
})

// ── Pointer arbitration ──────────────────────────────────────────────────────

const raise = (page, groupId, fraction) =>
  page.evaluate(([sel, f]) => {
    const g = document.querySelector(sel)
    const scale = g.querySelector('.RangeScale')
    const box = scale.getBoundingClientRect()
    scale.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: box.left + box.width * f,
      clientY: box.top + box.height / 2,
    }))
    return g.querySelector('[data-role="lower"]').getAttribute('data-on-top') === 'true'
      ? 'lower' : 'upper'
  }, [`[data-id="${groupId}"]`, fraction])

test('the nearer end is raised while the ends are apart', async ({ page }) => {
  expect(await raise(page, 'rangegroup-live', 0.05)).toBe('lower')
  expect(await raise(page, 'rangegroup-live', 0.95)).toBe('upper')
})

/**
 * The case distance cannot solve: on the same value both are equally near, so the
 * tie is broken by SIDE. Without it one end is permanently unreachable once they
 * meet — the pair becomes a dead control.
 */
test('on the same value the tie is broken by side, not distance', async ({ page }) => {
  const s = await state(page, '[data-id="rangegroup-collided"]')
  expect(s.lower).toBe(s.upper)

  expect(await raise(page, 'rangegroup-collided', 0.2)).toBe('lower')
  expect(await raise(page, 'rangegroup-collided', 0.8)).toBe('upper')
})

test('exactly one end is on top at any moment', async ({ page }) => {
  await raise(page, 'rangegroup-live', 0.5)
  const s = await state(page)
  expect([s.onTop.lower, s.onTop.upper].sort()).toEqual(['false', 'true'])
})

test('RTL reads the side along the inline axis, so the lower end is on the right', async ({ page }) => {
  const dir = await page.locator('[data-id="rangegroup-rtl"] .RangeScale')
    .evaluate((el) => getComputedStyle(el).direction)
  expect(dir).toBe('rtl')

  expect(await raise(page, 'rangegroup-rtl', 0.95)).toBe('lower')
  expect(await raise(page, 'rangegroup-rtl', 0.05)).toBe('upper')
})

// ── Native does the rest ─────────────────────────────────────────────────────

test('both ends are separate sliders in the tab order, with their own names', async ({ page }) => {
  const lower = page.locator(LOWER)
  await lower.scrollIntoViewIfNeeded()
  await expect(lower).toHaveRole('slider')
  await expect(page.locator(UPPER)).toHaveRole('slider')

  await lower.focus()
  await expect(lower).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator(UPPER)).toBeFocused()

  const names = await page.evaluate(() => {
    const g = document.querySelector('[data-id="rangegroup-live"]')
    return [...g.querySelectorAll('.RangeField')].map((f) => f.labels[0].textContent.trim())
  })
  expect(names[0]).toContain('Lowest')
  expect(names[1]).toContain('Highest')
})

test('the group name comes from the legend, with no id plumbing', async ({ page }) => {
  const wired = await page.evaluate(() => {
    const g = document.querySelector('[data-id="rangegroup-live"]')
    return {
      isFieldset: g.tagName.toLowerCase(),
      legend: g.querySelector('legend')?.textContent.trim(),
      firstChild: g.firstElementChild?.tagName.toLowerCase(),
      hasAriaLabel: g.hasAttribute('aria-label') || g.hasAttribute('aria-labelledby'),
    }
  })
  expect(wired.isFieldset).toBe('fieldset')
  expect(wired.firstChild).toBe('legend')
  expect(wired.legend).toBe('Price')
  expect(wired.hasAriaLabel).toBe(false)
})

test('disabled on the fieldset reaches both fields', async ({ page }) => {
  const ids = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.RangeGroup')].find((x) => x.disabled)
    return [...g.querySelectorAll('.RangeField')].map((f) => f.id)
  })
  expect(ids).toHaveLength(2)
  for (const id of ids) await expect(page.locator(`#${id}`)).toBeDisabled()
})

test('sync() is public, for the same reason the lane needs one', async ({ page }) => {
  const drift = await page.locator(GROUP).evaluate((g) => {
    g.querySelector('[data-role="upper"]').value = '900'   // no event fires
    const stale = g.querySelector('[data-role="lower"]').getAttribute('aria-valuemax')
    g.__rangeGroupInstance.sync()
    return { stale, synced: g.querySelector('[data-role="lower"]').getAttribute('aria-valuemax') }
  })
  expect(drift.stale).not.toBe('900')
  expect(drift.synced).toBe('900')
})

// ── Accessibility ────────────────────────────────────────────────────────────

test('no axe violations across RangeGroup states', async ({ page }) => {
  await page.locator('.RangeGroup').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#RangeGroup')
})

// ── The component's width must not follow its content ─────────────────────────
//
// Reported from the test environment: dragging the upper end to maximum made the
// container reflow. "700" is one character narrower than "1000", so crossing into
// four digits widened the readout, the label, the fieldset and — because the lane
// is inside it — the track. Every position then recomputed and the thumb jumped
// under the finger mid-drag.

test('crossing a digit boundary does not resize the group or the lane', async ({ page }) => {
  const widths = await page.evaluate(() => {
    const g = document.querySelector('[data-id="rangegroup-flush"]')
    const upper = g.querySelector('[data-role="upper"]')
    const lane = g.querySelector('.RangeScale')
    const track = lane.querySelector('.track')
    const out = []
    for (const v of [200, 700, 990, 1000]) {
      upper.value = String(v)
      upper.dispatchEvent(new Event('input', { bubbles: true }))
      out.push({
        value: upper.value,
        group: g.getBoundingClientRect().width,
        lane: lane.getBoundingClientRect().width,
        track: track.getBoundingClientRect().width,
        readout: g.querySelector('[data-readout="upper"]').getBoundingClientRect().width,
      })
    }
    return out
  })

  // The widest value is actually reached, or the test proves nothing.
  expect(widths.at(-1).value).toBe('1000')

  for (const key of ['group', 'lane', 'track', 'readout']) {
    const unique = new Set(widths.map((w) => Math.round(w[key])))
    expect(unique.size, `${key} widths: ${[...unique].join(', ')}`).toBe(1)
  }
})

test('only the digits are reserved, so the unit costs its natural width', async ({ page }) => {
  const measured = await page.evaluate(() => {
    const g = document.querySelector('[data-id="rangegroup-flush"]')
    const readout = g.querySelector('[data-readout="upper"]')
    const digits = readout.querySelector('.digits')
    return {
      reserved: Number(getComputedStyle(g).getPropertyValue('--_rg-readout-digits')),
      digitsText: digits.textContent,
      unitInMarkup: readout.textContent.replace(digits.textContent, '').trim(),
      // The reservation covers the digits only; the readout is wider by the unit.
      digitsWidth: digits.getBoundingClientRect().width,
      readoutWidth: readout.getBoundingClientRect().width,
    }
  })
  expect(measured.reserved).toBe(4)            // "1000"
  expect(measured.unitInMarkup).toBe('tkr')    // static markup, not written by JS
  expect(measured.readoutWidth).toBeGreaterThan(measured.digitsWidth)
})

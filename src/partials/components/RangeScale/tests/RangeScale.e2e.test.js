import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

const LANE = '[data-id="rangescale-live"]'
const FIELD = '#rs-live'

const laneMetrics = (page, selector) =>
  page.evaluate((sel) => {
    const lane = document.querySelector(sel)
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width } }
    const cs = getComputedStyle(lane)
    return {
      p: cs.getPropertyValue('--_rs-p').trim(),
      inset: cs.getPropertyValue('--_rs-inset').trim(),
      track: r(lane.querySelector('.track')),
      fill: r(lane.querySelector('.fill')),
      field: r(lane.querySelector('.RangeField')),
      output: lane.querySelector('output.value')?.textContent ?? null,
      valuetext: lane.querySelector('.RangeField').getAttribute('aria-valuetext'),
    }
  }, selector)

// ── The one thing this tier exists for ────────────────────────────────────────

test('dragging syncs the fill, the readout and the announced value together', async ({ page }) => {
  const field = page.locator(FIELD)
  await field.scrollIntoViewIfNeeded()

  const before = await laneMetrics(page, LANE)
  expect(before.p).toBe('0.5')
  expect(before.output).toBe('50 %')
  expect(before.valuetext).toBe('50 %')

  await field.focus()
  await page.keyboard.press('End')
  await expect(field).toHaveValue('100')

  const after = await laneMetrics(page, LANE)
  expect(after.p).toBe('1')
  expect(after.output).toBe('100 %')
  expect(after.valuetext).toBe('100 %')
  expect(after.fill.w).toBeGreaterThan(before.fill.w)
})

test('the readout is an <output> and never a live region', async ({ page }) => {
  const out = page.locator(`${LANE} output.value`)
  await out.scrollIntoViewIfNeeded()
  await expect(out).toHaveAttribute('for', 'rs-live')
  await expect(out).not.toHaveAttribute('aria-live')
  await expect(out).not.toHaveAttribute('role')
})

test('sync() is public, because `input` does not fire on a programmatic value', async ({ page }) => {
  await page.locator(FIELD).scrollIntoViewIfNeeded()

  const drift = await page.evaluate((sel) => {
    const lane = document.querySelector(sel)
    const field = lane.querySelector('.RangeField')
    field.value = '80'                                  // no event fires
    const stale = getComputedStyle(lane).getPropertyValue('--_rs-p').trim()
    lane.__rangeScaleInstance.sync()
    const synced = getComputedStyle(lane).getPropertyValue('--_rs-p').trim()
    return { stale, synced }
  }, LANE)

  expect(drift.stale).not.toBe('0.8')   // the drift is real …
  expect(drift.synced).toBe('0.8')      // … and sync() is the documented cure
})

// ── Lane model ────────────────────────────────────────────────────────────────

test('inset: the fill stops half a thumb short of the track end at max', async ({ page }) => {
  await page.locator('[data-id="rangescale-inset"] .RangeField').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const f = document.querySelector('[data-id="rangescale-inset"] .RangeField')
    f.value = '100'; f.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const m = await laneMetrics(page, '[data-id="rangescale-inset"]')
  const thumb = await page.locator('[data-id="rangescale-inset"]').evaluate((el) =>
    parseFloat(getComputedStyle(el.querySelector('.RangeField')).blockSize))

  expect(m.track.r - m.fill.r).toBeCloseTo(thumb / 2, 0)
  expect(m.field.w).toBeCloseTo(m.track.w, 0)          // the input is not widened
})

test('flush: the fill reaches the track end and the input is one thumb wider', async ({ page }) => {
  await page.locator('[data-id="rangescale-flush"] .RangeField').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const f = document.querySelector('[data-id="rangescale-flush"] .RangeField')
    f.value = '100'; f.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const m = await laneMetrics(page, '[data-id="rangescale-flush"]')
  const thumb = await page.locator('[data-id="rangescale-flush"]').evaluate((el) =>
    parseFloat(getComputedStyle(el.querySelector('.RangeField')).blockSize))

  expect(m.inset).toBe('0px')
  expect(m.track.r - m.fill.r).toBeCloseTo(0, 0)
  expect(m.field.w - m.track.w).toBeCloseTo(thumb, 0)
})

test('the lane model is a length, so a partial overhang is expressible', async ({ page }) => {
  await page.locator('[data-id="rangescale-partial"] .RangeField').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const f = document.querySelector('[data-id="rangescale-partial"] .RangeField')
    f.value = '100'; f.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const m = await laneMetrics(page, '[data-id="rangescale-partial"]')
  const gap = m.track.r - m.fill.r
  expect(gap).toBeGreaterThan(0)          // not flush …
  expect(gap).toBeLessThan(12)            // … and not the full half-thumb either
})

// ── Direction ─────────────────────────────────────────────────────────────────

test('RTL: the fill anchors to the right edge with no extra rule', async ({ page }) => {
  const lane = '[data-id="rangescale-rtl"]'
  await page.locator(`${lane} .RangeField`).scrollIntoViewIfNeeded()
  const m = await laneMetrics(page, lane)
  expect(Math.abs(m.fill.r - m.track.r)).toBeLessThan(1)
  expect(m.fill.w).toBeGreaterThan(0)
  expect(m.fill.w).toBeLessThan(m.track.w)
})

// ── Vertical ──────────────────────────────────────────────────────────────────

test('vertical: the fill is anchored in the same end as the slider min', async ({ page }) => {
  const read = (id) => page.evaluate((laneId) => {
    const lane = document.querySelector(`[data-id="${laneId}"]`)
    const field = lane.querySelector('.RangeField')
    field.value = '20'; field.dispatchEvent(new Event('input', { bubbles: true }))
    const t = lane.querySelector('.track').getBoundingClientRect()
    const f = lane.querySelector('.fill').getBoundingClientRect()
    return { anchoredBottom: Math.abs(f.bottom - t.bottom) < 1,
             anchoredTop: Math.abs(f.top - t.top) < 1,
             fillH: f.height, trackH: t.height }
  }, id)

  const bottom = await read('rangescale-vertical')
  expect(bottom.anchoredBottom).toBe(true)
  expect(bottom.fillH).toBeLessThan(bottom.trackH)

  const top = await read('rangescale-vertical-top')
  expect(top.anchoredTop).toBe(true)
})

test('vertical: the lane owns the length and the field stretches to it', async ({ page }) => {
  const m = await page.evaluate(() => {
    const lane = document.querySelector('[data-id="rangescale-vertical"]')
    return { lane: lane.getBoundingClientRect().height,
             field: lane.querySelector('.RangeField').getBoundingClientRect().height }
  })
  expect(m.field).toBeCloseTo(m.lane, 0)
})

// ── The lane must not steal the input's hit target ─────────────────────────────

test('the layers are pointer-events: none, so the whole lane hits the input', async ({ page }) => {
  const events = await page.locator(LANE).evaluate((lane) =>
    ['.track', '.fill'].map((sel) => getComputedStyle(lane.querySelector(sel)).pointerEvents))
  expect(events).toEqual(['none', 'none'])

  // A click in the middle of the lane reaches the input and moves the value.
  const field = page.locator(FIELD)
  await field.scrollIntoViewIfNeeded()
  const before = await field.inputValue()
  const box = await page.locator(`${LANE} .track`).boundingBox()
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2)
  expect(await field.inputValue()).not.toBe(before)
})

// ── No layout shift while interacting ─────────────────────────────────────────

test('grabbing the thumb does not reflow the page', async ({ page }) => {
  const field = page.locator(FIELD)
  await field.scrollIntoViewIfNeeded()

  const measure = () => page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const r = el.getBoundingClientRect()
    return { h: r.height, top: r.top, doc: document.documentElement.scrollHeight }
  }, FIELD)

  const idle = await measure()
  await page.evaluate((sel) => document.querySelector(sel).setAttribute('data-test-state', 'active'), FIELD)
  const active = await measure()
  await page.evaluate((sel) => document.querySelector(sel).removeAttribute('data-test-state'), FIELD)

  // The thumb grows by transform, which does not participate in layout.
  expect(active.h).toBe(idle.h)
  expect(active.top).toBe(idle.top)
  expect(active.doc).toBe(idle.doc)
})

// ── Accessibility ─────────────────────────────────────────────────────────────

test('no axe violations across RangeScale states', async ({ page }) => {
  await page.locator('.RangeScale').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
  await checkA11y(page, '#RangeScale')
})

// ── Ticks ─────────────────────────────────────────────────────────────────────
//
// Verified formula-independently: derive the inset from the first and last stop's
// rendered position, then check every stop falls on the straight line between
// them. That catches a wrong formula, a wrong unit and a wrong lane model without
// re-implementing any of them in the test.

const tickGeometry = (page, id) =>
  page.evaluate((laneId) => {
    const lane = document.querySelector(`[data-id="${laneId}"]`)
    const track = lane.querySelector('.track').getBoundingClientRect()
    const items = [...lane.querySelectorAll('.ticks > i')]
    const centre = (el) => {
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2 - track.left
    }
    const stops = items.map((i) => Number(i.style.getPropertyValue('--p')))
    const xs = items.map(centre)
    const insetStart = xs[0]
    const insetEnd = track.width - xs[xs.length - 1]
    const travel = track.width - insetStart - insetEnd
    const predicted = stops.map((p) => insetStart + p * travel)
    const mark = getComputedStyle(items[0], '::before')
    return {
      stops,
      insetStart,
      insetEnd,
      linearError: Math.max(...xs.map((x, i) => Math.abs(x - predicted[i]))),
      halfThumb: parseFloat(getComputedStyle(lane.querySelector('.RangeField')).blockSize) / 2,
      markBlockSize: parseFloat(mark.blockSize),
      markOffset: parseFloat(mark.marginBlockStart),
      itemFontSize: parseFloat(getComputedStyle(items[0]).fontSize),
      laneFontSize: parseFloat(getComputedStyle(lane).fontSize),
      labelHidden: getComputedStyle(items[0].querySelector('span')).display === 'none',
      ariaHidden: lane.querySelector('.ticks').getAttribute('aria-hidden'),
    }
  }, id)

test('every stop lands on the line the lane model predicts', async ({ page }) => {
  for (const id of ['rangescale-ticks-labels', 'rangescale-ticks-uneven']) {
    const g = await tickGeometry(page, id)
    expect(g.linearError, id).toBeLessThan(0.5)
    expect(g.insetStart, id).toBeCloseTo(g.insetEnd, 0)   // symmetric
    expect(g.insetStart, id).toBeCloseTo(g.halfThumb, 0)  // inset lane = half a thumb
  }
})

test('a flush lane puts the first and last stop on the visible ends', async ({ page }) => {
  const g = await tickGeometry(page, 'rangescale-ticks-flush')
  expect(g.insetStart).toBeCloseTo(0, 0)
  expect(g.insetEnd).toBeCloseTo(0, 0)
  expect(g.linearError).toBeLessThan(0.5)
})

test('uneven stops need no extra mechanism', async ({ page }) => {
  const g = await tickGeometry(page, 'rangescale-ticks-uneven')
  expect(g.stops).toEqual([0, 0.1, 0.3, 0.7, 1])
  const gaps = g.stops.slice(1).map((p, i) => p - g.stops[i])
  expect(new Set(gaps).size).toBeGreaterThan(1)   // genuinely uneven …
  expect(g.linearError).toBeLessThan(0.5)         // … and still exact
})

/**
 * The stop element carries geometry and therefore must keep the LANE's font-size:
 * the em lengths are custom properties, which resolve against the font-size of
 * the element that uses them. When the label's smaller size sat here, a 6px mark
 * rendered 4.5px and a −12px offset rendered −9px.
 */
test('the stop element keeps the lane font-size, so the mark geometry is exact', async ({ page }) => {
  const g = await tickGeometry(page, 'rangescale-ticks-labels')
  expect(g.itemFontSize).toBe(g.laneFontSize)
  expect(g.markBlockSize).toBeCloseTo(6, 0)
  expect(g.markOffset).toBeCloseTo(-12, 0)
})

test('marks and labels are the same markup, one attribute apart', async ({ page }) => {
  const marks = await tickGeometry(page, 'rangescale-ticks-marks')
  const labels = await tickGeometry(page, 'rangescale-ticks-labels')

  expect(marks.labelHidden).toBe(true)     // the text is authored, not rendered
  expect(labels.labelHidden).toBe(false)
  expect(marks.markBlockSize).toBeCloseTo(labels.markBlockSize, 1)
  expect(marks.stops).toEqual(labels.stops)
})

test('ticks are aria-hidden, because step already carries them to the keyboard', async ({ page }) => {
  const g = await tickGeometry(page, 'rangescale-ticks-labels')
  expect(g.ariaHidden).toBe('true')

  // The claim behind that: the keyboard lands on exactly the drawn stops.
  const field = page.locator('#rs-ticks-labels')
  await field.scrollIntoViewIfNeeded()
  await field.focus()
  await page.keyboard.press('Home')
  await expect(field).toHaveValue('0')
  await page.keyboard.press('ArrowRight')
  await expect(field).toHaveValue('25')       // a drawn stop, not 1
})

test('the label row reserves its own height and does not collide with the readout', async ({ page }) => {
  const clash = await page.evaluate(() => {
    const lane = document.querySelector('[data-id="rangescale-ticks-labels"]')
    const last = [...lane.querySelectorAll('.ticks > i')].pop().getBoundingClientRect()
    const out = lane.querySelector('output.value').getBoundingClientRect()
    return last.bottom > out.top + 1
  })
  expect(clash).toBe(false)
})

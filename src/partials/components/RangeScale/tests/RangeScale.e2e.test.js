import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

const LANE = '[data-id="rangescale-live"]'
const FIELD = '#rs-live'

// `locator.evaluate` rather than `page.evaluate` + `document.querySelector`:
// the locator resolves the element first — through an open shadow root if the
// port put one there — and hands it in. `document.querySelector` inside an
// evaluate can never cross that boundary, measured: it returns null while the
// locator returns the element, its box and its computed style.
const laneMetrics = (page, selector) =>
  page.locator(selector).evaluate((lane) => {
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
  })

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

test('the readout is an <output> and suppresses its implicit live region', async ({ page }) => {
  const out = page.locator(`${LANE} output.value`)
  await out.scrollIntoViewIfNeeded()
  await expect(out).toHaveAttribute('for', 'rs-live')
  // Absence is not silence: a bare <output> computes to live="polite". This
  // assertion used to require the attribute to be MISSING, which enforced the
  // announcing behaviour it was named after preventing.
  await expect(out).toHaveAttribute('aria-live', 'off')
  await expect(out).not.toHaveAttribute('role')
})

test('sync() is public, because `input` does not fire on a programmatic value', async ({ page }) => {
  await page.locator(FIELD).scrollIntoViewIfNeeded()

  const drift = await page.locator(LANE).evaluate((lane) => {
    const field = lane.querySelector('.RangeField')
    field.value = '80'                                  // no event fires
    const stale = getComputedStyle(lane).getPropertyValue('--_rs-p').trim()
    lane.__rangeScaleInstance.sync()
    const synced = getComputedStyle(lane).getPropertyValue('--_rs-p').trim()
    return { stale, synced }
  })

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

  const measure = () => page.locator(FIELD).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { h: r.height, top: r.top, doc: document.documentElement.scrollHeight }
  })

  const idle = await measure()
  await page.locator(FIELD).evaluate((el) => el.setAttribute('data-test-state', 'active'))
  const active = await measure()
  await page.locator(FIELD).evaluate((el) => el.removeAttribute('data-test-state'))

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

// ── Reference layer ───────────────────────────────────────────────────────────

const referenceGeometry = (page, id) =>
  page.evaluate((laneId) => {
    const lane = document.querySelector(`[data-id="${laneId}"]`)
    const track = lane.querySelector('.track').getBoundingClientRect()
    const ref = lane.querySelector('.reference')
    const box = ref.getBoundingClientRect()
    const cs = getComputedStyle(ref)
    const fill = lane.querySelector('.fill')
    return {
      form: lane.dataset.reference,
      from: Number(getComputedStyle(lane).getPropertyValue('--_rs-ref-from')),
      to: Number(getComputedStyle(lane).getPropertyValue('--_rs-ref-to')),
      startOffset: box.left - track.left,
      width: box.width,
      trackWidth: track.width,
      zIndex: Number(cs.zIndex),
      pointerEvents: cs.pointerEvents,
      ink: cs.backgroundColor,
      borderInk: cs.borderTopColor,
      fillInk: fill ? getComputedStyle(fill).backgroundColor : null,
      fillDisplay: fill ? getComputedStyle(fill).display : null,
      thumbZ: Number(getComputedStyle(lane.querySelector('.RangeField')).zIndex),
      swatchInk: (() => {
        const sw = lane.querySelector('.swatch')
        return sw ? getComputedStyle(sw).backgroundColor : null
      })(),
    }
  }, id)

test('a band spans exactly the two numbers it was given', async ({ page }) => {
  // The flush lane has inset 0, so the expected geometry is p × width with no
  // half-thumb term — the one case a test can predict without re-deriving it.
  const g = await referenceGeometry(page, 'rangescale-ref-with-ticks')
  expect(g.startOffset).toBeCloseTo(g.from * g.trackWidth, 0)
  expect(g.width).toBeCloseTo((g.to - g.from) * g.trackWidth, 0)
})

test('a marker is a band of no width, centred on its position', async ({ page }) => {
  const g = await referenceGeometry(page, 'rangescale-ref-marker')
  expect(g.to).toBe(g.from)
  expect(g.width).toBeLessThan(4)     // a hairline, not a span
  expect(g.width).toBeGreaterThan(0)  // but never zero, or it disappears
})

/**
 * min() in CSS replaces the JS branch a production slider needed for exactly
 * this: consumption is never drawn past the limit the user has set.
 */
test('a region is clamped to the fill, without JavaScript', async ({ page }) => {
  const lane = '[data-id="rangescale-ref-region"]'
  await page.locator(`${lane} .RangeField`).scrollIntoViewIfNeeded()

  const widthAt = (value) =>
    page.evaluate(([sel, v]) => {
      const l = document.querySelector(sel)
      const f = l.querySelector('.RangeField')
      f.value = String(v)
      f.dispatchEvent(new Event('input', { bubbles: true }))
      return l.querySelector('.reference').getBoundingClientRect().width
    }, [lane, value])

  const free = await widthAt(90)     // limit well above consumption
  const atRest = await widthAt(50)
  const clamped = await widthAt(10)  // limit below consumption

  expect(atRest).toBeCloseTo(free, 0)      // unclamped while there is room
  expect(clamped).toBeLessThan(free)       // and it stops following below it
})

test('without a fill there is nothing to clamp against', async ({ page }) => {
  const g = await referenceGeometry(page, 'rangescale-ref-region-nofill')
  // The element stays in the markup and is switched off, so the state is one
  // attribute rather than two shapes of DOM.
  expect(g.fillDisplay).toBe('none')

  // And the region is then only itself: unaffected by where the thumb sits.
  const widths = await page.evaluate(() => {
    const l = document.querySelector('[data-id="rangescale-ref-region-nofill"]')
    const f = l.querySelector('.RangeField')
    const w = () => l.querySelector('.reference').getBoundingClientRect().width
    f.value = '5'; f.dispatchEvent(new Event('input', { bubbles: true }))
    const low = w()
    f.value = '95'; f.dispatchEvent(new Event('input', { bubbles: true }))
    return { low, high: w() }
  })
  expect(widths.low).toBeCloseTo(widths.high, 1)
})

test('the layer never rises above the thumb and never takes the pointer', async ({ page }) => {
  for (const id of ['rangescale-ref-region', 'rangescale-ref-band',
                    'rangescale-ref-band-variant', 'rangescale-ref-band-under',
                    'rangescale-ref-marker']) {
    const g = await referenceGeometry(page, id)
    expect(g.zIndex, id).toBeLessThan(g.thumbZ)
    expect(g.pointerEvents, id).toBe('none')
  }
})

test('the layer position follows the form, and under is only ever explicit', async ({ page }) => {
  const band = await referenceGeometry(page, 'rangescale-ref-band')
  const region = await referenceGeometry(page, 'rangescale-ref-region')
  const forced = await referenceGeometry(page, 'rangescale-ref-band-under')

  // A band defaults to a bracket above the lane, drawn with a border rather than
  // an area — least legible behind the fill is exactly when the value is inside it.
  expect(band.ink).toBe('rgba(0, 0, 0, 0)')
  expect(band.borderInk).not.toBe('rgba(0, 0, 0, 0)')

  // A region is rarely covered, so it sits on the fill as an area.
  expect(region.ink).not.toBe('rgba(0, 0, 0, 0)')
  expect(region.zIndex).toBeGreaterThan(-2)

  // `under` is the reading that hides a band, so it has to be asked for.
  expect(forced.zIndex).toBe(-2)
})

/**
 * A tint of currentColor over a fill of currentColor is invisible. The neutral
 * ink therefore has to differ from the fill, and a coloured variant has to come
 * from the theming seam rather than from this component.
 */
test('the neutral reference reads against the fill', async ({ page }) => {
  const g = await referenceGeometry(page, 'rangescale-ref-region')
  expect(g.ink).not.toBe(g.fillInk)
})

test('a variant takes its colour from the --ui-* seam', async ({ page }) => {
  const warning = await referenceGeometry(page, 'rangescale-ref-band-variant')
  const success = await referenceGeometry(page, 'rangescale-ref-marker')
  const info = await referenceGeometry(page, 'rangescale-ref-band-under')

  const inks = [warning.ink, success.ink, info.ink]
  expect(new Set(inks).size).toBe(3)            // three different semantics
  for (const ink of inks) expect(ink).toMatch(/^rgb/)   // resolved, not a fallback keyword
})

/**
 * Colour is never the only carrier (WCAG 1.4.1). The swatch inherits the layer's
 * own ink, so the author never restates the variant and the two cannot drift.
 */
test('the swatch matches the layer it explains, without restating the variant', async ({ page }) => {
  for (const id of ['rangescale-ref-band-variant', 'rangescale-ref-marker',
                    'rangescale-ref-band-under', 'rangescale-ref-region']) {
    const g = await referenceGeometry(page, id)
    expect(g.swatchInk, id).toBe(g.ink === 'rgba(0, 0, 0, 0)' ? g.borderInk : g.ink)
  }
})

test('the hint is inside the lane and the field points at it', async ({ page }) => {
  const wired = await page.evaluate(() => {
    const lane = document.querySelector('[data-id="rangescale-ref-band-variant"]')
    const hint = lane.querySelector('.hint')
    const field = lane.querySelector('.RangeField')
    return {
      inside: !!hint,
      describedBy: field.getAttribute('aria-describedby'),
      hintId: hint.id,
      swatchHidden: hint.querySelector('.swatch').getAttribute('aria-hidden'),
    }
  })
  expect(wired.inside).toBe(true)
  expect(wired.describedBy).toBe(wired.hintId)
  expect(wired.swatchHidden).toBe('true')
})

test('a reference layer and ticks agree without knowing about each other', async ({ page }) => {
  const g = await referenceGeometry(page, 'rangescale-ref-with-ticks')
  const ticks = await tickGeometry(page, 'rangescale-ref-with-ticks')

  // The band's edges sit on the stops that share their normalised position.
  const stopX = (p) => ticks.insetStart + p * (g.trackWidth - ticks.insetStart - ticks.insetEnd)
  expect(g.startOffset).toBeCloseTo(stopX(g.from), 0)
  expect(g.startOffset + g.width).toBeCloseTo(stopX(g.to), 0)
})

// ── The lane's width must not follow its readout ──────────────────────────────
//
// The same defect as the one reported against RangeGroup, latent here: a value
// crossing into another digit widens the readout, and in a shrink-to-fit container
// that widens the lane — which recomputes every position mid-drag.

test('crossing a digit boundary does not resize the lane', async ({ page }) => {
  const widths = await page.evaluate(() => {
    const lane = document.querySelector('[data-id="rangescale-ref-band"]')
    const field = lane.querySelector('.RangeField')
    const out = []
    for (const v of [0, 400, 990, 1000]) {
      field.value = String(v)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      out.push({
        value: field.value,
        lane: lane.getBoundingClientRect().width,
        track: lane.querySelector('.track').getBoundingClientRect().width,
        readout: lane.querySelector('output.value').getBoundingClientRect().width,
      })
    }
    return out
  })

  expect(widths.at(-1).value).toBe('1000')
  for (const key of ['lane', 'track', 'readout']) {
    const unique = new Set(widths.map((w) => Math.round(w[key])))
    expect(unique.size, `${key} widths: ${[...unique].join(', ')}`).toBe(1)
  }
})

// ── The readout must not announce ─────────────────────────────────────────────
// A bare <output> computes to role=status with live=polite and atomic=true. The
// slider is the focused control and already announces its own value through
// aria-valuetext, so a live readout says everything twice — and during a drag it
// says it at every step.
//
// Asserted through the accessibility tree, not the DOM attribute. The attribute is
// what we wrote; the computed `live` property is what a screenreader acts on, and
// only the second one is the claim worth testing.
test('the readout is not a live region', async ({ page }) => {
  const output = page.locator(`${LANE} output.value`)
  await expect(output).toBeVisible()

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Accessibility.enable')
  const doc = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: `${LANE} output.value`,
  })
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
    nodeId,
    fetchRelatives: false,
  })
  const live = nodes[0]?.properties?.find((p) => p.name === 'live')?.value?.value

  expect(live ?? 'none', 'the readout is announcing on every value change').toBe('none')
})

// ── A lane with no readout still has a unit ──────────────────────────────────
// `data-suffix` on the lane is what makes that possible. The only way to announce
// a unit without a visible readout used to be authoring a static aria-valuetext,
// which then drifted silently: the demo shipped "50 %" and seven arrow presses
// later the value was 57 while the announcement still said 50.
test('aria-valuetext tracks the value when there is no readout', async ({ page }) => {
  const field = page.locator('[data-id="rangescale-no-output"] input[type="range"]')
  await expect(field).toHaveAttribute('aria-valuetext', /^\d+ %$/)

  const before = await field.inputValue()
  await field.focus()
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight')

  const after = await field.inputValue()
  expect(after).not.toBe(before)
  await expect(field).toHaveAttribute('aria-valuetext', `${after} %`)
})

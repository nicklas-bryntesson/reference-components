import { test, expect } from '@playwright/test'
import { targetPath } from '../src/e2e-helpers/target.js'

/**
 * WCAG 2.1 SC 1.4.12 Text Spacing (AA) — survivability.
 *
 * The criterion says a user must be able to force four properties with **no loss
 * of content or functionality**:
 *
 *   line-height              >= 1.5  x font size
 *   spacing after paragraphs >= 2     x font size
 *   letter-spacing           >= 0.12  x font size
 *   word-spacing             >= 0.16  x font size
 *
 * This is the one typographic thing the library owns outright (ADR-0025): the
 * scale, the family and the rhythm belong to the consuming project, but whether a
 * component SURVIVES the consumer's typography is mechanical, and almost nobody
 * ships a test for it.
 *
 * The suite is site-level rather than per-component, because the failure it looks
 * for is never in one component's logic — it is in a fixed dimension holding text
 * that was measured against one particular set of spacings.
 *
 * WHAT IS ASSERTED, and why these three:
 *
 *  1. Nothing is CLIPPED. An element whose overflow is hidden and whose content
 *     now exceeds its box has lost content, which is the criterion's own wording.
 *  2. The page gains no HORIZONTAL scroll. Reflow (1.4.10) and this criterion
 *     interact: text that grows sideways must wrap, not push the page wide.
 *  3. Interactive TARGETS keep their size. "No loss of functionality" includes a
 *     control that was 24px and is now 18px because a label grew around it.
 *
 * Overlap is deliberately NOT asserted. This library stacks elements on purpose —
 * a RangeScale lane is a grid stack where the track, the fill and the input share
 * one area — so an intersection test would be noise. Clipping is the honest proxy.
 */

// The four overrides, as the WCAG-recommended values. `!important` on everything,
// which is what a user stylesheet or the standard text-spacing bookmarklet does.
const TEXT_SPACING = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, blockquote, figcaption {
    margin-block-end: 2em !important;
  }
`

/** Intentional clipping this library ships, which the criterion does not forbid. */
const intentionallyClipped = `
  (el) => {
    const cs = getComputedStyle(el)
    // Screenreader-only text: clipped to a point on purpose.
    if (cs.clipPath && cs.clipPath !== 'none') return true
    const r = el.getBoundingClientRect()
    if (r.width <= 2 || r.height <= 2) return true
    // A scroller is meant to scroll; that is not lost content.
    if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) return true
    return false
  }
`

const measure = (page) =>
  page.evaluate(
    ([isIntentional]) => {
      const intentional = eval(isIntentional)

      const sections = [...document.querySelectorAll('section.kitchensink-section')]
      const clipped = []
      const smallTargets = []

      for (const section of sections) {
        const name = section.id || section.querySelector('h2')?.textContent?.trim() || '(unnamed)'

        for (const el of section.querySelectorAll('*')) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') continue

          // ── Clipping: overflow hidden AND content larger than the box ──────
          const hidden = /(hidden|clip)/.test(cs.overflowX + cs.overflowY)
          const hasText = (el.textContent ?? '').trim().length > 0
          if (hidden && hasText && !intentional(el)) {
            const overX = el.scrollWidth - el.clientWidth
            const overY = el.scrollHeight - el.clientHeight
            if (overX > 1 || overY > 1) {
              clipped.push({
                section: name,
                tag: el.tagName.toLowerCase(),
                cls: el.className?.toString?.().slice(0, 40) ?? '',
                overX,
                overY,
              })
            }
          }

          // ── Target size: a control must not shrink below the 24px floor ────
          if (el.matches('input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')) {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 23) {
              smallTargets.push({
                section: name,
                id: el.id || el.tagName.toLowerCase(),
                w: Math.round(r.width),
                h: Math.round(r.height),
              })
            }
          }
        }
      }

      return {
        sectionCount: sections.length,
        docHeight: document.documentElement.scrollHeight,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
        lineHeight: getComputedStyle(document.body).lineHeight,
        letterSpacing: getComputedStyle(document.body).letterSpacing,
        clipped,
        smallTargets,
      }
    },
    [intentionallyClipped],
  )

test.describe('WCAG 1.4.12 Text Spacing — the components survive it', () => {
  /**
   * The suite tests itself, because a green survivability suite is exactly the
   * kind that rots into theatre: one over-broad exclusion and it passes while
   * asserting nothing. Measured when written — 92 elements in the kitchensink have
   * `overflow: hidden` and text, so the clipping check has 92 real candidates,
   * 202 clip-path elements are excluded as screenreader-only, and 3 scrollers are
   * excluded as meant to scroll.
   *
   * This test plants a violation that cannot survive the overrides and requires
   * the detector to find it. If it ever passes silently, the exclusions have eaten
   * the suite.
   */
  test('the detector finds a planted violation', async ({ page }) => {
    await page.goto(targetPath())

    await page.evaluate(() => {
      const section = document.querySelector('section.kitchensink-section')
      const bad = document.createElement('div')
      bad.className = 'planted-violation'
      bad.style.cssText = 'overflow: hidden; inline-size: 40ch'
      bad.textContent = 'One line, exactly.'
      section.appendChild(bad)

      // The box is pinned to the line height as it is RIGHT NOW, in px. It fits
      // exactly one line today and cannot fit one at 1.5 — which is the whole
      // shape of the defect this suite hunts: a fixed dimension measured against
      // one particular set of spacings.
      //
      // It has to be intact BEFORE the overrides, or the baseline filter would
      // discard it as a pre-existing defect. That mistake is why this test exists
      // in the first place.
      // Pinned from the rendered box, NOT from computed lineHeight — that returns
      // the keyword `normal`, which is a valid computed value and does not resolve
      // to px, so assigning it silently does nothing and the element keeps growing.
      bad.style.blockSize = `${bad.getBoundingClientRect().height}px`
    })

    const before = await measure(page)
    await page.addStyleTag({ content: TEXT_SPACING })
    const after = await measure(page)

    const baseline = new Set(before.clipped.map((c) => `${c.section}/${c.tag}.${c.cls}`))
    const caused = after.clipped.filter((c) => !baseline.has(`${c.section}/${c.tag}.${c.cls}`))

    expect(caused.length, 'the planted violation must be detected').toBeGreaterThan(0)
    expect(caused.some((c) => c.cls.includes('planted-violation'))).toBe(true)
  })

  /**
   * Coverage cannot be assumed. The suite finds sections by selector, so a
   * component whose kitchensink uses a different wrapper is silently not tested —
   * which is exactly what ToggleTip was, in a leftover `.examplePanel` from before
   * the convention existed. Asserting the relationship instead of a count means a
   * new component cannot quietly fall out of coverage.
   */
  test('every component on the page is inside a covered section', async ({ page }) => {
    await page.goto(targetPath())

    const uncovered = await page.evaluate(() => {
      const names = new Set()
      for (const el of document.querySelectorAll('[data-component]')) {
        if (!el.closest('section.kitchensink-section')) names.add(el.dataset.component)
      }
      return [...names]
    })

    expect(uncovered, `components outside any covered section: ${uncovered.join(', ')}`).toEqual([])
  })

  test('the overrides actually apply, and the page grows', async ({ page }) => {
    await page.goto(targetPath())
    const before = await measure(page)
    expect(before.sectionCount, 'kitchensink sections found').toBeGreaterThan(10)

    await page.addStyleTag({ content: TEXT_SPACING })
    const after = await measure(page)

    // The control assertion. Without it the whole suite could pass by doing
    // nothing at all — the same trap the digit-boundary test had to close.
    expect(after.letterSpacing, 'letter-spacing was forced').not.toBe(before.letterSpacing)
    expect(after.docHeight, 'the page got taller').toBeGreaterThan(before.docHeight)
  })

  test('no text is clipped', async ({ page }) => {
    await page.goto(targetPath())
    const before = await measure(page)
    await page.addStyleTag({ content: TEXT_SPACING })
    const after = await measure(page)

    // Anything already clipped is a pre-existing defect, not this criterion's —
    // report only what the overrides caused.
    const baseline = new Set(before.clipped.map((c) => `${c.section}/${c.tag}.${c.cls}`))
    const caused = after.clipped.filter((c) => !baseline.has(`${c.section}/${c.tag}.${c.cls}`))

    expect(caused, `clipped by text spacing:\n${JSON.stringify(caused, null, 2)}`).toEqual([])
  })

  test('the page gains no horizontal scroll', async ({ page }) => {
    await page.goto(targetPath())
    await page.addStyleTag({ content: TEXT_SPACING })
    const after = await measure(page)

    // Text that grows sideways must wrap, not widen the document.
    expect(after.docScrollWidth).toBeLessThanOrEqual(after.docClientWidth + 1)
  })

  test('interactive targets keep their size', async ({ page }) => {
    await page.goto(targetPath())
    const before = await measure(page)
    await page.addStyleTag({ content: TEXT_SPACING })
    const after = await measure(page)

    const baseline = new Set(before.smallTargets.map((t) => `${t.section}/${t.id}`))
    const shrunk = after.smallTargets.filter((t) => !baseline.has(`${t.section}/${t.id}`))

    expect(shrunk, `shrunk below 24px:\n${JSON.stringify(shrunk, null, 2)}`).toEqual([])
  })
})

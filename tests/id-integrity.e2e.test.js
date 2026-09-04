// Document-level integrity of the id graph.
//
// Every component in this library wires label to control, and control to
// description, by id reference — 45 ARIA references and 172 `label for=` across
// the repo. Two things can break that graph, both silently:
//
//   1. A duplicate id. The browser resolves a reference to the FIRST match, so a
//      second field carrying the same id steals its label. TimeField and
//      DateTimeField both shipped `meeting-time` for exactly this reason.
//   2. A reference to an id that does not exist. The relationship simply is not
//      announced, and nothing in the DOM looks wrong.
//
// axe catches neither on a shared page: duplicate-id rules were deprecated in
// axe-core 4.x, and a dangling `aria-describedby` is not a violation of any rule
// it ships. Both are also the first thing to break in a port — a framework that
// renders a component twice, or a shadow boundary that puts the label and the
// control in different trees.
import { test, expect } from '@playwright/test'
import { targetPath } from '../src/e2e-helpers/target.js'

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator('[data-initialized="true"]').first().waitFor()
})

test('no id appears twice in the document', async ({ page }) => {
  const duplicates = await page.evaluate(() => {
    const counts = new Map()
    for (const el of document.querySelectorAll('[id]')) {
      counts.set(el.id, (counts.get(el.id) ?? 0) + 1)
    }
    return [...counts].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n}×)`)
  })
  expect(duplicates, `duplicate ids steal each other's label and description`).toEqual([])
})

test('every id reference resolves to an element that exists', async ({ page }) => {
  const dangling = await page.evaluate(() => {
    // `for` on a <label> is an id reference; on an <output> it is a token list too.
    const IDREF = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for']
    const IDREF_SINGLE = ['aria-activedescendant']
    const out = []
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.toString().split(' ')[0] : ''}`

    for (const attr of [...IDREF, ...IDREF_SINGLE]) {
      for (const el of document.querySelectorAll(`[${attr}]`)) {
        const raw = el.getAttribute(attr)
        if (!raw) continue
        // aria-activedescendant is legitimately empty when nothing is active.
        const ids = IDREF_SINGLE.includes(attr) ? [raw.trim()].filter(Boolean) : raw.trim().split(/\s+/)
        for (const id of ids) {
          if (!document.getElementById(id)) out.push(`${describe(el)}[${attr}="${id}"]`)
        }
      }
    }
    return [...new Set(out)]
  })
  expect(dangling, 'a reference to a missing id is silently not announced').toEqual([])
})

// A popup's internals are cloned from a <template> at open time, so nothing above
// sees them: `aria-controls` on a month/year trigger, a wheel's `aria-labelledby`,
// a footer button's description. Those live in a fragment until the popup opens,
// and a fragment is not in the document. Opened one at a time, because opening a
// second dismisses the first.
for (const component of ['DateField', 'DateTimeField', 'TimeField', 'MonthField', 'WeekField']) {
  test(`${component}: references inside the open popup resolve`, async ({ page }) => {
    const root = page.locator(`[data-component="${component}"]`).first()
    await root.locator('[data-part="trigger"]').first().click()
    await expect(root.locator('[role="dialog"]')).toBeVisible()

    const result = await page.evaluate((name) => {
      const popup = document
        .querySelector(`[data-component="${name}"]`)
        ?.querySelector('[role="dialog"]')
      if (!popup) return { error: 'no open dialog' }
      const attrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for']
      const dangling = []
      let checked = 0
      for (const attr of attrs) {
        for (const el of popup.querySelectorAll(`[${attr}]`)) {
          for (const id of (el.getAttribute(attr) ?? '').trim().split(/\s+/).filter(Boolean)) {
            checked++
            if (!document.getElementById(id)) {
              dangling.push(`${el.tagName.toLowerCase()}[${attr}="${id}"]`)
            }
          }
        }
      }
      return {
        dangling: [...new Set(dangling)],
        checked,
        focusables: popup.querySelectorAll('button, [tabindex], input, [role="spinbutton"]').length,
      }
    }, component)

    expect(result.error).toBeUndefined()
    // Guard against a vacuous pass by proving we are looking at a populated
    // popup — NOT by requiring id references. Three of the five wire their popup
    // with direct `aria-label` strings and legitimately have none, which is also
    // the form that survives a shadow boundary, where an id graph does not.
    expect(result.focusables, `${component}: popup looks empty`).toBeGreaterThan(0)
    expect(result.dangling).toEqual([])
  })
}

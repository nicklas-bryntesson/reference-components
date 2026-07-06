// src/partials/components/AffixField/tests/AffixField.e2e.test.js
//
// The suite asserts the END-STATE, not the mechanism: every check below is a
// statement about the finished DOM (ids, aria-describedby, custom properties,
// geometry). A server-rendered implementation with zero client JS that renders
// the same end-state passes this suite unchanged.
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y } from '../../../../e2e-helpers/target.js'

const AF = targetId('AffixField')

// The variant roots carry stable data-id anchors (authored by the generator),
// following the family convention: [data-component="X"][data-id="…"].
const anchor = (id) => `[data-component="AffixField"][data-id="${id}"]`
const BARE = anchor('affixfield-bare')
const AUTHORED = anchor('affixfield-authored')
const UNIT_IN_LABEL = anchor('affixfield-unit-in-label')
const NUMBER = anchor('affixfield-number')
const DESCRIBEDBY = anchor('affixfield-describedby')
const SIZED = anchor('affixfield-sized')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(AF).scrollIntoViewIfNeeded()
  await page.locator(`${AF}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

// ── End-state: ids + describedby ───────────────────────────────────────────────

test('root carries the data-has-prefix / data-has-suffix presence attributes', async ({ page }) => {
  // Part of the end-state contract — the CSS padding gates key on them.
  await expect(page.locator(AF)).toHaveAttribute('data-has-prefix', 'true')
  await expect(page.locator(AF)).toHaveAttribute('data-has-suffix', 'true')
})

test('JS gap-fills the presence attributes on the bare variant', async ({ page }) => {
  // The bare variant authors neither attribute — after init they must exist.
  await page.locator(`${BARE}[data-initialized="true"]`).waitFor()
  await expect(page.locator(BARE)).toHaveAttribute('data-has-prefix', 'true')
  await expect(page.locator(BARE)).toHaveAttribute('data-has-suffix', 'true')
})

test('a side without an affix gets no presence attribute', async ({ page }) => {
  // unit-in-label has only a suffix.
  await page.locator(`${UNIT_IN_LABEL}[data-initialized="true"]`).waitFor()
  await expect(page.locator(UNIT_IN_LABEL)).toHaveAttribute('data-has-suffix', 'true')
  expect(await page.locator(UNIT_IN_LABEL).getAttribute('data-has-prefix')).toBeNull()
})

test('affixes carry ids derived from the input id', async ({ page }) => {
  await expect(page.locator(`${AF} .AffixField-prefix`)).toHaveAttribute('id', 'af-live-prefix')
  await expect(page.locator(`${AF} .AffixField-suffix`)).toHaveAttribute('id', 'af-live-suffix')
})

test('input aria-describedby references prefix then suffix', async ({ page }) => {
  await expect(page.locator(`${AF} .AffixField-input`)).toHaveAttribute(
    'aria-describedby',
    'af-live-prefix af-live-suffix',
  )
})

test('affix ids append AFTER an existing hint id (describedby merge)', async ({ page }) => {
  await page.locator(`${DESCRIBEDBY}[data-initialized="true"]`).waitFor()
  await expect(page.locator(`${DESCRIBEDBY} .AffixField-input`)).toHaveAttribute(
    'aria-describedby',
    'af-variant-describedby-hint af-variant-describedby-suffix',
  )
})

test('an aria-hidden affix is skipped entirely — no id, no reference', async ({ page }) => {
  await page.locator(`${UNIT_IN_LABEL}[data-initialized="true"]`).waitFor()
  const suffix = page.locator(`${UNIT_IN_LABEL} .AffixField-suffix`)
  await expect(suffix).toHaveAttribute('aria-hidden', 'true')
  expect(await suffix.getAttribute('id')).toBeNull()
  expect(await page.locator(`${UNIT_IN_LABEL} .AffixField-input`).getAttribute('aria-describedby')).toBeNull()
})

// ── End-state: character-count custom properties ───────────────────────────────

test('root carries --af-prefix-chars / --af-suffix-chars (the affix string lengths)', async ({ page }) => {
  // Counts are content facts — the reference JS and a zero-JS server compute
  // the same numbers ("$".length, "USD".length), so exact values are the contract.
  const counts = await page.locator(AF).evaluate((root) => ({
    prefix: root.style.getPropertyValue('--af-prefix-chars'),
    suffix: root.style.getPropertyValue('--af-suffix-chars'),
  }))
  expect(counts.prefix).toBe('1') // "$"
  expect(counts.suffix).toBe('3') // "USD"
})

// ── Geometry: affix and value text never overlap ────────────────────────────────
// The functional proof of the character-unit model in a real browser: if the
// default --af-ch-unit calibration were wrong for the reference font, the
// reserved padding would fall short of the rendered affix and this would fail.

test('input value area clears both affixes (bounding boxes)', async ({ page }) => {
  // Fill a value so the geometry claim is about real text, not an empty field.
  await page.locator(`${AF} .AffixField-input`).fill('100')
  const geo = await page.locator(AF).evaluate((root) => {
    const input = root.querySelector('.AffixField-input')
    const cs = getComputedStyle(input)
    const box = input.getBoundingClientRect()
    return {
      // The value text renders inside the input's content box.
      contentStart: box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      contentEnd: box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
      prefixEnd: root.querySelector('.AffixField-prefix').getBoundingClientRect().right,
      suffixStart: root.querySelector('.AffixField-suffix').getBoundingClientRect().left,
    }
  })
  expect(geo.prefixEnd).toBeLessThanOrEqual(geo.contentStart + 0.5)
  expect(geo.suffixStart).toBeGreaterThanOrEqual(geo.contentEnd - 0.5)
})

// ── Number variant: hidden spinner ──────────────────────────────────────────────

test('number input spinner is hidden (it would collide with the suffix)', async ({ page }) => {
  // The spin buttons are UA-internal shadow parts, so getComputedStyle with a
  // ::-webkit-*-spin-button argument silently returns the element's own style —
  // it cannot observe them. The observable end-state is the input's computed
  // appearance: 'textfield' (or 'none') removes the spinner; the native
  // reference stays 'auto' and shows it.
  const custom = await page.locator(`${NUMBER} .AffixField-input`).evaluate(
    (input) => getComputedStyle(input).appearance,
  )
  const native = await page.locator('#af-native-number').evaluate(
    (input) => getComputedStyle(input).appearance,
  )
  expect(['textfield', 'none']).toContain(custom)
  expect(native).toBe('auto')
})

test('arrow-key stepping still works despite the hidden spinner', async ({ page }) => {
  const input = page.locator(`${NUMBER} .AffixField-input`)
  await input.focus()
  await input.press('ArrowUp')
  await expect(input).toHaveValue('101')
})

// ── Overlay: the whole surface is the input's hit target ───────────────────────

test('clicking an affix focuses the input (pointer-events pass-through)', async ({ page }) => {
  // The affix has pointer-events: none, so click raw coordinates at its center —
  // the input underneath must receive the click.
  const box = await page.locator(`${AF} .AffixField-suffix`).boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator(`${AF} .AffixField-input`)).toBeFocused()
})

// ── Fully-authored variant: JS verifiably touches nothing ──────────────────────

test('the fully-authored variant is untouched — computed attributes strictly equal authored ones', async ({ page }) => {
  await page.locator(`${AUTHORED}[data-initialized="true"]`).waitFor()
  const root = page.locator(AUTHORED)
  // The style attribute is byte-identical to what the generator authored: any
  // JS write would re-serialize it (spacing/semicolon normalization).
  await expect(root).toHaveAttribute('style', '--af-prefix-chars: 1; --af-suffix-chars: 3')
  // Presence attributes are authored (server end-state), values untouched.
  await expect(root).toHaveAttribute('data-has-prefix', 'true')
  await expect(root).toHaveAttribute('data-has-suffix', 'true')
  await expect(root.locator('.AffixField-prefix')).toHaveAttribute('id', 'af-variant-authored-prefix')
  await expect(root.locator('.AffixField-suffix')).toHaveAttribute('id', 'af-variant-authored-suffix')
  await expect(root.locator('.AffixField-input')).toHaveAttribute(
    'aria-describedby',
    'af-variant-authored-prefix af-variant-authored-suffix',
  )
})

// ── Sized variant ───────────────────────────────────────────────────────────────

test('data-input-characters sets --af-input-chars and imposes a compact width', async ({ page }) => {
  await page.locator(`${SIZED}[data-initialized="true"]`).waitFor()
  const state = await page.locator(SIZED).evaluate((root) => ({
    chars: root.style.getPropertyValue('--af-input-chars'),
    rootWidth: root.getBoundingClientRect().width,
    align: getComputedStyle(root.querySelector('.AffixField-input')).textAlign,
  }))
  expect(state.chars).toBe('4')
  // 4ch value area + suffix + gaps + paddings — far below the input's natural width.
  expect(state.rootWidth).toBeLessThan(180)
  expect(['end', 'right']).toContain(state.align) // data-align="end"
})

// ── axe accessibility ───────────────────────────────────────────────────────────

test('passes axe on the closed live component', async ({ page }) => {
  await scopedCheckA11y(page, AF, { detailedReport: false })
})

test('all kitchensink states pass axe', async ({ page }) => {
  // Scope to the AffixField section only (the section wrapping the live demo).
  await checkA11y(page, '.kitchensink-section:has([data-id="affixfield-live"])', {
    detailedReport: true,
    axeOptions: {
      rules: {
        // WCAG 1.4.3 exempts disabled UI components from contrast requirements.
        // The disabled states render at opacity 0.5 by design; axe cannot see
        // the exemption for the non-form-control affix spans.
        'color-contrast': { enabled: false },
      },
    },
  })
})

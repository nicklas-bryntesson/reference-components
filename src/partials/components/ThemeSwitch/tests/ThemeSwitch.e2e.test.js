import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'

// ThemeSwitch is the first component that mutates GLOBAL page state, so every
// test starts from a known root: no stored preference, no attribute. Playwright
// gives each test a fresh context, but stating it makes the suite order-independent
// if that ever changes.
//
// The decisions live in the kernel and are unit-tested there. What this suite
// proves is the part only a browser can: that the resolved appearance actually
// reaches system colours, that `system` projects nothing, and that an explicit
// choice survives both a reload and a contradicting OS.

const TS = '.ThemeSwitch[data-component="ThemeSwitch"]'
const STORAGE_KEY = 'appearance-preference'

/** Resolve a computed colour to numeric [r,g,b] — immune to colour syntax. */
const colorOf = (page, selector, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s)
    if (!el) return null
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.fillStyle = getComputedStyle(el)[p]
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  }, [selector, prop])

const luminance = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** What `Canvas` resolves to right now — the proof the appearance reached the platform. */
const canvasLuminance = async (page) => luminance(await page.evaluate(() => {
  const el = document.createElement('span')
  el.style.backgroundColor = 'Canvas'
  document.body.append(el)
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.fillStyle = getComputedStyle(el).backgroundColor
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  el.remove()
  return [r, g, b]
}))

const appearanceAttr = (page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-appearance'))

/**
 * Freeze transitions.
 *
 * GOTCHA (this bit twice now, here and in the appearance suite): the segment
 * carries `transition: color 200ms`, so reading a computed colour immediately
 * after selecting samples a value MID-TRANSITION — the selected segment measured
 * rgb(12,12,12) on its way from black to white, which reads as "the wrong colour"
 * rather than "too early". We assert settled values, so remove the motion rather
 * than sleep and hope. It also makes the indicator's position assertions exact.
 */
const freezeTransitions = (page) => page.addStyleTag({
  content: `*, *::before, *::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }`,
})

// Each test gets a fresh context, so localStorage starts empty — deliberately NOT
// cleared with addInitScript, which would also run on the reload inside the
// persistence test and wipe the very value under test.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await freezeTransitions(page)
  await page.locator(TS).scrollIntoViewIfNeeded()
})

// ── The projection contract ───────────────────────────────────────────────────

test('system projects no attribute at all', async ({ page }) => {
  await expect(page.locator(`${TS} input[value="system"]`)).toBeChecked()
  expect(await appearanceAttr(page), 'absence IS the system state').toBeNull()
})

test('an explicit choice projects, and reaches system colours', async ({ page }) => {
  await page.locator(`${TS} label[for="ts-dark"]`).click()
  expect(await appearanceAttr(page)).toBe('dark')
  expect(await canvasLuminance(page), 'Canvas must actually resolve dark').toBeLessThan(0.1)

  await page.locator(`${TS} label[for="ts-light"]`).click()
  expect(await appearanceAttr(page)).toBe('light')
  expect(await canvasLuminance(page)).toBeGreaterThan(0.8)
})

test('returning to system removes the attribute rather than writing "system"', async ({ page }) => {
  await page.locator(`${TS} label[for="ts-dark"]`).click()
  expect(await appearanceAttr(page)).toBe('dark')
  await page.locator(`${TS} label[for="ts-system"]`).click()
  expect(await appearanceAttr(page)).toBeNull()
})

// ── Persistence and the headline rule ─────────────────────────────────────────

test('a choice survives a reload, with the matching segment re-checked', async ({ page }) => {
  await page.locator(`${TS} label[for="ts-dark"]`).click()
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe('dark')

  await page.reload()
  await freezeTransitions(page)
  await page.locator(TS).scrollIntoViewIfNeeded()
  expect(await appearanceAttr(page)).toBe('dark')
  await expect(page.locator(`${TS} input[value="dark"]`)).toBeChecked()
})

test('an explicit choice is NOT revoked when the OS signal flips', async ({ page }) => {
  // The contract, and the rule the kernel exists to hold: a platform signal never
  // overrides an active user decision.
  await page.emulateMedia({ colorScheme: 'light' })
  await page.locator(`${TS} label[for="ts-light"]`).click()
  expect(await appearanceAttr(page)).toBe('light')

  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await appearanceAttr(page), 'the OS moved; the choice must not').toBe('light')
  expect(await canvasLuminance(page), 'and it must hold all the way to Canvas').toBeGreaterThan(0.8)
})

test('under system, the OS signal is what decides — with no attribute written', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await appearanceAttr(page), 'still no attribute').toBeNull()
  expect(await canvasLuminance(page)).toBeLessThan(0.1)

  await page.emulateMedia({ colorScheme: 'light' })
  expect(await canvasLuminance(page)).toBeGreaterThan(0.8)
})

test('theme-change carries the resolved detail', async ({ page }) => {
  const detail = page.evaluate(() => new Promise((resolve) => {
    document.querySelector('.ThemeSwitch[data-component="ThemeSwitch"]')
      .addEventListener('theme-change', (e) => resolve(e.detail), { once: true })
  }))
  await page.locator(`${TS} label[for="ts-dark"]`).click()
  expect(await detail).toEqual({ preference: 'dark', appearance: 'dark' })
})

// ── The sliding indicator ─────────────────────────────────────────────────────

test('the indicator lands on the selected segment', async ({ page }) => {
  // Proves the sibling chain: `input:nth-of-type(N):checked ~ .indicator` can only
  // reach the indicator because the inputs have no wrapper.
  for (const value of ['system', 'light', 'dark']) {
    await page.locator(`${TS} label[for="ts-${value}"]`).click()
    const segment = await page.locator(`${TS} label[for="ts-${value}"]`).boundingBox()
    const indicator = await page.locator(`${TS} .indicator`).boundingBox()
    expect(Math.abs(indicator.x - segment.x), `${value}: indicator off by ${indicator.x - segment.x}px`).toBeLessThan(1.5)
    expect(Math.abs(indicator.width - segment.width)).toBeLessThan(1.5)
  }
})

test('segments meet the family field-height contract', async ({ page }) => {
  const box = await page.locator(`${TS} label[for="ts-system"]`).boundingBox()
  expect(box.height).toBe(40)
  expect(box.width).toBe(40)
})

// ── Native semantics and focus ────────────────────────────────────────────────

test('the legend names the group even though it is clipped', async ({ page }) => {
  await expect(page.getByRole('group', { name: 'Colour theme' }).first()).toHaveCount(1)
})

test('each segment is a radio with an accessible name from its clipped text', async ({ page }) => {
  // Scoped to the live instance: the same three names also appear in the inert
  // state rows, so a page-wide role query would legitimately match six.
  const group = page.locator(TS)
  await expect(group.getByRole('radio', { name: 'Follow system setting' })).toHaveCount(1)
  await expect(group.getByRole('radio', { name: 'Light' })).toHaveCount(1)
  await expect(group.getByRole('radio', { name: 'Dark' })).toHaveCount(1)
})

test('arrow keys rove and select, as native radios do', async ({ page }) => {
  await page.locator(`${TS} input[value="system"]`).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(`${TS} input[value="light"]`)).toBeChecked()
  expect(await appearanceAttr(page)).toBe('light')
})

test('the focus ring on the selected segment has real contrast', async ({ page }) => {
  // The Picklist lesson: assert contrast, never `outlineStyle !== 'none'`. The
  // selected segment sits on the indicator's fill and flips `color`, which is
  // exactly the case an outward ring gets wrong.
  await page.locator(`${TS} input[value="system"]`).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  const sel = `${TS} label[for="ts-system"]`
  const info = await page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el)
    return { style: cs.outlineStyle, offset: parseFloat(cs.outlineOffset) }
  })
  expect(info.style).not.toBe('none')
  expect(info.offset, 'the ring must be inset so it lands on the fill beneath it').toBeLessThan(0)

  const ring = await colorOf(page, sel, 'outlineColor')
  const beneath = await colorOf(page, `${TS} .indicator`, 'backgroundColor')
  const [a, b] = [luminance(ring), luminance(beneath)].sort((x, y) => y - x)
  const ratio = (a + 0.05) / (b + 0.05)
  expect(ratio, `ring on the indicator is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
})

// ── The inert copies must stay inert ─────────────────────────────────────────

test('the state rows never project — only the live demo is attached', async ({ page }) => {
  await page.locator('.ThemeSwitch[data-id="state-default"]').scrollIntoViewIfNeeded()
  await page.locator('.ThemeSwitch[data-id="state-default"] label[for="ts-sd-3"]').click()
  expect(await appearanceAttr(page), 'an inert copy must not re-theme the page').toBeNull()
})

// ── Accessibility in both appearances ────────────────────────────────────────

test('axe is clean in light and in dark', async ({ page }) => {
  await injectAxe(page)
  await page.locator(`${TS} label[for="ts-light"]`).click()
  await checkA11y(page, '#ThemeSwitch')
  await page.locator(`${TS} label[for="ts-dark"]`).click()
  await checkA11y(page, '#ThemeSwitch')
})

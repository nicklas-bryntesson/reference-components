import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import { targetPath } from '../src/e2e-helpers/target.js'

// The appearance seam (ADR-0021). This is the first suite in the repo that
// asserts COMPUTED COLOUR rather than DOM structure, and it exists because a
// green suite has repeatedly hidden visual defects here: a broken var reference
// falls back to `initial` and nothing fails, and a token that never gained a
// dark half simply stays light while everything around it flips.
//
// It is a site-level suite, not a component one: the seam is one platform
// declaration plus a token layer, and its whole point is that components need no
// changes to follow it.

/** Read a computed property, resolved (custom properties are text until used). */
const computed = (page, selector, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el)[p] : null
  }, [selector, prop])

/**
 * Read a computed colour as numeric [r, g, b], normalised by the browser.
 *
 * GOTCHA (this bit while writing the suite): computed colours are NOT all
 * `rgb()`. `color-mix()` resolves to `color(srgb 0.96 0.96 0.96)` — components
 * in 0–1, not 0–255 — so a naive "grab the first three numbers and divide by
 * 255" parser read #f5f5f5 as near-black and reported black-on-white as 1.01:1.
 * Painting the value onto a canvas and reading the pixel back makes this immune
 * to colour syntax, including future oklch()/lab() values.
 */
const colorOf = (page, selector, prop) =>
  page.evaluate(([s, p]) => {
    const el = document.querySelector(s)
    if (!el) return null
    const value = getComputedStyle(el)[p]
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  }, [selector, prop])

/** Set or clear the appearance override on the root. */
const setAppearance = async (page, value) => {
  await page.evaluate((v) => {
    if (v === null) document.documentElement.removeAttribute('data-appearance')
    else document.documentElement.setAttribute('data-appearance', v)
  }, value)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/**
 * Transitions are disabled for this suite.
 *
 * GOTCHA (this bit while writing the suite): chips carry
 * `transition: background-color 120ms`, so reading a computed colour two frames
 * after flipping the appearance samples a value *mid-transition* — a selected
 * chip measured rgb(242,242,242) on its way to rgb(255,255,255), which then read
 * as "the wrong colour" rather than "too early". We assert settled values, so
 * the honest fix is to remove the motion rather than sleep and hope.
 */
const freezeTransitions = (page) => page.addStyleTag({
  content: `*, *::before, *::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }`,
})

/** WCAG relative luminance from numeric [r, g, b] (0–255). */
const luminance = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const rgbText = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await freezeTransitions(page)
  await setAppearance(page, null)
})

// ── The projection contract ───────────────────────────────────────────────────

test('the root declares color-scheme, and an absent attribute means "follow the OS"', async ({ page }) => {
  expect(await computed(page, ':root', 'colorScheme')).toBe('light dark')
})

test('an explicit appearance pins color-scheme in both directions', async ({ page }) => {
  await setAppearance(page, 'light')
  expect(await computed(page, ':root', 'colorScheme')).toBe('light')
  await setAppearance(page, 'dark')
  expect(await computed(page, ':root', 'colorScheme')).toBe('dark')
})

// ── The flip actually reaches components ──────────────────────────────────────
//
// The seam is worthless if it stops at :root. These assert on real component
// internals — the ones that only read system colours and were never touched.

test('system colours reach component internals, and invert where the component inverts', async ({ page }) => {
  await page.locator('.Picklist[data-id="single"]').scrollIntoViewIfNeeded()

  await setAppearance(page, 'light')
  const lightUnselected = await colorOf(page, '.Picklist[data-id="single"] label[for="pl-s-2"]', 'backgroundColor')
  const lightSelected = await colorOf(page, '.Picklist[data-id="single"] label[for="pl-s-1"]', 'backgroundColor')

  await setAppearance(page, 'dark')
  const darkUnselected = await colorOf(page, '.Picklist[data-id="single"] label[for="pl-s-2"]', 'backgroundColor')
  const darkSelected = await colorOf(page, '.Picklist[data-id="single"] label[for="pl-s-1"]', 'backgroundColor')

  // An unselected chip is Canvas: light in light mode, dark in dark mode.
  expect(luminance(lightUnselected)).toBeGreaterThan(0.8)
  expect(luminance(darkUnselected)).toBeLessThan(0.1)

  // A selected chip is CanvasText — the inverse — in both modes. This is the
  // property that makes the whole library work with no per-component changes.
  expect(luminance(lightSelected)).toBeLessThan(0.1)
  expect(luminance(darkSelected)).toBeGreaterThan(0.8)
})

test('the page scaffolding flips with the components, not after them', async ({ page }) => {
  // Measured failure this guards: with components flipping and the page not,
  // unselected chips render dark on a light page (reading as SELECTED) and
  // selected chips go white on white. Half-done is worse than not started.
  await setAppearance(page, 'dark')
  const body = await colorOf(page, 'body', 'backgroundColor')
  const chip = await colorOf(page, '.Picklist[data-id="single"] label[for="pl-s-2"]', 'backgroundColor')
  expect(luminance(body), 'the page must be dark when the components are').toBeLessThan(0.2)
  expect(Math.abs(luminance(body) - luminance(chip)), 'page and chip must share a ground').toBeLessThan(0.2)
})

// ── Accent tokens have a dark half ────────────────────────────────────────────

test('every accent token resolves to a different value in dark than in light', async ({ page }) => {
  // A token that never gained a light-dark() pair stays light while everything
  // around it flips — invisible to any structural test.
  const probes = [
    ['--ui-primary', 'color'],
    ['--ui-muted-foreground', 'color'],
    ['--ui-destructive', 'color'],
    ['--ui-warning', 'color'],
    ['--ui-success', 'color'],
    ['--ui-info', 'color'],
    ['--ui-primary-foreground', 'color'],
  ]
  const read = () => page.evaluate((list) => {
    const el = document.createElement('span')
    document.body.append(el)
    const out = {}
    for (const [token] of list) {
      el.style.color = `var(${token})`
      out[token] = getComputedStyle(el).color
    }
    el.remove()
    return out
  }, probes)

  await setAppearance(page, 'light')
  const light = await read()
  await setAppearance(page, 'dark')
  const dark = await read()

  for (const [token] of probes) {
    expect(light[token], `${token} did not resolve at all`).toBeTruthy()
    expect(dark[token], `${token} has no dark half — it stays ${light[token]}`).not.toBe(light[token])
  }
})

test('the shadow ink is heavier in dark, where a light shadow is invisible', async ({ page }) => {
  const read = () => page.evaluate(() => {
    const el = document.createElement('span')
    el.style.boxShadow = 'var(--ui-shadow)'
    document.body.append(el)
    const v = getComputedStyle(el).boxShadow
    el.remove()
    return v
  })
  await setAppearance(page, 'light')
  const light = await read()
  await setAppearance(page, 'dark')
  const dark = await read()
  expect(light).toBeTruthy()
  expect(dark, 'the shadow must not be identical in both appearances').not.toBe(light)
})

// ── Accessibility in both appearances ─────────────────────────────────────────

test('axe is clean in dark, not only in light', async ({ page }) => {
  await setAppearance(page, 'dark')
  await injectAxe(page)
  await checkA11y(page, '#Picklist')
})

test('body text keeps contrast against the page in both appearances', async ({ page }) => {
  for (const appearance of ['light', 'dark']) {
    await setAppearance(page, appearance)
    const fg = await colorOf(page, 'body', 'color')
    const bg = await colorOf(page, 'body', 'backgroundColor')
    const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
    const ratio = (a + 0.05) / (b + 0.05)
    expect(ratio, `${appearance}: ${rgbText(fg)} on ${rgbText(bg)} is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  }
})

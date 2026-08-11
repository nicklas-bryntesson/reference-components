// src/partials/components/MotionRegion/tests/MotionRegion.e2e.test.js
//
// Proves the wiring the unit tests can't reach in jsdom: real browser signals
// reach the motion-policy kernel and the DOM reflects the result. Assertions key
// on data-motion (ADR-0002) and the CSS backend's computed animation-play-state —
// the whole pipeline (signals → kernel → data-motion → CSS gate) end to end.
import { test, expect } from '@playwright/test'
import { injectAxe } from 'axe-playwright'
import { targetPath, targetId, scopedCheckA11y } from '../../../../e2e-helpers/target.js'

const MR = targetId('MotionRegion')

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator(MR).scrollIntoViewIfNeeded()
  await page.locator(`${MR}[data-initialized="true"]`).waitFor()
  await injectAxe(page)
})

test('autostarts under a clean policy and the CSS backend runs', async ({ page }) => {
  const region = page.locator(MR)
  await expect(region).toHaveAttribute('data-motion', 'running')
  await expect(region.locator('.demo-animation')).toHaveCSS('animation-play-state', 'running')
})

test('injects an accessible pause control (WCAG 2.2.2)', async ({ page }) => {
  const control = page.locator(`${MR} .control`)
  await expect(control).toBeVisible()
  await expect(control).toHaveAttribute('aria-label', /pause/i)
})

test('the control pauses motion and the CSS gate stops the animation', async ({ page }) => {
  const region = page.locator(MR)
  await region.locator('.control').click()
  await expect(region).toHaveAttribute('data-motion', 'paused')
  await expect(region.locator('.demo-animation')).toHaveCSS('animation-play-state', 'paused')
  await expect(region.locator('.control')).toHaveAttribute('aria-label', /play/i)
})

test('passes an axe audit', async ({ page }) => {
  await scopedCheckA11y(page, MR)
})

// Reduced-motion is emulated explicitly (page.emulateMedia) then the page is
// reloaded so the component initializes with the preference active — the
// test.use({ reducedMotion }) context option does not reflect into matchMedia in
// this Chromium build, but emulateMedia does.
test('does not autostart under reduced motion; the CSS animation stays paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const region = page.locator(MR)
  await region.scrollIntoViewIfNeeded()
  await page.locator(`${MR}[data-initialized="true"]`).waitFor()
  await expect(region).toHaveAttribute('data-motion', 'paused')
  await expect(region.locator('.demo-animation')).toHaveCSS('animation-play-state', 'paused')
})

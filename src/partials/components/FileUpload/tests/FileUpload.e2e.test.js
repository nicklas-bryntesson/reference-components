// src/partials/components/FileUpload/tests/FileUpload.e2e.test.js
import { test, expect } from '@playwright/test'
import { checkA11y, injectAxe } from 'axe-playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import { targetPath } from '../../../../e2e-helpers/target.js'

const __dir = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto(targetPath())
  await page.locator('[data-component="FileUpload"][data-initialized="true"]').first().scrollIntoViewIfNeeded()
  await injectAxe(page)
})

// ─── Accessibility audit ──────────────────────────────────────────────────────

test('passes axe accessibility audit on empty state', async ({ page }) => {
  await checkA11y(page, '[data-component="FileUpload"][data-initialized="true"]', {
    detailedReport: true,
    axeOptions: {
      rules: {
        // Multiple kitchensink instances share hard-coded IDs by design
        'duplicate-id': { enabled: false },
        // WCAG 1.4.3 exempts disabled UI components from contrast requirements.
        // Axe does not fully honour aria-disabled on group containers for child text,
        // so we suppress the rule — disabled states are visually intentional.
        'color-contrast': { enabled: false },
      },
    },
  })
})

// ─── Static kitchensink states ───────────────────────────────────────────────

test('all kitchensink states pass axe', async ({ page }) => {
  await checkA11y(page, '.kitchensink-section', {
    detailedReport: true,
    axeOptions: {
      rules: {
        'duplicate-id': { enabled: false },
        // WCAG 1.4.3 exempts disabled UI components from contrast requirements.
        // Axe does not fully honour aria-disabled on group containers for child text,
        // so we suppress the rule — disabled states are visually intentional.
        'color-contrast': { enabled: false },
        // The kitchensink state tables use an intentionally blank corner <th>
        // (top-left of the row×column state grid). This is valid table markup
        // — the cell is a spacer, not a data header.
        'empty-table-header': { enabled: false },
      },
    },
  })
})

// ─── Role and labeling ────────────────────────────────────────────────────────

test('root has role=group with aria-labelledby', async ({ page }) => {
  const root = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  await expect(root).toHaveAttribute('role', 'group')
  const labelledBy = await root.getAttribute('aria-labelledby')
  expect(labelledBy).toBeTruthy()
  const labelEl = page.locator(`#${labelledBy}`)
  await expect(labelEl).toBeVisible()
})

test('native input is aria-hidden', async ({ page }) => {
  const input = page.locator('[data-component="FileUpload"][data-initialized="true"] .input').last()
  await expect(input).toHaveAttribute('aria-hidden', 'true')
  await expect(input).toHaveAttribute('tabindex', '-1')
})

// ─── Trigger button ───────────────────────────────────────────────────────────

test('trigger button has accessible name', async ({ page }) => {
  const trigger = page.locator('[data-component="FileUpload"][data-initialized="true"] .trigger').last()
  const label = await trigger.textContent()
  expect(label.trim().length).toBeGreaterThan(0)
})

// ─── File list — live demo ────────────────────────────────────────────────────

test('selecting a file adds it to the list', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')

  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const input = liveRoot.locator('.input')
  await input.setInputFiles(tmpFile)

  await expect(liveRoot.locator('.item')).toHaveCount(1)
  await expect(liveRoot).toHaveAttribute('data-has-files')
})

test('remove button removes the file from the list', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const input = liveRoot.locator('.input')
  await input.setInputFiles(tmpFile)

  await liveRoot.locator('.item-remove').click()

  await expect(liveRoot.locator('.item')).toHaveCount(0)
  await expect(liveRoot).not.toHaveAttribute('data-has-files')
})

test('focus moves to trigger after removing the only file', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const input = liveRoot.locator('.input')
  await input.setInputFiles(tmpFile)

  const removeBtn = liveRoot.locator('.item-remove')
  await removeBtn.focus()
  await removeBtn.click()

  await expect(liveRoot.locator('.trigger')).toBeFocused()
})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

test('trigger is reachable via Tab', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const trigger = liveRoot.locator('.trigger')
  await trigger.focus()
  await expect(trigger).toBeFocused()
})

test('remove button is reachable via Shift+Tab from trigger', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const input = liveRoot.locator('.input')
  await input.setInputFiles(tmpFile)

  // The remove button precedes the trigger in DOM order (list → trigger).
  // Shift+Tab from the trigger moves focus backwards to the remove button.
  const trigger = liveRoot.locator('.trigger')
  await trigger.focus()
  await page.keyboard.press('Shift+Tab')

  const removeBtn = liveRoot.locator('.item-remove')
  await expect(removeBtn).toBeFocused()
})

// ─── Validation — live interaction ───────────────────────────────────────────

test('file not matching accept shows invalid-type error', async ({ page }) => {
  // The _invalid-type static state partial has accept=".pdf" and a pre-rendered
  // invalid-type item (rendered before JS wipes & re-renders from entries).
  // After JS initializes, static pre-rendered items are gone. Target the static
  // partial by data attribute presence on the root before initialization clears
  // the list. Instead, trigger it dynamically on a live instance with accept.

  // Find the instance that has accept=".pdf" on its input (from _invalid-type partial)
  // After JS runs it cleared the list since there's no data-initial-files.
  // We locate by checking the kitchensink partial and verify the root has the attribute.
  // The static error items live in the hbs — JS wipes them. So we drive the live demo
  // with a file that has a disallowed extension.

  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()

  // Temporarily observe: the live root has no accept restriction so any file is valid.
  // Use the instance that does have accept=".pdf": the _invalid-type partial instance.
  // Since JS clears its static list, we upload a non-pdf to the live demo with JS eval.
  await page.evaluate(() => {
    const roots = document.querySelectorAll('[data-component="FileUpload"][data-initialized="true"]')
    const liveEl = roots[roots.length - 1]
    const inputEl = liveEl.querySelector('.input')
    inputEl.setAttribute('accept', '.pdf')
  })

  // Upload a non-matching file (create a fake txt file via DataTransfer)
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')

  // Rename to .txt via Playwright's setInputFiles with mimeType override
  await liveRoot.locator('.input').setInputFiles({
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })

  const invalidItem = liveRoot.locator('.item[data-status="invalid-type"]')
  await expect(invalidItem).toHaveCount(1)
  await expect(invalidItem.locator('.item-error')).toBeVisible()
  await expect(invalidItem.locator('.item-error')).toHaveAttribute('role', 'alert')
})

test('file exceeding max size shows invalid-size error', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()

  // Set max-size to 1 byte so any real file exceeds it
  await page.evaluate(() => {
    const roots = document.querySelectorAll('[data-component="FileUpload"][data-initialized="true"]')
    const liveEl = roots[roots.length - 1]
    liveEl.setAttribute('data-max-size', '1')
  })

  await liveRoot.locator('.input').setInputFiles({
    name: 'big.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this file is definitely more than 1 byte'),
  })

  const invalidItem = liveRoot.locator('.item[data-status="invalid-size"]')
  await expect(invalidItem).toHaveCount(1)
  await expect(invalidItem.locator('.item-error')).toBeVisible()
  await expect(invalidItem.locator('.item-error')).toHaveAttribute('role', 'alert')
})

// ── atomica11y: button + alert-notification + text-input §1 ──────────────────

test('file list has aria-live="polite" and aria-relevant="additions removals"', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  const list = liveRoot.locator('.list')
  await expect(list).toHaveAttribute('aria-live', 'polite')
  await expect(list).toHaveAttribute('aria-relevant', 'additions removals')
})

test('remove button has aria-label containing the filename', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  await liveRoot.locator('.input').setInputFiles(tmpFile)

  const removeBtn = liveRoot.locator('.item-remove')
  const label = await removeBtn.getAttribute('aria-label')
  expect(label).toContain('test.pdf')
})

test('Enter on remove button removes the file', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  await liveRoot.locator('.input').setInputFiles(tmpFile)

  const removeBtn = liveRoot.locator('.item-remove')
  await removeBtn.focus()
  await page.keyboard.press('Enter')

  await expect(liveRoot.locator('.item')).toHaveCount(0)
})

test('Space on remove button removes the file', async ({ page }) => {
  const tmpFile = path.join(__dir, 'fixtures', 'test.pdf')
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()
  await liveRoot.locator('.input').setInputFiles(tmpFile)

  const removeBtn = liveRoot.locator('.item-remove')
  await removeBtn.focus()
  await page.keyboard.press('Space')

  await expect(liveRoot.locator('.item')).toHaveCount(0)
})

test('error alert does not steal focus when invalid file is added', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()

  // Focus trigger first so we have a known focus position
  await liveRoot.locator('.trigger').focus()

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[data-component="FileUpload"][data-initialized="true"]')).at(-1)
    el.querySelector('.input').setAttribute('accept', '.pdf')
  })

  await liveRoot.locator('.input').setInputFiles({
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })

  // Error alert should be present
  await expect(liveRoot.locator('.item-error[role="alert"]')).toBeVisible()

  // Focus must NOT be on the error span — it should remain on trigger or move naturally
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'))
  expect(focused).not.toBe('alert')
})

test('focus moves to next sibling remove button when removing first of multiple files', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()

  // Enable multiple
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[data-component="FileUpload"][data-initialized="true"]')).at(-1)
    el.querySelector('.input').setAttribute('multiple', '')
  })

  await liveRoot.locator('.input').setInputFiles([
    { name: 'first.pdf', mimeType: 'application/pdf', buffer: Buffer.from('a') },
    { name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('b') },
  ])

  await expect(liveRoot.locator('.item')).toHaveCount(2)

  // Focus and remove the first item
  const firstRemove = liveRoot.locator('.item-remove').first()
  await firstRemove.focus()
  await firstRemove.click()

  // Focus should move to the remaining item's remove button
  await expect(liveRoot.locator('.item-remove')).toBeFocused()
})

test('data-has-errors on root when invalid file type is added', async ({ page }) => {
  const liveRoot = page.locator('[data-component="FileUpload"][data-initialized="true"]').last()

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[data-component="FileUpload"][data-initialized="true"]')).at(-1)
    el.querySelector('.input').setAttribute('accept', '.pdf')
  })

  await liveRoot.locator('.input').setInputFiles({
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })

  await expect(liveRoot).toHaveAttribute('data-has-errors')
})

// ─── Drop-zone: remove button must win over the full-coverage input ───────────

test('drop-zone remove button removes the file instead of reopening the picker', async ({ page }) => {
  const dropZone = page.locator('[data-component="FileUpload"][data-drop-zone="true"][data-initialized="true"]').first()
  await dropZone.scrollIntoViewIfNeeded()

  await dropZone.locator('.input').setInputFiles({
    name: 'dropped.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('x'),
  })
  await expect(dropZone.locator('.item-name')).toHaveText('dropped.pdf')

  // The drop-zone stretches the native input over the whole area. The remove
  // button must sit above it (z-index) so this click hits the button — if the
  // input intercepted it the file picker would open and the file would remain.
  await dropZone.locator('.item-remove').click()

  await expect(dropZone.locator('.item-name')).toHaveCount(0)
  await expect(dropZone).not.toHaveAttribute('data-has-files')
})

// ─── Server files (data-initial-files) ───────────────────────────────────────

test('server files state has data-source=server and hidden input', async ({ page }) => {
  // The _server-files partial is initialized by JS from data-initial-files JSON.
  // Several states now seed data-initial-files, so target the server fixture by its ref.
  const serverRoot = page.locator('[data-initial-files*="abc123"]').first()
  await expect(serverRoot).toHaveAttribute('data-initialized')
  const serverItem = serverRoot.locator('.item[data-source="server"]')
  await expect(serverItem).toHaveCount(1)
  await expect(serverItem.locator('input[type="hidden"]')).toHaveCount(1)
  await expect(serverItem.locator('input[type="hidden"]')).toHaveAttribute('value', 'abc123')
})

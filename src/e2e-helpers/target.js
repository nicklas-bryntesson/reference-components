// Shared portability seams for the e2e conformance suite.
//
// A consumer running this suite against their own dev server can point it at
// their own demo page and (where a suite routes through a single root selector)
// their own component instance, via env vars — no need to edit test source:
//
//   TARGET_PATH  — page the suite navigates to            (default: '/')
//   TARGET_ID    — component root selector override        (per-component default below)
//   AXE_SETTLE   — wait for opacity to settle before axe   (default: off — see waitForStable)
//
// `scopedCheckA11y` always scopes the axe audit to a selector, so a shared host
// page's unrelated markup can never fail a component's accessibility check.
import { checkA11y } from 'axe-playwright'

export function targetPath() {
  return process.env.TARGET_PATH ?? '/'
}

const DEFAULT_TARGET = {
  DateField: '[data-id="birthdate"]',
  DateTimeField: '[data-component="DateTimeField"][data-id="meeting-time"]',
  TimeField: '[data-component="TimeField"][data-id="meeting-time"]',
  MonthField: '[data-component="MonthField"][data-id="meeting-month"]',
  WeekField: '[data-component="WeekField"][data-id="meeting-week"]',
  FileUpload: '[data-component="FileUpload"][data-initialized]',
  AffixField: '[data-component="AffixField"][data-id="affixfield-live"]',
  MotionRegion: '[data-component="MotionRegion"][data-id="motion-region-live"]',
  ScrollArea: '[data-component="ScrollArea"][data-id="scrollarea-live"]',
}

export function targetId(component) {
  return process.env.TARGET_ID ?? DEFAULT_TARGET[component]
}

// Settle seam for consumers who add an entrance animation.
//
// The reference popups appear at full opacity (no fade), so axe always samples a
// fully-rendered frame and this is a deliberate **no-op by default** — the
// reference suite's behaviour is unchanged. But if your port wraps a popup in an
// opacity fade-in (Vue `<Transition>`, React `<AnimatePresence>`, CSS
// `@starting-style`, …) there is a ~150–180 ms window where all popup text is
// below WCAG AA contrast. Playwright's auto-wait checks bounding-box stability,
// NOT opacity, so a `.click()` can return mid-fade and a scoped axe run samples
// that low-opacity frame → false "color-contrast" violations.
//
// Set `AXE_SETTLE=1` to make every scoped axe check first wait until the scope
// (and everything inside it) has settled to `opacity: 1`. This is honest, not a
// cheat: a settled popup is compliant; only the transient frame is not. Override
// or replace this function in your own copy if your animation needs different
// settle logic.
export async function waitForStable(page, scope) {
  if (!process.env.AXE_SETTLE) return
  await page.waitForFunction((sel) => {
    const root = document.querySelector(sel)
    if (!root) return true
    return [root, ...root.querySelectorAll('*')].every(
      (el) => parseFloat(getComputedStyle(el).opacity) === 1
    )
  }, scope)
}

export async function scopedCheckA11y(page, scope, options = {}) {
  // A scope that matches nothing makes axe audit nothing and report success, so
  // the check passes hardest exactly when the component is absent. Two of
  // ToggleTip's tests were measured passing with the component not on the page at
  // all, and the undocumented per-component section ids (#Picklist, #Notice,
  // #ChoiceField) stayed invisible for the same reason: nothing fails when the
  // selector is wrong. Assert the scope exists before auditing it.
  const count = await page.locator(scope).count()
  if (count === 0) {
    throw new Error(
      `scopedCheckA11y: no element matches ${scope} — axe would have audited nothing and passed.`,
    )
  }
  await waitForStable(page, scope)
  return checkA11y(page, scope, options)
}

/**
 * Assert every standalone control in an open popup is reachable by Tab.
 *
 * The suite already checked that focus stays *inside* an `aria-modal` popup. It
 * never checked *what* was in the cycle, and those are different properties: a
 * component that silently drops a tab stop still contains focus perfectly. So a
 * control could become keyboard-unreachable — the WCAG 2.1.1 failure mode — with
 * the trap tests all green.
 *
 * That gap is measurable. Breaking one class selector at a time in a component's
 * JS, 10 of 44 mutants survived the whole suite, and the tab-stop lookups in
 * `_calendarTabStops` / `_popupTabStops` were the largest cluster: DateField's
 * `.month-year-trigger`, `.calendar-footer-clear` and `.calendar-footer-today`
 * all survived while `.grid`, `.prev-month` and `.next-month` — in the very same
 * function — were caught.
 *
 * "Standalone" excludes composite widgets. A calendar grid and a wheel column are
 * deliberately ONE tab stop with roving tabindex inside, so their 42 day buttons
 * must not each be tabbable. Composite membership is judged strictly inside the
 * popup, because `closest('table')` otherwise walks out of the component
 * entirely and matches the kitchensink's own layout table — which silently
 * classified every footer button as composite and made this check pass while
 * measuring nothing.
 */
export async function expectEveryPopupButtonReachable(page, expect, root) {
  const collect = (sel) => {
    const el = document.querySelector(sel)
    const popup = el?.querySelector('[role="dialog"]')
    if (!popup) return { error: `no [role="dialog"] inside ${sel}` }
    const standalone = [...popup.querySelectorAll('button')].filter((btn) => {
      if (btn.disabled) return false
      const composite = btn.closest('table, [role="grid"], [role="listbox"]')
      if (composite && popup.contains(composite)) return false
      const box = btn.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    standalone.forEach((btn, i) => btn.setAttribute('data-tabprobe', String(i)))
    return { labels: standalone.map((b) => b.className.split(' ')[0] || b.tagName) }
  }

  const found = await page.evaluate(collect, root)
  if (found.error) throw new Error(`expectEveryPopupButtonReachable: ${found.error}`)
  // A popup with no standalone control would make this pass while asserting
  // nothing — the failure mode scopedCheckA11y had.
  expect(found.labels.length, `${root}: no standalone popup control to check`).toBeGreaterThan(0)

  const reached = new Set()
  for (let i = 0; i < found.labels.length * 3 + 5; i++) {
    const hit = await page.evaluate(() => document.activeElement?.getAttribute?.('data-tabprobe'))
    if (hit != null) reached.add(hit)
    await page.keyboard.press('Tab')
  }

  const unreachable = found.labels.filter((_, i) => !reached.has(String(i)))
  expect(
    unreachable,
    `${root}: ${unreachable.length} popup control(s) cannot be reached by Tab — ` +
      `focus is contained but the cycle does not include them: ${unreachable.join(', ')}`,
  ).toEqual([])
}

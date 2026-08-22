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

// Shared portability seams for the e2e conformance suite.
//
// A consumer running this suite against their own dev server can point it at
// their own demo page and (where a suite routes through a single root selector)
// their own component instance, via env vars — no need to edit test source:
//
//   TARGET_PATH  — page the suite navigates to            (default: '/')
//   TARGET_ID    — component root selector override        (per-component default below)
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
  FileUpload: '[data-component="FileUpload"][data-initialized]',
}

export function targetId(component) {
  return process.env.TARGET_ID ?? DEFAULT_TARGET[component]
}

export function scopedCheckA11y(page, scope, options = {}) {
  return checkA11y(page, scope, options)
}

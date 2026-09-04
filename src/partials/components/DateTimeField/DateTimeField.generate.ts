import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const statesDir = resolve(__dir, 'states')
// states/ is a gitignored build artifact, so wipe it before writing. Without
// this, renaming or removing a state leaves an orphan .hbs behind that still
// resolves as a partial — it silently keeps rendering the old markup.
rmSync(statesDir, { recursive: true, force: true })
mkdirSync(statesDir, { recursive: true })

function canonical(id: string, attrs: Record<string, string> = {}, locale = 'en-GB', label = 'Date and time'): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => v === '' ? k : `${k}="${v}"`)
    .join(' ')

  // The <label for> targets the native input (JS assigns it the data-id as its id
  // on mount). In custom mode DateTimeField.ts relays it to the segment group via
  // aria-labelledby; in display mode it labels the native input directly.
  return `<label for="${id}">${label}</label>
<div class="DateTimeField" data-component="DateTimeField" data-id="${id}" data-name="${id}" data-locale="${locale}" ${attrStr}>
  <input type="datetime-local" data-part="native" tabindex="-1" aria-hidden="true">
  <div data-part="overlay">
    <div data-part="segments" role="group"></div>
    <button data-part="trigger" type="button" aria-label="Open calendar" aria-expanded="false" aria-haspopup="dialog">
      <svg data-part="icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    </button>
  </div>
  <template data-part="calendar-template">
    <div data-part="popup" role="dialog" aria-modal="true">
      <div data-part="calendar-inner">
        <div data-part="calendar-left">
          <div data-part="calendar-header">
            <button data-part="prev-month" type="button">&#8249;</button>
            <button data-part="month-year-trigger" type="button" aria-expanded="false"><span data-part="calendar-month-year"></span></button>
            <button data-part="next-month" type="button">&#8250;</button>
          </div>
          <div data-panel="calendar" data-active="true">
            <table data-part="calendar-grid" role="grid"></table>
          </div>
          <div data-part="year-month-picker" class="WheelColumns" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
        </div>
        <div data-part="time-columns" class="WheelColumns">
          <div class="Wheel" data-segment="hour" tabindex="0"></div>
          <div class="Wheel" data-segment="minute" tabindex="0"></div>
          <div class="Wheel" data-segment="second" tabindex="0" style="display:none"></div>
          <div data-part="ampm" role="group" hidden></div>
        </div>
      </div>
      <div data-part="calendar-footer">
        <button type="button" data-part="calendar-footer-clear"></button>
        <button type="button" data-part="calendar-footer-today"></button>
        <button type="button" data-part="calendar-footer-now"></button>
      </div>
      <div data-part="arrow"></div>
    </div>
  </template>
  <div data-part="rail"></div>
  <div data-part="announce" aria-live="polite" aria-atomic="true"></div>
</div>`
}

const states: { name: string; id: string; attrs: Record<string, string>; locale?: string; label?: string }[] = [
  { name: '_default', id: 'dtf-default', attrs: {} },
  { name: '_default-hover',  id: 'dtf-default-hover',  attrs: { 'data-test-state': 'hover' } },
  { name: '_default-focus',  id: 'dtf-default-focus',  attrs: { 'data-test-state': 'focus' } },
  { name: '_default-active', id: 'dtf-default-active', attrs: { 'data-test-state': 'active' } },
  { name: '_filled', id: 'dtf-filled', attrs: { 'data-value': '2026-05-27T14:35' } },
  { name: '_filled-hover',  id: 'dtf-filled-hover',  attrs: { 'data-value': '2026-05-27T14:35', 'data-test-state': 'hover' } },
  { name: '_filled-focus',  id: 'dtf-filled-focus',  attrs: { 'data-value': '2026-05-27T14:35', 'data-test-state': 'focus' } },
  { name: '_filled-active', id: 'dtf-filled-active', attrs: { 'data-value': '2026-05-27T14:35', 'data-test-state': 'active' } },
  { name: '_disabled-empty', id: 'dtf-disabled-empty', attrs: { 'data-disabled': 'true' } },
  { name: '_disabled-filled', id: 'dtf-disabled-filled', attrs: { 'data-disabled': 'true', 'data-value': '2026-05-27T14:35' } },
  { name: '_invalid-empty', id: 'dtf-invalid-empty', attrs: { 'data-invalid': 'true' } },
  { name: '_invalid-filled', id: 'dtf-invalid-filled', attrs: { 'data-invalid': 'true', 'data-value': '2026-05-27T14:35' } },
  { name: '_with-seconds', id: 'dtf-with-seconds', attrs: { 'data-step': '30', 'data-value': '2026-05-27T14:35:00' } },
  // 12-hour locale — shows the AM/PM toggle next to the wheels
  { name: '_twelve-hour', id: 'dtf-12h', attrs: { 'data-value': '2026-05-27T14:35' }, locale: 'en', label: 'Date and time (en — 12h)' },
  // Localization showcase (ADR-0011): Swedish — 24h, Y/M/D order, Swedish names
  { name: '_localized-sv', id: 'dtf-sv', attrs: { 'data-value': '2026-05-27T14:35' }, locale: 'sv-SE', label: 'Datum och tid' },
  // Live demo (e2e test target) — unique id so the e2e can scope to a single instance on /
  { name: '_live-demo', id: 'meeting-datetime', attrs: {}, label: 'Meeting date and time' },
]

states.forEach(({ name, id, attrs, locale, label }) => {
  const content = `{{!-- generated by DateTimeField.generate.ts — do not edit --}}\n${canonical(id, attrs, locale, label)}\n`
  writeFileSync(resolve(statesDir, `${name}.hbs`), content)
})

// Native reference partials (no DateTimeField wrapper) — the browser's built-in
// <input type="datetime-local"> for each variant, to compare native vs custom
// on real devices.
const nativeInput = (file: string, label: string, attrs: string): void => {
  const id = `dtf-native-${file}`
  writeFileSync(
    resolve(statesDir, `_native-${file}.hbs`),
    `<label for="${id}">${label}</label>\n<input type="datetime-local" id="${id}" name="${id}"${attrs} />\n`,
  )
  console.log(`  _native-${file}.hbs`)
}

console.log(`Generated ${states.length} state partials in ${statesDir}`)
nativeInput('default', 'Date and time', ' min="1900-01-01T00:00" max="2100-12-31T23:59" value="2026-05-27T14:35"')
nativeInput('seconds', 'Date and time (seconds)', ' step="1" value="2026-05-27T14:35:30"')
nativeInput('step', 'Date and time (15-min step)', ' step="900" value="2026-05-27T14:30"')
// 12h is decided by the device locale, not an attribute — lang is only honoured by some browsers.
nativeInput('lang-en', 'Date and time (lang="en-US")', ' lang="en-US" value="2026-05-27T14:35"')
nativeInput('disabled', 'Date and time', ' value="2026-05-27T14:35" disabled')

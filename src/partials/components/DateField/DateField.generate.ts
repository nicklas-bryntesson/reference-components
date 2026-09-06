import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const statesDir = resolve(__dir, 'states')
// states/ is a gitignored build artifact, so wipe it before writing. Without
// this, renaming or removing a state leaves an orphan .hbs behind that still
// resolves as a partial — it silently keeps rendering the old markup.
rmSync(statesDir, { recursive: true, force: true })
mkdirSync(statesDir, { recursive: true })
const out = (file: string) => resolve(statesDir, file)

// ─── Types ────────────────────────────────────────────────────────────────────

type Attrs = Record<string, string>

interface StateDefinition {
  file: string
  id: string
  label: string
  root: Attrs
  input: Attrs
  trigger: Attrs
  locale?: string
}

// ─── Canonical markup ─────────────────────────────────────────────────────────
// Single source of truth for DateField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string, locale = 'en-GB'): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="DateField"
  data-component="DateField"
  data-id="${id}"
  data-name="${id}"
  data-locale="${locale}"
  data-min="1900-01-01"
  data-max="2100-12-31"${rootExtra}
>
  <input class="native" data-part="native" type="date"${inputAttrs} />
  <div class="custom" data-part="custom" aria-hidden="true">
    <div class="segments" data-part="segments" role="group">
      <button class="trigger" data-part="trigger" type="button" aria-label="Open calendar" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
        <svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
    </div>
    <div class="rail" data-part="rail">
      <template data-template="datefield-calendar">
        <div class="popup" data-part="popup" role="dialog" aria-modal="true">
          <div class="calendar-header" data-part="calendar-header">
            <button class="prev-month" data-part="prev-month" type="button">&#8249;</button>
            <button class="month-year-trigger" data-part="month-year-trigger" type="button" aria-expanded="false"></button>
            <button class="next-month" data-part="next-month" type="button">&#8250;</button>
          </div>
          <div data-panel="calendar" data-active="true">
            <table class="calendar-grid" data-part="calendar-grid" role="grid">
              <thead><tr role="row"><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="year-month-picker WheelColumns" data-part="year-month-picker" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
          <div class="calendar-footer" data-part="calendar-footer">
            <button class="calendar-footer-clear" data-part="calendar-footer-clear" type="button"></button>
            <button class="calendar-footer-today" data-part="calendar-footer-today" type="button"></button>
          </div>
          <div class="arrow" data-part="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="announce" data-part="announce" aria-live="polite" aria-atomic="true"></div>
</div>
`
}

// ─── Attribute serializer ─────────────────────────────────────────────────────

function attrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`))
    .join('')
}

// ─── State definitions ────────────────────────────────────────────────────────

const states: StateDefinition[] = [
  // ── Interaction states — empty ──────────────────────────────────────────────
  { file: '_empty',        id: 'state-empty-default', label: 'Date', root: {},                             input: {},                               trigger: {} },
  { file: '_empty-hover',  id: 'state-empty-hover',   label: 'Date', root: { 'data-test-state': 'hover'  }, input: {},                               trigger: {} },
  { file: '_empty-focus',  id: 'state-empty-focus',   label: 'Date', root: { 'data-test-state': 'focus'  }, input: {},                               trigger: {} },
  { file: '_empty-active', id: 'state-empty-active',  label: 'Date', root: { 'data-test-state': 'active' }, input: {},                               trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'state-filled-default', label: 'Date', root: {},                             input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-hover',  id: 'state-filled-hover',   label: 'Date', root: { 'data-test-state': 'hover'  }, input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-focus',  id: 'state-filled-focus',   label: 'Date', root: { 'data-test-state': 'focus'  }, input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-active', id: 'state-filled-active',  label: 'Date', root: { 'data-test-state': 'active' }, input: { value: '1990-06-15' },           trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'state-disabled-empty',  label: 'Date', root: { 'data-disabled': 'true' }, input: { disabled: '' },                    trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'state-disabled-filled', label: 'Date', root: { 'data-disabled': 'true' }, input: { value: '1990-06-15', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'state-invalid-empty',  label: 'Date <span aria-hidden="true">*</span>', root: { 'data-invalid': 'true' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'state-invalid-filled', label: 'Date',                                   root: { 'data-invalid': 'true' }, input: { value: '1800-01-01', 'aria-invalid': 'true' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'birthdate', label: 'Date', root: {}, input: {}, trigger: {} },

  // ── Localization showcase (ADR-0011): same field, three locales — segment order + language ──
  { file: '_locale-en-gb', id: 'df-locale-en-gb', label: 'Date (en-GB — D/M/Y)', locale: 'en-GB', root: {}, input: { value: '1990-06-15' }, trigger: {} },
  { file: '_locale-en-us', id: 'df-locale-en-us', label: 'Date (en-US — M/D/Y)', locale: 'en-US', root: {}, input: { value: '1990-06-15' }, trigger: {} },
  { file: '_locale-sv-se', id: 'df-locale-sv-se', label: 'Date (sv-SE — Y/M/D)', locale: 'sv-SE', root: {}, input: { value: '1990-06-15' }, trigger: {} },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  const content = canonical(
    state.id,
    state.label,
    attrs(state.root),
    attrs(state.input),
    attrs(state.trigger),
    state.locale,
  )
  writeFileSync(out(`${state.file}.hbs`), content)
  console.log(`  ${state.file}.hbs`)
}

// native reference partials (no DateField wrapper)
writeFileSync(
  out('_native-default.hbs'),
  `<label for="state-native-default">Date</label>\n<input type="date" id="state-native-default" name="state-native-default" min="1900-01-01" max="2100-12-31" />\n`,
)
writeFileSync(
  out('_native-disabled.hbs'),
  `<label for="state-native-disabled">Date</label>\n<input type="date" id="state-native-disabled" name="state-native-disabled" min="1900-01-01" max="2100-12-31" value="1990-06-15" disabled />\n`,
)
writeFileSync(
  out('_native-readonly.hbs'),
  `<label for="state-native-readonly">Date</label>\n<input type="date" id="state-native-readonly" name="state-native-readonly" min="1900-01-01" max="2100-12-31" value="1990-06-15" readonly />\n`,
)

console.log('  _native-default.hbs')
console.log('  _native-disabled.hbs')
console.log('done — 15 state files written')

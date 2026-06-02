import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const statesDir = resolve(__dir, 'states')
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
}

// ─── Canonical markup ─────────────────────────────────────────────────────────
// Single source of truth for DateField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="DateField"
  data-component="DateField"
  data-id="${id}"
  data-name="${id}"
  data-locale="sv-SE"
  data-min="1900-01-01"
  data-max="2100-12-31"${rootExtra}
>
  <input class="Native" type="date"${inputAttrs} />
  <div class="Custom" aria-hidden="true">
    <div class="Segments" role="group">
      <button type="button" class="DateField-trigger" aria-label="Öppna kalender" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
    </div>
    <div class="slideContainer">
      <template data-template="datefield-calendar">
        <div class="DateField-popup" role="dialog" aria-modal="true">
          <div class="CalendarHeader">
            <button type="button" class="PrevMonth">&#8249;</button>
            <button type="button" class="MonthYearTrigger" aria-haspopup="listbox" aria-expanded="false"></button>
            <button type="button" class="NextMonth">&#8250;</button>
          </div>
          <div class="Panel" data-panel="calendar" data-active="true">
            <table class="Grid" role="grid">
              <thead><tr role="row"><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="Panel YearMonthPicker" role="group" data-panel="picker" data-active="false">
            <div class="Wheel" data-picker="month" tabindex="0"></div>
            <div class="Wheel" data-picker="year" tabindex="0"></div>
          </div>
          <div class="CalendarFooter">
            <button type="button" class="CalendarFooterClear"></button>
            <button type="button" class="CalendarFooterToday"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="Announce" aria-live="polite" aria-atomic="true"></div>
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
  { file: '_empty',        id: 'state-empty-default', label: 'Datum', root: {},                             input: {},                               trigger: {} },
  { file: '_empty-hover',  id: 'state-empty-hover',   label: 'Datum', root: { 'data-test-state': 'hover'  }, input: {},                               trigger: {} },
  { file: '_empty-focus',  id: 'state-empty-focus',   label: 'Datum', root: { 'data-test-state': 'focus'  }, input: {},                               trigger: {} },
  { file: '_empty-active', id: 'state-empty-active',  label: 'Datum', root: { 'data-test-state': 'active' }, input: {},                               trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'state-filled-default', label: 'Datum', root: {},                             input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-hover',  id: 'state-filled-hover',   label: 'Datum', root: { 'data-test-state': 'hover'  }, input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-focus',  id: 'state-filled-focus',   label: 'Datum', root: { 'data-test-state': 'focus'  }, input: { value: '1990-06-15' },           trigger: {} },
  { file: '_filled-active', id: 'state-filled-active',  label: 'Datum', root: { 'data-test-state': 'active' }, input: { value: '1990-06-15' },           trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'state-disabled-empty',  label: 'Datum', root: { 'data-disabled': '' }, input: { disabled: '' },                    trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'state-disabled-filled', label: 'Datum', root: { 'data-disabled': '' }, input: { value: '1990-06-15', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'state-invalid-empty',  label: 'Datum <span aria-hidden="true">*</span>', root: { 'data-invalid': '' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'state-invalid-filled', label: 'Datum',                                   root: { 'data-invalid': '' }, input: { value: '1800-01-01', 'aria-invalid': 'true' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'birthdate', label: 'Datum', root: {}, input: {}, trigger: {} },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  const content = canonical(
    state.id,
    state.label,
    attrs(state.root),
    attrs(state.input),
    attrs(state.trigger),
  )
  writeFileSync(out(`${state.file}.hbs`), content)
  console.log(`  ${state.file}.hbs`)
}

// Native reference partials (no DateField wrapper)
writeFileSync(
  out('_native-default.hbs'),
  `<label for="state-native-default">Datum</label>\n<input type="date" id="state-native-default" name="state-native-default" min="1900-01-01" max="2100-12-31" />\n`,
)
writeFileSync(
  out('_native-disabled.hbs'),
  `<label for="state-native-disabled">Datum</label>\n<input type="date" id="state-native-disabled" name="state-native-disabled" min="1900-01-01" max="2100-12-31" value="1990-06-15" disabled />\n`,
)
writeFileSync(
  out('_native-readonly.hbs'),
  `<label for="state-native-readonly">Datum</label>\n<input type="date" id="state-native-readonly" name="state-native-readonly" min="1900-01-01" max="2100-12-31" value="1990-06-15" readonly />\n`,
)

console.log('  _native-default.hbs')
console.log('  _native-disabled.hbs')
console.log('done — 15 state files written')

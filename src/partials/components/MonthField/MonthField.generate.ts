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
// Single source of truth for MonthField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="MonthField"
  data-component="MonthField"
  data-id="${id}"
  data-name="${id}"
  data-locale="sv-SE"${rootExtra}
>
  <input class="MonthField-native" type="month" aria-hidden="true" tabindex="-1"${inputAttrs} />
  <div class="MonthField-overlay" aria-hidden="true">
    <div class="MonthField-segments" role="group">
    </div>
    <button type="button" class="MonthField-trigger" aria-label="Öppna månadsväljare" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-icon lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
    </button>
    <div class="slideContainer">
      <template data-template="monthfield-popup">
        <div class="MonthField-popup" role="dialog" aria-modal="true">
          <div class="MonthField-popup-columns WheelColumns">
            <div class="Wheel" data-picker="month" role="spinbutton" tabindex="0"></div>
            <div class="Wheel" data-picker="year" role="spinbutton" tabindex="-1"></div>
          </div>
          <div class="MonthField-popup-footer">
            <button type="button" class="MonthField-popup-clear"></button>
            <button type="button" class="MonthField-popup-now"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="MonthField-announce" aria-live="polite" aria-atomic="true"></div>
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
  { file: '_empty',        id: 'mf-empty-default', label: 'Månad', root: {},                              input: {}, trigger: {} },
  { file: '_empty-hover',  id: 'mf-empty-hover',   label: 'Månad', root: { 'data-test-state': 'hover'  }, input: {}, trigger: {} },
  { file: '_empty-focus',  id: 'mf-empty-focus',   label: 'Månad', root: { 'data-test-state': 'focus'  }, input: {}, trigger: {} },
  { file: '_empty-active', id: 'mf-empty-active',  label: 'Månad', root: { 'data-test-state': 'active' }, input: {}, trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'mf-filled-default', label: 'Månad', root: { 'data-value': '2026-06' },                              input: { value: '2026-06' }, trigger: {} },
  { file: '_filled-hover',  id: 'mf-filled-hover',   label: 'Månad', root: { 'data-value': '2026-06', 'data-test-state': 'hover'  }, input: { value: '2026-06' }, trigger: {} },
  { file: '_filled-focus',  id: 'mf-filled-focus',   label: 'Månad', root: { 'data-value': '2026-06', 'data-test-state': 'focus'  }, input: { value: '2026-06' }, trigger: {} },
  { file: '_filled-active', id: 'mf-filled-active',  label: 'Månad', root: { 'data-value': '2026-06', 'data-test-state': 'active' }, input: { value: '2026-06' }, trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'mf-disabled-empty',  label: 'Månad', root: { 'data-disabled': 'true' }, input: { disabled: '' }, trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'mf-disabled-filled', label: 'Månad', root: { 'data-disabled': 'true', 'data-value': '2026-06' }, input: { value: '2026-06', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'mf-invalid-empty',  label: 'Månad <span aria-hidden="true">*</span>', root: { 'data-invalid': 'true' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'mf-invalid-filled', label: 'Månad',                                   root: { 'data-invalid': 'true', 'data-value': '2020-01' }, input: { value: '2020-01', 'aria-invalid': 'true' }, trigger: {} },

  // ── With min/max range ───────────────────────────────────────────────────────
  { file: '_with-range', id: 'mf-with-range', label: 'Månad', root: { 'data-min': '2026-03', 'data-max': '2026-09', 'data-value': '2026-06' }, input: { value: '2026-06', min: '2026-03', max: '2026-09' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'meeting-month', label: 'Mötesmånad', root: {}, input: {}, trigger: {} },
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

// Native reference partials (no MonthField wrapper)
writeFileSync(
  out('_native-default.hbs'),
  '<label for="mf-native-default">Månad</label>\n<input type="month" id="mf-native-default" name="mf-native-default" />\n'
)
writeFileSync(
  out('_native-disabled.hbs'),
  '<label for="mf-native-disabled">Månad</label>\n<input type="month" id="mf-native-disabled" name="mf-native-disabled" value="2026-06" disabled />\n'
)

console.log('  _native-default.hbs')
console.log('  _native-disabled.hbs')
console.log(`done — ${states.length + 2} state files written`)

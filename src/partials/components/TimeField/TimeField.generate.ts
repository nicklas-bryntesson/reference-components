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
// Single source of truth for TimeField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="TimeField"
  data-component="TimeField"
  data-id="${id}"
  data-name="${id}"
  data-locale="sv-SE"${rootExtra}
>
  <input class="TimeField-native" type="time" aria-hidden="true" tabindex="-1"${inputAttrs} />
  <div class="TimeField-overlay" aria-hidden="true">
    <div class="TimeField-segments" role="group">
    </div>
    <button type="button" class="TimeField-trigger" aria-label="Öppna tidsväljare" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </button>
    <div class="TimeField-slideContainer">
      <template data-template="timefield-popup">
        <div class="TimeFieldPopup" role="dialog" aria-modal="true" aria-label="Välj tid">
          <span class="TimeFieldPopup-surface" aria-hidden="true"><span class="TimeFieldPopup-backdropBlur"></span></span>
          <div class="TimeFieldPopup-columns">
            <ul class="TimeFieldPopup-column" data-segment="hour" role="listbox" aria-label="Timmar" tabindex="0"></ul>
            <ul class="TimeFieldPopup-column" data-segment="minute" role="listbox" aria-label="Minuter" tabindex="-1"></ul>
            <ul class="TimeFieldPopup-column" data-segment="second" role="listbox" aria-label="Sekunder" tabindex="-1"></ul>
          </div>
          <div class="TimeFieldPopup-footer">
            <button type="button" class="TimeFieldPopup-clear">Rensa</button>
            <button type="button" class="TimeFieldPopup-now">Nu</button>
          </div>
          <div class="TimeFieldPopup-arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="TimeField-announce" aria-live="polite" aria-atomic="true"></div>
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
  { file: '_empty',        id: 'tf-empty-default', label: 'Tid', root: {},                              input: {},                      trigger: {} },
  { file: '_empty-hover',  id: 'tf-empty-hover',   label: 'Tid', root: { 'data-test-state': 'hover'  }, input: {},                      trigger: {} },
  { file: '_empty-focus',  id: 'tf-empty-focus',   label: 'Tid', root: { 'data-test-state': 'focus'  }, input: {},                      trigger: {} },
  { file: '_empty-active', id: 'tf-empty-active',  label: 'Tid', root: { 'data-test-state': 'active' }, input: {},                      trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'tf-filled-default', label: 'Tid', root: { 'data-value': '13:45' },                              input: { value: '13:45' }, trigger: {} },
  { file: '_filled-hover',  id: 'tf-filled-hover',   label: 'Tid', root: { 'data-value': '13:45', 'data-test-state': 'hover'  }, input: { value: '13:45' }, trigger: {} },
  { file: '_filled-focus',  id: 'tf-filled-focus',   label: 'Tid', root: { 'data-value': '13:45', 'data-test-state': 'focus'  }, input: { value: '13:45' }, trigger: {} },
  { file: '_filled-active', id: 'tf-filled-active',  label: 'Tid', root: { 'data-value': '13:45', 'data-test-state': 'active' }, input: { value: '13:45' }, trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'tf-disabled-empty',  label: 'Tid', root: { 'data-disabled': '' }, input: { disabled: '' },                       trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'tf-disabled-filled', label: 'Tid', root: { 'data-disabled': '', 'data-value': '13:45' }, input: { value: '13:45', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'tf-invalid-empty',  label: 'Tid <span aria-hidden="true">*</span>', root: { 'data-invalid': '' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'tf-invalid-filled', label: 'Tid',                                   root: { 'data-invalid': '', 'data-value': '07:00' }, input: { value: '07:00', 'aria-invalid': 'true' }, trigger: {} },

  // ── With seconds (step < 60) ─────────────────────────────────────────────────
  { file: '_with-seconds', id: 'tf-with-seconds', label: 'Tid', root: { 'data-step': '1', 'data-value': '13:45:30' }, input: { value: '13:45:30', step: '1' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'meeting-time', label: 'Mötestid', root: {}, input: {}, trigger: {} },
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

// Native reference partials (no TimeField wrapper)
writeFileSync(
  out('_native-default.hbs'),
  '<label for="tf-native-default">Tid</label>\n<input type="time" id="tf-native-default" name="tf-native-default" />\n'
)
writeFileSync(
  out('_native-disabled.hbs'),
  '<label for="tf-native-disabled">Tid</label>\n<input type="time" id="tf-native-disabled" name="tf-native-disabled" value="13:45" disabled />\n'
)

console.log('  _native-default.hbs')
console.log('  _native-disabled.hbs')
console.log(`done — ${states.length + 2} state files written`)

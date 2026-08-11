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
  locale?: string
}

// ─── Canonical markup ─────────────────────────────────────────────────────────
// Single source of truth for TimeField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string, locale = 'en-GB'): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="TimeField"
  data-component="TimeField"
  data-id="${id}"
  data-name="${id}"
  data-locale="${locale}"${rootExtra}
>
  <input class="native" type="time" aria-hidden="true" tabindex="-1"${inputAttrs} />
  <div class="overlay" aria-hidden="true">
    <div class="segments" role="group">
    </div>
    <button type="button" class="trigger" aria-label="Open time picker" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-icon lucide-clock"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
    </button>
    <div class="rail">
      <template data-template="timefield-popup">
        <div class="popup" role="dialog" aria-modal="true">
          <div class="time-columns WheelColumns">
            <div class="Wheel" data-segment="hour" role="spinbutton" tabindex="0"></div>
            <div class="Wheel" data-segment="minute" role="spinbutton" tabindex="-1"></div>
            <div class="Wheel" data-segment="second" role="spinbutton" tabindex="-1"></div>
          </div>
          <div class="footer">
            <button type="button" class="footer-clear"></button>
            <button type="button" class="footer-now"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="announce" aria-live="polite" aria-atomic="true"></div>
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
  { file: '_empty',        id: 'tf-empty-default', label: 'Time', root: {},                              input: {},                      trigger: {} },
  { file: '_empty-hover',  id: 'tf-empty-hover',   label: 'Time', root: { 'data-test-state': 'hover'  }, input: {},                      trigger: {} },
  { file: '_empty-focus',  id: 'tf-empty-focus',   label: 'Time', root: { 'data-test-state': 'focus'  }, input: {},                      trigger: {} },
  { file: '_empty-active', id: 'tf-empty-active',  label: 'Time', root: { 'data-test-state': 'active' }, input: {},                      trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'tf-filled-default', label: 'Time', root: { 'data-value': '13:45' },                              input: { value: '13:45' }, trigger: {} },
  { file: '_filled-hover',  id: 'tf-filled-hover',   label: 'Time', root: { 'data-value': '13:45', 'data-test-state': 'hover'  }, input: { value: '13:45' }, trigger: {} },
  { file: '_filled-focus',  id: 'tf-filled-focus',   label: 'Time', root: { 'data-value': '13:45', 'data-test-state': 'focus'  }, input: { value: '13:45' }, trigger: {} },
  { file: '_filled-active', id: 'tf-filled-active',  label: 'Time', root: { 'data-value': '13:45', 'data-test-state': 'active' }, input: { value: '13:45' }, trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'tf-disabled-empty',  label: 'Time', root: { 'data-disabled': 'true' }, input: { disabled: '' },                       trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'tf-disabled-filled', label: 'Time', root: { 'data-disabled': 'true', 'data-value': '13:45' }, input: { value: '13:45', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'tf-invalid-empty',  label: 'Time <span aria-hidden="true">*</span>', root: { 'data-invalid': 'true' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'tf-invalid-filled', label: 'Time',                                   root: { 'data-invalid': 'true', 'data-value': '07:00' }, input: { value: '07:00', 'aria-invalid': 'true' }, trigger: {} },

  // ── With seconds (step < 60) ─────────────────────────────────────────────────
  { file: '_with-seconds', id: 'tf-with-seconds', label: 'Time', root: { 'data-step': '1', 'data-value': '13:45:30' }, input: { value: '13:45:30', step: '1' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'meeting-time', label: 'Meeting time', root: {}, input: {}, trigger: {} },

  // ── Localization showcase (ADR-0011): the hour cycle differs by locale ──
  { file: '_locale-en-gb', id: 'tf-locale-en-gb', label: 'Time (en-GB — 24h)', locale: 'en-GB', root: { 'data-value': '13:45' }, input: { value: '13:45' }, trigger: {} },
  { file: '_locale-en-us', id: 'tf-locale-en-us', label: 'Time (en-US — 12h)', locale: 'en-US', root: { 'data-value': '13:45' }, input: { value: '13:45' }, trigger: {} },
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

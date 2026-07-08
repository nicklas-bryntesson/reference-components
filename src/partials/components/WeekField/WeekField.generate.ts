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
// Single source of truth for WeekField HTML structure.
// Update this function when the component markup changes, then re-run this script.

function canonical(id: string, label: string, rootAttrs: string, inputAttrs: string, triggerAttrs: string, locale = 'en-GB'): string {
  const rootExtra = rootAttrs ? `\n  ${rootAttrs.trim()}` : ''
  return `<label for="${id}">${label}</label>
<div
  class="WeekField"
  data-component="WeekField"
  data-id="${id}"
  data-name="${id}"
  data-locale="${locale}"${rootExtra}
>
  <input class="WeekField-native" type="week" aria-hidden="true" tabindex="-1"${inputAttrs} />
  <div class="WeekField-overlay" aria-hidden="true">
    <div class="WeekField-segments" role="group">
    </div>
    <button type="button" class="WeekField-trigger" aria-label="Open week picker" aria-expanded="false" aria-haspopup="dialog"${triggerAttrs}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-icon lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
    </button>
    <div class="slideContainer">
      <template data-template="weekfield-popup">
        <div class="WeekField-popup" role="dialog" aria-modal="true">
          <div class="CalendarHeader">
            <button type="button" class="PrevMonth">&#8249;</button>
            <span class="MonthYearLabel"></span>
            <button type="button" class="NextMonth">&#8250;</button>
          </div>
          <table class="CalendarGrid WeekGrid" role="grid">
            <thead>
              <tr role="row">
                <th scope="col" class="WeekNumHead"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div class="WeekField-popup-footer">
            <button type="button" class="WeekField-popup-clear"></button>
            <button type="button" class="WeekField-popup-now"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
    </div>
  </div>
  <div class="WeekField-announce" aria-live="polite" aria-atomic="true"></div>
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
  { file: '_empty',        id: 'wf-empty-default', label: 'Week', root: {},                              input: {}, trigger: {} },
  { file: '_empty-hover',  id: 'wf-empty-hover',   label: 'Week', root: { 'data-test-state': 'hover'  }, input: {}, trigger: {} },
  { file: '_empty-focus',  id: 'wf-empty-focus',   label: 'Week', root: { 'data-test-state': 'focus'  }, input: {}, trigger: {} },
  { file: '_empty-active', id: 'wf-empty-active',  label: 'Week', root: { 'data-test-state': 'active' }, input: {}, trigger: {} },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'wf-filled-default', label: 'Week', root: { 'data-value': '2026-W27' },                              input: { value: '2026-W27' }, trigger: {} },
  { file: '_filled-hover',  id: 'wf-filled-hover',   label: 'Week', root: { 'data-value': '2026-W27', 'data-test-state': 'hover'  }, input: { value: '2026-W27' }, trigger: {} },
  { file: '_filled-focus',  id: 'wf-filled-focus',   label: 'Week', root: { 'data-value': '2026-W27', 'data-test-state': 'focus'  }, input: { value: '2026-W27' }, trigger: {} },
  { file: '_filled-active', id: 'wf-filled-active',  label: 'Week', root: { 'data-value': '2026-W27', 'data-test-state': 'active' }, input: { value: '2026-W27' }, trigger: {} },

  // ── Disabled ────────────────────────────────────────────────────────────────
  { file: '_disabled-empty',  id: 'wf-disabled-empty',  label: 'Week', root: { 'data-disabled': 'true' }, input: { disabled: '' }, trigger: { disabled: '' } },
  { file: '_disabled-filled', id: 'wf-disabled-filled', label: 'Week', root: { 'data-disabled': 'true', 'data-value': '2026-W27' }, input: { value: '2026-W27', disabled: '' }, trigger: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid-empty',  id: 'wf-invalid-empty',  label: 'Week <span aria-hidden="true">*</span>', root: { 'data-invalid': 'true' }, input: { required: '', 'aria-invalid': 'true' }, trigger: {} },
  { file: '_invalid-filled', id: 'wf-invalid-filled', label: 'Week',                                   root: { 'data-invalid': 'true', 'data-value': '2020-W01' }, input: { value: '2020-W01', 'aria-invalid': 'true' }, trigger: {} },

  // ── With min/max range ───────────────────────────────────────────────────────
  { file: '_with-range', id: 'wf-with-range', label: 'Week', root: { 'data-min': '2026-W10', 'data-max': '2026-W40', 'data-value': '2026-W27' }, input: { value: '2026-W27', min: '2026-W10', max: '2026-W40' }, trigger: {} },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'meeting-week', label: 'Meeting week', root: {}, input: {}, trigger: {} },

  // ── Localization showcase (ADR-0011): week naming + language ──
  { file: '_locale-en-gb', id: 'wf-locale-en-gb', label: 'Week (en-GB)', locale: 'en-GB', root: { 'data-value': '2026-W27' }, input: { value: '2026-W27' }, trigger: {} },
  { file: '_locale-sv-se', id: 'wf-locale-sv-se', label: 'Week (sv-SE)', locale: 'sv-SE', root: { 'data-value': '2026-W27' }, input: { value: '2026-W27' }, trigger: {} },
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

// Native reference partials (no WeekField wrapper)
writeFileSync(
  out('_native-default.hbs'),
  '<label for="wf-native-default">Week</label>\n<input type="week" id="wf-native-default" name="wf-native-default" />\n'
)
writeFileSync(
  out('_native-disabled.hbs'),
  '<label for="wf-native-disabled">Week</label>\n<input type="week" id="wf-native-disabled" name="wf-native-disabled" value="2026-W27" disabled />\n'
)

console.log('  _native-default.hbs')
console.log('  _native-disabled.hbs')
console.log(`done — ${states.length + 2} state files written`)

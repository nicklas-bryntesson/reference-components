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
  id: string            // input id (also the label's for=)
  rootId?: string       // data-id on the root — stable e2e/demo anchor
  label: string
  input?: Attrs         // everything: the input IS the root here
  hint?: { id: string; text: string }
}

// ─── Attribute serializers ────────────────────────────────────────────────────

function attrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`))
    .join('')
}

function rootAttrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? `\n  ${k}` : `\n  ${k}="${v}"`))
    .join('')
}

// ─── Canonical markup ─────────────────────────────────────────────────────────
// Single source of truth for RangeField HTML structure.
// Update this function when the component markup changes, then re-run this script.
//
// RangeField has NO WRAPPER: the input is the component root, so data-component
// and data-id sit on the input itself. A real <label for> is part of the contract.
//
// There is no authored position variable and no style attribute: RangeField draws
// a flat track and a thumb, and the browser positions the thumb from `value`.
// Nothing here can fall out of sync, which is why none of the states below carry
// anything but native attributes and the documented data-* axes.

function canonical(state: StateDefinition): string {
  const rootIdAttr: Attrs = state.rootId ? { 'data-id': state.rootId } : {}
  const hintLine = state.hint
    ? `\n<p id="${state.hint.id}">${state.hint.text}</p>`
    : ''
  const all = rootAttrs({
    type: 'range',
    id: state.id,
    name: state.id,
    'data-component': 'RangeField',
    ...rootIdAttr,
    ...(state.input ?? {}),
  })
  return `<label for="${state.id}">${state.label}</label>
<input
  class="RangeField"${all}
/>${hintLine}
`
}

// ─── Shared shapes ────────────────────────────────────────────────────────────

// A range ALWAYS carries a value — there is no empty state (ADR-0022). So the
// two interaction rows are `min` (at the minimum, nothing filled) and `mid`
// (partially filled), not the family's usual empty/filled pair.
//
// No aria-valuetext anywhere: RangeField ships no JavaScript, so an authored
// valuetext freezes on the first arrow key — the value moves, the speech does
// not. The spoken unit belongs to RangeScale, whose JS owns the attribute.
const min = { min: '0', max: '100', step: '1', value: '0' }
const mid = { min: '0', max: '100', step: '1', value: '50' }

const states: StateDefinition[] = [
  // ── Interaction states — at minimum ─────────────────────────────────────────
  { file: '_min',        id: 'rf-min-default', label: 'Volume', input: min },
  { file: '_min-hover',  id: 'rf-min-hover',   label: 'Volume', input: { ...min, 'data-test-state': 'hover'  } },
  { file: '_min-focus',  id: 'rf-min-focus',   label: 'Volume', input: { ...min, 'data-test-state': 'focus'  } },
  { file: '_min-active', id: 'rf-min-active',  label: 'Volume', input: { ...min, 'data-test-state': 'active' } },

  // ── Interaction states — partially filled ───────────────────────────────────
  { file: '_mid',        id: 'rf-mid-default', label: 'Volume', input: mid },
  { file: '_mid-hover',  id: 'rf-mid-hover',   label: 'Volume', input: { ...mid, 'data-test-state': 'hover'  } },
  { file: '_mid-focus',  id: 'rf-mid-focus',   label: 'Volume', input: { ...mid, 'data-test-state': 'focus'  } },
  { file: '_mid-active', id: 'rf-mid-active',  label: 'Volume', input: { ...mid, 'data-test-state': 'active' } },

  // ── Disabled (native attribute; no data-disabled — the input IS the root) ───
  { file: '_disabled-min', id: 'rf-disabled-min', label: 'Volume', input: { ...min, disabled: '' } },
  { file: '_disabled-mid', id: 'rf-disabled-mid', label: 'Volume', input: { ...mid, disabled: '' } },

  // ── Invalid (data-invalid on the root AND aria-invalid, per the family) ─────
  // `required` cannot express "no answer yet" on a range — it always has a
  // value — so invalid here is an out-of-policy value, not a missing one.
  { file: '_invalid-min', id: 'rf-invalid-min', label: 'Volume',
    input: { ...min, 'data-invalid': 'true', 'aria-invalid': 'true', 'aria-describedby': 'rf-invalid-min-hint' },
    hint: { id: 'rf-invalid-min-hint', text: 'Pick at least 10 %.' } },
  { file: '_invalid-mid', id: 'rf-invalid-mid', label: 'Volume',
    input: { ...mid, 'data-invalid': 'true', 'aria-invalid': 'true' } },

  // ── Variants ────────────────────────────────────────────────────────────────

  // 1. Stepped: step matches the tick values a composing RangeScale would draw,
  //    so the keyboard can land on every mark. No marks are drawn here — this
  //    component has nowhere to put them.
  { file: '_variant-stepped', id: 'rf-variant-stepped', rootId: 'rangefield-stepped', label: 'Volume (steps of 25)',
    input: { min: '0', max: '100', step: '25', value: '75' } },

  // 2. Resized: --_rf-thumb is the shared geometry constant, so overriding it
  //    moves the thumb, the track centring and the ring together. Relative units,
  //    so it also follows the local text — set font-size and the whole control scales.
  { file: '_variant-resized', id: 'rf-variant-resized', rootId: 'rangefield-resized', label: 'Volume (larger thumb)',
    input: { ...mid, style: '--_rf-thumb: 2em; --_rf-track: 0.75em' } },

  // 3. Text-scaled: nothing overridden — only font-size. The thumb, track, ring
  //    and focus offset all follow, because every length is em-derived.
  { file: '_variant-text-scaled', id: 'rf-variant-text-scaled', rootId: 'rangefield-text-scaled', label: 'Volume (font-size: 1.5rem)',
    input: { ...mid, style: 'font-size: 1.5rem' } },

  // (There is deliberately no aria-valuetext variant. It used to exist — a static
  // "250 kr" that froze the moment the value moved, because nothing here updates
  // it. A value that must SPEAK its unit is RangeScale's job.)

  // 4. Vertical, min at the bottom — the default recipe (volume, mixer).
  { file: '_variant-vertical', id: 'rf-variant-vertical', rootId: 'rangefield-vertical', label: 'Volume (vertical)',
    input: { ...mid, 'data-orientation': 'vertical' } },

  // 5. Vertical, min at the top — the other anchor.
  { file: '_variant-vertical-top', id: 'rf-variant-vertical-top', rootId: 'rangefield-vertical-top', label: 'Depth (min at top)',
    input: { ...mid, 'data-orientation': 'vertical', 'data-min': 'top' } },

  // 6. A datalist is correct markup and renders NOTHING here: appearance:none
  //    removed the browser's marks. Kept to document that, not to show it.
  { file: '_variant-datalist', id: 'rf-variant-datalist', rootId: 'rangefield-datalist', label: 'Volume (datalist, no marks drawn)',
    input: { min: '0', max: '100', step: '25', value: '50', list: 'rf-variant-datalist-ticks' } },

  // ── Live demo (e2e test target) ─────────────────────────────────────────────
  { file: '_live', id: 'rf-live', rootId: 'rangefield-live', label: 'Volume', input: mid },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  writeFileSync(out(`${state.file}.hbs`), canonical(state))
  console.log(`  ${state.file}.hbs`)
}

// The datalist the variant above points at. Separate file so the variant's
// markup stays a plain input — the datalist is a sibling, not a child.
writeFileSync(
  out('_variant-datalist-list.hbs'),
  `<datalist id="rf-variant-datalist-ticks">
  <option value="0"></option><option value="25"></option><option value="50"></option>
  <option value="75"></option><option value="100"></option>
</datalist>
`,
)
console.log('  _variant-datalist-list.hbs')

// Native reference: an unstyled range with the browser's own track, thumb and
// datalist tick marks — everything appearance:none takes away.
writeFileSync(
  out('_native.hbs'),
  `<label for="rf-native">Volume</label>
<input type="range" id="rf-native" name="rf-native" min="0" max="100" step="25" value="50" list="rf-native-ticks" />
<datalist id="rf-native-ticks">
  <option value="0"></option><option value="25"></option><option value="50"></option>
  <option value="75"></option><option value="100"></option>
</datalist>
`,
)
console.log('  _native.hbs')

console.log(`done — ${states.length + 2} state files written`)

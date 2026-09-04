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
  rootId?: string       // data-id on the root element — stable e2e/demo anchor
                        // (family convention: [data-component="X"][data-id="…"])
  label: string
  root?: Attrs
  input?: Attrs
  prefix?: string       // pre-rendered prefix span (see helpers)
  suffix?: string       // pre-rendered suffix span
  hint?: { id: string; text: string } // external hint referenced by aria-describedby
  bare?: boolean        // omit the authored data-has-* presence attributes —
                        // the bare variant demonstrates the JS gap-fill path
}

// ─── Affix helpers ────────────────────────────────────────────────────────────

const prefix = (text: string, extra: Attrs = {}) =>
  `<span data-part="prefix"${attrs(extra)}>${text}</span>`

const suffix = (text: string, extra: Attrs = {}) =>
  `<span data-part="suffix"${attrs(extra)}>${text}</span>`

// ─── Attribute serializers ────────────────────────────────────────────────────

function attrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${v}"`))
    .join('')
}

// Root attributes render one per line (matches the sibling generators' style).
function rootAttrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? `\n  ${k}` : `\n  ${k}="${v}"`))
    .join('')
}

// ─── Canonical markup ─────────────────────────────────────────────────────────
// Single source of truth for AffixField HTML structure.
// Update this function when the component markup changes, then re-run this script.
//
// A real <label for> is part of the contract — a placeholder is not a name.
// The optional hint paragraph renders after the field, matching the
// describedby-merge example (affix ids append AFTER the hint id).

function canonical(state: StateDefinition): string {
  const rootIdAttr = state.rootId ? `\n  data-id="${state.rootId}"` : ''
  // data-has-prefix / data-has-suffix are end-state contract attributes: the
  // CSS padding gates key on them, so the server end-state authors them from
  // affix presence (the bare variant omits them — JS gap-fills there).
  const presence: Attrs = {}
  if (!state.bare) {
    if (state.prefix) presence['data-has-prefix'] = 'true'
    if (state.suffix) presence['data-has-suffix'] = 'true'
  }
  const rootExtra = rootAttrs({ ...presence, ...(state.root ?? {}) })
  const inputAttrs = attrs({ type: 'text', ...(state.input ?? {}) })
  const prefixLine = state.prefix ? `\n  ${state.prefix}` : ''
  const suffixLine = state.suffix ? `\n  ${state.suffix}` : ''
  const hintLine = state.hint
    ? `\n<p id="${state.hint.id}">${state.hint.text}</p>`
    : ''
  return `<label for="${state.id}">${state.label}</label>
<div
  class="AffixField"
  data-component="AffixField"${rootIdAttr}${rootExtra}
>${prefixLine}
  <input data-part="input" id="${state.id}" name="${state.id}"${inputAttrs} />${suffixLine}
</div>${hintLine}
`
}

// ─── State definitions ────────────────────────────────────────────────────────

const money = { prefix: prefix('$'), suffix: suffix('USD') }
const decimalInput = { inputmode: 'decimal' }

const states: StateDefinition[] = [
  // ── Interaction states — empty ──────────────────────────────────────────────
  { file: '_empty',        id: 'af-empty-default', label: 'Amount', input: decimalInput, ...money },
  { file: '_empty-hover',  id: 'af-empty-hover',   label: 'Amount', root: { 'data-test-state': 'hover'  }, input: decimalInput, ...money },
  { file: '_empty-focus',  id: 'af-empty-focus',   label: 'Amount', root: { 'data-test-state': 'focus'  }, input: decimalInput, ...money },
  { file: '_empty-active', id: 'af-empty-active',  label: 'Amount', root: { 'data-test-state': 'active' }, input: decimalInput, ...money },

  // ── Interaction states — filled ─────────────────────────────────────────────
  { file: '_filled',        id: 'af-filled-default', label: 'Amount', input: { ...decimalInput, value: '100' }, ...money },
  { file: '_filled-hover',  id: 'af-filled-hover',   label: 'Amount', root: { 'data-test-state': 'hover'  }, input: { ...decimalInput, value: '100' }, ...money },
  { file: '_filled-focus',  id: 'af-filled-focus',   label: 'Amount', root: { 'data-test-state': 'focus'  }, input: { ...decimalInput, value: '100' }, ...money },
  { file: '_filled-active', id: 'af-filled-active',  label: 'Amount', root: { 'data-test-state': 'active' }, input: { ...decimalInput, value: '100' }, ...money },

  // ── Disabled (author sets data-disabled on root AND disabled on the input) ──
  { file: '_disabled-empty',  id: 'af-disabled-empty',  label: 'Amount', root: { 'data-disabled': 'true' }, input: { ...decimalInput, disabled: '' }, ...money },
  { file: '_disabled-filled', id: 'af-disabled-filled', label: 'Amount', root: { 'data-disabled': 'true' }, input: { ...decimalInput, value: '100', disabled: '' }, ...money },

  // ── Invalid (author sets data-invalid on root AND aria-invalid on the input) ─
  { file: '_invalid-empty',  id: 'af-invalid-empty',  label: 'Amount <span aria-hidden="true">*</span>', root: { 'data-invalid': 'true' }, input: { ...decimalInput, required: '', 'aria-invalid': 'true' }, ...money },
  { file: '_invalid-filled', id: 'af-invalid-filled', label: 'Amount', root: { 'data-invalid': 'true' }, input: { ...decimalInput, value: '-1', 'aria-invalid': 'true' }, ...money },

  // ── Variants — the spec's 6-example matrix ──────────────────────────────────

  // 1. Bare + JS-wired: minimal authored markup; JS fills ids, describedby,
  //    character counts AND the data-has-* presence attributes.
  { file: '_variant-bare', id: 'af-variant-bare', rootId: 'affixfield-bare', label: 'Amount',
    input: decimalInput, ...money, bare: true },

  // 2. Fully authored: the server end-state — a Tag Helper renders the counts
  //    from the affix string lengths ("$".Length, "USD".Length). JS verifiably
  //    touches nothing; the e2e suite asserts strict equality with what is
  //    below (a JS write would re-serialize the style attribute).
  { file: '_variant-authored', id: 'af-variant-authored', rootId: 'affixfield-authored', label: 'Amount',
    root: { style: '--_af-prefix-chars: 1; --_af-suffix-chars: 3' },
    input: { ...decimalInput, 'aria-describedby': 'af-variant-authored-prefix af-variant-authored-suffix' },
    prefix: prefix('$', { id: 'af-variant-authored-prefix' }),
    suffix: suffix('USD', { id: 'af-variant-authored-suffix' }) },

  // 3. Unit in label: the visible label already carries the unit — the affix is
  //    authored aria-hidden so it is never announced twice. JS skips it entirely.
  { file: '_variant-unit-in-label', id: 'af-variant-unit-in-label', rootId: 'affixfield-unit-in-label', label: 'Number of hours',
    input: { inputmode: 'numeric' },
    suffix: suffix('hours', { 'aria-hidden': 'true' }) },

  // 4. Number with prefix + suffix: hidden spinner (it would collide with the
  //    suffix); arrow-key stepping still works.
  { file: '_variant-number', id: 'af-variant-number', rootId: 'affixfield-number', label: 'Amount (number)',
    input: { type: 'number', value: '100' }, ...money },

  // 5. describedby merge: the input has an existing hint id — the affix ids
  //    append AFTER it, so the hint survives and keeps its order.
  { file: '_variant-describedby', id: 'af-variant-describedby', rootId: 'affixfield-describedby', label: 'Price',
    input: { ...decimalInput, 'aria-describedby': 'af-variant-describedby-hint' },
    suffix: suffix('USD'),
    hint: { id: 'af-variant-describedby-hint', text: 'Excluding VAT.' } },

  // 6. Sized field: the value area is exactly 4ch (the SVL example-site look);
  //    data-align="end" right-aligns the amount against the suffix.
  { file: '_variant-sized', id: 'af-variant-sized', rootId: 'affixfield-sized', label: 'Number of hours',
    root: { 'data-input-characters': '4', 'data-align': 'end' },
    input: { type: 'number', value: '40' },
    suffix: suffix('hours') },

  // ── Live demo (e2e test target) ──────────────────────────────────────────────
  { file: '_live', id: 'af-live', rootId: 'affixfield-live', label: 'Amount',
    input: decimalInput, ...money },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  writeFileSync(out(`${state.file}.hbs`), canonical(state))
  console.log(`  ${state.file}.hbs`)
}

// Native reference (no AffixField wrapper): a bare number input with its
// spinner visible — the collision the component's hidden spinner avoids.
writeFileSync(
  out('_native-number.hbs'),
  '<label for="af-native-number">Amount</label>\n<input type="number" id="af-native-number" name="af-native-number" value="100" />\n',
)
console.log('  _native-number.hbs')

console.log(`done — ${states.length + 1} state files written`)

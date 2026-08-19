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
  id: string            // id stem; the two fields get -lower and -upper
  rootId?: string
  legend: string
  lowerLabel: string
  upperLabel: string
  suffix?: string
  min: number
  max: number
  step: number
  lower: number
  upper: number
  group?: Attrs         // attributes on the <fieldset>
  scale?: Attrs         // attributes on the .RangeScale
  field?: Attrs         // attributes on BOTH fields
  wrap?: (markup: string) => string
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
// Single source of truth for RangeGroup HTML structure.
// Update this function when the component markup changes, then re-run this script.
//
// <legend> is the first child of <fieldset> — a spec requirement, and the only
// INTRINSIC group name. Each field carries its own <label>, because "lowest" and
// "highest" is what each control IS; a span is not one value with two handles.
//
// The two fields share one lane, which is told `data-fields="2"` as an AUTHORED
// fact rather than being read out of the DOM with :has() — the pointer rule that
// hangs off it is load-bearing, and load-bearing selectors do not get to depend on
// feature detection.
//
// The initial positions are server-rendered, so the first paint is correct without
// JavaScript. aria-valuemin/valuemax and aria-valuetext are NOT authored here:
// they are statements about the pair at a moment in time, and RangeGroup.ts writes
// them on mount. Authoring them would be a second source of truth.

function canonical(state: StateDefinition): string {
  const idLower = `${state.id}-lower`
  const idUpper = `${state.id}-upper`
  const p = (v: number) => (state.max === state.min ? 0 : (v - state.min) / (state.max - state.min))

  const groupAttrs = rootAttrs({
    'data-component': 'RangeGroup',
    ...(state.rootId ? { 'data-id': state.rootId } : {}),
    ...(state.group ?? {}),
  })

  const { style: scaleStyle, ...scaleRest } = state.scale ?? {}
  const scaleAttrs = attrs({
    'data-component': 'RangeScale',
    'data-fields': '2',
    ...scaleRest,
    style: [`--_rs-a: ${p(state.lower)}`, `--_rs-b: ${p(state.upper)}`, scaleStyle]
      .filter(Boolean)
      .join('; '),
  })

  const suffix = state.suffix ? ` data-suffix="${state.suffix}"` : ''
  const readout = (side: 'lower' | 'upper', value: number) =>
    `<b data-readout="${side}"${suffix}>${value}${state.suffix ? ` ${state.suffix}` : ''}</b>`

  const field = (side: 'lower' | 'upper', id: string, value: number) =>
    `<input class="RangeField" type="range" id="${id}" name="${id}" data-role="${side}"` +
    `${attrs({
      min: String(state.min),
      max: String(state.max),
      step: String(state.step),
      value: String(value),
      ...(state.field ?? {}),
    })} />`

  const markup = `<fieldset
  class="RangeGroup"${groupAttrs}
>
  <legend>${state.legend}</legend>
  <div class="roles">
    <label for="${idLower}">${state.lowerLabel} ${readout('lower', state.lower)}</label>
    <label for="${idUpper}">${state.upperLabel} ${readout('upper', state.upper)}</label>
  </div>
  <div class="RangeScale"${scaleAttrs}>
    <span class="track"></span>
    <span class="fill"></span>
    ${field('lower', idLower, state.lower)}
    ${field('upper', idUpper, state.upper)}
  </div>
</fieldset>
`
  return state.wrap ? state.wrap(markup) : markup
}

// ─── Shared shapes ────────────────────────────────────────────────────────────

const price = {
  legend: 'Price',
  lowerLabel: 'Lowest',
  upperLabel: 'Highest',
  suffix: 'tkr',
  min: 0,
  max: 1000,
  step: 10,
  lower: 200,
  upper: 700,
}

const states: StateDefinition[] = [
  // ── Interaction states ──────────────────────────────────────────────────────
  // The group has none of its own; these verify it does not swallow the fields'.
  { file: '_default', id: 'rg-default', ...price },
  { file: '_hover',   id: 'rg-hover',   ...price, field: { 'data-test-state': 'hover'  } },
  { file: '_focus',   id: 'rg-focus',   ...price, field: { 'data-test-state': 'focus'  } },
  { file: '_active',  id: 'rg-active',  ...price, field: { 'data-test-state': 'active' } },

  // ── Disabled — native cascades from the fieldset to both fields ─────────────
  { file: '_disabled', id: 'rg-disabled', ...price, group: { disabled: '' } },

  // ── Invalid ─────────────────────────────────────────────────────────────────
  { file: '_invalid', id: 'rg-invalid', ...price,
    scale: { 'data-invalid': 'true' },
    field: { 'data-invalid': 'true', 'aria-invalid': 'true' } },

  // ── Collided: both ends on the same value, where the thumbs overlap and the
  //    pointer needs arbitration. The keyboard never has this problem.
  { file: '_collided', id: 'rg-collided', rootId: 'rangegroup-collided', ...price,
    lower: 500, upper: 500 },

  // ── At the ends, where a clamp has nothing left to give ─────────────────────
  { file: '_at-min', id: 'rg-at-min', ...price, lower: 0, upper: 0 },
  { file: '_at-max', id: 'rg-at-max', ...price, lower: 1000, upper: 1000 },

  // ── Lane models — the span inherits the same choice a single lane has ───────
  { file: '_lane-flush', id: 'rg-lane-flush', rootId: 'rangegroup-flush', ...price,
    scale: { 'data-lane': 'flush' } },

  // ── With ticks: the stops and both ends read the same expression ────────────
  { file: '_with-ticks', id: 'rg-with-ticks', rootId: 'rangegroup-ticks', ...price,
    scale: { 'data-ticks': 'labels', 'data-lane': 'flush' } },

  // ── RTL: the lane's ends swap, and so do the role labels ───────────────────
  { file: '_rtl', id: 'rg-rtl', rootId: 'rangegroup-rtl', ...price,
    legend: 'السعر', lowerLabel: 'الأدنى', upperLabel: 'الأعلى',
    wrap: (m) => `<div dir="rtl">\n${m}</div>\n` },

  // ── Live demo (e2e test target) ─────────────────────────────────────────────
  { file: '_live', id: 'rg-live', rootId: 'rangegroup-live', ...price },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  writeFileSync(out(`${state.file}.hbs`), canonical(state))
  console.log(`  ${state.file}.hbs`)
}

// Native reference: two plain number inputs bounding the same span. Zero JS, no
// overlap, no clamping strategy, and the value can be typed — the honest answer
// when a span must be exact or is mostly filled in by keyboard.
writeFileSync(
  out('_native-numbers.hbs'),
  `<fieldset>
  <legend>Price</legend>
  <label for="rg-native-lower">Lowest price</label>
  <input type="number" id="rg-native-lower" name="rg-native-lower" min="0" max="1000" step="10" value="200" inputmode="numeric" />
  <label for="rg-native-upper">Highest price</label>
  <input type="number" id="rg-native-upper" name="rg-native-upper" min="0" max="1000" step="10" value="700" inputmode="numeric" />
</fieldset>
`,
)
console.log('  _native-numbers.hbs')

console.log(`done — ${states.length + 1} state files written`)

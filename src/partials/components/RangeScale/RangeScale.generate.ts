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
  id: string            // input id (also the label's for= and the output's for=)
  rootId?: string       // data-id on the scale — stable e2e/demo anchor
  label: string
  scale?: Attrs         // attributes on the .RangeScale root
  input?: Attrs         // attributes on the composed .RangeField
  output?: { suffix?: string; initial: string } | null
  /** Stops as [normalised position, label]. Labels are numeric by definition. */
  ticks?: [number, string][]
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
// Single source of truth for RangeScale HTML structure.
// Update this function when the component markup changes, then re-run this script.
//
// The lane is a grid STACK: .track, .fill and the composed RangeField all share
// one grid area, so the whole surface stays the input's hit target. Layer order
// is z-index, not document order — but authoring them back-to-front keeps the
// markup readable against the paint order.
//
// --_rs-p is server-rendered in the style attribute so the first paint is correct
// without JavaScript; RangeScale.ts then keeps it live. That is the only place a
// position is authored in this family, and it belongs to the LANE, never the field.

function canonical(state: StateDefinition): string {
  const p = (() => {
    const min = Number(state.input?.min ?? 0)
    const max = Number(state.input?.max ?? 100)
    const value = Number(state.input?.value ?? 0)
    return max === min ? 0 : (value - min) / (max - min)
  })()

  // The position MERGES into any authored style — an overwrite would silently
  // drop a state's own declarations (it dropped --_rs-inset and font-size once).
  const { style: authored, ...rest } = state.scale ?? {}
  const style = [`--_rs-p: ${p}`, authored].filter(Boolean).join('; ')

  const scaleAttrs = rootAttrs({
    'data-component': 'RangeScale',
    ...(state.rootId ? { 'data-id': state.rootId } : {}),
    ...rest,
    style,
  })

  // One element per stop, each carrying its own --p. The shared expression reads
  // it, so ticks and the fill are positioned by the same single formula.
  const ticksLine = state.ticks
    ? `\n  <span class="ticks" aria-hidden="true">${state.ticks
        .map(([p, label]) => `\n    <i style="--p: ${p}"><span>${label}</span></i>`)
        .join('')}\n  </span>`
    : ''

  const outputLine = state.output
    ? `\n  <output class="value" for="${state.id}"${
        state.output.suffix ? ` data-suffix="${state.output.suffix}"` : ''
      }>${state.output.initial}</output>`
    : ''

  return `<label for="${state.id}">${state.label}</label>
<div
  class="RangeScale"${scaleAttrs}
>
  <span class="track"></span>
  <span class="fill"></span>
  <input class="RangeField" type="range" id="${state.id}" name="${state.id}"${attrs(state.input ?? {})} />${ticksLine}${outputLine}
</div>
`
}

// ─── Shared shapes ────────────────────────────────────────────────────────────

const min = { min: '0', max: '100', step: '1', value: '0' }
const mid = { min: '0', max: '100', step: '1', value: '50' }
const pct = { suffix: '%', initial: '50 %' }

// Even stops. `step` must land on every one of them or the keyboard cannot reach
// a mark the eye can see — the unit test checks that for every state below.
const quarters: [number, string][] = [
  [0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1, '100'],
]
const stepped25 = { min: '0', max: '100', step: '25', value: '50' }

const states: StateDefinition[] = [
  // ── Interaction states — the lane has none of its own, but it must not swallow
  //    the field's, so each is rendered through the composed control. ──────────
  { file: '_min',        id: 'rs-min-default', label: 'Volume', input: min, output: { suffix: '%', initial: '0 %' } },
  { file: '_min-hover',  id: 'rs-min-hover',   label: 'Volume', input: { ...min, 'data-test-state': 'hover'  }, output: { suffix: '%', initial: '0 %' } },
  { file: '_min-focus',  id: 'rs-min-focus',   label: 'Volume', input: { ...min, 'data-test-state': 'focus'  }, output: { suffix: '%', initial: '0 %' } },
  { file: '_min-active', id: 'rs-min-active',  label: 'Volume', input: { ...min, 'data-test-state': 'active' }, output: { suffix: '%', initial: '0 %' } },

  { file: '_mid',        id: 'rs-mid-default', label: 'Volume', input: mid, output: pct },
  { file: '_mid-hover',  id: 'rs-mid-hover',   label: 'Volume', input: { ...mid, 'data-test-state': 'hover'  }, output: pct },
  { file: '_mid-focus',  id: 'rs-mid-focus',   label: 'Volume', input: { ...mid, 'data-test-state': 'focus'  }, output: pct },
  { file: '_mid-active', id: 'rs-mid-active',  label: 'Volume', input: { ...mid, 'data-test-state': 'active' }, output: pct },

  // ── Disabled — native on the input; the lane dims with it via the field ─────
  { file: '_disabled', id: 'rs-disabled', label: 'Volume', input: { ...mid, disabled: '' }, output: pct },

  // ── Invalid — data-invalid on BOTH the lane (it draws the track) and the
  //    field (it draws the thumb), plus aria-invalid on the control ────────────
  { file: '_invalid', id: 'rs-invalid', label: 'Volume',
    scale: { 'data-invalid': 'true' },
    input: { ...mid, 'data-invalid': 'true', 'aria-invalid': 'true' },
    output: pct },

  // ── Lane models — the documented choice ─────────────────────────────────────

  // inset (default): the thumb stays fully on the track, so the component's box
  // contains all of its own ink. Safe in a table cell or a tight grid.
  { file: '_lane-inset', id: 'rs-lane-inset', rootId: 'rangescale-inset', label: 'Volume (lane: inset)',
    scale: { 'data-lane': 'inset' }, input: mid, output: pct },

  // flush: the thumb's centre reaches the visible ends, so a scale's first and
  // last stop land exactly there — and the thumb OVERHANGS the box at min/max.
  { file: '_lane-flush', id: 'rs-lane-flush', rootId: 'rangescale-flush', label: 'Volume (lane: flush)',
    scale: { 'data-lane': 'flush' }, input: mid, output: pct },

  // flush at the extremes, where the overhang is visible and has to be planned for.
  { file: '_lane-flush-min', id: 'rs-lane-flush-min', label: 'At minimum',
    scale: { 'data-lane': 'flush' }, input: min, output: { suffix: '%', initial: '0 %' } },
  { file: '_lane-flush-max', id: 'rs-lane-flush-max', label: 'At maximum',
    scale: { 'data-lane': 'flush' }, input: { ...mid, value: '100' }, output: { suffix: '%', initial: '100 %' } },

  // A partial overhang: --_rs-inset is a length, not a switch. The named models
  // are two stops on it, and a design can sit anywhere between them.
  { file: '_lane-partial', id: 'rs-lane-partial', rootId: 'rangescale-partial', label: 'Volume (partial overhang)',
    scale: { style: '--_rs-inset: 0.25em' }, input: mid, output: pct },

  // ── Without an output: presence is the switch, so absence is a valid state ──
  { file: '_no-output', id: 'rs-no-output', rootId: 'rangescale-no-output', label: 'Volume (no readout)',
    input: { ...mid, 'aria-valuetext': '50 %' }, output: null },

  // ── Units — the whole lane scales with the local text ───────────────────────
  { file: '_text-scaled', id: 'rs-text-scaled', rootId: 'rangescale-text-scaled', label: 'Volume (font-size: 1.5rem)',
    scale: { style: 'font-size: 1.5rem' }, input: mid, output: pct },

  // ── Vertical — the fill is anchored in the same end as the slider's min ─────
  { file: '_vertical', id: 'rs-vertical', rootId: 'rangescale-vertical', label: 'Volume (vertical)',
    scale: { 'data-orientation': 'vertical' },
    input: { ...mid, 'data-orientation': 'vertical' }, output: null },
  { file: '_vertical-top', id: 'rs-vertical-top', rootId: 'rangescale-vertical-top', label: 'Depth (min at top)',
    scale: { 'data-orientation': 'vertical', 'data-min': 'top' },
    input: { ...mid, 'data-orientation': 'vertical', 'data-min': 'top' }, output: null },
  { file: '_vertical-flush', id: 'rs-vertical-flush', rootId: 'rangescale-vertical-flush', label: 'Volume (vertical, flush)',
    scale: { 'data-orientation': 'vertical', 'data-lane': 'flush' },
    input: { ...mid, 'data-orientation': 'vertical' }, output: null },

  // ── Ticks ───────────────────────────────────────────────────────────────────

  // marks: the stops are drawn, the labels are authored but not rendered — so
  // switching to labels is one attribute and never a markup change.
  { file: '_ticks-marks', id: 'rs-ticks-marks', rootId: 'rangescale-ticks-marks',
    label: 'Volume (ticks: marks)',
    scale: { 'data-ticks': 'marks' }, input: stepped25, output: pct, ticks: quarters },

  { file: '_ticks-labels', id: 'rs-ticks-labels', rootId: 'rangescale-ticks-labels',
    label: 'Volume (ticks: labels)',
    scale: { 'data-ticks': 'labels' }, input: stepped25, output: pct, ticks: quarters },

  // Ticks under the flush lane, where the first and last stop land exactly on the
  // visible ends — the reason the lane model exists at all.
  { file: '_ticks-flush', id: 'rs-ticks-flush', rootId: 'rangescale-ticks-flush',
    label: 'Volume (labels, flush lane)',
    scale: { 'data-ticks': 'labels', 'data-lane': 'flush' },
    input: stepped25, output: pct, ticks: quarters },

  // Uneven stops: per-element ticks handle these with the SAME expression, which
  // a repeating gradient cannot express at all.
  { file: '_ticks-uneven', id: 'rs-ticks-uneven', rootId: 'rangescale-ticks-uneven',
    label: 'Pressure (uneven stops)',
    scale: { 'data-ticks': 'labels' },
    input: { min: '0', max: '100', step: '10', value: '40' },
    output: { suffix: 'bar', initial: '40 bar' },
    ticks: [[0, '0'], [0.1, '10'], [0.3, '30'], [0.7, '70'], [1, '100']] },

  // ── Live demo (e2e test target) ─────────────────────────────────────────────
  { file: '_live', id: 'rs-live', rootId: 'rangescale-live', label: 'Volume', input: mid, output: pct },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  writeFileSync(out(`${state.file}.hbs`), canonical(state))
  console.log(`  ${state.file}.hbs`)
}

// RTL: the same lane under dir="rtl". The fill anchors to the right edge with no
// extra rule, because justify-self/inline-size are logical — the reason the
// horizontal half of the min-end rule is free and the vertical half is not.
writeFileSync(
  out('_rtl.hbs'),
  `<div dir="rtl">
${canonical({ file: '_rtl', id: 'rs-rtl', rootId: 'rangescale-rtl', label: 'الحجم', input: mid, output: { suffix: '%', initial: '50 %' } })}</div>
`,
)
console.log('  _rtl.hbs')

// Native reference. RangeScale needs its OWN copy rather than borrowing
// RangeField's: a partial with hardcoded ids can only appear once per page, and
// reusing it produced a duplicate #rf-native — which breaks label association
// and is invisible until something queries by id.
writeFileSync(
  out('_native.hbs'),
  `<label for="rs-native">Volume</label>
<input type="range" id="rs-native" name="rs-native" min="0" max="100" step="25" value="50" list="rs-native-ticks" />
<datalist id="rs-native-ticks">
  <option value="0"></option><option value="25"></option><option value="50"></option>
  <option value="75"></option><option value="100"></option>
</datalist>
`,
)
console.log('  _native.hbs')

console.log(`done — ${states.length + 2} state files written`)

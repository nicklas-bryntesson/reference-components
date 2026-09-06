/**
 * RangeScale — contract tests against the generated state partials.
 *
 * These protect the authored end state: the markup rules a consumer has to
 * reproduce when porting. Every one of them fails silently in a browser.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const statesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'states')
const allFiles = readdirSync(statesDir).filter((f) => f.endsWith('.hbs'))
const read = (f: string) => readFileSync(resolve(statesDir, f), 'utf8')

// The native reference is deliberately NOT a RangeScale — it is the unstyled
// control shown for comparison, so the per-lane rules do not apply to it.
const files = allFiles.filter((f) => read(f).includes('class="RangeScale"'))

// The attribute name must be preceded by whitespace, or `id` also matches inside
// `data-id` and `min` inside `data-min` — which silently reads the wrong value
// and produces NaN comparisons that look like real failures.
const attr = (html: string, name: string): string | null => {
  const m = html.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? m[1] : null
}

describe('RangeScale state partials', () => {
  it('generates the expected number of partials', () => {
    expect(allFiles.length).toBe(34)
    expect(files.length).toBe(33)
  })

  it('the native reference is NOT a RangeScale, and carries its own ids', () => {
    const native = read('_native.hbs')
    expect(native).toContain('type="range"')
    expect(native).not.toContain('class="RangeScale"')
    expect(native).not.toContain('rf-native')   // borrowing RangeField's duplicated an id
  })

  it.each(files)('%s — is a lane composing a RangeField', (file) => {
    const html = read(file)
    expect(html).toContain('class="RangeScale"')
    expect(html).toContain('data-component="RangeScale"')
    expect(html).toContain('class="RangeField"')
    expect(html).toContain('type="range"')
  })

  it.each(files)('%s — has exactly one track and one fill', (file) => {
    const html = read(file)
    expect(html.match(/data-part="track"/g)?.length).toBe(1)
    expect(html.match(/data-part="fill"/g)?.length).toBe(1)
  })

  it.each(files)('%s — label `for` matches the input `id`', (file) => {
    const html = read(file)
    expect(attr(html, 'for')).toBe(attr(html, 'id'))
  })

  /**
   * The rule that matters most. The lane's authored position is the only place a
   * position exists in this family, and it is invisible when wrong — the fill just
   * draws to the previous value.
   */
  it.each(files)('%s — --_rs-p agrees with value, min and max', (file) => {
    const html = read(file)
    const p = html.match(/--_rs-p:\s*([\d.]+)/)
    expect(p, 'every lane authors a position').not.toBeNull()

    const value = Number(attr(html, 'value'))
    const min = Number(attr(html, 'min'))
    const max = Number(attr(html, 'max'))
    expect(Number(p![1])).toBeCloseTo((value - min) / (max - min), 10)
  })

  /**
   * A generator that wrote `style` last dropped --_rs-inset and font-size once.
   * These two states exist to catch the regression, so assert they survived.
   */
  it('an authored style survives alongside the position', () => {
    expect(read('_lane-partial.hbs')).toMatch(/--_rs-p:[^"]*--_rs-inset:\s*0\.25em/)
    expect(read('_text-scaled.hbs')).toMatch(/--_rs-p:[^"]*font-size:\s*1\.5rem/)
  })

  it.each(files)('%s — never authors aria-valuemin/valuemax/valuenow', (file) => {
    expect(read(file)).not.toMatch(/aria-value(min|max|now)=/)
  })

  // This test used to assert the OPPOSITE and enforce the defect: it required
  // `aria-live` to be absent, on the assumption that absence means silence. A
  // bare <output> computes to role=status with live=polite, so absence is the one
  // state that guarantees announcing. Suppression has to be written down.
  it.each(files)('%s — the readout suppresses its implicit live region', (file) => {
    const html = read(file)
    if (!html.includes('<output')) return
    expect(html).toMatch(/<output[^>]*aria-live="off"/)
    // Still no explicit status role — the point is to quieten the implicit one,
    // not to add a second announcing surface.
    expect(html).not.toMatch(/role="status"/)
  })

  it('an output, when present, points at the input', () => {
    const withOutput = files.filter((f) => read(f).includes('<output'))
    expect(withOutput.length).toBeGreaterThan(0)
    for (const f of withOutput) {
      const html = read(f)
      const forRefs = [...html.matchAll(/for="([^"]+)"/g)].map((m) => m[1])
      // label[for] and output[for] both point at the same input id
      expect(new Set(forRefs).size).toBe(1)
      expect(forRefs[0]).toBe(attr(html, 'id'))
    }
  })

  it('orientation is authored on BOTH the lane and the field, and agrees', () => {
    for (const f of files) {
      const html = read(f)
      const laneVertical = /class="RangeScale"[\s\S]*?data-orientation="vertical"[\s\S]*?class="RangeField"/.test(html)
      const fieldVertical = /class="RangeField"[^>]*data-orientation="vertical"/.test(html)
      expect(laneVertical, `${f}: lane vs field orientation`).toBe(fieldVertical)
    }
  })

  it('data-min="top" only appears with a vertical orientation', () => {
    for (const f of files) {
      const html = read(f)
      if (html.includes('data-min="top"')) expect(html).toContain('data-orientation="vertical"')
    }
  })

  it('invalid states carry data-invalid on the lane AND the field, plus aria-invalid', () => {
    const invalid = files.filter((f) => read(f).includes('data-invalid'))
    expect(invalid.length).toBeGreaterThan(0)
    for (const f of invalid) {
      const html = read(f)
      expect(html.match(/data-invalid="true"/g)?.length, f).toBe(2)
      expect(html).toContain('aria-invalid="true"')
    }
  })

  it('lane models are the two documented values', () => {
    const lanes = files
      .map(read)
      .map((h) => attr(h, 'data-lane'))
      .filter(Boolean)
    expect(lanes.length).toBeGreaterThan(0)
    for (const lane of lanes) expect(['inset', 'flush']).toContain(lane)
  })

  it.each(files)('%s — authors no px lengths in its style', (file) => {
    const style = attr(read(file), 'style')
    if (!style) return
    expect(style).not.toMatch(/\d(px|pt)\b/)
  })

  /**
   * A mark the eye can see but the keyboard cannot reach is a trap: `step` has to
   * land on every authored stop. This is the rule that makes ticks safe to draw.
   */
  it('every tick stop is reachable in whole steps', () => {
    const withTicks = files.filter((f) => read(f).includes('data-part="ticks"'))
    expect(withTicks.length).toBeGreaterThan(0)

    for (const f of withTicks) {
      const html = read(f)
      const min = Number(attr(html, 'min'))
      const max = Number(attr(html, 'max'))
      const step = Number(attr(html, 'step'))
      const stops = [...html.matchAll(/--p:\s*([\d.]+)/g)].map((m) => Number(m[1]))
      expect(stops.length, f).toBeGreaterThan(1)

      for (const p of stops) {
        const value = min + p * (max - min)
        expect(Math.abs((value - min) % step), `${f}: stop at p=${p} → ${value}`).toBeCloseTo(0, 6)
      }
    }
  })

  it('tick containers are aria-hidden, and their labels are numeric', () => {
    const withTicks = files.filter((f) => read(f).includes('data-part="ticks"'))
    for (const f of withTicks) {
      const html = read(f)
      expect(html, f).toContain('<span class="ticks" data-part="ticks" aria-hidden="true">')
      const labels = [...html.matchAll(/<i style="--p: [\d.]+"><span>([^<]*)<\/span><\/i>/g)].map((m) => m[1])
      expect(labels.length, f).toBeGreaterThan(1)
      for (const label of labels) expect(label, `${f}: "${label}"`).toMatch(/^-?[\d.\s]+$/)
    }
  })

  it('the first and last stop are the ends of the range', () => {
    const withTicks = files.filter((f) => read(f).includes('data-part="ticks"'))
    for (const f of withTicks) {
      const stops = [...read(f).matchAll(/--p:\s*([\d.]+)/g)].map((m) => Number(m[1]))
      expect(Math.min(...stops), f).toBe(0)
      expect(Math.max(...stops), f).toBe(1)
    }
  })

  it('data-ticks is one of the two documented values', () => {
    const values = files.map(read).map((h) => attr(h, 'data-ticks')).filter(Boolean)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(['marks', 'labels']).toContain(v)
  })

  // ── Reference layer ─────────────────────────────────────────────────────────

  it('a reference layer authors both of its numbers', () => {
    const withRef = files.filter((f) => read(f).includes('data-part="reference"'))
    expect(withRef.length).toBeGreaterThan(0)
    for (const f of withRef) {
      const html = read(f)
      expect(html, f).toMatch(/--_rs-ref-from:\s*[\d.]+/)
      expect(html, f).toMatch(/--_rs-ref-to:\s*[\d.]+/)
      expect(html, f).toMatch(/data-reference="(region|band|marker)"/)
    }
  })

  it('the reference numbers are ordered and within the lane', () => {
    for (const f of files) {
      const html = read(f)
      const from = html.match(/--_rs-ref-from:\s*([\d.]+)/)
      const to = html.match(/--_rs-ref-to:\s*([\d.]+)/)
      if (!from || !to) continue
      const a = Number(from[1]), b = Number(to[1])
      expect(a, f).toBeGreaterThanOrEqual(0)
      expect(b, f).toBeLessThanOrEqual(1)
      expect(b, f).toBeGreaterThanOrEqual(a)
    }
  })

  it('a region starts at min, because that is what makes it a region', () => {
    const regions = files.filter((f) => read(f).includes('data-reference="region"'))
    expect(regions.length).toBeGreaterThan(0)
    for (const f of regions) {
      expect(read(f), f).toMatch(/--_rs-ref-from:\s*0\b/)
    }
  })

  it('a marker has no width', () => {
    const markers = files.filter((f) => read(f).includes('data-reference="marker"'))
    expect(markers.length).toBeGreaterThan(0)
    for (const f of markers) {
      const html = read(f)
      const from = Number(html.match(/--_rs-ref-from:\s*([\d.]+)/)![1])
      const to = Number(html.match(/--_rs-ref-to:\s*([\d.]+)/)![1])
      expect(to, f).toBe(from)
    }
  })

  /**
   * Colour must never be the only carrier (WCAG 1.4.1). A coloured layer without
   * words is exactly the failure only a screenreader user meets.
   */
  it('a colour-coded reference is always paired with a hint the field points at', () => {
    const coloured = files.filter((f) => read(f).includes('data-reference-variant'))
    expect(coloured.length).toBeGreaterThan(0)
    for (const f of coloured) {
      const html = read(f)
      expect(html, f).toContain('data-part="hint"')
      const hintId = html.match(/data-part="hint" id="([^"]+)"/)?.[1]
      expect(hintId, f).toBeTruthy()
      expect(html, f).toContain(`aria-describedby="${hintId}"`)
    }
  })

  it('the swatch is decoration, and the hint lives inside the lane', () => {
    const withHint = files.filter((f) => read(f).includes('data-part="hint"'))
    expect(withHint.length).toBeGreaterThan(0)
    for (const f of withHint) {
      const html = read(f)
      expect(html, f).toContain('<span class="swatch" data-part="swatch" aria-hidden="true"></span>')
      // inside the component, or the swatch cannot inherit the layer's colour
      const laneEnd = html.lastIndexOf('</div>')
      expect(html.indexOf('data-part="hint"'), f).toBeLessThan(laneEnd)
    }
  })

  it('reference variants are the four semantic tokens, not invented names', () => {
    const values = files.map(read).map((h) => attr(h, 'data-reference-variant')).filter(Boolean)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(['error', 'warning', 'success', 'info']).toContain(v)
  })

  it('reference layer positions are the three documented values', () => {
    const values = files.map(read).map((h) => attr(h, 'data-reference-layer')).filter(Boolean)
    for (const v of values) expect(['under', 'over', 'outside']).toContain(v)
  })

  it('ids are unique across all partials', () => {
    const ids = files.flatMap((f) => [...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

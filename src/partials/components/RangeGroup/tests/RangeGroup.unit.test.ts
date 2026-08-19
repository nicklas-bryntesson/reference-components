/**
 * RangeGroup — contract tests against the generated state partials.
 *
 * These protect the authored end state. The rules that matter most are the two
 * that are invisible when broken: that the ARIA span is NOT authored (it would go
 * stale on the first drag), and that both ends share one scale (two different
 * scales on one lane make the drawn span meaningless).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const statesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'states')
const allFiles = readdirSync(statesDir).filter((f) => f.endsWith('.hbs'))
const read = (f: string) => readFileSync(resolve(statesDir, f), 'utf8')

// The native reference is deliberately not a RangeGroup.
const files = allFiles.filter((f) => read(f).includes('class="RangeGroup"'))

const field = (html: string, role: 'lower' | 'upper'): string => {
  const m = html.match(new RegExp(`<input[^>]*data-role="${role}"[^>]*>`))
  return m ? m[0] : ''
}
const attrOf = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? m[1] : null
}

describe('RangeGroup state partials', () => {
  it('generates the expected number of partials', () => {
    expect(allFiles.length).toBe(14)
    expect(files.length).toBe(13)
  })

  it.each(files)('%s — is a fieldset whose first child is the legend', (file) => {
    const html = read(file)
    expect(html).toContain('<fieldset')
    // The legend must precede everything else inside the fieldset.
    const legend = html.indexOf('<legend>')
    const roles = html.indexOf('class="roles"')
    expect(legend).toBeGreaterThan(-1)
    expect(legend).toBeLessThan(roles)
  })

  it.each(files)('%s — has exactly two fields, one per role', (file) => {
    const html = read(file)
    expect(html.match(/data-role="lower"/g)?.length, 'lower').toBe(1)
    expect(html.match(/data-role="upper"/g)?.length, 'upper').toBe(1)
    expect(html.match(/class="RangeField"/g)?.length, 'fields').toBe(2)
  })

  it.each(files)('%s — every field has its own label', (file) => {
    const html = read(file)
    for (const role of ['lower', 'upper'] as const) {
      const id = attrOf(field(html, role), 'id')
      expect(id, role).toBeTruthy()
      expect(html, `${role} label`).toContain(`for="${id}"`)
    }
  })

  /**
   * Two different scales on one lane would make the drawn span meaningless: the
   * same pixel would mean two different values.
   */
  it.each(files)('%s — both ends share min, max and step', (file) => {
    const html = read(file)
    const lo = field(html, 'lower')
    const hi = field(html, 'upper')
    for (const name of ['min', 'max', 'step']) {
      expect(attrOf(lo, name), name).toBe(attrOf(hi, name))
    }
  })

  it.each(files)('%s — the lower value never exceeds the upper', (file) => {
    const html = read(file)
    expect(Number(attrOf(field(html, 'lower'), 'value')))
      .toBeLessThanOrEqual(Number(attrOf(field(html, 'upper'), 'value')))
  })

  /**
   * The ARIA span is a statement about the pair at a moment in time. Authored, it
   * is a second source of truth that goes stale on the first drag.
   */
  it.each(files)('%s — the ARIA span is not authored', (file) => {
    const html = read(file)
    expect(html).not.toMatch(/aria-valuemin=/)
    expect(html).not.toMatch(/aria-valuemax=/)
    expect(html).not.toMatch(/aria-valuetext=/)
    expect(html).not.toMatch(/aria-valuenow=/)
  })

  it.each(files)('%s — the lane is told it holds two controls', (file) => {
    const html = read(file)
    expect(html).toContain('data-fields="2"')
    expect(html).toContain('data-component="RangeScale"')
    expect(html).toContain('data-component="RangeGroup"')
  })

  /**
   * The positions are server-rendered so the first paint is correct without JS,
   * which means they have to agree with the values.
   */
  it.each(files)('%s — --_rs-a and --_rs-b agree with the two values', (file) => {
    const html = read(file)
    const lo = field(html, 'lower')
    const hi = field(html, 'upper')
    const min = Number(attrOf(lo, 'min'))
    const max = Number(attrOf(hi, 'max'))
    const p = (v: number) => (max === min ? 0 : (v - min) / (max - min))

    const a = Number(html.match(/--_rs-a:\s*([\d.]+)/)![1])
    const b = Number(html.match(/--_rs-b:\s*([\d.]+)/)![1])
    expect(a).toBeCloseTo(p(Number(attrOf(lo, 'value'))), 10)
    expect(b).toBeCloseTo(p(Number(attrOf(hi, 'value'))), 10)
    expect(a).toBeLessThanOrEqual(b)
  })

  it.each(files)('%s — both values are reachable in whole steps', (file) => {
    const html = read(file)
    for (const role of ['lower', 'upper'] as const) {
      const tag = field(html, role)
      const step = Number(attrOf(tag, 'step'))
      const offset = Number(attrOf(tag, 'value')) - Number(attrOf(tag, 'min'))
      expect(offset % step, `${role}`).toBe(0)
    }
  })

  it('disabled sits on the fieldset, not on the fields', () => {
    const disabled = files.filter((f) => read(f).includes('disabled'))
    expect(disabled.length).toBeGreaterThan(0)
    for (const f of disabled) {
      const html = read(f)
      expect(html, f).toMatch(/<fieldset[^>]*\n?\s*disabled/)
      // The attribute, not the substring: `id="rg-disabled-lower"` contains it too.
      const standalone = /\sdisabled(?=[\s/>=])/
      expect(standalone.test(field(html, 'lower')), f).toBe(false)
      expect(standalone.test(field(html, 'upper')), f).toBe(false)
    }
  })

  it('invalid marks the lane and both fields, and pairs with aria-invalid', () => {
    const invalid = files.filter((f) => read(f).includes('data-invalid'))
    expect(invalid.length).toBeGreaterThan(0)
    for (const f of invalid) {
      const html = read(f)
      expect(html.match(/data-invalid="true"/g)?.length, f).toBe(3)  // lane + two fields
      expect(html.match(/aria-invalid="true"/g)?.length, f).toBe(2)
    }
  })

  it('there is no data-clamp: hard stop is the only strategy', () => {
    for (const f of allFiles) expect(read(f), f).not.toContain('data-clamp')
  })

  it('ids are unique across all partials', () => {
    const ids = allFiles.flatMap((f) => [...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the native reference is two number inputs, not a RangeGroup', () => {
    const native = read('_native-numbers.hbs')
    expect(native).not.toContain('class="RangeGroup"')
    expect(native.match(/type="number"/g)?.length).toBe(2)
    expect(native).toContain('<legend>')
  })
})

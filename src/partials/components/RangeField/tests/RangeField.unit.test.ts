/**
 * RangeField — contract tests against the generated state partials.
 *
 * RangeField has no JavaScript, so there is no behaviour to unit-test. What
 * these tests protect is the AUTHORED END STATE: the markup rules a consumer
 * has to reproduce when porting. Every one of them fails silently in a browser.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const statesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'states')

const files = readdirSync(statesDir).filter((f) => f.endsWith('.hbs'))
const read = (f: string) => readFileSync(resolve(statesDir, f), 'utf8')

// Every partial that renders a RangeField — excludes the bare <datalist> and the
// native reference, neither of which is the component.
const fieldFiles = files.filter((f) => read(f).includes('class="RangeField"'))

const attr = (html: string, name: string): string | null => {
  const m = html.match(new RegExp(`${name}="([^"]*)"`))
  return m ? m[1] : null
}

describe('RangeField state partials', () => {
  it('generates the expected number of partials', () => {
    expect(files.length).toBe(22)
    expect(fieldFiles.length).toBe(20)
  })

  it.each(fieldFiles)('%s — is a native range input', (file) => {
    expect(read(file)).toContain('type="range"')
  })

  it.each(fieldFiles)('%s — label `for` matches the input `id`', (file) => {
    const html = read(file)
    expect(attr(html, 'for')).toBe(attr(html, 'id'))
  })

  it.each(fieldFiles)('%s — carries data-component="RangeField"', (file) => {
    expect(read(file)).toContain('data-component="RangeField"')
  })

  /**
   * There is no authored position variable and no style-attribute state to drift:
   * the browser positions the thumb from `value`. Assert that stays true, because
   * re-introducing an authored fill position is exactly the mistake to catch.
   */
  it.each(fieldFiles)('%s — authors no fill position', (file) => {
    expect(read(file)).not.toContain('--_rf-p')
  })

  it.each(fieldFiles)('%s — never authors aria-valuemin/valuemax/valuenow', (file) => {
    expect(read(file)).not.toMatch(/aria-value(min|max|now)=/)
  })

  it.each(fieldFiles)('%s — has no aria-label competing with the <label>', (file) => {
    const html = read(file)
    expect(html).not.toMatch(/aria-label=/)
    expect(html).not.toMatch(/aria-labelledby=/)
  })

  it.each(fieldFiles)('%s — step divides the range into whole steps', (file) => {
    const html = read(file)
    const step = attr(html, 'step')
    if (!step) return
    const span = Number(attr(html, 'max')) - Number(attr(html, 'min'))
    expect(span % Number(step)).toBe(0)
  })

  it.each(fieldFiles)('%s — value is reachable from min in whole steps', (file) => {
    const html = read(file)
    const step = attr(html, 'step')
    if (!step) return
    const offset = Number(attr(html, 'value')) - Number(attr(html, 'min'))
    expect(offset % Number(step)).toBe(0)
  })

  it('invalid states pair data-invalid with aria-invalid', () => {
    const invalid = fieldFiles.filter((f) => read(f).includes('data-invalid="true"'))
    expect(invalid.length).toBeGreaterThan(0)
    for (const f of invalid) expect(read(f)).toContain('aria-invalid="true"')
  })

  it('every aria-describedby target exists in the same partial', () => {
    for (const f of fieldFiles) {
      const html = read(f)
      const ref = attr(html, 'aria-describedby')
      if (!ref) continue
      for (const id of ref.split(/\s+/)) expect(html).toContain(`id="${id}"`)
    }
  })

  it('data-min="top" only appears together with a vertical orientation', () => {
    for (const f of fieldFiles) {
      const html = read(f)
      if (html.includes('data-min="top"')) {
        expect(html).toContain('data-orientation="vertical"')
      }
    }
  })

  it('ids are unique across all partials', () => {
    const ids = fieldFiles.flatMap((f) => [...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a datalist reference resolves to a rendered datalist', () => {
    const withList = fieldFiles.filter((f) => read(f).includes('list='))
    expect(withList.length).toBeGreaterThan(0)
    const allHtml = files.map(read).join('\n')
    for (const f of withList) {
      const id = attr(read(f), 'list')!
      expect(allHtml).toContain(`<datalist id="${id}">`)
    }
  })

  /**
   * Units are relative so the control scales with the text. px in an authored
   * style attribute would pin it, which is the mistake this catches.
   */
  it.each(fieldFiles)('%s — authors no px lengths', (file) => {
    const style = attr(read(file), 'style')
    if (!style) return
    expect(style).not.toMatch(/\d(px|pt)\b/)
  })

  it('the native reference is NOT a RangeField', () => {
    const native = read('_native.hbs')
    expect(native).toContain('type="range"')
    expect(native).not.toContain('class="RangeField"')
  })
})

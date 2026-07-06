// src/partials/components/AffixField/tests/AffixField.unit.test.ts
//
// jsdom — no layout, and none is needed: the character-count model is pure
// string arithmetic, so every assertion here is exact. Covered: id generation,
// describedby merge order, the aria-hidden override, presence attributes,
// character counts, the gap-fill no-op guarantee, and attach/destroy.
import { describe, it, expect, afterEach } from 'vitest'
import AffixField, { mergeTokenList } from '../AffixField'

// ─── Pure utilities ──────────────────────────────────────────────────────────

describe('mergeTokenList', () => {
  it('appends additions after existing entries', () => {
    expect(mergeTokenList('hint-id', ['a-prefix', 'a-suffix'])).toBe('hint-id a-prefix a-suffix')
  })
  it('handles a null existing list', () => {
    expect(mergeTokenList(null, ['a-prefix'])).toBe('a-prefix')
  })
  it('never duplicates ids already present', () => {
    expect(mergeTokenList('hint a-prefix', ['a-prefix', 'a-suffix'])).toBe('hint a-prefix a-suffix')
  })
  it('normalizes extra whitespace in the existing list', () => {
    expect(mergeTokenList('  hint   other ', ['a-suffix'])).toBe('hint other a-suffix')
  })
})

// ─── DOM helper ──────────────────────────────────────────────────────────────

interface FixtureOptions {
  rootAttrs?: Record<string, string>
  inputAttrs?: Record<string, string>
  prefix?: { text: string; attrs?: Record<string, string> } | null
  suffix?: { text: string; attrs?: Record<string, string> } | null
}

function createAffixFieldEl(options: FixtureOptions = {}): HTMLElement {
  const el = document.createElement('div')
  el.className = 'AffixField'
  el.setAttribute('data-component', 'AffixField')
  for (const [k, v] of Object.entries(options.rootAttrs ?? {})) {
    el.setAttribute(k, v)
  }

  const affix = (kind: 'prefix' | 'suffix', spec: FixtureOptions['prefix']) => {
    if (!spec) return null
    const span = document.createElement('span')
    span.className = `AffixField-${kind}`
    span.textContent = spec.text
    for (const [k, v] of Object.entries(spec.attrs ?? {})) span.setAttribute(k, v)
    return span
  }

  const input = document.createElement('input')
  input.className = 'AffixField-input'
  input.type = 'text'
  for (const [k, v] of Object.entries(options.inputAttrs ?? {})) {
    input.setAttribute(k, v)
  }

  // Default fixture: $ <input> USD — pass prefix/suffix: null to omit a side.
  const prefixEl = affix('prefix', options.prefix === undefined ? { text: '$' } : options.prefix)
  const suffixEl = affix('suffix', options.suffix === undefined ? { text: 'USD' } : options.suffix)

  if (prefixEl) el.appendChild(prefixEl)
  el.appendChild(input)
  if (suffixEl) el.appendChild(suffixEl)

  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

const input = (el: HTMLElement) => el.querySelector<HTMLInputElement>('.AffixField-input')!
const prefixOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.AffixField-prefix')
const suffixOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.AffixField-suffix')

// ─── Id generation ───────────────────────────────────────────────────────────

describe('affix id generation', () => {
  it('derives affix ids from the input id', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-1' } })
    AffixField.attach()
    expect(prefixOf(el)!.id).toBe('af-1-prefix')
    expect(suffixOf(el)!.id).toBe('af-1-suffix')
  })

  it('falls back to a generated instance id when the input has no id', () => {
    const el = createAffixFieldEl()
    AffixField.attach()
    const prefixId = prefixOf(el)!.id
    const suffixId = suffixOf(el)!.id
    expect(prefixId).toMatch(/^af-[a-z0-9]+-prefix$/)
    expect(suffixId).toMatch(/^af-[a-z0-9]+-suffix$/)
    // Both affixes share the same generated base.
    expect(prefixId.replace(/-prefix$/, '')).toBe(suffixId.replace(/-suffix$/, ''))
    // The input itself is left without an id — gap-fill only mints affix ids.
    expect(input(el).id).toBe('')
  })

  it('keeps an authored affix id and references it instead of minting one', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-2' },
      suffix: { text: 'USD', attrs: { id: 'custom-suffix-id' } },
    })
    AffixField.attach()
    expect(suffixOf(el)!.id).toBe('custom-suffix-id')
    expect(input(el).getAttribute('aria-describedby')).toBe('af-2-prefix custom-suffix-id')
  })
})

// ─── describedby merge ───────────────────────────────────────────────────────

describe('aria-describedby merge', () => {
  it('sets describedby to prefix then suffix when nothing is authored', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-3' } })
    AffixField.attach()
    expect(input(el).getAttribute('aria-describedby')).toBe('af-3-prefix af-3-suffix')
  })

  it('appends affix ids AFTER existing hint/error entries', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-4', 'aria-describedby': 'hint-id error-id' },
    })
    AffixField.attach()
    expect(input(el).getAttribute('aria-describedby')).toBe('hint-id error-id af-4-prefix af-4-suffix')
  })

  it('only wires the sides that exist', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-5' }, prefix: null })
    AffixField.attach()
    expect(input(el).getAttribute('aria-describedby')).toBe('af-5-suffix')
  })

  it('does not duplicate an affix id already referenced in describedby', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-6', 'aria-describedby': 'af-6-suffix' },
      suffix: { text: 'USD', attrs: { id: 'af-6-suffix' } },
    })
    AffixField.attach()
    expect(input(el).getAttribute('aria-describedby')).toBe('af-6-suffix af-6-prefix')
  })

  it('leaves describedby alone when aria-labelledby already references the affix ids', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-7', 'aria-labelledby': 'af-7-label af-7-prefix af-7-suffix' },
      prefix: { text: '$', attrs: { id: 'af-7-prefix' } },
      suffix: { text: 'USD', attrs: { id: 'af-7-suffix' } },
    })
    AffixField.attach()
    expect(input(el).hasAttribute('aria-describedby')).toBe(false)
  })
})

// ─── aria-hidden override ────────────────────────────────────────────────────

describe('aria-hidden override', () => {
  it('skips an aria-hidden affix entirely — no id, no reference', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-8' },
      prefix: null,
      suffix: { text: 'timmar', attrs: { 'aria-hidden': 'true' } },
    })
    AffixField.attach()
    expect(suffixOf(el)!.id).toBe('')
    expect(input(el).hasAttribute('aria-describedby')).toBe(false)
  })

  it('still wires the visible affix when the other one is aria-hidden', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-9' },
      suffix: { text: 'timmar', attrs: { 'aria-hidden': 'true' } },
    })
    AffixField.attach()
    expect(input(el).getAttribute('aria-describedby')).toBe('af-9-prefix')
  })
})

// ─── Character counts (end-state contract) ───────────────────────────────────
// Fully deterministic in jsdom: counts are string lengths, not layout.

describe('affix character counts', () => {
  it('gap-fills --af-prefix-chars / --af-suffix-chars from the affix string lengths', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-c1' } }) // "$" / "USD"
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-prefix-chars')).toBe('1')
    expect(el.style.getPropertyValue('--af-suffix-chars')).toBe('3')
  })

  it('trims surrounding whitespace before counting', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-c2' },
      prefix: null,
      suffix: { text: '  kr  ' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-suffix-chars')).toBe('2')
    expect(el.style.getPropertyValue('--af-prefix-chars')).toBe('')
  })

  it('an authored count always wins — including a fractional tuning value', () => {
    const el = createAffixFieldEl({
      rootAttrs: { style: '--af-prefix-chars: 3.5' }, // "WWW" runs wide
      inputAttrs: { id: 'af-c3' },
      prefix: { text: 'WWW' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-prefix-chars').trim()).toBe('3.5')
  })

  it('authoring is per side — an authored prefix count leaves the suffix gap-fill intact', () => {
    const el = createAffixFieldEl({
      rootAttrs: { style: '--af-prefix-chars: 1.5' },
      inputAttrs: { id: 'af-c4' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-prefix-chars').trim()).toBe('1.5')
    expect(el.style.getPropertyValue('--af-suffix-chars')).toBe('3') // "USD"
  })

  it('counts an aria-hidden affix too (visual, not ARIA, data)', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-c5' },
      prefix: null,
      suffix: { text: 'timmar', attrs: { 'aria-hidden': 'true' } },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-suffix-chars')).toBe('6')
  })
})

// ─── data-input-characters ───────────────────────────────────────────────────

describe('data-input-characters', () => {
  it('maps the attribute to --af-input-chars on the root', () => {
    const el = createAffixFieldEl({
      rootAttrs: { 'data-input-characters': '4' },
      inputAttrs: { id: 'af-10' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-input-chars')).toBe('4')
  })

  it('never overwrites an authored --af-input-chars', () => {
    const el = createAffixFieldEl({
      rootAttrs: { 'data-input-characters': '4', style: '--af-input-chars: 6' },
      inputAttrs: { id: 'af-11' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-input-chars').trim()).toBe('6')
  })

  it('ignores a non-numeric value', () => {
    const el = createAffixFieldEl({
      rootAttrs: { 'data-input-characters': 'wide' },
      inputAttrs: { id: 'af-12' },
    })
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-input-chars')).toBe('')
  })
})

// ─── data-has-prefix / data-has-suffix presence (end-state contract) ─────────

describe('affix presence attributes', () => {
  it('gap-fills data-has-prefix="true" and data-has-suffix="true" from affix presence', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-p1' } })
    AffixField.attach()
    expect(el.getAttribute('data-has-prefix')).toBe('true')
    expect(el.getAttribute('data-has-suffix')).toBe('true')
  })

  it('only sets the attribute for the side that exists', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-p2' }, prefix: null })
    AffixField.attach()
    expect(el.hasAttribute('data-has-prefix')).toBe(false)
    expect(el.getAttribute('data-has-suffix')).toBe('true')
  })

  it('sets the attribute even for an aria-hidden affix (visual, not ARIA, data)', () => {
    const el = createAffixFieldEl({
      inputAttrs: { id: 'af-p3' },
      prefix: null,
      suffix: { text: 'timmar', attrs: { 'aria-hidden': 'true' } },
    })
    AffixField.attach()
    expect(el.getAttribute('data-has-suffix')).toBe('true')
  })

  it('never touches an authored presence attribute', () => {
    const el = createAffixFieldEl({
      rootAttrs: { 'data-has-prefix': 'server', 'data-has-suffix': '' },
      inputAttrs: { id: 'af-p4' },
    })
    AffixField.attach()
    expect(el.getAttribute('data-has-prefix')).toBe('server')
    expect(el.getAttribute('data-has-suffix')).toBe('')
  })
})

// ─── Gap-fill no-op guarantee (idempotency against a server end-state) ───────

describe('fully-authored fixture', () => {
  function createAuthoredEl(): HTMLElement {
    return createAffixFieldEl({
      rootAttrs: {
        'data-has-prefix': 'true',
        'data-has-suffix': 'true',
        style: '--af-prefix-chars: 1; --af-suffix-chars: 3;',
      },
      inputAttrs: {
        id: 'af-authored',
        'aria-describedby': 'af-authored-prefix af-authored-suffix',
      },
      prefix: { text: '$', attrs: { id: 'af-authored-prefix' } },
      suffix: { text: 'USD', attrs: { id: 'af-authored-suffix' } },
    })
  }

  it('JS changes NOTHING except data-initialized', () => {
    const el = createAuthoredEl()
    const before = el.outerHTML
    AffixField.attach()
    expect(el.getAttribute('data-initialized')).toBe('true')
    el.removeAttribute('data-initialized')
    expect(el.outerHTML).toBe(before)
  })

  it('keeps the authored counts verbatim', () => {
    const el = createAuthoredEl()
    AffixField.attach()
    expect(el.style.getPropertyValue('--af-prefix-chars').trim()).toBe('1')
    expect(el.style.getPropertyValue('--af-suffix-chars').trim()).toBe('3')
  })
})

// ─── attach / destroy ────────────────────────────────────────────────────────

describe('AffixField.attach', () => {
  it('instantiates on elements with data-component="AffixField"', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-13' } })
    AffixField.attach()
    expect((el as any).__affixFieldInstance).toBeInstanceOf(AffixField)
    expect(el.getAttribute('data-initialized')).toBe('true')
  })

  it('does not re-instantiate already attached elements', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-14' } })
    AffixField.attach()
    const first = (el as any).__affixFieldInstance
    AffixField.attach()
    expect((el as any).__affixFieldInstance).toBe(first)
  })

  it('is idempotent on the wiring too — a second attach never duplicates ids', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-15' } })
    AffixField.attach()
    const instance = (el as any).__affixFieldInstance
    instance.destroy()
    AffixField.attach() // re-attach over already-wired markup: pure gap-fill, nothing to do
    expect(input(el).getAttribute('aria-describedby')).toBe('af-15-prefix af-15-suffix')
  })

  it('scopes to the given parent', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-16' } })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    AffixField.attach(outside)
    expect((el as any).__affixFieldInstance).toBeUndefined()
  })
})

describe('destroy', () => {
  it('clears the instance guard so attach can mount again', () => {
    const el = createAffixFieldEl({ inputAttrs: { id: 'af-17' } })
    AffixField.attach()
    const first = (el as any).__affixFieldInstance
    first.destroy()
    expect((el as any).__affixFieldInstance).toBeUndefined()
    AffixField.attach()
    expect((el as any).__affixFieldInstance).toBeInstanceOf(AffixField)
    expect((el as any).__affixFieldInstance).not.toBe(first)
  })
})

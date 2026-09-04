import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ChoiceGroup adds no JS — it is markup + CSS. The unit layer guards the
// wrapper-contract invariants: <legend> is the first child (the only intrinsic
// group label), the Options wrapper exists, for/id integrity across the fields,
// unique ids, one shared name per radio group, and every aria-describedby
// resolves to a real element (a dangling describedby is silently no-op).
const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ChoiceGroup.html'),
  'utf-8',
)

describe('ChoiceGroup reference markup contract', () => {
  beforeEach(() => {
    document.body.innerHTML = html
  })

  const groups = () => [...document.querySelectorAll('.ChoiceGroup')]

  it('is a <fieldset> whose first element child is a non-empty <legend>', () => {
    const gs = groups()
    expect(gs.length).toBeGreaterThan(0)
    for (const g of gs) {
      expect(g.tagName).toBe('FIELDSET')
      const first = g.firstElementChild
      expect(first?.tagName, 'legend must be the first child of fieldset').toBe('LEGEND')
      expect(first!.textContent!.trim().length, 'legend must not be empty').toBeGreaterThan(0)
    }
  })

  it('each group has an options wrapper holding its fields', () => {
    for (const g of groups()) {
      const options = g.querySelector('[data-part="options"]')
      expect(options, 'missing options wrapper').not.toBeNull()
      expect(options!.querySelectorAll('.ChoiceField input').length).toBeGreaterThan(0)
    }
  })

  it('for/id integrity and unique ids across all fields', () => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.ChoiceField input')]
    for (const input of inputs) {
      expect(input.id).toBeTruthy()
      expect(document.querySelector(`label[for="${input.id}"]`), `no label for ${input.id}`).not.toBeNull()
    }
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size, `duplicate id in: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('radios within a group share exactly one name (single-selection)', () => {
    for (const g of groups()) {
      const radios = [...g.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      if (radios.length < 2) continue
      const names = new Set(radios.map((r) => r.name))
      expect(names.size, `group "${g.querySelector('legend')?.textContent}" must share one name`).toBe(1)
    }
  })

  it('every aria-describedby target exists in the DOM', () => {
    for (const g of groups()) {
      const ref = g.getAttribute('aria-describedby')
      if (!ref) continue
      for (const id of ref.split(/\s+/)) {
        expect(document.getElementById(id), `aria-describedby="${id}" has no target`).not.toBeNull()
      }
    }
  })

  it('a data-legend value is always one of the known recipes', () => {
    for (const g of groups()) {
      const v = g.getAttribute('data-legend')
      expect(['above', 'beside', 'hidden', null]).toContain(v)
    }
  })
})

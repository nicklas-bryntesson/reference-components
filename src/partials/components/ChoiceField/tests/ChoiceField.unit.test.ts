import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// No JS logic to unit-test — native carries the behaviour (ADR-0013), and the
// native `type` is the discriminator (ADR-0015). What the unit layer CAN and
// must guard are the markup-contract invariants native cannot self-enforce:
// for/id integrity, id uniqueness, a resolvable label per control, and the
// radio-only rule that a single-selection group is exactly one shared `name`.
const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ChoiceField.html'),
  'utf-8',
)

describe('ChoiceField reference markup contract', () => {
  beforeEach(() => {
    document.body.innerHTML = html
  })

  it('every control resolves to a <label> via for/id', () => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.ChoiceField input')]
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input.id, 'control is missing an id').toBeTruthy()
      const label = document.querySelector(`label[for="${input.id}"]`)
      expect(label, `no <label for="${input.id}">`).not.toBeNull()
    }
  })

  it('all ids on the page fragment are unique (for/id breaks on duplicates)', () => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size, `duplicate id in: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('every control is a native radio or checkbox (type is the discriminator)', () => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.ChoiceField input')]
    for (const input of inputs) {
      expect(['radio', 'checkbox']).toContain(input.getAttribute('type'))
    }
    // both types are actually exercised
    expect(document.querySelector('.ChoiceField input[type="radio"]')).not.toBeNull()
    expect(document.querySelector('.ChoiceField input[type="checkbox"]')).not.toBeNull()
  })

  it('the live radio demo is one group — every option shares a single name', () => {
    const group = [...document.querySelectorAll<HTMLInputElement>('#cf-live-radio input[type="radio"]')]
    expect(group.length).toBeGreaterThan(1)
    const names = new Set(group.map((r) => r.name))
    expect(names.size, 'a single-selection group must share exactly one name').toBe(1)
    expect(document.querySelectorAll('#cf-live-radio input:checked').length).toBe(1)
  })
})

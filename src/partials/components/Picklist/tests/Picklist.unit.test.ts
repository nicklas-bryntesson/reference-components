import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Picklist adds no JS — it is markup + CSS. The unit layer guards the
// contract invariants native cannot self-enforce, parsed from the component's
// own kitchensink: the fieldset/legend wrapper rules it inherits from the
// selection family, plus the chip rules that are specific to Picklist (the
// clipped input must have an adjacent label, and the removable × must be a
// decorative glyph inside that label — never in a radio option, which cannot
// be deselected).
const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../Picklist.html'),
  'utf-8',
)

describe('Picklist reference markup contract', () => {
  beforeEach(() => {
    document.body.innerHTML = html
  })

  const lists = () => [...document.querySelectorAll('.Picklist')]

  it('is a <fieldset> whose first element child is a non-empty <legend>', () => {
    const ls = lists()
    expect(ls.length).toBeGreaterThan(0)
    for (const l of ls) {
      expect(l.tagName).toBe('FIELDSET')
      const first = l.firstElementChild
      expect(first?.tagName, 'legend must be the first child of fieldset').toBe('LEGEND')
      expect(first!.textContent!.trim().length, 'legend must not be empty').toBeGreaterThan(0)
    }
  })

  it('each list has a .content wrapper and an .options wrapper holding chips', () => {
    for (const l of lists()) {
      expect(l.querySelector('.content'), 'missing .content wrapper').not.toBeNull()
      const options = l.querySelector('.options')
      expect(options, 'missing .options wrapper').not.toBeNull()
      expect(options!.querySelectorAll('.option input').length).toBeGreaterThan(0)
    }
  })

  it('every chip is an input immediately followed by its label (the sibling contract)', () => {
    // The whole visual model rests on `input + label`: the chip surface is the
    // adjacent label, so selected/focus states are plain sibling selectors and
    // never need :has(). Any element between them silently breaks the styling.
    const chips = [...document.querySelectorAll('.Picklist .option')]
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      const input = chip.querySelector('input')
      expect(input, 'chip has no input').not.toBeNull()
      const next = input!.nextElementSibling
      expect(next?.tagName, `chip "${chip.textContent?.trim()}": label must directly follow the input`).toBe('LABEL')
      expect(next!.getAttribute('for'), 'chip label must be wired with for=').toBe(input!.id)
    }
  })

  it('for/id integrity and unique ids across all chips', () => {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.Picklist .option input')]
    for (const input of inputs) {
      expect(input.id).toBeTruthy()
      expect(document.querySelector(`label[for="${input.id}"]`), `no label for ${input.id}`).not.toBeNull()
    }
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size, `duplicate id in: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('exercises both cardinalities — radio (single) and checkbox (multi) cores', () => {
    expect(document.querySelectorAll('.Picklist .option input[type="radio"]').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.Picklist .option input[type="checkbox"]').length).toBeGreaterThan(0)
  })

  it('radios within a list share exactly one name, with at most one checked', () => {
    for (const l of lists()) {
      const radios = [...l.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      if (radios.length < 2) continue
      const legend = l.querySelector('legend')?.textContent
      const names = new Set(radios.map((r) => r.name))
      expect(names.size, `list "${legend}" must share one name`).toBe(1)
      const checked = radios.filter((r) => r.hasAttribute('checked'))
      expect(checked.length, `list "${legend}" must not preselect two radios`).toBeLessThanOrEqual(1)
    }
  })

  it('every aria-describedby target exists in the DOM', () => {
    for (const l of lists()) {
      const ref = l.getAttribute('aria-describedby')
      if (!ref) continue
      for (const id of ref.split(/\s+/)) {
        expect(document.getElementById(id), `aria-describedby="${id}" has no target`).not.toBeNull()
      }
    }
  })

  it('a data-legend value is always one of the known recipes', () => {
    for (const l of lists()) {
      const v = l.getAttribute('data-legend')
      expect(['above', 'beside', 'hidden', null]).toContain(v)
    }
  })

  // ── Removable chips ───────────────────────────────────────────────────
  // The × deselects by living inside the label: clicking it activates the
  // label, which toggles the input. That only works if it is INSIDE the
  // label, and it only stays out of the accessible name if it is aria-hidden.

  it('has at least one removable chip in the kitchensink', () => {
    expect(document.querySelectorAll('.Picklist .deselect').length).toBeGreaterThan(0)
  })

  it('every .deselect glyph is aria-hidden and sits inside the chip label', () => {
    for (const glyph of document.querySelectorAll('.Picklist .deselect')) {
      expect(glyph.getAttribute('aria-hidden'), 'the × must not reach the accessible name').toBe('true')
      expect(glyph.closest('label'), 'the × must be inside the label to toggle the input').not.toBeNull()
    }
  })

  it('no .deselect glyph appears in a radio chip (a radio cannot be deselected)', () => {
    for (const glyph of document.querySelectorAll('.Picklist .deselect')) {
      const input = glyph.closest('.option')?.querySelector('input')
      expect(input?.getAttribute('type'), 'a × on a radio chip would be a lie').toBe('checkbox')
    }
  })

  it('a removable chip label has no whitespace before the glyph', () => {
    // A text node "Wi-Fi " leaves a trailing space in the accessible name
    // (measured in Chrome), so the markup must read `>Text<svg`.
    for (const glyph of document.querySelectorAll('.Picklist .deselect')) {
      const prev = glyph.previousSibling
      if (prev?.nodeType !== 3 /* Node.TEXT_NODE */) continue
      const text = prev.textContent ?? ''
      expect(text, `"${text}" ends in whitespace before the × glyph`).toBe(text.trimEnd())
    }
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ThemeSwitch from '../ThemeSwitch'

// Two layers here. The markup-contract half is parsed from the component's own
// kitchensink, as with the rest of the native-adjacent family. The behaviour half
// exercises attach/destroy — the DECISIONS all live in the kernel and are tested
// there, so what is left to prove is the plumbing: that the right radio is
// checked, that the root attribute is set or REMOVED, and that nothing leaks.

const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ThemeSwitch.html'),
  'utf-8',
)

const STORAGE_KEY = 'appearance-preference'

describe('ThemeSwitch reference markup contract', () => {
  beforeEach(() => {
    document.body.innerHTML = html
  })

  const groups = () => [...document.querySelectorAll('.ThemeSwitch')]

  it('is a <fieldset> whose first element child is a non-empty <legend>', () => {
    expect(groups().length).toBeGreaterThan(0)
    for (const g of groups()) {
      expect(g.tagName).toBe('FIELDSET')
      const first = g.firstElementChild
      expect(first?.tagName, 'legend must be the first child of fieldset').toBe('LEGEND')
      // Visually clipped, but three icons need a name and this is the only
      // intrinsic one — so it must not be empty.
      expect(first!.textContent!.trim().length).toBeGreaterThan(0)
    }
  })

  it('every group has exactly three options with the known values', () => {
    for (const g of groups()) {
      const inputs = [...g.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      expect(inputs.length, 'the arity is fixed at three by the contract').toBe(3)
      expect(inputs.map((i) => i.value)).toEqual(['system', 'light', 'dark'])
      expect(new Set(inputs.map((i) => i.name)).size, 'one shared name').toBe(1)
      expect(inputs.filter((i) => i.hasAttribute('checked')).length, 'exactly one preselected').toBe(1)
    }
  })

  it('the label directly follows its input — the sibling contract', () => {
    // The whole visual model rests on `input + label`, and the indicator on
    // `input ~ .indicator`. A wrapper between them silently kills both.
    for (const g of groups()) {
      for (const input of g.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        const next = input.nextElementSibling
        expect(next?.tagName, `${input.id}: label must directly follow the input`).toBe('LABEL')
        expect(next!.getAttribute('for')).toBe(input.id)
      }
    }
  })

  it('the indicator is the last child of the options row and aria-hidden', () => {
    // It must be a FOLLOWING sibling of every input, or the nth-of-type rules
    // cannot reach it.
    for (const g of groups()) {
      const options = g.querySelector('[data-part="options"]')!
      const indicator = options.lastElementChild!
      expect(indicator.getAttribute('data-part')).toBe('indicator')
      expect(indicator.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('every icon is decorative and every label carries a text alternative', () => {
    // An icon-only label with no text is the failure mode this guards.
    for (const g of groups()) {
      for (const label of g.querySelectorAll('label')) {
        const svg = label.querySelector('svg')
        expect(svg, 'each segment has an icon').not.toBeNull()
        expect(svg!.getAttribute('aria-hidden')).toBe('true')
        expect(svg!.getAttribute('focusable')).toBe('false')
        expect(label.textContent!.trim().length, `${label.getAttribute('for')} has no SR text`).toBeGreaterThan(0)
      }
    }
  })

  it('ids are unique across the whole kitchensink', () => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size, `duplicate id in: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('exactly one instance is attachable — the state rows are inert copies', () => {
    // A page-wide control demoed four times over would fight itself for the root
    // attribute, so only the live demo carries data-component.
    expect(document.querySelectorAll('.ThemeSwitch[data-component="ThemeSwitch"]').length).toBe(1)
  })
})

describe('ThemeSwitch behaviour', () => {
  let instance: ThemeSwitch | undefined

  beforeEach(() => {
    document.body.innerHTML = html
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-appearance')
  })

  afterEach(() => {
    instance?.destroy()
    instance = undefined
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-appearance')
  })

  const live = () => document.querySelector<HTMLElement>('.ThemeSwitch[data-component="ThemeSwitch"]')!
  const radio = (value: string) =>
    live().querySelector<HTMLInputElement>(`input[value="${value}"]`)!

  const pick = (value: string) => {
    const input = radio(value)
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  it('attaches only the instance carrying data-component', () => {
    ThemeSwitch.attach()
    expect(live().dataset.initialized).toBe('true')
    for (const g of document.querySelectorAll<HTMLElement>('.ThemeSwitch:not([data-component])')) {
      expect(g.dataset.initialized, 'inert copies must stay inert').toBeUndefined()
    }
  })

  it('projects nothing for system — an absent attribute IS the state', () => {
    ThemeSwitch.attach()
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
    expect(radio('system').checked).toBe(true)
  })

  it('projects and persists an explicit choice', () => {
    ThemeSwitch.attach()
    pick('dark')
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('removes the attribute again when returning to system', () => {
    ThemeSwitch.attach()
    pick('dark')
    pick('system')
    expect(document.documentElement.hasAttribute('data-appearance'), 'must be removed, not set to "system"').toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('system')
  })

  it('restores a stored preference on attach, checking the matching radio', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light')
    ThemeSwitch.attach()
    expect(radio('light').checked).toBe(true)
    expect(radio('system').checked).toBe(false)
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light')
  })

  it('falls back to system when storage holds something unknown', () => {
    window.localStorage.setItem(STORAGE_KEY, 'sepia')
    ThemeSwitch.attach()
    expect(radio('system').checked, 'an unnamed preference must not leave the group unchecked').toBe(true)
    expect(document.documentElement.hasAttribute('data-appearance')).toBe(false)
  })

  it('dispatches theme-change with the resolved detail', () => {
    ThemeSwitch.attach()
    const seen: Array<{ preference: string; appearance: string }> = []
    live().addEventListener('theme-change', (e) => seen.push((e as CustomEvent).detail))
    pick('dark')
    expect(seen.at(-1)).toEqual({ preference: 'dark', appearance: 'dark' })
  })

  it('is idempotent — a second attach does not double-bind', () => {
    ThemeSwitch.attach()
    ThemeSwitch.attach()
    const seen: unknown[] = []
    live().addEventListener('theme-change', () => seen.push(1))
    pick('light')
    expect(seen.length, 'a second instance would dispatch twice').toBe(1)
  })

  it('destroy() stops responding and clears its marker', () => {
    ThemeSwitch.attach()
    const el = live()
    // Reach the instance the way the suite can: attach again after destroy is the
    // observable contract, so assert through behaviour rather than internals.
    const seen: unknown[] = []
    el.addEventListener('theme-change', () => seen.push(1))
    pick('dark')
    expect(seen.length).toBe(1)

    // Rebuild with an explicit instance so destroy() is reachable.
    document.body.innerHTML = html
    document.documentElement.removeAttribute('data-appearance')
    instance = new (ThemeSwitch as unknown as new (root: HTMLElement) => ThemeSwitch)(live())
    expect(live().dataset.initialized).toBe('true')
    instance.destroy()
    expect(live().dataset.initialized).toBeUndefined()

    const after: unknown[] = []
    live().addEventListener('theme-change', () => after.push(1))
    pick('light')
    expect(after.length, 'a destroyed instance must not project').toBe(0)
    instance = undefined
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Notice is markup + CSS, no JS. The unit layer guards the contract invariants —
// above all the ADR-0016 separation: Notice is a presentational payload and must
// NOT carry a live role; the announcer role lives on the persistent .notice-region.
const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../Notice.html'),
  'utf-8',
)

const VARIANTS = ['error', 'warning', 'success', 'info', 'neutral']

describe('Notice reference markup contract', () => {
  beforeEach(() => {
    document.body.innerHTML = html
  })

  const notices = () => [...document.querySelectorAll('.Notice')]

  it('Notice never carries a live role — it is a presentational payload', () => {
    for (const n of notices()) {
      expect(n.getAttribute('role'), 'Notice must not own a live role').toBeNull()
      expect(n.hasAttribute('aria-live'), 'Notice must not own aria-live').toBe(false)
    }
  })

  it('the announcer (.notice-region) carries the live role + aria-live', () => {
    const regions = [...document.querySelectorAll('.notice-region')]
    expect(regions.length).toBeGreaterThan(0)
    for (const r of regions) {
      expect(['alert', 'status']).toContain(r.getAttribute('role'))
      expect(['assertive', 'polite']).toContain(r.getAttribute('aria-live'))
    }
  })

  it('every Notice has a known data-variant', () => {
    for (const n of notices()) {
      expect(VARIANTS).toContain(n.getAttribute('data-variant'))
    }
  })

  it('icons are decorative (aria-hidden) and omitted when data-icon="false"', () => {
    for (const n of notices()) {
      if (n.getAttribute('data-icon') === 'false') {
        expect(n.querySelector('svg'), 'no-icon Notice should render no svg').toBeNull()
      } else {
        const svg = n.querySelector('.icon svg')
        if (svg) expect(svg.getAttribute('aria-hidden')).toBe('true')
      }
    }
  })

  it('every Notice has a content region', () => {
    for (const n of notices()) {
      expect(n.querySelector('.content')).not.toBeNull()
    }
  })
})

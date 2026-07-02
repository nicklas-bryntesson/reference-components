import { describe, it, expect } from 'vitest'
import { nextTabStop } from '../popup-interaction'

// Build a tab-stop list of plain divs (jsdom). Only identity + indexOf matter.
function stops(n: number): HTMLElement[] {
  return Array.from({ length: n }, () => document.createElement('div'))
}

describe('nextTabStop', () => {
  it('moves forward one stop', () => {
    const s = stops(4)
    expect(nextTabStop(s, s[0], false)).toBe(s[1])
    expect(nextTabStop(s, s[2], false)).toBe(s[3])
  })

  it('moves backward one stop', () => {
    const s = stops(4)
    expect(nextTabStop(s, s[3], true)).toBe(s[2])
    expect(nextTabStop(s, s[1], true)).toBe(s[0])
  })

  it('wraps last → first on forward Tab', () => {
    const s = stops(3)
    expect(nextTabStop(s, s[2], false)).toBe(s[0])
  })

  it('wraps first → last on Shift+Tab (deliberate aria-modal behaviour)', () => {
    const s = stops(3)
    expect(nextTabStop(s, s[0], true)).toBe(s[2])
  })

  it('snaps to first when focus is on a non-stop element (forward)', () => {
    const s = stops(3)
    const stray = document.createElement('button')
    expect(nextTabStop(s, stray, false)).toBe(s[0])
  })

  it('snaps to last when focus is on a non-stop element (backward)', () => {
    const s = stops(3)
    const stray = document.createElement('button')
    expect(nextTabStop(s, stray, true)).toBe(s[2])
  })

  it('snaps to an end when nothing is focused', () => {
    const s = stops(3)
    expect(nextTabStop(s, null, false)).toBe(s[0])
    expect(nextTabStop(s, null, true)).toBe(s[2])
  })

  it('returns null for an empty stop list', () => {
    expect(nextTabStop([], null, false)).toBeNull()
    expect(nextTabStop([], document.createElement('div'), true)).toBeNull()
  })

  it('a single stop wraps onto itself in both directions', () => {
    const s = stops(1)
    expect(nextTabStop(s, s[0], false)).toBe(s[0])
    expect(nextTabStop(s, s[0], true)).toBe(s[0])
  })
})

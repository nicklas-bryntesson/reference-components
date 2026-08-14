import { describe, it, expect } from 'vitest'
import {
  resolvePreference,
  resolveAppearance,
  shouldProject,
  type Preference,
} from '../theme-preference'

// Pure functions — no jsdom, no DOM, no globals. The suite is exhaustive because
// the whole point of extracting this was that the implementation it is modelled
// on had three drifting copies of the same branch.

describe('resolvePreference', () => {
  it('passes the three known values through', () => {
    expect(resolvePreference('system')).toBe('system')
    expect(resolvePreference('light')).toBe('light')
    expect(resolvePreference('dark')).toBe('dark')
  })

  it('falls back to system for anything unrecognised', () => {
    // Never chosen · cleared · a value from a future version · another app on the
    // same key · corruption. None may throw, and none may leave the control with
    // no radio to match — an unnamed preference renders a group with nothing checked.
    for (const stored of [null, undefined, '', ' ', 'auto', 'Dark', 'DARK', 'sepia', '{}', '0']) {
      expect(resolvePreference(stored as string | null), `stored=${JSON.stringify(stored)}`).toBe('system')
    }
  })

  it('is case-sensitive on purpose', () => {
    // 'Dark' is not a value this library ever writes, so treating it as 'dark'
    // would be guessing at another writer's intent.
    expect(resolvePreference('Dark')).toBe('system')
    expect(resolvePreference('dark')).toBe('dark')
  })
})

describe('resolveAppearance', () => {
  it('covers all six combinations', () => {
    const table: Array<[Preference, boolean, 'light' | 'dark']> = [
      ['light', false, 'light'],
      ['light', true, 'light'],
      ['dark', false, 'dark'],
      ['dark', true, 'dark'],
      ['system', false, 'light'],
      ['system', true, 'dark'],
    ]
    for (const [preference, prefersDark, expected] of table) {
      expect(resolveAppearance(preference, prefersDark), `${preference} + prefersDark=${prefersDark}`).toBe(expected)
    }
  })

  // The headline rule, stated on its own because it is the contract rather than
  // a case: the same rule resolveMotion step 3 encodes for motion.
  it('an explicit choice outranks the platform signal, in both directions', () => {
    expect(resolveAppearance('light', true), 'chose light, OS says dark').toBe('light')
    expect(resolveAppearance('dark', false), 'chose dark, OS says light').toBe('dark')
  })

  it('only the system branch consults the signal', () => {
    // Flipping the signal must move nothing except under 'system'.
    for (const preference of ['light', 'dark'] as const) {
      expect(resolveAppearance(preference, false)).toBe(resolveAppearance(preference, true))
    }
    expect(resolveAppearance('system', false)).not.toBe(resolveAppearance('system', true))
  })
})

describe('shouldProject', () => {
  it('projects only for an explicit choice', () => {
    expect(shouldProject('light')).toBe(true)
    expect(shouldProject('dark')).toBe(true)
    expect(shouldProject('system'), 'an absent attribute IS the system state').toBe(false)
  })
})

describe('the functions compose the way the component uses them', () => {
  it('unknown storage + dark OS behaves exactly like an untouched system preference', () => {
    const preference = resolvePreference('nonsense-from-another-app')
    expect(shouldProject(preference)).toBe(false)
    expect(resolveAppearance(preference, true)).toBe('dark')
  })

  it('a stored explicit choice survives a contradicting OS', () => {
    const preference = resolvePreference('light')
    expect(shouldProject(preference)).toBe(true)
    expect(resolveAppearance(preference, true)).toBe('light')
  })
})

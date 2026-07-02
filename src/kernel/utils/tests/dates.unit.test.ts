import { describe, it, expect } from 'vitest'
import {
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  getISOWeek,
  isDayDisabled,
  formatISO,
  formatDatetimeISO,
  formatMonthISO,
  parseMonthISO,
  getISOWeekYear,
  getDateOfISOWeek,
  formatWeekISO,
  parseWeekISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  clampDayToMonth,
} from '../dates'

// Kernel conformance tests for the pure date utilities. These are black-box —
// they exercise the public API of dates.ts with no DOM and no component. A
// consumer porting the kernel runs these against their own date helpers.

describe('getDaysInMonth', () => {
  it('returns 29 for Feb in leap year 2024', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29)
  })
  it('returns 28 for Feb in non-leap year 2023', () => {
    expect(getDaysInMonth(2023, 1)).toBe(28)
  })
  it('returns 31 for January', () => {
    expect(getDaysInMonth(2026, 0)).toBe(31)
  })
  it('returns 30 for April', () => {
    expect(getDaysInMonth(2026, 3)).toBe(30)
  })
})

describe('getFirstWeekdayOfMonth', () => {
  it('returns 6 for March 2026 (starts Sunday, Monday-first grid)', () => {
    expect(getFirstWeekdayOfMonth(2026, 2)).toBe(6)
  })
  it('returns 3 for January 2026 (starts Thursday)', () => {
    expect(getFirstWeekdayOfMonth(2026, 0)).toBe(3)
  })
})

describe('getISOWeek', () => {
  it('returns 1 for Jan 4 2026 (always in week 1)', () => {
    expect(getISOWeek(new Date(2026, 0, 4))).toBe(1)
  })
  it('returns 53 for Dec 28 2020', () => {
    expect(getISOWeek(new Date(2020, 11, 28))).toBe(53)
  })
})

describe('isDayDisabled', () => {
  const min = new Date(2026, 0, 10)
  const max = new Date(2026, 0, 20)
  it('disables dates before min', () => {
    expect(isDayDisabled(new Date(2026, 0, 9), min, max)).toBe(true)
  })
  it('disables dates after max', () => {
    expect(isDayDisabled(new Date(2026, 0, 21), min, max)).toBe(true)
  })
  it('allows dates within range', () => {
    expect(isDayDisabled(new Date(2026, 0, 15), min, max)).toBe(false)
  })
  it('allows min date itself', () => {
    expect(isDayDisabled(new Date(2026, 0, 10), min, max)).toBe(false)
  })
  it('allows max date itself', () => {
    expect(isDayDisabled(new Date(2026, 0, 20), min, max)).toBe(false)
  })
  it('allows all dates when no min/max', () => {
    expect(isDayDisabled(new Date(2026, 0, 1), null, null)).toBe(false)
  })
})

describe('clampDayToMonth', () => {
  it('returns same day when day is within month', () => {
    expect(clampDayToMonth(2026, 3, 15)).toBe(15) // April has 30 days
  })
  it('clamps march 31 to feb 28 in non-leap year', () => {
    expect(clampDayToMonth(2026, 1, 31)).toBe(28)
  })
  it('clamps march 31 to feb 29 in leap year 2024', () => {
    expect(clampDayToMonth(2024, 1, 31)).toBe(29)
  })
  it('clamps jan 31 to apr 30', () => {
    expect(clampDayToMonth(2026, 3, 31)).toBe(30)
  })
  it('returns 28 for day 28 in february non-leap', () => {
    expect(clampDayToMonth(2026, 1, 28)).toBe(28)
  })
})

describe('formatISO', () => {
  it('formats to yyyy-mm-dd', () => {
    expect(formatISO(new Date(2026, 2, 5))).toBe('2026-03-05')
  })
  it('pads single-digit month and day', () => {
    expect(formatISO(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('formatDatetimeISO', () => {
  it('formats without seconds by default', () => {
    const d = new Date(2026, 4, 27, 14, 35, 0)
    expect(formatDatetimeISO(d)).toBe('2026-05-27T14:35')
  })
  it('zero-pads single-digit hours and minutes', () => {
    const d = new Date(2026, 0, 5, 9, 5, 0)
    expect(formatDatetimeISO(d)).toBe('2026-01-05T09:05')
  })
  it('includes seconds when includeSeconds=true', () => {
    const d = new Date(2026, 4, 27, 14, 35, 8)
    expect(formatDatetimeISO(d, true)).toBe('2026-05-27T14:35:08')
  })
})

describe('formatMonthISO', () => {
  it('formats year + 0-based month to yyyy-mm', () => {
    expect(formatMonthISO(2026, 5)).toBe('2026-06')
  })
  it('pads single-digit month', () => {
    expect(formatMonthISO(2026, 0)).toBe('2026-01')
  })
  it('handles december (month index 11)', () => {
    expect(formatMonthISO(2026, 11)).toBe('2026-12')
  })
})

describe('parseMonthISO', () => {
  it('parses yyyy-mm into year and 0-indexed month', () => {
    expect(parseMonthISO('2026-06')).toEqual({ year: 2026, month: 5 })
  })
  it('parses january as month 0', () => {
    expect(parseMonthISO('2026-01')).toEqual({ year: 2026, month: 0 })
  })
  it('parses december as month 11', () => {
    expect(parseMonthISO('2026-12')).toEqual({ year: 2026, month: 11 })
  })
  it('round-trips with formatMonthISO', () => {
    const p = parseMonthISO('2026-06')!
    expect(formatMonthISO(p.year, p.month)).toBe('2026-06')
  })
  it('trims surrounding whitespace', () => {
    expect(parseMonthISO('  2026-06  ')).toEqual({ year: 2026, month: 5 })
  })
  it('returns null for month 00', () => {
    expect(parseMonthISO('2026-00')).toBeNull()
  })
  it('returns null for month 13', () => {
    expect(parseMonthISO('2026-13')).toBeNull()
  })
  it('returns null for a full date string', () => {
    expect(parseMonthISO('2026-06-15')).toBeNull()
  })
  it('returns null for non-numeric or malformed input', () => {
    expect(parseMonthISO('')).toBeNull()
    expect(parseMonthISO('2026-6')).toBeNull()
    expect(parseMonthISO('abc-de')).toBeNull()
  })
})

describe('getISOWeekYear', () => {
  it('returns the calendar year for a mid-year date', () => {
    expect(getISOWeekYear(new Date(2026, 5, 15))).toBe(2026)
  })
  it('returns 2026 for Mon 2025-12-29 (belongs to 2026-W01)', () => {
    expect(getISOWeekYear(new Date(2025, 11, 29))).toBe(2026)
  })
  it('returns 2026 for Fri 2027-01-01 (belongs to 2026-W53)', () => {
    expect(getISOWeekYear(new Date(2027, 0, 1))).toBe(2026)
  })
})

describe('getDateOfISOWeek', () => {
  it('returns Monday 2025-12-29 for 2026-W01', () => {
    const d = getDateOfISOWeek(2026, 1)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 11, 29])
  })
  it('round-trips with getISOWeek and getISOWeekYear', () => {
    const d = getDateOfISOWeek(2026, 27)
    expect(getISOWeek(d)).toBe(27)
    expect(getISOWeekYear(d)).toBe(2026)
  })
  it('handles a 53-week year (2020-W53 → Mon 2020-12-28)', () => {
    const d = getDateOfISOWeek(2020, 53)
    expect(getISOWeek(d)).toBe(53)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2020, 11, 28])
  })
})

describe('formatWeekISO', () => {
  it('formats to yyyy-Www', () => {
    expect(formatWeekISO(2026, 27)).toBe('2026-W27')
  })
  it('zero-pads a single-digit week', () => {
    expect(formatWeekISO(2026, 1)).toBe('2026-W01')
  })
})

describe('parseWeekISO', () => {
  it('parses yyyy-Www', () => {
    expect(parseWeekISO('2026-W27')).toEqual({ weekYear: 2026, week: 27 })
  })
  it('parses zero-padded week 01', () => {
    expect(parseWeekISO('2026-W01')).toEqual({ weekYear: 2026, week: 1 })
  })
  it('round-trips with formatWeekISO', () => {
    const p = parseWeekISO('2026-W27')!
    expect(formatWeekISO(p.weekYear, p.week)).toBe('2026-W27')
  })
  it('trims surrounding whitespace', () => {
    expect(parseWeekISO('  2026-W27  ')).toEqual({ weekYear: 2026, week: 27 })
  })
  it('returns null for week 00 and 54', () => {
    expect(parseWeekISO('2026-W00')).toBeNull()
    expect(parseWeekISO('2026-W54')).toBeNull()
  })
  it('returns null for malformed input', () => {
    expect(parseWeekISO('2026-27')).toBeNull()
    expect(parseWeekISO('2026-W1')).toBeNull()
    expect(parseWeekISO('')).toBeNull()
    expect(parseWeekISO('abc')).toBeNull()
  })
})

describe('getWeekdayNames', () => {
  it('returns 7-element array for sv-SE', () => {
    expect(getWeekdayNames('sv-SE')).toHaveLength(7)
  })
  it('starts with Monday for sv-SE (first char is m)', () => {
    const names = getWeekdayNames('sv-SE')
    expect(names[0].toLowerCase()).toMatch(/^m/)
  })
  it('returns 7-element array for en', () => {
    expect(getWeekdayNames('en')).toHaveLength(7)
  })
})

describe('getMonthName', () => {
  it('returns "mars" for month index 2 in sv-SE', () => {
    expect(getMonthName(2026, 2, 'sv-SE')).toBe('mars')
  })
  it('returns "March" for month index 2 in en', () => {
    expect(getMonthName(2026, 2, 'en')).toBe('March')
  })
})

describe('getSegmentOrder', () => {
  it('returns ["year","month","day"] order for sv-SE', () => {
    const { order } = getSegmentOrder('sv-SE')
    expect(order).toEqual(['year', 'month', 'day'])
  })

  it('returns "-" as separator for sv-SE', () => {
    const { separator } = getSegmentOrder('sv-SE')
    expect(separator).toBe('-')
  })

  it('always returns exactly 3 segment types', () => {
    expect(getSegmentOrder('en').order).toHaveLength(3)
    expect(getSegmentOrder('sv-SE').order).toHaveLength(3)
  })

  it('returns only valid segment type strings', () => {
    const { order } = getSegmentOrder('sv-SE')
    const valid = new Set(['day', 'month', 'year'])
    order.forEach(type => expect(valid.has(type)).toBe(true))
  })

  it('returns a non-empty string separator', () => {
    const { separator } = getSegmentOrder('en')
    expect(typeof separator).toBe('string')
    expect(separator.length).toBeGreaterThan(0)
  })
})

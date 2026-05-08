import { describe, it, expect, vi } from 'vitest'
import {
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  getISOWeek,
  isDayDisabled,
  formatISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  clampDayToMonth,
} from '../DateField'
import DateField from '../DateField'

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

describe('DateField.registerLocale', () => {
  it('registers and retrieves a locale', () => {
    DateField.registerLocale('test-locale', { day: 'Dag' })
    expect(DateField.translations['test-locale'].day).toBe('Dag')
  })
  it('overwrites an existing locale', () => {
    DateField.registerLocale('test-locale', { day: 'Day' })
    expect(DateField.translations['test-locale'].day).toBe('Day')
  })
})

describe('timezone safety', () => {
  it('new Date(y, m, d) produces correct local date — not UTC-shifted', () => {
    const d = new Date(2026, 2, 24)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(24)
  })
})

describe('DateField locale resolution', () => {
  it('falls back to en when resolved locale has no registered translation', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 't1'
    el.dataset.locale = 'fr'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group"></div>
        <button class="Trigger" type="button"></button>
        <template data-template="datefield-calendar"></template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.locale).toBe('en')
    el.remove()
  })

  it('uses data-locale when set and registered', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 't2'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group"></div>
        <button class="Trigger" type="button"></button>
        <template data-template="datefield-calendar"></template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    DateField.registerLocale('sv-SE', { day: 'Dag', month: 'Månad', year: 'År', openCalendar: 'Öppna kalender', closeCalendar: 'Stäng kalender', prevMonth: 'Föregående månad', nextMonth: 'Nästa månad', today: 'idag', selected: 'valt', notAvailable: 'ej tillgängligt', announceSelected: 'Valt datum:' })
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.locale).toBe('sv-SE')
    expect(instance.t.day).toBe('Dag')
    el.remove()
  })

  it('falls back to document.documentElement.lang when data-locale is absent', () => {
    document.documentElement.lang = 'sv-SE'
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 't3'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group"></div>
        <button class="Trigger" type="button"></button>
        <template data-template="datefield-calendar"></template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.locale).toBe('sv-SE')
    document.documentElement.lang = ''
    el.remove()
  })
})

describe('registerLocale fallback', () => {
  it('falls back to en strings when locale is not registered', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 't4'
    el.dataset.locale = 'de'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group"></div>
        <button class="Trigger" type="button"></button>
        <template data-template="datefield-calendar"></template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.t.openCalendar).toBe('Open calendar')
    el.remove()
  })
})

// ─── Shared fixture helper ────────────────────────────────────────────────────

interface MakeFieldOptions {
  disabled?: boolean
  value?: string
  min?: string
  max?: string
  locale?: string
  id?: string
  name?: string
}

function makeField({ disabled = false, value = '', min = '', max = '', locale = 'sv-SE', id, name = 'testfield' }: MakeFieldOptions = {}): { el: HTMLElement; instance: DateField } {
  const fieldId = id ?? `df-test-${Math.random().toString(36).slice(2)}`
  const el = document.createElement('div')
  el.dataset.component = 'DateField'
  el.dataset.id = fieldId
  el.dataset.name = name
  el.dataset.locale = locale
  if (min) el.dataset.min = min
  if (max) el.dataset.max = max
  el.innerHTML = `
    <input class="Native" type="date"
      ${value    ? `value="${value}"` : ''}
      ${disabled ? 'disabled'         : ''}
    />
    <label for="${fieldId}">Test label</label>
    <div class="Custom" aria-hidden="true">
      <div class="Segments" role="group">
        <button class="Trigger" type="button" aria-label="Öppna kalender"
          aria-expanded="false" aria-haspopup="dialog"></button>
      </div>
      <div class="slideContainer">
      <template data-template="datefield-calendar">
        <div class="DateFieldCalendar" role="dialog" aria-modal="true">
          <div class="CalendarHeader">
            <button type="button">&#8249;</button>
            <span aria-live="polite" aria-atomic="true"></span>
            <button type="button">&#8250;</button>
          </div>
          <table class="Grid" role="grid">
            <thead><tr role="row">
              <th scope="col"></th><th scope="col"></th><th scope="col"></th>
              <th scope="col"></th><th scope="col"></th><th scope="col"></th>
              <th scope="col"></th>
            </tr></thead>
            <tbody></tbody>
          </table>
          <div class="CalendarFooter">
            <button type="button" class="CalendarFooterClear"></button>
            <button type="button" class="CalendarFooterToday"></button>
          </div>
          <div class="arrow"></div>
        </div>
      </template>
      </div>
    </div>
    <div class="Announce" aria-live="polite" aria-atomic="true"></div>
  `
  document.body.appendChild(el)
  const instance = new DateField(el)
  return { el, instance }
}

describe('DateField — initial value sync', () => {
  it('populates segments from native value attribute on mount', () => {
    const { el } = makeField({ value: '1990-06-15' })
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('15')
    expect(el.querySelector('[data-segment="month"]')!.getAttribute('aria-valuenow')).toBe('6')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-valuenow')).toBe('1990')
    el.remove()
  })

  it('sets selectedDate from native value on mount', () => {
    const { el, instance } = makeField({ value: '1990-06-15' })
    expect(instance.selectedDate).not.toBeNull()
    expect(instance.selectedDate!.getFullYear()).toBe(1990)
    expect(instance.selectedDate!.getMonth()).toBe(5)
    expect(instance.selectedDate!.getDate()).toBe(15)
    el.remove()
  })

  it('leaves segments as placeholders when no initial value', () => {
    const { el } = makeField()
    expect(el.querySelector('[data-segment="day"]')!.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('populates segments from initial value even when field is disabled', () => {
    const { el } = makeField({ disabled: true, value: '1990-06-15' })
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('15')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-valuenow')).toBe('1990')
    el.remove()
  })
})

describe('DateField — disabled state', () => {
  it('sets all segments to tabindex="-1" when native is disabled', () => {
    const { el } = makeField({ disabled: true })
    el.querySelectorAll('.Segment').forEach(seg => {
      expect(seg.getAttribute('tabindex')).toBe('-1')
    })
    el.remove()
  })

  it('does not increment a segment when native is disabled', () => {
    const { el } = makeField({ disabled: true })
    const daySeg = el.querySelector('[data-segment="day"]')!
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('disables the calendar trigger button when native is disabled', () => {
    const { el, instance } = makeField({ disabled: true })
    expect(instance.trigger.disabled).toBe(true)
    el.remove()
  })
})

describe('DateField — year digit input', () => {
  it('commits year value after 4 digits are typed', () => {
    const { el } = makeField()
    const yearSeg = el.querySelector('[data-segment="year"]')!
    for (const digit of ['2', '0', '2', '6']) {
      yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }))
    }
    expect(yearSeg.getAttribute('aria-valuenow')).toBe('2026')
    expect(yearSeg.hasAttribute('data-placeholder')).toBe(false)
    el.remove()
  })

  it('does not commit year after fewer than 4 digits', () => {
    const { el } = makeField()
    const yearSeg = el.querySelector('[data-segment="year"]')!
    for (const digit of ['2', '0', '2']) {
      yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }))
    }
    expect(yearSeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })
})

describe('DateField — year limits from data-min/max', () => {
  it('_getSegmentLimits("year") uses data-min year', () => {
    const { el, instance } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    expect(instance._getSegmentLimits('year').min).toBe(2026)
    el.remove()
  })

  it('_getSegmentLimits("year") uses data-max year', () => {
    const { el, instance } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    expect(instance._getSegmentLimits('year').max).toBe(2027)
    el.remove()
  })

  it('ArrowUp on empty year starts at data-min year', () => {
    const { el } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    const yearSeg = el.querySelector('[data-segment="year"]')!
    yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(yearSeg.getAttribute('aria-valuenow')).toBe('2026')
    el.remove()
  })

  it('ArrowUp on empty year defaults to 1900 when no data-min set', () => {
    const { el } = makeField()
    const yearSeg = el.querySelector('[data-segment="year"]')!
    yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(yearSeg.getAttribute('aria-valuenow')).toBe('1900')
    el.remove()
  })
})

describe('DateField — min/max enforcement on segment sync', () => {
  it('does not write to native input when complete date is before data-min', () => {
    const { el, instance } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    const native = el.querySelector('.Native') as HTMLInputElement
    instance._setSegmentValue(instance._getSegmentEl('day')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2025)
    expect(native.value).toBe('')
    el.remove()
  })

  it('does not write to native input when complete date is after data-max', () => {
    const { el, instance } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    const native = el.querySelector('.Native') as HTMLInputElement
    instance._setSegmentValue(instance._getSegmentEl('day')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2028)
    expect(native.value).toBe('')
    el.remove()
  })

  it('writes to native input when complete date is within data-min/max', () => {
    const { el, instance } = makeField({ min: '2026-03-26', max: '2027-12-31' })
    const native = el.querySelector('.Native') as HTMLInputElement
    instance._setSegmentValue(instance._getSegmentEl('day')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 4)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2026)
    expect(native.value).toBe('2026-04-01')
    el.remove()
  })

  it('always writes when no data-min/max set', () => {
    const { el, instance } = makeField()
    const native = el.querySelector('.Native') as HTMLInputElement
    instance._setSegmentValue(instance._getSegmentEl('day')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 1)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 1900)
    expect(native.value).toBe('1900-01-01')
    el.remove()
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

describe('DateField — locale-derived segment order', () => {
  const svSEStrings = {
    day: 'Dag', month: 'Månad', year: 'År',
    openCalendar: 'Öppna kalender', closeCalendar: 'Stäng kalender',
    prevMonth: 'Föregående månad', nextMonth: 'Nästa månad',
    today: 'idag', selected: 'valt', notAvailable: 'ej tillgängligt',
    announceSelected: 'Valt datum:',
  }

  it('sv-SE renders segments in year-month-day DOM order', () => {
    DateField.registerLocale('sv-SE', svSEStrings)
    const { el } = makeField({ locale: 'sv-SE' })
    const segs = [...el.querySelectorAll('[data-segment]')]
    expect(segs[0].getAttribute('data-segment')).toBe('year')
    expect(segs[1].getAttribute('data-segment')).toBe('month')
    expect(segs[2].getAttribute('data-segment')).toBe('day')
    el.remove()
  })

  it('sv-SE separators use "-"', () => {
    DateField.registerLocale('sv-SE', svSEStrings)
    const { el } = makeField({ locale: 'sv-SE' })
    const separators = [...el.querySelectorAll('.Separator')]
    expect(separators).toHaveLength(2)
    separators.forEach(sep => expect(sep.textContent).toBe('-'))
    el.remove()
  })

  it('sv-SE segments have locale aria-labels (Dag, Månad, År)', () => {
    DateField.registerLocale('sv-SE', svSEStrings)
    const { el } = makeField({ locale: 'sv-SE' })
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-label')).toBe('Dag')
    expect(el.querySelector('[data-segment="month"]')!.getAttribute('aria-label')).toBe('Månad')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-label')).toBe('År')
    el.remove()
  })

  it('en segments have English aria-labels (Day, Month, Year)', () => {
    const { el } = makeField({ locale: 'en' })
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-label')).toBe('Day')
    expect(el.querySelector('[data-segment="month"]')!.getAttribute('aria-label')).toBe('Month')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-label')).toBe('Year')
    el.remove()
  })

  it('generates exactly 3 segments and 2 separators', () => {
    const { el } = makeField({ locale: 'en' })
    expect(el.querySelectorAll('[data-segment]')).toHaveLength(3)
    expect(el.querySelectorAll('.Separator')).toHaveLength(2)
    el.remove()
  })

  it('first generated segment has tabindex="0", others have "-1"', () => {
    const { el } = makeField({ locale: 'en' })
    const segs = [...el.querySelectorAll('[data-segment]')]
    expect(segs[0].getAttribute('tabindex')).toBe('0')
    segs.slice(1).forEach(seg => expect(seg.getAttribute('tabindex')).toBe('-1'))
    el.remove()
  })
})

// ─── Display mode helpers ──────────────────────────────────────────────────

interface MakeDisplayFieldOptions {
  value?: string
  min?: string
  max?: string
  locale?: string
  disabled?: boolean
}

function makeDisplayField({ value = '', min = '', max = '', locale = 'sv-SE', disabled = false }: MakeDisplayFieldOptions = {}): { el: HTMLElement; instance: DateField } {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    addListener: () => {},
    removeListener: () => {},
  }))
  const result = makeField({ value, min, max, locale, disabled })
  vi.unstubAllGlobals()
  return result
}

describe('DateField — display mode (pointer: coarse)', () => {
  it('sets data-input-mode to "display"', () => {
    const { el } = makeDisplayField()
    expect(el.dataset.inputMode).toBe('display')
    el.remove()
  })

  it('keeps aria-hidden="true" on .Custom — it is a decorative display layer', () => {
    const { el } = makeDisplayField()
    expect(el.querySelector('.Custom')!.getAttribute('aria-hidden')).toBe('true')
    el.remove()
  })

  it('generates segment elements in the DOM', () => {
    const { el } = makeDisplayField()
    expect(el.querySelectorAll('[data-segment]')).toHaveLength(3)
    el.remove()
  })

  it('all segments have tabindex="-1" — not focusable', () => {
    const { el } = makeDisplayField()
    el.querySelectorAll('[data-segment]').forEach(seg => {
      expect(seg.getAttribute('tabindex')).toBe('-1')
    })
    el.remove()
  })

  it('syncs initial native value to segments on mount', () => {
    const { el } = makeDisplayField({ value: '1990-06-15' })
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('15')
    expect(el.querySelector('[data-segment="month"]')!.getAttribute('aria-valuenow')).toBe('6')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-valuenow')).toBe('1990')
    el.remove()
  })

  it('leaves segments as placeholders when no initial value', () => {
    const { el } = makeDisplayField()
    el.querySelectorAll('[data-segment]').forEach(seg => {
      expect(seg.hasAttribute('data-placeholder')).toBe(true)
    })
    el.remove()
  })

  it('updates segments when native value changes externally', () => {
    const { el } = makeDisplayField()
    const native = el.querySelector('.Native') as HTMLInputElement
    native.value = '2026-12-31'
    native.dispatchEvent(new Event('change', { bubbles: true }))
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('31')
    expect(el.querySelector('[data-segment="month"]')!.getAttribute('aria-valuenow')).toBe('12')
    expect(el.querySelector('[data-segment="year"]')!.getAttribute('aria-valuenow')).toBe('2026')
    el.remove()
  })

  it('clears segments on form reset', () => {
    const form = document.createElement('form')
    document.body.appendChild(form)

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addListener: () => {},
      removeListener: () => {},
    }))
    const inputId = `df-reset-test-${Math.random().toString(36).slice(2)}`
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = inputId
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" value="2026-03-26" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button"></button>
        </div>
        <template data-template="datefield-calendar"></template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    form.appendChild(el)
    new DateField(el)
    vi.unstubAllGlobals()

    form.reset()

    el.querySelectorAll('[data-segment]').forEach(seg => {
      expect(seg.hasAttribute('data-placeholder')).toBe(true)
    })
    form.remove()
  })

  it('keyboard events on segments do nothing — no handlers bound', () => {
    const { el } = makeDisplayField({ value: '2026-01-15' })
    const daySeg = el.querySelector('[data-segment="day"]')!
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(daySeg.getAttribute('aria-valuenow')).toBe('15')
    el.remove()
  })

  it('sets data-disabled on root when native input is disabled', () => {
    const { el } = makeDisplayField({ disabled: true })
    expect(el.hasAttribute('data-disabled')).toBe(true)
    el.remove()
  })
})

describe('DateField — prop application from wrapper data attributes', () => {
  it('applies data-id to native input id', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 'my-date'
    el.dataset.name = 'mydate'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
          <div class="DateFieldCalendar" role="dialog" aria-modal="true">
            <div class="CalendarHeader">
              <button type="button">&#8249;</button>
              <span aria-live="polite" aria-atomic="true"></span>
              <button type="button">&#8250;</button>
            </div>
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.native.id).toBe('my-date')
    el.remove()
  })

  it('applies data-name to native input name', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 'my-date'
    el.dataset.name = 'mydate'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
          <div class="DateFieldCalendar" role="dialog" aria-modal="true">
            <div class="CalendarHeader">
              <button type="button">&#8249;</button>
              <span aria-live="polite" aria-atomic="true"></span>
              <button type="button">&#8250;</button>
            </div>
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.native.name).toBe('mydate')
    el.remove()
  })

  it('applies data-min and data-max to native input', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 'my-date'
    el.dataset.name = 'mydate'
    el.dataset.min = '2000-01-01'
    el.dataset.max = '2099-12-31'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
          <div class="DateFieldCalendar" role="dialog" aria-modal="true">
            <div class="CalendarHeader">
              <button type="button">&#8249;</button>
              <span aria-live="polite" aria-atomic="true"></span>
              <button type="button">&#8250;</button>
            </div>
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.native.min).toBe('2000-01-01')
    expect(instance.native.max).toBe('2099-12-31')
    el.remove()
  })

  it('falls back to datefield-{instanceId} when data-id is absent', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.name = 'mydate'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
          <div class="DateFieldCalendar" role="dialog" aria-modal="true">
            <div class="CalendarHeader">
              <button type="button">&#8249;</button>
              <span aria-live="polite" aria-atomic="true"></span>
              <button type="button">&#8250;</button>
            </div>
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.native.id).toMatch(/^datefield-\d+$/)
    el.remove()
  })

  it('stores fieldId on instance', () => {
    const el = document.createElement('div')
    el.dataset.component = 'DateField'
    el.dataset.id = 'my-date'
    el.dataset.name = 'mydate'
    el.dataset.locale = 'sv-SE'
    el.innerHTML = `
      <input class="Native" type="date" />
      <div class="Custom" aria-hidden="true">
        <div class="Segments" role="group">
          <button class="Trigger" type="button" aria-expanded="false" aria-haspopup="dialog"></button>
        </div>
        <template data-template="datefield-calendar">
          <div class="DateFieldCalendar" role="dialog" aria-modal="true">
            <div class="CalendarHeader">
              <button type="button">&#8249;</button>
              <span aria-live="polite" aria-atomic="true"></span>
              <button type="button">&#8250;</button>
            </div>
            <table class="Grid" role="grid">
              <thead><tr role="row">
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th><th scope="col"></th><th scope="col"></th>
                <th scope="col"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </template>
      </div>
      <div class="Announce" aria-live="polite" aria-atomic="true"></div>
    `
    document.body.appendChild(el)
    const instance = new DateField(el)
    expect(instance.fieldId).toBe('my-date')
    el.remove()
  })
})

describe('DateField — segment digit clamping', () => {
  it('day: typing "3" then "4" clamps to 31 on blur', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    daySeg.dispatchEvent(new FocusEvent('blur'))
    expect(daySeg.getAttribute('aria-valuenow')).toBe('31')
    el.remove()
  })

  it('month: typing "1" then "3" clamps to 12 on blur', () => {
    const { el } = makeField()
    const monthSeg = el.querySelector('[data-segment="month"]')! as HTMLElement
    monthSeg.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    monthSeg.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    monthSeg.dispatchEvent(new FocusEvent('blur'))
    expect(monthSeg.getAttribute('aria-valuenow')).toBe('12')
    el.remove()
  })
})

describe('DateField — segment visual buffer feedback', () => {
  it('day: shows typed digit immediately in textContent before commit', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    expect(daySeg.textContent).toBe('1')
    el.remove()
  })

  it('year: shows partial digits immediately during accumulation', () => {
    const { el } = makeField()
    const yearSeg = el.querySelector('[data-segment="year"]')! as HTMLElement
    for (const digit of ['2', '0', '2']) {
      yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }))
    }
    expect(yearSeg.textContent).toBe('202')
    el.remove()
  })
})

describe('DateField — segment blur flush', () => {
  it('day: single digit "0" on blur clamps to 1 (min)', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }))
    daySeg.dispatchEvent(new FocusEvent('blur'))
    expect(daySeg.getAttribute('aria-valuenow')).toBe('1')
    el.remove()
  })

  it('day: single digit "3" on blur commits value 3', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    daySeg.dispatchEvent(new FocusEvent('blur'))
    expect(daySeg.getAttribute('aria-valuenow')).toBe('3')
    el.remove()
  })

  it('month: single digit "1" on blur commits value 1', () => {
    const { el } = makeField()
    const monthSeg = el.querySelector('[data-segment="month"]')! as HTMLElement
    monthSeg.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    monthSeg.dispatchEvent(new FocusEvent('blur'))
    expect(monthSeg.getAttribute('aria-valuenow')).toBe('1')
    el.remove()
  })

  it('year: fewer than 4 digits on blur resets segment to cleared state', () => {
    const { el } = makeField()
    const yearSeg = el.querySelector('[data-segment="year"]')! as HTMLElement
    for (const digit of ['2', '0', '2']) {
      yearSeg.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }))
    }
    // After typing 3 digits, textContent is '202' (shown by _showBuffer)
    expect(yearSeg.textContent).toBe('202') // verify the setup
    yearSeg.dispatchEvent(new FocusEvent('blur'))
    // After blur flush, _clearSegment should reset textContent to 'yyyy'
    expect(yearSeg.textContent).toBe('yyyy')
    el.remove()
  })
})

describe('DateField — cross-segment day re-clamp on month change', () => {
  it('re-clamps day to new month max when month is set to a shorter month', () => {
    const { el, instance } = makeField()
    instance._setSegmentValue(instance._getSegmentEl('day')!, 31)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2026)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 2) // February 2026 = 28 days
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('28')
    el.remove()
  })

  it('does not alter day when it is within the new month max', () => {
    const { el, instance } = makeField()
    instance._setSegmentValue(instance._getSegmentEl('day')!, 15)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2026)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 2) // February — 15 is valid
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('15')
    el.remove()
  })

  it('re-clamps to 29 for February in a leap year', () => {
    const { el, instance } = makeField()
    instance._setSegmentValue(instance._getSegmentEl('day')!, 31)
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2024) // leap year
    instance._setSegmentValue(instance._getSegmentEl('month')!, 2)
    expect(el.querySelector('[data-segment="day"]')!.getAttribute('aria-valuenow')).toBe('29')
    el.remove()
  })

  it('does not set day when day segment is in placeholder state', () => {
    const { el, instance } = makeField()
    instance._setSegmentValue(instance._getSegmentEl('year')!, 2026)
    instance._setSegmentValue(instance._getSegmentEl('month')!, 2)
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })
})

describe('DateField — native-like digit input (show then blur-correct)', () => {
  it('day: single digit "4" does not fast-advance — no immediate commit', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('day: typing "4" then "5" shows "45" in textContent without committing', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }))
    expect(daySeg.textContent).toBe('45')
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('day: typing "4" then "5" then blur clamps to 31', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }))
    daySeg.dispatchEvent(new FocusEvent('blur'))
    expect(daySeg.getAttribute('aria-valuenow')).toBe('31')
    el.remove()
  })

  it('month: typing "1" then "3" shows "13" in textContent without committing', () => {
    const { el } = makeField()
    const monthSeg = el.querySelector('[data-segment="month"]')! as HTMLElement
    monthSeg.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    monthSeg.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    expect(monthSeg.textContent).toBe('13')
    expect(monthSeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('day: Backspace after typing clears buffer so blur does not commit', () => {
    const { el } = makeField()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }))
    daySeg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    daySeg.dispatchEvent(new FocusEvent('blur'))
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })
})

describe('DateField — calendar footer (Clear + Today)', () => {
  it('Clear button is disabled when no date is selected', () => {
    const { instance, el } = makeField()
    instance._openCalendar()
    const clearBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterClear')!
    expect(clearBtn.disabled).toBe(true)
    instance._closeCalendar()
    el.remove()
  })

  it('Clear button is enabled when a date is selected', () => {
    const { instance, el } = makeField({ value: '2026-03-31' })
    instance._openCalendar()
    const clearBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterClear')!
    expect(clearBtn.disabled).toBe(false)
    instance._closeCalendar()
    el.remove()
  })

  it('Clear button clears the date and closes the calendar', () => {
    const { instance, el } = makeField({ value: '2026-03-31' })
    instance._openCalendar()
    const clearBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterClear')!
    clearBtn.click()
    expect(instance.selectedDate).toBeNull()
    expect(instance.calendarEl).toBeNull()
    const daySeg = el.querySelector('[data-segment="day"]')! as HTMLElement
    expect(daySeg.hasAttribute('data-placeholder')).toBe(true)
    el.remove()
  })

  it('Clear button dispatches a change event on the native input', () => {
    const { instance, el } = makeField({ value: '2026-03-31' })
    const changeEvents: Event[] = []
    instance.native.addEventListener('change', e => changeEvents.push(e))
    instance._openCalendar()
    const clearBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterClear')!
    clearBtn.click()
    expect(changeEvents).toHaveLength(1)
    el.remove()
  })

  it('Today button is enabled when today is within the default range', () => {
    const { instance, el } = makeField()
    instance._openCalendar()
    const todayBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterToday')!
    expect(todayBtn.disabled).toBe(false)
    instance._closeCalendar()
    el.remove()
  })

  it('Today button is disabled when today is outside the max date', () => {
    const { instance, el } = makeField({ max: '2000-01-01' })
    instance._openCalendar()
    const todayBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterToday')!
    expect(todayBtn.disabled).toBe(true)
    instance._closeCalendar()
    el.remove()
  })

  it('Today button selects today and closes the calendar', () => {
    const { instance, el } = makeField()
    instance._openCalendar()
    const todayBtn = instance.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterToday')!
    todayBtn.click()
    const today = new Date()
    expect(instance.selectedDate!.getFullYear()).toBe(today.getFullYear())
    expect(instance.selectedDate!.getMonth()).toBe(today.getMonth())
    expect(instance.selectedDate!.getDate()).toBe(today.getDate())
    expect(instance.calendarEl).toBeNull()
    el.remove()
  })
})

describe('DateField — _updateLayout direction', () => {
  it('sets data-direction="bottom" when trigger is near top of viewport', () => {
    const { el, instance } = makeField()

    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue({
      top: 50, bottom: 80, left: 200, right: 250, width: 50, height: 30,
      x: 200, y: 50, toJSON: () => {},
    } as DOMRect)

    vi.spyOn((instance as any).slideContainer, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 1000, width: 1000, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    instance._openCalendar()
    vi.spyOn(instance.calendarEl!, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 300, width: 300, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)
    vi.stubGlobal('innerHeight', 1000)

    ;(instance as any)._updateLayout()

    expect(el.dataset.direction).toBe('bottom')
    instance._closeCalendar()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    el.remove()
  })

  it('sets data-direction="top" when trigger is near bottom of viewport', () => {
    const { el, instance } = makeField()

    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue({
      top: 800, bottom: 830, left: 200, right: 250, width: 50, height: 30,
      x: 200, y: 800, toJSON: () => {},
    } as DOMRect)

    vi.spyOn((instance as any).slideContainer, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 1000, width: 1000, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    instance._openCalendar()
    vi.spyOn(instance.calendarEl!, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 0, left: 0, right: 300, width: 300, height: 0,
      x: 0, y: 0, toJSON: () => {},
    } as DOMRect)
    vi.stubGlobal('innerHeight', 1000)

    ;(instance as any)._updateLayout()

    expect(el.dataset.direction).toBe('top')
    instance._closeCalendar()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    el.remove()
  })
})

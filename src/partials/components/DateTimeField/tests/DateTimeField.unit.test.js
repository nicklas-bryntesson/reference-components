import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

function makeRoot(attrs = '') {
  const dom = new JSDOM(`
    <div data-component="DateTimeField" data-id="test" data-name="test" data-locale="en" ${attrs}>
      <input type="datetime-local" data-part="native" tabindex="-1" aria-hidden="true">
      <div data-part="overlay">
        <div data-part="segments" role="group"></div>
        <button data-part="trigger" type="button"></button>
      </div>
      <template data-part="calendar-template"></template>
      <div data-part="announce" aria-live="polite" aria-atomic="true"></div>
    </div>
  `)
  return dom.window.document.querySelector('[data-component="DateTimeField"]')
}

describe('DateTimeField.attach()', () => {
  it('sets data-initialized on the root', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    expect(root.dataset.initialized).toBe('true')
    root.remove()
  })
})

describe('_buildSegments() — date segments', () => {
  it('builds day, month, year spinbuttons', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const segs = root.querySelectorAll('[data-part="segment"][role="spinbutton"]')
    const types = Array.from(segs).map(s => s.dataset.segment)
    expect(types).toContain('day')
    expect(types).toContain('month')
    expect(types).toContain('year')
    root.remove()
  })

  it('builds hour and minute spinbuttons', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('[data-part="segment"][role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).toContain('hour')
    expect(types).toContain('minute')
    root.remove()
  })

  it('does not build second segment when step is absent', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('[data-part="segment"][role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).not.toContain('second')
    root.remove()
  })

  it('builds second segment when step < 60', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot('data-step="30"')
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('[data-part="segment"][role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).toContain('second')
    root.remove()
  })
})

describe('_syncSegmentsFromDatetime()', () => {
  it('fills all date and time segments from a Date object', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    root.dataset.locale = 'sv' // sv uses 24h so hour=14 stays 14
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    const dt = new Date(2026, 4, 27, 14, 35) // 2026-05-27T14:35
    instance._syncSegmentsFromDatetime(dt)
    expect(instance._getSegmentValueByType('year')).toBe(2026)
    expect(instance._getSegmentValueByType('month')).toBe(5)
    expect(instance._getSegmentValueByType('day')).toBe(27)
    expect(instance._getSegmentValueByType('hour')).toBe(14)
    expect(instance._getSegmentValueByType('minute')).toBe(35)
    root.remove()
  })

  it('correctly syncs leap-year Feb 29', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot('data-locale="sv"')
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    instance._syncSegmentsFromDatetime(new Date(2024, 1, 29, 10, 0)) // Feb 29 2024
    expect(instance._getSegmentValueByType('year')).toBe(2024)
    expect(instance._getSegmentValueByType('month')).toBe(2)
    expect(instance._getSegmentValueByType('day')).toBe(29)
    root.remove()
  })
})

describe('_trySyncToNative()', () => {
  it('writes YYYY-MM-DDTHH:mm to native when all segments filled', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    instance._syncSegmentsFromDatetime(new Date(2026, 4, 27, 9, 5))
    expect(instance.native.value).toBe('2026-05-27T09:05')
    root.remove()
  })

  it('dispatches exactly one change event per value change and announces it', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    let changeCount = 0
    instance.native.addEventListener('change', () => changeCount++)

    // Seven segment writes cascade into _trySyncToNative — the equality gate
    // must collapse them to a single change event.
    instance._syncSegmentsFromDatetime(new Date(2026, 4, 27, 14, 35))
    expect(changeCount).toBe(1)
    expect(root.querySelector('[data-part="announce"]').textContent).toContain('Selected date and time:')

    // Re-syncing the same value is silent.
    instance._syncSegmentsFromDatetime(new Date(2026, 4, 27, 14, 35))
    expect(changeCount).toBe(1)

    // A real change dispatches again.
    instance._setSegmentValue(instance._getSegmentEl('minute'), 36)
    expect(changeCount).toBe(2)
    root.remove()
  })

  it('does not write native when any segment is empty', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    // Only set date segments, leave time empty
    instance._setSegmentValue(instance._getSegmentEl('year'), 2026)
    instance._setSegmentValue(instance._getSegmentEl('month'), 5)
    instance._setSegmentValue(instance._getSegmentEl('day'), 27)
    expect(instance.native.value).toBe('')
    root.remove()
  })

  it('correctly round-trips midnight and noon in 12h locale', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    // midnight
    const root1 = makeRoot() // en = 12h locale
    document.body.appendChild(root1)
    DateTimeField.attach(document.body)
    const inst1 = root1.__dateTimeFieldInstance
    inst1._syncSegmentsFromDatetime(new Date(2026, 0, 1, 0, 0))
    expect(inst1.native.value).toBe('2026-01-01T00:00')
    expect(inst1._getSegmentValueByType('ampm')).toBe(0) // 0 = AM
    root1.remove()
    // noon
    const root2 = makeRoot()
    document.body.appendChild(root2)
    DateTimeField.attach(document.body)
    const inst2 = root2.__dateTimeFieldInstance
    inst2._syncSegmentsFromDatetime(new Date(2026, 0, 1, 12, 0))
    expect(inst2.native.value).toBe('2026-01-01T12:00')
    expect(inst2._getSegmentValueByType('ampm')).toBe(1) // 1 = PM
    root2.remove()
  })
})

describe('_incrementSegment()', () => {
  it('increments hour ArrowUp', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    root.dataset.locale = 'sv' // sv = 24h; must set before attach
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const inst = root.__dateTimeFieldInstance
    const hourSeg = inst._getSegmentEl('hour')
    inst._setSegmentValue(hourSeg, 10)
    inst._incrementSegment(hourSeg, 1)
    expect(inst._getSegmentValueByType('hour')).toBe(11)
    root.remove()
  })

  it('wraps hour from 23 to 0 in 24h mode', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    root.dataset.locale = 'sv' // sv = 24h; must set before attach
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const inst = root.__dateTimeFieldInstance
    const hourSeg = inst._getSegmentEl('hour')
    inst._setSegmentValue(hourSeg, 23)
    inst._incrementSegment(hourSeg, 1)
    expect(inst._getSegmentValueByType('hour')).toBe(0)
    root.remove()
  })

  it('wraps minute from 59 to 0', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    root.dataset.locale = 'sv' // sv = 24h; must set before attach
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const inst = root.__dateTimeFieldInstance
    const minSeg = inst._getSegmentEl('minute')
    inst._setSegmentValue(minSeg, 59)
    inst._incrementSegment(minSeg, 1)
    expect(inst._getSegmentValueByType('minute')).toBe(0)
    root.remove()
  })

  it('toggles ampm segment with ArrowUp', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot() // en = 12h locale, has ampm segment
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const inst = root.__dateTimeFieldInstance
    const ampmSeg = inst._getSegmentEl('ampm')
    if (!ampmSeg) { root.remove(); return } // skip if 24h locale
    inst._incrementSegment(ampmSeg, 1) // AM → PM
    expect(inst._getSegmentValueByType('ampm')).toBe(1)
    inst._incrementSegment(ampmSeg, 1) // PM → AM
    expect(inst._getSegmentValueByType('ampm')).toBe(0)
    root.remove()
  })
})

describe('_handleDigit() — time segments', () => {
  it('accepts two-digit minute entry', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    root.dataset.locale = 'sv' // sv = 24h; must set before attach
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const inst = root.__dateTimeFieldInstance
    const minSeg = inst._getSegmentEl('minute')
    inst._setSegmentFocused(minSeg)
    inst._handleDigit(minSeg, '3')
    inst._handleDigit(minSeg, '5')
    expect(inst._getSegmentValueByType('minute')).toBe(35)
    root.remove()
  })
})

// ─── Empty segments speak a localized word ──────────────────────────────────────

// ─── Calendar day cells are named and marked like DateField's ───────────────────

// _renderMonth only needs a .calendar-grid inside calendarEl — hand it one
// directly instead of driving the whole popup open.
function renderMonth(instance, year, month) {
  const cal = document.createElement('div')
  cal.innerHTML = '<table data-part="calendar-grid" role="grid"></table>'
  instance.calendarEl = cal
  instance.currentYear = year
  instance.currentMonth = month
  instance._renderMonth()
  return cal.querySelector('[data-part="calendar-grid"]')
}

describe('calendar day cells follow the family pattern (DateField)', () => {
  it('every day button carries the full date as its accessible name', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    const grid = renderMonth(instance, 2026, 5) // June 2026

    const btn = grid.querySelector('button[data-date="2026-06-15"]')
    const expected = new Date(2026, 5, 15).toLocaleDateString(instance.localeTag, { dateStyle: 'long' })
    expect(btn.getAttribute('aria-label')).toBe(expected)

    // Outside-month buttons are inert but still in the accessibility tree —
    // a bare digit is not an accessible name.
    for (const b of grid.querySelectorAll('td button')) {
      expect(b.getAttribute('aria-label')).toBeTruthy()
    }
    root.remove()
  })

  it('the selected day is aria-selected on the cell with ", selected" in the name — not aria-pressed', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    instance.selectedDatetime = new Date(2026, 5, 15, 9, 30)
    const grid = renderMonth(instance, 2026, 5)

    const btn = grid.querySelector('button[data-date="2026-06-15"]')
    const td = btn.closest('td')
    expect(td.getAttribute('aria-selected')).toBe('true')
    expect(td.dataset.selected).toBe('true')
    expect(btn.getAttribute('aria-label')).toMatch(/, selected$/)
    // aria-pressed presents the day as a toggle button — wrong model for a
    // calendar choice, and the reason VO said "pressed" instead of "selected".
    expect(btn.hasAttribute('aria-pressed')).toBe(false)

    const other = grid.querySelector('button[data-date="2026-06-16"]').closest('td')
    expect(other.getAttribute('aria-selected')).toBe('false')
    root.remove()
  })

  it('a day outside min/max speaks ", not available"', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot('data-min="2026-06-10T00:00"')
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    const grid = renderMonth(instance, 2026, 5)

    const btn = grid.querySelector('button[data-date="2026-06-05"]')
    expect(btn.closest('td').getAttribute('aria-disabled')).toBe('true')
    expect(btn.getAttribute('aria-label')).toMatch(/, not available$/)
    root.remove()
  })

  it('today speaks ", today"', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    const now = new Date()
    const grid = renderMonth(instance, now.getFullYear(), now.getMonth())

    const btn = grid.querySelector('td[data-today="true"] button')
    expect(btn.getAttribute('aria-label')).toContain(', today')
    root.remove()
  })

  it('the selected day is the single roving tab stop', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const instance = root.__dateTimeFieldInstance
    instance.selectedDatetime = new Date(2026, 5, 15, 9, 30)
    const grid = renderMonth(instance, 2026, 5)

    const stops = grid.querySelectorAll('button[tabindex="0"]')
    expect(stops.length).toBe(1)
    expect(stops[0].dataset.date).toBe('2026-06-15')
    root.remove()
  })
})

describe('empty segments speak a localized word, never the placeholder', () => {
  it('date and time segments all carry aria-valuetext "blank" (en) when empty', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const segs = root.querySelectorAll('[data-part="segment"][role="spinbutton"]')
    for (const seg of segs) {
      if (seg.dataset.segment === 'ampm') continue
      // One word for day/month/year AND hour/minute — the placeholder tokens
      // ("dd"/"mm"/"yyyy" vs "--") read inconsistently across segment types.
      expect(seg.getAttribute('aria-valuetext')).toBe('blank')
      expect(seg.hasAttribute('aria-valuenow')).toBe(false)
    }
    root.remove()
  })
})

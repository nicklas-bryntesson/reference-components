import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

function makeRoot(attrs = '') {
  const dom = new JSDOM(`
    <div data-component="DateTimeField" data-id="test" data-name="test" data-locale="en" ${attrs}>
      <input type="datetime-local" class="DateTimeField-native" tabindex="-1" aria-hidden="true">
      <div class="DateTimeField-overlay">
        <div class="Segments" role="group"></div>
        <button class="DateTimeField-trigger" type="button"></button>
      </div>
      <template class="DateTimeField-calendarTemplate"></template>
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
    expect(root.dataset.initialized).toBeDefined()
    root.remove()
  })
})

describe('_buildSegments() — date segments', () => {
  it('builds day, month, year spinbuttons', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const segs = root.querySelectorAll('.Segment[role="spinbutton"]')
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
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
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
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).not.toContain('second')
    root.remove()
  })

  it('builds second segment when step < 60', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot('data-step="30"')
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
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

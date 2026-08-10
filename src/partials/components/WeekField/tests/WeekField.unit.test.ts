import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatSegment, wrapValue, clampValue, clampWeekISO, weeksInISOYear } from '../WeekField'
import WeekField from '../WeekField'
import { formatWeekISO, parseWeekISO, getISOWeek, getISOWeekYear } from '../../../../kernel/utils/dates'

// ─── matchMedia mock (fine pointer → interactive/custom mode) ────────────────

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

// ─── DOM helper ──────────────────────────────────────────────────────────────

function createWeekFieldEl(options: {
  value?: string
  disabled?: boolean
  min?: string
  max?: string
  locale?: string
} = {}): HTMLElement {
  const id = 'test-wf'
  const div = document.createElement('div')
  div.innerHTML = `
    <label for="${id}">Vecka</label>
    <div
      class="WeekField"
      data-component="WeekField"
      data-id="${id}"
      data-name="${id}"
      data-locale="${options.locale ?? 'sv-SE'}"
      ${options.value ? `data-value="${options.value}"` : ''}
      ${options.disabled ? 'data-disabled="true"' : ''}
      ${options.min ? `data-min="${options.min}"` : ''}
      ${options.max ? `data-max="${options.max}"` : ''}
    >
      <input class="native" type="week" aria-hidden="true" tabindex="-1"
        ${options.value ? `value="${options.value}"` : ''}
        ${options.disabled ? 'disabled' : ''}
      />
      <div class="overlay" aria-hidden="true">
        <div class="segments" role="group"></div>
        <button type="button" class="trigger" aria-label="Öppna veckoväljare" aria-expanded="false" aria-haspopup="dialog"></button>
        <div class="rail">
          <template data-template="weekfield-popup">
            <div class="popup" role="dialog" aria-modal="true">
              <div class="calendar-header">
                <button type="button" class="prev-month">&#8249;</button>
                <span class="calendar-month-year"></span>
                <button type="button" class="next-month">&#8250;</button>
              </div>
              <table class="calendar-grid" role="grid">
                <thead>
                  <tr role="row">
                    <th scope="col" class="week-number-head"></th>
                    <th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th><th scope="col"></th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
              <div class="calendar-footer">
                <button type="button" class="calendar-footer-clear"></button>
                <button type="button" class="calendar-footer-now"></button>
              </div>
              <div class="arrow"></div>
            </div>
          </template>
        </div>
      </div>
      <div class="announce" aria-live="polite" aria-atomic="true"></div>
    </div>
  `
  document.body.appendChild(div)
  return div.querySelector<HTMLElement>('.WeekField')!
}

function fireKey(el: HTMLElement, key: string, extra?: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
}

// ─── Pure utilities ─────────────────────────────────────────────────────────

describe('formatSegment', () => {
  it('pads single digit', () => {
    expect(formatSegment(5)).toBe('05')
    expect(formatSegment(1)).toBe('01')
    expect(formatSegment(53)).toBe('53')
  })
})

describe('wrapValue (week 1↔max)', () => {
  it('wraps 54 to 1 in 1–53', () => expect(wrapValue(54, 1, 53)).toBe(1))
  it('wraps 0 to 53 in 1–53', () => expect(wrapValue(0, 1, 53)).toBe(53))
  it('keeps 27 unchanged', () => expect(wrapValue(27, 1, 53)).toBe(27))
})

describe('clampValue (year)', () => {
  it('clamps below min', () => expect(clampValue(1800, 1900, 2100)).toBe(1900))
  it('clamps above max', () => expect(clampValue(2200, 1900, 2100)).toBe(2100))
  it('keeps in range', () => expect(clampValue(2026, 1900, 2100)).toBe(2026))
})

describe('weeksInISOYear (52 vs 53)', () => {
  // 2020, 2026 are 53-week years; 2021, 2025 are 52-week.
  it('2020 has 53 weeks', () => expect(weeksInISOYear(2020)).toBe(53))
  it('2026 has 53 weeks', () => expect(weeksInISOYear(2026)).toBe(53))
  it('2021 has 52 weeks', () => expect(weeksInISOYear(2021)).toBe(52))
  it('2025 has 52 weeks', () => expect(weeksInISOYear(2025)).toBe(52))
})

describe('parseWeekISO / formatWeekISO round-trip', () => {
  it('formats', () => expect(formatWeekISO(2026, 27)).toBe('2026-W27'))
  it('zero-pads week', () => expect(formatWeekISO(2026, 1)).toBe('2026-W01'))
  it('parses', () => expect(parseWeekISO('2026-W27')).toEqual({ weekYear: 2026, week: 27 }))
  it('returns null for empty', () => expect(parseWeekISO('')).toBeNull())
  it('returns null for malformed', () => expect(parseWeekISO('2026')).toBeNull())
  it('returns null for week 00', () => expect(parseWeekISO('2026-W00')).toBeNull())
})

describe('clampWeekISO', () => {
  it('clamps below min', () => expect(clampWeekISO('2026-W05', '2026-W10', '2026-W40')).toBe('2026-W10'))
  it('clamps above max', () => expect(clampWeekISO('2026-W50', '2026-W10', '2026-W40')).toBe('2026-W40'))
  it('keeps in range', () => expect(clampWeekISO('2026-W27', '2026-W10', '2026-W40')).toBe('2026-W27'))
  it('no bounds is identity', () => expect(clampWeekISO('2026-W27', undefined, undefined)).toBe('2026-W27'))
})

// ─── ISO week-year boundary correctness (the core subtlety) ─────────────────

describe('ISO week-year boundary', () => {
  it('Mon 2025-12-29 is 2026-W01', () => {
    const d = new Date(2025, 11, 29)
    expect(getISOWeekYear(d)).toBe(2026)
    expect(getISOWeek(d)).toBe(1)
  })
  it('2027-01-01 is 2026-W53', () => {
    const d = new Date(2027, 0, 1)
    expect(getISOWeekYear(d)).toBe(2026)
    expect(getISOWeek(d)).toBe(53)
  })
})

// ─── Segment construction ─────────────────────────────────────────────────────

describe('segment construction', () => {
  it('constructs week then year', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    expect(wf._segmentEls).toHaveLength(2)
    expect(wf._segmentEls[0].dataset.segment).toBe('week')
    expect(wf._segmentEls[1].dataset.segment).toBe('year')
  })

  it('week segment has role=spinbutton and 1–max bounds', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const week = wf._getSegmentEl('week')!
    expect(week.getAttribute('role')).toBe('spinbutton')
    expect(week.getAttribute('aria-valuemin')).toBe('1')
    expect(Number(week.getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(52)
    expect(week.hasAttribute('data-placeholder')).toBe(true)
  })

  it('year segment default bounds are current ISO week-year ±100', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const year = wf._getSegmentEl('year')!
    const cy = getISOWeekYear(new Date())
    expect(year.getAttribute('aria-valuemin')).toBe(String(cy - 100))
    expect(year.getAttribute('aria-valuemax')).toBe(String(cy + 100))
  })

  it('first segment gets tabindex=0, second -1 (roving)', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    expect(wf._segmentEls[0].getAttribute('tabindex')).toBe('0')
    expect(wf._segmentEls[1].getAttribute('tabindex')).toBe('-1')
  })

  it('data-initialized after construction', () => {
    const el = createWeekFieldEl()
    new WeekField(el)
    expect(el.getAttribute('data-initialized')).toBe('true')
  })

  it('runs in custom mode on a fine pointer', () => {
    const el = createWeekFieldEl()
    new WeekField(el)
    expect(el.dataset.inputMode).toBe('custom')
  })
})

// ─── Initial value population ─────────────────────────────────────────────────

describe('initial value population', () => {
  it('populates from data-value="2026-W27"', () => {
    const el = createWeekFieldEl({ value: '2026-W27' })
    const wf = new WeekField(el)
    expect(wf._getSegmentEl('week')!.textContent).toBe('27')
    expect(wf._getSegmentEl('week')!.getAttribute('aria-valuenow')).toBe('27')
    expect(wf._getSegmentEl('year')!.textContent).toBe('2026')
    expect(wf.native.value).toBe('2026-W27')
  })

  it('shows placeholders and empty native when no value', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    expect(wf._getSegmentEl('week')!.textContent).toBe('--')
    expect(wf._getSegmentEl('year')!.textContent).toBe('----')
    expect(wf.native.value).toBe('')
  })

  it('week segment aria-valuetext reads "Vecka 27, 2026" (sv)', () => {
    const el = createWeekFieldEl({ value: '2026-W27' })
    const wf = new WeekField(el)
    const text = wf._getSegmentEl('week')!.getAttribute('aria-valuetext')!
    expect(text).toContain('Vecka 27')
    expect(text).toContain('2026')
  })
})

// ─── ArrowUp/Down stepping ─────────────────────────────────────────────────────

describe('week segment wraps at the year boundary', () => {
  it('ArrowUp on week 53 (in a 53-week year) wraps to 1', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026) // 53-week year
    const week = wf._getSegmentEl('week')!
    wf._setSegmentValue(week, 53)
    fireKey(week, 'ArrowUp')
    expect(week.getAttribute('aria-valuenow')).toBe('1')
  })

  it('ArrowDown on week 1 wraps to the year max (53 for 2026)', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026)
    const week = wf._getSegmentEl('week')!
    wf._setSegmentValue(week, 1)
    fireKey(week, 'ArrowDown')
    expect(week.getAttribute('aria-valuenow')).toBe('53')
  })
})

describe('week segment clamps to the year max (52 vs 53)', () => {
  it('week 53 in a 52-week year clamps to 52', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const week = wf._getSegmentEl('week')!
    wf._setSegmentValue(week, 53)
    // switch to a 52-week year → week 53 must clamp down to 52
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2025)
    expect(week.getAttribute('aria-valuenow')).toBe('52')
    expect(week.getAttribute('aria-valuemax')).toBe('52')
  })
})

describe('year segment clamps to bounds', () => {
  it('ArrowUp at max stays at max', () => {
    const el = createWeekFieldEl({ min: '2026-W01', max: '2026-W52' })
    const wf = new WeekField(el)
    const year = wf._getSegmentEl('year')!
    wf._setSegmentValue(year, 2026)
    fireKey(year, 'ArrowUp')
    expect(year.getAttribute('aria-valuenow')).toBe('2026')
  })
})

// ─── Digit entry ───────────────────────────────────────────────────────────────

describe('digit entry', () => {
  it('typing "27" sets week 27', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const week = wf._getSegmentEl('week')!
    fireKey(week, '2')
    fireKey(week, '7')
    expect(week.getAttribute('aria-valuenow')).toBe('27')
    expect(week.textContent).toBe('27')
  })

  it('typing "7" fast-advances week to 7 (no 2-digit week can start with >5)', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const week = wf._getSegmentEl('week')!
    fireKey(week, '7')
    expect(week.getAttribute('aria-valuenow')).toBe('7')
  })

  it('typing full year "2026" sets year', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    const year = wf._getSegmentEl('year')!
    fireKey(year, '2')
    fireKey(year, '0')
    fireKey(year, '2')
    fireKey(year, '6')
    expect(year.getAttribute('aria-valuenow')).toBe('2026')
  })
})

// ─── Sync to native ─────────────────────────────────────────────────────────────

describe('sync to native', () => {
  it('writes YYYY-Www once both segments are set', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026)
    wf._setSegmentValue(wf._getSegmentEl('week')!, 27)
    expect(wf.native.value).toBe('2026-W27')
  })

  it('native is empty when only week set', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('week')!, 27)
    expect(wf.native.value).toBe('')
  })

  it('native is empty when only year set', () => {
    const el = createWeekFieldEl()
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026)
    expect(wf.native.value).toBe('')
  })
})

// ─── Bounds enforcement (data-min/max as YYYY-Www) ──────────────────────────────

describe('min/max enforcement across segments', () => {
  it('clamps a below-min combination up to min', () => {
    const el = createWeekFieldEl({ min: '2026-W10', max: '2026-W40' })
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026)
    wf._setSegmentValue(wf._getSegmentEl('week')!, 5) // < W10
    expect(wf.native.value).toBe('2026-W10')
  })

  it('clamps an above-max combination down to max', () => {
    const el = createWeekFieldEl({ min: '2026-W10', max: '2026-W40' })
    const wf = new WeekField(el)
    wf._setSegmentValue(wf._getSegmentEl('year')!, 2026)
    wf._setSegmentValue(wf._getSegmentEl('week')!, 50) // > W40
    expect(wf.native.value).toBe('2026-W40')
  })
})

// ─── Disabled ────────────────────────────────────────────────────────────────────

describe('disabled state', () => {
  it('segments are aria-disabled and tabindex -1', () => {
    const el = createWeekFieldEl({ disabled: true })
    const wf = new WeekField(el)
    wf._segmentEls.forEach(seg => {
      expect(seg.getAttribute('aria-disabled')).toBe('true')
      expect(seg.getAttribute('tabindex')).toBe('-1')
    })
  })

  it('trigger is disabled', () => {
    const el = createWeekFieldEl({ disabled: true })
    const wf = new WeekField(el)
    expect(wf.trigger.disabled).toBe(true)
  })

  it('ArrowUp on disabled week does nothing', () => {
    const el = createWeekFieldEl({ disabled: true })
    const wf = new WeekField(el)
    const week = wf._getSegmentEl('week')!
    fireKey(week, 'ArrowUp')
    expect(week.hasAttribute('data-placeholder')).toBe(true)
  })
})

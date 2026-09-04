import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatSegment, wrapValue, clampValue, clampMonthISO } from '../MonthField'
import MonthField from '../MonthField'
import { formatMonthISO, parseMonthISO } from '../../../../kernel/utils/dates'

// ─── matchMedia mock ─────────────────────────────────────────────────────────

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

function createMonthFieldEl(options: {
  value?: string
  disabled?: boolean
  min?: string
  max?: string
  locale?: string
} = {}): HTMLElement {
  const id = 'test-mf'
  const div = document.createElement('div')
  div.innerHTML = `
    <label for="${id}">Månad</label>
    <div
      class="MonthField"
      data-component="MonthField"
      data-id="${id}"
      data-name="${id}"
      data-locale="${options.locale ?? 'sv-SE'}"
      ${options.value ? `data-value="${options.value}"` : ''}
      ${options.disabled ? 'data-disabled="true"' : ''}
      ${options.min ? `data-min="${options.min}"` : ''}
      ${options.max ? `data-max="${options.max}"` : ''}
    >
      <input data-part="native" type="month" aria-hidden="true" tabindex="-1"
        ${options.value ? `value="${options.value}"` : ''}
        ${options.disabled ? 'disabled' : ''}
      />
      <div data-part="overlay" aria-hidden="true">
        <div data-part="segments" role="group"></div>
        <button type="button" data-part="trigger" aria-label="Öppna månadsväljare" aria-expanded="false" aria-haspopup="dialog"></button>
        <div data-part="rail">
          <template data-template="monthfield-popup">
            <div data-part="popup" role="dialog" aria-modal="true" aria-label="Välj månad">
              <div data-part="year-month-picker">
                <div class="Wheel" data-picker="month" role="spinbutton" tabindex="0"></div>
                <div class="Wheel" data-picker="year" role="spinbutton" tabindex="-1"></div>
              </div>
              <div data-part="footer">
                <button type="button" data-part="footer-clear">Rensa</button>
                <button type="button" data-part="footer-now">Denna månad</button>
              </div>
              <div data-part="arrow"></div>
            </div>
          </template>
        </div>
      </div>
      <div data-part="announce" aria-live="polite" aria-atomic="true"></div>
    </div>
  `
  document.body.appendChild(div)
  return div.querySelector<HTMLElement>('.MonthField')!
}

function fireKey(el: HTMLElement, key: string, extra?: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
}

// ─── Pure utilities ─────────────────────────────────────────────────────────

describe('formatSegment', () => {
  it('pads single digit', () => {
    expect(formatSegment(5)).toBe('05')
    expect(formatSegment(0)).toBe('00')
    expect(formatSegment(11)).toBe('11')
  })
})

describe('wrapValue (month Dec↔Jan)', () => {
  it('wraps 12 to 0 in 0–11', () => expect(wrapValue(12, 0, 11)).toBe(0))
  it('wraps -1 to 11 in 0–11', () => expect(wrapValue(-1, 0, 11)).toBe(11))
  it('keeps 6 unchanged', () => expect(wrapValue(6, 0, 11)).toBe(6))
})

describe('clampValue (year)', () => {
  it('clamps below min', () => expect(clampValue(1800, 1900, 2100)).toBe(1900))
  it('clamps above max', () => expect(clampValue(2200, 1900, 2100)).toBe(2100))
  it('keeps in range', () => expect(clampValue(2026, 1900, 2100)).toBe(2026))
})

describe('parseMonthISO / formatMonthISO round-trip', () => {
  it('formats zero-based month', () => expect(formatMonthISO(2026, 5)).toBe('2026-06'))
  it('parses to zero-based month', () => expect(parseMonthISO('2026-06')).toEqual({ year: 2026, month: 5 }))
  it('parses January', () => expect(parseMonthISO('2026-01')).toEqual({ year: 2026, month: 0 }))
  it('parses December', () => expect(parseMonthISO('2026-12')).toEqual({ year: 2026, month: 11 }))
  it('returns null for empty', () => expect(parseMonthISO('')).toBeNull())
  it('returns null for malformed', () => expect(parseMonthISO('2026')).toBeNull())
  it('returns null for month 13', () => expect(parseMonthISO('2026-13')).toBeNull())
})

describe('clampMonthISO', () => {
  it('clamps below min', () => expect(clampMonthISO('2026-01', '2026-03', '2026-09')).toBe('2026-03'))
  it('clamps above max', () => expect(clampMonthISO('2026-12', '2026-03', '2026-09')).toBe('2026-09'))
  it('keeps in range', () => expect(clampMonthISO('2026-06', '2026-03', '2026-09')).toBe('2026-06'))
  it('no bounds is identity', () => expect(clampMonthISO('2026-06', undefined, undefined)).toBe('2026-06'))
})

// ─── Segment construction ─────────────────────────────────────────────────────

describe('segment construction', () => {
  it('constructs month then year', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    expect(mf._segmentEls).toHaveLength(2)
    expect(mf._segmentEls[0].dataset.segment).toBe('month')
    expect(mf._segmentEls[1].dataset.segment).toBe('year')
  })

  it('month segment has role=spinbutton and 0–11 bounds', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    expect(month.getAttribute('role')).toBe('spinbutton')
    expect(month.getAttribute('aria-valuemin')).toBe('0')
    expect(month.getAttribute('aria-valuemax')).toBe('11')
    expect(month.hasAttribute('data-placeholder')).toBe(true)
  })

  it('year segment default bounds are current year ±100', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const year = mf._getSegmentEl('year')!
    const cy = new Date().getFullYear()
    expect(year.getAttribute('aria-valuemin')).toBe(String(cy - 100))
    expect(year.getAttribute('aria-valuemax')).toBe(String(cy + 100))
  })

  it('first segment gets tabindex=0, second -1 (roving)', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    expect(mf._segmentEls[0].getAttribute('tabindex')).toBe('0')
    expect(mf._segmentEls[1].getAttribute('tabindex')).toBe('-1')
  })

  it('separator is aria-hidden with "/"', () => {
    const el = createMonthFieldEl()
    new MonthField(el)
    const seps = el.querySelectorAll('[data-part="separator"]')
    expect(seps).toHaveLength(1)
    expect(seps[0].getAttribute('aria-hidden')).toBe('true')
    expect(seps[0].textContent).toBe('/')
  })

  it('data-initialized after construction', () => {
    const el = createMonthFieldEl()
    new MonthField(el)
    expect(el.getAttribute('data-initialized')).toBe('true')
  })
})

// ─── Initial value population ─────────────────────────────────────────────────

describe('initial value population', () => {
  it('populates from data-value="2026-06"', () => {
    const el = createMonthFieldEl({ value: '2026-06' })
    const mf = new MonthField(el)
    expect(mf._getSegmentEl('month')!.textContent).toBe('06')
    expect(mf._getSegmentEl('month')!.getAttribute('aria-valuenow')).toBe('5')
    expect(mf._getSegmentEl('year')!.textContent).toBe('2026')
    expect(mf.native.value).toBe('2026-06')
  })

  it('shows placeholders and empty native when no value', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    expect(mf._getSegmentEl('month')!.textContent).toBe('--')
    expect(mf._getSegmentEl('year')!.textContent).toBe('----')
    expect(mf.native.value).toBe('')
  })

  it('month segment aria-valuetext carries the month name + year (sv)', () => {
    const el = createMonthFieldEl({ value: '2026-06' })
    const mf = new MonthField(el)
    const text = mf._getSegmentEl('month')!.getAttribute('aria-valuetext')!
    // sv-SE June = "juni"
    expect(text.toLowerCase()).toContain('juni')
    expect(text).toContain('2026')
  })
})

// ─── ArrowUp/Down stepping ─────────────────────────────────────────────────────

describe('month segment wraps Dec↔Jan', () => {
  it('ArrowUp on December (11) wraps to January (0)', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    mf._setSegmentValue(month, 11)
    fireKey(month, 'ArrowUp')
    expect(month.getAttribute('aria-valuenow')).toBe('0')
  })

  it('ArrowDown on January (0) wraps to December (11)', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    mf._setSegmentValue(month, 0)
    fireKey(month, 'ArrowDown')
    expect(month.getAttribute('aria-valuenow')).toBe('11')
  })
})

describe('year segment clamps to bounds', () => {
  it('ArrowUp at max stays at max', () => {
    const el = createMonthFieldEl({ min: '2026-01', max: '2026-12' })
    const mf = new MonthField(el)
    const year = mf._getSegmentEl('year')!
    mf._setSegmentValue(year, 2026)
    fireKey(year, 'ArrowUp')
    expect(year.getAttribute('aria-valuenow')).toBe('2026')
  })

  it('ArrowDown at min stays at min', () => {
    const el = createMonthFieldEl({ min: '2026-01', max: '2026-12' })
    const mf = new MonthField(el)
    const year = mf._getSegmentEl('year')!
    mf._setSegmentValue(year, 2026)
    fireKey(year, 'ArrowDown')
    expect(year.getAttribute('aria-valuenow')).toBe('2026')
  })
})

// ─── Digit entry ───────────────────────────────────────────────────────────────

describe('digit entry (month is 1-based for the user, stored 0-based)', () => {
  it('typing "06" sets month to June (index 5)', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    fireKey(month, '0')
    fireKey(month, '6')
    expect(month.getAttribute('aria-valuenow')).toBe('5')
    expect(month.textContent).toBe('06')
  })

  it('typing "2" fast-advances month to February (index 1)', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    fireKey(month, '2')
    expect(month.getAttribute('aria-valuenow')).toBe('1')
  })

  it('typing full year "2026" sets year', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const year = mf._getSegmentEl('year')!
    fireKey(year, '2')
    fireKey(year, '0')
    fireKey(year, '2')
    fireKey(year, '6')
    expect(year.getAttribute('aria-valuenow')).toBe('2026')
  })
})

// ─── Sync to native ─────────────────────────────────────────────────────────────

describe('sync to native', () => {
  it('writes YYYY-MM once both segments are set', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    mf._setSegmentValue(mf._getSegmentEl('year')!, 2026)
    mf._setSegmentValue(mf._getSegmentEl('month')!, 5)
    expect(mf.native.value).toBe('2026-06')
  })

  it('native is empty when only month set', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    mf._setSegmentValue(mf._getSegmentEl('month')!, 5)
    expect(mf.native.value).toBe('')
  })

  it('native is empty when only year set', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    mf._setSegmentValue(mf._getSegmentEl('year')!, 2026)
    expect(mf.native.value).toBe('')
  })
})

// ─── Bounds enforcement (data-min/max as YYYY-MM) ───────────────────────────────

describe('min/max enforcement across segments', () => {
  it('clamps a below-min combination up to min', () => {
    const el = createMonthFieldEl({ min: '2026-03', max: '2026-09' })
    const mf = new MonthField(el)
    mf._setSegmentValue(mf._getSegmentEl('year')!, 2026)
    mf._setSegmentValue(mf._getSegmentEl('month')!, 0) // January < March
    expect(mf.native.value).toBe('2026-03')
  })

  it('clamps an above-max combination down to max', () => {
    const el = createMonthFieldEl({ min: '2026-03', max: '2026-09' })
    const mf = new MonthField(el)
    mf._setSegmentValue(mf._getSegmentEl('year')!, 2026)
    mf._setSegmentValue(mf._getSegmentEl('month')!, 11) // December > September
    expect(mf.native.value).toBe('2026-09')
  })
})

// ─── Disabled ────────────────────────────────────────────────────────────────────

describe('disabled state', () => {
  it('segments are aria-disabled and tabindex -1', () => {
    const el = createMonthFieldEl({ disabled: true })
    const mf = new MonthField(el)
    mf._segmentEls.forEach(seg => {
      expect(seg.getAttribute('aria-disabled')).toBe('true')
      expect(seg.getAttribute('tabindex')).toBe('-1')
    })
  })

  it('trigger is disabled', () => {
    const el = createMonthFieldEl({ disabled: true })
    const mf = new MonthField(el)
    expect(mf.trigger.disabled).toBe(true)
  })

  it('ArrowUp on disabled month does nothing', () => {
    const el = createMonthFieldEl({ disabled: true })
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    fireKey(month, 'ArrowUp')
    expect(month.hasAttribute('data-placeholder')).toBe(true)
  })
})

// ─── Empty segments speak a localized word ──────────────────────────────────────

describe('empty segments speak a localized word, never the visible placeholder', () => {
  it('empty segments carry aria-valuetext "tomt" (sv) with visible "--" intact', () => {
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    const month = mf._getSegmentEl('month')!
    expect(month.getAttribute('aria-valuetext')).toBe('tomt')
    expect(month.textContent).toBe('--')
    expect(month.hasAttribute('aria-valuenow')).toBe(false)
  })
})

// ─── Footer "This month": the committed value is spoken ─────────────────────────

describe('"This month" announces the committed month', () => {
  it('writes the committed month to the live region before closing', () => {
    // Closing moves focus to the trigger, whose label says nothing about WHAT
    // was set — the live region is the only thing that speaks the new value.
    const el = createMonthFieldEl()
    const mf = new MonthField(el)
    ;(mf as any)._handleThisMonth() // private — invoked directly; the button lives in the popup
    const announce = el.querySelector('[data-part="announce"]')!
    expect(announce.textContent).not.toBe('')
    expect(announce.textContent).toContain(String(new Date().getFullYear()))
  })
})

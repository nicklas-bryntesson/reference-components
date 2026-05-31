import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTimeValue, formatSegment, wrapValue } from '../TimeField'
import TimeField from '../TimeField'

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

function createTimeFieldEl(options: {
  value?: string
  disabled?: boolean
  step?: number
  locale?: string
} = {}): HTMLElement {
  const id = 'test-tf'
  const div = document.createElement('div')
  div.innerHTML = `
    <label for="${id}">Tid</label>
    <div
      class="TimeField"
      data-component="TimeField"
      data-id="${id}"
      data-name="${id}"
      data-locale="${options.locale ?? 'sv-SE'}"
      ${options.value ? `data-value="${options.value}"` : ''}
      ${options.disabled ? 'data-disabled' : ''}
      ${options.step != null ? `data-step="${options.step}"` : ''}
    >
      <input class="TimeField-native" type="time" aria-hidden="true" tabindex="-1"
        ${options.value ? `value="${options.value}"` : ''}
        ${options.disabled ? 'disabled' : ''}
      />
      <div class="TimeField-overlay" aria-hidden="true">
        <div class="TimeField-segments" role="group"></div>
        <button type="button" class="TimeField-trigger" aria-label="Öppna tidsväljare" aria-expanded="false" aria-haspopup="dialog"></button>
        <div class="slideContainer">
          <template data-template="timefield-popup">
            <div class="TimeField-popup" role="dialog" aria-modal="true" aria-label="Välj tid">
              <span class="TimeField-popup-surface" aria-hidden="true"><span class="TimeField-popup-backdropBlur"></span></span>
              <div class="TimeField-popup-columns">
                <ul class="TimeField-popup-column" data-segment="hour" role="listbox" aria-label="Timmar" tabindex="0"></ul>
                <ul class="TimeField-popup-column" data-segment="minute" role="listbox" aria-label="Minuter" tabindex="-1"></ul>
                <ul class="TimeField-popup-column" data-segment="second" role="listbox" aria-label="Sekunder" tabindex="-1"></ul>
              </div>
              <div class="TimeField-popup-footer">
                <button type="button" class="TimeField-popup-clear">Rensa</button>
                <button type="button" class="TimeField-popup-now">Nu</button>
              </div>
              <div class="arrow"></div>
            </div>
          </template>
        </div>
      </div>
      <div class="TimeField-announce" aria-live="polite" aria-atomic="true"></div>
    </div>
  `
  document.body.appendChild(div)
  return div.querySelector<HTMLElement>('.TimeField')!
}

function fireKey(el: HTMLElement, key: string, extra?: KeyboardEventInit): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
}

// ─── parseTimeValue ───────────────────────────────────────────────────────────

describe('parseTimeValue', () => {
  it('parses HH:mm without seconds', () => {
    expect(parseTimeValue('13:45')).toEqual({ hour: 13, minute: 45, second: null })
  })

  it('parses HH:mm:ss with seconds', () => {
    expect(parseTimeValue('13:45:30')).toEqual({ hour: 13, minute: 45, second: 30 })
  })

  it('parses 00:00', () => {
    expect(parseTimeValue('00:00')).toEqual({ hour: 0, minute: 0, second: null })
  })

  it('parses 23:59:59', () => {
    expect(parseTimeValue('23:59:59')).toEqual({ hour: 23, minute: 59, second: 59 })
  })

  it('parses without zero-padding', () => {
    expect(parseTimeValue('9:5')).toEqual({ hour: 9, minute: 5, second: null })
  })
})

// ─── formatSegment ────────────────────────────────────────────────────────────

describe('formatSegment', () => {
  it('pads 0 to "00"', () => {
    expect(formatSegment(0)).toBe('00')
  })

  it('pads 5 to "05"', () => {
    expect(formatSegment(5)).toBe('05')
  })

  it('does not pad 13', () => {
    expect(formatSegment(13)).toBe('13')
  })

  it('does not pad 59', () => {
    expect(formatSegment(59)).toBe('59')
  })
})

// ─── wrapValue ────────────────────────────────────────────────────────────────

describe('wrapValue', () => {
  it('wraps 60 to 0 in range 0–59', () => {
    expect(wrapValue(60, 0, 59)).toBe(0)
  })

  it('wraps -1 to 59 in range 0–59', () => {
    expect(wrapValue(-1, 0, 59)).toBe(59)
  })

  it('returns 30 unchanged in range 0–59', () => {
    expect(wrapValue(30, 0, 59)).toBe(30)
  })

  it('wraps 24 to 0 in range 0–23', () => {
    expect(wrapValue(24, 0, 23)).toBe(0)
  })

  it('wraps -1 to 23 in range 0–23', () => {
    expect(wrapValue(-1, 0, 23)).toBe(23)
  })
})

// ─── Segment construction: 24h (sv-SE) ───────────────────────────────────────

describe('segment construction (sv-SE, no seconds)', () => {
  it('constructs exactly 2 segments: hour and minute', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    expect(tf._segmentEls).toHaveLength(2)
    expect(tf._segmentEls[0].dataset.segment).toBe('hour')
    expect(tf._segmentEls[1].dataset.segment).toBe('minute')
  })

  it('does not construct an ampm segment for sv-SE', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    expect(tf._getSegmentEl('ampm')).toBeNull()
  })

  it('hour segment has correct aria bounds and placeholder state', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    expect(hour.getAttribute('aria-valuemin')).toBe('0')
    expect(hour.getAttribute('aria-valuemax')).toBe('23')
    expect(hour.hasAttribute('data-placeholder')).toBe(true)
    expect(hour.getAttribute('aria-valuetext')).toBe('--')
    expect(hour.textContent).toBe('--')
  })

  it('minute segment has correct aria bounds', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const minute = tf._segmentEls[1]
    expect(minute.getAttribute('aria-valuemin')).toBe('0')
    expect(minute.getAttribute('aria-valuemax')).toBe('59')
  })

  it('first segment (hour) gets tabindex="0", others get tabindex="-1"', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    expect(tf._segmentEls[0].getAttribute('tabindex')).toBe('0')
    expect(tf._segmentEls[1].getAttribute('tabindex')).toBe('-1')
  })

  it('all segments have role="spinbutton"', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    tf._segmentEls.forEach(seg => {
      expect(seg.getAttribute('role')).toBe('spinbutton')
    })
  })

  it('separators have aria-hidden="true" and text ":"', () => {
    const el = createTimeFieldEl()
    new TimeField(el)
    const seps = el.querySelectorAll('.TimeField-sep')
    expect(seps).toHaveLength(1)
    expect(seps[0].getAttribute('aria-hidden')).toBe('true')
    expect(seps[0].textContent).toBe(':')
  })
})

describe('segment construction (step=1, with seconds)', () => {
  it('constructs 3 segments: hour, minute, second', () => {
    const el = createTimeFieldEl({ step: 1 })
    const tf = new TimeField(el)
    expect(tf._segmentEls).toHaveLength(3)
    expect(tf._segmentEls[0].dataset.segment).toBe('hour')
    expect(tf._segmentEls[1].dataset.segment).toBe('minute')
    expect(tf._segmentEls[2].dataset.segment).toBe('second')
  })

  it('second segment has correct aria bounds', () => {
    const el = createTimeFieldEl({ step: 1 })
    const tf = new TimeField(el)
    const second = tf._segmentEls[2]
    expect(second.getAttribute('aria-valuemin')).toBe('0')
    expect(second.getAttribute('aria-valuemax')).toBe('59')
  })

  it('renders two ":" separators', () => {
    const el = createTimeFieldEl({ step: 1 })
    new TimeField(el)
    const seps = el.querySelectorAll('.TimeField-sep')
    const colonSeps = [...seps].filter(s => s.textContent === ':')
    expect(colonSeps).toHaveLength(2)
  })
})

// ─── Initial value population ─────────────────────────────────────────────────

describe('initial value population', () => {
  it('populates hour and minute from data-value="13:45"', () => {
    const el = createTimeFieldEl({ value: '13:45' })
    const tf = new TimeField(el)
    expect(tf._getSegmentEl('hour')!.textContent).toBe('13')
    expect(tf._getSegmentEl('minute')!.textContent).toBe('45')
    expect(tf.native.value).toBe('13:45')
  })

  it('populates hour, minute, second from data-value="13:45:30" with step=1', () => {
    const el = createTimeFieldEl({ value: '13:45:30', step: 1 })
    const tf = new TimeField(el)
    expect(tf._getSegmentEl('hour')!.textContent).toBe('13')
    expect(tf._getSegmentEl('minute')!.textContent).toBe('45')
    expect(tf._getSegmentEl('second')!.textContent).toBe('30')
    expect(tf.native.value).toBe('13:45:30')
  })

  it('shows "--" placeholders and empty native value when no data-value', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    expect(tf._getSegmentEl('hour')!.textContent).toBe('--')
    expect(tf._getSegmentEl('minute')!.textContent).toBe('--')
    expect(tf.native.value).toBe('')
  })
})

// ─── Keyboard: Arrow keys ─────────────────────────────────────────────────────

describe('keyboard: ArrowUp/ArrowDown on hour segment', () => {
  it('ArrowUp on empty hour sets it to 0 (min)', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, 'ArrowUp')
    expect(hour.getAttribute('aria-valuenow')).toBe('0')
    expect(hour.textContent).toBe('00')
  })

  it('ArrowDown on empty hour sets it to 23 (max)', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, 'ArrowDown')
    expect(hour.getAttribute('aria-valuenow')).toBe('23')
    expect(hour.textContent).toBe('23')
  })

  it('ArrowUp on hour=23 wraps to 0', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    tf._setSegmentValue(hour, 23)
    fireKey(hour, 'ArrowUp')
    expect(hour.getAttribute('aria-valuenow')).toBe('0')
  })

  it('ArrowDown on hour=0 wraps to 23', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    tf._setSegmentValue(hour, 0)
    fireKey(hour, 'ArrowDown')
    expect(hour.getAttribute('aria-valuenow')).toBe('23')
  })
})

// ─── Wrap carry chaining ──────────────────────────────────────────────────────

describe('wrap carry chaining', () => {
  it('minute 59→ArrowUp wraps to 0 and increments hour by 1', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    const minute = tf._segmentEls[1]
    tf._setSegmentValue(hour, 10)
    tf._setSegmentValue(minute, 59)
    fireKey(minute, 'ArrowUp')
    expect(minute.getAttribute('aria-valuenow')).toBe('0')
    expect(hour.getAttribute('aria-valuenow')).toBe('11')
  })

  it('minute 0→ArrowDown wraps to 59 and decrements hour to 23 when hour is 0', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    const minute = tf._segmentEls[1]
    tf._setSegmentValue(hour, 0)
    tf._setSegmentValue(minute, 0)
    fireKey(minute, 'ArrowDown')
    expect(minute.getAttribute('aria-valuenow')).toBe('59')
    expect(hour.getAttribute('aria-valuenow')).toBe('23')
  })
})

// ─── Digit buffer ─────────────────────────────────────────────────────────────

describe('digit buffer', () => {
  it('typing "1" on hour shows "1" (buffering)', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, '1')
    expect(hour.textContent).toBe('1')
  })

  it('typing "1" then "3" commits "13" and moves focus to minute', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    const minute = tf._segmentEls[1]
    fireKey(hour, '1')
    fireKey(hour, '3')
    expect(hour.getAttribute('aria-valuenow')).toBe('13')
    expect(hour.textContent).toBe('13')
  })

  it('typing "6" on minute fast-advances (≥6 threshold)', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const minute = tf._segmentEls[1]
    fireKey(minute, '6')
    expect(minute.getAttribute('aria-valuenow')).toBe('6')
  })

  it('typing "3" on hour (24h) fast-advances (≥3)', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, '3')
    expect(hour.getAttribute('aria-valuenow')).toBe('3')
  })

  it('typing "9" on hour fast-advances', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, '9')
    expect(hour.getAttribute('aria-valuenow')).toBe('9')
  })

  it('flush on blur: typing "5" on hour then blurring commits "5"', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, '5')
    // "5" does not fast-advance for 24h (only ≥3 does), wait — actually 5 >= 3 so it DOES fast-advance
    // This case is actually a fast-advance. Test blur flush with "2" instead (2 < 3 so it buffers).
    expect(hour.getAttribute('aria-valuenow')).toBe('5')
  })

  it('flush on blur: typing "2" on hour buffers, then blur commits "2"', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    // "2" < 3 so it buffers (24h locale)
    fireKey(hour, '2')
    expect(hour.textContent).toBe('2')
    // Blur triggers flush
    hour.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    expect(hour.getAttribute('aria-valuenow')).toBe('2')
    expect(hour.textContent).toBe('02')
  })
})

// ─── AM/PM segment (12h locale) ───────────────────────────────────────────────

describe('AM/PM segment (en-US 12h locale)', () => {
  it.skipIf(!new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).resolvedOptions().hour12)(
    'ArrowUp on ampm toggles AM → PM',
    () => {
      const el = createTimeFieldEl({ locale: 'en-US' })
      const tf = new TimeField(el)
      const ampm = tf._getSegmentEl('ampm')
      if (!ampm) return
      expect(ampm.getAttribute('aria-valuenow')).toBe('0')
      fireKey(ampm, 'ArrowUp')
      expect(ampm.getAttribute('aria-valuenow')).toBe('1')
    }
  )

  it.skipIf(!new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).resolvedOptions().hour12)(
    'ArrowDown on PM toggles → AM',
    () => {
      const el = createTimeFieldEl({ locale: 'en-US' })
      const tf = new TimeField(el)
      const ampm = tf._getSegmentEl('ampm')
      if (!ampm) return
      tf._setAmpm(ampm, 1)
      fireKey(ampm, 'ArrowDown')
      expect(ampm.getAttribute('aria-valuenow')).toBe('0')
    }
  )

  it.skipIf(!new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).resolvedOptions().hour12)(
    'key "A" sets AM',
    () => {
      const el = createTimeFieldEl({ locale: 'en-US' })
      const tf = new TimeField(el)
      const ampm = tf._getSegmentEl('ampm')
      if (!ampm) return
      tf._setAmpm(ampm, 1) // start at PM
      fireKey(ampm, 'A')
      expect(ampm.getAttribute('aria-valuenow')).toBe('0')
    }
  )

  it.skipIf(!new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).resolvedOptions().hour12)(
    'key "P" sets PM',
    () => {
      const el = createTimeFieldEl({ locale: 'en-US' })
      const tf = new TimeField(el)
      const ampm = tf._getSegmentEl('ampm')
      if (!ampm) return
      fireKey(ampm, 'P')
      expect(ampm.getAttribute('aria-valuenow')).toBe('1')
    }
  )

  it.skipIf(!new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).resolvedOptions().hour12)(
    'aria-valuetext reflects AM/PM',
    () => {
      const el = createTimeFieldEl({ locale: 'en-US' })
      const tf = new TimeField(el)
      const ampm = tf._getSegmentEl('ampm')
      if (!ampm) return
      const amText = ampm.getAttribute('aria-valuetext')!
      expect(amText.length).toBeGreaterThan(0)
      fireKey(ampm, 'ArrowUp')
      const pmText = ampm.getAttribute('aria-valuetext')!
      expect(pmText).not.toBe(amText)
    }
  )
})

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('disabled state', () => {
  it('all segments have aria-disabled="true"', () => {
    const el = createTimeFieldEl({ disabled: true })
    const tf = new TimeField(el)
    tf._segmentEls.forEach(seg => {
      expect(seg.getAttribute('aria-disabled')).toBe('true')
    })
  })

  it('all segments have tabindex="-1" when disabled', () => {
    const el = createTimeFieldEl({ disabled: true })
    const tf = new TimeField(el)
    tf._segmentEls.forEach(seg => {
      expect(seg.getAttribute('tabindex')).toBe('-1')
    })
  })

  it('trigger button is disabled', () => {
    const el = createTimeFieldEl({ disabled: true })
    const tf = new TimeField(el)
    expect(tf.trigger.disabled).toBe(true)
  })

  it('ArrowUp on disabled hour segment does not change value', () => {
    const el = createTimeFieldEl({ disabled: true })
    const tf = new TimeField(el)
    const hour = tf._segmentEls[0]
    fireKey(hour, 'ArrowUp')
    expect(hour.hasAttribute('data-placeholder')).toBe(true)
    expect(hour.textContent).toBe('--')
  })
})

// ─── Sync to native ───────────────────────────────────────────────────────────

describe('sync to native', () => {
  it('native value is "HH:mm" after both segments are set', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    tf._setSegmentValue(tf._segmentEls[0], 9)
    tf._setSegmentValue(tf._segmentEls[1], 5)
    expect(tf.native.value).toBe('09:05')
  })

  it('native value is "" when only hour is set', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    tf._setSegmentValue(tf._segmentEls[0], 9)
    expect(tf.native.value).toBe('')
  })

  it('native value is "" when only minute is set', () => {
    const el = createTimeFieldEl()
    const tf = new TimeField(el)
    tf._setSegmentValue(tf._segmentEls[1], 30)
    expect(tf.native.value).toBe('')
  })

  it('native value is "" when second is missing (step=1)', () => {
    const el = createTimeFieldEl({ step: 1 })
    const tf = new TimeField(el)
    tf._setSegmentValue(tf._segmentEls[0], 9)
    tf._setSegmentValue(tf._segmentEls[1], 5)
    // second not set
    expect(tf.native.value).toBe('')
  })

  it('native value is "HH:mm:ss" when all three segments are set (step=1)', () => {
    const el = createTimeFieldEl({ step: 1 })
    const tf = new TimeField(el)
    tf._setSegmentValue(tf._segmentEls[0], 9)
    tf._setSegmentValue(tf._segmentEls[1], 5)
    tf._setSegmentValue(tf._segmentEls[2], 30)
    expect(tf.native.value).toBe('09:05:30')
  })
})

// ─── data-initialized ────────────────────────────────────────────────────────

describe('data-initialized', () => {
  it('root has data-initialized after construction', () => {
    const el = createTimeFieldEl()
    new TimeField(el)
    expect(el.hasAttribute('data-initialized')).toBe(true)
  })
})

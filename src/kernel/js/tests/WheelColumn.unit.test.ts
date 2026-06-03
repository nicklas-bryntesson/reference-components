import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WheelColumn, { type WheelColumnOptions } from '../WheelColumn'

// Kernel conformance tests for the WheelColumn DOM primitive. These exercise the
// public API + the drift-prone maths (loop wrap, bounded clamp, onChange gating,
// format, ARIA). The interactive physics (drag/momentum/snap) is covered by the
// component e2e suites. We mock prefers-reduced-motion: reduce so animations
// short-circuit synchronously — no requestAnimationFrame needed.

function makeWheel(opts: Partial<WheelColumnOptions> = {}): {
  el: HTMLElement
  wheel: WheelColumn
  onChange: ReturnType<typeof vi.fn>
} {
  const el = document.createElement('div')
  el.className = 'Wheel'
  el.id = 'test-wheel'
  document.body.appendChild(el)
  const onChange = vi.fn()
  const wheel = new WheelColumn(el, { min: 0, max: 11, value: 0, onChange, ...opts })
  return { el, wheel, onChange }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('WheelColumn — construction & ARIA', () => {
  it('marks the host as a spinbutton with min/max', () => {
    const { el } = makeWheel({ min: 0, max: 11 })
    expect(el.getAttribute('role')).toBe('spinbutton')
    expect(el.getAttribute('aria-valuemin')).toBe('0')
    expect(el.getAttribute('aria-valuemax')).toBe('11')
  })

  it('sets tabindex="0" when the host has none', () => {
    const { el } = makeWheel()
    expect(el.getAttribute('tabindex')).toBe('0')
  })

  it('reflects the initial value in aria-valuenow + aria-valuetext (default zero-pad)', () => {
    const { el } = makeWheel({ value: 5 })
    expect(el.getAttribute('aria-valuenow')).toBe('5')
    expect(el.getAttribute('aria-valuetext')).toBe('05')
  })

  it('renders no aria-valuenow and aria-valuetext "--" when value is null', () => {
    const { el } = makeWheel({ value: null })
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
    expect(el.getAttribute('aria-valuetext')).toBe('--')
  })

  it('sets aria-activedescendant to the centred option', () => {
    const { el } = makeWheel()
    expect(el.getAttribute('aria-activedescendant')).toBe('test-wheel-front')
  })

  it('does not fire onChange during construction', () => {
    const { onChange } = makeWheel({ value: 5 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes count as max - min + 1', () => {
    const { wheel } = makeWheel({ min: 0, max: 11 })
    expect(wheel.count).toBe(12)
  })
})

describe('WheelColumn — looping (default)', () => {
  it('wraps past the max back to min (Dec → Jan)', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 11 })
    wheel.stepBy(1)
    expect(wheel.value).toBe(0)
  })

  it('wraps past the min back to max (Jan → Dec)', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    wheel.stepBy(-1)
    expect(wheel.value).toBe(11)
  })
})

describe('WheelColumn — bounded (loop: false)', () => {
  it('clamps at the max instead of wrapping', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 11, loop: false })
    wheel.stepBy(1)
    expect(wheel.value).toBe(11)
  })

  it('clamps at the min instead of wrapping', () => {
    const { wheel } = makeWheel({ min: 0, max: 11, value: 0, loop: false })
    wheel.stepBy(-1)
    expect(wheel.value).toBe(0)
  })
})

describe('WheelColumn — onChange gating', () => {
  it('fires onChange with the new value on stepBy', () => {
    const { wheel, onChange } = makeWheel({ value: 5 })
    wheel.stepBy(1)
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('does NOT fire onChange on setValue (external sync)', () => {
    const { wheel, onChange } = makeWheel({ value: 5 })
    wheel.setValue(8)
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(8)
  })
})

describe('WheelColumn — format', () => {
  it('uses a custom format for the centred value (aria-valuetext)', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const { el } = makeWheel({ value: 2, format: v => months[v] })
    expect(el.getAttribute('aria-valuetext')).toBe('Mar')
  })
})

describe('WheelColumn — setValue', () => {
  it('updates the value getter', () => {
    const { wheel } = makeWheel({ value: 3 })
    wheel.setValue(7)
    expect(wheel.value).toBe(7)
  })

  it('reflects the new value in aria-valuenow', () => {
    const { el, wheel } = makeWheel({ value: 3 })
    wheel.setValue(7)
    expect(el.getAttribute('aria-valuenow')).toBe('7')
  })

  it('clears to an empty state on setValue(null)', () => {
    const { el, wheel } = makeWheel({ value: 3 })
    wheel.setValue(null)
    expect(wheel.value).toBeNull()
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
    expect(el.getAttribute('aria-valuetext')).toBe('--')
  })
})

describe('WheelColumn — destroy', () => {
  it('stops responding to input after destroy', () => {
    const { el, wheel, onChange } = makeWheel({ value: 5 })
    wheel.destroy()
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }))
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(5)
  })
})

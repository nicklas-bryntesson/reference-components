import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import WheelColumn, { type WheelColumnOptions } from '../WheelColumn'

// Kernel conformance tests for the WheelColumn DOM primitive. These exercise the
// public API + the drift-prone maths (loop wrap, bounded clamp, onChange gating,
// format, ARIA). The interactive physics (drag/momentum/snap) is covered by the
// component e2e suites. We mock prefers-reduced-motion: reduce so animations
// short-circuit synchronously — no requestAnimationFrame needed. The animated
// setValue regression instead allows motion and drives a stubbed rAF queue.

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

  it('speaks the emptyText option instead of "--" when value is null', () => {
    // The empty state must always carry SOME valuetext: min/max with no
    // valuenow trips VoiceOver's percent fallback ("−950 %" on native's empty
    // date segments). Components pass their localized "blank"/"tomt" here.
    const { el } = makeWheel({ value: null, emptyText: 'tomt' })
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
    expect(el.getAttribute('aria-valuetext')).toBe('tomt')
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

  it('does NOT fire onChange on animated setValue (motion allowed), and later user steps still do', () => {
    // Motion allowed: the eased snap defers _commit to rAF frames — the
    // _externalSet flag must survive until that deferred commit.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))
    let frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    // Drain the rAF queue with large timesteps so the eased snap lands fast.
    const drive = (): void => {
      let t = performance.now()
      for (let i = 0; i < 50 && frames.length > 0; i++) {
        const batch = frames
        frames = []
        t += 100
        for (const cb of batch) cb(t)
      }
      expect(frames.length).toBe(0)
    }

    const { wheel, onChange } = makeWheel({ value: 5 })

    wheel.setValue(8)
    drive()
    expect(onChange).not.toHaveBeenCalled()
    expect(wheel.value).toBe(8)

    wheel.stepBy(1)
    drive()
    expect(onChange).toHaveBeenCalledWith(9)
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

describe('WheelColumn — the module-level wheel lock', () => {
  // The lock lives at module scope so that trackpad inertia arriving on a
  // neighbouring column is ignored. That makes tearing a column down mid-scroll
  // a shared-state hazard: the owner is named globally, and the only release on
  // the happy path runs when the column snaps to rest.
  function scroll(el: HTMLElement, deltaY: number): void {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }))
  }

  it('lets a surviving column scroll after the owner is destroyed mid-scroll', () => {
    const a = makeWheel()
    const b = makeWheel()

    scroll(a.el, 120)           // a claims the lock; its snap timer has not fired
    expect(a.wheel.pos).not.toBe(0)

    a.wheel.destroy()           // popup closes while the trackpad still coasts

    const before = b.wheel.pos
    scroll(b.el, 120)
    expect(b.wheel.pos).not.toBe(before)

    b.wheel.destroy()
  })

  it('still ignores inertia bleeding onto a neighbour while the owner lives', () => {
    // The guard the fix must not weaken: an undestroyed owner keeps the lock.
    const a = makeWheel()
    const b = makeWheel()

    scroll(a.el, 120)
    const before = b.wheel.pos
    scroll(b.el, 120)
    expect(b.wheel.pos).toBe(before)

    a.wheel.destroy()
    b.wheel.destroy()
  })
})

describe('WheelColumn — tapping an option', () => {
  // Pointer capture retargets the compatibility mouse events, so `click` always
  // arrived with `.Wheel` as its target and tapping a number never selected it
  // with a real mouse. The tap is resolved in the pointer flow instead.
  function press(el: HTMLElement, target: Element, y: number): void {
    // jsdom has no pointer capture; the handlers only need it not to throw.
    ;(el as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
    ;(el as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: y }))
  }
  function release(el: HTMLElement, y: number, type = 'pointerup'): void {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY: y }))
  }

  function optionOtherThan(el: HTMLElement, value: number | null): HTMLElement {
    const options = [...el.querySelectorAll<HTMLElement>('[data-part="option"]')]
    const other = options.find((o) => o.dataset.value && Number(o.dataset.value) !== value)
    if (!other) throw new Error('no other option rendered')
    return other
  }

  it('selects the option a stationary press landed on', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const option = optionOtherThan(el, wheel.value)
    const expected = Number(option.dataset.value)

    press(el, option, 100)
    release(el, 100)

    expect(wheel.value).toBe(expected)
    wheel.destroy()
  })

  it('does not select when the press was a drag', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const option = optionOtherThan(el, wheel.value)

    const pressed = Number(option.dataset.value)   // before the re-render
    press(el, option, 100)
    el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 40 }))
    release(el, 40)

    // Whatever the drag landed on, it is not "the option I pressed at y=100".
    expect(wheel.value).not.toBe(pressed)
    wheel.destroy()
  })

  it('does not select when the gesture is cancelled', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const before = wheel.value
    const option = optionOtherThan(el, before)

    press(el, option, 100)
    release(el, 100, 'pointercancel')

    expect(wheel.value).toBe(before)
    wheel.destroy()
  })

  it('ignores a press that landed outside any option', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const before = wheel.value

    press(el, el, 100)
    release(el, 100)

    expect(wheel.value).toBe(before)
    wheel.destroy()
  })
})

describe('WheelColumn — the spinbutton cannot lag its own value', () => {
  // render() publishes aria-valuenow / aria-valuetext out of the committed
  // value, so it has to run AFTER the commit. Rendering first published the
  // previous value every time the wheel came to rest: absent on the first
  // gesture from an empty column, one step behind from then on. The wheel moved
  // and the host field updated, so only the accessible value was wrong —
  // invisible on screen, which is why it survived to the port.
  //
  // This has to be driven through a gesture. setValue() assigns the value
  // before rendering on its own, so it cannot see the defect.
  function tap(el: HTMLElement, target: Element): void {
    ;(el as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
    ;(el as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 100 }))
  }

  it('publishes a value after the first gesture on an empty column', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: null })
    expect(el.hasAttribute('aria-valuenow')).toBe(false)

    const option = [...el.querySelectorAll<HTMLElement>('[data-part="option"]')].find((o) => o.dataset.value)!
    // Read it now: the slots are recycled, so this element carries a different
    // value once the gesture has re-rendered the column.
    const expected = option.dataset.value
    tap(el, option)

    expect(el.getAttribute('aria-valuenow')).toBe(expected)
    expect(el.getAttribute('aria-valuetext')).not.toBe('--')
    wheel.destroy()
  })

  it('agrees with its own value after a gesture, not with the one before', () => {
    const { el, wheel } = makeWheel({ min: 0, max: 11, value: 0 })
    const options = [...el.querySelectorAll<HTMLElement>('[data-part="option"]')].filter((o) => o.dataset.value)
    for (const option of options.slice(0, 3)) {
      tap(el, option)
      expect(el.getAttribute('aria-valuenow')).toBe(String(wheel.value))
    }
    wheel.destroy()
  })
})

describe('WheelColumn — gesture direction', () => {
  // A wheel and a finger are not the same gesture and must not share a mapping.
  //
  //   wheel  → SCROLL model: wheel-down moves forward through the values, like
  //            every other scrollable surface, and like this component's own
  //            ArrowDown (`stepBy(+1)`).
  //   drag   → GRAB model: the finger holds the cylinder and the content follows
  //            it, so dragging down brings EARLIER values into view — what a
  //            native touch picker does.
  //
  // These used to share the grab model, which meant the wheel and the keyboard
  // disagreed inside one control. The first assertion is the invariant rather
  // than a hardcoded direction, because agreement is the property that broke.
  function wheel(el: HTMLElement, deltaY: number): void {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }))
  }
  function drag(el: HTMLElement, fromY: number, toY: number): void {
    ;(el as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
    ;(el as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientY: fromY }))
    el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: toY }))
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: toY }))
  }

  it('wheel-down moves the same way as ArrowDown', () => {
    const a = makeWheel({ min: 0, max: 11, value: 0 })
    const b = makeWheel({ min: 0, max: 11, value: 0 })

    const beforeWheel = a.wheel.pos
    wheel(a.el, 120)
    const wheelDelta = Math.sign(a.wheel.pos - beforeWheel)

    const beforeStep = b.wheel.pos
    b.wheel.stepBy(1) // what ArrowDown is bound to
    const stepDelta = Math.sign(b.wheel.pos - beforeStep)

    expect(wheelDelta).not.toBe(0)
    expect(wheelDelta, 'the wheel and the keyboard must agree').toBe(stepDelta)

    a.wheel.destroy()
    b.wheel.destroy()
  })

  it('wheel-down advances and wheel-up retreats', () => {
    const { el, wheel: w } = makeWheel({ min: 0, max: 11, value: 5 })
    const start = w.pos
    wheel(el, 120)
    expect(w.pos).toBeGreaterThan(start)

    const mid = w.pos
    wheel(el, -120)
    expect(w.pos).toBeLessThan(mid)
    w.destroy()
  })

  it('dragging keeps the grab model — down brings earlier values', () => {
    // Deliberately the opposite mapping to the wheel: the content follows the
    // finger, which is what a native touch picker does.
    const { el, wheel: w } = makeWheel({ min: 0, max: 11, value: 5 })
    const start = w.pos
    drag(el, 100, 160) // downward
    expect(w.pos).toBeLessThan(start)
    w.destroy()
  })
})

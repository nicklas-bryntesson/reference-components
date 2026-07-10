// src/partials/components/ScrollArea/tests/ScrollArea.unit.test.ts
//
// The scroll logic is a pure projection of (metrics, scrollLeft) plus an
// explicit FSM, so most of it is exact arithmetic testable without layout. The
// DOM-touching parts (attach builds the bar; destroy tears it down) are checked
// against jsdom with ResizeObserver stubbed (jsdom ships no ResizeObserver).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ScrollArea, {
  resolveMaxScroll,
  projectThumb,
  resolveNextState,
  STATE,
  EVENT,
  type Metrics,
} from '../ScrollArea'

// ─── resolveMaxScroll ──────────────────────────────────────────────────────────

describe('resolveMaxScroll', () => {
  it('no overflow when content fits', () => {
    expect(resolveMaxScroll(400, 400, 1)).toEqual({ maxScroll: 0, hasOverflow: false })
  })
  it('reports overflow and the max scroll distance', () => {
    expect(resolveMaxScroll(400, 600, 1)).toEqual({ maxScroll: 200, hasOverflow: true })
  })
  it('floors maxScroll at 0 when content is smaller than the viewport', () => {
    expect(resolveMaxScroll(400, 350, 1)).toEqual({ maxScroll: 0, hasOverflow: false })
  })
  it('ignores sub-pixel overflow within epsilon', () => {
    expect(resolveMaxScroll(400, 400.5, 1).hasOverflow).toBe(false)
    expect(resolveMaxScroll(400, 402, 1).hasOverflow).toBe(true)
  })
})

// ─── projectThumb ──────────────────────────────────────────────────────────────

const metrics = (over: Partial<Metrics> = {}): Metrics => ({
  clientWidth: 400,
  scrollWidth: 800,
  maxScroll: 400,
  hasOverflow: true,
  trackWidth: 400,
  ...over,
})

describe('projectThumb', () => {
  it('sizes the thumb by the visible ratio (clientWidth / scrollWidth)', () => {
    // 400/800 = 0.5 → 0.5 * 400 track = 200
    expect(projectThumb(metrics(), 0, 24).thumbWidth).toBe(200)
  })
  it('floors the thumb at minThumb so it stays grabbable', () => {
    // tiny visible ratio would give < minThumb
    const m = metrics({ scrollWidth: 8000, maxScroll: 7600 })
    expect(projectThumb(m, 0, 24).thumbWidth).toBe(24)
  })
  it('places the thumb at the track start when scrollLeft is 0', () => {
    expect(projectThumb(metrics(), 0, 24).x).toBe(0)
  })
  it('places the thumb at the end of its travel at max scroll', () => {
    const m = metrics()
    const { thumbWidth, x } = projectThumb(m, m.maxScroll, 24)
    expect(x).toBe(m.trackWidth - thumbWidth) // travel fully consumed
  })
  it('clamps the thumb position within its travel', () => {
    const m = metrics()
    const { thumbWidth, x } = projectThumb(m, 99999, 24)
    expect(x).toBe(m.trackWidth - thumbWidth) // never past the end
    expect(projectThumb(m, -50, 24).x).toBe(0) // never before the start
  })
  it('returns a zero thumb when there is no track', () => {
    expect(projectThumb(metrics({ trackWidth: 0 }), 0, 24)).toEqual({ thumbWidth: 0, x: 0 })
  })
})

// ─── resolveNextState (FSM) ──────────────────────────────────────────────────────

describe('resolveNextState', () => {
  it('MEASURE routes to idle/disabled by overflow', () => {
    expect(resolveNextState(STATE.DISABLED, EVENT.MEASURE, true)).toBe(STATE.IDLE)
    expect(resolveNextState(STATE.IDLE, EVENT.MEASURE, false)).toBe(STATE.DISABLED)
  })
  it('idle → dragging on thumb pointer down', () => {
    expect(resolveNextState(STATE.IDLE, EVENT.THUMB_POINTER_DOWN, true)).toBe(STATE.DRAGGING)
  })
  it('dragging → idle on pointer up/cancel', () => {
    expect(resolveNextState(STATE.DRAGGING, EVENT.POINTER_UP, true)).toBe(STATE.IDLE)
    expect(resolveNextState(STATE.DRAGGING, EVENT.POINTER_CANCEL, true)).toBe(STATE.IDLE)
  })
  it('DESTROY is reachable from every live state and is terminal', () => {
    expect(resolveNextState(STATE.DISABLED, EVENT.DESTROY, false)).toBe(STATE.DESTROYED)
    expect(resolveNextState(STATE.IDLE, EVENT.DESTROY, true)).toBe(STATE.DESTROYED)
    expect(resolveNextState(STATE.DRAGGING, EVENT.DESTROY, true)).toBe(STATE.DESTROYED)
    expect(resolveNextState(STATE.DESTROYED, EVENT.MEASURE, true)).toBe(STATE.DESTROYED)
  })
  it('MEASURE never interrupts an in-progress drag', () => {
    // A re-measure mid-drag must not transition out of DRAGGING (which would
    // release pointer capture). Regression guard for the FSM short-circuit.
    expect(resolveNextState(STATE.DRAGGING, EVENT.MEASURE, true)).toBe(STATE.DRAGGING)
    expect(resolveNextState(STATE.DRAGGING, EVENT.MEASURE, false)).toBe(STATE.DRAGGING)
  })
  it('an illegal event leaves the state unchanged', () => {
    expect(resolveNextState(STATE.DISABLED, EVENT.THUMB_POINTER_DOWN, false)).toBe(STATE.DISABLED)
    expect(resolveNextState(STATE.IDLE, EVENT.POINTER_UP, true)).toBe(STATE.IDLE)
  })
})

// ─── attach / destroy (jsdom, ResizeObserver stubbed) ────────────────────────────

describe('attach / destroy', () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver; a no-op stub is enough for construction.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function mount(): HTMLElement {
    document.body.innerHTML = `
      <div class="ScrollArea" data-component="ScrollArea">
        <div class="ScrollArea-viewport" data-scroll-viewport>
          <div class="ScrollArea-content">content</div>
        </div>
        <div class="ScrollArea-fades" aria-hidden="true"></div>
      </div>`
    return document.querySelector<HTMLElement>('[data-component="ScrollArea"]')!
  }

  it('makes the viewport the accessible region and adds an aria-hidden bar', () => {
    const root = mount()
    ScrollArea.attach()
    const vp = root.querySelector('[data-scroll-viewport]')!
    const bar = root.querySelector('.ScrollArea-scrollbar')!
    expect(root.getAttribute('data-scrollbar')).toBe('true')
    // the region carries the a11y: role + gap-filled accessible name
    expect(vp.getAttribute('role')).toBe('region')
    expect(vp.getAttribute('aria-label')).toBe('Scrollable content')
    // the bar is a pointer/visual affordance only
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(bar.getAttribute('role')).toBeNull()
    expect(bar.querySelector('.ScrollArea-thumb')).not.toBeNull()
  })

  it('does not override an authored region label', () => {
    document.body.innerHTML = `
      <div class="ScrollArea" data-component="ScrollArea">
        <div class="ScrollArea-viewport" data-scroll-viewport aria-label="Members table">
          <div class="ScrollArea-content">content</div>
        </div>
      </div>`
    ScrollArea.attach()
    expect(
      document.querySelector('[data-scroll-viewport]')!.getAttribute('aria-label'),
    ).toBe('Members table')
  })

  it('is idempotent — attaching twice keeps a single instance/bar', () => {
    const root = mount()
    ScrollArea.attach()
    ScrollArea.attach()
    expect(root.querySelectorAll('.ScrollArea-scrollbar')).toHaveLength(1)
  })

  it('destroy removes the generated bar, the instance, and the flag', () => {
    const root = mount()
    ScrollArea.attach()
    root.__scrollAreaInstance!.destroy()
    expect(root.querySelector('.ScrollArea-scrollbar')).toBeNull()
    expect(root.__scrollAreaInstance).toBeUndefined()
    expect(root.hasAttribute('data-scrollbar')).toBe(false)
  })

  it('throws when the required viewport marker is missing', () => {
    document.body.innerHTML = `<div class="ScrollArea" data-component="ScrollArea"></div>`
    expect(() => ScrollArea.attach()).toThrow(/data-scroll-viewport/)
  })
})

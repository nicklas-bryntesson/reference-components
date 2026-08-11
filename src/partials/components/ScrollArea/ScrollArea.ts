// src/partials/components/ScrollArea/ScrollArea.ts
//
// ScrollArea wraps horizontally-overflowing content (a wide table, a tab strip)
// in an edge-to-edge scroller with edge fades and a custom horizontal scrollbar.
//
// Accessibility model (see scrolling-container.md): the *viewport* is the
// keyboard/screen-reader surface — a focusable role="region" with an accessible
// name, scrolled natively by the arrow keys. The custom bar is a pointer + visual
// affordance only (aria-hidden): it looks better than a native bar and can be
// inset in line with the content, but it is not a second tab stop.
//
// Why a custom bar at all: a native bar always spans the whole scroll box, cannot
// be inset to the page gutter, and cannot be styled consistently across engines.
//
// ONE source of truth: `viewport.scrollLeft` is the truth; the thumb is a pure
// PROJECTION of (metrics, scrollLeft). Pointer interactions (drag, track paging)
// mutate only scrollLeft; the resulting `scroll` event re-projects the thumb.
//
// Progressive enhancement: with no JS there is no custom bar, so the native
// scrollbar stays visible (the CSS only hides it once JS sets data-scrollbar).
// Popover clipping: a horizontal scroller forces overflow-y to a non-visible
// value, so a popover opened inside it is clipped — inherent to scroll containers,
// which is exactly what the kitchensink's ToggleTip demo shows on purpose.

// ─── Pure functions (exported for exact, layout-free unit testing) ────────────

export interface Metrics {
  clientWidth: number
  scrollWidth: number
  maxScroll: number
  hasOverflow: boolean
  trackWidth: number
}

// scrollWidth − clientWidth, floored at 0; overflow only when it clears epsilon
// (ignore sub-pixel "overflow" that would flicker the bar in and out).
export function resolveMaxScroll(
  clientWidth: number,
  scrollWidth: number,
  epsilon: number,
): { maxScroll: number; hasOverflow: boolean } {
  const maxScroll = Math.max(0, scrollWidth - clientWidth)
  return { maxScroll, hasOverflow: maxScroll > epsilon }
}

// Project (metrics, scrollLeft) → thumb geometry. Never mutates.
export function projectThumb(
  m: Metrics,
  scrollLeft: number,
  minThumb: number,
): { thumbWidth: number; x: number } {
  const { clientWidth, scrollWidth, maxScroll, trackWidth } = m
  if (trackWidth <= 0 || scrollWidth <= 0) return { thumbWidth: 0, x: 0 }

  const visibleRatio = Math.min(1, clientWidth / scrollWidth)
  const thumbWidth = Math.max(minThumb, Math.round(visibleRatio * trackWidth))
  const travel = Math.max(0, trackWidth - thumbWidth)
  const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0
  const clamped = Math.min(1, Math.max(0, progress))
  return { thumbWidth, x: Math.round(clamped * travel) }
}

export const STATE = Object.freeze({
  DISABLED: 'disabled', // content fits — bar removed, region not focusable
  IDLE: 'idle', // overflow present — resting
  DRAGGING: 'dragging', // thumb being dragged
  DESTROYED: 'destroyed', // torn down — terminal
} as const)

export type State = (typeof STATE)[keyof typeof STATE]

export const EVENT = Object.freeze({
  MEASURE: 'MEASURE',
  THUMB_POINTER_DOWN: 'THUMB_POINTER_DOWN',
  POINTER_MOVE: 'POINTER_MOVE',
  POINTER_UP: 'POINTER_UP',
  POINTER_CANCEL: 'POINTER_CANCEL',
  TRACK_POINTER_DOWN: 'TRACK_POINTER_DOWN',
  SCROLL: 'SCROLL',
  DESTROY: 'DESTROY',
} as const)

export type EventName = (typeof EVENT)[keyof typeof EVENT]

const TRANSITIONS: Record<State, Partial<Record<EventName, State>>> = Object.freeze({
  [STATE.DISABLED]: { [EVENT.DESTROY]: STATE.DESTROYED },
  [STATE.IDLE]: { [EVENT.THUMB_POINTER_DOWN]: STATE.DRAGGING, [EVENT.DESTROY]: STATE.DESTROYED },
  [STATE.DRAGGING]: {
    [EVENT.POINTER_UP]: STATE.IDLE,
    [EVENT.POINTER_CANCEL]: STATE.IDLE,
    [EVENT.DESTROY]: STATE.DESTROYED,
  },
  [STATE.DESTROYED]: {},
})

// Resolve the next state. MEASURE is data-driven (overflow decides idle/disabled);
// every other transition is looked up in the table. Returns the same state when
// the event is illegal from here — the caller only acts on an actual change.
export function resolveNextState(state: State, event: EventName, hasOverflow: boolean): State {
  if (state === STATE.DESTROYED) return STATE.DESTROYED
  if (event === EVENT.MEASURE) {
    // Overflow decides idle/disabled — but a re-measure must never interrupt a
    // drag (that would release pointer capture mid-gesture). Metrics still refresh
    // via the #measure() side-effect; only the state change is suppressed.
    if (state === STATE.DRAGGING) return STATE.DRAGGING
    return hasOverflow ? STATE.IDLE : STATE.DISABLED
  }
  return TRANSITIONS[state][event] ?? state
}

// ─── Options ──────────────────────────────────────────────────────────────────

interface ScrollAreaOptions {
  minThumb: number // px — floor on thumb length so it stays grabbable
  pageFactor: number // fraction of a viewport per track-click "page"
  hideDelay: number // ms of inactivity before the bar fades out
  overflowEpsilon: number // px — ignore sub-pixel overflow
}

const DEFAULTS: ScrollAreaOptions = Object.freeze({
  minThumb: 24,
  pageFactor: 0.9,
  hideDelay: 900,
  overflowEpsilon: 1,
})

// ─── Global augmentation ─────────────────────────────────────────────────────

declare global {
  interface HTMLElement {
    __scrollAreaInstance?: ScrollArea
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

class ScrollArea {
  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="ScrollArea"]').forEach((el) => {
      if (!el.__scrollAreaInstance) el.__scrollAreaInstance = new ScrollArea(el)
    })
  }

  #root: HTMLElement
  #viewport: HTMLElement
  #bar!: HTMLElement
  #thumb!: HTMLElement
  #opts: ScrollAreaOptions

  #state: State = STATE.DISABLED
  #m: Metrics = { clientWidth: 0, scrollWidth: 0, maxScroll: 0, hasOverflow: false, trackWidth: 0 }

  #dragPointerId: number | null = null
  #dragStartX = 0
  #dragStartScroll = 0
  #hovering = false
  #hideTimer = 0
  #measureScheduled = false
  #ro: ResizeObserver | null = null
  #mo: MutationObserver | null = null

  // Bound handlers (stable references for add/removeEventListener).
  #onScroll = () => this.#send(EVENT.SCROLL)
  #onThumbDown = (e: PointerEvent) => this.#send(EVENT.THUMB_POINTER_DOWN, e)
  #onPointerMove = (e: PointerEvent) => this.#send(EVENT.POINTER_MOVE, e)
  #onPointerUp = (e: PointerEvent) => this.#send(EVENT.POINTER_UP, e)
  #onPointerCancel = (e: PointerEvent) => this.#send(EVENT.POINTER_CANCEL, e)
  #onTrackDown = (e: PointerEvent) => this.#send(EVENT.TRACK_POINTER_DOWN, e)
  #onEnter = () => this.#onRootEnter()
  #onLeave = () => this.#onRootLeave()
  #onMeasure = () => this.#scheduleMeasure()

  constructor(root: HTMLElement) {
    const viewport = root.querySelector<HTMLElement>('[data-scroll-viewport]')
    if (!viewport) throw new Error('ScrollArea: no [data-scroll-viewport] inside root')

    this.#root = root
    this.#viewport = viewport
    this.#opts = { ...DEFAULTS }

    // The viewport is the accessible scroll region. Author-provided role/label win;
    // gap-fill a safe default so the reference is correct out of the box.
    if (!viewport.hasAttribute('role')) viewport.setAttribute('role', 'region')
    if (!viewport.hasAttribute('aria-label') && !viewport.hasAttribute('aria-labelledby')) {
      viewport.setAttribute('aria-label', 'Scrollable content')
    }

    this.#buildDom()
    this.#wire()
    // Hiding the native bar is gated on this — no JS, native bar stays visible.
    root.setAttribute('data-scrollbar', 'true')
    this.#scheduleMeasure()
  }

  /** Force a re-measure (e.g. after mutating content imperatively). */
  refresh(): void {
    if (this.#state !== STATE.DESTROYED) this.#scheduleMeasure()
  }

  /** Current interaction state — handy for tests/debug. */
  get state(): State {
    return this.#state
  }

  /** Tear everything down: listeners, observers, timers, generated DOM. */
  destroy(): void {
    this.#send(EVENT.DESTROY)
    delete this.#root.__scrollAreaInstance
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────

  #buildDom(): void {
    // The bar is a pointer/visual affordance only — the region carries the a11y.
    const bar = document.createElement('div')
    bar.className = 'scrollbar'
    bar.hidden = true
    bar.setAttribute('aria-hidden', 'true')

    const thumb = document.createElement('div')
    thumb.className = 'thumb'
    bar.appendChild(thumb)
    this.#root.appendChild(bar)

    this.#bar = bar
    this.#thumb = thumb
  }

  #wire(): void {
    this.#viewport.addEventListener('scroll', this.#onScroll, { passive: true })
    this.#thumb.addEventListener('pointerdown', this.#onThumbDown)
    this.#thumb.addEventListener('pointermove', this.#onPointerMove)
    this.#thumb.addEventListener('pointerup', this.#onPointerUp)
    this.#thumb.addEventListener('pointercancel', this.#onPointerCancel)
    this.#bar.addEventListener('pointerdown', this.#onTrackDown)
    this.#root.addEventListener('pointerenter', this.#onEnter)
    this.#root.addEventListener('pointerleave', this.#onLeave)

    // Metrics change → MEASURE. Observe the viewport (clientWidth) and its
    // scrolling content (scrollWidth), plus row/content mutations.
    this.#ro = new ResizeObserver(this.#onMeasure)
    this.#ro.observe(this.#viewport)
    if (this.#viewport.firstElementChild) this.#ro.observe(this.#viewport.firstElementChild)
    this.#mo = new MutationObserver(this.#onMeasure)
    this.#mo.observe(this.#viewport, { childList: true, subtree: true })
  }

  // ── State machine ─────────────────────────────────────────────────────────────

  #send(event: EventName, payload?: Event): void {
    if (this.#state === STATE.DESTROYED) return

    // 1) Side-effects that need no state change.
    switch (event) {
      case EVENT.MEASURE:
        this.#measure()
        break
      case EVENT.SCROLL:
        this.#render()
        this.#show()
        break
      case EVENT.POINTER_MOVE:
        if (this.#state === STATE.DRAGGING) this.#scrub(payload as PointerEvent)
        break
      case EVENT.TRACK_POINTER_DOWN:
        if (payload && (payload as PointerEvent).target !== this.#thumb)
          this.#page(payload as PointerEvent)
        break
    }

    // 2) Resolve and apply the state change.
    const next = resolveNextState(this.#state, event, this.#m.hasOverflow)
    if (next !== this.#state) {
      this.#exit(this.#state)
      this.#state = next
      this.#enter(next, payload)
    }
  }

  #enter(state: State, payload?: Event): void {
    switch (state) {
      case STATE.DISABLED:
        this.#bar.hidden = true
        // Nothing to scroll — not a keyboard stop.
        this.#viewport.removeAttribute('tabindex')
        this.#clearHide()
        break
      case STATE.IDLE:
        this.#bar.hidden = false
        // Overflow present — the region becomes keyboard-focusable and scrollable.
        this.#viewport.setAttribute('tabindex', '0')
        this.#render()
        break
      case STATE.DRAGGING:
        this.#beginDrag(payload as PointerEvent)
        break
      case STATE.DESTROYED:
        this.#teardown()
        break
    }
  }

  #exit(state: State): void {
    if (state === STATE.DRAGGING) this.#endDrag()
  }

  // ── Metrics & rendering (pure projection) ────────────────────────────────────

  #measure(): void {
    const vp = this.#viewport
    const { maxScroll, hasOverflow } = resolveMaxScroll(
      vp.clientWidth,
      vp.scrollWidth,
      this.#opts.overflowEpsilon,
    )
    // The bar must be in layout BEFORE we read its width, else a hidden bar
    // reports clientWidth 0 and the thumb would render at width 0 on first show.
    this.#bar.hidden = !hasOverflow
    const trackWidth = hasOverflow ? this.#bar.clientWidth : 0

    this.#m = {
      clientWidth: vp.clientWidth,
      scrollWidth: vp.scrollWidth,
      maxScroll,
      hasOverflow,
      trackWidth,
    }
    if (this.#state === STATE.IDLE && hasOverflow) this.#render()
  }

  #render(): void {
    if (this.#state === STATE.DISABLED || this.#state === STATE.DESTROYED) return
    const { thumbWidth, x } = projectThumb(this.#m, this.#viewport.scrollLeft, this.#opts.minThumb)
    if (thumbWidth <= 0) return
    this.#thumb.style.inlineSize = `${thumbWidth}px`
    this.#thumb.style.transform = `translateX(${x}px)`
  }

  // ── Pointer interactions (everything funnels into scrollLeft) ────────────────

  #beginDrag(e?: PointerEvent): void {
    if (!e) return
    this.#dragPointerId = e.pointerId
    this.#dragStartX = e.clientX
    this.#dragStartScroll = this.#viewport.scrollLeft
    try {
      this.#thumb.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort */
    }
    this.#show()
    e.preventDefault()
  }

  #scrub(e: PointerEvent): void {
    if (!e || e.pointerId !== this.#dragPointerId) return
    const { maxScroll, trackWidth } = this.#m
    const travel = trackWidth - this.#thumb.offsetWidth
    if (travel <= 0) return
    const dx = e.clientX - this.#dragStartX
    this.#viewport.scrollLeft = this.#dragStartScroll + (dx / travel) * maxScroll
    // the scroll event does the render.
  }

  #endDrag(): void {
    if (this.#dragPointerId != null) {
      try {
        this.#thumb.releasePointerCapture(this.#dragPointerId)
      } catch {
        /* release is best-effort */
      }
    }
    this.#dragPointerId = null
    this.#armHide()
  }

  #page(e: PointerEvent): void {
    const rect = this.#bar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const thumbLeft = this.#currentThumbLeft()
    const page = this.#m.clientWidth * this.#opts.pageFactor
    const dir = clickX < thumbLeft ? -1 : 1
    const max = this.#m.maxScroll
    this.#viewport.scrollLeft = Math.min(max, Math.max(0, this.#viewport.scrollLeft + dir * page))
  }

  #currentThumbLeft(): number {
    const { maxScroll, trackWidth } = this.#m
    const travel = trackWidth - this.#thumb.offsetWidth
    const progress = maxScroll > 0 ? this.#viewport.scrollLeft / maxScroll : 0
    return Math.min(1, Math.max(0, progress)) * Math.max(0, travel)
  }

  // ── Visibility / auto-hide ────────────────────────────────────────────────────

  #onRootEnter(): void {
    this.#hovering = true
    if (this.#state !== STATE.DISABLED) this.#show()
  }

  #onRootLeave(): void {
    this.#hovering = false
    this.#armHide()
  }

  #show(): void {
    if (this.#state === STATE.DISABLED || this.#state === STATE.DESTROYED) return
    this.#bar.dataset.visible = 'true'
    this.#armHide()
  }

  #armHide(): void {
    this.#clearHide()
    this.#hideTimer = window.setTimeout(() => {
      // Never hide mid-drag or while hovering.
      if (this.#state === STATE.DRAGGING || this.#hovering) return
      delete this.#bar.dataset.visible
    }, this.#opts.hideDelay)
  }

  #clearHide(): void {
    if (this.#hideTimer) {
      clearTimeout(this.#hideTimer)
      this.#hideTimer = 0
    }
  }

  // ── Measure scheduling & teardown ────────────────────────────────────────────

  #scheduleMeasure(): void {
    if (this.#measureScheduled) return
    this.#measureScheduled = true
    requestAnimationFrame(() => {
      this.#measureScheduled = false
      this.#send(EVENT.MEASURE)
    })
  }

  #teardown(): void {
    this.#clearHide()
    this.#ro?.disconnect()
    this.#mo?.disconnect()
    this.#viewport.removeEventListener('scroll', this.#onScroll)
    this.#thumb.removeEventListener('pointerdown', this.#onThumbDown)
    this.#thumb.removeEventListener('pointermove', this.#onPointerMove)
    this.#thumb.removeEventListener('pointerup', this.#onPointerUp)
    this.#thumb.removeEventListener('pointercancel', this.#onPointerCancel)
    this.#bar.removeEventListener('pointerdown', this.#onTrackDown)
    this.#root.removeEventListener('pointerenter', this.#onEnter)
    this.#root.removeEventListener('pointerleave', this.#onLeave)
    this.#viewport.removeAttribute('tabindex')
    this.#bar.remove()
    this.#root.removeAttribute('data-scrollbar')
  }
}

export default ScrollArea

export interface WheelColumnOptions {
  min: number
  max: number
  value: number | null
  onChange: (value: number) => void
  disabled?: (value: number) => boolean
  /** When false, the wheel stops at min/max instead of wrapping. Default: true (loops). */
  loop?: boolean
  /** Render a value as display text (e.g. month names). Default: zero-padded number. */
  format?: (value: number) => string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_DEG = 20
const HALF = 4
const MAX_V = 21
const SNAP_THRESHOLD = 4.5
const STALE_IDLE_MS = 70
const WHEEL_SNAP_DELAY_MS = 100

// Prevents trackpad inertia bleed-over.
// Lock is claimed when a column starts scrolling and released only after
// the column snaps to rest. A min-delta gate then filters the inertia tail
// that arrives on adjacent columns right after the lock releases.
let _activeWheelCol: WheelColumn | null = null
const WHEEL_MIN_DELTA = 15  // rows/event — below this we treat it as inertia tail

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readRowHeight(el: HTMLElement): number {
  let raw = getComputedStyle(el).getPropertyValue('--_wheel-row-height').trim()
  if (!raw) {
    raw = getComputedStyle(document.documentElement).getPropertyValue('--_wheel-row-height').trim()
  }
  const parsed = parseFloat(raw)
  return isNaN(parsed) ? 38 : parsed
}

interface Slot {
  el: HTMLDivElement
  o: number
}

const MOMENTUM_THRESHOLD = 7  // rows/s — above this, use momentum; below, snap directly

class WheelColumn {
  private opts: WheelColumnOptions
  private el: HTMLElement
  private ring!: HTMLDivElement
  private slots: Slot[] = []

  pos: number = 0
  private _currentValue: number | null
  private _externalSet: boolean = false
  private _destroyed: boolean = false

  private rowH: number
  private radius: number
  private rowsPerPx: number
  readonly count: number
  private _loop: boolean
  private _format: (value: number) => string

  private _rafId: number | null = null
  private _velocity: number = 0
  private _snapping: boolean = false
  private _snapTarget: number = 0

  private _dragActive: boolean = false
  private _dragLastY: number = 0
  private _dragLastTime: number = 0

  private _lastMoveTime: number = 0

  private _wheelTimer: ReturnType<typeof setTimeout> | null = null

  private _abortController: AbortController

  constructor(el: HTMLElement, opts: WheelColumnOptions) {
    this.el = el
    this.opts = opts
    this._currentValue = opts.value
    this.count = opts.max - opts.min + 1
    this._loop = opts.loop ?? true
    this._format = opts.format ?? ((v: number) => String(v).padStart(2, '0'))

    this.rowH = readRowHeight(el)
    this.radius = (this.rowH / 2) / Math.tan((STEP_DEG / 2) * Math.PI / 180)
    this.rowsPerPx = 1 / this.rowH

    this._abortController = new AbortController()

    this._buildDOM()
    this._bindEvents()

    // Set initial position without triggering onChange
    this._externalSet = true
    if (opts.value !== null) {
      const i = this._resolveIndex(opts.value - opts.min)
      this.pos = i
    } else {
      this.pos = 0
    }
    this.render()
    this._externalSet = false
  }

  // ─── DOM ────────────────────────────────────────────────────────────────────

  private _buildDOM(): void {
    this.el.setAttribute('role', 'spinbutton')
    this.el.setAttribute('aria-valuemin', String(this.opts.min))
    this.el.setAttribute('aria-valuemax', String(this.opts.max))
    if (!this.el.hasAttribute('tabindex')) {
      this.el.setAttribute('tabindex', '0')
    }

    this.ring = document.createElement('div')
    this.ring.className = 'ring'
    this.ring.style.transformStyle = 'preserve-3d'
    this.ring.style.transform = `translateZ(${-this.radius}px)`

    for (let o = -HALF; o <= HALF; o++) {
      const slotEl = document.createElement('div')
      slotEl.className = 'option'
      slotEl.setAttribute('aria-hidden', 'true')
      this.ring.appendChild(slotEl)
      this.slots.push({ el: slotEl, o })
    }

    const band = document.createElement('div')
    band.className = 'band'

    this.el.appendChild(this.ring)
    this.el.appendChild(band)
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  private _bindEvents(): void {
    const signal = this._abortController.signal

    this.el.addEventListener('pointerdown', this._onPointerDown, { signal })
    this.el.addEventListener('wheel', this._onWheel as EventListener, { passive: false, signal })
    this.el.addEventListener('click', this._onClick, { signal })
  }

  private _onPointerDown = (e: PointerEvent): void => {
    if (this._destroyed) return
    e.preventDefault()
    this._stop()

    this._dragActive = true
    this._dragLastY = e.clientY
    this._dragLastTime = performance.now()
    this._velocity = 0
    this._lastMoveTime = this._dragLastTime

    this.el.setPointerCapture(e.pointerId)

    const signal = this._abortController.signal
    this.el.addEventListener('pointermove', this._onPointerMove, { signal })
    this.el.addEventListener('pointerup', this._onPointerUp, { signal })
    this.el.addEventListener('pointercancel', this._onPointerUp, { signal })
  }

  private _onPointerMove = (e: PointerEvent): void => {
    if (!this._dragActive || this._destroyed) return

    const now = performance.now()
    const dy = e.clientY - this._dragLastY
    const dtm = now - this._dragLastTime || 16  // ms, avoid division by zero
    const dPos = -dy * this.rowsPerPx

    this.pos += dPos
    this._clampPos()
    // Rolling average matches prototype exactly: weight recent move 60%, history 40%
    this._velocity = this._velocity * 0.4 + (dPos / dtm * 1000) * 0.6

    this._dragLastY = e.clientY
    this._dragLastTime = now
    this._lastMoveTime = now

    this._externalSet = false
    this.render()
  }

  private _onPointerUp = (e: PointerEvent): void => {
    if (!this._dragActive || this._destroyed) return
    this._dragActive = false

    this.el.releasePointerCapture(e.pointerId)
    this.el.removeEventListener('pointermove', this._onPointerMove)
    this.el.removeEventListener('pointerup', this._onPointerUp)
    this.el.removeEventListener('pointercancel', this._onPointerUp)

    const now = performance.now()
    const idle = now - this._lastMoveTime

    // Stale velocity guard: held still before release → no flick
    const v = idle > STALE_IDLE_MS ? 0 : this._velocity
    // Dampen and cap, matching prototype exactly
    this._velocity = Math.max(-MAX_V, Math.min(MAX_V, v * 0.4))

    this._externalSet = false

    if (Math.abs(this._velocity) > MOMENTUM_THRESHOLD && !this._prefersReducedMotion()) {
      this._startMomentum()
    } else {
      this._startSnap()
    }
  }

  private _onWheel = (e: WheelEvent): void => {
    if (this._destroyed) return
    e.preventDefault()

    // Block inertia bleed-over: if another column owns wheel focus, ignore
    if (_activeWheelCol && _activeWheelCol !== this) return

    // After lock releases, require a meaningful delta before accepting events.
    // This filters the inertia tail that arrives on this column once the
    // previous column's lock expires.
    if (!_activeWheelCol && Math.abs(e.deltaY) < WHEEL_MIN_DELTA) return

    // Claim wheel focus — released in _commit() after snap completes
    _activeWheelCol = this

    this._stop()
    this._velocity = 0
    this._externalSet = false

    this.pos -= e.deltaY / 120
    this._clampPos()
    this.render()

    if (this._wheelTimer !== null) clearTimeout(this._wheelTimer)
    this._wheelTimer = setTimeout(() => {
      this._wheelTimer = null
      this._startSnap()
    }, WHEEL_SNAP_DELAY_MS)
  }

  private _onClick = (e: MouseEvent): void => {
    if (this._destroyed) return
    const option = (e.target as HTMLElement).closest<HTMLElement>('.option')
    if (!option) return

    const raw = option.dataset.value
    if (raw == null || raw === '') return
    const displayValue = Number(raw)
    if (isNaN(displayValue)) return

    this._externalSet = false
    const i = this._resolveIndex(displayValue - this.opts.min)
    const target = i + this.count * Math.round((this.pos - i) / this.count)
    this._animateTo(target)
    this._currentValue = displayValue
  }

  // ─── Physics loop ────────────────────────────────────────────────────────────

  private _startMomentum(): void {
    if (this._rafId !== null) return

    let last = performance.now()

    const loop = (now: number): void => {
      if (this._destroyed) return

      const dt = (now - last) / 1000
      last = now

      if (this._snapping) {
        const diff = this._snapTarget - this.pos
        // Ease toward snap target
        this.pos += diff * Math.min(1, dt * 16)
        this.render()

        if (Math.abs(diff) < 0.005) {
          this.pos = this._snapTarget
          this.render()
          this._commit()
          this._rafId = null
          this._snapping = false
          return
        }
      } else {
        // Apply friction
        this._velocity *= Math.pow(0.0004, dt)
        this.pos += this._velocity * dt
        this._clampPos()

        this.render()

        if (Math.abs(this._velocity) < SNAP_THRESHOLD) {
          this._startSnap()
          this._rafId = requestAnimationFrame(loop)
          return
        }
      }

      this._rafId = requestAnimationFrame(loop)
    }

    this._rafId = requestAnimationFrame(loop)
  }

  private _startSnap(): void {
    this._snapping = true
    this._snapTarget = Math.round(this.pos)
    this._velocity = 0

    if (this._rafId === null) {
      this._startMomentum()
    }
  }

  private _animateTo(target: number): void {
    this._stop()
    this._snapping = true
    this._snapTarget = target

    if (this._prefersReducedMotion()) {
      this.pos = target
      this.render()
      this._commit()
      return
    }

    this._startMomentum()
  }

  private _stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._snapping = false
    this._velocity = 0
  }

  // ─── Commit ──────────────────────────────────────────────────────────────────

  private _commit(): void {
    const index = this._resolveIndex(Math.round(this.pos))
    const value = this.opts.min + index
    this.pos = index + (this.pos - Math.round(this.pos))
    this._currentValue = value

    if (!this._externalSet) {
      this.opts.onChange(value)
    }
    // An animated setValue leaves the flag set until its deferred snap lands
    // here — clear it so later user-driven commits fire onChange again.
    this._externalSet = false

    // Release wheel lock now that this column has snapped to rest.
    // Short grace period so the snap animation fully settles before
    // adjacent columns can accept new wheel events.
    if (_activeWheelCol === this) {
      setTimeout(() => { if (_activeWheelCol === this) _activeWheelCol = null }, 150)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  render(): void {
    const base = Math.round(this.pos)

    let ariaNow: number | null = null
    let ariaText = '--'

    if (this._currentValue !== null) {
      ariaNow = this._currentValue
      ariaText = this._format(this._currentValue)
    }

    if (ariaNow !== null) {
      this.el.setAttribute('aria-valuenow', String(ariaNow))
    } else {
      this.el.removeAttribute('aria-valuenow')
    }
    this.el.setAttribute('aria-valuetext', ariaText)

    const frontId = `${this.el.id || 'wheel'}-front`

    for (const slot of this.slots) {
      const valRow = base + slot.o
      const angle = (this.pos - valRow) * STEP_DEG
      const abs = Math.abs(angle)

      slot.el.style.transform = `rotateX(${angle}deg) translateZ(${this.radius}px)`

      if (abs > 90) {
        slot.el.style.opacity = '0'
        slot.el.style.visibility = 'hidden'
      } else {
        slot.el.style.visibility = ''
        const opacity = Math.max(0.10, Math.pow(Math.cos(abs * Math.PI / 180), 1.1))
        slot.el.style.opacity = String(opacity)
      }

      // Bounded wheels render nothing past the ends; looping wheels wrap.
      if (!this._loop && (valRow < 0 || valRow >= this.count)) {
        slot.el.textContent = ''
        delete slot.el.dataset.value
        slot.el.removeAttribute('aria-selected')
        slot.el.id = ''
        continue
      }

      const displayIndex = this._loop ? this._mod(valRow) : valRow
      const displayValue = this.opts.min + displayIndex
      slot.el.textContent = this._format(displayValue)
      slot.el.dataset.value = String(displayValue)

      const isFront = slot.o === 0
      slot.el.setAttribute('aria-selected', isFront ? 'true' : 'false')
      slot.el.id = isFront ? frontId : ''
    }

    this.el.setAttribute('aria-activedescendant', frontId)
  }

  // ─── Mod helper ──────────────────────────────────────────────────────────────

  private _mod(i: number): number {
    return ((i % this.count) + this.count) % this.count
  }

  // Looping wheels wrap an index into range; bounded wheels clamp to the ends.
  private _resolveIndex(i: number): number {
    return this._loop ? this._mod(i) : Math.max(0, Math.min(this.count - 1, i))
  }

  // Bounded wheels can't scroll past the ends — clamp position and kill velocity at an edge.
  private _clampPos(): void {
    if (this._loop) return
    const max = this.count - 1
    if (this.pos < 0) { this.pos = 0; this._velocity = 0 }
    else if (this.pos > max) { this.pos = max; this._velocity = 0 }
  }

  // ─── prefersReducedMotion ────────────────────────────────────────────────────

  _prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  setValue(value: number | null, animate = true): void {
    this._externalSet = true

    if (value === null) {
      this._currentValue = null
      this._stop()
      this.pos = 0
      this.render()
      this._externalSet = false
      return
    }

    const i = this._resolveIndex(value - this.opts.min)
    const target = i + this.count * Math.round((this.pos - i) / this.count)

    // Set the value BEFORE rendering so aria-valuenow / aria-valuetext reflect it
    // (render reads _currentValue). _externalSet prevents onChange from firing.
    this._currentValue = value

    if (animate && !this._prefersReducedMotion()) {
      // The flag must survive until the eased snap commits (next RAF frames),
      // so _commit() clears it — not us. User gestures that interrupt the
      // animation (drag/wheel/click/stepBy) all reset it to false themselves.
      this._animateTo(target)
    } else {
      this._stop()
      this.pos = target
      this.render()
      this._externalSet = false
    }
  }

  stepBy(delta: number): void {
    const base = this._currentValue ?? this.opts.min
    const nextIndex = this._resolveIndex(base - this.opts.min + delta)
    const nextValue = this.opts.min + nextIndex

    this._externalSet = false

    const i = nextIndex
    const target = i + this.count * Math.round((this.pos - i) / this.count)
    // Set before animating so the render inside _animateTo reflects the new value.
    this._currentValue = nextValue
    this._animateTo(target)
  }

  get value(): number | null {
    return this._currentValue
  }

  destroy(): void {
    this._destroyed = true
    this._stop()

    if (this._wheelTimer !== null) {
      clearTimeout(this._wheelTimer)
      this._wheelTimer = null
    }

    this._abortController.abort()
  }
}

export default WheelColumn

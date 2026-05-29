// src/partials/components/TimeField/TimeField.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../js/popup-position'
import WheelColumn, { type WheelColumnOptions } from './WheelColumn'

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeSegmentType = 'hour' | 'minute' | 'second' | 'ampm'

interface SegmentHandlers {
  keydown: (e: KeyboardEvent) => void
  focus: () => void
  blur: () => void
}

declare global {
  interface HTMLElement {
    __timeFieldInstance?: TimeField
  }
  interface HTMLSpanElement {
    __timeFieldHandlers?: SegmentHandlers
  }
}

// ─── Exported pure utilities ──────────────────────────────────────────────────

export function parseTimeValue(value: string): { hour: number; minute: number; second: number | null } {
  const parts = value.split(':').map(Number)
  return {
    hour: parts[0] ?? 0,
    minute: parts[1] ?? 0,
    second: parts.length >= 3 ? (parts[2] ?? 0) : null,
  }
}

export function formatSegment(n: number): string {
  return String(n).padStart(2, '0')
}

export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min
  if (n < min) return max
  return n
}

// ─── Locale helpers ───────────────────────────────────────────────────────────

interface LocaleLabels {
  hour: string
  minute: string
  second: string
  ampm: string
  ampmAm: string
  ampmPm: string
}

const LABELS: Record<string, LocaleLabels> = {
  'sv-SE': { hour: 'Timmar', minute: 'Minuter', second: 'Sekunder', ampm: 'FM eller EM', ampmAm: 'FM', ampmPm: 'EM' },
  en: { hour: 'Hour', minute: 'Minute', second: 'Second', ampm: 'AM or PM', ampmAm: 'AM', ampmPm: 'PM' },
}

function getLabels(locale: string): LocaleLabels {
  if (LABELS[locale]) return LABELS[locale]
  // Match by language tag prefix
  const lang = locale.split('-')[0]
  for (const key of Object.keys(LABELS)) {
    if (key.startsWith(lang)) return LABELS[key]!
  }
  return LABELS['en']!
}

function is12hLocale(locale: string): boolean {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true
}

// ─── TimeField class ──────────────────────────────────────────────────────────

class TimeField {
  static instanceCount = 0

  // DOM refs
  root: HTMLElement
  native: HTMLInputElement
  overlay: HTMLElement
  segments: HTMLElement
  trigger: HTMLButtonElement
  announce: HTMLElement

  // State
  fieldId: string
  locale: string
  is12h: boolean
  showSeconds: boolean
  instanceId: number
  _segmentEls: HTMLSpanElement[]
  _digitBuffer: string
  _digitTimer: ReturnType<typeof setTimeout> | null
  private _labels: LocaleLabels
  private _suppressEvents = false
  private popupEl: HTMLElement | null = null
  private _wheels: Map<string, WheelColumn> = new Map()
  private _slideContainer!: HTMLElement
  private _outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private _rafHandle: number | null = null
  private _popupTemplate: HTMLTemplateElement | null = null

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll('[data-component="TimeField"]').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.__timeFieldInstance) return
      htmlEl.__timeFieldInstance = new TimeField(htmlEl)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.instanceId = ++TimeField.instanceCount

    this.native = el.querySelector<HTMLInputElement>('.TimeField-native')!
    this.overlay = el.querySelector<HTMLElement>('.TimeField-overlay')!
    this.segments = el.querySelector<HTMLElement>('.TimeField-segments')!
    this.trigger = el.querySelector<HTMLButtonElement>('.TimeField-trigger')!
    this.announce = el.querySelector<HTMLElement>('.TimeField-announce')!

    this.fieldId = el.dataset.id ?? `timefield-${this.instanceId}`
    this.locale = el.dataset.locale || document.documentElement.lang || 'sv-SE'
    this.is12h = is12hLocale(this.locale)
    const step = parseInt(el.dataset.step ?? '60', 10)
    this.showSeconds = step < 60

    this._labels = getLabels(this.locale)
    this._segmentEls = []
    this._digitBuffer = ''
    this._digitTimer = null

    this._slideContainer = el.querySelector<HTMLElement>('.TimeField-slideContainer')!
    this._popupTemplate = el.querySelector<HTMLTemplateElement>('[data-template="timefield-popup"]')

    this._init()
  }

  _init(): void {
    // Wire native input id/name
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? this.fieldId

    // Announce element
    this.announce.id = `${this.fieldId}-announce`

    // Touch detection
    const isTouch = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false

    if (isTouch) {
      this._initTouchMode()
    } else {
      this._initInteractiveMode()
    }

    this.root.setAttribute('data-initialized', '')
  }

  // ─── Touch mode ───────────────────────────────────────────────────────────

  _initTouchMode(): void {
    // Show native input, hide overlay
    this.native.removeAttribute('aria-hidden')
    this.native.removeAttribute('tabindex')
    this.overlay.setAttribute('aria-hidden', 'true')
    this.overlay.style.display = 'none'
    this.root.dataset.inputMode = 'native'
  }

  // ─── Interactive mode ─────────────────────────────────────────────────────

  _initInteractiveMode(): void {
    this.root.dataset.inputMode = 'custom'

    // In interactive mode, the overlay is the real UI — remove aria-hidden so
    // screen readers can reach the spinbutton segments and trigger button.
    // The native input remains aria-hidden (tabindex="-1") and is only a value carrier.
    this.overlay.removeAttribute('aria-hidden')

    // Wire label association
    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${this.fieldId}"]`)
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${this.fieldId}-label`
      this.segments.setAttribute('aria-labelledby', labelEl.id)
    }

    // Disabled state
    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this.root.dataset.disabled = ''
    }

    this._buildSegments()
    this._bindSegmentEvents()
    this._bindTrigger()
    window.addEventListener('resize', this._handleResize)

    if (!this.native.disabled) {
      this._bindValueSync()
      this._bindFormReset()
    }

    this._syncInitialValue()
  }

  // ─── Segment construction ─────────────────────────────────────────────────

  _buildSegments(): void {
    // Clear existing
    this.segments.querySelectorAll('.TimeField-segment, .TimeField-sep').forEach(el => el.remove())

    const segmentTypes: TimeSegmentType[] = ['hour', 'minute']
    if (this.showSeconds) segmentTypes.push('second')
    if (this.is12h) segmentTypes.push('ampm')

    segmentTypes.forEach((type, i) => {
      if (type === 'ampm') {
        this.segments.appendChild(this._createSep(' '))
      } else if (i > 0) {
        this.segments.appendChild(this._createSep(':'))
      }
      this.segments.appendChild(this._createSegmentEl(type))
    })

    this._segmentEls = [...this.segments.querySelectorAll<HTMLSpanElement>('[data-segment]')]

    // First segment gets tabindex=0
    if (this._segmentEls.length > 0) {
      this._segmentEls[0].setAttribute('tabindex', '0')
    }

    // Disabled segments
    const isDisabled = this.root.hasAttribute('data-disabled')
    if (isDisabled) {
      this._segmentEls.forEach(seg => {
        seg.setAttribute('tabindex', '-1')
        seg.setAttribute('aria-disabled', 'true')
      })
    }
  }

  _createSep(text: string): HTMLSpanElement {
    const sep = document.createElement('span')
    sep.className = 'TimeField-sep'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = text
    return sep
  }

  _createSegmentEl(type: TimeSegmentType): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'TimeField-segment'
    span.setAttribute('role', 'spinbutton')
    span.setAttribute('data-segment', type)
    span.setAttribute('tabindex', '-1')
    span.setAttribute('aria-label', this._labels[type])

    if (type === 'ampm') {
      span.setAttribute('aria-valuenow', '0')
      span.setAttribute('aria-valuetext', this._labels.ampmAm)
      span.textContent = this._labels.ampmAm
    } else {
      const { min, max } = this._getSegmentLimits(type)
      span.setAttribute('aria-valuemin', String(min))
      span.setAttribute('aria-valuemax', String(max))
      span.setAttribute('data-placeholder', '')
      span.setAttribute('aria-valuetext', '--')
      span.textContent = '--'
    }

    return span
  }

  // ─── Segment bounds ───────────────────────────────────────────────────────

  _getSegmentLimits(type: TimeSegmentType): { min: number; max: number } {
    switch (type) {
      case 'hour':
        return this.is12h ? { min: 1, max: 12 } : { min: 0, max: 23 }
      case 'minute':
      case 'second':
        return { min: 0, max: 59 }
      default:
        throw new Error(`Unknown segment type: ${type}`)
    }
  }

  // ─── Segment focus management ─────────────────────────────────────────────

  _setSegmentFocused(seg: HTMLSpanElement): void {
    this._segmentEls.forEach(s => {
      s.removeAttribute('data-focused')
      s.setAttribute('tabindex', '-1')
    })
    seg.setAttribute('data-focused', '')
    seg.setAttribute('tabindex', '0')
  }

  _moveSegmentFocus(current: HTMLSpanElement, direction: number): void {
    const idx = this._segmentEls.indexOf(current)
    const next = this._segmentEls[idx + direction]
    if (next) {
      this._setSegmentFocused(next)
      next.focus()
    }
  }

  _focusTrigger(): void {
    this._segmentEls.forEach(s => {
      s.removeAttribute('data-focused')
      s.setAttribute('tabindex', '-1')
    })
    this.trigger.focus()
  }

  // ─── Segment events ───────────────────────────────────────────────────────

  _bindSegmentEvents(): void {
    this._segmentEls.forEach(seg => {
      const keydownHandler = (e: KeyboardEvent) => this._handleSegmentKey(e, seg)
      const focusHandler = () => this._setSegmentFocused(seg)
      const blurHandler = () => {
        seg.removeAttribute('data-focused')
        const type = seg.dataset.segment as TimeSegmentType
        if (type !== 'ampm') {
          this._flushDigitBuffer(seg)
        }
      }
      seg.__timeFieldHandlers = { keydown: keydownHandler, focus: focusHandler, blur: blurHandler }
      seg.addEventListener('keydown', keydownHandler)
      seg.addEventListener('focus', focusHandler)
      seg.addEventListener('blur', blurHandler)
    })
  }

  _handleSegmentKey(e: KeyboardEvent, seg: HTMLSpanElement): void {
    if (this.root.hasAttribute('data-disabled') || this.native.disabled) return
    const type = seg.dataset.segment as TimeSegmentType
    const isFirst = this._segmentEls[0] === seg
    const isLast = this._segmentEls[this._segmentEls.length - 1] === seg

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        this._incrementSegment(seg, 1)
        break
      case 'ArrowDown':
        e.preventDefault()
        this._incrementSegment(seg, -1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        this._moveSegmentFocus(seg, -1)
        break
      case 'ArrowRight':
        e.preventDefault()
        this._moveSegmentFocus(seg, 1)
        break
      case 'Tab':
        if (!e.shiftKey && isLast) {
          e.preventDefault()
          this._focusTrigger()
        }
        // Shift+Tab on first segment: let browser handle (exits component)
        break
      case 'Backspace':
        e.preventDefault()
        clearTimeout(this._digitTimer ?? undefined)
        this._digitTimer = null
        this._digitBuffer = ''
        if (type !== 'ampm') {
          this._clearSegment(seg)
        }
        if (!isFirst) {
          this._moveSegmentFocus(seg, -1)
        }
        break
      default:
        if (type === 'ampm') {
          if (e.key === 'A' || e.key === 'a') {
            e.preventDefault()
            this._setAmpm(seg, 0) // FM/AM
          } else if (e.key === 'P' || e.key === 'p') {
            e.preventDefault()
            this._setAmpm(seg, 1) // EM/PM
          }
        } else if (e.key >= '0' && e.key <= '9') {
          e.preventDefault()
          this._handleDigit(seg, e.key)
        }
        break
    }
  }

  // ─── Segment value management ─────────────────────────────────────────────

  _getCurrentSegmentValue(seg: HTMLSpanElement): number | null {
    return seg.hasAttribute('data-placeholder') ? null : Number(seg.getAttribute('aria-valuenow'))
  }

  _getSegmentEl(type: TimeSegmentType): HTMLSpanElement | null {
    return this._segmentEls.find(s => s.dataset.segment === type) ?? null
  }

  _getSegmentValueByType(type: TimeSegmentType): number | null {
    const seg = this._getSegmentEl(type)
    return seg ? this._getCurrentSegmentValue(seg) : null
  }

  _setSegmentValue(seg: HTMLSpanElement, value: number): void {
    const type = seg.dataset.segment as TimeSegmentType
    seg.removeAttribute('data-placeholder')
    seg.setAttribute('aria-valuenow', String(value))
    seg.setAttribute('aria-valuetext', formatSegment(value))
    seg.textContent = formatSegment(value)
    this._syncToNative()
  }

  _setAmpm(seg: HTMLSpanElement, value: number): void {
    // value: 0 = AM/FM, 1 = PM/EM
    const label = value === 0 ? this._labels.ampmAm : this._labels.ampmPm
    seg.setAttribute('aria-valuenow', String(value))
    seg.setAttribute('aria-valuetext', label)
    seg.textContent = label
    this._syncToNative()
  }

  _clearSegment(seg: HTMLSpanElement): void {
    seg.setAttribute('data-placeholder', '')
    seg.removeAttribute('aria-valuenow')
    seg.setAttribute('aria-valuetext', '--')
    seg.textContent = '--'
    this._syncToNative()
  }

  // ─── Increment / wrap / carry ─────────────────────────────────────────────

  _incrementSegment(seg: HTMLSpanElement, delta: number): void {
    const type = seg.dataset.segment as TimeSegmentType

    if (type === 'ampm') {
      const current = Number(seg.getAttribute('aria-valuenow') ?? '0')
      this._setAmpm(seg, current === 0 ? 1 : 0)
      return
    }

    const { min, max } = this._getSegmentLimits(type)
    const current = this._getCurrentSegmentValue(seg)
    const start = current ?? (delta > 0 ? min - 1 : max + 1)
    const next = wrapValue(start + delta, min, max)
    const didWrap = (delta > 0 && start + delta > max) || (delta < 0 && start + delta < min)

    this._setSegmentValue(seg, next)

    // Wrap chaining: minute 59→0 increments hour, second 59→0 increments minute
    if (didWrap) {
      if (type === 'minute') {
        const hourSeg = this._getSegmentEl('hour')
        if (hourSeg) this._incrementSegment(hourSeg, delta)
      } else if (type === 'second') {
        const minuteSeg = this._getSegmentEl('minute')
        if (minuteSeg) this._incrementSegment(minuteSeg, delta)
      }
    }
  }

  // ─── Digit buffer ─────────────────────────────────────────────────────────

  _handleDigit(seg: HTMLSpanElement, digit: string): void {
    const type = seg.dataset.segment as TimeSegmentType
    if (type === 'ampm') return

    clearTimeout(this._digitTimer ?? undefined)
    this._digitBuffer += digit
    const num = Number(this._digitBuffer)
    const len = this._digitBuffer.length
    const { min, max } = this._getSegmentLimits(type)

    this._showBuffer(seg, this._digitBuffer)

    if (len === 2) {
      // Commit with clamping
      this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
      this._digitBuffer = ''
      this._moveSegmentFocus(seg, 1)
      return
    }

    // len === 1: check fast-advance condition
    const shouldFastAdvance = this._shouldFastAdvance(type, num)
    if (shouldFastAdvance) {
      this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
      this._digitBuffer = ''
      this._moveSegmentFocus(seg, 1)
      return
    }

    // Wait for second digit or timeout
    this._digitTimer = setTimeout(() => {
      this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
      this._digitBuffer = ''
      this._moveSegmentFocus(seg, 1)
    }, 300)
  }

  _shouldFastAdvance(type: TimeSegmentType, firstDigit: number): boolean {
    // Fast-advance when first digit makes 2-digit value impossible
    // hour (24h): first digit 3–9 (max is 23, so 30+ is impossible)
    // hour (12h): first digit 2–9 (max is 12, so 20+ is impossible)
    // minute/second: first digit 6–9 (max is 59, so 60+ is impossible)
    switch (type) {
      case 'hour':
        return this.is12h ? firstDigit >= 2 : firstDigit >= 3
      case 'minute':
      case 'second':
        return firstDigit >= 6
      default:
        return false
    }
  }

  _showBuffer(seg: HTMLSpanElement, buffer: string): void {
    seg.textContent = buffer
    seg.setAttribute('aria-valuetext', buffer)
  }

  _flushDigitBuffer(seg: HTMLSpanElement): void {
    if (!this._digitBuffer) return
    clearTimeout(this._digitTimer ?? undefined)
    this._digitTimer = null

    const type = seg.dataset.segment as TimeSegmentType
    const num = Number(this._digitBuffer)
    const { min, max } = this._getSegmentLimits(type)
    this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
    this._digitBuffer = ''
  }

  // ─── Trigger ──────────────────────────────────────────────────────────────

  _bindTrigger(): void {
    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this.trigger.disabled = true
      this.trigger.setAttribute('aria-disabled', 'true')
      return
    }

    this.trigger.addEventListener('click', () => {
      if (this.popupEl) {
        this._closePopup()
      } else {
        this._openPopup()
      }
    })
  }

  // ─── Value sync ───────────────────────────────────────────────────────────

  _syncToNative(): void {
    const hour = this._getSegmentValueByType('hour')
    const minute = this._getSegmentValueByType('minute')
    const second = this.showSeconds ? this._getSegmentValueByType('second') : null

    if (hour == null || minute == null) {
      // Not all segments filled — clear native value
      this.native.value = ''
      this.root.removeAttribute('data-has-value')
      return
    }

    if (this.showSeconds && second == null) {
      this.native.value = ''
      this.root.removeAttribute('data-has-value')
      return
    }

    let h = hour
    // 12h → 24h conversion
    if (this.is12h) {
      const ampmSeg = this._getSegmentEl('ampm')
      const ampmVal = ampmSeg ? Number(ampmSeg.getAttribute('aria-valuenow') ?? '0') : 0
      if (ampmVal === 0) {
        // AM/FM
        h = hour === 12 ? 0 : hour
      } else {
        // PM/EM
        h = hour === 12 ? 12 : hour + 12
      }
    }

    const timeStr = this.showSeconds && second != null
      ? `${formatSegment(h)}:${formatSegment(minute)}:${formatSegment(second)}`
      : `${formatSegment(h)}:${formatSegment(minute)}`

    this.native.value = timeStr
    this.root.dataset.hasValue = ''

    if (!this._suppressEvents) {
      this.native.dispatchEvent(new Event('input', { bubbles: true }))
      this.native.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // Announce the complete time value briefly
    this._announceTime(timeStr)
  }

  _announceTime(timeStr: string): void {
    this.announce.textContent = timeStr
    setTimeout(() => {
      this.announce.textContent = ''
    }, 300)
  }

  _bindValueSync(): void {
    this.native.addEventListener('change', () => {
      if (this._suppressEvents) return
      if (this.native.value) {
        this._suppressEvents = true
        this._syncFromNative(this.native.value)
        this._suppressEvents = false
      }
    })
  }

  _bindFormReset(): void {
    this.native.form?.addEventListener('reset', () => {
      this._segmentEls.forEach(seg => {
        const type = seg.dataset.segment as TimeSegmentType
        if (type === 'ampm') {
          this._setAmpm(seg, 0)
        } else {
          this._clearSegment(seg)
        }
      })
      this.root.removeAttribute('data-has-value')
    })
  }

  _syncInitialValue(): void {
    // Check data-value on root or native.value
    const initialValue = this.root.dataset.value || this.native.value
    if (!initialValue) return
    this._suppressEvents = true
    this._syncFromNative(initialValue)
    this._suppressEvents = false
  }

  _syncFromNative(value: string): void {
    const { hour, minute, second } = parseTimeValue(value)

    let displayHour = hour
    let ampmVal = 0

    if (this.is12h) {
      if (hour === 0) {
        displayHour = 12
        ampmVal = 0 // AM/FM
      } else if (hour < 12) {
        displayHour = hour
        ampmVal = 0 // AM/FM
      } else if (hour === 12) {
        displayHour = 12
        ampmVal = 1 // PM/EM
      } else {
        displayHour = hour - 12
        ampmVal = 1 // PM/EM
      }
    }

    const hourSeg = this._getSegmentEl('hour')
    if (hourSeg) this._setSegmentValue(hourSeg, displayHour)

    const minuteSeg = this._getSegmentEl('minute')
    if (minuteSeg) this._setSegmentValue(minuteSeg, minute)

    if (this.showSeconds && second != null) {
      const secondSeg = this._getSegmentEl('second')
      if (secondSeg) this._setSegmentValue(secondSeg, second)
    }

    if (this.is12h) {
      const ampmSeg = this._getSegmentEl('ampm')
      if (ampmSeg) this._setAmpm(ampmSeg, ampmVal)
    }
  }

  // ─── Popup ────────────────────────────────────────────────────────────────

  private _openPopup(): void {
    if (!this._popupTemplate) return
    const clone = this._popupTemplate.content.cloneNode(true) as DocumentFragment
    this.popupEl = clone.querySelector<HTMLElement>('.TimeFieldPopup')!

    // Footer button states
    this._updateClearButton()

    // Wire footer
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('.TimeFieldPopup-clear')!
    const nowBtn = this.popupEl.querySelector<HTMLButtonElement>('.TimeFieldPopup-now')!
    clearBtn.addEventListener('click', () => this._handleClear())
    nowBtn.addEventListener('click', () => this._handleNow())

    // Wire keyboard
    this.popupEl.addEventListener('keydown', (e) => this._handlePopupKeydown(e))

    this._slideContainer.appendChild(this.popupEl)
    this.root.setAttribute('data-open', '')
    this.trigger.setAttribute('aria-expanded', 'true')

    this._updateLayout()

    // Instantiate wheel columns (must be after DOM insertion so CSS is computed)
    this._wheels.clear()
    const wheelSegments: Array<'hour' | 'minute' | 'second'> = ['hour', 'minute']
    if (this.showSeconds) wheelSegments.push('second')

    // Remove second column if not needed (before wheel setup)
    if (!this.showSeconds) {
      this.popupEl.querySelector('[data-segment="second"]')?.remove()
    }

    wheelSegments.forEach(segType => {
      const col = this.popupEl!.querySelector<HTMLElement>(`[data-segment="${segType}"]`)
      if (!col) return
      const { min, max } = this._getSegmentLimits(segType)
      const currentValue = this._getSegmentValueByType(segType)
      const opts: WheelColumnOptions = {
        min,
        max,
        value: currentValue,
        onChange: (value: number) => {
          this._selectPopupOption(segType, value)
        },
      }
      const wheel = new WheelColumn(col, opts)
      this._wheels.set(segType, wheel)
    })

    // Outside click to close
    this._outsideClickHandler = (e: MouseEvent) => {
      if (!this.root.contains(e.target as Node)) {
        this._closePopup()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this._outsideClickHandler!)
    }, 0)
  }

  private _closePopup(): void {
    if (this.popupEl) {
      this._wheels.forEach(wheel => wheel.destroy())
      this._wheels.clear()
      this.popupEl.remove()
      this.popupEl = null
    }
    this.root.removeAttribute('data-open')
    this.trigger.setAttribute('aria-expanded', 'false')
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler)
      this._outsideClickHandler = null
    }
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle)
      this._rafHandle = null
    }
  }

  private _selectPopupOption(segType: 'hour' | 'minute' | 'second', value: number): void {
    // Update the segment in the overlay
    const seg = this._getSegmentEl(segType)
    if (seg) this._setSegmentValue(seg, value)

    this._updateClearButton()
  }

  private _updateClearButton(): void {
    if (!this.popupEl) return
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('.TimeFieldPopup-clear')
    if (clearBtn) {
      const hasValue = this.native.value !== ''
      clearBtn.disabled = !hasValue
    }
  }

  private _handleClear(): void {
    this._suppressEvents = true
    this._segmentEls.forEach(seg => {
      const type = seg.dataset.segment as TimeSegmentType
      if (type !== 'ampm') this._clearSegment(seg)
    })
    this.native.value = ''
    this.root.removeAttribute('data-has-value')
    this._suppressEvents = false
    this._updateClearButton()
    this._syncWheelsFromSegments(false)
  }

  private _handleNow(): void {
    const now = new Date()
    let h = now.getHours()
    const m = now.getMinutes()
    const s = now.getSeconds()

    // Clamp to min/max if set
    const minStr = this.root.dataset.min
    const maxStr = this.root.dataset.max
    let timeStr = this.showSeconds
      ? `${formatSegment(h)}:${formatSegment(m)}:${formatSegment(s)}`
      : `${formatSegment(h)}:${formatSegment(m)}`
    if (minStr && timeStr < minStr) timeStr = minStr
    if (maxStr && timeStr > maxStr) timeStr = maxStr

    this._suppressEvents = true
    this._syncFromNative(timeStr)
    this.native.value = timeStr
    this.root.dataset.hasValue = ''
    this._suppressEvents = false

    this._syncWheelsFromSegments(false)
    this._updateClearButton()
  }

  private _refreshColumnSelections(): void {
    this._syncWheelsFromSegments(false)
  }

  private _syncWheelsFromSegments(animate: boolean): void {
    this._wheels.forEach((wheel, segType) => {
      const value = this._getSegmentValueByType(segType as 'hour' | 'minute' | 'second')
      wheel.setValue(value, animate)
    })
  }

  private _handlePopupKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      const col = (e.target as HTMLElement).closest<HTMLElement>('[role="spinbutton"]')
      if (!col || !this.popupEl) return
      const allCols = [...this.popupEl.querySelectorAll<HTMLElement>('[role="spinbutton"]')]
      const isLastCol = allCols[allCols.length - 1] === col
      const isFirstCol = allCols[0] === col
      if (!e.shiftKey && isLastCol) {
        e.preventDefault()
        this.popupEl.querySelector<HTMLButtonElement>('.TimeFieldPopup-clear')?.focus()
      } else if (e.shiftKey && isFirstCol) {
        e.preventDefault()
        this.trigger.focus()
        this._closePopup()
      } else if (!e.shiftKey && !isLastCol) {
        e.preventDefault()
        allCols[allCols.indexOf(col) + 1]?.focus()
      } else if (e.shiftKey && !isFirstCol) {
        e.preventDefault()
        allCols[allCols.indexOf(col) - 1]?.focus()
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      this._closePopup()
      this.trigger.focus()
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const col = (e.target as HTMLElement).closest<HTMLElement>('[role="spinbutton"]')
      if (!col) return
      e.preventDefault()
      const segType = col.dataset.segment as 'hour' | 'minute' | 'second'
      const wheel = this._wheels.get(segType)
      if (wheel) {
        wheel.stepBy(e.key === 'ArrowUp' ? -1 : 1)
      }
    }
  }

  private _updateLayout(): void {
    if (!this.popupEl) return
    const triggerRect = this.trigger.getBoundingClientRect()
    const containerRect = this._slideContainer.getBoundingClientRect()
    const popupWidth = this.popupEl.getBoundingClientRect().width
    if (!containerRect.width || !popupWidth) return

    this.root.dataset.direction = detectDirection(triggerRect)

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      popupWidth,
      window.innerWidth,
      0
    )
    this.root.style.setProperty('--tf-popup-offset', `${offset}%`)

    const popupLeft = containerRect.left + (offset / 100 * containerRect.width) - popupWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      popupLeft,
      popupWidth,
      4,  // border-radius approximation
      8   // arrow-size approximation
    )
    this.root.style.setProperty('--tf-arrow-offset', `${arrowOffset}px`)
  }

  private _handleResize = (): void => {
    if (this._rafHandle !== null) cancelAnimationFrame(this._rafHandle)
    this._rafHandle = requestAnimationFrame(() => {
      this._updateLayout()
      this._rafHandle = null
    })
  }

  // ─── Destroy ──────────────────────────────────────────────────────────────

  destroy(): void {
    if (this._digitTimer !== null) {
      clearTimeout(this._digitTimer)
      this._digitTimer = null
    }

    this._closePopup()
    window.removeEventListener('resize', this._handleResize)

    this._segmentEls.forEach(seg => {
      const handlers = seg.__timeFieldHandlers
      if (handlers) {
        seg.removeEventListener('keydown', handlers.keydown)
        seg.removeEventListener('focus', handlers.focus)
        seg.removeEventListener('blur', handlers.blur)
        delete seg.__timeFieldHandlers
      }
    })

    delete this.root.__timeFieldInstance
  }
}

export default TimeField

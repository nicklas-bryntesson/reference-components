// src/partials/components/MonthField/MonthField.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../kernel/js/popup-position'
import { trapPopupInteraction } from '../../../kernel/js/popup-interaction'
import { readLocale, resolveLocale } from '../../../kernel/utils/locale'
import { getMonthName, formatMonthISO, parseMonthISO } from '../../../kernel/utils/dates'
import WheelColumn, { type WheelColumnOptions } from '../../../kernel/js/WheelColumn'

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthSegmentType = 'month' | 'year'

interface TranslationStrings {
  month: string
  year: string
  openMonthPicker: string
  popupLabel: string
  clearButton: string
  thisMonthButton: string
  /** Spoken value of an empty segment (aria-valuetext). See _clearSegment. */
  empty: string
}

interface SegmentHandlers {
  keydown: (e: KeyboardEvent) => void
  focus: () => void
  blur: () => void
}

declare global {
  interface HTMLElement {
    __monthFieldInstance?: MonthField
  }
  interface HTMLSpanElement {
    __monthFieldHandlers?: SegmentHandlers
  }
}

// ─── Exported pure utilities ──────────────────────────────────────────────────

export function formatSegment(n: number): string {
  return String(n).padStart(2, '0')
}

/** Wrap a value into [min, max] (used by the month segment: Dec↔Jan). */
export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min
  if (n < min) return max
  return n
}

/** Clamp a value into [min, max] (used by the year segment). */
export function clampValue(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Clamp a YYYY-MM string against optional YYYY-MM bounds (string comparison is safe for this format). */
export function clampMonthISO(value: string, min: string | undefined, max: string | undefined): string {
  let out = value
  if (min && out < min) out = min
  if (max && out > max) out = max
  return out
}

// ─── MonthField class ──────────────────────────────────────────────────────────

class MonthField {
  static instanceCount = 0
  static translations: Record<string, TranslationStrings> = {
    en: {
      month: 'Month', year: 'Year',
      openMonthPicker: 'Open month picker', popupLabel: 'Choose month',
      clearButton: 'Clear', thisMonthButton: 'This month',
      empty: 'blank',
    },
    sv: {
      month: 'Månad', year: 'År',
      openMonthPicker: 'Öppna månadsväljare', popupLabel: 'Välj månad',
      clearButton: 'Rensa', thisMonthButton: 'Denna månad',
      empty: 'tomt',
    },
  }

  static registerLocale(locale: string, strings: Partial<TranslationStrings>): void {
    MonthField.translations[locale] = { ...MonthField.translations.en, ...strings }
  }

  // Default year-wheel range when no min/max: current year ±100 (O5)
  static readonly YEAR_SPAN = 100

  // DOM refs
  root: HTMLElement
  native: HTMLInputElement
  overlay: HTMLElement
  segments: HTMLElement
  trigger: HTMLButtonElement
  announce: HTMLElement

  // State
  fieldId: string
  /** Collapsed translation key — indexes `translations`, never given to Intl. */
  locale: string
  /** Raw locale tag as authored — what Intl must receive. See ADR-0011. */
  localeTag: string
  instanceId: number
  minYear: number
  maxYear: number
  minISO?: string
  maxISO?: string
  _segmentEls: HTMLSpanElement[]
  _digitBuffer: string
  _digitTimer: ReturnType<typeof setTimeout> | null
  t: TranslationStrings
  private _suppressEvents = false
  private popupEl: HTMLElement | null = null
  private _wheels: Map<string, WheelColumn> = new Map()
  private _rail!: HTMLElement
  private _outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private _rafHandle: number | null = null
  private _popupTemplate: HTMLTemplateElement | null = null
  // Aborted on close — tears down the shared focus-trap + scroll-containment listeners.
  private _popupAbort: AbortController | null = null

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll('[data-component="MonthField"]').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.__monthFieldInstance) return
      htmlEl.__monthFieldInstance = new MonthField(htmlEl)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.instanceId = ++MonthField.instanceCount

    this.native = el.querySelector<HTMLInputElement>('[data-part="native"]')!
    this.overlay = el.querySelector<HTMLElement>('[data-part="overlay"]')!
    this.segments = el.querySelector<HTMLElement>('[data-part="segments"]')!
    this.trigger = el.querySelector<HTMLButtonElement>('[data-part="trigger"]')!
    this.announce = el.querySelector<HTMLElement>('[data-part="announce"]')!

    this.fieldId = el.dataset.id ?? `monthfield-${this.instanceId}`
    this.localeTag = readLocale(el)
    this.locale = resolveLocale(this.localeTag, MonthField.translations)

    this.t = MonthField.translations[this.locale]
    this._segmentEls = []
    this._digitBuffer = ''
    this._digitTimer = null

    // Year bounds from data-min/data-max (YYYY-MM), else current year ±100 (O5)
    this.minISO = el.dataset.min || undefined
    this.maxISO = el.dataset.max || undefined
    const currentYear = new Date().getFullYear()
    const parsedMin = this.minISO ? parseMonthISO(this.minISO) : null
    const parsedMax = this.maxISO ? parseMonthISO(this.maxISO) : null
    this.minYear = parsedMin ? parsedMin.year : currentYear - MonthField.YEAR_SPAN
    this.maxYear = parsedMax ? parsedMax.year : currentYear + MonthField.YEAR_SPAN

    this._rail = el.querySelector<HTMLElement>('[data-part="rail"]')!
    this._popupTemplate = el.querySelector<HTMLTemplateElement>('[data-template="monthfield-popup"]')

    this._init()
  }

  _init(): void {
    // Wire native input id/name
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? this.fieldId

    // Announce element
    this.announce.id = `${this.fieldId}-announce`

    // Localised trigger label (template carries a fallback for the no-JS state)
    this.trigger.setAttribute('aria-label', this.t.openMonthPicker)

    // Touch detection (mirror TimeField/DateField)
    const isTouch = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false

    if (isTouch) {
      this._initDisplayMode()
    } else {
      this._initInteractiveMode()
    }

    this.root.setAttribute('data-initialized', 'true')
  }

  // ─── Display mode (touch / coarse pointer) ────────────────────────────────
  // Keep the custom appearance, but defer interaction to the native input,
  // which sits transparently on top and fires the platform month picker on tap.

  _initDisplayMode(): void {
    this.root.dataset.inputMode = 'display'

    this.native.removeAttribute('aria-hidden')
    this.native.removeAttribute('tabindex')
    this.overlay.setAttribute('aria-hidden', 'true')

    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this.root.dataset.disabled = 'true'
    }

    this._buildSegments()
    this._segmentEls.forEach(seg => seg.setAttribute('tabindex', '-1'))

    if (!this.native.disabled) {
      this._bindValueSync()
      this._bindFormReset()
    }
    this._syncInitialValue()
  }

  // ─── Interactive mode ─────────────────────────────────────────────────────

  _initInteractiveMode(): void {
    this.root.dataset.inputMode = 'custom'

    // The overlay is the real UI — remove aria-hidden so screen readers can
    // reach the spinbutton segments and trigger button. The native input
    // remains aria-hidden (tabindex="-1") and is only a value carrier.
    this.overlay.removeAttribute('aria-hidden')

    // Wire label association
    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${this.fieldId}"]`)
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${this.fieldId}-label`
      this.segments.setAttribute('aria-labelledby', labelEl.id)
    }

    // Disabled state
    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this.root.dataset.disabled = 'true'
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
    this.segments.querySelectorAll('[data-part="segment"], [data-part="separator"]').forEach(el => el.remove())

    const segmentTypes: MonthSegmentType[] = ['month', 'year']

    segmentTypes.forEach((type, i) => {
      if (i > 0) {
        this.segments.appendChild(this._createSep('/'))
      }
      this.segments.appendChild(this._createSegmentEl(type))
    })

    this._segmentEls = [...this.segments.querySelectorAll<HTMLSpanElement>('[data-segment]')]

    if (this._segmentEls.length > 0) {
      this._segmentEls[0].setAttribute('tabindex', '0')
    }

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
    sep.setAttribute('data-part', 'separator')
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = text
    return sep
  }

  _createSegmentEl(type: MonthSegmentType): HTMLSpanElement {
    const span = document.createElement('span')
    span.setAttribute('data-part', 'segment')
    span.setAttribute('role', 'spinbutton')
    span.setAttribute('data-segment', type)
    span.setAttribute('tabindex', '-1')
    span.setAttribute('aria-label', this.t[type])

    const { min, max } = this._getSegmentLimits(type)
    span.setAttribute('aria-valuemin', String(min))
    span.setAttribute('aria-valuemax', String(max))
    span.setAttribute('data-placeholder', 'true')
    // Spoken empty value is the localized `empty` word — never the visible
    // placeholder token and never bare min/max without a valuetext, which trips
    // VoiceOver's percent fallback (measured on native's empty segments).
    span.setAttribute('aria-valuetext', this.t.empty)
    span.textContent = type === 'year' ? '----' : '--'

    return span
  }

  // ─── Segment bounds ───────────────────────────────────────────────────────

  _getSegmentLimits(type: MonthSegmentType): { min: number; max: number } {
    switch (type) {
      case 'month':
        return { min: 0, max: 11 }
      case 'year':
        return { min: this.minYear, max: this.maxYear }
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
    seg.setAttribute('data-focused', 'true')
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


  // ─── Segment events ───────────────────────────────────────────────────────

  _bindSegmentEvents(): void {
    this._segmentEls.forEach(seg => {
      const keydownHandler = (e: KeyboardEvent) => this._handleSegmentKey(e, seg)
      const focusHandler = () => this._setSegmentFocused(seg)
      const blurHandler = () => {
        seg.removeAttribute('data-focused')
        this._flushDigitBuffer(seg)
      }
      seg.__monthFieldHandlers = { keydown: keydownHandler, focus: focusHandler, blur: blurHandler }
      seg.addEventListener('keydown', keydownHandler)
      seg.addEventListener('focus', focusHandler)
      seg.addEventListener('blur', blurHandler)
    })
  }

  _handleSegmentKey(e: KeyboardEvent, seg: HTMLSpanElement): void {
    if (this.root.hasAttribute('data-disabled') || this.native.disabled) return
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
      case 'Backspace':
        e.preventDefault()
        clearTimeout(this._digitTimer ?? undefined)
        this._digitTimer = null
        this._digitBuffer = ''
        this._clearSegment(seg)
        if (!isFirst) {
          this._moveSegmentFocus(seg, -1)
        }
        break
      default:
        if (e.key >= '0' && e.key <= '9') {
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

  _getSegmentEl(type: MonthSegmentType): HTMLSpanElement | null {
    return this._segmentEls.find(s => s.dataset.segment === type) ?? null
  }

  _getSegmentValueByType(type: MonthSegmentType): number | null {
    const seg = this._getSegmentEl(type)
    return seg ? this._getCurrentSegmentValue(seg) : null
  }

  // Human label for AT, e.g. "Juni 2026" (O2). Falls back gracefully when the
  // partner segment is still empty.
  _valueText(type: MonthSegmentType, value: number): string {
    if (type === 'month') {
      const year = this._getSegmentValueByType('year') ?? new Date().getFullYear()
      const name = getMonthName(year, value, this.localeTag)
      const yearVal = this._getSegmentValueByType('year')
      return yearVal == null ? name : `${name} ${yearVal}`
    }
    // year
    const monthVal = this._getSegmentValueByType('month')
    if (monthVal == null) return String(value)
    return `${getMonthName(value, monthVal, this.localeTag)} ${value}`
  }

  _setSegmentValue(seg: HTMLSpanElement, value: number): void {
    const type = seg.dataset.segment as MonthSegmentType
    seg.removeAttribute('data-placeholder')
    seg.setAttribute('aria-valuenow', String(value))
    // Month segment shows a zero-padded 1-based NUMBER (June → "06"); the
    // aria-valuenow stays 0-based (5) to match valuemin=0/valuemax=11 (O2).
    // Year shows the full number.
    seg.textContent = type === 'month' ? formatSegment(value + 1) : String(value)
    seg.setAttribute('aria-valuetext', this._valueText(type, value))
    // Refresh the partner segment's valuetext so AT hears "Juni 2026" from either.
    this._refreshValueTexts()
    // Clamp the combined value to data-min/max before it reaches the native input.
    this._enforceBounds()
    this._syncToNative()
  }

  // Keep aria-valuetext coherent across both segments after any change.
  _refreshValueTexts(): void {
    this._segmentEls.forEach(seg => {
      const type = seg.dataset.segment as MonthSegmentType
      const val = this._getCurrentSegmentValue(seg)
      if (val != null) {
        seg.setAttribute('aria-valuetext', this._valueText(type, val))
      }
    })
  }

  _clearSegment(seg: HTMLSpanElement): void {
    const type = seg.dataset.segment as MonthSegmentType
    seg.setAttribute('data-placeholder', 'true')
    seg.removeAttribute('aria-valuenow')
    seg.setAttribute('aria-valuetext', this.t.empty)
    seg.textContent = type === 'year' ? '----' : '--'
    this._syncToNative()
  }

  // ─── Increment / wrap / clamp ─────────────────────────────────────────────

  _incrementSegment(seg: HTMLSpanElement, delta: number): void {
    const type = seg.dataset.segment as MonthSegmentType
    const { min, max } = this._getSegmentLimits(type)
    const current = this._getCurrentSegmentValue(seg)

    if (type === 'month') {
      // Month wraps Dec↔Jan
      const start = current ?? (delta > 0 ? min - 1 : max + 1)
      const next = wrapValue(start + delta, min, max)
      this._setSegmentValue(seg, next)
      this._enforceBounds()
      return
    }

    // Year clamps to bounds
    const start = current ?? new Date().getFullYear()
    const next = clampValue(start + delta, min, max)
    this._setSegmentValue(seg, next)
    this._enforceBounds()
  }

  // ─── Digit buffer (year needs up to 4 digits; month up to 2) ──────────────

  _handleDigit(seg: HTMLSpanElement, digit: string): void {
    const type = seg.dataset.segment as MonthSegmentType
    const { min, max } = this._getSegmentLimits(type)

    clearTimeout(this._digitTimer ?? undefined)
    this._digitBuffer += digit
    const maxLen = type === 'year' ? 4 : 2
    const num = Number(this._digitBuffer)
    const len = this._digitBuffer.length

    this._showBuffer(seg, this._digitBuffer)

    if (len >= maxLen) {
      if (type === 'month') this._commitMonthDigits(seg, num)
      else this._commitDigits(seg, num, min, max)
      return
    }

    if (type === 'month') {
      // Month fast-advance: first digit ≥ 2 can't form a two-digit month (max 12)
      if (len === 1 && num >= 2) {
        // month is 1-based here for user entry (1–12) → store 0-based
        this._commitMonthDigits(seg, num)
        return
      }
    }

    this._digitTimer = setTimeout(() => {
      if (type === 'month') {
        this._commitMonthDigits(seg, num)
      } else {
        this._commitDigits(seg, num, min, max)
      }
    }, 400)
  }

  // Month digit entry is 1-based (user types 1–12) → stored 0-based.
  _commitMonthDigits(seg: HTMLSpanElement, num: number): void {
    const monthIndex = clampValue(num, 1, 12) - 1
    this._setSegmentValue(seg, monthIndex)
    this._digitBuffer = ''
    this._enforceBounds()
    this._moveSegmentFocus(seg, 1)
  }

  _commitDigits(seg: HTMLSpanElement, num: number, min: number, max: number): void {
    this._setSegmentValue(seg, clampValue(num, min, max))
    this._digitBuffer = ''
    this._enforceBounds()
    this._moveSegmentFocus(seg, 1)
  }

  _showBuffer(seg: HTMLSpanElement, buffer: string): void {
    seg.textContent = buffer
    seg.setAttribute('aria-valuetext', buffer)
  }

  _flushDigitBuffer(seg: HTMLSpanElement): void {
    if (!this._digitBuffer) return
    clearTimeout(this._digitTimer ?? undefined)
    this._digitTimer = null

    const type = seg.dataset.segment as MonthSegmentType
    const num = Number(this._digitBuffer)
    this._digitBuffer = ''
    if (type === 'month') {
      const monthIndex = clampValue(num, 1, 12) - 1
      this._setSegmentValue(seg, monthIndex)
    } else {
      const { min, max } = this._getSegmentLimits(type)
      this._setSegmentValue(seg, clampValue(num, min, max))
    }
    this._enforceBounds()
  }

  // ─── Bounds enforcement (data-min / data-max as YYYY-MM) ───────────────────

  // When both segments are filled, clamp the combined YYYY-MM to min/max and
  // reflect any correction back into the segments.
  _enforceBounds(): void {
    if (!this.minISO && !this.maxISO) return
    const month = this._getSegmentValueByType('month')
    const year = this._getSegmentValueByType('year')
    if (month == null || year == null) return

    const iso = formatMonthISO(year, month)
    const clamped = clampMonthISO(iso, this.minISO, this.maxISO)
    if (clamped === iso) return

    const parsed = parseMonthISO(clamped)!
    const monthSeg = this._getSegmentEl('month')
    const yearSeg = this._getSegmentEl('year')
    // Suppress re-entrant enforcement while correcting.
    if (yearSeg && parsed.year !== year) {
      yearSeg.removeAttribute('data-placeholder')
      yearSeg.setAttribute('aria-valuenow', String(parsed.year))
      yearSeg.textContent = String(parsed.year)
    }
    if (monthSeg && parsed.month !== month) {
      monthSeg.removeAttribute('data-placeholder')
      monthSeg.setAttribute('aria-valuenow', String(parsed.month))
      monthSeg.textContent = formatSegment(parsed.month + 1)
    }
    this._refreshValueTexts()
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
    const month = this._getSegmentValueByType('month')
    const year = this._getSegmentValueByType('year')

    if (month == null || year == null) {
      this.native.value = ''
      this.root.removeAttribute('data-has-value')
      return
    }

    const monthStr = formatMonthISO(year, month)

    this.native.value = monthStr
    this.root.dataset.hasValue = 'true'

    if (!this._suppressEvents) {
      this.native.dispatchEvent(new Event('input', { bubbles: true }))
      this.native.dispatchEvent(new Event('change', { bubbles: true }))
    }

    this._announceValue(monthStr)
  }

  _announceValue(monthStr: string): void {
    const parsed = parseMonthISO(monthStr)
    this.announce.textContent = parsed
      ? `${getMonthName(parsed.year, parsed.month, this.localeTag)} ${parsed.year}`
      : monthStr
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
      this._segmentEls.forEach(seg => this._clearSegment(seg))
      this.root.removeAttribute('data-has-value')
    })
  }

  _syncInitialValue(): void {
    const initialValue = this.root.dataset.value || this.native.value
    if (!initialValue) return
    this._suppressEvents = true
    this._syncFromNative(initialValue)
    this._suppressEvents = false
  }

  _syncFromNative(value: string): void {
    const parsed = parseMonthISO(value)
    if (!parsed) return

    const monthSeg = this._getSegmentEl('month')
    const yearSeg = this._getSegmentEl('year')
    // Set year first so the month's aria-valuetext can include it.
    if (yearSeg) this._setSegmentValue(yearSeg, clampValue(parsed.year, this.minYear, this.maxYear))
    if (monthSeg) this._setSegmentValue(monthSeg, parsed.month)
    this._enforceBounds()
  }

  // ─── Popup ────────────────────────────────────────────────────────────────

  private _openPopup(): void {
    if (!this._popupTemplate) return
    const clone = this._popupTemplate.content.cloneNode(true) as DocumentFragment
    this.popupEl = clone.querySelector<HTMLElement>('[data-part="popup"]')!

    // Localised labels
    this.popupEl.setAttribute('aria-label', this.t.popupLabel)
    const monthHost = this.popupEl.querySelector<HTMLElement>('.Wheel[data-picker="month"]')!
    const yearHost = this.popupEl.querySelector<HTMLElement>('.Wheel[data-picker="year"]')!
    monthHost.setAttribute('aria-label', this.t.month)
    yearHost.setAttribute('aria-label', this.t.year)

    // Footer button labels
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-part="footer-clear"]')!
    const nowBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-part="footer-now"]')!
    clearBtn.textContent = this.t.clearButton
    nowBtn.textContent = this.t.thisMonthButton
    clearBtn.addEventListener('click', () => this._handleClear())
    nowBtn.addEventListener('click', () => this._handleThisMonth())

    // Keyboard
    this.popupEl.addEventListener('keydown', (e) => this._handlePopupKeydown(e))

    this._rail.appendChild(this.popupEl)
    this.root.setAttribute('data-open', 'true')
    this.trigger.setAttribute('aria-expanded', 'true')

    this._updateLayout()
    this._updateClearButton()

    // Instantiate wheel columns after DOM insertion so CSS is computed.
    this._wheels.clear()

    const currentMonth = this._getSegmentValueByType('month')
    const currentYear = this._getSegmentValueByType('year')

    // Month wheel: loops (Dec↔Jan), shows localized month NAME (O2).
    const monthOpts: WheelColumnOptions = {
      min: 0, max: 11, value: currentMonth, loop: true,
      emptyText: this.t.empty,
      format: (v) => getMonthName(currentYear ?? new Date().getFullYear(), v, this.localeTag),
      onChange: (m) => this._selectPopupOption('month', m),
    }
    this._wheels.set('month', new WheelColumn(monthHost, monthOpts))

    // Year wheel: clamps to min..max, shows the plain number.
    const yearOpts: WheelColumnOptions = {
      min: this.minYear, max: this.maxYear, value: currentYear, loop: false,
      emptyText: this.t.empty,
      format: (v) => String(v),
      onChange: (y) => this._selectPopupOption('year', y),
    }
    this._wheels.set('year', new WheelColumn(yearHost, yearOpts))

    // Shared popup hygiene: cyclic focus trap over wheels → footer buttons, plus
    // wheel-scroll containment so a trackpad scroll off a column can't jitter the
    // page. Escape + ArrowUp/Down stay local (see _handlePopupKeydown).
    this._popupAbort = new AbortController()
    trapPopupInteraction({
      container: this.popupEl,
      tabStops: () => this._popupTabStops(),
      signal: this._popupAbort.signal,
    })

    // Outside click to close — light dismiss, NO refocus (avoids scroll-jump).
    this._outsideClickHandler = (e: MouseEvent) => {
      if (!this.root.contains(e.target as Node)) {
        this._closePopup()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this._outsideClickHandler!)
    }, 0)
    // An aria-modal dialog opened with a mouse has to take focus. The Escape
    // handler lives inside the popup, so with focus left on the trigger the key
    // never reaches it and Escape does nothing at all — a keyboard user was fine
    // only because Tab happened to carry them inside. Focus the first tab stop,
    // reusing the order the trap already computes so the entry point and the
    // cycle can never disagree. DateField, DateTimeField and WeekField all
    // already do this; these two were the outliers.
    this._popupTabStops()[0]?.focus()
  }

  // Ordered tab stops for the focus trap: wheel columns in DOM order, then the
  // enabled footer buttons (Clear is skipped while disabled so Tab never lands
  // on an unactionable control).
  private _popupTabStops(): HTMLElement[] {
    if (!this.popupEl) return []
    const wheels = [...this.popupEl.querySelectorAll<HTMLElement>('.Wheel[role="spinbutton"]')]
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-part="footer-clear"]')
    const nowBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-part="footer-now"]')
    const buttons = [clearBtn, nowBtn].filter(
      (b): b is HTMLButtonElement => Boolean(b) && !b!.disabled,
    )
    return [...wheels, ...buttons]
  }

  private _closePopup(): void {
    if (this._popupAbort) {
      this._popupAbort.abort()
      this._popupAbort = null
    }
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

  private _selectPopupOption(segType: MonthSegmentType, value: number): void {
    const seg = this._getSegmentEl(segType)
    if (seg) this._setSegmentValue(seg, value)
    // Month name depends on the year; refresh the month wheel's formatter output
    // by re-rendering its display when year changes.
    if (segType === 'year') this._refreshMonthWheelDisplay()
    this._updateClearButton()
  }

  // Year changed → month wheel's format() output (month name) may shift; nudge
  // it to re-render its current value so the label stays coherent.
  private _refreshMonthWheelDisplay(): void {
    const monthWheel = this._wheels.get('month')
    if (monthWheel && monthWheel.value != null) {
      monthWheel.setValue(monthWheel.value, false)
    }
  }

  private _updateClearButton(): void {
    if (!this.popupEl) return
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-part="footer-clear"]')
    if (clearBtn) {
      clearBtn.disabled = this.native.value === ''
    }
  }

  private _handleClear(): void {
    this._suppressEvents = true
    this._segmentEls.forEach(seg => this._clearSegment(seg))
    this.native.value = ''
    this.root.removeAttribute('data-has-value')
    this._suppressEvents = false
    // Clearing is a value change — fire both once, matching the set path (_syncToNative).
    this.native.dispatchEvent(new Event('input', { bubbles: true }))
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    // A footer action that completes the value commits and closes (ADR-0029) —
    // spinning the wheels stays live, but Clear is done. The clicked button goes
    // with the popup, so focus returns to the trigger (same as the Escape path).
    this._closePopup()
    this.trigger.focus()
  }

  private _handleThisMonth(): void {
    const now = new Date()
    let iso = formatMonthISO(now.getFullYear(), now.getMonth())
    iso = clampMonthISO(iso, this.minISO, this.maxISO)

    this._suppressEvents = true
    this._syncFromNative(iso)
    this.native.value = iso
    this.root.dataset.hasValue = 'true'
    this._suppressEvents = false
    // "This month" is a value change — fire both once (the suppressed segment
    // cascade above would otherwise fire per segment).
    this.native.dispatchEvent(new Event('input', { bubbles: true }))
    this.native.dispatchEvent(new Event('change', { bubbles: true }))

    // Speak the committed value: closing moves focus to the trigger, whose
    // label says nothing about WHAT was set — without this, "This month" is
    // silent in a screenreader. Same live-region write as the segment path.
    this._announceValue(iso)

    // A footer action that completes the value commits and closes (ADR-0029) —
    // spinning the wheels stays live, but This month is done. The clicked button
    // goes with the popup, so focus returns to the trigger (same as Escape).
    this._closePopup()
    this.trigger.focus()
  }

  private _syncWheelsFromSegments(animate: boolean): void {
    this._wheels.forEach((wheel, segType) => {
      const value = this._getSegmentValueByType(segType as MonthSegmentType)
      wheel.setValue(value, animate)
    })
  }

  private _handlePopupKeydown(e: KeyboardEvent): void {
    // Tab / Shift+Tab are owned by the shared cyclic focus trap
    // (trapPopupInteraction). Only Escape + ArrowUp/Down are handled locally.
    if (e.key === 'Escape') {
      e.preventDefault()
      this._closePopup()
      this.trigger.focus()
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const col = (e.target as HTMLElement).closest<HTMLElement>('.Wheel[role="spinbutton"]')
      if (!col) return
      e.preventDefault()
      const segType = col.dataset.picker as MonthSegmentType
      const wheel = this._wheels.get(segType)
      if (wheel) {
        wheel.stepBy(e.key === 'ArrowUp' ? -1 : 1)
      }
    }
  }

  private _updateLayout(): void {
    if (!this.popupEl) return
    const triggerRect = this.trigger.getBoundingClientRect()
    const containerRect = this._rail.getBoundingClientRect()
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
      this._getCSSPx('--_mf-site-padding') / 2
    )
    this.root.style.setProperty('--_mf-popup-offset', `${offset}%`)

    const popupLeft = containerRect.left + (offset / 100 * containerRect.width) - popupWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      popupLeft,
      popupWidth,
      this._getCSSPx('--_mf-arrow-corner-radius'),
      this._getCSSPx('--_mf-arrow-size'),
    )
    this.root.style.setProperty('--_mf-arrow-offset', `${arrowOffset}px`)
  }

  // Resolve a CSS custom property to px by measuring a probe inside the root,
  // so component-scoped tokens (--_mf-*) resolve rather than the var() fallback.
  private _getCSSPx(property: string): number {
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`
    this.root.appendChild(probe)
    const value = probe.getBoundingClientRect().width || 0
    probe.remove()
    return value
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
      const handlers = seg.__monthFieldHandlers
      if (handlers) {
        seg.removeEventListener('keydown', handlers.keydown)
        seg.removeEventListener('focus', handlers.focus)
        seg.removeEventListener('blur', handlers.blur)
        delete seg.__monthFieldHandlers
      }
    })

    delete this.root.__monthFieldInstance
  }
}

export default MonthField

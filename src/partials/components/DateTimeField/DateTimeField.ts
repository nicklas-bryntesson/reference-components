// src/partials/components/DateTimeField/DateTimeField.ts

import {
  getDaysInMonth,
  clampDayToMonth,
  getFirstWeekdayOfMonth,
  isDayDisabled,
  formatISO,
  formatDatetimeISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  type DateSegmentType,
} from '../../../kernel/utils/dates'
import { readLocale, resolveLocale } from '../../../kernel/utils/locale'
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../kernel/js/popup-position'
import { trapPopupInteraction } from '../../../kernel/js/popup-interaction'
import WheelColumn from '../../../kernel/js/WheelColumn'

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeSegmentType = 'hour' | 'minute' | 'second' | 'ampm'
type SegmentType = DateSegmentType | TimeSegmentType

interface TranslationStrings {
  day: string
  month: string
  year: string
  hour: string
  minute: string
  second: string
  am: string
  pm: string
  openCalendar: string
  closeCalendar: string
  popupLabel: string
  prevMonth: string
  nextMonth: string
  today: string
  now: string
  selected: string
  notAvailable: string
  announceSelected: string
  dateTimeField: string
  clearButton: string
  todayButton: string
  nowButton: string
  openPicker: string
  closePicker: string
  hours: string
  minutes: string
  seconds: string
}

interface SegmentHandlers {
  keydown: (e: KeyboardEvent) => void
  focus: () => void
  blur: () => void
}

declare global {
  interface HTMLElement {
    __dateTimeFieldInstance?: DateTimeField
  }
  interface HTMLSpanElement {
    __dateTimeFieldHandlers?: SegmentHandlers
  }
}

const SEGMENT_PLACEHOLDERS: Record<string, string> = {
  day: 'dd', month: 'mm', year: 'yyyy',
  hour: '--', minute: '--', second: '--',
}

// ─── DateTimeField class ──────────────────────────────────────────────────────

export class DateTimeField {
  static instanceCount = 0
  static translations: Record<string, TranslationStrings> = {
    en: {
      day: 'Day', month: 'Month', year: 'Year',
      hour: 'Hour', minute: 'Minute', second: 'Second',
      am: 'AM', pm: 'PM',
      openCalendar: 'Open calendar', closeCalendar: 'Close calendar',
      popupLabel: 'Choose date and time',
      prevMonth: 'Previous month', nextMonth: 'Next month',
      today: 'today', now: 'now',
      selected: 'selected', notAvailable: 'not available',
      announceSelected: 'Selected date and time:',
      dateTimeField: 'date and time field',
      clearButton: 'Clear', todayButton: 'Today', nowButton: 'Now',
      openPicker: 'Choose month and year', closePicker: 'Close month and year picker',
      hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    },
    sv: {
      day: 'Dag', month: 'Månad', year: 'År',
      hour: 'Timme', minute: 'Minut', second: 'Sekund',
      am: 'AM', pm: 'PM',
      openCalendar: 'Öppna kalender', closeCalendar: 'Stäng kalender',
      popupLabel: 'Välj datum och tid',
      prevMonth: 'Föregående månad', nextMonth: 'Nästa månad',
      today: 'idag', now: 'nu',
      selected: 'vald', notAvailable: 'inte tillgänglig',
      announceSelected: 'Valt datum och tid:',
      dateTimeField: 'datum- och tidfält',
      clearButton: 'Rensa', todayButton: 'I dag', nowButton: 'Nu',
      openPicker: 'Välj månad och år', closePicker: 'Stäng månads- och årsväljare',
      hours: 'Timmar', minutes: 'Minuter', seconds: 'Sekunder',
    },
  }

  root: HTMLElement
  native: HTMLInputElement
  segments: HTMLElement
  trigger: HTMLButtonElement
  announce: HTMLElement
  calendarTemplate: HTMLTemplateElement | null

  calendarEl: HTMLElement | null
  private _wheels: Map<'hour' | 'minute' | 'second', WheelColumn> = new Map()
  private _pickerWheels: Map<'month' | 'year', WheelColumn> = new Map()
  selectedDatetime: Date | null
  currentYear: number
  currentMonth: number
  instanceId: number
  fieldId: string
  locale: string
  localeTag: string
  t: TranslationStrings
  min: Date | null
  max: Date | null

  private _pickerEntryYear = 0
  private _pickerEntryMonth = 0
  _syncingFromCustom = false
  _segmentEls: HTMLSpanElement[] = []
  _digitBuffer = ''
  _digitTimer: ReturnType<typeof setTimeout> | null = null
  _outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private _rail!: HTMLElement
  private _rafHandle: number | null = null
  // Aborted on close — tears down the shared focus-trap + scroll-containment listeners.
  private _popupAbort: AbortController | null = null
  _handleTriggerClick: () => void
  _handleNativeChange: () => void
  _handleFormReset: () => void
  private _handleResize = (): void => {
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
    this._rafHandle = requestAnimationFrame(() => {
      if (this.calendarEl) this._updateLayout()
    })
  }

  static registerLocale(locale: string, strings: Partial<TranslationStrings>): void {
    DateTimeField.translations[locale] = {
      ...DateTimeField.translations.en,
      ...strings,
    }
  }

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll('[data-component="DateTimeField"]').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.__dateTimeFieldInstance) return
      htmlEl.__dateTimeFieldInstance = new DateTimeField(htmlEl)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.instanceId = ++DateTimeField.instanceCount
    this.native = el.querySelector<HTMLInputElement>('.native')!
    this.segments = el.querySelector<HTMLElement>('.segments')!
    this.trigger = el.querySelector<HTMLButtonElement>('.trigger')!
    this.announce = el.querySelector<HTMLElement>('.announce')!
    this.calendarTemplate = el.querySelector<HTMLTemplateElement>('.calendar-template')

    this.calendarEl = null
    this.selectedDatetime = null
    this.currentYear = new Date().getFullYear()
    this.currentMonth = new Date().getMonth()
    this.fieldId = ''
    // Raw tag drives Intl format (hour cycle + segment order); the collapsed key
    // only picks the UI-string translations (en-GB → 'en' strings, but 24h D/M/Y).
    this.localeTag = readLocale(this.root)
    this.locale = this._resolveLocale()
    this.t = DateTimeField.translations[this.locale] ?? DateTimeField.translations['en']

    this.min = el.dataset.min ? this._parseDatetime(el.dataset.min) : null
    this.max = el.dataset.max ? this._parseDatetime(el.dataset.max) : null

    this._handleTriggerClick = () => this._toggleCalendar()
    this._handleNativeChange = () => {
      if (this._syncingFromCustom) return
      if (!this.native.value) return
      this.selectedDatetime = this._parseDatetime(this.native.value)
      this._syncSegmentsFromDatetime(this.selectedDatetime)
    }
    this._handleFormReset = () => {
      this.selectedDatetime = null
      this._segmentEls.forEach(seg => this._clearSegment(seg))
    }

    this._init()
  }

  _resolveLocale(): string {
    return resolveLocale(readLocale(this.root), DateTimeField.translations)
  }

  _parseDatetime(value: string): Date {
    // Handles YYYY-MM-DDTHH:mm and YYYY-MM-DDTHH:mm:ss
    const [datePart, timePart = '00:00'] = value.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [hh, mm, ss = 0] = timePart.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, ss)
  }

  _is12h(): boolean {
    return new Intl.DateTimeFormat(this.localeTag, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
  }

  _showSeconds(): boolean {
    const step = Number(this.root.dataset.step ?? 60)
    return !isNaN(step) && step < 60
  }

  _init(): void {
    this.fieldId = this.root.dataset.id ?? `datetimefield-${this.instanceId}`
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? ''

    const coarse = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false
    if (coarse) {
      this._initDisplay()
    } else {
      this._initInteractive()
    }

    this.root.dataset.initialized = 'true'
  }

  _initInteractive(): void {
    this.root.dataset.inputMode = 'custom'

    const labelEl = this.native.id
      ? document.querySelector<HTMLLabelElement>(`label[for="${this.native.id}"]`)
      : null
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${this.fieldId}-label`
      this.segments.setAttribute('aria-labelledby', labelEl.id)
    } else if (this.root.dataset.labelField) {
      this.segments.setAttribute('aria-label', this.root.dataset.labelField)
    }

    this._buildSegments()
    this._bindSegmentEvents()
    this._bindTrigger()
    this._buildSlideContainer()

    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this._applyDisabled()
    }
    if (this.root.hasAttribute('data-invalid')) {
      this.native.setAttribute('aria-invalid', 'true')
    }

    const initialValue = this.root.dataset.value ?? this.native.value
    if (initialValue) {
      this.selectedDatetime = this._parseDatetime(initialValue)
      this._syncSegmentsFromDatetime(this.selectedDatetime)
    }

    this.native.addEventListener('change', this._handleNativeChange)
    this.native.form?.addEventListener('reset', this._handleFormReset)
    window.addEventListener('resize', this._handleResize)
  }

  // ─── Display mode (touch / coarse pointer) ────────────────────────────────
  // Keep the custom appearance, but defer interaction to the native input,
  // which sits transparently on top and fires the platform picker on tap.
  _initDisplay(): void {
    this.root.dataset.inputMode = 'display'

    // The native input is the real, accessible control on touch; the overlay
    // segments are decorative only.
    this.native.removeAttribute('aria-hidden')
    this.native.removeAttribute('tabindex')
    this.root.querySelector('.overlay')?.setAttribute('aria-hidden', 'true')

    if (this.native.disabled || this.root.hasAttribute('data-disabled')) {
      this._applyDisabled()
    }
    if (this.root.hasAttribute('data-invalid')) {
      this.native.setAttribute('aria-invalid', 'true')
    }

    this._buildSegments()
    this._segmentEls.forEach(seg => seg.setAttribute('tabindex', '-1'))

    const initialValue = this.root.dataset.value ?? this.native.value
    if (initialValue) {
      this.selectedDatetime = this._parseDatetime(initialValue)
      this._syncSegmentsFromDatetime(this.selectedDatetime)
    }

    this.native.addEventListener('change', this._handleNativeChange)
    this.native.form?.addEventListener('reset', this._handleFormReset)
  }

  _applyDisabled(): void {
    this.native.disabled = true
    this._segmentEls.forEach(seg => {
      seg.setAttribute('tabindex', '-1')
      seg.setAttribute('aria-disabled', 'true')
    })
    this.trigger.disabled = true
  }

  _buildSlideContainer(): void {
    let container = this.root.querySelector<HTMLElement>('.rail')
    if (!container) {
      container = document.createElement('div')
      container.className = 'rail'
      this.root.appendChild(container)
    }
    this._rail = container
  }

  _updateLayout(): void {
    if (!this.calendarEl) return
    const triggerRect = this.trigger.getBoundingClientRect()
    const containerRect = this._rail.getBoundingClientRect()
    const calendarWidth = this.calendarEl.getBoundingClientRect().width
    if (!containerRect.width || !calendarWidth) return

    this.root.dataset.direction = detectDirection(triggerRect)

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const viewportInset = this._getCSSPx('--_dtf-site-padding') / 2

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      calendarWidth,
      window.innerWidth,
      viewportInset,
    )
    this.root.style.setProperty('--_dtf-popup-offset', `${offset}%`)

    const calendarLeft = containerRect.left + (offset / 100 * containerRect.width) - calendarWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      calendarLeft,
      calendarWidth,
      this._getCSSPx('--_dtf-arrow-corner-radius'),
      this._getCSSPx('--_dtf-arrow-size'),
    )
    this.root.style.setProperty('--_dtf-arrow-offset', `${arrowOffset}px`)
  }

  _getCSSPx(property: string): number {
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`
    // Append inside the component root so component-scoped tokens (--_dtf-*) resolve;
    // appending to document.body would resolve them to the var() fallback (0).
    this.root.appendChild(probe)
    const value = parseFloat(getComputedStyle(probe).width) || 0
    probe.remove()
    return value
  }

  destroy(): void {
    this._segmentEls.forEach(seg => {
      const h = seg.__dateTimeFieldHandlers
      if (h) {
        seg.removeEventListener('keydown', h.keydown)
        seg.removeEventListener('focus', h.focus)
        seg.removeEventListener('blur', h.blur)
        delete seg.__dateTimeFieldHandlers
      }
    })
    this.trigger.removeEventListener('click', this._handleTriggerClick)
    this.native.removeEventListener('change', this._handleNativeChange)
    this.native.form?.removeEventListener('reset', this._handleFormReset)
    window.removeEventListener('resize', this._handleResize)
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
    this._closeCalendar(false)
    delete this.root.__dateTimeFieldInstance
  }

  _buildSegments(): void {
    this.segments.innerHTML = ''
    this._segmentEls = []

    const { order, separator } = getSegmentOrder(this.localeTag)

    // Date segments (locale-ordered)
    order.forEach((type, i) => {
      if (i > 0) this._appendSep(separator)
      const seg = this._createSegment(type)
      this.segments.appendChild(seg)
      this._segmentEls.push(seg)
    })

    // Time separator
    this._appendSep(', ')

    // Hour segment
    const hourSeg = this._createSegment('hour')
    this.segments.appendChild(hourSeg)
    this._segmentEls.push(hourSeg)

    this._appendSep(':')

    // Minute segment
    const minSeg = this._createSegment('minute')
    this.segments.appendChild(minSeg)
    this._segmentEls.push(minSeg)

    // Second segment — only when step < 60
    if (this._showSeconds()) {
      this._appendSep(':')
      const secSeg = this._createSegment('second')
      this.segments.appendChild(secSeg)
      this._segmentEls.push(secSeg)
    }

    // AM/PM segment — only for 12h locales
    if (this._is12h()) {
      this._appendSep(' ')
      const ampmSeg = this._createSegment('ampm')
      this.segments.appendChild(ampmSeg)
      this._segmentEls.push(ampmSeg)
    }

    this.segments.setAttribute('aria-roledescription', this.t.dateTimeField)

    // Roving tabindex — first segment is initially tabbable
    this._segmentEls.forEach((seg, i) => {
      seg.setAttribute('tabindex', i === 0 ? '0' : '-1')
    })
  }

  _appendSep(text: string): void {
    const sep = document.createElement('span')
    sep.className = 'separator'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = text
    this.segments.appendChild(sep)
  }

  _createSegment(type: SegmentType): HTMLSpanElement {
    const seg = document.createElement('span')
    seg.className = 'segment'
    seg.setAttribute('role', 'spinbutton')
    seg.dataset.segment = type

    if (type === 'ampm') {
      seg.setAttribute('aria-label', `${this.t.am}/${this.t.pm}`)
      seg.setAttribute('aria-valuetext', this.t.am)
      seg.setAttribute('aria-valuenow', '0') // 0 = AM, 1 = PM
      seg.textContent = this.t.am
      return seg
    }

    const limits = this._getSegmentLimits(type)
    const labels: Record<string, string> = {
      day: this.t.day, month: this.t.month, year: this.t.year,
      hour: this.t.hour, minute: this.t.minute, second: this.t.second,
    }

    seg.setAttribute('aria-label', labels[type])
    seg.setAttribute('aria-valuemin', String(limits.min))
    seg.setAttribute('aria-valuemax', String(limits.max))
    seg.setAttribute('data-placeholder', 'true')
    seg.setAttribute('aria-valuetext', SEGMENT_PLACEHOLDERS[type])
    seg.textContent = SEGMENT_PLACEHOLDERS[type]

    return seg
  }

  _getSegmentLimits(type: SegmentType): { min: number; max: number } {
    if (type === 'day') {
      const year = this._getSegmentValueByType('year') ?? new Date().getFullYear()
      const month = this._getSegmentValueByType('month')
      return { min: 1, max: month != null ? getDaysInMonth(year, month - 1) : 31 }
    }
    if (type === 'month') return { min: 1, max: 12 }
    if (type === 'year') return {
      min: this.min ? this.min.getFullYear() : 1900,
      max: this.max ? this.max.getFullYear() : 2100,
    }
    if (type === 'hour') return { min: this._is12h() ? 1 : 0, max: this._is12h() ? 12 : 23 }
    if (type === 'minute') return { min: 0, max: 59 }
    if (type === 'second') return { min: 0, max: 59 }
    return { min: 0, max: 1 } // ampm
  }

  _getSegmentEl(type: SegmentType): HTMLSpanElement | null {
    return this._segmentEls.find(s => s.dataset.segment === type) ?? null
  }

  _getSegmentValueByType(type: SegmentType): number | null {
    const seg = this._getSegmentEl(type)
    return seg ? this._getCurrentSegmentValue(seg) : null
  }

  _getCurrentSegmentValue(seg: HTMLSpanElement): number | null {
    return seg.hasAttribute('data-placeholder') ? null : Number(seg.getAttribute('aria-valuenow'))
  }

  _clearSegment(seg: HTMLSpanElement): void {
    const type = seg.dataset.segment as SegmentType
    if (type === 'ampm') {
      seg.setAttribute('aria-valuenow', '0')
      seg.setAttribute('aria-valuetext', this.t.am)
      seg.textContent = this.t.am
      return
    }
    seg.setAttribute('data-placeholder', 'true')
    seg.removeAttribute('aria-valuenow')
    seg.setAttribute('aria-valuetext', SEGMENT_PLACEHOLDERS[type] ?? '--')
    seg.textContent = SEGMENT_PLACEHOLDERS[type] ?? '--'
  }

  _setSegmentValue(seg: HTMLSpanElement | null, numericValue: number): void {
    if (!seg) return
    const type = seg.dataset.segment as SegmentType
    seg.removeAttribute('data-placeholder')
    seg.setAttribute('aria-valuenow', String(numericValue))

    if (type === 'ampm') {
      const label = numericValue === 0 ? this.t.am : this.t.pm
      seg.setAttribute('aria-valuetext', label)
      seg.textContent = label
      this._trySyncToNative()
      return
    }

    if (type === 'month') {
      const year = this._getSegmentValueByType('year') ?? new Date().getFullYear()
      seg.setAttribute('aria-valuetext', getMonthName(year, numericValue - 1, this.localeTag))
      seg.textContent = String(numericValue).padStart(2, '0')
      // Clamp the day if needed after month change
      const daySeg = this._getSegmentEl('day')
      if (daySeg) {
        const daysInMonth = getDaysInMonth(year, numericValue - 1)
        daySeg.setAttribute('aria-valuemax', String(daysInMonth))
        const currentDay = this._getCurrentSegmentValue(daySeg)
        if (currentDay !== null && currentDay > daysInMonth) {
          this._setSegmentValue(daySeg, daysInMonth)
        }
      }
    } else if (type === 'day') {
      seg.setAttribute('aria-valuetext', String(numericValue))
      seg.textContent = String(numericValue).padStart(2, '0')
      seg.setAttribute('aria-valuemax', String(this._getSegmentLimits('day').max))
    } else if (type === 'year') {
      seg.setAttribute('aria-valuetext', String(numericValue))
      seg.textContent = String(numericValue)
    } else {
      // hour, minute, second
      seg.setAttribute('aria-valuetext', String(numericValue).padStart(2, '0'))
      seg.textContent = String(numericValue).padStart(2, '0')
    }

    this._trySyncToNative()
  }

  _syncSegmentsFromDatetime(dt: Date): void {
    this._setSegmentValue(this._getSegmentEl('year'), dt.getFullYear())
    this._setSegmentValue(this._getSegmentEl('month'), dt.getMonth() + 1)
    this._setSegmentValue(this._getSegmentEl('day'), dt.getDate())

    if (this._is12h()) {
      const h = dt.getHours()
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      this._setSegmentValue(this._getSegmentEl('hour'), h12)
      this._setSegmentValue(this._getSegmentEl('ampm'), h >= 12 ? 1 : 0)
    } else {
      this._setSegmentValue(this._getSegmentEl('hour'), dt.getHours())
    }
    this._setSegmentValue(this._getSegmentEl('minute'), dt.getMinutes())
    if (this._showSeconds()) {
      this._setSegmentValue(this._getSegmentEl('second'), dt.getSeconds())
    }
  }

  _trySyncToNative(): void {
    const d = this._getSegmentValueByType('day')
    const mo = this._getSegmentValueByType('month')
    const y = this._getSegmentValueByType('year')
    const min = this._getSegmentValueByType('minute')

    let h = this._getSegmentValueByType('hour')
    if (this._is12h() && h !== null) {
      const ampm = this._getSegmentValueByType('ampm') ?? 0
      h = h === 12 ? (ampm === 0 ? 0 : 12) : (ampm === 1 ? h + 12 : h)
    }

    if (d == null || mo == null || y == null || h == null || min == null) return

    const dt = new Date(y, mo - 1, d, h, min)
    if (this._showSeconds()) {
      const s = this._getSegmentValueByType('second')
      if (s == null) return
      dt.setSeconds(s)
    }

    // segment writes cascade here once per segment (e.g. _syncSegmentsFromDatetime
    // touches up to seven) — the equality gate keeps it to one change event and
    // one announcement per actual value change.
    const next = formatDatetimeISO(dt, this._showSeconds())
    this._syncingFromCustom = true
    if (this.native.value !== next) {
      this.native.value = next
      this.native.dispatchEvent(new Event('change', { bubbles: true }))
      const label = dt.toLocaleString(this.localeTag, {
        dateStyle: 'long',
        timeStyle: this._showSeconds() ? 'medium' : 'short',
      })
      this.announce.textContent = `${this.t.announceSelected} ${label}`
      this._updateClearButton()
    }
    this.selectedDatetime = dt
    this._syncingFromCustom = false
  }

  _incrementSegment(seg: HTMLSpanElement, delta: number): void {
    const type = seg.dataset.segment as SegmentType

    if (type === 'ampm') {
      const current = this._getCurrentSegmentValue(seg) ?? 0
      this._setSegmentValue(seg, current === 0 ? 1 : 0)
      return
    }

    const current = this._getCurrentSegmentValue(seg)
    const limits = this._getSegmentLimits(type)
    const start = current ?? (delta > 0 ? limits.min - 1 : limits.max + 1)
    let next = start + delta
    if (next > limits.max) next = limits.min
    if (next < limits.min) next = limits.max
    this._setSegmentValue(seg, next)
  }

  _handleSegmentKey(e: KeyboardEvent, seg: HTMLSpanElement): void {
    if (this.native.disabled) return
    const type = seg.dataset.segment as SegmentType

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
        this._moveSegmentFocus(seg, -1)
        break
      case 'Escape':
        if (this.calendarEl) { e.preventDefault(); this._closeCalendar() }
        break
      case 'a':
      case 'A':
        if (type === 'ampm') { e.preventDefault(); this._setSegmentValue(seg, 0) }
        break
      case 'p':
      case 'P':
        if (type === 'ampm') { e.preventDefault(); this._setSegmentValue(seg, 1) }
        break
      default:
        if (e.key >= '0' && e.key <= '9' && type !== 'ampm') {
          e.preventDefault()
          this._handleDigit(seg, e.key)
        }
    }
  }

  _setSegmentFocused(seg: HTMLSpanElement): void {
    if (this.calendarEl) this._closeCalendar(false)
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
    if (next) { this._setSegmentFocused(next); next.focus() }
  }

  _bindSegmentEvents(): void {
    this._segmentEls.forEach(seg => {
      const keydownHandler = (e: KeyboardEvent) => this._handleSegmentKey(e, seg)
      const focusHandler = () => this._setSegmentFocused(seg)
      const blurHandler = () => {
        seg.removeAttribute('data-focused')
        this._flushDigitBuffer(seg)
      }
      seg.__dateTimeFieldHandlers = { keydown: keydownHandler, focus: focusHandler, blur: blurHandler }
      seg.addEventListener('keydown', keydownHandler)
      seg.addEventListener('focus', focusHandler)
      seg.addEventListener('blur', blurHandler)
    })
  }

  _handleDigit(seg: HTMLSpanElement, digit: string): void {
    const type = seg.dataset.segment as SegmentType
    if (type === 'ampm') return

    clearTimeout(this._digitTimer ?? undefined)
    this._digitBuffer += digit
    const num = Number(this._digitBuffer)
    const len = this._digitBuffer.length
    const { min, max } = this._getSegmentLimits(type)

    this._showBuffer(seg, this._digitBuffer)

    // If first digit already exceeds max/10, no valid 2-digit completion exists — commit immediately
    if (len === 1 && num * 10 > max) {
      this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
      this._digitBuffer = ''
      this._moveSegmentFocus(seg, 1)
      return
    }

    if (type === 'year') {
      if (len === 4) {
        this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }
      return
    }

    if (len === 2) {
      if (num >= min && num <= max) {
        this._setSegmentValue(seg, num)
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }
    } else {
      this._digitTimer = setTimeout(() => {
        this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }, 1000)
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
    const type = seg.dataset.segment as SegmentType
    const num = Number(this._digitBuffer)
    if (type === 'year' && this._digitBuffer.length < 4) {
      this._clearSegment(seg)
    } else {
      const { min, max } = this._getSegmentLimits(type)
      this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
    }
    this._digitBuffer = ''
  }

  _bindTrigger(): void {
    this.trigger.setAttribute('aria-label', this.t.openCalendar)
    this.trigger.setAttribute('aria-expanded', 'false')
    if (this.native.disabled) {
      this.trigger.disabled = true
      return
    }
    this.trigger.addEventListener('click', this._handleTriggerClick)
  }

  _toggleCalendar(): void {
    if (this.calendarEl) {
      this._closeCalendar()
    } else {
      this._openCalendar()
    }
  }

  _openCalendar(): void {
    if (!this.calendarTemplate || this.calendarEl) return

    const clone = this.calendarTemplate.content.cloneNode(true) as DocumentFragment
    this.calendarEl = clone.querySelector<HTMLElement>('.popup')!
    this._rail.appendChild(this.calendarEl)
    this._updateLayout()

    this.calendarEl.setAttribute('aria-label', this.t.popupLabel)
    // The month/year trigger swaps an in-dialog panel of spinbutton wheels (not a
    // listbox popup), so it carries aria-controls + aria-expanded — not aria-haspopup.
    const pickerPanel = this.calendarEl.querySelector<HTMLElement>('[data-panel="picker"]')
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.month-year-trigger')
    if (pickerPanel && monthYearTrigger) {
      const pickerId = `${this.fieldId}-picker`
      pickerPanel.id = pickerId
      monthYearTrigger.setAttribute('aria-controls', pickerId)
    }
    this.root.dataset.open = 'true'
    this.trigger.setAttribute('aria-label', this.t.closeCalendar)
    this.trigger.setAttribute('aria-expanded', 'true')

    if (this.selectedDatetime) {
      this.currentYear = this.selectedDatetime.getFullYear()
      this.currentMonth = this.selectedDatetime.getMonth()
    }

    this._renderMonth()
    this._setupTimeWheels()
    this._bindCalendarEvents()
    this._updateClearButton()

    this.calendarEl.querySelector<HTMLElement>('.calendar-grid td:not([data-outside-month]):not([aria-disabled]) button, .calendar-footer-today')?.focus()
  }

  /**
   * Keep Clear actionable only when there is something to clear.
   *
   * `_calendarTabStops()` already filters on `!clearBtn.disabled`, so the code
   * expected this to exist — but nothing ever set it, and Clear sat enabled on an
   * empty field offering an action that does nothing. The other four fields in the
   * family disable it; this brings the fifth in line.
   */
  private _updateClearButton(): void {
    if (!this.calendarEl) return
    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')
    if (clearBtn) clearBtn.disabled = this.native.value === ''
  }

  _closeCalendar(refocusTrigger = true): void {
    if (!this.calendarEl) return
    if (this._popupAbort) {
      this._popupAbort.abort()
      this._popupAbort = null
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler)
      this._outsideClickHandler = null
    }
    this._wheels.forEach(w => w.destroy())
    this._wheels.clear()
    this.calendarEl.remove()
    this.calendarEl = null
    this.root.removeAttribute('data-open')
    this.trigger.setAttribute('aria-label', this.t.openCalendar)
    this.trigger.setAttribute('aria-expanded', 'false')
    if (refocusTrigger) this.trigger.focus()
  }

  _renderMonth(): void {
    if (!this.calendarEl) return

    const header = this.calendarEl.querySelector<HTMLElement>('.calendar-month-year')
    if (header) {
      header.textContent = `${getMonthName(this.currentYear, this.currentMonth, this.localeTag)} ${this.currentYear}`
    }

    const grid = this.calendarEl.querySelector<HTMLElement>('.calendar-grid')
    if (!grid) return
    grid.innerHTML = ''

    // Weekday header row
    const headerRow = document.createElement('tr')
    getWeekdayNames(this.localeTag).forEach(name => {
      const th = document.createElement('th')
      th.setAttribute('scope', 'col')
      th.textContent = name
      headerRow.appendChild(th)
    })
    const thead = document.createElement('thead')
    thead.appendChild(headerRow)
    grid.appendChild(thead)

    // Day grid
    const tbody = document.createElement('tbody')
    const today = new Date()
    const firstDay = getFirstWeekdayOfMonth(this.currentYear, this.currentMonth)
    const daysInMonth = getDaysInMonth(this.currentYear, this.currentMonth)
    const prevMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1
    const prevYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear
    const prevDays = getDaysInMonth(prevYear, prevMonth)

    let row = document.createElement('tr')
    let cellCount = 0

    // Leading outside-month cells
    for (let i = firstDay - 1; i >= 0; i--) {
      const td = document.createElement('td')
      td.setAttribute('data-outside-month', 'true')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('tabindex', '-1')
      btn.textContent = String(prevDays - i)
      td.appendChild(btn)
      row.appendChild(td)
      cellCount++
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(this.currentYear, this.currentMonth, d)
      const td = document.createElement('td')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.dataset.date = formatISO(date)

      // Both of these are read by this component's own stylesheet
      // (`td[data-today="true"] button`, `td[data-disabled="true"] button`) and
      // neither was ever set, so today was not bold and an out-of-range day
      // looked ordinary. The aria half was already correct, which is why only the
      // sighted rendering was wrong. DateField and WeekField both set them.
      if (date.toDateString() === today.toDateString()) td.dataset.today = 'true'

      const disabled = isDayDisabled(date, this.min, this.max)
      if (disabled) {
        td.dataset.disabled = 'true'
        td.setAttribute('aria-disabled', 'true')
        btn.setAttribute('tabindex', '-1')
      } else {
        btn.setAttribute('tabindex', '-1')
        btn.addEventListener('click', () => this._selectDate(date))
      }

      const isSelected = this.selectedDatetime &&
        formatISO(date) === formatISO(this.selectedDatetime)
      if (isSelected) {
        btn.setAttribute('aria-pressed', 'true')
        btn.setAttribute('tabindex', '0')
      }

      btn.textContent = String(d)
      td.appendChild(btn)
      row.appendChild(td)
      cellCount++

      if (cellCount % 7 === 0) {
        tbody.appendChild(row)
        row = document.createElement('tr')
      }
    }

    // Trailing outside-month cells
    if (cellCount % 7 !== 0) {
      let nextDay = 1
      while (cellCount % 7 !== 0) {
        const td = document.createElement('td')
        td.setAttribute('data-outside-month', 'true')
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.setAttribute('tabindex', '-1')
        btn.textContent = String(nextDay++)
        td.appendChild(btn)
        row.appendChild(td)
        cellCount++
      }
      tbody.appendChild(row)
    }

    grid.appendChild(tbody)

    // Ensure one button is focusable when none selected
    const focusable = grid.querySelector<HTMLButtonElement>('td:not([data-outside-month]):not([aria-disabled]) button')
    if (focusable && !grid.querySelector('[aria-pressed="true"]')) {
      focusable.setAttribute('tabindex', '0')
    }
  }

  _selectDate(date: Date): void {
    // Preserve existing time when selecting a new date
    const time = this.selectedDatetime ?? new Date()
    const merged = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      time.getHours(), time.getMinutes(), time.getSeconds()
    )
    this.selectedDatetime = merged
    this._syncSegmentsFromDatetime(merged)
    this._renderMonth()
  }

  _bindCalendarEvents(): void {
    if (!this.calendarEl) return

    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('.prev-month')
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('.next-month')
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-today')
    const nowBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-now')
    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.month-year-trigger')

    // Localised labels / button text (parity with DateField's footer + nav)
    prevBtn?.setAttribute('aria-label', this.t.prevMonth)
    nextBtn?.setAttribute('aria-label', this.t.nextMonth)
    monthYearTrigger?.setAttribute('aria-label', this.t.openPicker)
    if (clearBtn) clearBtn.textContent = this.t.clearButton
    if (todayBtn) todayBtn.textContent = this.t.todayButton
    if (nowBtn) nowBtn.textContent = this.t.nowButton

    prevBtn?.addEventListener('click', () => {
      this.currentMonth -= 1
      if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear-- }
      this._renderMonth()
    })

    nextBtn?.addEventListener('click', () => {
      this.currentMonth += 1
      if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++ }
      this._renderMonth()
    })

    todayBtn?.addEventListener('click', () => {
      const today = new Date()
      this._selectDate(today)
    })

    nowBtn?.addEventListener('click', () => {
      const now = new Date()
      this.selectedDatetime = now
      this._syncSegmentsFromDatetime(now)
      this._closeCalendar()
    })

    clearBtn?.addEventListener('click', () => {
      this.selectedDatetime = null
      this._segmentEls.forEach(seg => this._clearSegment(seg))
      this._syncingFromCustom = true
      this.native.value = ''
      this.native.dispatchEvent(new Event('change', { bubbles: true }))
      this._syncingFromCustom = false
      this._closeCalendar()
    })

    monthYearTrigger?.addEventListener('click', () => {
      if (this._isPickerActive()) {
        this._closePicker()
      } else {
        this._openPicker()
      }
    })

    // ArrowUp/Down steps the focused month/year wheel (wheels built in _openPicker).
    this.calendarEl.querySelectorAll<HTMLElement>('.year-month-picker .Wheel').forEach(host => {
      host.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        const which = host.dataset.picker as 'month' | 'year'
        this._pickerWheels.get(which)?.stepBy(e.key === 'ArrowDown' ? 1 : -1)
      })
    })

    this.calendarEl.addEventListener('keydown', (e: KeyboardEvent) => {
      this._handleCalendarKeydown(e)
    })

    // Shared popup hygiene: cyclic focus trap over the calendar panel's tab
    // stops (nav → grid → time wheels → am/pm → footer), plus wheel-scroll
    // containment (the time + month/year picker wheels sit inside this surface).
    // Escape + grid arrow-nav stay local (see _handleCalendarKeydown).
    this._popupAbort = new AbortController()
    trapPopupInteraction({
      container: this.calendarEl,
      tabStops: () => this._calendarTabStops(),
      signal: this._popupAbort.signal,
    })

    this._outsideClickHandler = (e: MouseEvent) => {
      // Light dismiss: don't refocus the trigger — that would scroll the viewport
      // back to an off-screen trigger and steal focus from whatever the user
      // clicked. Focus restoration is only for keyboard/Escape close.
      if (!this.root.contains(e.target as Node)) this._closeCalendar(false)
    }
    setTimeout(() => document.addEventListener('click', this._outsideClickHandler!), 0)
  }

  // Ordered tab stops for the shared focus trap. Depends on which panel is
  // active: the month/year picker is a modal-within-modal whose only stops are
  // its two wheels; the calendar panel cycles nav → grid → time wheels → am/pm
  // → footer. Hidden wheels (seconds off) and absent buttons are excluded so
  // Tab never lands on an unreachable control.
  //
  // The date grid is a SINGLE composite tab stop (WAI-ARIA grid pattern): it
  // uses roving tabindex internally (one cell tabindex="0", the rest "-1"), so
  // Tab must enter/leave the grid as a unit and arrow keys move within it — it
  // must contribute exactly one stop, not one per day.
  _calendarTabStops(): HTMLElement[] {
    if (!this.calendarEl) return []

    if (this._isPickerActive()) {
      return [
        this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="month"]'),
        this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="year"]'),
      ].filter((el): el is HTMLElement => Boolean(el))
    }

    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('.prev-month')
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.month-year-trigger')
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('.next-month')
    const grid = this.calendarEl.querySelector<HTMLElement>('.calendar-grid')
    // The grid's single stop is its current roving cell (falling back to the
    // first in-month, enabled cell — matches the component's own focus
    // selectors at ~812/~938). Outside-month cells are decorative here and are
    // never rovered onto, so they are excluded from the trap too.
    const gridStop = grid
      ? grid.querySelector<HTMLButtonElement>(
          'td:not([data-outside-month]):not([aria-disabled]) button[tabindex="0"]',
        ) ??
        grid.querySelector<HTMLButtonElement>(
          'td:not([data-outside-month]):not([aria-disabled]) button',
        )
      : null
    const timeWheels = Array.from(
      this.calendarEl.querySelectorAll<HTMLElement>('.Wheel[data-segment][role="spinbutton"]'),
    ).filter(w => w.style.display !== 'none')
    const ampmButtons = Array.from(
      this.calendarEl.querySelectorAll<HTMLButtonElement>('.ampm-option'),
    )
    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-today')
    const nowBtn = this.calendarEl.querySelector<HTMLButtonElement>('.calendar-footer-now')

    const stops: Array<HTMLElement | null> = [
      prevBtn,
      monthYearTrigger,
      nextBtn,
      gridStop,
      ...timeWheels,
      ...ampmButtons,
      ...(clearBtn && !clearBtn.disabled ? [clearBtn] : []),
      ...(todayBtn && !todayBtn.disabled ? [todayBtn] : []),
      ...(nowBtn && !nowBtn.disabled ? [nowBtn] : []),
    ]
    return stops.filter((el): el is HTMLElement => el !== null)
  }

  _handleCalendarKeydown(e: KeyboardEvent): void {
    if (this._isPickerActive()) {
      this._handlePickerKeydown(e)
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      this._closeCalendar()
      return
    }

    const focused = document.activeElement as HTMLButtonElement | null
    if (!focused?.dataset.date) return

    const current = new Date(focused.dataset.date + 'T00:00')

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      this._focusCalendarDate(new Date(current.getTime() + 86400000))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      this._focusCalendarDate(new Date(current.getTime() - 86400000))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      this._focusCalendarDate(new Date(current.getTime() + 7 * 86400000))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this._focusCalendarDate(new Date(current.getTime() - 7 * 86400000))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      this.currentMonth -= 1
      if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear-- }
      this._renderMonth()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, current.getDate())))
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      this.currentMonth += 1
      if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++ }
      this._renderMonth()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, current.getDate())))
    } else if (e.key === 'Home') {
      e.preventDefault()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, 1))
    } else if (e.key === 'End') {
      e.preventDefault()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, getDaysInMonth(this.currentYear, this.currentMonth)))
    }
  }

  _focusCalendarDate(date: Date): void {
    if (!this.calendarEl) return
    const iso = formatISO(date)
    const btn = this.calendarEl.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)
    if (btn) {
      this.calendarEl.querySelectorAll<HTMLButtonElement>('[data-date]').forEach(b => b.setAttribute('tabindex', '-1'))
      btn.setAttribute('tabindex', '0')
      btn.focus()
    } else {
      // Navigate to the correct month first
      this.currentYear = date.getFullYear()
      this.currentMonth = date.getMonth()
      this._renderMonth()
      const newBtn = this.calendarEl.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)
      if (newBtn) { newBtn.setAttribute('tabindex', '0'); newBtn.focus() }
    }
  }

  _openPicker(): void {
    if (!this.calendarEl) return
    this._pickerEntryYear = this.currentYear
    this._pickerEntryMonth = this.currentMonth
    const pickerGroup = this.calendarEl.querySelector<HTMLElement>('.year-month-picker')!
    pickerGroup.setAttribute('aria-label', this.t.openPicker)
    const monthHost = this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="month"]')!
    const yearHost = this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="year"]')!

    const minYear = this.min ? this.min.getFullYear() : 1900
    const maxYear = this.max ? this.max.getFullYear() : 2100

    // Fresh wheels each open (rebuilt from the current month/year)
    this._pickerWheels.forEach(w => w.destroy())
    this._pickerWheels.clear()
    monthHost.replaceChildren()
    yearHost.replaceChildren()

    // Spinning a wheel updates the field live (same as the time wheels): rebuild
    // the date part on selectedDatetime, preserving the time and clamping the day,
    // defaulting to now when nothing is selected yet. Month loops (Dec↔Jan); year
    // stays capped at min/max.
    const applyPickerDate = (year: number, month: number): void => {
      const base = this.selectedDatetime ? new Date(this.selectedDatetime) : new Date()
      const next = new Date(
        year, month, clampDayToMonth(year, month, base.getDate()),
        base.getHours(), base.getMinutes(), base.getSeconds(),
      )
      this.selectedDatetime = next
      this.currentYear = next.getFullYear()
      this.currentMonth = next.getMonth()
      this._syncSegmentsFromDatetime(next)
      this._renderMonth()
    }

    monthHost.id = `${this.fieldId}-picker-month`
    monthHost.setAttribute('aria-label', this.t.month)
    this._pickerWheels.set('month', new WheelColumn(monthHost, {
      min: 0, max: 11, value: this.currentMonth, loop: true,
      format: (v) => getMonthName(this.currentYear, v, this.localeTag),
      onChange: (m) => applyPickerDate(this.currentYear, m),
    }))

    yearHost.id = `${this.fieldId}-picker-year`
    yearHost.setAttribute('aria-label', this.t.year)
    this._pickerWheels.set('year', new WheelColumn(yearHost, {
      min: minYear, max: maxYear, value: this.currentYear, loop: false,
      format: (v) => String(v),
      onChange: (y) => applyPickerDate(y, this.currentMonth),
    }))

    this.calendarEl.querySelector<HTMLButtonElement>('.month-year-trigger')?.setAttribute('aria-expanded', 'true')
    this._setPanel('picker')
    monthHost.focus()
  }

  _closePicker(): void {
    if (!this.calendarEl) return
    this._pickerWheels.forEach(w => w.destroy())
    this._pickerWheels.clear()
    this._setPanel('calendar')
    this._renderMonth()
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.month-year-trigger')
    monthYearTrigger?.setAttribute('aria-expanded', 'false')
    monthYearTrigger?.focus()
  }

  // Deterministic panel switch: set data-active="true" on the named panel and
  // "false" on its siblings. Exactly one body panel is active at a time. The off
  // value is explicit (not the removed-attribute default) so CSS can style AND
  // transition the inactive panel — you can't animate an attribute's removal.
  // See `.claude/philosophy.md` → boolean state exception.
  _setPanel(active: 'calendar' | 'picker'): void {
    this.calendarEl?.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => {
      panel.setAttribute('data-active', String(panel.dataset.panel === active))
    })
  }

  _isPickerActive(): boolean {
    return this.calendarEl?.querySelector('[data-panel="picker"]')?.getAttribute('data-active') === 'true'
  }

  _handlePickerKeydown(e: KeyboardEvent): void {
    // Escape cancels — restore the month/year the picker opened on.
    if (e.key === 'Escape') {
      e.preventDefault()
      this.currentYear = this._pickerEntryYear
      this.currentMonth = this._pickerEntryMonth
      this._closePicker()
      return
    }
    // Tab (month↔year wheel cycle) is owned by the shared focus trap — when the
    // picker panel is active, _calendarTabStops returns just the two wheels.
    // ArrowUp/Down handled per-wheel-host (see _bindCalendarEvents → stepBy).
  }

  // ─── Time wheels (shared 3D spinner, same as TimeField) ──────────────────────

  _setupTimeWheels(): void {
    if (!this.calendarEl) return
    this._wheels.forEach(w => w.destroy())
    this._wheels.clear()

    const is12 = this._is12h()
    const h = this.selectedDatetime ? this.selectedDatetime.getHours() : null
    const hourVal = h === null ? null : (is12 ? (h === 0 ? 12 : h > 12 ? h - 12 : h) : h)
    const initial: Record<'hour' | 'minute' | 'second', number | null> = {
      hour: hourVal,
      minute: this.selectedDatetime ? this.selectedDatetime.getMinutes() : null,
      second: this.selectedDatetime ? this.selectedDatetime.getSeconds() : null,
    }

    const types: Array<'hour' | 'minute' | 'second'> = ['hour', 'minute']
    if (this._showSeconds()) types.push('second')

    // Hide the seconds wheel host when seconds are off
    const secondHost = this.calendarEl.querySelector<HTMLElement>('.Wheel[data-segment="second"]')
    if (secondHost) secondHost.style.display = this._showSeconds() ? '' : 'none'

    types.forEach(type => {
      const host = this.calendarEl!.querySelector<HTMLElement>(`.Wheel[data-segment="${type}"]`)
      if (!host) return
      host.id = `${this.fieldId}-wheel-${type}`
      host.setAttribute('aria-label', type === 'hour' ? this.t.hours : type === 'minute' ? this.t.minutes : this.t.seconds)
      const { min, max } = this._getSegmentLimits(type)
      const wheel = new WheelColumn(host, {
        min, max,
        value: initial[type],
        onChange: (value: number) => this._onWheelChange(type, value),
      })
      this._wheels.set(type, wheel)
      host.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          wheel.stepBy(e.key === 'ArrowDown' ? 1 : -1)
        }
      })
    })

    this._setupAmpmToggle()
  }

  _onWheelChange(type: 'hour' | 'minute' | 'second', value: number): void {
    const base = this.selectedDatetime ? new Date(this.selectedDatetime) : new Date()
    if (type === 'hour') {
      if (this._is12h()) {
        const ampm = this.selectedDatetime && this.selectedDatetime.getHours() >= 12 ? 1 : 0
        base.setHours(value === 12 ? (ampm === 1 ? 12 : 0) : ampm === 1 ? value + 12 : value)
      } else {
        base.setHours(value)
      }
    } else if (type === 'minute') {
      base.setMinutes(value)
    } else if (type === 'second') {
      base.setSeconds(value)
    }
    this.selectedDatetime = base
    this._syncSegmentsFromDatetime(base)
    this._updateAmpmToggle()
  }

  // ─── AM/PM toggle (12h only — a 2-state control, not a looping wheel) ────────

  _setupAmpmToggle(): void {
    if (!this.calendarEl) return
    const toggle = this.calendarEl.querySelector<HTMLElement>('.ampm')
    if (!toggle) return
    if (!this._is12h()) { toggle.hidden = true; return }

    toggle.hidden = false
    toggle.setAttribute('aria-label', `${this.t.am}/${this.t.pm}`)
    toggle.innerHTML = ''
    ;[{ v: 0, label: this.t.am }, { v: 1, label: this.t.pm }].forEach(({ v, label }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ampm-option'
      btn.dataset.ampm = String(v)
      btn.textContent = label
      btn.addEventListener('click', () => this._selectAmpm(v))
      toggle.appendChild(btn)
    })
    this._updateAmpmToggle()
  }

  _updateAmpmToggle(): void {
    if (!this.calendarEl || !this._is12h()) return
    const h = this.selectedDatetime ? this.selectedDatetime.getHours() : 0
    const active = h >= 12 ? 1 : 0
    this.calendarEl.querySelectorAll<HTMLButtonElement>('.ampm-option').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.ampm) === active))
    })
  }

  _selectAmpm(value: number): void {
    const base = this.selectedDatetime ? new Date(this.selectedDatetime) : new Date()
    const h = base.getHours()
    if (value === 0 && h >= 12) base.setHours(h - 12)
    if (value === 1 && h < 12) base.setHours(h + 12)
    this.selectedDatetime = base
    this._syncSegmentsFromDatetime(base)
    this._updateAmpmToggle()
  }
}

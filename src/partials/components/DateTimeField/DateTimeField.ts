// src/partials/components/DateTimeField/DateTimeField.ts

import {
  getDaysInMonth,
  clampDayToMonth,
  getFirstWeekdayOfMonth,
  getISOWeek,
  isDayDisabled,
  formatISO,
  formatDatetimeISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  type DateSegmentType,
} from '../../../utils/dates'
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../js/popup-position'

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
  calendarTemplate: HTMLTemplateElement | null

  calendarEl: HTMLElement | null
  selectedDatetime: Date | null
  currentYear: number
  currentMonth: number
  instanceId: number
  fieldId: string
  locale: string
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
  private _slideContainer!: HTMLElement
  _handleTriggerClick: () => void
  _handleNativeChange: () => void
  _handleFormReset: () => void

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
    this.native = el.querySelector<HTMLInputElement>('.DateTimeField-native')!
    this.segments = el.querySelector<HTMLElement>('.Segments')!
    this.trigger = el.querySelector<HTMLButtonElement>('.DateTimeField-trigger')!
    this.calendarTemplate = el.querySelector<HTMLTemplateElement>('.DateTimeField-calendarTemplate')

    this.calendarEl = null
    this.selectedDatetime = null
    this.currentYear = new Date().getFullYear()
    this.currentMonth = new Date().getMonth()
    this.fieldId = ''
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
    const loc = this.root.dataset.locale || document.documentElement.lang || 'en'
    return DateTimeField.translations[loc] ? loc : 'en'
  }

  _parseDatetime(value: string): Date {
    // Handles YYYY-MM-DDTHH:mm and YYYY-MM-DDTHH:mm:ss
    const [datePart, timePart = '00:00'] = value.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [hh, mm, ss = 0] = timePart.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, ss)
  }

  _is12h(): boolean {
    return new Intl.DateTimeFormat(this.locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
  }

  _showSeconds(): boolean {
    const step = Number(this.root.dataset.step ?? 60)
    return !isNaN(step) && step < 60
  }

  _init(): void {
    this.fieldId = this.root.dataset.id ?? `datetimefield-${this.instanceId}`
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? ''

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

    this.root.dataset.initialized = ''
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
    let container = this.root.querySelector<HTMLElement>('.slideContainer')
    if (!container) {
      container = document.createElement('div')
      container.className = 'slideContainer'
      this.root.appendChild(container)
    }
    this._slideContainer = container
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
    this._closeCalendar(false)
    delete this.root.__dateTimeFieldInstance
  }

  _buildSegments(): void {
    this.segments.innerHTML = ''
    this._segmentEls = []

    const { order, separator } = getSegmentOrder(this.locale)

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
    sep.className = 'Segment-sep'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = text
    this.segments.appendChild(sep)
  }

  _createSegment(type: SegmentType): HTMLSpanElement {
    const seg = document.createElement('span')
    seg.className = 'Segment'
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
    seg.setAttribute('data-placeholder', '')
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
    seg.setAttribute('data-placeholder', '')
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
      seg.setAttribute('aria-valuetext', getMonthName(year, numericValue - 1, this.locale))
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

    this._syncingFromCustom = true
    this.native.value = formatDatetimeISO(dt, this._showSeconds())
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
    seg.setAttribute('data-focused', '')
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
    this.calendarEl = clone.querySelector<HTMLElement>('.DateTimeFieldCalendar')!
    this._slideContainer.appendChild(this.calendarEl)

    this.calendarEl.setAttribute('aria-label', this.t.openCalendar)
    this.root.dataset.open = ''
    this.trigger.setAttribute('aria-label', this.t.closeCalendar)

    if (this.selectedDatetime) {
      this.currentYear = this.selectedDatetime.getFullYear()
      this.currentMonth = this.selectedDatetime.getMonth()
    }

    this._renderMonth()
    this._renderTimeColumns()
    this._bindCalendarEvents()

    this.calendarEl.querySelector<HTMLElement>('.CalendarGrid td:not([data-outside-month]):not([aria-disabled]) button, .CalendarFooterToday')?.focus()
  }

  _closeCalendar(restoreFocus = true): void {
    if (!this.calendarEl) return
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler)
      this._outsideClickHandler = null
    }
    this.calendarEl.remove()
    this.calendarEl = null
    this.root.removeAttribute('data-open')
    this.trigger.setAttribute('aria-label', this.t.openCalendar)
    if (restoreFocus) this.trigger.focus()
  }

  _renderMonth(): void {
    if (!this.calendarEl) return

    const header = this.calendarEl.querySelector<HTMLElement>('.CalendarMonthYear')
    if (header) {
      header.textContent = `${getMonthName(this.currentYear, this.currentMonth, this.locale)} ${this.currentYear}`
    }

    const grid = this.calendarEl.querySelector<HTMLElement>('.CalendarGrid')
    if (!grid) return
    grid.innerHTML = ''

    // Weekday header row
    const headerRow = document.createElement('tr')
    getWeekdayNames(this.locale).forEach(name => {
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
      td.setAttribute('data-outside-month', '')
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

      const disabled = isDayDisabled(date, this.min, this.max)
      if (disabled) {
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
        td.setAttribute('data-outside-month', '')
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

    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarPrev')
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarNext')
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarFooterToday')
    const nowBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarFooterNow')
    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarFooterClear')
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.MonthYearTrigger')

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
      this._renderTimeColumns()
      this._closeCalendar()
    })

    clearBtn?.addEventListener('click', () => {
      this.selectedDatetime = null
      this._segmentEls.forEach(seg => this._clearSegment(seg))
      this.native.value = ''
      this._closeCalendar()
    })

    monthYearTrigger?.addEventListener('click', () => {
      if (this.calendarEl?.dataset.view === 'picker') {
        this._closePicker()
      } else {
        this._openPicker()
      }
    })

    this.calendarEl.addEventListener('keydown', (e: KeyboardEvent) => {
      this._handleCalendarKeydown(e)
    })

    this._outsideClickHandler = (e: MouseEvent) => {
      if (!this.root.contains(e.target as Node)) this._closeCalendar()
    }
    setTimeout(() => document.addEventListener('click', this._outsideClickHandler!), 0)
  }

  _handleCalendarKeydown(e: KeyboardEvent): void {
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
    const monthList = this.calendarEl.querySelector<HTMLElement>('.MonthList')!
    const yearList = this.calendarEl.querySelector<HTMLElement>('.YearList')!

    monthList.setAttribute('aria-label', this.t.month)
    monthList.innerHTML = ''
    for (let i = 0; i < 12; i++) {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `${this.fieldId}-month-${i}`
      li.setAttribute('aria-selected', String(i === this.currentMonth))
      li.textContent = getMonthName(this.currentYear, i, this.locale)
      const monthDate = new Date(this.currentYear, i, 1)
      const monthEnd = new Date(this.currentYear, i + 1, 0)
      const isDisabled = (this.min && monthEnd < this.min) || (this.max && monthDate > this.max)
      if (isDisabled) {
        li.setAttribute('aria-disabled', 'true')
      } else {
        li.addEventListener('click', () => this._confirmPickerMonth(i))
      }
      monthList.appendChild(li)
    }
    monthList.setAttribute('aria-activedescendant', `${this.fieldId}-month-${this.currentMonth}`)

    yearList.setAttribute('aria-label', this.t.year)
    yearList.innerHTML = ''
    const minYear = this.min ? this.min.getFullYear() : 1900
    const maxYear = this.max ? this.max.getFullYear() : 2100
    for (let y = minYear; y <= maxYear; y++) {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `${this.fieldId}-year-${y}`
      li.setAttribute('aria-selected', String(y === this.currentYear))
      li.textContent = String(y)
      li.addEventListener('click', () => this._confirmPickerYear(y))
      yearList.appendChild(li)
    }
    yearList.setAttribute('aria-activedescendant', `${this.fieldId}-year-${this.currentYear}`)

    this.calendarEl.dataset.view = 'picker'
    const pickerGroup = this.calendarEl.querySelector<HTMLElement>('.YearMonthPicker')
    pickerGroup?.addEventListener('mousedown', e => e.preventDefault())
    monthList.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    yearList.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    monthList.focus()
  }

  _closePicker(): void {
    if (!this.calendarEl) return
    this.calendarEl.dataset.view = 'calendar'
    this._renderMonth()
    this.calendarEl.querySelector<HTMLButtonElement>('.MonthYearTrigger')?.focus()
  }

  _confirmPickerMonth(month: number): void {
    this.currentMonth = month
    this._closePicker()
  }

  _confirmPickerYear(year: number): void {
    this.currentYear = year
    this._closePicker()
  }

  _renderTimeColumns(): void {
    if (!this.calendarEl) return

    const hourList = this.calendarEl.querySelector<HTMLElement>('.HourList')!
    const minuteList = this.calendarEl.querySelector<HTMLElement>('.MinuteList')!
    const secondList = this.calendarEl.querySelector<HTMLElement>('.SecondList')
    const ampmList = this.calendarEl.querySelector<HTMLElement>('.AmPmList')

    const currentH = this.selectedDatetime ? this.selectedDatetime.getHours() : -1
    const currentM = this.selectedDatetime ? this.selectedDatetime.getMinutes() : -1
    const currentS = this.selectedDatetime ? this.selectedDatetime.getSeconds() : -1

    const renderList = (
      list: HTMLElement,
      values: { value: number; label: string }[],
      selectedValue: number,
      idPrefix: string,
      ariaLabel: string
    ) => {
      list.setAttribute('role', 'listbox')
      list.setAttribute('aria-label', ariaLabel)
      list.setAttribute('tabindex', '0')
      list.innerHTML = ''
      let activeId = ''
      values.forEach(({ value, label }) => {
        const li = document.createElement('li')
        li.setAttribute('role', 'option')
        li.id = `${this.fieldId}-${idPrefix}-${value}`
        const isSelected = value === selectedValue
        li.setAttribute('aria-selected', String(isSelected))
        li.textContent = label
        if (isSelected) activeId = li.id
        li.addEventListener('click', () => this._selectTimeValue(idPrefix as 'hour' | 'minute' | 'second' | 'ampm', value))
        list.appendChild(li)
      })
      if (activeId) {
        list.setAttribute('aria-activedescendant', activeId)
        list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
      }
      list.addEventListener('keydown', (e) => this._handleTimeListKey(e, list, idPrefix as 'hour' | 'minute' | 'second' | 'ampm'))
    }

    const maxH = this._is12h() ? 11 : 23
    const minH = 0

    renderList(
      hourList,
      Array.from({ length: maxH - minH + 1 }, (_, i) => ({
        value: minH + i,
        label: String(minH + i).padStart(2, '0'),
      })),
      this._is12h() ? (currentH > 12 ? currentH - 12 : currentH === 0 ? 0 : currentH) : currentH,
      'hour',
      this.t.hours
    )

    renderList(
      minuteList,
      Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') })),
      currentM,
      'minute',
      this.t.minutes
    )

    if (secondList && this._showSeconds()) {
      secondList.style.display = ''
      renderList(
        secondList,
        Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') })),
        currentS,
        'second',
        this.t.seconds
      )
    } else if (secondList) {
      secondList.style.display = 'none'
    }

    if (ampmList && this._is12h()) {
      ampmList.style.display = ''
      const ampmValue = currentH >= 12 ? 1 : 0
      renderList(
        ampmList,
        [{ value: 0, label: this.t.am }, { value: 1, label: this.t.pm }],
        ampmValue,
        'ampm',
        `${this.t.am}/${this.t.pm}`
      )
    } else if (ampmList) {
      ampmList.style.display = 'none'
    }
  }

  _selectTimeValue(type: 'hour' | 'minute' | 'second' | 'ampm', value: number): void {
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
    } else if (type === 'ampm') {
      const h = base.getHours()
      if (value === 0 && h >= 12) base.setHours(h - 12)
      if (value === 1 && h < 12) base.setHours(h + 12)
    }
    this.selectedDatetime = base
    this._syncSegmentsFromDatetime(base)
    this._renderTimeColumns()

    // Update aria-activedescendant on the list
    const listClass = type === 'hour' ? 'HourList' : type === 'minute' ? 'MinuteList' : type === 'second' ? 'SecondList' : 'AmPmList'
    const list = this.calendarEl?.querySelector<HTMLElement>(`.${listClass}`)
    if (list) {
      list.setAttribute('aria-activedescendant', `${this.fieldId}-${type}-${value}`)
    }
  }

  _handleTimeListKey(e: KeyboardEvent, list: HTMLElement, type: 'hour' | 'minute' | 'second' | 'ampm'): void {
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
    const activeId = list.getAttribute('aria-activedescendant') ?? ''
    const currentIdx = items.findIndex(li => li.id === activeId)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = items[(currentIdx + 1) % items.length]
      if (next) {
        list.setAttribute('aria-activedescendant', next.id)
        next.scrollIntoView({ block: 'nearest' })
        const value = Number(next.id.split('-').at(-1))
        this._selectTimeValue(type, value)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = items[(currentIdx - 1 + items.length) % items.length]
      if (prev) {
        list.setAttribute('aria-activedescendant', prev.id)
        prev.scrollIntoView({ block: 'nearest' })
        const value = Number(prev.id.split('-').at(-1))
        this._selectTimeValue(type, value)
      }
    } else if (e.key === 'Escape') {
      this._closeCalendar()
    }
  }
}

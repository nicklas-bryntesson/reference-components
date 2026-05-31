// src/partials/components/DateField/DateField.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../js/popup-position'
import {
  getDaysInMonth,
  clampDayToMonth,
  getFirstWeekdayOfMonth,
  getISOWeek,
  isDayDisabled,
  formatISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  type DateSegmentType,
} from '../../../utils/dates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranslationStrings {
  day: string
  month: string
  year: string
  openCalendar: string
  closeCalendar: string
  prevMonth: string
  nextMonth: string
  today: string
  selected: string
  notAvailable: string
  announceSelected: string
  dateField: string
  clearButton: string
  todayButton: string
  openPicker: string
  closePicker: string
}

interface SegmentHandlers {
  keydown: (e: KeyboardEvent) => void
  focus: () => void
  blur: () => void
}

declare global {
  interface HTMLElement {
    __dateFieldInstance?: DateField
  }
  interface HTMLSpanElement {
    __dateFieldHandlers?: SegmentHandlers
  }
}

// ─── DateField class ──────────────────────────────────────────────────────────

class DateField {
  static instanceCount: number = 0
  static translations: Record<string, TranslationStrings> = {
    en: {
      day: 'Day', month: 'Month', year: 'Year',
      openCalendar: 'Open calendar', closeCalendar: 'Close calendar',
      prevMonth: 'Previous month', nextMonth: 'Next month',
      today: 'today', selected: 'selected', notAvailable: 'not available',
      announceSelected: 'Selected date:', dateField: 'date field',
      clearButton: 'Clear', todayButton: 'Today',
      openPicker: 'Choose month and year', closePicker: 'Close month and year picker',
    }
  }

  // DOM refs
  root: HTMLElement
  native: HTMLInputElement
  custom: HTMLElement
  segments: HTMLElement
  trigger: HTMLButtonElement
  announce: HTMLElement
  calendarTemplate: HTMLTemplateElement | null
  private slideContainer!: HTMLElement

  // State
  calendarEl: HTMLElement | null
  selectedDate: Date | null
  currentYear: number
  currentMonth: number
  instanceId: number
  fieldId: string
  locale: string
  t: TranslationStrings
  min: Date | null
  max: Date | null

  // Internal
  private _pickerEntryYear = 0
  private _pickerEntryMonth = 0
  _syncingFromCustom: boolean
  _segmentEls: HTMLSpanElement[]
  _digitBuffer: string
  _digitTimer: ReturnType<typeof setTimeout> | null
  _outsideClickHandler: ((e: MouseEvent) => void) | null
  private _rafHandle: number | null = null
  _handleTriggerClick: () => void
  _handleNativeChange: () => void
  _handleFormReset: () => void

  static registerLocale(locale: string, strings: Partial<TranslationStrings>): void {
    DateField.translations[locale] = { ...DateField.translations.en, ...strings }
  }

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll('[data-component="DateField"]').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.__dateFieldInstance) return
      htmlEl.__dateFieldInstance = new DateField(htmlEl)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.instanceId = ++DateField.instanceCount
    this.native = el.querySelector<HTMLInputElement>('.Native')!
    this.custom = el.querySelector<HTMLElement>('.Custom')!
    this.segments = el.querySelector<HTMLElement>('.Segments')!
    this.trigger = el.querySelector<HTMLButtonElement>('.DateField-trigger')!
    this.announce = el.querySelector<HTMLElement>('.Announce')!
    this.calendarTemplate = el.querySelector<HTMLTemplateElement>('[data-template="datefield-calendar"]')

    this.calendarEl = null
    this.selectedDate = null
    this.currentYear = new Date().getFullYear()
    this.currentMonth = new Date().getMonth()
    this.fieldId = ''
    this._syncingFromCustom = false
    this._segmentEls = []
    this._digitBuffer = ''
    this._digitTimer = null
    this._outsideClickHandler = null

    this._handleTriggerClick = () => this._toggleCalendar()
    this._handleNativeChange = () => {
      if (this._syncingFromCustom) return
      if (!this.native.value) return
      const [y, m, d] = this.native.value.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      this.selectedDate = date
      this._setSegmentValue(this._getSegmentEl('day')!, d)
      this._setSegmentValue(this._getSegmentEl('month')!, m)
      this._setSegmentValue(this._getSegmentEl('year')!, y)
    }
    this._handleFormReset = () => {
      this.selectedDate = null
      this._segmentEls.forEach(seg => this._clearSegment(seg))
    }

    this.min = el.dataset.min ? this._parseDate(el.dataset.min) : null
    this.max = el.dataset.max ? this._parseDate(el.dataset.max) : null

    this.locale = this._resolveLocale()
    this.t = DateField.translations[this.locale] ?? DateField.translations['en']

    this._init()
  }

  _resolveLocale(): string {
    const loc = this.root.dataset.locale || document.documentElement.lang || 'en'
    return DateField.translations[loc] ? loc : 'en'
  }

  _parseDate(isoString: string): Date {
    const [y, m, d] = isoString.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  _init(): void {
    this.fieldId = this.root.dataset.id ?? `datefield-${this.instanceId}`
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? ''
    if (this.root.dataset.min) this.native.min = this.root.dataset.min
    if (this.root.dataset.max) this.native.max = this.root.dataset.max
    this.announce.id = `${this.fieldId}-announce`

    this.slideContainer = this.root.querySelector<HTMLElement>('.slideContainer')!

    const coarse = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false
    if (coarse) {
      this._initDisplay()
      this.root.setAttribute('data-initialized', '')
      return
    }
    this._initInteractive()
    window.addEventListener('resize', this._handleResize)
    this.root.setAttribute('data-initialized', '')
  }

  _initInteractive(): void {
    this.root.dataset.inputMode = 'custom'
    this.custom.removeAttribute('aria-hidden')

    const labelEl = this.native?.id
      ? document.querySelector<HTMLLabelElement>(`label[for="${this.native.id}"]`)
      : null
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${this.fieldId}-label`
      this.segments.setAttribute('aria-labelledby', labelEl.id)
    } else if (this.root.dataset.labelField) {
      this.segments.setAttribute('aria-label', this.root.dataset.labelField)
    }
    this.segments.setAttribute('aria-roledescription', this.t.dateField)

    if (this.native.disabled) this.root.dataset.disabled = ''
    this._buildSegments()
    this._bindSegmentEvents()
    this._bindTrigger()
    if (!this.native.disabled) {
      this._bindValueSync()
      this._bindFormReset()
    }
    this._syncInitialValue()
  }

  destroy(): void {
    if (this.calendarEl) this.calendarEl.remove()
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler)
    }

    window.removeEventListener('resize', this._handleResize)

    this.trigger?.removeEventListener('click', this._handleTriggerClick)
    this.native?.removeEventListener('change', this._handleNativeChange)

    if (this.native?.form && this._handleFormReset) {
      this.native.form.removeEventListener('reset', this._handleFormReset)
    }

    this._segmentEls.forEach(seg => {
      const handlers = seg.__dateFieldHandlers
      if (handlers) {
        seg.removeEventListener('keydown', handlers.keydown)
        seg.removeEventListener('focus', handlers.focus)
        seg.removeEventListener('blur', handlers.blur)
        delete seg.__dateFieldHandlers
      }
    })

    this.custom?.setAttribute('aria-hidden', 'true')
    delete this.root.__dateFieldInstance
  }

  // ─── Segments ───────────────────────────────────────────────────────────────

  _createSegmentEl(type: DateSegmentType): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'Segment'
    span.setAttribute('role', 'spinbutton')
    span.setAttribute('aria-label', this.t[type] || type)
    span.setAttribute('data-segment', type)
    span.setAttribute('data-placeholder', '')
    span.setAttribute('tabindex', '-1')

    const limits = this._getSegmentLimits(type)
    span.setAttribute('aria-valuemin', String(limits.min))
    span.setAttribute('aria-valuemax', String(limits.max))

    const placeholder = type === 'day' ? 'dd' : type === 'month' ? 'mm' : 'yyyy'
    span.setAttribute('aria-valuetext', placeholder)
    span.textContent = placeholder

    return span
  }

  _buildSegments(): void {
    this.segments.querySelectorAll('.Segment, .Separator').forEach(el => el.remove())

    const { order, separator } = getSegmentOrder(this.locale)

    order.forEach((type, i) => {
      this.trigger.before(this._createSegmentEl(type))
      if (i < order.length - 1) {
        const sep = document.createElement('span')
        sep.className = 'Separator'
        sep.setAttribute('aria-hidden', 'true')
        sep.textContent = separator
        this.trigger.before(sep)
      }
    })

    this._segmentEls = [...this.segments.querySelectorAll<HTMLSpanElement>('[data-segment]')]
    if (this._segmentEls.length > 0) {
      this._segmentEls[0].setAttribute('tabindex', '0')
    }

    if (this.native.disabled) {
      this._segmentEls.forEach(seg => {
        seg.setAttribute('tabindex', '-1')
        seg.setAttribute('aria-disabled', 'true')
      })
    }
  }

  _bindSegmentEvents(): void {
    this._segmentEls.forEach(seg => {
      const keydownHandler = (e: KeyboardEvent) => this._handleSegmentKey(e, seg)
      const focusHandler = () => this._setSegmentFocused(seg)
      const blurHandler = () => {
        seg.removeAttribute('data-focused')
        this._flushDigitBuffer(seg)
      }
      seg.__dateFieldHandlers = { keydown: keydownHandler, focus: focusHandler, blur: blurHandler }
      seg.addEventListener('keydown', keydownHandler)
      seg.addEventListener('focus', focusHandler)
      seg.addEventListener('blur', blurHandler)
    })
  }

  _initDisplay(): void {
    this.root.dataset.inputMode = 'display'
    if (this.native.disabled) this.root.dataset.disabled = ''

    this._buildSegments()
    this._segmentEls.forEach(seg => seg.setAttribute('tabindex', '-1'))

    this.native.addEventListener('change', this._handleNativeChange)
    this.native.form?.addEventListener('reset', this._handleFormReset)

    if (this.native.value) this._syncInitialValue()
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

  _handleSegmentKey(e: KeyboardEvent, seg: HTMLSpanElement): void {
    if (this.native.disabled) return
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
      default:
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault()
          this._handleDigit(seg, e.key)
        }
    }
  }

  _moveSegmentFocus(current: HTMLSpanElement, direction: number): void {
    const idx = this._segmentEls.indexOf(current)
    const next = this._segmentEls[idx + direction]
    if (next) { this._setSegmentFocused(next); next.focus() }
  }

  _getCurrentSegmentValue(seg: HTMLSpanElement): number | null {
    return seg.hasAttribute('data-placeholder') ? null : Number(seg.getAttribute('aria-valuenow'))
  }

  _getSegmentEl(type: DateSegmentType): HTMLSpanElement | null {
    return this._segmentEls.find(s => s.dataset.segment === type) ?? null
  }

  _getSegmentValueByType(type: DateSegmentType): number | null {
    const seg = this._getSegmentEl(type)
    return seg ? this._getCurrentSegmentValue(seg) : null
  }

  _getSegmentLimits(type: DateSegmentType): { min: number; max: number } {
    if (type === 'day') {
      const year = this._getSegmentValueByType('year') ?? new Date().getFullYear()
      const month = this._getSegmentValueByType('month')
      const daysInMonth = month != null ? getDaysInMonth(year, month - 1) : 31
      return { min: 1, max: daysInMonth }
    }
    if (type === 'month') return { min: 1, max: 12 }
    return {
      min: this.min ? this.min.getFullYear() : 1900,
      max: this.max ? this.max.getFullYear() : 2100,
    }
  }

  _incrementSegment(seg: HTMLSpanElement, delta: number): void {
    const type = seg.dataset.segment as DateSegmentType
    const current = this._getCurrentSegmentValue(seg)
    const limits = this._getSegmentLimits(type)
    const start = current ?? (delta > 0 ? limits.min - 1 : limits.max + 1)
    let next = start + delta
    if (next > limits.max) next = limits.min
    if (next < limits.min) next = limits.max
    this._setSegmentValue(seg, next)
  }

  _setSegmentValue(seg: HTMLSpanElement, numericValue: number): void {
    const type = seg.dataset.segment as DateSegmentType
    seg.removeAttribute('data-placeholder')
    seg.setAttribute('aria-valuenow', String(numericValue))

    if (type === 'month') {
      const year = this._getSegmentValueByType('year') ?? new Date().getFullYear()
      seg.setAttribute('aria-valuetext', getMonthName(year, numericValue - 1, this.locale))
      seg.textContent = String(numericValue).padStart(2, '0')
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
      const limits = this._getSegmentLimits('day')
      seg.setAttribute('aria-valuemax', String(limits.max))
    } else {
      seg.setAttribute('aria-valuetext', String(numericValue))
      seg.textContent = String(numericValue)
    }
    this._trySyncToNative()
  }

  _clearSegment(seg: HTMLSpanElement): void {
    const type = seg.dataset.segment as DateSegmentType
    seg.setAttribute('data-placeholder', '')
    seg.removeAttribute('aria-valuenow')
    const placeholder = type === 'day' ? 'dd' : type === 'month' ? 'mm' : 'yyyy'
    seg.setAttribute('aria-valuetext', placeholder)
    seg.textContent = placeholder
  }

  _handleDigit(seg: HTMLSpanElement, digit: string): void {
    const type = seg.dataset.segment as DateSegmentType
    clearTimeout(this._digitTimer ?? undefined)
    this._digitBuffer += digit
    const num = Number(this._digitBuffer)
    const len = this._digitBuffer.length
    const { min, max } = this._getSegmentLimits(type)

    this._showBuffer(seg, this._digitBuffer)

    if (type === 'year') {
      if (len === 4) {
        this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }
      return
    }

    // day or month — 1 or 2 digit segments
    if (len === 2) {
      if (num >= min && num <= max) {
        // In range: commit immediately and advance (responsive for valid input)
        this._setSegmentValue(seg, num)
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }
      // Out of range: buffer already shown by _showBuffer above.
      // Stay on segment — _flushDigitBuffer corrects on blur.
    } else {
      // Single digit: always wait for second digit or blur.
      // No fast-advance — the user may intend to follow with a second digit.
      this._digitTimer = setTimeout(() => {
        this._setSegmentValue(seg, Math.max(min, Math.min(max, num)))
        this._digitBuffer = ''
        this._moveSegmentFocus(seg, 1)
      }, 1000)
    }
  }

  _showBuffer(seg: HTMLSpanElement, buffer: string): void {
    // Update visual display only — do not touch data-placeholder or aria-valuenow
    // so _getCurrentSegmentValue still returns null until _setSegmentValue commits.
    seg.textContent = buffer
    seg.setAttribute('aria-valuetext', buffer)
  }

  _flushDigitBuffer(seg: HTMLSpanElement): void {
    if (!this._digitBuffer) return
    clearTimeout(this._digitTimer ?? undefined)
    this._digitTimer = null
    const type = seg.dataset.segment as DateSegmentType
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

  // ─── Value sync ─────────────────────────────────────────────────────────────

  _trySyncToNative(): void {
    const d = this._getSegmentValueByType('day')
    const m = this._getSegmentValueByType('month')
    const y = this._getSegmentValueByType('year')
    if (d == null || m == null || y == null) return

    const date = new Date(y, m - 1, d)
    if (isNaN(date.getTime())) return

    if (this.min) {
      const minDay = new Date(this.min.getFullYear(), this.min.getMonth(), this.min.getDate())
      if (date < minDay) return
    }
    if (this.max) {
      const maxDay = new Date(this.max.getFullYear(), this.max.getMonth(), this.max.getDate())
      if (date > maxDay) return
    }

    this.selectedDate = date
    this._syncingFromCustom = true
    this.native.value = formatISO(date)
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    this._syncingFromCustom = false

    const label = date.toLocaleDateString(this.locale, { dateStyle: 'long' })
    this.announce.textContent = `${this.t.announceSelected} ${label}`
  }

  _bindValueSync(): void {
    this.native.addEventListener('change', this._handleNativeChange)
  }

  _bindFormReset(): void {
    this.native.form?.addEventListener('reset', this._handleFormReset)
  }

  _syncInitialValue(): void {
    if (!this.native.value) return
    const [y, m, d] = this.native.value.split('-').map(Number)
    this.selectedDate = new Date(y, m - 1, d)
    this._setSegmentValue(this._getSegmentEl('day')!, d)
    this._setSegmentValue(this._getSegmentEl('month')!, m)
    this._setSegmentValue(this._getSegmentEl('year')!, y)
  }

  // ─── Calendar lifecycle ──────────────────────────────────────────────────────

  _toggleCalendar(): void {
    this.calendarEl ? this._closeCalendar() : this._openCalendar()
  }

  _openCalendar(): void {
    if (!this.calendarTemplate) return

    const clone = this.calendarTemplate.content.cloneNode(true) as DocumentFragment
    this.calendarEl = clone.querySelector<HTMLElement>('.DateField-popup')!

    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.MonthYearTrigger')!
    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('.PrevMonth')!
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('.NextMonth')!

    const calId = `${this.fieldId}-calendar`
    const monthId = `${this.fieldId}-month`
    this.calendarEl.id = calId
    this.calendarEl.setAttribute('aria-labelledby', monthId)
    monthYearTrigger.id = monthId
    monthYearTrigger.setAttribute('aria-label', this.t.openPicker)
    monthYearTrigger.addEventListener('click', () => {
      if (this.calendarEl?.dataset.view === 'picker') {
        this._confirmPickerMonth(this.currentMonth)
      } else {
        this._openPicker()
      }
    })

    // One-time picker setup: prevent mousedown from blurring list before click fires,
    // and track focus state for selected-item highlight colour
    const pickerGroup = this.calendarEl.querySelector<HTMLElement>('.YearMonthPicker')
    const monthList = this.calendarEl.querySelector<HTMLElement>('.MonthList')
    const yearList = this.calendarEl.querySelector<HTMLElement>('.YearList')
    if (pickerGroup && monthList && yearList) {
      pickerGroup.addEventListener('mousedown', (e) => e.preventDefault())
      const setFocused = (el: HTMLElement, val: boolean) => { el.dataset.focused = String(val) }
      monthList.addEventListener('focus', () => setFocused(monthList, true))
      monthList.addEventListener('blur', () => setFocused(monthList, false))
      yearList.addEventListener('focus', () => setFocused(yearList, true))
      yearList.addEventListener('blur', () => setFocused(yearList, false))
    }

    prevBtn.setAttribute('aria-label', this.t.prevMonth)
    nextBtn.setAttribute('aria-label', this.t.nextMonth)
    prevBtn.addEventListener('click', () => this._navigateMonth(-1))
    nextBtn.addEventListener('click', () => this._navigateMonth(1))

    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarFooterClear')!
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('.CalendarFooterToday')!
    clearBtn.textContent = this.t.clearButton
    todayBtn.textContent = this.t.todayButton
    clearBtn.disabled = this.selectedDate === null
    todayBtn.disabled = isDayDisabled(new Date(), this.min, this.max)
    clearBtn.addEventListener('click', () => this._clearDate())
    todayBtn.addEventListener('click', () => this._selectDate(new Date()))

    if (this.selectedDate) {
      this.currentYear = this.selectedDate.getFullYear()
      this.currentMonth = this.selectedDate.getMonth()
    } else {
      const today = new Date()
      this.currentYear = today.getFullYear()
      this.currentMonth = today.getMonth()
    }

    this._renderWeekdays()
    this._renderMonth()

    this.slideContainer.appendChild(this.calendarEl)
    this._updateLayout()

    this.root.dataset.state = 'open'
    this.trigger.setAttribute('aria-expanded', 'true')
    this.trigger.setAttribute('aria-label', this.t.closeCalendar)

    this.calendarEl.addEventListener('keydown', e => this._handleCalendarKeydown(e))

    this._outsideClickHandler = (e: MouseEvent) => {
      if (!this.root.contains(e.target as Node)) {
        // Light dismiss: don't refocus the trigger — that would scroll the
        // viewport back to an off-screen trigger and steal focus from whatever
        // the user clicked. Focus restoration is only for keyboard/Escape close.
        this._closeCalendar(false)
      }
    }
    setTimeout(() => document.addEventListener('click', this._outsideClickHandler!), 0)

    this._moveFocusIntoCalendar()
  }

  private _updateLayout(): void {
    if (!this.calendarEl) return

    const triggerRect = this.trigger.getBoundingClientRect()
    const containerRect = this.slideContainer.getBoundingClientRect()
    const calendarWidth = this.calendarEl.getBoundingClientRect().width
    if (!containerRect.width || !calendarWidth) return

    const direction = detectDirection(triggerRect)
    this.root.dataset.direction = direction

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const viewportInset = this._getCSSPx('--df-site-padding') / 2

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      calendarWidth,
      window.innerWidth,
      viewportInset,
    )
    this.root.style.setProperty('--df-popup-offset', `${offset}%`)

    const calendarLeft = containerRect.left + (offset / 100 * containerRect.width) - calendarWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      calendarLeft,
      calendarWidth,
      this._getCSSPx('--_df-arrow-corner-radius'),
      this._getCSSPx('--_df-arrow-size'),
    )
    this.root.style.setProperty('--df-arrow-offset', `${arrowOffset}px`)
  }

  private _getCSSPx(property: string): number {
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`
    this.root.appendChild(probe)
    const px = probe.getBoundingClientRect().width
    this.root.removeChild(probe)
    return px
  }

  private _handleResize = (): void => {
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
    this._rafHandle = requestAnimationFrame(() => {
      if (this.calendarEl) this._updateLayout()
    })
  }

  _closeCalendar(refocusTrigger = true): void {
    if (!this.calendarEl) return
    this.calendarEl.remove()
    this.calendarEl = null
    document.removeEventListener('click', this._outsideClickHandler!)
    this._outsideClickHandler = null
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle)
      this._rafHandle = null
    }

    this.root.dataset.state = 'idle'
    this.trigger.setAttribute('aria-expanded', 'false')
    this.trigger.setAttribute('aria-label', this.t.openCalendar)
    if (refocusTrigger) this.trigger.focus()
  }

  _navigateMonth(direction: number): void {
    this.currentMonth += direction
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++ }
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear-- }
    const refDay = this.selectedDate ? this.selectedDate.getDate() : new Date().getDate()
    this._applyDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, refDay)))
    this._renderMonth()
  }

  _openPicker(): void {
    if (!this.calendarEl) return
    this._pickerEntryYear = this.currentYear
    this._pickerEntryMonth = this.currentMonth
    const monthList = this.calendarEl.querySelector<HTMLElement>('.MonthList')!
    const yearList = this.calendarEl.querySelector<HTMLElement>('.YearList')!
    const pickerGroup = this.calendarEl.querySelector<HTMLElement>('.YearMonthPicker')!
    pickerGroup.setAttribute('aria-label', this.t.openPicker)
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.MonthYearTrigger')!

    // Render month options
    monthList.setAttribute('aria-label', this.t.month)
    monthList.innerHTML = ''
    for (let i = 0; i < 12; i++) {
      const name = getMonthName(this.currentYear, i, this.locale)
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `${this.fieldId}-month-${i}`
      li.setAttribute('aria-selected', String(i === this.currentMonth))
      const isDisabled = this._isMonthDisabled(this.currentYear, i)
      if (isDisabled) li.setAttribute('aria-disabled', 'true')
      li.textContent = name
      if (!isDisabled) li.addEventListener('click', () => this._confirmPickerMonth(i))
      monthList.appendChild(li)
    }
    monthList.setAttribute('aria-activedescendant', `${this.fieldId}-month-${this.currentMonth}`)

    // Render year options
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
    monthYearTrigger.setAttribute('aria-expanded', 'true')
    monthYearTrigger.setAttribute('aria-label', this.t.closePicker)

    // Scroll selected items into view after render
    monthList.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    yearList.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })

    monthList.focus()
  }

  _closePicker(): void {
    if (!this.calendarEl) return
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('.MonthYearTrigger')!
    this.calendarEl.dataset.view = 'calendar'
    monthYearTrigger.setAttribute('aria-expanded', 'false')
    monthYearTrigger.setAttribute('aria-label', this.t.openPicker)
    this._renderMonth()
    monthYearTrigger.focus()
  }

  private _isMonthDisabled(year: number, month: number): boolean {
    if (this.min) {
      if (year < this.min.getFullYear()) return true
      if (year === this.min.getFullYear() && month < this.min.getMonth()) return true
    }
    if (this.max) {
      if (year > this.max.getFullYear()) return true
      if (year === this.max.getFullYear() && month > this.max.getMonth()) return true
    }
    return false
  }

  private _confirmPickerMonth(month: number): void {
    this.currentMonth = month
    const refDay = this.selectedDate ? this.selectedDate.getDate() : new Date().getDate()
    this._applyDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, refDay)))
    this._closePicker()
  }

  private _confirmPickerYear(year: number): void {
    if (!this.calendarEl) return
    this.currentYear = year
    const yearList = this.calendarEl.querySelector<HTMLElement>('.YearList')!
    const monthList = this.calendarEl.querySelector<HTMLElement>('.MonthList')!

    // Update year selection in-place (no full re-render — preserves scroll position)
    yearList.querySelectorAll<HTMLElement>('[role="option"]').forEach(o => {
      o.setAttribute('aria-selected', String(o.id === `${this.fieldId}-year-${year}`))
    })
    yearList.setAttribute('aria-activedescendant', `${this.fieldId}-year-${year}`)
    yearList.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })

    // Refresh month disabled states for new year
    monthList.querySelectorAll<HTMLElement>('[role="option"]').forEach((o, i) => {
      const disabled = this._isMonthDisabled(year, i)
      if (disabled) {
        o.setAttribute('aria-disabled', 'true')
        o.onclick = null
      } else {
        o.removeAttribute('aria-disabled')
        o.onclick = () => this._confirmPickerMonth(i)
      }
    })

    // Keep focus in year list — user may want to refine the year before confirming month
    yearList.focus()
  }

  _renderWeekdays(): void {
    const names = getWeekdayNames(this.locale)
    const ths = this.calendarEl!.querySelectorAll('.Grid thead th')
    ths.forEach((th, i) => {
      if (!names[i]) return
      th.textContent = names[i]
      const anchor = new Date(2024, 0, 1)
      anchor.setDate(anchor.getDate() + i)
      th.setAttribute('aria-label', new Intl.DateTimeFormat(this.locale, { weekday: 'long' }).format(anchor))
    })
  }

  _renderMonth(): void {
    const monthYearTrigger = this.calendarEl!.querySelector<HTMLButtonElement>('.MonthYearTrigger')
    const monthName = getMonthName(this.currentYear, this.currentMonth, this.locale)
    if (monthYearTrigger) monthYearTrigger.textContent = `${monthName} ${this.currentYear}`

    const tbody = this.calendarEl!.querySelector<HTMLTableSectionElement>('.Grid tbody')!
    tbody.innerHTML = ''

    const today = new Date()
    const firstDay = getFirstWeekdayOfMonth(this.currentYear, this.currentMonth)
    const daysInMonth = getDaysInMonth(this.currentYear, this.currentMonth)

    const prevYear = this.currentMonth === 0 ? this.currentYear - 1 : this.currentYear
    const prevMonth = this.currentMonth === 0 ? 11 : this.currentMonth - 1
    const prevMonthDays = getDaysInMonth(prevYear, prevMonth)

    const nextYear = this.currentMonth === 11 ? this.currentYear + 1 : this.currentYear
    const nextMonth = this.currentMonth === 11 ? 0 : this.currentMonth + 1

    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    let dayCount = 1
    let nextMonthDay = 1
    let row = this._createRow()

    for (let i = 0; i < totalCells; i++) {
      if (i > 0 && i % 7 === 0) {
        tbody.appendChild(row)
        row = this._createRow()
      }

      let date: Date
      let isOutsideMonth = false
      if (i < firstDay) {
        date = new Date(prevYear, prevMonth, prevMonthDays - firstDay + i + 1)
        isOutsideMonth = true
      } else if (dayCount <= daysInMonth) {
        date = new Date(this.currentYear, this.currentMonth, dayCount++)
      } else {
        date = new Date(nextYear, nextMonth, nextMonthDay++)
        isOutsideMonth = true
      }

      row.appendChild(this._createCell(date, isOutsideMonth, today))
    }
    tbody.appendChild(row)

    this._updateRovingTabindex()
  }

  _createRow(): HTMLTableRowElement {
    const tr = document.createElement('tr')
    tr.setAttribute('role', 'row')
    return tr
  }

  _createCell(date: Date, isOutsideMonth: boolean, today: Date): HTMLTableCellElement {
    const td = document.createElement('td')
    td.setAttribute('role', 'gridcell')

    const isToday = date.toDateString() === today.toDateString()
    const isSelected = this.selectedDate != null && date.toDateString() === this.selectedDate.toDateString()
    const isDisabled = isDayDisabled(date, this.min, this.max)

    if (isOutsideMonth) td.dataset.outsideMonth = ''
    if (isToday) td.dataset.today = ''
    if (isSelected) { td.dataset.selected = ''; td.setAttribute('aria-selected', 'true') }
    else td.setAttribute('aria-selected', 'false')
    if (isDisabled) { td.dataset.disabled = ''; td.setAttribute('aria-disabled', 'true') }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.setAttribute('tabindex', '-1')
    btn.dataset.date = formatISO(date)

    const dateLabel = date.toLocaleDateString(this.locale, { dateStyle: 'long' })
    const suffixes = [
      isToday ? `, ${this.t.today}` : '',
      isSelected ? `, ${this.t.selected}` : '',
      isDisabled ? `, ${this.t.notAvailable}` : '',
    ].join('')
    btn.setAttribute('aria-label', `${dateLabel}${suffixes}`)
    btn.textContent = String(date.getDate())

    btn.addEventListener('click', () => {
      if (isDisabled) return
      if (isOutsideMonth) {
        this.currentYear = date.getFullYear()
        this.currentMonth = date.getMonth()
      }
      this._selectDate(date)
    })

    td.appendChild(btn)
    return td
  }

  _updateRovingTabindex(): void {
    const grid = this.calendarEl!.querySelector<HTMLElement>('.Grid')!
    grid.querySelectorAll('td button').forEach(b => b.setAttribute('tabindex', '-1'))

    const todayISO = formatISO(new Date())
    const todayBtn = grid.querySelector<HTMLButtonElement>(`button[data-date="${todayISO}"]`)
    const todayEnabled = todayBtn && !todayBtn.closest('[aria-disabled="true"]') ? todayBtn : null

    const target = grid.querySelector<HTMLButtonElement>('td[data-selected] button')
      ?? todayEnabled
      ?? grid.querySelector<HTMLButtonElement>('td:not([data-outside-month]):not([aria-disabled="true"]) button')
    if (target) target.setAttribute('tabindex', '0')
  }

  _moveFocusIntoCalendar(): void {
    const grid = this.calendarEl!.querySelector<HTMLElement>('.Grid')!
    const todayISO = formatISO(new Date())
    const todayBtn = grid.querySelector<HTMLButtonElement>(`button[data-date="${todayISO}"]`)
    const todayEnabled = todayBtn && !todayBtn.closest('[aria-disabled="true"]') ? todayBtn : null

    const target = grid.querySelector<HTMLButtonElement>('td[data-selected] button')
      ?? todayEnabled
      ?? grid.querySelector<HTMLButtonElement>('td:not([data-outside-month]):not([aria-disabled="true"]) button')
    target?.focus()
  }

  private _applyDate(date: Date): void {
    this.selectedDate = date
    this._syncingFromCustom = true
    this.native.value = formatISO(date)
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    this._syncingFromCustom = false
    this._setSegmentValue(this._getSegmentEl('day')!, date.getDate())
    this._setSegmentValue(this._getSegmentEl('month')!, date.getMonth() + 1)
    this._setSegmentValue(this._getSegmentEl('year')!, date.getFullYear())
    const label = date.toLocaleDateString(this.locale, { dateStyle: 'long' })
    this.announce.textContent = `${this.t.announceSelected} ${label}`
    const clearBtn = this.calendarEl?.querySelector<HTMLButtonElement>('.CalendarFooterClear')
    if (clearBtn) clearBtn.disabled = false
  }

  _selectDate(date: Date): void {
    this._applyDate(date)
    this._closeCalendar()
  }

  _clearDate(): void {
    this.selectedDate = null
    this._syncingFromCustom = true
    this.native.value = ''
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    this._syncingFromCustom = false
    this._segmentEls.forEach(seg => this._clearSegment(seg))
    this._closeCalendar()
  }

  // ─── Calendar keyboard ───────────────────────────────────────────────────────

  _handleCalendarKeydown(e: KeyboardEvent): void {
    if (this.calendarEl!.dataset.view === 'picker') {
      this._handlePickerKeydown(e)
      return
    }

    const grid = this.calendarEl!.querySelector<HTMLElement>('.Grid')!
    const focusedBtn = grid.querySelector<HTMLButtonElement>('button:focus')

    if (e.key === 'Escape') {
      e.preventDefault()
      this._closeCalendar()
      return
    }

    if (e.key === 'Tab') {
      const prevBtn = this.calendarEl!.querySelector<HTMLButtonElement>('.PrevMonth')!
      const monthYearTrigger = this.calendarEl!.querySelector<HTMLButtonElement>('.MonthYearTrigger')!
      const nextBtn = this.calendarEl!.querySelector<HTMLButtonElement>('.NextMonth')!
      const clearBtn = this.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterClear')
      const todayBtn = this.calendarEl!.querySelector<HTMLButtonElement>('.CalendarFooterToday')
      const tabbable = [
        prevBtn,
        monthYearTrigger,
        ...Array.from(grid.querySelectorAll<HTMLButtonElement>('td:not([aria-disabled="true"]) button')),
        nextBtn,
        ...(clearBtn && !clearBtn.disabled ? [clearBtn] : []),
        ...(todayBtn && !todayBtn.disabled ? [todayBtn] : []),
      ].filter((b): b is HTMLButtonElement => Boolean(b))

      const first = tabbable[0]
      const last = tabbable[tabbable.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      }
      return
    }

    if (!focusedBtn) return
    const currentISO = focusedBtn.dataset.date
    if (!currentISO) return
    const [fy, fm, fd] = currentISO.split('-').map(Number)
    let target = new Date(fy, fm - 1, fd)

    const arrowDelta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

    if (arrowDelta[e.key] !== undefined) {
      e.preventDefault()
      target.setDate(target.getDate() + arrowDelta[e.key])
      this._focusCalendarDate(target)
    } else if (e.ctrlKey && e.key === 'Home') {
      e.preventDefault()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, 1))
    } else if (e.ctrlKey && e.key === 'End') {
      e.preventDefault()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, getDaysInMonth(this.currentYear, this.currentMonth)))
    } else if (e.key === 'Home') {
      e.preventDefault()
      const dow = (target.getDay() + 6) % 7
      target.setDate(target.getDate() - dow)
      this._focusCalendarDate(target)
    } else if (e.key === 'End') {
      e.preventDefault()
      const dow = (target.getDay() + 6) % 7
      target.setDate(target.getDate() + (6 - dow))
      this._focusCalendarDate(target)
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      this.currentMonth -= 1
      if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear-- }
      this._renderMonth()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, fd)))
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      this.currentMonth += 1
      if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++ }
      this._renderMonth()
      this._focusCalendarDate(new Date(this.currentYear, this.currentMonth, clampDayToMonth(this.currentYear, this.currentMonth, fd)))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const td = focusedBtn.closest('td')
      if (td && !td.hasAttribute('aria-disabled')) {
        this._selectDate(target)
      }
    }
  }

  _handlePickerKeydown(e: KeyboardEvent): void {
    const monthList = this.calendarEl!.querySelector<HTMLElement>('.MonthList')!
    const yearList = this.calendarEl!.querySelector<HTMLElement>('.YearList')!
    const focused = document.activeElement

    if (e.key === 'Escape') {
      e.preventDefault()
      this.currentYear = this._pickerEntryYear
      this.currentMonth = this._pickerEntryMonth
      this._closePicker()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (!e.shiftKey && focused === monthList) { yearList.focus(); return }
      if (e.shiftKey && focused === yearList) { monthList.focus(); return }
      if (!e.shiftKey && focused === yearList) { monthList.focus(); return }
      if (e.shiftKey && focused === monthList) { yearList.focus(); return }
      return
    }

    const isList = focused === monthList || focused === yearList
    if (!isList) return

    const list = focused as HTMLElement
    const activeId = list.getAttribute('aria-activedescendant') ?? ''
    const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'))
    const currentIndex = options.findIndex(o => o.id === activeId)

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = e.key === 'ArrowDown'
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length
      const target = options[next]
      list.setAttribute('aria-activedescendant', target.id)
      list.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', 'false'))
      target.setAttribute('aria-selected', 'true')
      target.scrollIntoView({ block: 'nearest' })
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      const first = options[0]
      if (!first) return
      list.setAttribute('aria-activedescendant', first.id)
      list.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', 'false'))
      first.setAttribute('aria-selected', 'true')
      first.scrollIntoView({ block: 'nearest' })
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      const last = options[options.length - 1]
      if (!last) return
      list.setAttribute('aria-activedescendant', last.id)
      list.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', 'false'))
      last.setAttribute('aria-selected', 'true')
      last.scrollIntoView({ block: 'nearest' })
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const selected = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!selected) return
      if (list === monthList) {
        const month = parseInt(selected.id.split('-month-')[1], 10)
        this._confirmPickerMonth(month)
      } else {
        const year = parseInt(selected.id.split('-year-')[1], 10)
        this._confirmPickerYear(year)
      }
    }
  }

  _focusCalendarDate(date: Date): void {
    const iso = formatISO(date)
    let btn = this.calendarEl!.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`)

    if (!btn) {
      this.currentYear = date.getFullYear()
      this.currentMonth = date.getMonth()
      this._renderMonth()
      btn = this.calendarEl!.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`)
    }

    if (btn) {
      const grid = this.calendarEl!.querySelector<HTMLElement>('.Grid')!
      grid.querySelectorAll('td button').forEach(b => b.setAttribute('tabindex', '-1'))
      btn.setAttribute('tabindex', '0')
      btn.focus()
    }
  }
}

export default DateField

// src/partials/components/DateField/DateField.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../kernel/js/popup-position'
import { trapPopupInteraction } from '../../../kernel/js/popup-interaction'
import {
  getDaysInMonth,
  clampDayToMonth,
  getFirstWeekdayOfMonth,
  isDayDisabled,
  formatISO,
  getWeekdayNames,
  getMonthName,
  getSegmentOrder,
  type DateSegmentType,
} from '../../../kernel/utils/dates'
import { readLocale, resolveLocale } from '../../../kernel/utils/locale'
import WheelColumn from '../../../kernel/js/WheelColumn'

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
      empty: 'blank',
    },
    sv: {
      day: 'Dag', month: 'Månad', year: 'År',
      openCalendar: 'Öppna kalender', closeCalendar: 'Stäng kalender',
      prevMonth: 'Föregående månad', nextMonth: 'Nästa månad',
      today: 'idag', selected: 'valt', notAvailable: 'ej tillgängligt',
      announceSelected: 'Valt datum:', dateField: 'datumfält',
      clearButton: 'Rensa', todayButton: 'I dag',
      openPicker: 'Välj månad och år', closePicker: 'Stäng månads- och årsväljaren',
      empty: 'tomt',
    },
  }

  // DOM refs
  root: HTMLElement
  native: HTMLInputElement
  custom: HTMLElement
  segments: HTMLElement
  trigger: HTMLButtonElement
  announce: HTMLElement
  calendarTemplate: HTMLTemplateElement | null
  private rail!: HTMLElement
  private _pickerWheels: Map<'month' | 'year', WheelColumn> = new Map()

  // State
  calendarEl: HTMLElement | null
  selectedDate: Date | null
  currentYear: number
  currentMonth: number
  instanceId: number
  fieldId: string
  locale: string
  localeTag: string
  t: TranslationStrings
  min: Date | null
  max: Date | null

  // Internal
  _syncingFromCustom: boolean
  _segmentEls: HTMLSpanElement[]
  _digitBuffer: string
  _digitTimer: ReturnType<typeof setTimeout> | null
  _outsideClickHandler: ((e: MouseEvent) => void) | null
  private _rafHandle: number | null = null
  // Aborted on close — tears down the shared focus-trap + scroll-containment listeners.
  private _popupAbort: AbortController | null = null
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
    this.native = el.querySelector<HTMLInputElement>('[data-part="native"]')!
    this.custom = el.querySelector<HTMLElement>('[data-part="custom"]')!
    this.segments = el.querySelector<HTMLElement>('[data-part="segments"]')!
    this.trigger = el.querySelector<HTMLButtonElement>('[data-part="trigger"]')!
    this.announce = el.querySelector<HTMLElement>('[data-part="announce"]')!
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

    // Raw tag drives Intl format (segment order: en-GB is D/M/Y, en-US M/D/Y);
    // the collapsed key only picks the UI-string translations.
    this.localeTag = readLocale(this.root)
    this.locale = this._resolveLocale()
    this.t = DateField.translations[this.locale] ?? DateField.translations['en']

    this._init()
  }

  _resolveLocale(): string {
    return resolveLocale(readLocale(this.root), DateField.translations)
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

    this.rail = this.root.querySelector<HTMLElement>('[data-part="rail"]')!

    const coarse = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false
    if (coarse) {
      this._initDisplay()
      this.root.setAttribute('data-initialized', 'true')
      return
    }
    this._initInteractive()
    window.addEventListener('resize', this._handleResize)
    this.root.setAttribute('data-initialized', 'true')
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

    if (this.native.disabled) this.root.dataset.disabled = 'true'
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

  // ─── segments ───────────────────────────────────────────────────────────────

  _createSegmentEl(type: DateSegmentType): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'segment'
    span.setAttribute('data-part', 'segment')
    span.setAttribute('role', 'spinbutton')
    span.setAttribute('aria-label', this.t[type] || type)
    span.setAttribute('data-segment', type)
    span.setAttribute('data-placeholder', 'true')
    span.setAttribute('tabindex', '-1')

    const limits = this._getSegmentLimits(type)
    span.setAttribute('aria-valuemin', String(limits.min))
    span.setAttribute('aria-valuemax', String(limits.max))

    // The VISIBLE placeholder stays "dd"/"mm"/"yyyy", but the SPOKEN empty value
    // is the localized `empty` word: placeholder tokens read differently per
    // segment ("mm" ≠ "dd" in a screenreader's mouth), and omitting valuetext
    // entirely trips VoiceOver's percent fallback (measured on native's empty
    // segments: "−950 %, År"). One word, every segment, every field.
    const placeholder = type === 'day' ? 'dd' : type === 'month' ? 'mm' : 'yyyy'
    span.setAttribute('aria-valuetext', this.t.empty)
    span.textContent = placeholder

    return span
  }

  _buildSegments(): void {
    this.segments.querySelectorAll('[data-part="segment"], [data-part="separator"]').forEach(el => el.remove())

    const { order, separator } = getSegmentOrder(this.localeTag)

    order.forEach((type, i) => {
      this.trigger.before(this._createSegmentEl(type))
      if (i < order.length - 1) {
        const sep = document.createElement('span')
        sep.className = 'separator'
        sep.setAttribute('data-part', 'separator')
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
    if (this.native.disabled) this.root.dataset.disabled = 'true'

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
    seg.setAttribute('data-focused', 'true')
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
      seg.setAttribute('aria-valuetext', getMonthName(year, numericValue - 1, this.localeTag))
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
    seg.setAttribute('data-placeholder', 'true')
    seg.removeAttribute('aria-valuenow')
    // Visible placeholder, spoken `empty` word — see _createSegment.
    const placeholder = type === 'day' ? 'dd' : type === 'month' ? 'mm' : 'yyyy'
    seg.setAttribute('aria-valuetext', this.t.empty)
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

    const label = date.toLocaleDateString(this.localeTag, { dateStyle: 'long' })
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
    this.calendarEl = clone.querySelector<HTMLElement>('[data-part="popup"]')!

    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="month-year-trigger"]')!
    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="prev-month"]')!
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="next-month"]')!

    const calId = `${this.fieldId}-calendar`
    const monthId = `${this.fieldId}-month`
    this.calendarEl.id = calId
    this.calendarEl.setAttribute('aria-labelledby', monthId)
    monthYearTrigger.id = monthId
    // The trigger swaps an in-dialog panel of spinbutton wheels (not a listbox popup),
    // so it carries aria-controls + aria-expanded — not aria-haspopup.
    const pickerPanel = this.calendarEl.querySelector<HTMLElement>('[data-panel="picker"]')
    if (pickerPanel) {
      const pickerId = `${this.fieldId}-picker`
      pickerPanel.id = pickerId
      monthYearTrigger.setAttribute('aria-controls', pickerId)
    }
    monthYearTrigger.setAttribute('aria-label', this.t.openPicker)
    monthYearTrigger.addEventListener('click', () => {
      if (this._isPickerActive()) {
        this._closePicker()
      } else {
        this._openPicker()
      }
    })

    // One-time picker setup: ArrowUp/Down steps the focused month/year wheel.
    // (The wheels themselves are (re)instantiated in _openPicker.)
    this.calendarEl.querySelectorAll<HTMLElement>('[data-part="year-month-picker"] .Wheel').forEach(host => {
      host.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        const which = host.dataset.picker as 'month' | 'year'
        this._pickerWheels.get(which)?.stepBy(e.key === 'ArrowDown' ? 1 : -1)
      })
    })

    prevBtn.setAttribute('aria-label', this.t.prevMonth)
    nextBtn.setAttribute('aria-label', this.t.nextMonth)
    prevBtn.addEventListener('click', () => this._navigateMonth(-1))
    nextBtn.addEventListener('click', () => this._navigateMonth(1))

    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="calendar-footer-clear"]')!
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="calendar-footer-today"]')!
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

    this.rail.appendChild(this.calendarEl)
    this._updateLayout()

    this.root.dataset.state = 'open'
    this.trigger.setAttribute('aria-expanded', 'true')
    this.trigger.setAttribute('aria-label', this.t.closeCalendar)

    this.calendarEl.addEventListener('keydown', e => this._handleCalendarKeydown(e))

    // Shared popup hygiene: cyclic focus trap over the calendar panel's tab
    // stops, plus wheel-scroll containment (the month/year picker wheels sit
    // inside this surface). Escape + grid arrow-nav + the picker's own 2-wheel
    // Tab cycle stay local (see _handleCalendarKeydown / _handlePickerKeydown).
    this._popupAbort = new AbortController()
    trapPopupInteraction({
      container: this.calendarEl,
      tabStops: () => this._calendarTabStops(),
      signal: this._popupAbort.signal,
    })

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
    const containerRect = this.rail.getBoundingClientRect()
    const calendarWidth = this.calendarEl.getBoundingClientRect().width
    if (!containerRect.width || !calendarWidth) return

    const direction = detectDirection(triggerRect)
    this.root.dataset.direction = direction

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const viewportInset = this._getCSSPx('--_df-site-padding') / 2

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      calendarWidth,
      window.innerWidth,
      viewportInset,
    )
    this.root.style.setProperty('--_df-popup-offset', `${offset}%`)

    const calendarLeft = containerRect.left + (offset / 100 * containerRect.width) - calendarWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      calendarLeft,
      calendarWidth,
      this._getCSSPx('--_df-arrow-corner-radius'),
      this._getCSSPx('--_df-arrow-size'),
    )
    this.root.style.setProperty('--_df-arrow-offset', `${arrowOffset}px`)
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
    if (this._popupAbort) {
      this._popupAbort.abort()
      this._popupAbort = null
    }
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
    const pickerGroup = this.calendarEl.querySelector<HTMLElement>('[data-part="year-month-picker"]')!
    pickerGroup.setAttribute('aria-label', this.t.openPicker)
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="month-year-trigger"]')!
    const monthHost = this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="month"]')!
    const yearHost = this.calendarEl.querySelector<HTMLElement>('.Wheel[data-picker="year"]')!

    const minYear = this.min ? this.min.getFullYear() : 1900
    const maxYear = this.max ? this.max.getFullYear() : 2100

    // Fresh wheels each open (rebuilt from the current month/year)
    this._pickerWheels.forEach(w => w.destroy())
    this._pickerWheels.clear()
    monthHost.replaceChildren()
    yearHost.replaceChildren()

    monthHost.id = `${this.fieldId}-picker-month`
    monthHost.setAttribute('aria-label', this.t.month)
    // Spinning a wheel applies the date live (like the time wheels update the
    // field), defaulting the day to today when nothing is selected yet. Month
    // loops (Dec↔Jan); year stays capped at min/max.
    const applyPickerDate = (year: number, month: number): void => {
      const refDay = this.selectedDate ? this.selectedDate.getDate() : new Date().getDate()
      this.currentYear = year
      this.currentMonth = month
      this._applyDate(new Date(year, month, clampDayToMonth(year, month, refDay)))
      this._renderMonth()
    }

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

    this._setPanel('picker')
    monthYearTrigger.setAttribute('aria-expanded', 'true')
    monthYearTrigger.setAttribute('aria-label', this.t.closePicker)

    monthHost.focus()
  }

  _closePicker(): void {
    if (!this.calendarEl) return
    this._pickerWheels.forEach(w => w.destroy())
    this._pickerWheels.clear()
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="month-year-trigger"]')!
    this._setPanel('calendar')
    monthYearTrigger.setAttribute('aria-expanded', 'false')
    monthYearTrigger.setAttribute('aria-label', this.t.openPicker)
    this._renderMonth()
    monthYearTrigger.focus()
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

  _renderWeekdays(): void {
    const names = getWeekdayNames(this.localeTag)
    const ths = this.calendarEl!.querySelectorAll('[data-part="calendar-grid"] thead th')
    ths.forEach((th, i) => {
      if (!names[i]) return
      th.textContent = names[i]
      const anchor = new Date(2024, 0, 1)
      anchor.setDate(anchor.getDate() + i)
      th.setAttribute('aria-label', new Intl.DateTimeFormat(this.localeTag, { weekday: 'long' }).format(anchor))
    })
  }

  _renderMonth(): void {
    const monthYearTrigger = this.calendarEl!.querySelector<HTMLButtonElement>('[data-part="month-year-trigger"]')
    const monthName = getMonthName(this.currentYear, this.currentMonth, this.localeTag)
    if (monthYearTrigger) monthYearTrigger.textContent = `${monthName} ${this.currentYear}`

    const tbody = this.calendarEl!.querySelector<HTMLTableSectionElement>('[data-part="calendar-grid"] tbody')!
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

    if (isOutsideMonth) td.dataset.outsideMonth = 'true'
    if (isToday) td.dataset.today = 'true'
    if (isSelected) { td.dataset.selected = 'true'; td.setAttribute('aria-selected', 'true') }
    else td.setAttribute('aria-selected', 'false')
    if (isDisabled) { td.dataset.disabled = 'true'; td.setAttribute('aria-disabled', 'true') }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.setAttribute('tabindex', '-1')
    btn.dataset.date = formatISO(date)

    const dateLabel = date.toLocaleDateString(this.localeTag, { dateStyle: 'long' })
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
    const grid = this.calendarEl!.querySelector<HTMLElement>('[data-part="calendar-grid"]')!
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
    const grid = this.calendarEl!.querySelector<HTMLElement>('[data-part="calendar-grid"]')!
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
    const label = date.toLocaleDateString(this.localeTag, { dateStyle: 'long' })
    this.announce.textContent = `${this.t.announceSelected} ${label}`
    const clearBtn = this.calendarEl?.querySelector<HTMLButtonElement>('[data-part="calendar-footer-clear"]')
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
    if (this._isPickerActive()) {
      this._handlePickerKeydown(e)
      return
    }

    const grid = this.calendarEl!.querySelector<HTMLElement>('[data-part="calendar-grid"]')!
    const focusedBtn = grid.querySelector<HTMLButtonElement>('button:focus')

    if (e.key === 'Escape') {
      e.preventDefault()
      this._closeCalendar()
      return
    }

    // Tab / Shift+Tab are owned by the shared cyclic focus trap
    // (trapPopupInteraction, tab stops from _calendarTabStops).

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
    // Escape closes the panel — it does NOT undo. The wheels apply the date
    // live on every step (field, native input, segments, announce region), so
    // there is nothing coherent left to cancel: reverting only the view would
    // desync the calendar heading from the field's actual value.
    if (e.key === 'Escape') {
      e.preventDefault()
      this._closePicker()
      return
    }

    // Tab (month↔year wheel cycle) is owned by the shared focus trap — when the
    // picker panel is active, _calendarTabStops returns just the two wheels.
    // ArrowUp/Down are handled per-wheel-host (see _openCalendar setup → stepBy).
  }

  // Ordered tab stops for the shared focus trap. Depends on which panel is
  // active: the month/year picker is a modal-within-modal whose only stops are
  // its two wheels; the calendar panel cycles nav → grid → footer.
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

    const grid = this.calendarEl.querySelector<HTMLElement>('[data-part="calendar-grid"]')!
    const prevBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="prev-month"]')
    const monthYearTrigger = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="month-year-trigger"]')
    const nextBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="next-month"]')
    const clearBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="calendar-footer-clear"]')
    const todayBtn = this.calendarEl.querySelector<HTMLButtonElement>('[data-part="calendar-footer-today"]')

    // The grid's single stop is its current roving cell (falling back to the
    // first in-month, enabled cell — mirrors _updateRovingTabindex, which never
    // rovers onto an outside-month or disabled cell).
    const gridStop =
      grid.querySelector<HTMLButtonElement>(
        'td:not([data-outside-month]):not([aria-disabled="true"]) button[tabindex="0"]',
      ) ??
      grid.querySelector<HTMLButtonElement>(
        'td:not([data-outside-month]):not([aria-disabled="true"]) button',
      )

    const stops: Array<HTMLElement | null> = [
      prevBtn,
      monthYearTrigger,
      gridStop,
      nextBtn,
      ...(clearBtn && !clearBtn.disabled ? [clearBtn] : []),
      ...(todayBtn && !todayBtn.disabled ? [todayBtn] : []),
    ]
    return stops.filter((b): b is HTMLElement => b !== null)
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
      const grid = this.calendarEl!.querySelector<HTMLElement>('[data-part="calendar-grid"]')!
      grid.querySelectorAll('td button').forEach(b => b.setAttribute('tabindex', '-1'))
      btn.setAttribute('tabindex', '0')
      btn.focus()
    }
  }
}

export default DateField

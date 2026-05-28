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
    this.trigger.removeEventListener('click', this._handleTriggerClick)
    this.native.removeEventListener('change', this._handleNativeChange)
    this.native.form?.removeEventListener('reset', this._handleFormReset)
    this._closeCalendar(false)
    delete this.root.__dateTimeFieldInstance
  }

  // Stubs — implemented in later tasks
  _buildSegments(): void {}
  _bindSegmentEvents(): void {}
  _bindTrigger(): void {}
  _syncSegmentsFromDatetime(_dt: Date): void {}
  _toggleCalendar(): void {}
  _closeCalendar(_restoreFocus = true): void {}
  _renderTimeColumns(): void {}
  _clearSegment(_seg: HTMLSpanElement): void {}
}

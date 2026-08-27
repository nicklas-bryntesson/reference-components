// src/partials/components/WeekField/WeekField.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../kernel/js/popup-position'
import { trapPopupInteraction } from '../../../kernel/js/popup-interaction'
import { readLocale, resolveLocale } from '../../../kernel/utils/locale'
import {
  getISOWeek,
  getISOWeekYear,
  getDateOfISOWeek,
  formatWeekISO,
  parseWeekISO,
  getMonthName,
  getWeekdayNames,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
} from '../../../kernel/utils/dates'

// ─── Types ────────────────────────────────────────────────────────────────────

type WeekSegmentType = 'week' | 'year'

interface TranslationStrings {
  week: string
  year: string
  openWeekPicker: string
  popupLabel: string
  prevMonth: string
  nextMonth: string
  clearButton: string
  thisWeekButton: string
  weekAbbrev: string
  announceSelected: string
  weekField: string
  selected: string
  notAvailable: string
}

interface SegmentHandlers {
  keydown: (e: KeyboardEvent) => void
  focus: () => void
  blur: () => void
}

declare global {
  interface HTMLElement {
    __weekFieldInstance?: WeekField
  }
  interface HTMLSpanElement {
    __weekFieldHandlers?: SegmentHandlers
  }
}

// ─── Exported pure utilities ──────────────────────────────────────────────────

export function formatSegment(n: number): string {
  return String(n).padStart(2, '0')
}

/** Wrap a value into [min, max] (used by the week segment). */
export function wrapValue(n: number, min: number, max: number): number {
  if (n > max) return min
  if (n < min) return max
  return n
}

/** Clamp a value into [min, max] (used by the year segment). */
export function clampValue(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Highest ISO week number for a week-numbering year — 52 or 53. A year has 53
 * weeks iff Jan 1 is a Thursday, or it is a leap year and Jan 1 is a Wednesday
 * (equivalently: Dec 28 always falls in the last ISO week of its year).
 */
export function weeksInISOYear(weekYear: number): number {
  return getISOWeek(new Date(weekYear, 11, 28))
}

/**
 * Clamp a `YYYY-Www` value against optional `YYYY-Www` bounds. Compared by
 * (weekYear, week) — plain string comparison is NOT safe because "W9" would
 * sort after "W10"; but the zero-padded format ("W09") makes lexical order
 * correct, so string comparison IS used here for the same reason as MonthField.
 */
export function clampWeekISO(value: string, min: string | undefined, max: string | undefined): string {
  let out = value
  if (min && out < min) out = min
  if (max && out > max) out = max
  return out
}

// ─── WeekField class ─────────────────────────────────────────────────────────

class WeekField {
  static instanceCount = 0
  static translations: Record<string, TranslationStrings> = {
    en: {
      week: 'Week', year: 'Year',
      openWeekPicker: 'Open week picker', popupLabel: 'Choose week',
      prevMonth: 'Previous month', nextMonth: 'Next month',
      clearButton: 'Clear', thisWeekButton: 'This week',
      weekAbbrev: 'Wk', announceSelected: 'Selected week:', weekField: 'week field',
      selected: 'selected', notAvailable: 'not available',
    },
    sv: {
      week: 'Vecka', year: 'År',
      openWeekPicker: 'Öppna veckoväljare', popupLabel: 'Välj vecka',
      prevMonth: 'Föregående månad', nextMonth: 'Nästa månad',
      clearButton: 'Rensa', thisWeekButton: 'Denna vecka',
      weekAbbrev: 'v.', announceSelected: 'Vald vecka:', weekField: 'veckofält',
      selected: 'vald', notAvailable: 'ej tillgänglig',
    },
  }

  static registerLocale(locale: string, strings: Partial<TranslationStrings>): void {
    WeekField.translations[locale] = { ...WeekField.translations.en, ...strings }
  }

  // Default year range when no min/max: current ISO week-year ±100 (O3)
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

  // Calendar state
  selectedWeekYear: number | null = null
  selectedWeek: number | null = null
  // Visible month grid (the Monday-of-week rendering derives from these):
  viewYear: number
  viewMonth: number

  private _suppressEvents = false
  private popupEl: HTMLElement | null = null
  private _rail!: HTMLElement
  private _outsideClickHandler: ((e: MouseEvent) => void) | null = null
  private _rafHandle: number | null = null
  private _popupTemplate: HTMLTemplateElement | null = null
  private _popupAbort: AbortController | null = null

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll('[data-component="WeekField"]').forEach(el => {
      const htmlEl = el as HTMLElement
      if (htmlEl.__weekFieldInstance) return
      htmlEl.__weekFieldInstance = new WeekField(htmlEl)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.instanceId = ++WeekField.instanceCount

    this.native = el.querySelector<HTMLInputElement>('.native')!
    this.overlay = el.querySelector<HTMLElement>('.overlay')!
    this.segments = el.querySelector<HTMLElement>('.segments')!
    this.trigger = el.querySelector<HTMLButtonElement>('.trigger')!
    this.announce = el.querySelector<HTMLElement>('.announce')!

    this.fieldId = el.dataset.id ?? `weekfield-${this.instanceId}`
    this.localeTag = readLocale(el)
    this.locale = resolveLocale(this.localeTag, WeekField.translations)

    this.t = WeekField.translations[this.locale]
    this._segmentEls = []
    this._digitBuffer = ''
    this._digitTimer = null

    // Year bounds from data-min/data-max (YYYY-Www), else current ISO week-year ±100 (O3)
    this.minISO = el.dataset.min || undefined
    this.maxISO = el.dataset.max || undefined
    const currentWeekYear = getISOWeekYear(new Date())
    const parsedMin = this.minISO ? parseWeekISO(this.minISO) : null
    const parsedMax = this.maxISO ? parseWeekISO(this.maxISO) : null
    this.minYear = parsedMin ? parsedMin.weekYear : currentWeekYear - WeekField.YEAR_SPAN
    this.maxYear = parsedMax ? parsedMax.weekYear : currentWeekYear + WeekField.YEAR_SPAN

    const today = new Date()
    this.viewYear = today.getFullYear()
    this.viewMonth = today.getMonth()

    this._rail = el.querySelector<HTMLElement>('.rail')!
    this._popupTemplate = el.querySelector<HTMLTemplateElement>('[data-template="weekfield-popup"]')

    this._init()
  }

  // ─── Native feature detection ───────────────────────────────────────────────

  static supportsNativeWeek(): boolean {
    const i = document.createElement('input')
    i.type = 'week'
    i.value = 'x'
    return i.value !== 'x'
  }

  _init(): void {
    this.native.id = this.fieldId
    this.native.name = this.root.dataset.name ?? this.fieldId
    if (this.minISO) this.native.min = this.minISO
    if (this.maxISO) this.native.max = this.maxISO

    this.announce.id = `${this.fieldId}-announce`

    this.trigger.setAttribute('aria-label', this.t.openWeekPicker)

    // Native fallback:
    //   - touch AND native week supported → display mode (native tap layer).
    //   - native week NOT supported → custom mode even on touch (a native
    //     <input type=week> that isn't supported is a useless text field).
    //   - desktop → custom.
    const isTouch = (typeof window.matchMedia === 'function')
      ? window.matchMedia('(pointer: coarse)').matches
      : false

    if (isTouch && WeekField.supportsNativeWeek()) {
      this._initDisplayMode()
    } else {
      this._initInteractiveMode()
    }

    this.root.setAttribute('data-initialized', 'true')
  }

  // ─── Display mode (touch + native week) ────────────────────────────────────

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

  // ─── Interactive mode (custom) ──────────────────────────────────────────────

  _initInteractiveMode(): void {
    this.root.dataset.inputMode = 'custom'

    this.overlay.removeAttribute('aria-hidden')

    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${this.fieldId}"]`)
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${this.fieldId}-label`
      this.segments.setAttribute('aria-labelledby', labelEl.id)
    }
    this.segments.setAttribute('aria-roledescription', this.t.weekField)

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
    this.segments.querySelectorAll('.segment, .separator').forEach(el => el.remove())

    const segmentTypes: WeekSegmentType[] = ['week', 'year']

    // Prefix "v." / "Wk" so the field reads as a week, not a date.
    const prefix = document.createElement('span')
    prefix.className = 'prefix'
    prefix.setAttribute('aria-hidden', 'true')
    prefix.textContent = this.t.weekAbbrev
    this.segments.appendChild(prefix)

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
    sep.className = 'separator'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = text
    return sep
  }

  _createSegmentEl(type: WeekSegmentType): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'segment'
    span.setAttribute('role', 'spinbutton')
    span.setAttribute('data-segment', type)
    span.setAttribute('tabindex', '-1')
    span.setAttribute('aria-label', this.t[type])

    const { min, max } = this._getSegmentLimits(type)
    span.setAttribute('aria-valuemin', String(min))
    span.setAttribute('aria-valuemax', String(max))
    span.setAttribute('data-placeholder', 'true')
    span.setAttribute('aria-valuetext', '--')
    span.textContent = type === 'year' ? '----' : '--'

    return span
  }

  // ─── Segment bounds ───────────────────────────────────────────────────────

  _getSegmentLimits(type: WeekSegmentType): { min: number; max: number } {
    switch (type) {
      case 'week': {
        // Clamp to the valid max week of the currently-entered year (52 or 53).
        const year = this._getSegmentValueByType('year') ?? getISOWeekYear(new Date())
        return { min: 1, max: weeksInISOYear(year) }
      }
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
      seg.__weekFieldHandlers = { keydown: keydownHandler, focus: focusHandler, blur: blurHandler }
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

  _getSegmentEl(type: WeekSegmentType): HTMLSpanElement | null {
    return this._segmentEls.find(s => s.dataset.segment === type) ?? null
  }

  _getSegmentValueByType(type: WeekSegmentType): number | null {
    const seg = this._getSegmentEl(type)
    return seg ? this._getCurrentSegmentValue(seg) : null
  }

  // Human label for AT, e.g. "Vecka 27, 2026" (O1). Falls back gracefully when
  // the partner segment is still empty.
  _valueText(type: WeekSegmentType, value: number): string {
    const week = type === 'week' ? value : this._getSegmentValueByType('week')
    const year = type === 'year' ? value : this._getSegmentValueByType('year')
    if (type === 'week') {
      return year == null ? `${this.t.week} ${week}` : `${this.t.week} ${week}, ${year}`
    }
    // year
    return week == null ? String(year) : `${this.t.week} ${week}, ${year}`
  }

  _setSegmentValue(seg: HTMLSpanElement, value: number): void {
    const type = seg.dataset.segment as WeekSegmentType
    seg.removeAttribute('data-placeholder')
    seg.setAttribute('aria-valuenow', String(value))
    // Week shows zero-padded number ("27"); year shows the full number.
    seg.textContent = type === 'week' ? formatSegment(value) : String(value)
    seg.setAttribute('aria-valuetext', this._valueText(type, value))
    // When the year changes the week segment's valid max may change (52/53) —
    // refresh its aria-valuemax and clamp if needed.
    if (type === 'year') this._refreshWeekMax()
    this._refreshValueTexts()
    this._enforceBounds()
    this._syncToNative()
  }

  // Keep the week segment's aria-valuemax coherent with the current year.
  _refreshWeekMax(): void {
    const weekSeg = this._getSegmentEl('week')
    if (!weekSeg) return
    const { max } = this._getSegmentLimits('week')
    weekSeg.setAttribute('aria-valuemax', String(max))
    const current = this._getCurrentSegmentValue(weekSeg)
    if (current != null && current > max) {
      weekSeg.setAttribute('aria-valuenow', String(max))
      weekSeg.textContent = formatSegment(max)
    }
  }

  _refreshValueTexts(): void {
    this._segmentEls.forEach(seg => {
      const type = seg.dataset.segment as WeekSegmentType
      const val = this._getCurrentSegmentValue(seg)
      if (val != null) {
        seg.setAttribute('aria-valuetext', this._valueText(type, val))
      }
    })
  }

  _clearSegment(seg: HTMLSpanElement): void {
    const type = seg.dataset.segment as WeekSegmentType
    seg.setAttribute('data-placeholder', 'true')
    seg.removeAttribute('aria-valuenow')
    seg.setAttribute('aria-valuetext', '--')
    seg.textContent = type === 'year' ? '----' : '--'
    this._syncToNative()
  }

  // ─── Increment / wrap / clamp ─────────────────────────────────────────────

  _incrementSegment(seg: HTMLSpanElement, delta: number): void {
    const type = seg.dataset.segment as WeekSegmentType
    const { min, max } = this._getSegmentLimits(type)
    const current = this._getCurrentSegmentValue(seg)

    if (type === 'week') {
      // Week wraps at its year's boundary (1 ↔ 52/53)
      const start = current ?? (delta > 0 ? min - 1 : max + 1)
      const next = wrapValue(start + delta, min, max)
      this._setSegmentValue(seg, next)
      return
    }

    // Year clamps to bounds
    const start = current ?? getISOWeekYear(new Date())
    const next = clampValue(start + delta, min, max)
    this._setSegmentValue(seg, next)
  }

  // ─── Digit buffer (year needs up to 4 digits; week up to 2) ────────────────

  _handleDigit(seg: HTMLSpanElement, digit: string): void {
    const type = seg.dataset.segment as WeekSegmentType
    const { min, max } = this._getSegmentLimits(type)

    clearTimeout(this._digitTimer ?? undefined)
    this._digitBuffer += digit
    const maxLen = type === 'year' ? 4 : 2
    const num = Number(this._digitBuffer)
    const len = this._digitBuffer.length

    this._showBuffer(seg, this._digitBuffer)

    if (len >= maxLen) {
      this._commitDigits(seg, num, min, max)
      return
    }

    if (type === 'week') {
      // Week fast-advance: a first digit that can't begin a two-digit week
      // (>5, since max is 52/53) commits immediately.
      if (len === 1 && num >= 6) {
        this._commitDigits(seg, num, min, max)
        return
      }
    }

    this._digitTimer = setTimeout(() => {
      this._commitDigits(seg, num, min, max)
    }, 400)
  }

  _commitDigits(seg: HTMLSpanElement, num: number, min: number, max: number): void {
    this._setSegmentValue(seg, clampValue(num, min, max))
    this._digitBuffer = ''
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

    const type = seg.dataset.segment as WeekSegmentType
    const num = Number(this._digitBuffer)
    this._digitBuffer = ''
    const { min, max } = this._getSegmentLimits(type)
    this._setSegmentValue(seg, clampValue(num, min, max))
  }

  // ─── Bounds enforcement (data-min / data-max as YYYY-Www) ──────────────────

  _enforceBounds(): void {
    if (!this.minISO && !this.maxISO) return
    const week = this._getSegmentValueByType('week')
    const year = this._getSegmentValueByType('year')
    if (week == null || year == null) return

    const iso = formatWeekISO(year, week)
    const clamped = clampWeekISO(iso, this.minISO, this.maxISO)
    if (clamped === iso) return

    const parsed = parseWeekISO(clamped)!
    const weekSeg = this._getSegmentEl('week')
    const yearSeg = this._getSegmentEl('year')
    if (yearSeg && parsed.weekYear !== year) {
      yearSeg.removeAttribute('data-placeholder')
      yearSeg.setAttribute('aria-valuenow', String(parsed.weekYear))
      yearSeg.textContent = String(parsed.weekYear)
    }
    if (weekSeg && parsed.week !== week) {
      weekSeg.removeAttribute('data-placeholder')
      weekSeg.setAttribute('aria-valuenow', String(parsed.week))
      weekSeg.textContent = formatSegment(parsed.week)
    }
    // A cross-year correction may land in a year with a different 52/53 max week.
    this._refreshWeekMax()
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

  // ─── Value sync ─────────────────────────────────────────────────────────────

  _syncToNative(): void {
    const week = this._getSegmentValueByType('week')
    const year = this._getSegmentValueByType('year')

    if (week == null || year == null) {
      this.native.value = ''
      this.selectedWeek = null
      this.selectedWeekYear = null
      this.root.removeAttribute('data-has-value')
      return
    }

    const weekStr = formatWeekISO(year, week)
    this.native.value = weekStr
    this.selectedWeek = week
    this.selectedWeekYear = year
    this.root.dataset.hasValue = 'true'

    if (!this._suppressEvents) {
      this.native.dispatchEvent(new Event('input', { bubbles: true }))
      this.native.dispatchEvent(new Event('change', { bubbles: true }))
    }

    this._announceValue(year, week)
  }

  _announceValue(year: number, week: number): void {
    this.announce.textContent = `${this.t.announceSelected} ${this.t.week} ${week}, ${year}`
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
      this.selectedWeek = null
      this.selectedWeekYear = null
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
    const parsed = parseWeekISO(value)
    if (!parsed) return

    const weekSeg = this._getSegmentEl('week')
    const yearSeg = this._getSegmentEl('year')
    // Set year first so the week's aria-valuetext / valuemax reflect it.
    if (yearSeg) this._setSegmentValue(yearSeg, clampValue(parsed.weekYear, this.minYear, this.maxYear))
    if (weekSeg) this._setSegmentValue(weekSeg, parsed.week)
    this._enforceBounds()
    // Point the visible month grid at the selected week's Monday.
    if (this.selectedWeek != null && this.selectedWeekYear != null) {
      const monday = getDateOfISOWeek(this.selectedWeekYear, this.selectedWeek)
      this.viewYear = monday.getFullYear()
      this.viewMonth = monday.getMonth()
    }
  }

  // ─── Popup ──────────────────────────────────────────────────────────────────

  private _openPopup(): void {
    if (!this._popupTemplate) return
    const clone = this._popupTemplate.content.cloneNode(true) as DocumentFragment
    this.popupEl = clone.querySelector<HTMLElement>('.popup')!

    const popupId = `${this.fieldId}-popup`
    const labelId = `${this.fieldId}-monthlabel`
    this.popupEl.id = popupId
    this.popupEl.setAttribute('aria-label', this.t.popupLabel)

    const label = this.popupEl.querySelector<HTMLElement>('.calendar-month-year')!
    label.id = labelId

    const prevBtn = this.popupEl.querySelector<HTMLButtonElement>('.prev-month')!
    const nextBtn = this.popupEl.querySelector<HTMLButtonElement>('.next-month')!
    prevBtn.setAttribute('aria-label', this.t.prevMonth)
    nextBtn.setAttribute('aria-label', this.t.nextMonth)
    prevBtn.addEventListener('click', () => this._navigateMonth(-1))
    nextBtn.addEventListener('click', () => this._navigateMonth(1))

    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')!
    const nowBtn = this.popupEl.querySelector<HTMLButtonElement>('.calendar-footer-now')!
    clearBtn.textContent = this.t.clearButton
    nowBtn.textContent = this.t.thisWeekButton
    clearBtn.addEventListener('click', () => this._handleClear())
    nowBtn.addEventListener('click', () => this._handleThisWeek())

    this.popupEl.addEventListener('keydown', (e) => this._handlePopupKeydown(e))

    // Point the grid at the selected week, else today.
    if (this.selectedWeek != null && this.selectedWeekYear != null) {
      const monday = getDateOfISOWeek(this.selectedWeekYear, this.selectedWeek)
      this.viewYear = monday.getFullYear()
      this.viewMonth = monday.getMonth()
    } else {
      const today = new Date()
      this.viewYear = today.getFullYear()
      this.viewMonth = today.getMonth()
    }

    this._renderWeekdays()
    this._renderMonth()

    this._rail.appendChild(this.popupEl)
    this.root.setAttribute('data-open', 'true')
    this.trigger.setAttribute('aria-expanded', 'true')

    this._updateLayout()
    this._updateClearButton()

    this._popupAbort = new AbortController()
    trapPopupInteraction({
      container: this.popupEl,
      tabStops: () => this._popupTabStops(),
      signal: this._popupAbort.signal,
    })

    this._outsideClickHandler = (e: MouseEvent) => {
      if (!this.root.contains(e.target as Node)) {
        // Light dismiss — no refocus (avoids scroll-jump / focus-steal).
        this._closePopup(false)
      }
    }
    setTimeout(() => {
      document.addEventListener('click', this._outsideClickHandler!)
    }, 0)

    this._moveFocusIntoGrid()
  }

  // Ordered tab stops for the focus trap: nav prev, grid (one composite stop),
  // nav next, then the enabled footer buttons. The grid uses roving tabindex
  // internally so it is exactly one tab stop (WAI-ARIA grid pattern).
  private _popupTabStops(): HTMLElement[] {
    if (!this.popupEl) return []
    const prevBtn = this.popupEl.querySelector<HTMLButtonElement>('.prev-month')
    const nextBtn = this.popupEl.querySelector<HTMLButtonElement>('.next-month')
    const gridStop =
      this.popupEl.querySelector<HTMLButtonElement>('.calendar-grid tbody tr[tabindex="0"]') ??
      this.popupEl.querySelector<HTMLButtonElement>('.calendar-grid tbody tr:not([data-disabled])')
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')
    const nowBtn = this.popupEl.querySelector<HTMLButtonElement>('.calendar-footer-now')

    const stops: Array<HTMLElement | null> = [
      prevBtn,
      gridStop,
      nextBtn,
      ...(clearBtn && !clearBtn.disabled ? [clearBtn] : []),
      ...(nowBtn && !nowBtn.disabled ? [nowBtn] : []),
    ]
    return stops.filter((b): b is HTMLElement => b !== null)
  }

  private _closePopup(refocusTrigger = true): void {
    if (this._popupAbort) {
      this._popupAbort.abort()
      this._popupAbort = null
    }
    if (this.popupEl) {
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
    if (refocusTrigger) this.trigger.focus()
  }

  // ─── Calendar rendering ──────────────────────────────────────────────────────

  _navigateMonth(direction: number): void {
    this.viewMonth += direction
    if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++ }
    if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear-- }
    this._renderMonth()
  }

  _renderWeekdays(): void {
    if (!this.popupEl) return
    const names = getWeekdayNames(this.localeTag)
    const ths = this.popupEl.querySelectorAll('.calendar-grid thead th')
    // ths[0] is the week-number column head; days start at index 1.
    const weekHead = ths[0]
    if (weekHead) {
      weekHead.textContent = this.t.weekAbbrev
      weekHead.setAttribute('aria-label', this.t.week)
    }
    names.forEach((name, i) => {
      const th = ths[i + 1]
      if (!th) return
      th.textContent = name
      const anchor = new Date(2024, 0, 1) // a Monday
      anchor.setDate(anchor.getDate() + i)
      th.setAttribute('aria-label', new Intl.DateTimeFormat(this.localeTag, { weekday: 'long' }).format(anchor))
    })
  }

  _renderMonth(): void {
    if (!this.popupEl) return
    const label = this.popupEl.querySelector<HTMLElement>('.calendar-month-year')!
    label.textContent = `${getMonthName(this.viewYear, this.viewMonth, this.localeTag)} ${this.viewYear}`

    const tbody = this.popupEl.querySelector<HTMLTableSectionElement>('.calendar-grid tbody')!
    tbody.innerHTML = ''

    const today = new Date()
    const firstWeekday = getFirstWeekdayOfMonth(this.viewYear, this.viewMonth) // 0=Mon
    const daysInMonth = getDaysInMonth(this.viewYear, this.viewMonth)
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

    // First visible Monday = first-of-month minus the weekday offset.
    const gridStart = new Date(this.viewYear, this.viewMonth, 1 - firstWeekday)

    for (let cell = 0; cell < totalCells; cell += 7) {
      const monday = new Date(gridStart)
      monday.setDate(gridStart.getDate() + cell)
      tbody.appendChild(this._createWeekRow(monday, today))
    }

    this._updateRovingTabindex()
  }

  _createWeekRow(monday: Date, today: Date): HTMLTableRowElement {
    const tr = document.createElement('tr')
    tr.setAttribute('role', 'row')

    const weekYear = getISOWeekYear(monday)
    const week = getISOWeek(monday)
    const iso = formatWeekISO(weekYear, week)

    tr.dataset.week = iso
    tr.dataset.weekyear = String(weekYear)
    tr.dataset.weeknum = String(week)

    const isSelected = this.selectedWeek === week && this.selectedWeekYear === weekYear
    const isDisabled = this._isWeekDisabled(iso)

    if (isSelected) { tr.dataset.selected = 'true'; tr.setAttribute('aria-selected', 'true') }
    else tr.setAttribute('aria-selected', 'false')
    if (isDisabled) { tr.dataset.disabled = 'true'; tr.setAttribute('aria-disabled', 'true') }

    // Row is the selectable unit (composite grid row). It carries the human
    // label so AT announces the whole week; roving tabindex lives on the row.
    tr.setAttribute('tabindex', '-1')
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const range = `${monday.toLocaleDateString(this.localeTag, { day: 'numeric', month: 'long' })} – ${sunday.toLocaleDateString(this.localeTag, { day: 'numeric', month: 'long' })}`
    const suffixes = [
      isSelected ? `, ${this.t.selected}` : '',
      isDisabled ? `, ${this.t.notAvailable}` : '',
    ].join('')
    tr.setAttribute('aria-label', `${this.t.week} ${week}, ${range}${suffixes}`)

    // Week-number cell (leading column). Clicking it selects the week too.
    const weekCell = document.createElement('td')
    weekCell.setAttribute('role', 'rowheader')
    weekCell.className = 'week-number-cell'
    weekCell.textContent = String(week)
    weekCell.dataset.weeknum = String(week)
    tr.appendChild(weekCell)

    // Seven day cells.
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + d)
      const td = document.createElement('td')
      td.setAttribute('role', 'gridcell')
      if (date.getMonth() !== this.viewMonth) td.dataset.outsideMonth = 'true'
      if (date.toDateString() === today.toDateString()) td.dataset.today = 'true'
      td.textContent = String(date.getDate())
      tr.appendChild(td)
    }

    if (!isDisabled) {
      tr.addEventListener('click', () => this._selectWeek(weekYear, week))
      tr.addEventListener('mouseenter', () => tr.dataset.preview = 'true')
      tr.addEventListener('mouseleave', () => tr.removeAttribute('data-preview'))
    }

    return tr
  }

  _isWeekDisabled(iso: string): boolean {
    if (this.minISO && iso < this.minISO) return true
    if (this.maxISO && iso > this.maxISO) return true
    return false
  }

  // The week grid uses roving tabindex on the ROW: one row tabindex="0", the
  // rest -1. Prefer the selected row, else today's row, else the first enabled.
  _updateRovingTabindex(): void {
    if (!this.popupEl) return
    const tbody = this.popupEl.querySelector<HTMLTableSectionElement>('.calendar-grid tbody')!
    tbody.querySelectorAll('tr').forEach(tr => tr.setAttribute('tabindex', '-1'))

    const todayISO = this._todayWeekISO()
    const selectedRow = tbody.querySelector<HTMLTableRowElement>('tr[data-selected]')
    const todayRow = tbody.querySelector<HTMLTableRowElement>(`tr[data-week="${todayISO}"]:not([data-disabled])`)
    const firstEnabled = tbody.querySelector<HTMLTableRowElement>('tr:not([data-disabled])')
    const target = selectedRow ?? todayRow ?? firstEnabled
    if (target) target.setAttribute('tabindex', '0')
  }

  _todayWeekISO(): string {
    const now = new Date()
    return formatWeekISO(getISOWeekYear(now), getISOWeek(now))
  }

  _moveFocusIntoGrid(): void {
    if (!this.popupEl) return
    const tbody = this.popupEl.querySelector<HTMLTableSectionElement>('.calendar-grid tbody')!
    const target = tbody.querySelector<HTMLTableRowElement>('tr[tabindex="0"]')
    target?.focus()
  }

  // Move the roving focus to the week that `date`'s Monday belongs to,
  // re-rendering the month if that week isn't in the current grid.
  _focusWeekOf(date: Date): void {
    const weekYear = getISOWeekYear(date)
    const week = getISOWeek(date)
    const iso = formatWeekISO(weekYear, week)

    let row = this.popupEl!.querySelector<HTMLTableRowElement>(`.calendar-grid tbody tr[data-week="${iso}"]`)
    if (!row) {
      const monday = getDateOfISOWeek(weekYear, week)
      this.viewYear = monday.getFullYear()
      this.viewMonth = monday.getMonth()
      this._renderMonth()
      row = this.popupEl!.querySelector<HTMLTableRowElement>(`.calendar-grid tbody tr[data-week="${iso}"]`)
    }
    if (row) {
      const tbody = this.popupEl!.querySelector<HTMLTableSectionElement>('.calendar-grid tbody')!
      tbody.querySelectorAll('tr').forEach(tr => tr.setAttribute('tabindex', '-1'))
      row.setAttribute('tabindex', '0')
      row.focus()
    }
  }

  private _handlePopupKeydown(e: KeyboardEvent): void {
    if (!this.popupEl) return

    if (e.key === 'Escape') {
      e.preventDefault()
      this._closePopup(true)
      return
    }

    const focusedRow = this.popupEl.querySelector<HTMLTableRowElement>('.calendar-grid tbody tr:focus')
    if (!focusedRow) return
    const iso = focusedRow.dataset.week
    if (!iso) return
    const parsed = parseWeekISO(iso)!
    const monday = getDateOfISOWeek(parsed.weekYear, parsed.week)

    // Whole-week model: all four arrows move by a week (O5). PageUp/Down = month.
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft': {
        e.preventDefault()
        const target = new Date(monday)
        target.setDate(monday.getDate() - 7)
        this._focusWeekOf(target)
        break
      }
      case 'ArrowDown':
      case 'ArrowRight': {
        e.preventDefault()
        const target = new Date(monday)
        target.setDate(monday.getDate() + 7)
        this._focusWeekOf(target)
        break
      }
      case 'PageUp': {
        e.preventDefault()
        const target = new Date(monday)
        target.setMonth(monday.getMonth() - 1)
        this._focusWeekOf(target)
        break
      }
      case 'PageDown': {
        e.preventDefault()
        const target = new Date(monday)
        target.setMonth(monday.getMonth() + 1)
        this._focusWeekOf(target)
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (!focusedRow.hasAttribute('data-disabled')) {
          this._selectWeek(parsed.weekYear, parsed.week)
        }
        break
      }
    }
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  private _applyWeek(weekYear: number, week: number): void {
    this.selectedWeekYear = weekYear
    this.selectedWeek = week

    const weekSeg = this._getSegmentEl('week')
    const yearSeg = this._getSegmentEl('year')
    this._suppressEvents = true
    if (yearSeg) this._setSegmentValue(yearSeg, clampValue(weekYear, this.minYear, this.maxYear))
    if (weekSeg) this._setSegmentValue(weekSeg, week)
    this._suppressEvents = false

    this.native.value = formatWeekISO(weekYear, week)
    this.root.dataset.hasValue = 'true'
    this.native.dispatchEvent(new Event('input', { bubbles: true }))
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    this._announceValue(weekYear, week)
  }

  private _selectWeek(weekYear: number, week: number): void {
    this._applyWeek(weekYear, week)
    this._closePopup(true)
  }

  private _handleThisWeek(): void {
    const now = new Date()
    const iso = clampWeekISO(
      formatWeekISO(getISOWeekYear(now), getISOWeek(now)),
      this.minISO,
      this.maxISO,
    )
    const parsed = parseWeekISO(iso)!
    this._applyWeek(parsed.weekYear, parsed.week)
    this._closePopup(true)
  }

  private _handleClear(): void {
    this._suppressEvents = true
    this._segmentEls.forEach(seg => this._clearSegment(seg))
    this.native.value = ''
    this.selectedWeek = null
    this.selectedWeekYear = null
    this.root.removeAttribute('data-has-value')
    this._suppressEvents = false
    // Clearing is a value change — fire both, matching the set path (_syncToNative).
    this.native.dispatchEvent(new Event('input', { bubbles: true }))
    this.native.dispatchEvent(new Event('change', { bubbles: true }))
    // A footer action that completes the value commits and closes (ADR-0029),
    // same as "This week" — Clear was the one footer action that stayed open.
    this._closePopup(true)
  }

  private _updateClearButton(): void {
    if (!this.popupEl) return
    const clearBtn = this.popupEl.querySelector<HTMLButtonElement>('.calendar-footer-clear')
    if (clearBtn) clearBtn.disabled = this.native.value === ''
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

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
      this._getCSSPx('--_wf-site-padding') / 2,
    )
    this.root.style.setProperty('--_wf-popup-offset', `${offset}%`)

    const popupLeft = containerRect.left + (offset / 100 * containerRect.width) - popupWidth / 2
    const arrowOffset = calculateArrowOffset(
      triggerCenterX,
      popupLeft,
      popupWidth,
      this._getCSSPx('--_wf-arrow-corner-radius'),
      this._getCSSPx('--_wf-arrow-size'),
    )
    this.root.style.setProperty('--_wf-arrow-offset', `${arrowOffset}px`)
  }

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

  // ─── Destroy ────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this._digitTimer !== null) {
      clearTimeout(this._digitTimer)
      this._digitTimer = null
    }

    this._closePopup(false)
    window.removeEventListener('resize', this._handleResize)

    this._segmentEls.forEach(seg => {
      const handlers = seg.__weekFieldHandlers
      if (handlers) {
        seg.removeEventListener('keydown', handlers.keydown)
        seg.removeEventListener('focus', handlers.focus)
        seg.removeEventListener('blur', handlers.blur)
        delete seg.__weekFieldHandlers
      }
    })

    delete this.root.__weekFieldInstance
  }
}

export default WeekField

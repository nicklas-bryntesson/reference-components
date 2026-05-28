// src/utils/dates.ts

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, getDaysInMonth(year, month))
}

export function getFirstWeekdayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return (day + 6) % 7 // 0=Mon, 6=Sun
}

export function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  )
}

export function isDayDisabled(date: Date, min: Date | null, max: Date | null): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (min) {
    const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate())
    if (d < minDay) return true
  }
  if (max) {
    const maxDay = new Date(max.getFullYear(), max.getMonth(), max.getDate())
    if (d > maxDay) return true
  }
  return false
}

export function formatISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDatetimeISO(date: Date, includeSeconds = false): string {
  const base = formatISO(date)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (includeSeconds) {
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${base}T${hh}:${mm}:${ss}`
  }
  return `${base}T${hh}:${mm}`
}

export function getWeekdayNames(locale: string): string[] {
  const monday = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d)
  })
}

export function getMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 1))
}

export type DateSegmentType = 'day' | 'month' | 'year'

export function getSegmentOrder(locale: string): { order: DateSegmentType[]; separator: string } {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 15))

    const order: DateSegmentType[] = []
    let separator = '/'

    for (const part of parts) {
      if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
        order.push(part.type)
      } else if (part.type === 'literal' && order.length > 0 && order.length < 3) {
        const stripped = part.value.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim()
        if (stripped) separator = stripped
      }
    }

    if (order.length === 3) return { order, separator }
  } catch (_) {}

  return { order: ['day', 'month', 'year'], separator: '/' }
}

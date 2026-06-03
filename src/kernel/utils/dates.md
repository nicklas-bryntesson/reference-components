# dates (kernel / pure functions)

Timezone-safe, locale-aware date maths for the field components. No DOM. All construction uses
`new Date(y, m, d)` (local), never UTC parsing — so a date never shifts a day across timezones.

## Public API

```ts
getDaysInMonth(year, month): number                 // month is 0-indexed
clampDayToMonth(year, month, day): number           // e.g. Jan-31 → Apr = 30, Feb non-leap = 28
getFirstWeekdayOfMonth(year, month): number         // Monday-first index: 0 = Mon … 6 = Sun
getISOWeek(date): number                            // ISO-8601 week number
isDayDisabled(date, min: Date|null, max: Date|null): boolean   // day-granularity, inclusive bounds
formatISO(date): string                             // 'YYYY-MM-DD'
formatDatetimeISO(date, includeSeconds = false): string        // 'YYYY-MM-DDTHH:mm[:ss]'
getWeekdayNames(locale): string[]                   // 7 short names, Monday-first
getMonthName(year, month, locale): string           // long month name via Intl
getSegmentOrder(locale): { order: ('day'|'month'|'year')[]; separator: string }

type DateSegmentType = 'day' | 'month' | 'year'
```

## Subtle semantics (shared so they aren't re-interpreted per component)

- **Monday-first.** `getFirstWeekdayOfMonth` and `getWeekdayNames` are Monday-indexed, not Sunday —
  the calendar grid assumes this.
- **Leap years** flow from `getDaysInMonth`; `clampDayToMonth` is how the day segment re-clamps when
  the month/year changes (Mar-31 → Feb).
- **Inclusive bounds.** `isDayDisabled` compares at day granularity; `min` and `max` are selectable.
- **Locale segment order.** `getSegmentOrder` derives day/month/year order and the separator from
  `Intl.formatToParts`, stripping bidi control chars, with a `['day','month','year'] / '/'` fallback.

## Conformance

Black-box: [`tests/dates.unit.test.ts`](tests/dates.unit.test.ts). Consumed by: DateField, DateTimeField.

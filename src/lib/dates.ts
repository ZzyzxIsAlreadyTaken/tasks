import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  isSameYear,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function getTodayIsoDate() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }

  return isValid(parseISO(value))
}

export function assertIsoDate(value: string) {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid date: ${value}`)
  }

  return value
}

export function shiftIsoDate(value: string, amount: number) {
  return format(addDays(parseISO(assertIsoDate(value)), amount), 'yyyy-MM-dd')
}

export function formatHumanDate(value: string) {
  return format(parseISO(assertIsoDate(value)), 'EEEE, MMMM d, yyyy')
}

export function formatShortDayLabel(value: string) {
  return format(parseISO(assertIsoDate(value)), 'EEE d')
}

export function getWeekIsoDates(value: string) {
  const date = parseISO(assertIsoDate(value))
  return eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }).map((day) => format(day, 'yyyy-MM-dd'))
}

export function formatWeekRange(value: string) {
  const date = parseISO(assertIsoDate(value))
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })

  if (isSameMonth(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
  }

  if (isSameYear(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }

  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}

export function getIsoWeekNumber(value: string) {
  return getISOWeek(parseISO(assertIsoDate(value)))
}

export function getIsoWeekdayShort(value: string) {
  return format(parseISO(assertIsoDate(value)), 'EEE')
}

export function getIsoDayOfMonth(value: string) {
  return format(parseISO(assertIsoDate(value)), 'd')
}

export function isIsoWeekend(value: string) {
  const day = parseISO(assertIsoDate(value)).getDay()
  return day === 0 || day === 6
}

export function isIsoToday(value: string) {
  return value === getTodayIsoDate()
}

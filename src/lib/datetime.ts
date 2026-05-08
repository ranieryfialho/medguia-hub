export const APP_TIME_ZONE = 'America/Fortaleza'
const APP_UTC_OFFSET = '-03:00'

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function parseAppDate(date: string) {
  return new Date(`${date}T12:00:00${APP_UTC_OFFSET}`)
}

export function buildAppDateTimeISO(date: string, time: string) {
  return new Date(`${date}T${time}:00${APP_UTC_OFFSET}`).toISOString()
}

export function formatAppDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value))
}

export function formatAppDate(
  value: string | Date,
  locale = 'pt-BR',
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(toDate(value))
}

export function formatAppTime(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(value))
}

export function formatAppDateLabel(value: string | Date, locale = 'pt-BR') {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toDate(value))
}

export function getAppHour(value: string | Date) {
  return Number(formatAppTime(value).split(':')[0])
}

export function getAppDayRangeUTC(date: string) {
  return {
    start: new Date(`${date}T00:00:00${APP_UTC_OFFSET}`).toISOString(),
    end: new Date(`${date}T23:59:59.999${APP_UTC_OFFSET}`).toISOString(),
  }
}

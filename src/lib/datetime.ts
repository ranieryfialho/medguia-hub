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

// As funções abaixo calculam limites de semana/mês operando só sobre os
// componentes Y-M-D da chave "yyyy-MM-dd" via getUTC*/setUTC*/Date.UTC.
// Isso as torna imunes ao timezone do processo Node: usar startOfWeek/startOfMonth
// do date-fns aqui resetaria a hora para meia-noite NO FUSO DO PROCESSO, e se o
// servidor rodar em UTC (padrão em containers Docker), meia-noite UTC vira 21h do
// dia anterior em America/Fortaleza — voltando um dia inteiro ao reconverter com
// formatAppDateKey/parseAppDate.
export function startOfAppWeekKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

export function endOfAppWeekKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + (6 - d.getUTCDay()))
  return d.toISOString().slice(0, 10)
}

export function startOfAppMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function endOfAppMonthKey(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function subAppMonthsKey(dateKey: string, months: number): string {
  const [y, m, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - months, day)).toISOString().slice(0, 10)
}

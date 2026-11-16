import { badRequest } from './auth'

export function parseReferenceMonth(month: string): { year: number; monthIndex: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim())
  if (!m) {
    badRequest('Mês deve estar no formato YYYY-MM')
  }
  const year = Number(m[1])
  const month1 = Number(m[2])
  if (month1 < 1 || month1 > 12) {
    badRequest('Mês inválido')
  }
  return { year, monthIndex: month1 - 1 }
}

export function referenceMonthMidUtc(month: string): Date {
  const { year, monthIndex } = parseReferenceMonth(month)
  return new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0, 0))
}

export function formatReferenceMonth(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function currentReferenceMonth(): string {
  return formatReferenceMonth(new Date())
}

export function resolveReferenceMonth(month?: string): string {
  return month?.trim() || currentReferenceMonth()
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function addMonthsUtc(
  year: number,
  monthIndex: number,
  delta: number
): { year: number; monthIndex: number } {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1))
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() }
}

export function closingEndOfDayUtc(
  year: number,
  monthIndex: number,
  closingDay: number
): Date {
  const dim = daysInMonth(year, monthIndex)
  const day = Math.min(closingDay, dim)
  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999))
}

export function previousClosingEnd(
  currentClosingEnd: Date,
  closingDay: number
): Date {
  const y = currentClosingEnd.getUTCFullYear()
  const m = currentClosingEnd.getUTCMonth()
  const p = addMonthsUtc(y, m, -1)
  return closingEndOfDayUtc(p.year, p.monthIndex, closingDay)
}

export function cycleStartAfter(prevClosingEnd: Date): Date {
  const d = new Date(prevClosingEnd)
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  )
}

export function dueEndOfDayAfterClosing(
  closingEnd: Date,
  dueDay: number
): Date {
  const y = closingEnd.getUTCFullYear()
  const m = closingEnd.getUTCMonth()
  const next = addMonthsUtc(y, m, 1)
  const dim = daysInMonth(next.year, next.monthIndex)
  const day = Math.min(dueDay, dim)
  return new Date(Date.UTC(next.year, next.monthIndex, day, 23, 59, 59, 999))
}

export interface BillingCycleBounds {
  periodStart: Date
  periodEnd: Date
  dueDate: Date
}

export function cycleContainingReference(
  reference: Date,
  closingDay: number,
  dueDay: number
): BillingCycleBounds {
  let y = reference.getUTCFullYear()
  let m = reference.getUTCMonth()
  for (let guard = 0; guard < 48; guard++) {
    const close = closingEndOfDayUtc(y, m, closingDay)
    const prevClose = previousClosingEnd(close, closingDay)
    const periodStart = cycleStartAfter(prevClose)
    const refMs = reference.getTime()
    if (refMs >= periodStart.getTime() && refMs <= close.getTime()) {
      return {
        periodStart,
        periodEnd: close,
        dueDate: dueEndOfDayAfterClosing(close, dueDay),
      }
    }
    if (refMs > close.getTime()) {
      const next = addMonthsUtc(y, m, 1)
      y = next.year
      m = next.monthIndex
      continue
    }
    const prev = addMonthsUtc(y, m, -1)
    y = prev.year
    m = prev.monthIndex
  }
  throw new Error('cycleContainingReference: could not resolve cycle')
}

export function nextCycleAfter(
  current: BillingCycleBounds,
  closingDay: number,
  dueDay: number
): BillingCycleBounds {
  const anchor = cycleStartAfter(current.periodEnd)
  return cycleContainingReference(anchor, closingDay, dueDay)
}

export function buildCyclesAroundReference(
  closingDay: number,
  dueDay: number,
  pastCount: number,
  futureCount: number,
  reference: Date = new Date()
): BillingCycleBounds[] {
  const current = cycleContainingReference(reference, closingDay, dueDay)

  const future: BillingCycleBounds[] = []
  let f = current
  for (let i = 0; i < futureCount; i++) {
    f = nextCycleAfter(f, closingDay, dueDay)
    future.push(f)
  }

  const past: BillingCycleBounds[] = []
  let periodEnd = current.periodEnd
  for (let i = 0; i < pastCount; i++) {
    const prevClose = previousClosingEnd(periodEnd, closingDay)
    const prevPrevClose = previousClosingEnd(prevClose, closingDay)
    const periodStart = cycleStartAfter(prevPrevClose)
    past.push({
      periodStart,
      periodEnd: prevClose,
      dueDate: dueEndOfDayAfterClosing(prevClose, dueDay),
    })
    periodEnd = prevClose
  }

  return [current, ...future, ...past]
}

export function utcYmd(d: Date): number {
  return (
    d.getUTCFullYear() * 10000 +
    (d.getUTCMonth() + 1) * 100 +
    d.getUTCDate()
  )
}

export function transactionInBillingCycle(
  occurredAt: Date | string,
  periodStart: Date,
  periodEnd: Date
): boolean {
  const tx = new Date(occurredAt)
  const t = utcYmd(tx)
  return t >= utcYmd(periodStart) && t <= utcYmd(periodEnd)
}

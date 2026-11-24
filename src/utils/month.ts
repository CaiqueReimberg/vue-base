export function currentReferenceMonth(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function formatPeriodLabel(referenceMonth: string): string {
  const [y, m] = referenceMonth.split('-').map(Number)
  const monthName = SHORT_MONTHS[(m || 1) - 1] || 'Mês'
  return `${monthName} ${y}`
}

export function shiftReferenceMonth(referenceMonth: string, delta: number): string {
  const [y, m] = referenceMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const ny = d.getFullYear()
  const nm = String(d.getMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export type BillPaymentStatus = 'paid' | 'pending' | 'overdue'

export function billPaymentStatus(
  paid: boolean,
  dueDay: number | null | undefined,
  referenceMonth: string,
): BillPaymentStatus {
  if (paid) return 'paid'
  if (dueDay == null) return 'pending'

  const today = new Date()
  const [y, m] = referenceMonth.split('-').map(Number)
  const dueDate = new Date(y, m - 1, dueDay)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (dueDate < todayStart) return 'overdue'
  return 'pending'
}

import { desc, eq } from 'drizzle-orm'
import { db } from '../database'
import { incomeEntries } from '../database/schema'
import { formatReferenceMonth, parseReferenceMonth, resolveReferenceMonth } from './billing'

export type IncomeCategory =
  | 'salary'
  | 'freelance'
  | 'client'
  | 'commission'
  | 'bonus'
  | 'sale'
  | 'investment'
  | 'other'

export const VALID_INCOME_CATEGORIES = new Set<IncomeCategory>([
  'salary',
  'freelance',
  'client',
  'commission',
  'bonus',
  'sale',
  'investment',
  'other',
])

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function shiftYearMonth(ym: string, delta: number): string {
  const { year, monthIndex } = parseReferenceMonth(ym)
  return formatReferenceMonth(new Date(Date.UTC(year, monthIndex + delta, 1)))
}

export function isIncomeEntryActiveInMonth(
  row: {
    referenceMonth: string
    isRecurring: boolean
    endMonth?: string | null
  },
  targetYm: string,
): boolean {
  if (!row.isRecurring) {
    return row.referenceMonth === targetYm
  }
  if (row.referenceMonth > targetYm) return false
  if (row.endMonth && row.endMonth < targetYm) return false
  return true
}

export function serializeIncomeEntry(row: typeof incomeEntries.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    category: (VALID_INCOME_CATEGORIES.has(row.category as IncomeCategory)
      ? row.category
      : 'other') as IncomeCategory,
    amount: roundMoney(Number(row.amount)),
    referenceMonth: row.referenceMonth,
    receivedAt: row.receivedAt,
    isRecurring: Boolean(row.isRecurring),
    endMonth: row.endMonth ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listUserIncomesForMonth(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)

  const allRows = await db
    .select()
    .from(incomeEntries)
    .where(eq(incomeEntries.userId, userId))
    .orderBy(desc(incomeEntries.receivedAt), desc(incomeEntries.createdAt))

  // Coleta as últimas origens únicas usadas pela pessoa para preenchimento rápido
  const recentSources: string[] = []
  const seenSources = new Set<string>()
  for (const row of allRows) {
    const trimmed = row.source.trim()
    const key = trimmed.toLowerCase()
    if (trimmed && !seenSources.has(key)) {
      seenSources.add(key)
      recentSources.push(trimmed)
      if (recentSources.length >= 8) break
    }
  }

  const activeRows = allRows.filter((row) => isIncomeEntryActiveInMonth(row, referenceMonth))
  const items = activeRows.map(serializeIncomeEntry)

  const fixedTotal = roundMoney(
    items.filter((i) => i.isRecurring).reduce((sum, i) => sum + i.amount, 0),
  )
  const variableTotal = roundMoney(
    items.filter((i) => !i.isRecurring).reduce((sum, i) => sum + i.amount, 0),
  )
  const total = roundMoney(fixedTotal + variableTotal)

  const sourceMap = new Map<string, { source: string; amount: number; count: number }>()
  for (const item of items) {
    const key = item.source.trim().toLowerCase()
    const existing = sourceMap.get(key)
    if (existing) {
      existing.amount = roundMoney(existing.amount + item.amount)
      existing.count += 1
    } else {
      sourceMap.set(key, {
        source: item.source.trim(),
        amount: item.amount,
        count: 1,
      })
    }
  }

  const bySource = Array.from(sourceMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((entry) => ({
      ...entry,
      share: total > 0 ? Math.round((entry.amount / total) * 100) : 0,
    }))

  return {
    month: referenceMonth,
    total,
    fixedTotal,
    variableTotal,
    count: items.length,
    items,
    bySource,
    recentSources,
  }
}

export async function sumUserIncomesByMonths(userId: string, months: string[]) {
  const allRows = await db
    .select()
    .from(incomeEntries)
    .where(eq(incomeEntries.userId, userId))

  const map = new Map<
    string,
    { total: number; count: number; fixedTotal: number; variableTotal: number }
  >()

  for (const ym of months) {
    let fixedTotal = 0
    let variableTotal = 0
    let count = 0
    for (const row of allRows) {
      if (!isIncomeEntryActiveInMonth(row, ym)) continue
      const val = Number(row.amount || 0)
      count += 1
      if (row.isRecurring) {
        fixedTotal += val
      } else {
        variableTotal += val
      }
    }
    map.set(ym, {
      total: roundMoney(fixedTotal + variableTotal),
      count,
      fixedTotal: roundMoney(fixedTotal),
      variableTotal: roundMoney(variableTotal),
    })
  }

  return map
}

import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { incomeEntries } from '../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../utils/auth'
import {
  type IncomeCategory,
  serializeIncomeEntry,
  VALID_INCOME_CATEGORIES,
} from '../../utils/incomes'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [existing] = await db
    .select()
    .from(incomeEntries)
    .where(and(eq(incomeEntries.id, id), eq(incomeEntries.userId, userId)))
    .limit(1)

  if (!existing) {
    notFound('Entrada não encontrada.')
  }

  const body = await readBody<{
    title?: string
    source?: string
    category?: string
    amount?: number
    referenceMonth?: string
    receivedAt?: string
    isRecurring?: boolean
    endMonth?: string | null
    notes?: string | null
  }>(event)

  const nextSource =
    body.source !== undefined ? body.source.trim() : existing.source
  if (!nextSource) {
    badRequest('Informe de onde veio esse ganho.')
  }

  const nextTitle =
    body.title !== undefined ? body.title.trim() || nextSource : existing.title

  const nextAmount =
    body.amount !== undefined ? Number(body.amount) : Number(existing.amount)
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    badRequest('Informe um valor válido maior que zero.')
  }

  const nextCategory: IncomeCategory =
    body.category && VALID_INCOME_CATEGORIES.has(body.category as IncomeCategory)
      ? (body.category as IncomeCategory)
      : (existing.category as IncomeCategory)

  const nextRefMonth =
    body.referenceMonth && /^\d{4}-\d{2}$/.test(body.referenceMonth)
      ? body.referenceMonth
      : existing.referenceMonth

  const nextReceivedAt =
    body.receivedAt && /^\d{4}-\d{2}-\d{2}$/.test(body.receivedAt)
      ? body.receivedAt
      : existing.receivedAt

  const nextIsRecurring =
    body.isRecurring !== undefined ? Boolean(body.isRecurring) : Boolean(existing.isRecurring)

  const nextEndMonth =
    body.endMonth !== undefined
      ? body.endMonth && /^\d{4}-\d{2}$/.test(body.endMonth)
        ? body.endMonth
        : null
      : existing.endMonth

  const nextNotes =
    body.notes !== undefined ? body.notes?.trim() || null : existing.notes

  await db
    .update(incomeEntries)
    .set({
      title: nextTitle,
      source: nextSource,
      category: nextCategory,
      amount: Math.round(nextAmount * 100) / 100,
      referenceMonth: nextRefMonth,
      receivedAt: nextReceivedAt,
      isRecurring: nextIsRecurring,
      endMonth: nextIsRecurring ? nextEndMonth : null,
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(incomeEntries.id, id))

  const [updated] = await db
    .select()
    .from(incomeEntries)
    .where(eq(incomeEntries.id, id))
    .limit(1)

  return serializeIncomeEntry(updated)
})

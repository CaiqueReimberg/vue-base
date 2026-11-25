import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { incomeEntries } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { resolveReferenceMonth } from '../../utils/billing'
import { getHouseholdVisibility } from '../../utils/household'
import {
  type IncomeCategory,
  serializeIncomeEntry,
  VALID_INCOME_CATEGORIES,
} from '../../utils/incomes'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    title?: string
    source?: string
    category?: string
    amount?: number
    referenceMonth?: string
    receivedAt?: string
    isRecurring?: boolean
    notes?: string | null
  }>(event)

  const source = body?.source?.trim() || ''
  const title = body?.title?.trim() || source
  const amount = Number(body?.amount)

  if (!source) {
    badRequest('Informe de onde veio esse ganho.')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    badRequest('Informe um valor válido maior que zero.')
  }

  const referenceMonth = resolveReferenceMonth(body?.referenceMonth)
  const rawDate = body?.receivedAt?.trim()
  const receivedAt =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : `${referenceMonth}-${String(new Date().getDate()).padStart(2, '0')}`

  const category: IncomeCategory =
    body?.category && VALID_INCOME_CATEGORIES.has(body.category as IncomeCategory)
      ? (body.category as IncomeCategory)
      : body?.isRecurring
        ? 'salary'
        : 'freelance'

  const visibility = await getHouseholdVisibility(userId)
  const now = new Date().toISOString()
  const id = randomUUID()

  await db.insert(incomeEntries).values({
    id,
    title,
    source,
    category,
    amount: Math.round(amount * 100) / 100,
    referenceMonth,
    receivedAt,
    isRecurring: Boolean(body?.isRecurring),
    endMonth: null,
    notes: body?.notes?.trim() || null,
    userId,
    familyId: visibility.familyId,
    createdAt: now,
    updatedAt: now,
  })

  const [saved] = await db
    .select()
    .from(incomeEntries)
    .where(eq(incomeEntries.id, id))
    .limit(1)

  return serializeIncomeEntry(saved)
})

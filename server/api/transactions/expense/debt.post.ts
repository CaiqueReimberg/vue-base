import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../../database'
import { transactions } from '../../../database/schema'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { assertUserBelongsToFamily } from '../../../utils/household'
import { hydrateTransactions } from '../../../utils/transactions'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    amount: number
    installmentTotal: number
    description: string
    occurredAt: string
    dueDate?: string
    paidAt?: string
    referenceMonth?: string
    familyId?: string
    status?: string
    debtCategory: string
    isShared?: boolean
    notes?: string
  }>(event)

  if (!body?.description?.trim() || !body.amount || !body.debtCategory) {
    badRequest('Informe descrição, valor e categoria da dívida')
  }

  if (body.familyId) {
    await assertUserBelongsToFamily(userId, body.familyId)
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const row: typeof transactions.$inferInsert = {
    id,
    amount: Number(body.amount),
    installmentTotal: body.installmentTotal ?? 1,
    installmentNumber: null,
    description: body.description.trim(),
    occurredAt: new Date(body.occurredAt).toISOString(),
    dueDate: body.dueDate ? new Date(body.dueDate).toISOString().slice(0, 10) : null,
    paidAt: body.paidAt ? new Date(body.paidAt).toISOString() : null,
    referenceMonth: body.referenceMonth ?? null,
    status: body.status ?? 'pending',
    type: 'expense',
    kind: 'debt',
    debtCategory: body.debtCategory,
    userId,
    accountId: null,
    cardId: null,
    categoryId: null,
    familyId: body.familyId ?? null,
    isShared: body.isShared ?? false,
    notes: body.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(transactions).values(row)
  const [saved] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
  const [hydrated] = await hydrateTransactions([saved], true)
  return hydrated
})

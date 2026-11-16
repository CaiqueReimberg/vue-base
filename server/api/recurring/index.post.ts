import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { recurrings } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily } from '../../utils/household'
import { hydrateRecurrings } from '../../utils/recurring'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    name?: string
    kind?: string
    transactionType?: string
    frequency?: string
    amount?: number
    description?: string | null
    dueDay?: number | null
    startDate?: string
    endDate?: string | null
    isActive?: boolean
    isShared?: boolean
    accountId?: string
    cardId?: string
    categoryId?: string
    familyId?: string
  }>(event)

  if (!body?.name?.trim() || !body.kind || !body.transactionType || !body.startDate) {
    badRequest('Informe nome, tipo e data inicial da recorrência')
  }

  if (body.accountId && body.cardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  if (body.accountId) await findOneLinkableAccount(userId, body.accountId)
  if (body.cardId) await findOneLinkableCard(userId, body.cardId)
  if (body.categoryId) await findOneVisibleCategory(userId, body.categoryId)
  if (body.familyId) await assertUserBelongsToFamily(userId, body.familyId)

  const now = new Date().toISOString()
  const id = randomUUID()
  const row: typeof recurrings.$inferInsert = {
    id,
    name: body.name.trim(),
    kind: body.kind,
    transactionType: body.transactionType,
    frequency: body.frequency ?? 'monthly',
    amount: Number(body.amount ?? 0),
    description: body.description ?? null,
    dueDay: body.dueDay != null ? Number(body.dueDay) : null,
    startDate: new Date(body.startDate).toISOString().slice(0, 10),
    endDate: body.endDate ? new Date(body.endDate).toISOString().slice(0, 10) : null,
    isActive: body.isActive ?? true,
    isShared: body.isShared ?? false,
    userId,
    accountId: body.accountId ?? null,
    cardId: body.cardId ?? null,
    categoryId: body.categoryId ?? null,
    familyId: body.familyId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(recurrings).values(row)
  const [saved] = await db.select().from(recurrings).where(eq(recurrings.id, id)).limit(1)
  const [hydrated] = await hydrateRecurrings([saved], true)
  return hydrated
})

import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { recurrings } from '../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily } from '../../utils/household'
import { hydrateRecurrings } from '../../utils/recurring'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
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
    accountId?: string | null
    cardId?: string | null
    categoryId?: string | null
    familyId?: string | null
  }>(event)

  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, id), eq(recurrings.userId, userId)))
    .limit(1)

  if (!rec) {
    notFound('Recorrência não encontrada')
  }

  let nextAccountId = rec.accountId
  let nextCardId = rec.cardId

  if (body.accountId !== undefined) {
    nextAccountId = body.accountId || null
    nextCardId = null
  }
  if (body.cardId !== undefined) {
    nextCardId = body.cardId || null
    nextAccountId = null
  }

  if (nextAccountId && nextCardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  if (nextAccountId) await findOneLinkableAccount(userId, nextAccountId)
  if (nextCardId) await findOneLinkableCard(userId, nextCardId)
  if (body.categoryId) await findOneVisibleCategory(userId, body.categoryId)
  if (body.familyId) await assertUserBelongsToFamily(userId, body.familyId)

  const updates: Partial<typeof recurrings.$inferInsert> = {
    accountId: nextAccountId,
    cardId: nextCardId,
    updatedAt: new Date().toISOString(),
  }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.kind !== undefined) updates.kind = body.kind
  if (body.transactionType !== undefined) updates.transactionType = body.transactionType
  if (body.frequency !== undefined) updates.frequency = body.frequency
  if (body.amount !== undefined) updates.amount = Number(body.amount)
  if (body.description !== undefined) updates.description = body.description
  if (body.dueDay !== undefined) updates.dueDay = body.dueDay != null ? Number(body.dueDay) : null
  if (body.startDate !== undefined) {
    updates.startDate = new Date(body.startDate).toISOString().slice(0, 10)
  }
  if (body.endDate !== undefined) {
    updates.endDate = body.endDate ? new Date(body.endDate).toISOString().slice(0, 10) : null
  }
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.isShared !== undefined) updates.isShared = body.isShared
  if (body.categoryId !== undefined) updates.categoryId = body.categoryId || null
  if (body.familyId !== undefined) updates.familyId = body.familyId || null

  await db.update(recurrings).set(updates).where(eq(recurrings.id, id))
  const [saved] = await db.select().from(recurrings).where(eq(recurrings.id, id)).limit(1)
  const [hydrated] = await hydrateRecurrings([saved], true)
  return hydrated
})

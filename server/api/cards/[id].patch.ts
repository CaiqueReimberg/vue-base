import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { cards } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily, getPublicUsersMap } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    name?: string
    limitAmount?: number
    closingDay?: number
    dueDay?: number
    bankName?: string | null
    brand?: string | null
    last4?: string | null
    isActive?: boolean
    shareWithPartner?: boolean
    familyId?: string | null
  }>(event)

  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .limit(1)

  if (!card) {
    notFound(`Cartão com ID ${id} não encontrado`)
  }

  const updates: Partial<typeof cards.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.limitAmount !== undefined) updates.limitAmount = Number(body.limitAmount)
  if (body.closingDay !== undefined) updates.closingDay = Number(body.closingDay)
  if (body.dueDay !== undefined) updates.dueDay = Number(body.dueDay)
  if (body.bankName !== undefined) updates.bankName = body.bankName
  if (body.brand !== undefined) updates.brand = body.brand
  if (body.last4 !== undefined) updates.last4 = body.last4
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.shareWithPartner !== undefined) updates.shareWithPartner = body.shareWithPartner

  if (body.familyId !== undefined) {
    if (body.familyId) {
      await assertUserBelongsToFamily(userId, body.familyId)
      updates.familyId = body.familyId
    } else {
      updates.familyId = null
    }
  }

  await db.update(cards).set(updates).where(eq(cards.id, id))
  const [updated] = await db.select().from(cards).where(eq(cards.id, id)).limit(1)
  const usersMap = await getPublicUsersMap([updated.userId])
  return {
    ...updated,
    owner: usersMap.get(updated.userId) ?? null,
  }
})

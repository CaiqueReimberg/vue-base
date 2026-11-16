import { randomUUID } from 'node:crypto'
import { readBody } from 'h3'
import { db } from '../../database'
import { cards } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { assertUserBelongsToFamily, getPublicUsersMap } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
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

  if (!body?.name?.trim() || body.limitAmount === undefined || !body.closingDay || !body.dueDay) {
    badRequest('Informe nome, limite, dia de fechamento e dia de vencimento do cartão')
  }

  if (body.familyId) {
    await assertUserBelongsToFamily(userId, body.familyId)
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const newCard: typeof cards.$inferInsert = {
    id,
    name: body.name.trim(),
    limitAmount: Number(body.limitAmount),
    closingDay: Number(body.closingDay),
    dueDay: Number(body.dueDay),
    bankName: body.bankName ?? null,
    brand: body.brand ?? null,
    last4: body.last4 ?? null,
    isActive: body.isActive ?? true,
    shareWithPartner: body.shareWithPartner ?? false,
    userId,
    familyId: body.familyId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(cards).values(newCard)
  const usersMap = await getPublicUsersMap([userId])
  return {
    ...newCard,
    owner: usersMap.get(userId) ?? null,
  }
})

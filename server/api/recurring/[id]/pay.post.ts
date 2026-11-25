import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../database'
import { recurringPayments } from '../../../database/schema'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { assertPersonInSameHousehold, getPublicUsersMap } from '../../../utils/household'
import { findOneVisibleRecurring, setRecurringMonthAmount } from '../../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const recurringId = getRouterParam(event, 'id')!
  const body = await readBody<{
    referenceMonth?: string
    amount?: number
    paidByUserId?: string
  }>(event)

  if (!body?.referenceMonth) {
    badRequest('Informe referenceMonth')
  }

  await findOneVisibleRecurring(userId, recurringId)

  const payerId = body.paidByUserId?.trim() || userId
  if (payerId !== userId) {
    await assertPersonInSameHousehold(userId, payerId)
  }

  if (body.amount !== undefined && Number.isFinite(Number(body.amount)) && Number(body.amount) > 0) {
    await setRecurringMonthAmount(userId, recurringId, body.referenceMonth, Number(body.amount))
  }

  const [existing] = await db
    .select()
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.recurringId, recurringId),
        eq(recurringPayments.referenceMonth, body.referenceMonth),
      ),
    )
    .limit(1)

  const now = new Date().toISOString()

  if (existing) {
    if (body.paidByUserId && existing.userId !== payerId) {
      await db
        .update(recurringPayments)
        .set({ userId: payerId })
        .where(eq(recurringPayments.id, existing.id))
    }
    const usersMap = await getPublicUsersMap([payerId])
    return {
      recurringId,
      referenceMonth: body.referenceMonth,
      paidAt: existing.paidAt,
      paid: true,
      paidBy: usersMap.get(payerId) ?? null,
    }
  }

  await db.insert(recurringPayments).values({
    id: randomUUID(),
    recurringId,
    referenceMonth: body.referenceMonth,
    paidAt: now,
    userId: payerId,
    createdAt: now,
  })

  const usersMap = await getPublicUsersMap([payerId])

  return {
    recurringId,
    referenceMonth: body.referenceMonth,
    paidAt: now,
    paid: true,
    paidBy: usersMap.get(payerId) ?? null,
  }
})

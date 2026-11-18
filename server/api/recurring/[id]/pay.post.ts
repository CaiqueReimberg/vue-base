import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../database'
import { recurringPayments } from '../../../database/schema'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { findOneVisibleRecurring, setRecurringMonthAmount } from '../../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const recurringId = getRouterParam(event, 'id')!
  const body = await readBody<{ referenceMonth?: string; amount?: number }>(event)

  if (!body?.referenceMonth) {
    badRequest('Informe referenceMonth')
  }

  await findOneVisibleRecurring(userId, recurringId)

  if (body.amount !== undefined && Number.isFinite(Number(body.amount)) && Number(body.amount) > 0) {
    await setRecurringMonthAmount(userId, recurringId, body.referenceMonth, Number(body.amount))
  }

  const [existing] = await db
    .select()
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.recurringId, recurringId),
        eq(recurringPayments.referenceMonth, body.referenceMonth)
      )
    )
    .limit(1)

  if (existing) {
    return {
      recurringId,
      referenceMonth: body.referenceMonth,
      paidAt: existing.paidAt,
      paid: true,
    }
  }

  const now = new Date().toISOString()
  await db.insert(recurringPayments).values({
    id: randomUUID(),
    recurringId,
    referenceMonth: body.referenceMonth,
    paidAt: now,
    userId,
    createdAt: now,
  })

  return {
    recurringId,
    referenceMonth: body.referenceMonth,
    paidAt: now,
    paid: true,
  }
})

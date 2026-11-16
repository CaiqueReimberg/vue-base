import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../../../database'
import { recurringPayments } from '../../../../database/schema'
import { requireAuthUser } from '../../../../utils/auth'
import { findOneVisibleRecurring } from '../../../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const recurringId = getRouterParam(event, 'id')!
  const referenceMonth = getRouterParam(event, 'referenceMonth')!

  await findOneVisibleRecurring(userId, recurringId)

  await db
    .delete(recurringPayments)
    .where(
      and(
        eq(recurringPayments.recurringId, recurringId),
        eq(recurringPayments.referenceMonth, referenceMonth)
      )
    )

  return { unpaid: true }
})

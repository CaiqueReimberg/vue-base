import { eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { savingsGoals } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { getOwnedGoalOrThrow } from '../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  await getOwnedGoalOrThrow(userId, id)
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id))
  return { deleted: true }
})

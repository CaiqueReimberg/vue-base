import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../../../database'
import { savingsContributions } from '../../../../database/schema'
import { notFound, requireAuthUser } from '../../../../utils/auth'
import {
  applyGoalAccountDelta,
  getVisibleGoalOrThrow,
  listSavingsGoals,
} from '../../../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const goalId = getRouterParam(event, 'id')!
  const contributionId = getRouterParam(event, 'contributionId')!
  const goal = await getVisibleGoalOrThrow(userId, goalId)

  const [row] = await db
    .select({ id: savingsContributions.id, amount: savingsContributions.amount })
    .from(savingsContributions)
    .where(and(eq(savingsContributions.id, contributionId), eq(savingsContributions.goalId, goalId)))
    .limit(1)
  if (!row) notFound('Aporte não encontrado')

  await db.delete(savingsContributions).where(eq(savingsContributions.id, contributionId))

  if (goal.accountId && row.amount) {
    await applyGoalAccountDelta(userId, goal.accountId, -Number(row.amount))
  }

  const all = await listSavingsGoals(userId)
  return all.find((g) => g.id === goalId)
})

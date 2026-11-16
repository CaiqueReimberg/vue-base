import { readBody } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { upsertMonthlyPlan } from '../../utils/dashboard'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = (await readBody(event)) || {}
  return upsertMonthlyPlan(userId, {
    referenceMonth: typeof body.referenceMonth === 'string' ? body.referenceMonth : undefined,
    monthlyIncome: body.monthlyIncome !== undefined ? Number(body.monthlyIncome) : undefined,
    savingsGoal: body.savingsGoal !== undefined ? Number(body.savingsGoal) : undefined,
    savingsPaid: typeof body.savingsPaid === 'boolean' ? body.savingsPaid : undefined,
    endOfMonthLeftover:
      body.endOfMonthLeftover === null
        ? null
        : body.endOfMonthLeftover !== undefined
          ? Number(body.endOfMonthLeftover)
          : undefined,
    closedAt: body.closedAt,
    notes: body.notes,
  })
})

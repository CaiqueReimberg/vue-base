import { requireAuthUser } from '../../utils/auth'
import { listSavingsGoals } from '../../utils/savings-goals'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  return listSavingsGoals(userId)
})

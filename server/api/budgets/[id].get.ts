import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { findOneVisibleBudget } from '../../utils/budgets'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const { hydrated } = await findOneVisibleBudget(userId, id)
  return hydrated
})

import { getQuery, getRouterParam } from 'h3'
import { requireAuthUser } from '../../../utils/auth'
import { getBudgetStatusByUser } from '../../../utils/budgets'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)

  const month = query.month !== undefined ? Number(query.month) : undefined
  const year = query.year !== undefined ? Number(query.year) : undefined

  return getBudgetStatusByUser(userId, id, { month, year })
})

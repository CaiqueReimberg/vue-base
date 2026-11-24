import { getQuery } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { getMonthlyHistory } from '../../utils/dashboard'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)
  const months = Number(query.months ?? 6)
  const endMonth = typeof query.endMonth === 'string' ? query.endMonth : undefined
  return getMonthlyHistory(userId, months, endMonth)
})

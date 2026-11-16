import { getQuery } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { getAgenda } from '../../utils/dashboard'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)
  const month = typeof query.month === 'string' ? query.month : undefined
  return getAgenda(userId, month)
})

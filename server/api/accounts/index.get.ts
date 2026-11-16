import { getQuery } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { findVisibleAccountsByUser } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)
  const type = typeof query.type === 'string' && query.type ? query.type : undefined
  const isActive =
    query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined

  return findVisibleAccountsByUser(userId, { type, isActive })
})

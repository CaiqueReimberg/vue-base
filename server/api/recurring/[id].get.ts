import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { findOneVisibleRecurring } from '../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  return findOneVisibleRecurring(userId, id)
})

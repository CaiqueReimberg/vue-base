import { requireAuthUser } from '../../utils/auth'
import { findVisibleCardsByUser } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  return findVisibleCardsByUser(userId)
})

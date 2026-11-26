import { getRouterParam, readBody } from 'h3'
import { requireAuthUser } from '../../../utils/auth'
import { pauseRecurringFromMonth } from '../../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ fromMonth?: string }>(event).catch(() => ({}))
  return pauseRecurringFromMonth(userId, id, body?.fromMonth)
})

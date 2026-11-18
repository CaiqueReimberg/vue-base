import { getRouterParam, readBody } from 'h3'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { setRecurringMonthAmount } from '../../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const recurringId = getRouterParam(event, 'id')!
  const body = await readBody<{ referenceMonth?: string; amount?: number }>(event)

  if (!body?.referenceMonth) {
    badRequest('Informe referenceMonth')
  }
  if (body.amount === undefined || Number(body.amount) <= 0) {
    badRequest('Informe um valor maior que zero')
  }

  return setRecurringMonthAmount(userId, recurringId, body.referenceMonth, Number(body.amount))
})

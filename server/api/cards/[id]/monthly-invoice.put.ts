import { getRouterParam, readBody } from 'h3'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { upsertCardMonthlyInvoice } from '../../../utils/card-invoices'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const cardId = getRouterParam(event, 'id')!
  const body = await readBody<{
    referenceMonth?: string
    amount?: number
    dueDay?: number
    isShared?: boolean
  }>(event)

  if (!body?.referenceMonth) {
    badRequest('Informe referenceMonth no formato YYYY-MM.')
  }

  return upsertCardMonthlyInvoice(userId, cardId, {
    referenceMonth: body.referenceMonth,
    amount: Number(body.amount),
    dueDay: body.dueDay,
    isShared: body.isShared,
  })
})

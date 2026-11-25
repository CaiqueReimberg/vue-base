import { getRouterParam, readBody } from 'h3'
import { badRequest, requireAuthUser } from '../../../../utils/auth'
import { payCardMonthlyInvoice } from '../../../../utils/card-invoices'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const cardId = getRouterParam(event, 'id')!
  const body = await readBody<{
    referenceMonth?: string
    amount?: number
    paidByUserId?: string
  }>(event)

  if (!body?.referenceMonth) {
    badRequest('Informe referenceMonth no formato YYYY-MM.')
  }

  return payCardMonthlyInvoice(userId, cardId, {
    referenceMonth: body.referenceMonth,
    amount: body.amount,
    paidByUserId: body.paidByUserId,
  })
})

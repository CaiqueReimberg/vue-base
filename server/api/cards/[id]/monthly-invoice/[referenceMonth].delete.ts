import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../../../utils/auth'
import { deleteCardMonthlyInvoice } from '../../../../utils/card-invoices'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const cardId = getRouterParam(event, 'id')!
  const referenceMonth = getRouterParam(event, 'referenceMonth')!

  return deleteCardMonthlyInvoice(userId, cardId, referenceMonth)
})

import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../../../../utils/auth'
import { unpayCardMonthlyInvoice } from '../../../../../utils/card-invoices'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const cardId = getRouterParam(event, 'id')!
  const referenceMonth = getRouterParam(event, 'referenceMonth')!

  return unpayCardMonthlyInvoice(userId, cardId, referenceMonth)
})

import { readBody } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { findOrCreateUserCard } from '../../utils/card-invoices'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    name?: string
    limitAmount?: number
    closingDay?: number
    dueDay?: number
    bankName?: string | null
    brand?: string | null
    last4?: string | null
    shareWithPartner?: boolean
  }>(event)

  return findOrCreateUserCard(userId, {
    name: body?.name || '',
    limitAmount: body?.limitAmount,
    closingDay: body?.closingDay,
    dueDay: body?.dueDay,
    bankName: body?.bankName,
    brand: body?.brand,
    last4: body?.last4,
    shareWithPartner: body?.shareWithPartner,
  })
})

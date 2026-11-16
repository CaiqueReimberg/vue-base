import { readBody } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { type CreateTxPayload, createTransactionByType } from '../../utils/transactions'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<CreateTxPayload>(event)
  return createTransactionByType(userId, body, 'expense')
})

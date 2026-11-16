import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { transactions } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { getHouseholdVisibility } from '../../utils/household'
import { hydrateTransactions } from '../../utils/transactions'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const visibility = await getHouseholdVisibility(userId)

  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), inArray(transactions.userId, visibility.memberIds)))
    .limit(1)

  if (!tx || (tx.userId !== userId && !tx.isShared)) {
    notFound('Transação não encontrada')
  }

  const [hydrated] = await hydrateTransactions([tx], true)
  return hydrated
})

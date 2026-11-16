import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { transactions } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)

  if (!tx) {
    notFound('Transação não encontrada')
  }

  await db.delete(transactions).where(eq(transactions.id, id))
  return { deleted: true }
})

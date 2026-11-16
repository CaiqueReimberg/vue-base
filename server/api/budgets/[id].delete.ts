import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { budgets } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [budget] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.ownerId, userId)))
    .limit(1)

  if (!budget) {
    notFound('Orçamento não encontrado')
  }

  await db.delete(budgets).where(eq(budgets.id, id))
  return { deleted: true }
})

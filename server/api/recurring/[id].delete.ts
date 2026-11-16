import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { recurrings } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, id), eq(recurrings.userId, userId)))
    .limit(1)

  if (!rec) {
    notFound('Recorrência não encontrada')
  }

  await db.delete(recurrings).where(eq(recurrings.id, id))
  return { deleted: true }
})

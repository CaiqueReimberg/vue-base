import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { cards } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, id), eq(cards.userId, userId)))
    .limit(1)

  if (!card) {
    notFound(`Cartão com ID ${id} não encontrado`)
  }

  await db.delete(cards).where(eq(cards.id, id))
  return { deleted: true }
})

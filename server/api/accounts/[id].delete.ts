import { and, eq } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { accounts } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1)

  if (!account) {
    notFound(`Conta com ID ${id} não encontrada`)
  }

  await db.delete(accounts).where(eq(accounts.id, id))
  return { deleted: true }
})
